"use client";

import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { useMemo, useState } from "react";

import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

// Filled Unicode chess glyphs — rendered the same shape regardless of side,
// recoloured via text-* classes so the two sides read at a glance.
const GLYPH: Record<PieceSymbol, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

export interface ChessBoardProps {
  /** Current position as a FEN string. */
  fen: string;
  /** Legal UCI moves the crowd may currently vote on; empty if no round open. */
  legalMoves: string[];
  /** UCI → vote count tally for the current round. Omit when no round open. */
  votes?: Record<string, number>;
  /** The UCI move the current user has voted for this round, if any. */
  myVote?: string | null;
  /**
   * Previous ply pair to highlight as "the move just played" — crowd's
   * winning_move and the bot's reply derived from the FEN diff. Up to four
   * squares get a steady amber wash so users can see what changed.
   */
  lastMoves?: { crowd?: string; bot?: string };
  /** Cast a vote for a UCI move. Omit to render the board read-only. */
  onVote?: (uci: string) => void;
  /** Voting is not currently possible — round closed, not the crowd's turn, etc. */
  disabled?: boolean;
}

/**
 * Vote-mode chess board. Click a piece to select, then click a destination to
 * vote. Pawn promotions auto-queen for v1 — underpromotion is roadmap.
 * Presentational — the parent owns loading / empty / error states.
 */
