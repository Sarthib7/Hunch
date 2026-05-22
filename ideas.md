# Circles mini-app ideas

Last updated: 2026-05-19. Targeting the Garage cycle ending **Friday 2026-05-22**.

> **Superseded — 2026-05-20.** This file is the original brainstorm. The project landed on **Hunch** — a trust-gated crowd-staked Connect Four mini-app. Canonical source of truth is now `PRD.md` and `PROJECT.md`.

## What we're optimizing for

- Buildable in 3–4 days
- A Circles primitive (trust graph, group currency, pathfinder, personal CRC) must be **load-bearing**, not bolted on
- Retention matters: judging measures weekly unique opens via Mixpanel inside the host
- Embedded (iframe) is preferred over standalone (QR) — the host counts activity, only embedded apps benefit
- Anti-pattern to avoid: "this would work identically with USDC"

## Status legend

- **shortlisted** — top contenders for Friday
- **liked** — user reacted positively, in the mix
- **open** — on the table, not yet ranked
- **needs-thinking** — concept has gaps; needs design work before committing
- **ruled-out** — scoped too big for this cycle, or fails the anti-pattern check

---

## Trust-graph mechanic

### Trustpoll
- **Status:** shortlisted (our original pick before this brainstorm)
- **Mechanic:** Sybil-resistant polls. Vote weight = how many other voters in the set trust you (in-degree within voter subgraph).
- **Why Circles:** trust-graph weighting is the whole mechanic; impossible with USDC or any non-Circles chain.
- **Retention:** per-decision; recurring if groups poll often.
- **Build time:** 4d (Postgres + EIP-1271 verify + weight precompute + live tally).
- **Differentiation:** VibeVote is tap-to-tip (no weighting). Parallel Society Voting is hidden/internal. No marketplace app uses trust-weighting.

### TrustChain
- **Status:** liked, shortlisted
- **Mechanic:** Send 1 CRC to a trusted neighbor. They have 24h to forward to one of *their* trusted neighbors who hasn't been on this chain. Chain breaks if anyone misses. Weekly: longest live chain wins a pot.
- **Why Circles:** the trust graph defines legal moves; the chain *is* the trust graph traversed in real time.
- **Retention:** 24h decay → daily check-ins. Activity gold.
- **Build time:** 4d (timer + forwarding flow + chain visualization + leaderboard).
- **Differentiation:** nothing remotely like it in the marketplace. Viral demo (animated growing tree).
- **Risk:** it's a game; "usefulness" criterion may discount slightly.
- **Open Q:** prize pool self-funded (each participant contributes 1 CRC, last forwarder wins) or sponsored?

### Vouch
- **Status:** open
- **Mechanic:** Public tagged endorsements ("kind", "good with code", "ships fast"). Voucher's trust-graph centrality weights the endorsement. Aggregates into per-address reputation pages.
- **Why Circles:** trust = endorsement substrate; centrality = credibility weight.
- **Retention:** occasional but high-engagement; reputation pages get bookmarked.
- **Build time:** 4d stretch (browsing/searching reputation pages is heavy UI work).
- **Differentiation:** no reputation app in the marketplace.

### TrustGate
- **Status:** open
- **Mechanic:** Lightweight access control. Generate a gated URL — "must be within N hops of @founder to enter." Wraps a target URL with a Circles-auth proxy.
- **Why Circles:** trust-graph traversal as auth primitive; deeper-than-token-gating.
- **Retention:** occasional (per-gate); but every group/event needs a gate.
- **Build time:** 3d.
- **Differentiation:** novel utility, no equivalent.

### Trust Atlas
- **Status:** needs-thinking
- **Mechanic:** 3D force-directed visualization of the trust graph. Find shortest trust path between any two avatars ("six degrees of Circles").
- **Why Circles:** pure trust-graph exploration.
- **Retention:** one-shot use; demos don't repeat.
- **Risk:** pretty but low activity score. Better as a feature inside another app than a standalone submission.

---

## Group currencies

### Bounty Board
- **Status:** liked, shortlisted
- **Mechanic:** Post small tasks payable in your group's currency ("restock coffee — 3 BHCRC"). Only group members claim. Settles via direct transfer or pathfinder.
- **Why Circles:** group currency is the unit of payment; trust set defines eligibility.
- **Retention:** weekly if group is active; daily for very active groups.
- **Build time:** 4d (post / claim / receipts).
- **Differentiation:** no bounty app in the marketplace.
- **Risk:** needs an active group to demo convincingly. Without one, judging on "usefulness" suffers.
- **Open Q:** do you have a group cluster ready, or do we seed one for the demo?

