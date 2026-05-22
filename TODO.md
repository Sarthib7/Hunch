# Hunch — status & what's left

**Status (2026-05-22):** Live. Deployed to Vercel, and the full trust-gated,
staked-vote mechanic is **verified end-to-end on-chain** — a vote went
verified → staked → settled → cron-ingested → tallied. Renamed from the working
name "Quorum" to **Hunch**. A draft Garage entry is in. Cycle closes
**Sun 2026-05-24, 23:59 CET**.

## 1. Done

- ✅ v1 built — Connect Four engine + deterministic bot, round machine, board +
  live-tally UI; builds + lints clean.
- ✅ Supabase wired and verified.
- ✅ Pool funded (~0.1 xDAI) and registered as a Circles Organisation avatar.
- ✅ Trust gate fixed — verifies a voter via the pool's on-chain `isTrusted`,
  not just the indexer count (which omits Organisation trust). `docs/adr/0003`.
- ✅ Stake-vote fixed — stakes a demo group's CRC, since voters hold group CRC,
  not personal CRC. `docs/adr/0007`.
- ✅ Vote verified end-to-end on-chain. `docs/sadr/0006`.
- ✅ Deployed — `https://hunch-teleshops-projects.vercel.app`.
- ✅ Rebranded Quorum → Hunch (Vercel project, GitHub repo, code, docs).

## 2. Left before Sunday

1. **Re-submit the Garage form as Hunch** — §01 name/slug → `Hunch` / `hunch`;
   §03 repo → `github.com/Sarthib7/Hunch`, live link → the `hunch-` URL.
2. **Cron pinger** — a cron-job.org job hitting `/api/cron` every minute, so the
   game self-advances (it is pinged manually for now). `SUBMISSION.md` §3.
3. **Demo video** — judges can't self-serve a vote (curated voter set), so a
   ~90-second recording of the vote flow is the proof.
4. **Demo crowd** — 1 of ~6 voters trusted; recruit the rest.

## 3. Optional polish

- Rounds are 8h (`HUNCH_ROUND_MS` unset) — set `120000` for 2-min demo rounds
  (pair with the 1-minute cron).
- Set a `CRON_SECRET` on Vercel — `/api/cron` is currently unprotected.
- Marketplace manifest PR to `aboutcircles/CirclesMiniapps` — prepared on a fork
  branch, not opened.
- Retire the stale `quorum-teleshops-projects.vercel.app` URL (pre-rebrand build).

## 4. Known v1 limitations (acceptable)

- Win payout is **manual** — the operator sends the CRC.
- The pool is an EOA-controlled Organisation avatar — migrate to a Safe before
  it holds real value.
- Voting is a **curated voter set** — the pool must trust each voter and they
  must hold the demo stake-group's CRC; per-voter token detection is roadmap.
- The pool's on-chain name is `"Quorum Pool"` — set before the rename, immutable.

## 5. Roadmap — explicitly NOT v1 (`PRD.md` §11)

- W2 — variable stake · spectator mode · Swarm game archive · automated payout
- W3 — real engine + brilliancy analysis · chess as a swap-in game
- W4 — crowd-vs-crowd (circle-vs-circle)
- W5 — Sybil hardening · seasons & leaderboards
- A custom **on-chain settlement contract** — beyond today's auditable backend.
