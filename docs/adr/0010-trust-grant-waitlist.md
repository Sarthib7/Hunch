# ADR-0010: Trust-grant waitlist for non-verified visitors

- **Status:** Accepted
- **Date:** 2026-05-23

## Context

Hunch's Sybil gate (ADR-0003) requires every voter to be either trusted by
the pool on-chain or to have ≥ 1 community-trust edge. The demo crowd is
~5 hand-trusted avatars. When a visitor lands on Hunch from outside that
set — via the marketplace tile, a shared link, the playground URL — they
hit the verified-false branch and the UI used to dead-end with "only
trust-verified avatars can vote — get trusted on Circles."

The dead-end loses the visitor's interest and gives the operator no signal
of who wanted to play but couldn't.

## Decision

v1.2 adds an **in-app waitlist**:

1. **Schema:** `waitlist (address PK, created_at, trusted bool)`. RLS
   allows public read (so the UI can render "you're on the list" state)
   and rejects anon writes — all inserts go through the service role.
2. **Endpoint:** `POST /api/waitlist {address}` validates the 0x-hex
   format, lowercases, upserts. Returns `{ok, alreadyOnList}`. No auth —
   worst case is random address spam, which the operator filters by hand
   anyway.
3. **UI:** in the verified-false branch, a `WaitlistPrompt` component
   shows an "Add me to the waitlist" CTA. Once on the list, the message
   flips to "You're on the waitlist — we'll trust you in time for the
   next round." Live via `useWaitlist` + a per-address Realtime
   subscription.
4. **Operator workflow:**
   `select address from waitlist where not trusted order by created_at;`
   in the dashboard, then `node scripts/trust-voters.mjs 0xVoter1 …` to
   grant on-chain trust. Once trusted, `useTrust` flips `verified=true`
   and the WaitlistPrompt stops rendering — no manual UI handoff needed.

## Consequences

- Capture of every interested visitor's wallet, with a timestamp — a
  growth signal Hunch didn't have before.
- A genuine onboarding loop into the Circles trust graph: visitor lands
  on Hunch → wants to vote → joins waitlist → operator trusts them →
  they hold a trust edge they didn't have before, which is itself a
  data point worth something to Circles.
- The waitlist table is append-only at the user-facing layer; the
  operator can `UPDATE waitlist SET trusted = true WHERE address = …`
  to mark entries as processed. (No code currently flips this flag —
  that's a follow-up polish for the trust-voters script.)
- Pre-migration, the endpoint 500s and the hook defaults to "off-list"
  so the UI still renders the button (the click then surfaces the real
  error). This made the rollout order — code first, then migration —
  safe in either ordering.
- The `error.message` from a Supabase failure is masked to the client
  (audit fix #4); the real message goes to the server console.

## Open questions

- **Should the operator be auto-notified of new waitlist entries?**
  Currently they have to query the table. A simple Slack webhook on
  insert would close that loop — deferred to W2.
- **Should the waitlist enforce a real Circles registration check** (the
  address actually has an avatar) before accepting? Currently any
  well-formed address can join. Cheap to add via `getProfileView` server
  side — deferred unless spam becomes a problem.
