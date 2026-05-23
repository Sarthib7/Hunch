// Pluggable turn-based game interface. The crowd / voting / staking layer is
// typed against GameEngine and never imports a concrete game — so Connect Four
// (v1) can be swapped for chess later without touching anything else.

/** 1 = the crowd's side, 2 = the bot's side. The crowd (player 1) moves first. */
export type Player = 1 | 2;

export type GameResult =
  | { status: "playing" }
  | { status: "win"; winner: Player }
  | { status: "draw" };

/**
 * A pure, deterministic game engine for state type `S` and move type `M`.
 * Determinism is load-bearing: it lets a whole game be replayed and verified
 * from the on-chain vote history (see PRD.md §10).
 */
export interface GameEngine<S, M> {
  /** Stable identifier, e.g. "chess". */
  readonly id: string;
  /** Starting position. The crowd (player 1) moves first. */
  initialState(): S;
  /** Legal moves in this position; empty once the game is over. */
  legalMoves(state: S): M[];
  /** Apply a move, returning a new state. Throws on an illegal move. */
  applyMove(state: S, move: M): S;
  /** Win / draw / still-playing. */
  result(state: S): GameResult;
  /** Compact string form, for DB storage and on-chain metadata. */
  serialize(state: S): string;
  /** Inverse of `serialize`. Throws on malformed input. */
  deserialize(s: string): S;
}

/** A deterministic opponent for `GameEngine<S, M>`. */
export interface GameBot<S, M> {
  pickMove(state: S): M;
}

/** True once the game has a result. */
export function isTerminal<S, M>(engine: GameEngine<S, M>, state: S): boolean {
  return engine.result(state).status !== "playing";
}
