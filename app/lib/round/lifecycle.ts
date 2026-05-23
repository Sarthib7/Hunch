import "server-only";

import { chess, chessBot } from "@/lib/games/chess";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseAdmin } from "@/lib/supabase/server";

import { ROUND_DURATION_MS } from "./config";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];
type VoteRow = Database["public"]["Tables"]["votes"]["Row"];

export type GameStatus = "active" | "crowd_won" | "crowd_lost" | "draw";

/** Deterministic fallback when nobody votes — alphabetically first legal UCI. */
function fallbackMove(state: string): string {
  const legal = chess.legalMoves(state);
  if (legal.length === 0) {
    throw new Error("no legal moves in a position the game still considers playing");
  }
  return [...legal].sort()[0];
}

/**
 * The crowd's chosen move for a round: the most-voted legal UCI, ties broken
 * alphabetically; the fallback move if nobody voted.
 */
function tallyWinningMove(state: string, votes: VoteRow[]): string {
  const legalSet = new Set(chess.legalMoves(state));
  const counts = new Map<string, number>();
  for (const vote of votes) {
    if (legalSet.has(vote.move)) {
      counts.set(vote.move, (counts.get(vote.move) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return fallbackMove(state);

  let best = "";
  let bestCount = -1;
  for (const [uci, count] of counts) {
    if (count > bestCount || (count === bestCount && uci < best)) {
      bestCount = count;
      best = uci;
    }
  }
  return best;
}

/** Open a fresh voting round for a game at the given board position. */
async function openRound(
  gameId: string,
  boardState: string,
  roundNumber: number,
): Promise<void> {
  const deadline = new Date(Date.now() + ROUND_DURATION_MS).toISOString();
  const { error } = await supabaseAdmin().from("rounds").insert({
    game_id: gameId,
    move_number: roundNumber,
    status: "open",
    deadline,
    board_before: boardState,
  });
  if (error) throw new Error(`openRound failed: ${error.message}`);
}

/**
 * Ensure exactly one active game exists with an open round.
 * Creates a fresh game when there is none, rolling the pot over from a
 * previous loss or draw (a win pays the pot out, so it resets to zero).
 */
export async function ensureActiveGame(): Promise<GameRow> {
  const db = supabaseAdmin();

  const { data: active, error } = await db
    .from("games")
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`ensureActiveGame query failed: ${error.message}`);
  if (active) return active;

  const { data: last } = await db
    .from("games")
    .select("status, pool_crc")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rolloverPool =
    last && (last.status === "crowd_lost" || last.status === "draw")
      ? last.pool_crc
      : 0;

  const initial = chess.serialize(chess.initialState());
  const { data: game, error: insertErr } = await db
    .from("games")
    .insert({
      game_engine: chess.id,
      state: initial,
      status: "active",
      move_number: 0,
      pool_crc: rolloverPool,
    })
    .select("*")
    .single();
  if (insertErr || !game) {
    throw new Error(`createGame failed: ${insertErr?.message ?? "no row"}`);
  }

  await openRound(game.id, initial, 1);
  return game;
}

/**
 * Resolve one open round: tally its votes, play the crowd's move, let the bot
 * reply, then open the next round or end the game.
 *
 * Assumes serial invocation (the cron). Double-resolution protection is a
 * hardening item — see PRD §4 roadmap.
 */
export async function resolveRound(round: RoundRow): Promise<void> {
  const db = supabaseAdmin();

  // Re-fetch the round to guard against double-resolve races between the cron
  // sweep and /api/vote. Not a perfect lock (TOCTOU), but it closes the
  // window from ~minutes to ~milliseconds — sufficient for the demo crowd.
  const { data: currentRound } = await db
    .from("rounds")
    .select("status")
    .eq("id", round.id)
    .maybeSingle();
  if (!currentRound || currentRound.status !== "open") return;

  const { data: game, error: gameErr } = await db
    .from("games")
    .select("*")
    .eq("id", round.game_id)
    .single();
  if (gameErr || !game) {
    throw new Error(`resolveRound: game not found (${gameErr?.message ?? ""})`);
  }
  if (game.status !== "active") return; // already ended

  const { data: votes, error: voteErr } = await db
    .from("votes")
    .select("*")
    .eq("round_id", round.id);
  if (voteErr) {
    throw new Error(`resolveRound: votes query failed (${voteErr.message})`);
  }

  // No-fallback policy: the bot waits for the crowd. If no one voted by the
  // deadline, leave the round open and let votes trickle in — resolution will
  // happen on the next cron tick after at least one vote lands. Chess has too
  // many legal moves for an "alphabetically first" or "random" fallback to
  // produce sensible play; a vote-driven cadence is the right model.
  if (!votes || votes.length === 0) return;

  let state = chess.deserialize(game.state);

  // 1. Play the crowd's move.
  const winningMove = tallyWinningMove(state, votes);
  state = chess.applyMove(state, winningMove);
  let moveNumber = game.move_number + 1;

  // 2. Result after the crowd's move.
  let status: GameStatus = "active";
  let result = chess.result(state);
  if (result.status === "win") status = result.winner === 1 ? "crowd_won" : "crowd_lost";
  else if (result.status === "draw") status = "draw";

  // 3. The bot replies if the game is still going.
  if (status === "active") {
    const botMove = chessBot.pickMove(state);
    state = chess.applyMove(state, botMove);
    moveNumber += 1;
    result = chess.result(state);
    if (result.status === "win") status = result.winner === 1 ? "crowd_won" : "crowd_lost";
    else if (result.status === "draw") status = "draw";
  }

  const nextState = chess.serialize(state);
  const ended = status !== "active";

  // 4. Mark the round resolved.
  const { error: roundErr } = await db
    .from("rounds")
    .update({
      status: "resolved",
      winning_move: winningMove,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", round.id);
  if (roundErr) {
    throw new Error(`resolveRound: round update failed (${roundErr.message})`);
  }

  // 5. Advance the game.
  const { error: gameUpdErr } = await db
    .from("games")
    .update({
      state: nextState,
      move_number: moveNumber,
      status,
      ended_at: ended ? new Date().toISOString() : null,
    })
    .eq("id", game.id);
  if (gameUpdErr) {
    throw new Error(`resolveRound: game update failed (${gameUpdErr.message})`);
  }

  // 6. Continue the game with a fresh round, or leave it ended for payout.
  if (!ended) {
    await openRound(game.id, nextState, round.move_number + 1);
  }
}

/** Resolve every open round whose deadline has passed. Returns the count. */
export async function sweepExpiredRounds(): Promise<number> {
  const { data: expired, error } = await supabaseAdmin()
    .from("rounds")
    .select("*")
    .eq("status", "open")
    .lt("deadline", new Date().toISOString());
  if (error) {
    throw new Error(`sweepExpiredRounds query failed: ${error.message}`);
  }
  for (const round of expired ?? []) {
    await resolveRound(round);
  }
  return expired?.length ?? 0;
}
