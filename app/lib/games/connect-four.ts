// Connect Four engine + a deliberately weak, deterministic bot.
// 7 columns x 6 rows. A move is a column index (0-6).

import type { GameBot, GameEngine, GameResult, Player } from "./types";

export const COLS = 7;
export const ROWS = 6;

/** 0 = empty, 1 = crowd, 2 = bot. */
export type Cell = 0 | 1 | 2;

export interface C4State {
  /** board[row][col]; row 0 is the BOTTOM row. */
  board: Cell[][];
  toMove: Player;
}

/** A move is the column to drop into, 0-6. */
export type C4Move = number;

// Column scan order biased to the centre — the bot's fallback preference.
const CENTRE_ORDER: number[] = [3, 2, 4, 1, 5, 0, 6];

// Direction vectors for the 4-in-a-row scan: →, ↑, ↗, ↖.
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.slice());
}

/** Lowest empty row in `col`, or -1 if the column is full / out of range. */
function dropRow(board: Cell[][], col: number): number {
  if (col < 0 || col >= COLS) return -1;
  for (let r = 0; r < ROWS; r++) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

/** The player with a 4-in-a-row, or null. */
function winnerAt(board: Cell[][]): Player | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell === 0) continue;
      for (const [dr, dc] of DIRS) {
        let run = 1;
        while (run < 4) {
          const rr = r + dr * run;
          const cc = c + dc * run;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
          if (board[rr][cc] !== cell) break;
          run++;
        }
        if (run === 4) return cell;
      }
    }
  }
  return null;
}

function c4Result(state: C4State): GameResult {
  const winner = winnerAt(state.board);
  if (winner) return { status: "win", winner };
  const full = state.board[ROWS - 1].every((cell) => cell !== 0);
  return full ? { status: "draw" } : { status: "playing" };
}

function c4LegalMoves(state: C4State): C4Move[] {
  if (c4Result(state).status !== "playing") return [];
  const moves: C4Move[] = [];
  for (let c = 0; c < COLS; c++) {
    if (dropRow(state.board, c) !== -1) moves.push(c);
  }
  return moves;
}

function c4ApplyMove(state: C4State, col: C4Move): C4State {
  const row = dropRow(state.board, col);
  if (row === -1) {
    throw new Error(`illegal move: column ${col} is full or out of range`);
  }
  const board = cloneBoard(state.board);
  board[row][col] = state.toMove;
  return { board, toMove: state.toMove === 1 ? 2 : 1 };
}

export const connectFour: GameEngine<C4State, C4Move> = {
  id: "connect-four",
  initialState: () => ({ board: emptyBoard(), toMove: 1 }),
  legalMoves: c4LegalMoves,
  applyMove: c4ApplyMove,
  result: c4Result,
  serialize(state) {
    // 42 cells, row-major (bottom row first), then the side to move.
    let out = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) out += state.board[r][c];
    }
    return out + state.toMove;
  },
  deserialize(s) {
    if (s.length !== ROWS * COLS + 1) {
      throw new Error(`bad Connect Four serialization: length ${s.length}`);
    }
    const board = emptyBoard();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        board[r][c] = Number(s[r * COLS + c]) as Cell;
      }
    }
    return { board, toMove: Number(s[ROWS * COLS]) as Player };
  },
};

/**
 * Deliberately weak, fully deterministic bot:
 *   1. take an immediate win,
 *   2. block the opponent's immediate win,
 *   3. otherwise play the most central legal column.
 * No look-ahead beyond one ply — a coordinated crowd should beat it.
 */
export const connectFourBot: GameBot<C4State, C4Move> = {
  pickMove(state) {
    const me = state.toMove;
    const opponent: Player = me === 1 ? 2 : 1;
    const legal = c4LegalMoves(state);
    if (legal.length === 0) throw new Error("no legal moves");

    // 1. Win now.
    for (const move of legal) {
      const after = c4ApplyMove(state, move);
      if (winnerAt(after.board) === me) return move;
    }

    // 2. Block: if the opponent could win by dropping in `move`, take it.
    for (const move of legal) {
      const asOpponent: C4State = { board: state.board, toMove: opponent };
      const after = c4ApplyMove(asOpponent, move);
      if (winnerAt(after.board) === opponent) return move;
    }

    // 3. Centre preference.
    for (const col of CENTRE_ORDER) {
      if (legal.includes(col)) return col;
    }
    return legal[0];
  },
};
