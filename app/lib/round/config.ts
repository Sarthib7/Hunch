// Quorum v1 game parameters.

/** Flat ante per vote, in CRC. */
export const ANTE_CRC = 1;

/**
 * How long a voting round stays open, in milliseconds.
 * Production default: 8 hours. Set QUORUM_ROUND_MS to override
 * (e.g. 120000 for a 2-minute demo round).
 */
export const ROUND_DURATION_MS =
  Number(process.env.QUORUM_ROUND_MS) || 8 * 60 * 60 * 1000;
