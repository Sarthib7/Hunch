// Circles Hub v2 — contract address and the slice of its ABI Hunch needs.

/** Circles Hub v2 on Gnosis Chain mainnet. */
export const HUB_V2_ADDRESS =
  "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8" as const;

/** ERC-1155 `safeTransferFrom` — moves personal CRC, with metadata in `_data`. */
export const safeTransferFromAbi = [
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_from", type: "address" },
      { name: "_to", type: "address" },
      { name: "_id", type: "uint256" },
      { name: "_value", type: "uint256" },
      { name: "_data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/** Hub v2 `isTrusted(truster, trustee)` — true when `truster` trusts `trustee`. */
export const isTrustedAbi = [
  {
    type: "function",
    name: "isTrusted",
    stateMutability: "view",
    inputs: [
      { name: "_truster", type: "address" },
      { name: "_trustee", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** An avatar's personal-CRC ERC-1155 token id is its address as a uint256. */
export function toTokenId(avatar: string): bigint {
  return BigInt(avatar);
}
