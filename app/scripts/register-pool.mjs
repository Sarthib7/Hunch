/**
 * Registers a Circles v2 Organisation avatar to serve as Hunch's staking pool.
 *
 * Why an Organisation: it never mints personal CRC (no UBI), so the pool's
 * balance is exactly the CRC staked into it — clean accounting. On-chain, the
 * address that sends registerOrganization() *becomes* the avatar, so the EOA
 * behind POOL_DEPLOYER_KEY IS the pool address.
 *
 * Keep POOL_DEPLOYER_KEY safe — it controls the pool: you need it later to
 * trust the voters and to pay winners out. Use a FRESH key dedicated to the
 * pool, not your personal Circles wallet.
 *
 * Usage (from the app/ directory):
 *   POOL_DEPLOYER_KEY=0x<64-hex> node scripts/register-pool.mjs
 *
 * Optional env:
 *   GNOSIS_RPC_URL   override the default Gnosis Chain RPC
 *
 * Prerequisite: the deployer address must hold a little xDAI for gas
 * (~0.01 xDAI is plenty — registration is one cheap transaction).
 */

import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { gnosis } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

/** Circles Hub v2 on Gnosis Chain mainnet. */
const HUB_V2 = "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8";
/** No profile metadata — fine for a pool; a profile can be added later. */
const ZERO_DIGEST = `0x${"0".repeat(64)}`;
const ORG_NAME = "Hunch Pool";

const ABI = [
  {
    type: "function",
    name: "registerOrganization",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_metadataDigest", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isOrganization",
    inputs: [{ name: "_organization", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
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
    "Set POOL_DEPLOYER_KEY to a 0x-prefixed 64-hex private key.\n" +
      "  Run:  POOL_DEPLOYER_KEY=0x... node scripts/register-pool.mjs",
  );
}

const account = privateKeyToAccount(key);
const transport = http(process.env.GNOSIS_RPC_URL || undefined);
const publicClient = createPublicClient({ chain: gnosis, transport });
const walletClient = createWalletClient({ account, chain: gnosis, transport });

console.log(`\nDeployer / pool address:  ${account.address}`);

// Gas check — registration needs a little xDAI.
const bal = await publicClient.getBalance({ address: account.address });
console.log(`xDAI balance:             ${formatEther(bal)} xDAI`);
if (bal === 0n) {
  die(
    "This address has no xDAI for gas.\n" +
      "  Send it ~0.01 xDAI on Gnosis Chain and run this again.",
  );
}

// Idempotency — if it's already an Organisation, there is nothing to do.
const already = await publicClient.readContract({
  address: HUB_V2,
  abi: ABI,
  functionName: "isOrganization",
  args: [account.address],
});
if (already) {
  console.log(`\n✓ Already registered as an Organisation avatar — nothing to do.`);
  console.log(`\n→ NEXT_PUBLIC_POOL_ADDRESS=${account.address}\n`);
  process.exit(0);
}

// Register.
console.log(`\nRegistering Organisation "${ORG_NAME}" on the Circles v2 Hub…`);
let hash;
try {
  hash = await walletClient.writeContract({
    address: HUB_V2,
    abi: ABI,
    functionName: "registerOrganization",
    args: [ORG_NAME, ZERO_DIGEST],
  });
} catch (err) {
  die(
    `Registration call failed: ${err.shortMessage || err.message}\n` +
      "  Common cause: this address is already a human/group avatar — use a fresh key.",
  );
}
console.log(`tx sent:  ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  die(`Registration tx reverted — https://gnosisscan.io/tx/${hash}`);
}

// Confirm the on-chain state actually flipped.
const ok = await publicClient.readContract({
  address: HUB_V2,
  abi: ABI,
  functionName: "isOrganization",
  args: [account.address],
});
if (!ok) {
  die("Tx succeeded but the address is still not an Organisation — investigate.");
}

console.log(`\n✓ Organisation avatar registered.`);
console.log(`\n  Pool address:  ${account.address}`);
console.log(`  Explorer:      https://gnosisscan.io/address/${account.address}`);
console.log(`\nNext steps:`);
console.log(`  1. Put this line in app/.env.local (replacing the current value):`);
console.log(`       NEXT_PUBLIC_POOL_ADDRESS=${account.address}`);
console.log(`  2. Restart \`pnpm dev\` so it picks up the new env value.`);
console.log(`  3. Keep POOL_DEPLOYER_KEY safe — it controls the pool.`);
console.log(`  4. Once you have the 5 voter addresses, the pool must trust each`);
console.log(`     of them — ask me for the trust script.\n`);
