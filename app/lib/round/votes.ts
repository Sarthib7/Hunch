import "server-only";

import { decodeCrcV2TransferData } from "@aboutcircles/sdk-utils";

import { getTrustStatus } from "@/lib/circles/trust";
import { parseVoteReference } from "@/lib/circles/vote";
import { chess } from "@/lib/games/chess";
import { supabaseAdmin } from "@/lib/supabase/server";

import { ANTE_CRC } from "./config";

const CIRCLES_RPC = "https://rpc.aboutcircles.com/";
const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS?.toLowerCase();

// ── circles_events shapes — verified against the live indexer (2026-05-21) ──
//
// A stake-vote is one safeTransferFrom on the Hub; the indexer surfaces it as
// TWO events that share a transactionHash, each under an { event, values }
// envelope:
//   • CrcV2_TransferData   { from, to, data, transactionHash } — the vote
//       reference, carried in `data`. Has NO amount field.
//   • CrcV2_TransferSingle { from, to, id, value, transactionHash } — the
//       ERC-1155 token movement and its `value` (atto-CRC). Has NO metadata.
//
// Two gotchas the live data exposed (each previously a bug here):
//   1. `data` comes back Postgres-bytea encoded ("\x01…"), not "0x01…", so it
//      must be normalised before decodeCrcV2TransferData (which expects 0x).
//   2. The amount is not on the TransferData event — it must be correlated
//      from the TransferSingle event of the same transaction.
//
// Still unverified (needs one real on-chain stake into a registered pool):
// that a direct safeTransferFrom voter→pool succeeds — see vote.ts assumption 2.

interface StakeEvent {
  txHash: string;
  from: string;
  reference: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Normalise an indexer hex string (`\x…` bytea or `0x…`) to a `0x` hex string. */
function toHex(value: string): string {
  if (value.startsWith("\\x")) return `0x${value.slice(2)}`;
  if (value.startsWith("0x")) return value;
  return `0x${value}`;
}

/** Parse a CrcV2_TransferData event into a stake-vote candidate (no amount). */
function parseStakeEvent(raw: unknown): StakeEvent | null {
  const fields = asRecord(asRecord(raw)?.values);
  if (!fields) return null;

  const txHash = str(fields.transactionHash);
  const from = str(fields.from).toLowerCase();
  const to = str(fields.to).toLowerCase();
  const data = fields.data;
  if (!txHash || !from || to !== POOL_ADDRESS || typeof data !== "string") {
    return null;
  }

  let reference: string;
  try {
    const decoded = decodeCrcV2TransferData(toHex(data));
    // Hunch encodes the vote as a single 0x0001 UTF-8 string.
    if (decoded.type !== 0x0001 || typeof decoded.payload !== "string") {
      return null;
    }
    reference = decoded.payload;
  } catch {
    return null;
  }

  return { txHash, from, reference };
}

/**
 * Sum, per transaction, the atto-CRC that landed in the pool — read from
 * CrcV2_TransferSingle events, since CrcV2_TransferData carries no amount.
 */
function inboundByTx(rawEvents: unknown[]): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const raw of rawEvents) {
    const fields = asRecord(asRecord(raw)?.values);
    if (!fields) continue;
    const txHash = str(fields.transactionHash);
    const to = str(fields.to).toLowerCase();
    if (!txHash || to !== POOL_ADDRESS) continue;
    try {
      const value = BigInt(str(fields.value) || "0");
      totals.set(txHash, (totals.get(txHash) ?? 0n) + value);
    } catch {
      // non-numeric value — skip
    }
  }
  return totals;
}

/** Fetch one event type for the pool from the Circles indexer. */
async function fetchEvents(eventType: string): Promise<unknown[]> {
  const res = await fetch(CIRCLES_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // [address, fromBlock, toBlock, eventTypes]. The indexer returns at most
    // the 100 most recent matches — ample for a single demo game.
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "circles_events",
      params: [POOL_ADDRESS, null, null, [eventType]],
    }),
  });
  if (!res.ok) throw new Error(`circles_events RPC returned ${res.status}`);
  const json = (await res.json()) as {
    result?: unknown[];
    error?: { message?: string };
  };
  if (json.error) {
    throw new Error(`circles_events error: ${json.error.message ?? "unknown"}`);
  }
  return json.result ?? [];
}

/**
 * Poll the Circles indexer for stake transfers into the pool and record any
 * that aren't yet on file. Returns the number of new votes recorded.
 */
export async function recordNewVotes(): Promise<number> {
  if (!POOL_ADDRESS) return 0; // pool not configured yet

  const [transferData, transferSingle] = await Promise.all([
    fetchEvents("CrcV2_TransferData"),
    fetchEvents("CrcV2_TransferSingle"),
  ]);
  const inbound = inboundByTx(transferSingle);

  let recorded = 0;
  for (const raw of transferData) {
    const stake = parseStakeEvent(raw);
    if (!stake) continue;
    const vote = parseVoteReference(stake.reference);
    if (!vote) continue;
    const stakedAtto = inbound.get(stake.txHash) ?? 0n;
    if (await recordVote(stake, vote, stakedAtto)) recorded += 1;
  }
  return recorded;
}

/** Validate a single stake transfer and, if it's a valid vote, record it. */
async function recordVote(
  stake: StakeEvent,
  vote: { roundId: string; move: string },
  stakedAtto: bigint,
): Promise<boolean> {
  const db = supabaseAdmin();

  // The transfer must actually have moved CRC into the pool. The flat 1-CRC
  // ante is enforced client-side by buildStakeVoteTx; here we only reject a
  // transfer that staked nothing — a metadata-only / zero-value spoof.
  if (stakedAtto <= 0n) return false;

  // Idempotency — this transfer already on file?
  const { data: existing } = await db
    .from("votes")
    .select("id")
    .eq("tx_hash", stake.txHash)
    .maybeSingle();
  if (existing) return false;

  // The round must exist and still be open.
  const { data: round } = await db
    .from("rounds")
    .select("*")
    .eq("id", vote.roundId)
    .maybeSingle();
  if (!round || round.status !== "open") return false;

  // The move must be legal in the round's position.
  const state = chess.deserialize(round.board_before);
  if (!chess.legalMoves(state).includes(vote.move)) return false;

  // The voter must be trust-verified — the Sybil gate. Fail closed.
  try {
    const trust = await getTrustStatus(stake.from);
    await db.from("players").upsert({
      address: stake.from,
      trusted_by: trust.trustedBy,
      registered: trust.registered,
      verified: trust.verified,
      checked_at: new Date().toISOString(),
    });
    if (!trust.verified) return false;
  } catch {
    return false;
  }

  // Record the vote. unique(round_id, voter) enforces one-person-one-vote;
  // unique(tx_hash) is the idempotency backstop.
  const { error: insertErr } = await db.from("votes").insert({
    round_id: vote.roundId,
    voter: stake.from,
    move: vote.move,
    stake_crc: ANTE_CRC,
    tx_hash: stake.txHash,
  });
  if (insertErr) return false; // duplicate vote or a race — skip

  // Add the stake to the game's pool.
  const { data: game } = await db
    .from("games")
    .select("pool_crc")
    .eq("id", round.game_id)
    .single();
  if (game) {
    await db
      .from("games")
      .update({ pool_crc: game.pool_crc + ANTE_CRC })
      .eq("id", round.game_id);
  }

  return true;
}