export function ChessBoard({
  fen,
  legalMoves,
  votes,
  myVote,
  lastMoves,
  onVote,
  disabled,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);

  const board = useMemo(() => new Chess(fen).board(), [fen]);
  const turn = useMemo(() => new Chess(fen).turn(), [fen]);

  // Map from-square → set of legal target squares, derived from UCI list.
  const movesByFrom = useMemo(() => {
    const map = new Map<Square, Map<Square, string>>();
    for (const uci of legalMoves) {
      if (uci.length < 4) continue;
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      // Stored UCI (with any promotion suffix) — what we'd vote with.
      const existing = map.get(from) ?? new Map<Square, string>();
      if (!existing.has(to)) existing.set(to, uci);
      map.set(from, existing);
    }
    return map;
  }, [legalMoves]);

  const targets = selected ? movesByFrom.get(selected) : undefined;

  // Per-square vote intensity, summed over voted moves whose to-square == sq.
  const voteHeat = useMemo(() => {
    const counts = new Map<Square, number>();
    if (!votes) return counts;
    for (const [uci, count] of Object.entries(votes)) {
      if (uci.length < 4 || count <= 0) continue;
      const to = uci.slice(2, 4) as Square;
      counts.set(to, (counts.get(to) ?? 0) + count);
    }
    return counts;
  }, [votes]);
  const maxHeat = Math.max(0, ...voteHeat.values());

  const myFrom = myVote && myVote.length >= 4 ? (myVote.slice(0, 2) as Square) : null;
  const myTo = myVote && myVote.length >= 4 ? (myVote.slice(2, 4) as Square) : null;

  // Squares involved in the most recently played move pair (crowd + bot).
  // Rendered with a steady amber wash so the player can immediately see what
  // changed when Realtime pushes a new position.
  const lastMoveSquares = useMemo(() => {
    const set = new Set<Square>();
    for (const uci of [lastMoves?.crowd, lastMoves?.bot]) {
      if (uci && uci.length >= 4) {
        set.add(uci.slice(0, 2) as Square);
        set.add(uci.slice(2, 4) as Square);
      }
    }
    return set;
  }, [lastMoves?.crowd, lastMoves?.bot]);

  function handleSquareClick(sq: Square) {
    if (!onVote || disabled) return;
    if (selected && targets?.has(sq)) {
      haptic("confirm");
      onVote(targets.get(sq)!);
      setSelected(null);
      return;
    }
    if (movesByFrom.has(sq)) {
      haptic("tap");
      setSelected((prev) => (prev === sq ? null : sq));
      return;
    }
    setSelected(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {/* Rank labels on the left, aligned to the board cells. */}
        <div className="flex flex-col justify-around py-0.5 text-[10px] font-mono text-muted-foreground">
          {RANKS.map((r) => (
            <span key={r} className="flex h-8 items-center sm:h-10">
              {r}
            </span>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-8 overflow-hidden rounded-lg border border-border">
          {board.flatMap((row, rIdx) =>
            row.map((piece, fIdx) => {
              const sq = (FILES[fIdx] + RANKS[rIdx]) as Square;
              const isLight = (rIdx + fIdx) % 2 === 0;
              const isSelectable = !!onVote && !disabled && movesByFrom.has(sq);
              const isSelected = selected === sq;
              const isTarget = targets?.has(sq) ?? false;
              const heat = voteHeat.get(sq) ?? 0;
              const heatRatio = maxHeat > 0 ? heat / maxHeat : 0;
              const isMyFrom = myFrom === sq;
              const isMyTo = myTo === sq;
              const isLastMove = lastMoveSquares.has(sq);

              return (
                <Cell
                  key={sq}
                  square={sq}
                  piece={piece}
                  isLight={isLight}
                  isSelectable={isSelectable}
                  isSelected={isSelected}
                  isTarget={isTarget}
                  heat={heat}
                  heatRatio={heatRatio}
                  isMyFrom={isMyFrom}
                  isMyTo={isMyTo}
                  isLastMove={isLastMove}
                  showVotes={votes !== undefined}
                  onClick={() => handleSquareClick(sq)}
                />
              );
            }),
          )}
        </div>
      </div>

      {/* File labels along the bottom. */}
      <div className="grid grid-cols-8 pl-[14px] text-center text-[10px] font-mono text-muted-foreground">
        {FILES.map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>

      {votes !== undefined && (
        <CandidateList
          fen={fen}
          votes={votes}
          myVote={myVote ?? null}
          turn={turn}
        />
      )}

      {onVote && !disabled && (
        <HintLine
          selected={selected}
          myVote={myVote ?? null}
          fen={fen}
        />
      )}
    </div>
  );
}

interface CellProps {
  square: Square;
  piece: { color: Color; type: PieceSymbol; square: Square } | null;
  isLight: boolean;
  isSelectable: boolean;
  isSelected: boolean;
  isTarget: boolean;
  heat: number;
  heatRatio: number;
  isMyFrom: boolean;
  isMyTo: boolean;
  isLastMove: boolean;
  showVotes: boolean;
  onClick: () => void;
}

function Cell({
  square,
  piece,
  isLight,
  isSelectable,
  isSelected,
  isTarget,
  heat,
  heatRatio,
  isMyFrom,
  isMyTo,
  isLastMove,
  showVotes,
  onClick,
}: CellProps) {
  const interactive = isSelectable || isTarget;
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      aria-label={
        piece
          ? `${square}: ${piece.color === "w" ? "white" : "black"} ${piece.type}`
          : square
      }
      className={cn(
        "relative flex aspect-square items-center justify-center text-2xl transition-colors duration-300 sm:text-3xl",
        // Square colour. Light squares slightly warmer than the page background
        // so the board reads as a distinct surface.
        isLight ? "bg-stone-50" : "bg-stone-200",
        // Last-played move — steady amber wash on the from/to of the previous
        // crowd + bot moves. Tells the user at a glance what just changed.
        isLastMove && "bg-amber-200/70",
        // Vote heat — subtle amber wash, proportional to the leading move.
        // Wins over last-move highlight on the same square (more relevant now).
        showVotes && heat > 0 && "bg-amber-100/60",
        showVotes && heat > 0 && heatRatio === 1 && "bg-amber-200/80",
        // Selection + targets.
        isSelected && "ring-2 ring-inset ring-amber-500",
        isTarget && "ring-2 ring-inset ring-amber-400/70",
        // Your-vote highlight — same amber identity as Connect Four "your vote".
        isMyFrom && "ring-2 ring-inset ring-amber-500",
        isMyTo && "ring-2 ring-inset ring-amber-500",
        // Interactivity.
        interactive
          ? "cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          : "cursor-default",
      )}
    >
      {piece && (
        <span
          aria-hidden
          className={cn(
            "select-none leading-none",
            piece.color === "w" ? "text-amber-600" : "text-zinc-800",
          )}
          // The Unicode chess glyphs are filled — a subtle stroke separates a
          // white piece's amber fill from the amber heat overlay.
          style={
            piece.color === "w"
              ? { textShadow: "0 0 1px rgba(0,0,0,0.35)" }
              : undefined
          }
        >
          {GLYPH[piece.type]}
        </span>
      )}
      {showVotes && heat > 0 && !piece && (
        <span className="absolute right-0.5 top-0.5 rounded-full bg-amber-500/90 px-1 text-[9px] font-semibold tabular-nums text-white">
          {heat}
        </span>
      )}
      {showVotes && heat > 0 && piece && (
        <span className="absolute right-0.5 top-0.5 rounded-full bg-amber-500/90 px-1 text-[9px] font-semibold tabular-nums text-white">
          {heat}
        </span>
      )}
    </Tag>
  );
}

function CandidateList({
  fen,
  votes,
  myVote,
  turn,
}: {
  fen: string;
  votes: Record<string, number>;
  myVote: string | null;
  turn: Color;
}) {
  const ranked = useMemo(() => {
    const entries = Object.entries(votes)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6);
    return entries.map(([uci, count]) => ({
      uci,
      count,
      san: uciToSan(fen, uci),
    }));
  }, [fen, votes]);

  if (ranked.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        No votes yet — be the first to suggest a move for {turn === "w" ? "white" : "black"}.
      </p>
    );
  }

  const leading = ranked[0].count;
  return (
    <ul className="space-y-1">
      {ranked.map(({ uci, count, san }) => {
        const isLeading = count === leading;
        const isMine = uci === myVote;
        return (
          <li
            key={uci}
            className={cn(
              "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs",
              isMine
                ? "border-amber-400 bg-amber-50"
                : "border-border bg-card",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("font-medium", isLeading && "text-amber-700")}>
                {san}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {uci}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {isMine && (
                <span className="text-[10px] font-medium text-amber-600">
                  your vote
                </span>
              )}
              <span
                className={cn(
                  "font-mono tabular-nums",
                  isLeading ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {count}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function HintLine({
  selected,
  myVote,
  fen,
}: {
  selected: Square | null;
  myVote: string | null;
  fen: string;
}) {
  if (myVote) {
    return (
      <p className="text-center text-xs text-amber-700">
        You voted {uciToSan(fen, myVote)} — it joins the tally once confirmed on-chain.
      </p>
    );
  }
  if (selected) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Now tap a destination square to stake your vote.
      </p>
    );
  }
  return (
    <p className="text-center text-xs text-muted-foreground">
      Tap one of your pieces to start choosing a move.
    </p>
  );
}

/** Best-effort UCI → SAN conversion for display. Falls back to the UCI string. */
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
