# Quorum — what's left to do

**Status (2026-05-22):** v1 build complete — builds + lints clean. Supabase fully
wired and verified; vote ingestion verified against the live indexer and fixed
(§3). Pool funded + registered on-chain and voter #1 trusted — audit trail in
`docs/sadr/`. **Not deployed. Not tested end-to-end.** What's left for a Garage
submission is below.

**Who does what:** §1–2 are your accounts/setup; §3 you run and I fix.

## 1. Blockers (you)

1. ~~Real service-role key~~ — **done.** Both Supabase keys verified; the
   service-role key authenticates and bypasses RLS, so the backend can write.
2. ~~Register the pool.~~ — **done (2026-05-22).** Pool funded with ~0.1 xDAI
   and registered as the "Quorum Pool" Organisation avatar
   (`0xFf515429c88cc545B8D6A7965171D87FaCA3904A`). Evidence:
   `docs/sadr/0003-pool-funded-for-gas.md`,
   `docs/sadr/0004-pool-registered-organisation.md`.
3. **Demo crowd** — ~5 trust-verified Circles avatars + 1 zero-trust. **1 of ~6
   done** — voter #1 trusted (`docs/sadr/0005-voter-1-verified-trusted.md`).
   Collect the rest; the pool trusts each via `scripts/trust-voters.mjs` (one
   action — it both lets stakes settle and satisfies the Sybil gate).

_Restart the dev server after any `.env.local` change — Next reads it only at startup._

## 2. Deploy — task 9 (you) — step-by-step in `SUBMISSION.md`

- [ ] Deploy `app/` to Vercel; set every env var there.
- [ ] Schedule a pinger on `/api/cron` (~every minute — the game only advances when pinged).
- [ ] PR the manifest entry to `aboutcircles/CirclesMiniapps`.
- [ ] Register the app at `garage.aboutcircles.com/register`.

## 3. Test + fix (you run it, I fix) — the "it builds → it works" gap

**Vote ingestion (`lib/round/votes.ts`) — verified + fixed (2026-05-21).** Probed
against the live Circles indexer; two bugs that would have failed *every* vote
are now fixed: the metadata `data` field comes back `\x`-encoded (normalised to
`0x` before decoding), and the stake amount lives on a separate
`CrcV2_TransferSingle` event (now correlated by transaction). Token-id derivation
and the encode/decode round-trip are confirmed correct.

- [ ] Run the end-to-end test in the Circles playground (`SUBMISSION.md` §6):
      cron creates a game → a verified avatar votes → the vote lands in the tally
      → the round resolves → the bot replies.
- [ ] **One assumption still needs a live run:** that a direct `safeTransferFrom`
      voter→pool settles (`vote.ts` assumption 2 — the pool must trust the voter).
      If a vote sends but never registers, send me the `/api/cron` output.
- [ ] **On me:** fix whatever the first real run surfaces.

## 4. Known minor gaps (acceptable for v1)

- Dev hydration warning — the `<html>` font class differs server vs client (Geist
  CSS-module). Cosmetic; confirm it doesn't appear in the production build.
- Win payout is **manual** — the UI shows the pool; the operator sends the CRC.
- The pool is an EOA-controlled Organisation avatar — fine for the v1 demo;
  migrate it to a Safe before it holds anything beyond hackathon stakes.
- "Quorum" is still a working name (`PROJECT.md` has candidates).

## 5. Roadmap — explicitly NOT v1 (`PRD.md` §11)

- W2 — variable stake · spectator mode · Swarm game archive · automated payout
- W3 — real engine + brilliancy analysis · chess as a swap-in game
- W4 — crowd-vs-crowd (circle-vs-circle)
- W5 — Sybil hardening · seasons & leaderboards
- A custom **on-chain settlement contract** — the deeper-decentralization step
  beyond today's auditable backend coordinator. (There is no contract in v1.)
