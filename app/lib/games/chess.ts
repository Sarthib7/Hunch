// Chess engine + a deliberately weak, deterministic bot.
// State is a FEN string; moves are UCI strings ("e2e4", "e7e8q").
//
// White = crowd (player 1), Black = bot (player 2). Crowd moves first.

import { Chess, validateFen, type Move, type PieceSymbol } from "chess.js";

import type { GameBot, GameEngine, GameResult, Player } from "./types";

/** UCI string ("e2e4" or "e7e8q") for a chess.js Move. */
function uciOf(m: Move): string {
  return m.from + m.to + (m.promotion ?? "");
}

/** Parse a UCI string into the object form chess.js's `move()` accepts. */
function uciToObject(
  uci: string,
): { from: string; to: string; promotion?: string } | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

/** Material values for the bot's evaluation. King is priceless (mate handled separately). */
const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/** Crude centralisation score for a destination square (0 edge → 4 centre). */
function centralisation(square: string): number {
  const file = square.charCodeAt(0) - "a".charCodeAt(0); // 0..7
  const rank = Number(square[1]) - 1; // 0..7
  const distFromCentre = Math.max(
    Math.abs(file - 3.5),
    Math.abs(rank - 3.5),
  );
  return 4 - Math.floor(distFromCentre);
}

function chessResult(fen: string): GameResult {
  const game = new Chess(fen);
  if (game.isCheckmate()) {
    // The side to move is the side that has no legal moves while in check —
    // i.e. the loser. Map chess colours to the engine's 1/2 Player ids.
    const loser: Player = game.turn() === "w" ? 1 : 2;
    return { status: "win", winner: loser === 1 ? 2 : 1 };
  }
  if (game.isGameOver()) return { status: "draw" };
  return { status: "playing" };
}

function chessLegalMoves(fen: string): string[] {
  const game = new Chess(fen);
  return game.moves({ verbose: true }).map(uciOf);
}

function chessApplyMove(fen: string, uci: string): string {
  const obj = uciToObject(uci);
  if (!obj) throw new Error(`illegal move: ${uci}`);
  const game = new Chess(fen);
  try {
    game.move(obj);
  } catch {
    throw new Error(`illegal move: ${uci}`);
  }
  return game.fen();
}

export const chess: GameEngine<string, string> = {
  id: "chess",
  initialState: () => new Chess().fen(),
  legalMoves: chessLegalMoves,
  applyMove: chessApplyMove,
  result: chessResult,
  serialize: (state) => state,
  deserialize(s) {
    if (!validateFen(s).ok) throw new Error(`invalid FEN: ${s}`);
    return s;
  },
};

/**
 * Score a move from the side-to-move's perspective. Higher = preferred.
 * Mate is treated as +∞; the caller checks for it first so the priority order
 * is unambiguous: mate > capture > promotion > check > centralisation.
 */
function scoreMove(fen: string, m: Move): number {
  const captureValue = m.captured ? PIECE_VALUE[m.captured] : 0;
  const promotionGain = m.promotion ? PIECE_VALUE[m.promotion] - 1 : 0;
  const probe = new Chess(fen);
  probe.move({ from: m.from, to: m.to, promotion: m.promotion });
  const checkBonus = probe.inCheck() ? 1 : 0;
  return (
    captureValue * 100 +
    promotionGain * 50 +
    checkBonus * 10 +
    centralisation(m.to)
  );
}

/**
 * Deliberately weak, fully deterministic bot:
 *   1. take an immediate mate,
 *   2. otherwise pick the move with the highest static score
 *      (capture > promote > check > centralise),
 *   3. break ties alphabetically by UCI.
 *
 * Intentionally has no opponent-threat awareness — a coordinated crowd that
 * plans even one move ahead should be able to beat it.
 */
export const chessBot: GameBot<string, string> = {
  pickMove(fen) {
    const game = new Chess(fen);
    const legal = game.moves({ verbose: true });
    if (legal.length === 0) throw new Error("no legal moves");

    // 1. Mate now — among any mating moves, pick the alphabetically first.
    const mating: Move[] = [];
    for (const m of legal) {
      const probe = new Chess(fen);
      probe.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (probe.isCheckmate()) mating.push(m);
    }
    if (mating.length > 0) {
      return mating.map(uciOf).sort()[0];
    }

    // 2. Otherwise pick by static score, ties broken alphabetically.
    let bestScore = -Infinity;
    let bestUci = "";
    for (const m of legal) {
      const score = scoreMove(fen, m);
      const uci = uciOf(m);
      if (score > bestScore || (score === bestScore && uci < bestUci)) {
        bestScore = score;
        bestUci = uci;
      }
    }
    return bestUci;
  },
};