### Tribe (expanded — user requested more info)
- **Status:** needs-thinking
- **Mechanic:** Group-launch-as-a-service. A guided wizard takes a friend cluster through: naming the group, designing the currency, inviting members, first mint, and into a post-launch dashboard.
- **Why Circles:** `sdk.register.asGroup` is the only way to create a group, and it takes 7 parameters most users don't understand. Tribe is a UX wrapper that makes that one-shot setup approachable.

**The friction it removes:**
```ts
sdk.register.asGroup(
  owner,             // which Safe owns it?
  service,           // who's the operational signer?
  feeCollection,     // where do fees go?
  initialConditions, // which token types does the group trust as collateral?
  name,              // <= 19 chars
  symbol,            // e.g. "BHCRC"
  profile,           // Profile object OR an IPFS CID — and you need to pin it yourself
)
```
Non-devs will not survive this. Tribe fills it in.

**Templates** (sane defaults for common cases):
- **Hackerhouse** — single owner = creator, service = creator, no fee, trust common community currencies.
- **Local co-op** — multi-sig owner, fee to community pool, trust local member currencies.
- **Family / private** — single owner, hidden from marketplace, no fees.
- **Custom** — fall back to a full-fat editor.

**Wizard steps:**
1. Pick template (or custom)
2. Name + symbol + profile image (image gets pinned to IPFS via Pinata or web3.storage)
3. Members — paste addresses or invite by referral link (uses `avatar.invitation.getReferralCode()`)
4. Review — show all 7 args plainly; user signs the bundled tx
5. Post-launch dashboard — members, mints, redeems, weekly velocity

**Retention angle:** the post-launch dashboard is the daily-use surface. Without making it sticky, Tribe is one-and-done (you only create one group). The dashboard needs charts, member activity feed, and a "post a bounty / call a vote" CTA that opens *another* mini-app — so Tribe could be a hub that drives traffic to Bounty Board / Trustpoll.

**Build time:** 4d, tight. IPFS pinning + transaction bundling + dashboard.

**Differentiation:** MiniApps Builders Org Manager exists but is internal/builder-focused. Tribe is for end-users who've never touched `register.asGroup`.

**Verdict:** high-quality submission, weak activity score unless the dashboard becomes a daily-use surface. Probably stronger as a Launchpad submission (rolling $1k/month) than a single Garage cycle.

### Standup
- **Status:** open
- **Mechanic:** Daily group standup. Members post a one-line update; group currency drips to consistent posters; trust gates the comment/react surface.
- **Why Circles:** group currency as participation incentive; trust as engagement filter.
- **Retention:** daily — strongest activity story of any idea on this list.
- **Build time:** 4d (auth + post + reactions + drip mechanic).
- **Differentiation:** no standup app in the marketplace.

---

## Pathfinder

### Splitwise for Circles
- **Status:** shortlisted (heavy)
- **Mechanic:** Shared expense tracker. "Lisbon trip, 4 people, 350 EUR Airbnb." Settles balances through existing trust paths via pathfinder. No one bridges to fiat.
- **Why Circles:** pathfinder is the killer feature — settling balances across people who don't directly trust each other is *impossible* on any other chain. Strongest "would not work elsewhere" pitch.
- **Retention:** per-trip / per-shared-bill.
- **Build time:** 4d stretch (UI for expense entry + balance computation + pathfinder integration + settle-all flow).
- **Differentiation:** pure Circles use-case.

### Maxflow Meter
- **Status:** open
- **Mechanic:** Real-time gauge: "right now you can send up to X CRC to anyone." Pick a recipient → see the path, see why the limit is what it is, get one-tap "trust this person to unlock +50 CRC of send capacity."
- **Why Circles:** pathfinder visualization + recommendation engine.
- **Retention:** occasional check; mostly educational.
- **Build time:** 3d.
- **Differentiation:** clear onboarding/education angle.

### Liquid Tips
- **Status:** liked
- **Mechanic:** Embeddable tip jar (creator pages, OSS readmes, Substack posts). Pathfinder routes the CRC; if no path exists, suggests who to trust to enable.
- **Why Circles:** pathfinder + no-bridge-needed payments. Works *through* the trust graph.
- **Retention:** per-tip; high reuse if creators embed widely.
- **Build time:** 4d (embed widget + auth + send flow).
- **Differentiation:** the *embed* angle is novel — works outside the host iframe too, which expands reach beyond Circles users in-app.
- **Risk:** embedding outside the Circles app means you don't benefit from in-host activity scoring.

