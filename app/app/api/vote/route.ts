import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";

import { resolveRound } from "@/lib/round/lifecycle";
import { recordNewVotes } from "@/lib/round/votes";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CIRCLES_RPC = "https://rpc.aboutcircles.com/";
const gnosisClient = createPublicClient({
  chain: gnosis,
  transport: http(CIRCLES_RPC),
});

interface VoteBody {
  txHash: string;
  roundId: string;
}

/**
 * Instant vote ingestion — the fast path the client calls right after the
 * host signs the stake transfer.
 *
 * Pipeline:
 *   1. Wait for the tx to mine on Gnosis (~5s typical, 15s cap).
 *   2. Retry-poll the indexer-backed recordNewVotes() until our tx shows up
 *      (~5–10s lag, capped at ~12s).
 *   3. Immediately call resolveRound so the bot plays and the next round opens.
 *
 * The whole vote is on-chain regardless of whether this endpoint succeeds —
 * /api/cron is the eventual-consistency backup. So we never surface errors
 * to the user; we just return early and let the cron catch up.
 *
 * No auth: all validation is on-chain (recordVote verifies the transfer hit
 * the pool, the voter is trust-verified, the move is legal). An open POST
 * here can only trigger redundant work, never inject a fake vote.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VoteBody | null;
  if (
    !body ||
    typeof body.txHash !== "string" ||
    typeof body.roundId !== "string"
  ) {
    return NextResponse.json(
      { error: "txHash and roundId required" },
      { status: 400 },
    );
  }

  // 1. Wait for the tx to confirm on chain.
  let receipt;
  try {
    receipt = await gnosisClient.waitForTransactionReceipt({
      hash: body.txHash as `0x${string}`,
      timeout: 15_000,
    });
  } catch {
    return NextResponse.json(
      { ok: false, status: "tx_timeout" },
      { status: 408 },
    );
  }
  if (receipt.status !== "success") {
    return NextResponse.json(
      { ok: false, status: "tx_reverted" },
      { status: 400 },
    );
  }

  // 2. Poll the indexer until the vote lands in our DB. Idempotent.
  const db = supabaseAdmin();
  let recorded = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    await recordNewVotes();
    const { data: vote } = await db
      .from("votes")
      .select("id")
      .eq("tx_hash", body.txHash)
      .maybeSingle();
    if (vote) {
      recorded = true;
      break;
    }
  }
  if (!recorded) {
    // Indexer hadn't caught up in ~12s. Cron will pick this up later.
    return NextResponse.json({ ok: true, status: "pending_indexer" });
  }

  // 3. Resolve the round now — bot plays, next round opens.
  const { data: round } = await db
    .from("rounds")
    .select("*")
    .eq("id", body.roundId)
    .maybeSingle();
  if (round && round.status === "open") {
    await resolveRound(round);
  }

  return NextResponse.json({ ok: true, status: "resolved" });
}
