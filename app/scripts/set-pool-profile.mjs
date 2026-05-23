/**
 * Pin a Profile JSON to IPFS via the Circles profile service, then write
 * the on-chain `nameRegistry.updateMetadataDigest` so the Hunch pool's
 * Organisation avatar shows up with a proper name + description inside the
 * Circles host (instead of the generic "anonymous Organisation" tile).
 *
 * The pool address IS the EOA behind POOL_DEPLOYER_KEY (see
 * register-pool.mjs), so the same key signs the metadata update.
 *
 * Usage (from the app/ directory):
 *   POOL_DEPLOYER_KEY=0x<64-hex> node scripts/set-pool-profile.mjs
 *
 * Optional env:
 *   POOL_PROFILE_IMAGE_URL  full-size image URL (any HTTPS)
 *   GNOSIS_RPC_URL          override the default Gnosis Chain RPC
 *
 * Re-runnable — pinning a new payload + updating the digest is idempotent
 * (no-op if the new digest matches the current one).
 */

import { Sdk } from "@aboutcircles/sdk";
import { cidV0ToHex } from "@aboutcircles/sdk-utils";
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { gnosis } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const NAME_REGISTRY = "0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474";

const NAME_REGISTRY_ABI = [
  {
    type: "function",
    name: "updateMetadataDigest",
    inputs: [{ name: "_metadataDigest", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMetadataDigest",
    inputs: [{ name: "_avatar", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
];

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const key = process.env.POOL_DEPLOYER_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  die(
    "Set POOL_DEPLOYER_KEY to the same 0x-prefixed 64-hex private key you used\n" +
      "  for register-pool.mjs (it controls the pool avatar).\n" +
      "  Run:  POOL_DEPLOYER_KEY=0x... node scripts/set-pool-profile.mjs",
  );
}

const account = privateKeyToAccount(key);
const transport = http(process.env.GNOSIS_RPC_URL || undefined);
const publicClient = createPublicClient({ chain: gnosis, transport });
const walletClient = createWalletClient({ account, chain: gnosis, transport });

console.log(`\nPool / signer address:    ${account.address}`);

const bal = await publicClient.getBalance({ address: account.address });
console.log(`xDAI balance:             ${formatEther(bal)} xDAI`);
if (bal === 0n) {
  die(
    "This address has no xDAI for gas.\n" +
      "  Send it ~0.005 xDAI on Gnosis Chain and run this again.",
  );
}

// The profile payload. Hub name is immutable at the contract level ("Quorum
// Pool" for our pool, set at registration), but the *profile* name is shown
// by every Circles UI and can be set/updated freely. So "Hunch Pool" here
// renames the avatar everywhere users actually see it.
const profile = {
  name: "Hunch Pool",
  description:
    "Staking pool for Hunch — a crowd plays chess against a deterministic bot, every move a trust-gated, 1-CRC staked vote among Circles-verified avatars on Gnosis Chain.",
};
if (process.env.POOL_PROFILE_IMAGE_URL) {
  profile.imageUrl = process.env.POOL_PROFILE_IMAGE_URL;
}

console.log(`\nPinning profile to IPFS via the Circles profile service…`);
const sdk = new Sdk(); // defaults to Gnosis mainnet + the production profile service
let cid;
try {
  cid = await sdk.profiles.create(profile);
} catch (err) {
  die(`Profile pin failed: ${err.shortMessage || err.message}`);
}
console.log(`CID:                      ${cid}`);

const newDigest = cidV0ToHex(cid);
const currentDigest = await publicClient.readContract({
  address: NAME_REGISTRY,
  abi: NAME_REGISTRY_ABI,
  functionName: "getMetadataDigest",
  args: [account.address],
});

console.log(`\nCurrent on-chain digest:  ${currentDigest}`);
console.log(`New digest:               ${newDigest}`);
if (currentDigest.toLowerCase() === newDigest.toLowerCase()) {
  console.log(`\n✓ On-chain digest already matches — nothing to update.\n`);
  process.exit(0);
}

console.log(`\nSubmitting updateMetadataDigest…`);
let hash;
try {
  hash = await walletClient.writeContract({
    address: NAME_REGISTRY,
    abi: NAME_REGISTRY_ABI,
    functionName: "updateMetadataDigest",
    args: [newDigest],
  });
} catch (err) {
  die(`Tx send failed: ${err.shortMessage || err.message}`);
}
console.log(`tx sent:                  ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  die(`Tx reverted — https://gnosisscan.io/tx/${hash}`);
}

console.log(`\n✓ Pool profile updated on chain.`);
console.log(`  Explorer:               https://gnosisscan.io/tx/${hash}`);
console.log(`  Circles app:            https://app.metri.xyz/profile/${account.address}`);
console.log(
  `\nThe pool will now render as "${profile.name}" with its description in any\n` +
    `Circles UI that reads the profile (Metri, the host playground, etc.).\n`,
);
