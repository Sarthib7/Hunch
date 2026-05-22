/**
 * Makes the Hunch pool Organisation trust a set of voter avatars.
 *
 * Why: a vote is a CRC stake-transfer from the voter into the pool. The pool
 * trusting each voter (a) lets that transfer settle, and (b) gives each voter
 * an incoming trust edge — which is exactly what Hunch's Sybil gate checks
 * (trustedByCount >= 1). One action, both jobs.
 *
 * Run this AFTER scripts/register-pool.mjs has registered the pool.
 *
 * Usage (from the app/ directory) — pass voter addresses as arguments:
 *   POOL_DEPLOYER_KEY=0x<64-hex> node scripts/trust-voters.mjs 0xVoter1 0xVoter2 …
 *
 * Optional env:
 *   GNOSIS_RPC_URL   override the default Gnosis Chain RPC
 *
 * Idempotent: a voter the pool already trusts is skipped. Needs a little xDAI
 * for gas (one cheap tx per newly-trusted voter).
 */

import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { gnosis } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

/** Circles Hub v2 on Gnosis Chain mainnet. */
const HUB_V2 = "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8";
/** uint96 max — Circles' sentinel for a trust edge that never expires. */
const NO_EXPIRY = 2n ** 96n - 1n;

const ABI = [
  {
    type: "function",
    name: "isOrganization",
    inputs: [{ name: "_organization", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isTrusted",
    inputs: [
      { name: "_truster", type: "address" },
      { name: "_trustee", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "trust",
    inputs: [
      { name: "_trustReceiver", type: "address" },
      { name: "_expiry", type: "uint96" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
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
      "  Run:  POOL_DEPLOYER_KEY=0x... node scripts/trust-voters.mjs 0xVoter1 …",
  );
}

const voters = process.argv.slice(2);
if (voters.length === 0) {
  die("Pass one or more voter addresses as arguments.");
}
for (const v of voters) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) die(`Not a valid address: ${v}`);
}

const account = privateKeyToAccount(key);
const transport = http(process.env.GNOSIS_RPC_URL || undefined);
const publicClient = createPublicClient({ chain: gnosis, transport });
const walletClient = createWalletClient({ account, chain: gnosis, transport });

console.log(`\nPool (truster):  ${account.address}`);

// The pool must be a registered Organisation before it can trust anyone.
const registered = await publicClient.readContract({
  address: HUB_V2,
  abi: ABI,
  functionName: "isOrganization",
  args: [account.address],
});
if (!registered) {
  die("This address is not a registered Organisation yet — run register-pool.mjs first.");
}

const bal = await publicClient.getBalance({ address: account.address });
console.log(`xDAI balance:    ${formatEther(bal)} xDAI`);
if (bal === 0n) {
  die("No xDAI for gas. Send the pool a little xDAI and run this again.");
}

let trusted = 0;
let skipped = 0;
for (const voter of voters) {
  const already = await publicClient.readContract({
    address: HUB_V2,
    abi: ABI,
    functionName: "isTrusted",
    args: [account.address, voter],
  });
  if (already) {
    console.log(`  · ${voter}  — already trusted, skipped`);
    skipped += 1;
    continue;
  }
  try {
    const hash = await walletClient.writeContract({
      address: HUB_V2,
      abi: ABI,
      functionName: "trust",
      args: [voter, NO_EXPIRY],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      die(`trust(${voter}) reverted — https://gnosisscan.io/tx/${hash}`);
    }
    console.log(`  ✓ ${voter}  — trusted  (${hash})`);
    trusted += 1;
  } catch (err) {
    die(`trust(${voter}) failed: ${err.shortMessage || err.message}`);
  }
}

console.log(`\n✓ Done — ${trusted} newly trusted, ${skipped} already trusted.\n`);
