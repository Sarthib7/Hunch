"use client";

import { Chess } from "chess.js";
import { useState } from "react";

import { ChessBoard } from "@/components/game/ChessBoard";
import { Countdown } from "@/components/game/Countdown";
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
import { useWallet } from "@/hooks/use-wallet";
import { buildStakeVoteTx } from "@/lib/circles/vote";
import { chess } from "@/lib/games/chess";
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
        <LiveGameView game={live.game} round={live.round} votes={live.votes} />
      )}
    </div>
  );
}

function LiveGameView({
  game,
  round,
  votes,
}: {
  game: GameRow;
  round: RoundRow | null;
  votes: VoteRow[];
}) {
  const { address, isConnected } = useWallet();
  const verified = useTrust(isConnected ? address : null);
  const [vote, setVote] = useState<VoteState>({ kind: "idle" });

  const state = chess.deserialize(game.state);
  const legalMoves = chess.legalMoves(state);
  const ended = game.status !== "active";

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
    vote.kind !== "signing";

  async function handleVote(uci: string) {
    if (!round || !address) return;
    setVote({ kind: "signing" });
    try {
      const tx = buildStakeVoteTx(address, round.id, uci);
      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      await sendTransactions([tx]);
      setVote({ kind: "submitted", uci });
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
            <>
              The crowd&apos;s move · closes in{" "}
              <Countdown deadline={round.deadline} />
            </>
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
}: {
  vote: VoteState;
  isConnected: boolean;
  verified: boolean | null;
  hasVoted: boolean;
  myVote: string | null;
  fen: string;
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
  if (status === "crowd_won") {
    return (
      <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-center">
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
    <div className="space-y-1 rounded-lg border bg-muted/50 p-3 text-center">
      <p className="text-sm font-medium">{text}</p>
      <p className="text-xs text-muted-foreground">
        The {pool.toLocaleString()} CRC pool rolls into the next game.
      </p>
    </div>
  );
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