---

## Personal CRC

### MintMate + Friend/Group Leaderboards (expanded — user requested extension)
- **Status:** liked, shortlisted
- **Mechanic:** Daily "claim your accrued CRC" widget, with **leaderboards scoped to friends or groups** for mint streaks and weekly velocity.
- **Why Circles:** personal CRC minting is the core action; trust graph scopes "friends"; groups scope group-leaderboards. Trust-graph-scoped social leaderboards are uniquely Circles — you can't have "friends" on most chains.
- **Retention:** daily — strong activity story; the leaderboard turns a single-button app into a habit loop.
- **Build time:** 3d (claim button + streak DB + leaderboard view).

**Leaderboard variants worth shipping:**
- **Friends board** — your direct outgoing trust edges (people you trust). Shows their streaks and weekly mint totals.
- **Mutual board** — bidirectional trust edges only (more selective).
- **Group board** — all holders of a specific group token, scoped per group.
- **Streak board** — longest consecutive daily mints globally (public).
- **Velocity board** — most CRC minted this week.

**Why it's better than vanilla MintMate:**
- Vanilla MintMate is "press the button daily." Cool habit, but low Circles uniqueness — a button.
- Adding **friend-scoped** leaderboards makes the trust graph load-bearing (the leaderboard is a function of who you trust).
- Adding **group-scoped** leaderboards makes group membership load-bearing.
- Either upgrade alone is enough to differentiate. Both together is overkill but easy to ship.

**Notification angle:** "Alice just claimed 3.2 CRC — you have 2.8 CRC waiting." Social-pressure-driven daily opens.

**Build risk:** none, this is the lowest-risk build on the list. Real risk is feeling thin if the leaderboard view is undercooked — invest UI time there.

### Time Bank (expanded — user requested more info)
- **Status:** needs-thinking
- **Mechanic:** Personal CRC as posting credits. Your daily CRC mint funds your daily content quota. Posts burn CRC (to a community pool or group treasury).
- **Why Circles:** personal CRC issuance becomes a daily content quota; trust graph filters the timeline (you see posts from trusted-of-trusted, not random strangers).

