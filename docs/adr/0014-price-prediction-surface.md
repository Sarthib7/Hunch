# ADR-0014: Price-prediction surface — 1-minute BTC/ETH markets, soft-pari-mutuel

- **Status:** Accepted
- **Date:** 2026-05-25

## Context

ADR-0013 establishes that Hunch ships multiple **prediction surfaces**, each
owning its own schema and UI but reusing code-level primitives (trust gate,
stake-transfer encoding, payout pattern). The W2 cycle ships the second
surface after chess: **price markets**.

The goal is the gamified-real-time-dynamic-mobile-first direction set on
2026-05-25 — predictors see a constantly refreshing slate of 1-minute
markets, tap UP or DOWN, watch the result land in seconds. Closer to a
satisfying continuous loop (Wordle / slot machine pacing) than to a
deliberate forecasting tool (Polymarket / Manifold).

This ADR locks the surface's mechanics. Implementation details (file
layout, Pyth consumer specifics, Realtime channel naming) live in code.

## Decision

### Markets

A **market** is one 1-minute prediction window on one asset. At every
minute boundary, a cron opens:
- one BTC/USD market (`opens_at = T`, `closes_at = T + 60s`)
- one ETH/USD market (same window)

No on-demand market creation in W2 — the cron is the only source.
On-demand (predictor-created) markets in custom spaces is deferred to
W4+ alongside the spaces work.

### Predictions

A trust-verified Circles avatar stakes **1 CRC** on `UP` or `DOWN`. The
stake is an on-chain `safeTransferFrom` to the public pool, carrying
`hunch.market.<marketId>.<UP|DOWN>` in the CRC v2 transfer metadata. The
stake IS the prediction; there's no separate "vote" step.

A predictor may stake on any open market, including both sides of two
parallel markets if they want — there's **no per-voter cooldown** on
markets (the cooldown exists on chess to force rotation under
first-vote-wins; markets don't need it because every staker contributes
to the pool independently).

### Resolution

At `closes_at`, the backend samples Pyth Hermes for the asset's price
(MVP — Pyth-on-chain attestation deferred to W3 per ADR-0011 follow-up).
Compare `close_price` to `open_price`:

- `close > open` → **UP wins**
- `close < open` → **DOWN wins**
- `close == open` → **VOID**

### Soft-pari-mutuel payout

Losers forfeit a **penalty %** of their stake; that pool is split as a
bonus among winners. Winners keep their stake AND get a bonus.

Penalty % is **TBD pending parallel research** (target: by Day 1 of W2).
Candidates under consideration: 25%, 30%, 50%. Default placeholder for
implementation: **30%** — soft enough that a 50%-accuracy user's CRC burn
stays acceptable over 50+ markets/day, harsh enough that conviction
matters.

Math at 30% penalty, balanced 10 UP / 5 DOWN, UP wins:
- UP winners (×10): get 1 CRC + (5 × 0.3 ÷ 10) = **1.15 CRC each**
- DOWN losers (×5): get **0.7 CRC each** (forfeit 0.3)
- Total in: 15 CRC = Total out: 15 CRC. Self-funded.

Edge cases — both refund all stakes (1 CRC back to every predictor):
- **Tie** (`close_price == open_price`) → VOID
- **One-sided** (no UP stakers OR no DOWN stakers) → VOID

### Schema (Supabase migration `add_markets_v1`)

Three new tables. No changes to existing chess tables.

```
markets (
  id              uuid PK,
  asset           text       -- 'BTC' | 'ETH'
  opens_at        timestamptz,
  closes_at       timestamptz,
  open_price      numeric    -- captured at opens_at
  close_price     numeric    -- nullable until resolved
  winning_side    text       -- 'UP' | 'DOWN' | 'VOID' | null
  status          text       -- 'open' | 'resolved' | 'voided'
  pool_up_crc     numeric    -- gross UP stakes (incl. losers)
  pool_down_crc   numeric    -- gross DOWN stakes
  created_at      timestamptz
)

market_stakes (
  id              uuid PK,
  market_id       uuid FK markets,
  predictor       text       -- voter address
  side            text       -- 'UP' | 'DOWN'
  amount_crc      numeric    -- defaults to 1, validated
  tx_hash         text       -- on-chain stake transfer hash
  indexed_at      timestamptz
  unique(market_id, predictor)  -- one stake per market per predictor
)

market_payouts (
  market_id       uuid FK markets,
  predictor       text,
  amount_crc      numeric,   -- gross payout (stake refund + bonus, or just refund on void)
  tx_hash         text nullable,
  status          text,      -- 'pending' | 'sent' | 'failed'
  attempted_at    timestamptz nullable,
  created_at      timestamptz,
  primary key (market_id, predictor)
)
```

