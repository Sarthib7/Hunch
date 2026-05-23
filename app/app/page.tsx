"use client";

import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";

import { ChessBoard } from "@/components/game/ChessBoard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveGame } from "@/hooks/use-live-game";
import { useTrust } from "@/hooks/use-trust";
import { formatCooldown, useVoterCooldown } from "@/hooks/use-voter-cooldown";
import { useWallet } from "@/hooks/use-wallet";
import { buildStakeVoteTx } from "@/lib/circles/vote";
import { chess } from "@/lib/games/chess";
import { haptic } from "@/lib/haptics";
import { ANTE_CRC } from "@/lib/round/config";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];
type VoteRow = Database["public"]["Tables"]["votes"]["Row"];

type VoteState =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "submitted"; uci: string }
  | { kind: "error"; message: string };

export default function GamePage() {
  const { live, refetch } = useLiveGame();

  return (
    <div className="mx-auto w-full max-w-md">
      {live.phase === "loading" && <GameSkeleton />}
      {live.phase === "empty" && <EmptyState />}
      {live.phase === "error" && (
        <ErrorState message={live.message} onRetry={refetch} />
      )}
      {live.phase === "ready" && (
        <LiveGameView
          game={live.game}
          round={live.round}
          votes={live.votes}
          lastResolved={live.lastResolved}
        />
      )}
    </div>
  );
}

