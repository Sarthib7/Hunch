// Hunch v1 game parameters.

/** Flat ante per vote, in CRC. */
export const ANTE_CRC = 1;

/**
 * How long a voting round stays open, in milliseconds.
 * Production default: 8 hours. Set HUNCH_ROUND_MS to override
 * (e.g. 120000 for a 2-minute demo round).
 */
export const ROUND_DURATION_MS =
  Number(process.env.HUNCH_ROUND_MS) || 8 * 60 * 60 * 1000;

/**
 * Per-voter cooldown — how long an avatar must wait after a recorded vote
 * before another vote of theirs is accepted. Keeps any one voter from
 * dominating the game under first-vote-wins resolution, forcing crowd
 * rotation. Default: 1 hour. Set HUNCH_VOTER_COOLDOWN_MS to override
 * (e.g. 60000 for a 1-minute demo, or 0 to disable).
 */
export const VOTER_COOLDOWN_MS =
  process.env.HUNCH_VOTER_COOLDOWN_MS !== undefined
    ? Number(process.env.HUNCH_VOTER_COOLDOWN_MS)
    : 60 * 60 * 1000;
