/**
 * Generates a fresh secp256k1 keypair for the Hunch pool deployer.
 *
 * Prints the private key (keep secret — this is POOL_DEPLOYER_KEY) and the
 * address derived from it (fund THIS with xDAI; it becomes the pool avatar).
 *
 * An EOA is nothing but a keypair: the private key is random entropy, the
 * address is derived from it deterministically, and any address is fundable
 * the moment someone sends value to it — there is no on-chain "create account"
 * step for EOAs.
 *
 * Usage (from the app/ directory):
 *   node scripts/new-key.mjs
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const { address } = privateKeyToAccount(privateKey);

console.log("\n  PRIVATE KEY  — secret, this is POOL_DEPLOYER_KEY:");
console.log(`    ${privateKey}`);
console.log("\n  ADDRESS  — fund this with ~0.01 xDAI; it becomes the pool:");
console.log(`    ${address}\n`);