function LiveGameView({
  game,
  round,
  votes,
  lastResolved,
}: {
  game: GameRow;
  round: RoundRow | null;
  votes: VoteRow[];
  lastResolved: RoundRow | null;
}) {
  const { address, isConnected } = useWallet();
  const verified = useTrust(isConnected ? address : null);
  const cooldown = useVoterCooldown(isConnected ? address : null);
  const [vote, setVote] = useState<VoteState>({ kind: "idle" });

  const state = chess.deserialize(game.state);
  const legalMoves = chess.legalMoves(state);
  const ended = game.status !== "active";
  const lastMoves = reconstructLastMoves(lastResolved, game.state);

  // Fire a haptic "arrive" pulse the first time the bot's move shows up
  // for a given game-ply — signals "the board changed, look here".
  const lastBotKey = lastMoves?.bot ? `${game.move_number}:${lastMoves.bot}` : null;
  const prevBotKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastBotKey && lastBotKey !== prevBotKey.current) {
      if (prevBotKey.current !== null) haptic("arrive");
      prevBotKey.current = lastBotKey;
    }
  }, [lastBotKey]);

  const myAddress = address?.toLowerCase() ?? null;
  const recordedVote = myAddress
    ? (votes.find((v) => v.voter.toLowerCase() === myAddress)?.move ?? null)
    : null;
  const myVote = vote.kind === "submitted" ? vote.uci : recordedVote;
  const hasVoted = myVote !== null;

  const canVote =
    !ended &&
    round !== null &&
    isConnected &&
    verified === true &&
    !hasVoted &&
    !cooldown.inCooldown &&
    vote.kind !== "signing";

  async function handleVote(uci: string) {
    if (!round || !address) return;
    setVote({ kind: "signing" });
    try {
      const tx = buildStakeVoteTx(address, round.id, uci);
      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      const hashes = await sendTransactions([tx]);
      setVote({ kind: "submitted", uci });

      // Fire the instant-ingestion endpoint — server waits for the tx, records
      // the vote, and resolves the round so the bot plays. Realtime updates
      // the UI when done. We don't await: the user sees "submitted" right away
      // and the new position arrives via the Realtime subscription. Errors
      // fall through to the cron safety net, so we don't surface them.
      const txHash = hashes?.[0];
      if (txHash) {
        void fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash, roundId: round.id }),
        }).catch(() => undefined);
      }
    } catch (err) {
      setVote({
        kind: "error",
        message: err instanceof Error ? err.message : "Vote failed",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Crowd vs. the bot</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            Pool {game.pool_crc.toLocaleString()} CRC
          </span>
        </CardTitle>
        <CardDescription>
          {ended ? (
            <>Game over · {game.move_number} plies played</>
          ) : round ? (
            <>The crowd&apos;s move · vote to advance the game</>
          ) : (
            <>Next round opening…</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChessBoard
          fen={state}
          legalMoves={legalMoves}
          votes={ended ? undefined : moveTally(votes)}
          myVote={myVote}
          lastMoves={lastMoves}
          onVote={canVote ? handleVote : undefined}
          disabled={!canVote}
        />
        {ended ? (
          <ResultBanner status={game.status} pool={game.pool_crc} />
        ) : (
          <VoteStatus
            vote={vote}
            isConnected={isConnected}
            verified={verified}
            hasVoted={hasVoted}
            myVote={myVote}
            fen={state}
            cooldown={cooldown}
          />
        )}
      </CardContent>
    </Card>
  );
}

function VoteStatus({
  vote,
  isConnected,
  verified,
  hasVoted,
  myVote,
  fen,
  cooldown,
}: {
  vote: VoteState;
  isConnected: boolean;
  verified: boolean | null;
  hasVoted: boolean;
  myVote: string | null;
  fen: string;
  cooldown: { inCooldown: boolean; msRemaining: number };
}) {
  let tone: "muted" | "amber" | "destructive" = "muted";
  let text: string;

  if (vote.kind === "error") {
    tone = "destructive";
    text = vote.message;
  } else if (vote.kind === "signing") {
    text = "Waiting for your approval in Circles…";
  } else if (hasVoted && myVote) {
    tone = "amber";
    text = `You voted ${uciToSan(fen, myVote)}, staking ${ANTE_CRC} CRC — it joins the tally once confirmed on-chain.`;
  } else if (!isConnected) {
    text = "Open this in the Circles app to vote.";
  } else if (verified === null) {
    text = "Checking your trust status…";
  } else if (verified === false) {
    text =
      "Only trust-verified avatars can vote — you need at least one trust connection on Circles.";
  } else if (cooldown.inCooldown) {
    tone = "amber";
    text = `You voted recently — next vote in ${formatCooldown(cooldown.msRemaining)}. Let someone else play first.`;
  } else {
    text = `Pick a move on the board and stake ${ANTE_CRC} CRC to vote.`;
  }

  return (
    <p
      className={cn(
        "text-center text-xs",
        tone === "destructive" && "text-destructive",
        tone === "amber" && "text-amber-700",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {text}
    </p>
  );
}

function ResultBanner({ status, pool }: { status: string; pool: number }) {
  const fired = useRef(false);
  useEffect(() => {
    if (status !== "crowd_won" || fired.current) return;
    fired.current = true;
    haptic("confirm");
    // Dynamic import — canvas-confetti touches window at runtime, and we only
    // need it on the rare crowd-win render anyway. Three small volleys feel
    // celebratory without overwhelming a phone screen.
    void import("canvas-confetti").then(({ default: confetti }) => {
      const burst = (opts?: Parameters<typeof confetti>[0]) =>
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#fbbf24", "#f59e0b", "#b45309", "#fde68a"],
          ...opts,
        });
      burst();
      setTimeout(() => burst({ angle: 60, origin: { x: 0, y: 0.7 } }), 180);
      setTimeout(() => burst({ angle: 120, origin: { x: 1, y: 0.7 } }), 360);
    });
  }, [status]);

  if (status === "crowd_won") {
    return (
      <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-center animate-in fade-in-0 zoom-in-95 duration-500">
        <p className="text-sm font-semibold text-amber-800">The crowd won 🎉</p>
        <p className="text-xs text-amber-700">
          The {pool.toLocaleString()} CRC pool is paid out to this game&apos;s
          voters.
        </p>
      </div>
    );
  }
  const text = status === "crowd_lost" ? "The bot won this one" : "It's a draw";
  return (
    <div className="space-y-1 rounded-lg border bg-muted/50 p-3 text-center animate-in fade-in-0 duration-500">
      <p className="text-sm font-medium">{text}</p>
      <p className="text-xs text-muted-foreground">
        The {pool.toLocaleString()} CRC pool rolls into the next game.
      </p>
    </div>
  );
}

/**
 * Reconstruct the most recent crowd + bot moves from the latest resolved
 * round and the game's current FEN. The bot's move is derived by FEN diff:
 * iterate the legal moves from the post-crowd position and pick the one that
 * produces the current game state. Returns null arms when there's nothing to
 * highlight (no resolved round yet, or the state diff doesn't match — e.g.
 * the game ended after the crowd's move).
 */
function reconstructLastMoves(
  lastResolved: RoundRow | null,
  currentFen: string,
): { crowd?: string; bot?: string } | undefined {
  if (!lastResolved || !lastResolved.winning_move) return undefined;
  const crowd = lastResolved.winning_move;
  try {
    const afterCrowd = chess.applyMove(lastResolved.board_before, crowd);
    if (afterCrowd === currentFen) {
      // Game ended on the crowd's move, or no bot reply yet.
      return { crowd };
    }
    for (const candidate of chess.legalMoves(afterCrowd)) {
      if (chess.applyMove(afterCrowd, candidate) === currentFen) {
        return { crowd, bot: candidate };
      }
    }
    return { crowd };
  } catch {
    return undefined;
  }
}

function moveTally(votes: VoteRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const vote of votes) {
    if (vote.move.length >= 4) {
      counts[vote.move] = (counts[vote.move] ?? 0) + 1;
    }
  }
  return counts;
}

function uciToSan(fen: string, uci: string): string {
  if (uci.length < 4) return uci;
  try {
    const game = new Chess(fen);
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? uci[4] : undefined,
    });
    return move.san;
  } catch {
    return uci;
  }
}

function GameSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No game running yet</CardTitle>
        <CardDescription>
          The first game starts as soon as the round scheduler kicks in — check
          back in a moment.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Couldn&apos;t load the game</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