`pool_up_crc` and `pool_down_crc` get auto-bumped by an AFTER INSERT
trigger on `market_stakes` (mirrors the v1.2 audit fix on chess `votes`).

### Price feed — Pyth Hermes

A Vercel cron job (or a long-running consumer if we set one up; cron is
fine for MVP) samples Pyth Hermes's BTC/USD and ETH/USD feeds:

- **Live ticker** for the UI: server publishes prices to a Supabase
  Realtime channel `price:BTC` / `price:ETH` every ~1s. Clients
  subscribe; no per-client Hermes connection (saves cost + complexity).
- **`open_price`** sampled at market `opens_at` (cron opens the market and
  records the price atomically).
- **`close_price`** sampled at `closes_at` (cron resolves the market).
- All samples also write to a `price_observations (asset, ts, price)`
  audit table — provides a backstop if Pyth disagrees with us later.

### UI shape

Mobile-first, single-column. Sticky bottom action bar with two big
buttons: **UP** (green) / **DOWN** (red). Live ticker as a large number
at the top, mini sparkline of the last 60s. Circular countdown ring,
pulses red in the last 5s. Stake counts (UP / DOWN) update via Realtime
as predictions land. Haptic on stake + on settle. Confetti on win.

## Consequences

- **The product reframes around live action.** Today a user opens Hunch
  and sees one chess game waiting on the crowd. After W2, they see one
  chess game AND two markets closing in <60s. The dopamine loop is
  per-minute, not per-game.
- **`POOL_PAYOUT_KEY` carries more load.** Today it signs payouts when a
  chess game settles (rare — once per game lasting days). After W2 it
  signs payouts every minute for every settled market. Volume is still
  trivial (one tx per resolved market per asset = 2/min worst case) but
  the operational dependency on the single key tightens. ADR-0011's W5
  Safe-payout-module migration becomes more pressing.
- **No `voter` cooldown, no per-market participation limit.** Predictors
  can stake on every market every minute. With 2 markets/min that's
  potentially 2,880 staking txs/day per power user — but each is one
  cheap Gnosis Chain tx. Acceptable.
- **No house cut at MVP.** Every CRC in is a CRC out. Adding a fee
  later is a single multiplier in the resolution code.
- **Tie + one-sided handling is `VOID = refund all`.** Simple and fair.
  Variance: at 1-min horizons BTC ties are rare but possible (sub-cent
  movements). One-sided is rare at the projected volume but possible
  in cold-start.
- **Indexer-lag tolerance is the same as chess.** Markets ingest stakes
  via `/api/markets/stake` (instant client POST after the host signs)
  AND a cron safety net — same dual path as chess `/api/vote` +
  `/api/cron`. ~10s end-to-end is fine for a 60s market.

## Open questions

- **Final penalty %.** Pending parallel research (see TODO/PROJECT).
  Default 30% is the placeholder for code work; the real number gets
  patched in before W2 ships. If research lands on 25 or 50, swap.
- **What if Pyth Hermes is degraded at `closes_at`?** Backend retries
  for up to 5s past the deadline; if still no price, market goes to
  VOID with refund-all. Better than guessing.
- **Per-asset market frequency.** Both BTC and ETH every minute is the
  MVP. If one asset is dead-quiet (few stakers), do we throttle? Defer
  to post-W2 data; ship every-minute for both first.
- **Predictor accuracy / streak tracking.** Persisted? Computed live
  from `market_stakes` history? Defer to W3 polish — the database has
  the raw data either way.
