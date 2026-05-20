import { NextResponse } from "next/server";

import { ensureActiveGame, sweepExpiredRounds } from "@/lib/round/lifecycle";
import { recordNewVotes } from "@/lib/round/votes";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint — drives the game forward.
 * Records new stake-votes, resolves any round past its deadline, then ensures
 * an active game exists. Ping on a schedule (Vercel Cron or an external pinger).
 * When CRON_SECRET is set, callers must send `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const votesRecorded = await recordNewVotes();
    const roundsResolved = await sweepExpiredRounds();
    const game = await ensureActiveGame();
    return NextResponse.json({
      ok: true,
      votesRecorded,
      roundsResolved,
      activeGameId: game.id,
      moveNumber: game.move_number,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
