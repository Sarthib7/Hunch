import "server-only";

import { decodeCrcV2TransferData } from "@aboutcircles/sdk-utils";

import { getTrustStatus } from "@/lib/circles/trust";
import { parseVoteReference } from "@/lib/circles/vote";
import { connectFour } from "@/lib/games/connect-four";
import { supabaseAdmin } from "@/lib/supabase/server";

import { ANTE_CRC } from "./config";

const CIRCLES_RPC = "https://rpc.aboutcircles.com/";
const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS;
const ATTO = 10n ** 18n;

// ── Parsing circles_events ────────────────────────────────────────────────
// The metadata decode is verified against the SDK types: encodeCrcV2TransferData
// with type 0x0001 round-trips to `decoded.payload` (a single string).
//
// ASSUMPTION (best-effort, unverified): the *event envelope* field names of a
// circles_events `CrcV2_TransferData` event (txHash / from / value). They are
// isolated in `parseStakeEvent` — once a real stake transfer can be inspected,
// correct it here and nowhere else.

interface StakeEvent {
  txHash: string;
  from: string;
  amountCrc: number;
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

function attoToCrc(value: unknown): number {
  try {
    return Number(BigInt(str(value) || "0") / ATTO);
  } catch {
    return 0;
  }
}

function parseStakeEvent(raw: unknown): StakeEvent | null {
  const event = asRecord(raw);
  if (!event) return null;
  // Transfer fields may be nested under `values` or exposed flat.
  const fields = asRecord(event.values) ?? event;

  const txHash = str(
    event.transactionHash ?? event.txHash ?? fields.transactionHash,
  );
  const from = str(fields.from ?? fields.sender).toLowerCase();
  const data = fields.data ?? event.data;
  if (!txHash || !from || typeof data !== "string") return null;

  let reference: string;
  try {
    const decoded = decodeCrcV2TransferData(data);
    // Quorum encodes the vote as a single 0x0001 UTF-8 string.
    if (decoded.type !== 0x0001 || typeof decoded.payload !== "string") {
      return null;
    }
    reference = decoded.payload;
  } catch {
    return null;
  }

  return {
    txHash,
    from,
    amountCrc: attoToCrc(fields.value ?? fields.amount),
    reference,
  };
}

// ── Recording votes ───────────────────────────────────────────────────────

/**
 * Poll the Circles indexer for stake transfers into the pool and record any
 * that aren't yet on file. Returns the number of new votes recorded.
 */
export async function recordNewVotes(): Promise<number> {
  if (!POOL_ADDRESS) return 0; // pool not configured yet

  const res = await fetch(CIRCLES_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "circles_events",
      params: [POOL_ADDRESS, null, null, ["CrcV2_TransferData"]],
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

  let recorded = 0;
  for (const raw of json.result ?? []) {
    const stake = parseStakeEvent(raw);
    if (!stake) continue;
    const vote = parseVoteReference(stake.reference);
    if (vote && (await recordVote(stake, vote))) recorded += 1;
  }
  return recorded;
}

/** Validate a single stake transfer and, if it's a valid vote, record it. */
async function recordVote(
  stake: StakeEvent,
  vote: { roundId: string; move: number },
): Promise<boolean> {
  const db = supabaseAdmin();

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
  const state = connectFour.deserialize(round.board_before);
  if (!connectFour.legalMoves(state).includes(vote.move)) return false;

  // The stake must cover the flat ante.
  if (stake.amountCrc < ANTE_CRC) return false;

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
