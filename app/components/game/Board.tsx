"use client";

import { COLS, ROWS, type C4State, type Cell } from "@/lib/games/connect-four";
import { cn } from "@/lib/utils";

export interface BoardProps {
  /** Current board position. */
  state: C4State;
  /** Columns that can still be voted on (engine `legalMoves`). */
  legalMoves: number[];
  /** Live vote count per column (index 0..6). Omit when no round is open. */
  votes?: number[];
  /** The column the current user has voted for this round, if any. */
  myVote?: number | null;
  /** Cast a vote for a column. Omit to render the board read-only. */
  onVote?: (col: number) => void;
  /** Voting is not currently possible — round closed, not the crowd's turn, etc. */
  disabled?: boolean;
}

/**
 * The Connect Four board in "vote mode": each column is a ballot the crowd
 * votes on. Presentational — the parent owns loading / empty / error states.
 */
export function Board({
  state,
  legalMoves,
  votes,
  myVote,
  onVote,
  disabled,
}: BoardProps) {
  const leading = votes && votes.length > 0 ? Math.max(...votes) : 0;

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {Array.from({ length: COLS }, (_, col) => {
        const count = votes?.[col] ?? 0;
        return (
          <Column
            key={col}
            col={col}
            cells={columnCells(state, col)}
            count={count}
            showVotes={votes !== undefined}
            leading={votes !== undefined && count > 0 && count === leading}
            canVote={!!onVote && !disabled && legalMoves.includes(col)}
            isMine={myVote === col}
            onVote={onVote}
          />
        );
      })}
    </div>
  );
}

interface ColumnProps {
  col: number;
  cells: Cell[];
  count: number;
  showVotes: boolean;
  leading: boolean;
  canVote: boolean;
  isMine: boolean;
  onVote?: (col: number) => void;
}

function Column({
  col,
  cells,
  count,
  showVotes,
  leading,
  canVote,
  isMine,
  onVote,
}: ColumnProps) {
  const body = (
    <>
      {showVotes && (
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            leading ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
      <div className="flex w-full flex-col gap-1">
        {cells.map((cell, i) => (
          <Disc key={i} cell={cell} />
        ))}
      </div>
      {/* Reserve the row so every column keeps the same height. */}
      <span
        className={cn(
          "text-[10px] font-medium text-amber-600",
          isMine ? "visible" : "invisible",
        )}
      >
        your vote
      </span>
    </>
  );

  const frame = cn(
    "flex flex-col items-center gap-1.5 rounded-xl border p-1.5",
    isMine ? "border-amber-400 bg-amber-50" : "border-border",
  );

  if (!onVote) {
    return <div className={frame}>{body}</div>;
  }

  return (
    <button
      type="button"
      disabled={!canVote}
      onClick={() => onVote(col)}
      aria-label={
        `Vote for column ${col + 1}` +
        (showVotes ? `, ${count} vote${count === 1 ? "" : "s"} so far` : "")
      }
      className={cn(
        frame,
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        canVote
          ? "cursor-pointer hover:border-foreground/30 hover:bg-muted"
          : "cursor-not-allowed opacity-60",
      )}
    >
      {body}
    </button>
  );
}

function Disc({ cell }: { cell: Cell }) {
  return (
    <span
      aria-hidden
      className={cn(
        "aspect-square w-full rounded-full",
        // Game-piece identity colours — intentionally outside the neutral token
        // set so the two sides read at a glance, including by luminance.
        cell === 0 && "bg-muted ring-1 ring-inset ring-border",
        cell === 1 && "bg-amber-400",
        cell === 2 && "bg-zinc-800",
      )}
    />
  );
}

/** A column's cells, ordered top (row 5) to bottom (row 0) for rendering. */
function columnCells(state: C4State, col: number): Cell[] {
  const out: Cell[] = [];
  for (let row = ROWS - 1; row >= 0; row--) out.push(state.board[row][col]);
  return out;
}
