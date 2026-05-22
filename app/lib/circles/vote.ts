import { encodeCrcV2TransferData } from "@aboutcircles/sdk-utils";
import { encodeFunctionData } from "viem";

import { ANTE_CRC } from "@/lib/round/config";

import { HUB_V2_ADDRESS, safeTransferFromAbi, toTokenId } from "./hub";

// A vote is a flat-ante CRC stake transferred from the voter into the pool,
// carrying the round + column in the transfer metadata.
//
// Which token is staked: a fixed demo group's CRC (STAKE_GROUP). Circles users
// hold their balance as group CRC — personal CRC is minted slowly and is mostly
// wrapped/converted away — and the Hub only lets the pool receive a token whose
// issuer it trusts. So the pool trusts STAKE_GROUP (via scripts/trust-voters.mjs)
// and the stake transfers that group's ERC-1155 token. v1 uses one fixed group;
// per-voter token detection is roadmap.
//
// NOTES:
//  1. A Circles ERC-1155 token id == the avatar/group address as a uint256.
//  2. [VERIFIED 2026-05-21] encodeCrcV2TransferData metadata placed in the
//     ERC-1155 `_data` is surfaced by the indexer as a CrcV2_TransferData event.
//     lib/round/votes.ts ingests the stake token-agnostically (any token into
//     the pool with a valid vote reference counts).

/** Pool Organisation avatar — receives stakes and pays winners out. */
const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS;

/**
 * v1 demo stake token: the Circles group whose CRC voters stake. The pool
 * trusts this group on the Hub so it can receive the token; voters must hold
 * its CRC. Fixed for v1 — see the note above.
 */
const STAKE_GROUP = "0xC19BC204eb1c1D5B3FE500E5E5dfaBaB625F286c";

const ATTO = 10n ** 18n;

/** A vote's on-chain reference, carried in the CRC transfer metadata. */
export function voteReference(roundId: string, move: number): string {
  return `quorum.${roundId}.${move}`;
}

/** Parse a vote reference back to { roundId, move }, or null if malformed. */
export function parseVoteReference(
  reference: string,
): { roundId: string; move: number } | null {
  const match = /^quorum\.([0-9a-fA-F-]+)\.([0-6])$/.exec(reference);
  if (!match) return null;
  return { roundId: match[1], move: Number(match[2]) };
}

export interface HostTransaction {
  to: string;
  data: string;
  value: string;
}

/**
 * Build the host transaction for a stake-vote: a flat-ante transfer of
 * STAKE_GROUP's CRC from the voter to the pool, carrying the round + column in
 * metadata. Pass the result to `sendTransactions([tx])` from
 * @aboutcircles/miniapp-sdk.
 */
export function buildStakeVoteTx(
  voter: string,
  roundId: string,
  move: number,
): HostTransaction {
  if (!POOL_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_POOL_ADDRESS is not set — create the pool avatar and add it to .env.local",
    );
  }
  const data = encodeFunctionData({
    abi: safeTransferFromAbi,
    functionName: "safeTransferFrom",
    args: [
      voter as `0x${string}`,
      POOL_ADDRESS as `0x${string}`,
      toTokenId(STAKE_GROUP),
      BigInt(ANTE_CRC) * ATTO,
      encodeCrcV2TransferData([voteReference(roundId, move)], 0x0001),
    ],
  });
  return { to: HUB_V2_ADDRESS, data, value: "0x0" };
}
