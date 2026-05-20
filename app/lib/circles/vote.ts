import { encodeCrcV2TransferData } from "@aboutcircles/sdk-utils";
import { encodeFunctionData } from "viem";

import { ANTE_CRC } from "@/lib/round/config";

import { HUB_V2_ADDRESS, safeTransferFromAbi, toTokenId } from "./hub";

// ASSUMPTIONS — best-effort, unverified until runtime-tested against a real avatar:
//  1. A personal-CRC ERC-1155 token id == the avatar address as a uint256.
//  2. A direct safeTransferFrom of personal CRC (voter -> pool) succeeds because
//     the pool Organisation avatar trusts the voter (see the PRD pool design).
//     If a voter -> pool transfer needs pathfinder routing, switch to
//     TransferBuilder.constructAdvancedTransfer from @aboutcircles/sdk-transfers.
//  3. encodeCrcV2TransferData metadata placed in the ERC-1155 `_data` is surfaced
//     by the indexer as a CrcV2_TransferData event (per recipes/payment-intent.md).

/** Pool Organisation avatar — receives stakes and pays winners out. */
const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS;

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
 * Build the host transaction for a stake-vote: a flat-ante transfer of the
 * voter's personal CRC to the pool, carrying the round + column in metadata.
 * Pass the result to `sendTransactions([tx])` from @aboutcircles/miniapp-sdk.
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
      toTokenId(voter),
      BigInt(ANTE_CRC) * ATTO,
      encodeCrcV2TransferData([voteReference(roundId, move)], 0x0001),
    ],
  });
  return { to: HUB_V2_ADDRESS, data, value: "0x0" };
}