**The economy:**
- Daily mint accrues ~X CRC (depends on user's mint rate, which is global protocol param).
- Post costs:
  - Text micro-post: 1 CRC
  - Image: 3 CRC
  - Voice note (≤60s): 5 CRC
- Reactions cost too — finite attention. Premium reactions (boosts) cost more.
- Burned CRC pools weekly → top creators (most-reacted-to posts) get a dividend.

**Why this is interesting:**
- Anti-spam by design: addresses with no trust → no mint issuance → no posts. Bots can't farm.
- Forces deliberate posting — every post is "I'm choosing this over saving for tomorrow."
- Trust filters the feed: posts from people in your trust web, ranked by your trust depth to them.
- CRC becomes functionally useful inside the app, not just a currency display.

**Build risk:** social products need critical mass; 4 days won't ship that. Best as a v0 with team-seeded posts + a small invite list. Realistic submission would be the *mechanic working end-to-end* with sparse content, not a thriving timeline.

**Verdict:** novel mechanic worth a longer build. Probably stronger as a Launchpad-track submission than a single Garage cycle. Cycle 01 wouldn't be a fair test.

---

## Games & wagers (new section — user's "double or nothing / blackjack" idea)

### Garage policy + judging check

From [`.claude/skills/circles/reference/submission.md`](.claude/skills/circles/reference/submission.md):

- **No explicit ban on gambling.** Coinflip Game is already live in the marketplace.
- **Transaction policy** blocks any tx touching Safe configuration (addOwner, swapOwner, execTransaction, enableModule, etc.). Doesn't affect normal game flows but rules out cute Safe-module hacks.
- **Judging criterion 2** ("would mainstream users return?") tends to discount pure gambling — the existing Coinflip Game is in the marketplace but doesn't seem to be a winner.
- **Anti-pattern** to watch for: "feels built for a grant." A shallow gambling mechanic risks tripping this.

**Verdict:** allowed, but pure gambling is a hard sell on the judging rubric. Better path: Circles-native wagering where the trust graph or pathfinder does real work.

### Double or Nothing
- **Status:** needs-thinking
- **Mechanic:** Stake N CRC. 50/50 outcome. Win 2N or lose stake. Implemented via commit-reveal (server commits hash of `(salt, outcome)`, user picks side, server reveals).
- **Why Circles:** minimal. CRC is just the stake — same game runs on USDC, ETH, anything. Bolted-on.
- **Build time:** 3d.
- **Risk:** generic. Won't score well on "Circles integration quality."

### Blackjack
- **Status:** ruled-out (for this cycle)
- **Mechanic:** Multi-tx card game against the house.
- **Why ruled out:** verifiable shuffling + hidden information + multi-round flow = 5+ day build. Doesn't fit Friday. Same Circles-integration problem as Double or Nothing.
- **Could revisit:** as a Launchpad submission with v2 features (trust-gated tables, friend-only games).

### Trust-staked Wager (Circles-native pivot, shortlisted-adjacent)
- **Status:** open
- **Mechanic:** 1v1 game (coin flip / rock-paper-scissors / dice — pick one). **Matchmaking restricted to your trust graph** — you can only challenge people you trust, or people in mutually-trusted circles. Winnings flow through pathfinder.
- **Why Circles:** trust graph defines who can play whom. Pathfinder routes payouts. Eliminates anonymous degen play. The "you can only bet against people you trust" framing changes the social texture.
- **Retention:** per-challenge; trust-gated challenges create a social loop.
- **Build time:** 4d (commit-reveal RNG + matchmaking by trust + payout routing).
- **Differentiation:** Coinflip Game is anonymous and house-vs-player. Trust-staked Wager is peer-to-peer and trust-gated.

### Reputation Stakes
- **Status:** ruled-out (this cycle)
- **Mechanic:** Wager CRC + your reputation. Win = boost incoming trust edges. Lose = visible "lost a stake" marker on profile for X days.
- **Why ruled out:** reputation modeling is hard to get right; high risk of unintended consequences (sybil-farmable). 5+ day design + build.

---

## Combinations worth considering

- **TrustChain + Leaderboards** — fold MintMate's social leaderboard into TrustChain's chain visualization. "Longest chain this week" is itself a leaderboard. Could be one cohesive submission.
- **Trustpoll + Bounty Board** — group decides which bounty to post next via Trustpoll, then posts it. Two products in one app. Adds depth.
- **MintMate + TrustGate** — only addresses with N-day mint streaks can enter a gated event. Trust × habit. Stretchy but cool.
- **Tribe as a hub** — Tribe is the on-ramp; once a group exists, it surfaces Bounty Board / Trustpoll / Standup as in-app modules. Suite play, but scope ballooning.

---

## Current ranking — best odds for Friday

1. **TrustChain** — best activity score + most viral demo + pure trust-graph mechanic. Some "is it useful?" risk.
2. **MintMate + Friend Leaderboards** — daily retention + cleanest 3-day build + trust-graph-scoped social. Lowest-risk submission.
3. **Trustpoll** — strongest "useful" story + cleanest mechanic to explain + clear differentiation from VibeVote.
4. **Bounty Board** — fills a marketplace gap + clear group-currency use. Needs a real group to demo against.
5. **Splitwise** — strongest "impossible elsewhere" pitch but heaviest build (pathfinder UI is fiddly).

## Long-term Launchpad track (rolling, $500/wk + $1k/month)

These need more time than Friday allows but are strong candidates for a follow-up cycle:
- **Tribe** — onboarding wedge for new groups; needs IPFS pinning + dashboard polish
- **Time Bank** — novel mechanic; needs seeded content + UX polish
- **Splitwise** — defensible utility; pathfinder UI deserves a full week
- **Trust-staked Wager** — Circles-native social gaming layer

---

## Open questions

1. Are we still anchored on "must use the trust graph" as the differentiator, or open to leaning on a different primitive?
2. For **TrustChain** — self-funded pot (each participant adds 1 CRC, last forwarder wins) or sponsored?
3. For **MintMate leaderboards** — friend-scoped or group-scoped first? Friend = your trust graph; group = a specific group's token holders.
4. For **Tribe** / **Bounty Board** — do you have a friend cluster ready to be the beta group? Without one to demo against, "usefulness" judging suffers.
5. For **wagers** — is a trust-staked wager interesting enough as a Circles-native pivot, or do you want pure double-or-nothing?
