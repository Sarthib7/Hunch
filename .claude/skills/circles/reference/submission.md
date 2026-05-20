# Submission reference — Garage + Launchpad + manifest schema

Two parallel incentive programs, one shared marketplace repo. Both rely on entries in `aboutcircles/CirclesMiniapps/static/miniapps.json`.

## Quick comparison

| | Garage | Launchpad |
|---|---|---|
| Format | 6-week competition with weekly cycles | Continuous "App of the Week" + "Winner of the Month" |
| Deadline | Friday each cycle | Sunday 12:00 GMT weekly; month-end 12:00 GMT |
| Prizes (CRC, weekly top 3) | $250 / $150 / $100 | $500 weekly App-of-the-Week |
| Monthly prize | n/a | $1,000 Winner of the Month |
| Hosting | Anywhere (your own URL) | Source must be in `CirclesMiniapps/src/routes/apps/<slug>/` (curated) |
| Manifest `category` | `"garage"` | `"miniapp"` |
| Registration | `garage.aboutcircles.com/signup` + `/register` | Submit via [Google Form](https://forms.gle/4Zw77qz1oAzgjVnv9) |

A single app can target both programs — submit to Garage for the weekly competition, then graduate to a curated Launchpad listing once the app is mature.

## The marketplace manifest (`static/miniapps.json`)

PR against `master` on [`aboutcircles/CirclesMiniapps`](https://github.com/aboutcircles/CirclesMiniapps).

```json
{
  "slug": "your-app",
  "name": "Your App",
  "logo": "/app-logos/your-app.png",
  "url": "https://your-app.example.com/",
  "description": "One sentence describing what the app does.",
  "tags": ["voting", "tools"],
  "category": "garage",
  "isHidden": false
}
```

### Field reference

| Field | Required | Constraint |
|---|---|---|
| `slug` | yes | URL-safe, unique. Becomes the path `/miniapps/<slug>`. |
| `name` | yes | Display name. |
| `logo` | yes | HTTPS URL or repo-relative path. Square SVG or PNG, **min 64×64 px**. Empty string falls back to a first-letter tile. |
| `url` | yes | Absolute HTTPS URL of the deployed app. Must load in an iframe (no `X-Frame-Options: DENY`, no restrictive `frame-ancestors`). For `"category": "miniapp"`, this is `/apps/<slug>` (local). |
| `description` | yes | Short description under the app name. |
| `tags` | yes | At least one tag. Free-form strings; common: `voting`, `defi`, `tools`, `game`, `demo`, `tokens`, `transactions`. |
| `category` | yes | `"garage"`, `"miniapp"`, or `"admin"`. |
| `isHidden` | no | If `true`, hides the tile from the grid; app is still reachable at the slug URL. |

### PR checklist (Garage submission)

- [ ] Entry added to `static/miniapps.json` with `"category": "garage"`
- [ ] App loads over HTTPS and renders inside an iframe
- [ ] Logo resolves to a valid image (or omitted to use the fallback tile)
- [ ] `slug` is unique
- [ ] No attempt to call `execTransaction` or any Safe-management selectors
- [ ] PR title: `feat: add <your app name> (garage)`

The Circles team reviews and merges on best-effort. No formal SLA.

## Garage transaction policy — the deny-list

Before any user-approval popup, the host runs every batch you submit through `sendTransactions()` against a policy that **rejects the whole batch** if any tx:

1. Targets the user's currently-acting Safe address.
2. Targets the user's primary Safe (when operating in child-safe mode).
3. Uses any of these 4-byte selectors:

| Selector | Function | Why blocked |
|---|---|---|
| `0x0d582f13` | `addOwnerWithThreshold(address,uint256)` | Adding owners is account takeover |
| `0xf8dc5dd9` | `removeOwner(address,address,uint256)` | Same |
| `0xe318b52b` | `swapOwner(address,address,address)` | Same |
| `0x694e80c3` | `changeThreshold(uint256)` | Lowering threshold = takeover |
| `0xe19a9dd9` | `setGuard(address)` | Could install a malicious guard |
| `0xf08a0323` | `setFallbackHandler(address)` | Could intercept future calls |
| `0x610b5925` | `enableModule(address)` | Modules can drain the Safe |
| `0xe009cfde` | `disableModule(address,address)` | Could disable the user's security modules |
| `0x6a761202` | `execTransaction(…)` | Smuggling — host already wraps txs |

On rejection: a "Restricted action" modal explains what was blocked, and the iframe receives a `tx_rejected` postMessage. The whole batch fails on the first offender, not just the bad tx.

**You don't need `execTransaction` yourself** — the host wraps every tx into the Safe's execTransaction call internally. Calling it yourself is treated as smuggling and rejected.

If your app legitimately needs to mutate Safe configuration (managing a co-owned Safe, etc.), it doesn't belong in Garage — submit as a curated Embedded Mini App via [docs.aboutcircles.com/miniapps/contribute-mini-apps](https://docs.aboutcircles.com/miniapps/contribute-mini-apps).

## Garage judging rubric

Five criteria. From [`garage.aboutcircles.com/rules`](https://garage.aboutcircles.com/rules):

1. **Circles integration quality** — Does the app use trust, pathfinder, groups, or personal-CRC mechanics? Or is CRC just used as a payment token a la USDC? The latter scores poorly.
2. **Usefulness** — Would mainstream users return? Would the team itself use it? Demo-only / "built for a grant" feel is penalized.
3. **UX / polish** — Does it feel purposefully built? Onboarding, error states, loading states, mobile fit.
4. **Referrals** — *Invite links from the app that landed a new wallet connecting inside the app within the same cycle.* Excluded from Cycle 01. Implies you should expose `avatar.invitation.getReferralCode()`-backed flows for visitors.
5. **Activity** — *Weekly unique wallets that opened the mini-app inside the Circles app*, plus engagement duration. **Measured via Mixpanel**, so ensure your app is loaded inside the host (not just standalone) to be counted.

For **repeat winners** in subsequent cycles, a 200-word progress update is required documenting releases and roadmap.

## Launchpad criteria

Reviewers (per the Launchpad doc) evaluate:

- Practical usefulness & potential for real-world usage
- Clear integration with the Circles payment system
- Strong UX/UI design
- Payment transparency and security practices
- Open-source code availability (required — public GitHub repo)
- Ease of testing and community relevance

**Hard requirements**: open-source, no private-key prompts, payments clearly disclosed before wallet approval, app publicly available.

You can submit multiple apps and resubmit improved versions. Previous winners remain eligible if "meaningfully enhanced or gaining traction."

## Garage program registration

1. Create builder profile: [`garage.aboutcircles.com/signup`](https://garage.aboutcircles.com/signup)
2. Register each mini-app: [`garage.aboutcircles.com/register`](https://garage.aboutcircles.com/register) — supply name, pitch, deployed URL, repo URL, readme
3. Open a PR to `aboutcircles/CirclesMiniapps` for the marketplace listing
4. Be deployed and reachable by **Friday** of your cycle

## Common rejection causes

**Garage rejections:**
- App fails to load in iframe (CSP `frame-ancestors` blocked the host, or `X-Frame-Options: DENY`)
- Broken or 404 URL
- Restricted Safe-management call attempted
- Incomplete manifest entry

**Embedded (`"miniapp"`) rejections:**
- Linking to an external deployment instead of local source under `src/routes/apps/<slug>/`
- `npm run check` or `npm run build` failures
- Missing iframe integration patterns

## Differentiation strategy (avoiding the "bolted-on" trap)

The strongest Garage / Launchpad submissions answer **"why this needs Circles specifically":**

- Trust graph as Sybil-resistance → voting, reputation, gated access
- Group currencies as collateralized in-network credits → loyalty, co-ops, local economies
- Pathfinder as multi-hop payments → cross-community commerce
- Personal CRC continuous mint → UBI dashboards, claim widgets, time-based grants

If your one-liner would still make sense with "$USDC" swapped in for "CRC", reconsider the design.

## Tooling shortcut: real-app references

The marketplace itself doubles as a code library. To see how someone solved a particular pattern, browse `CirclesMiniapps/src/routes/apps/<slug>/` for the apps with `"category": "miniapp"` — those are the curated embedded apps with full source. Apps with `"category": "garage"` link out to their own repos.

Current notable examples to study:
- *Sign Message Demo* and *ERC20 Transfer Demo* — minimal templates
- *Coinflip Game* — game mechanics + payouts
- *VibeVote* — tap-to-tip voting, real-time scoreboard (study before building any voting-shaped app — your differentiation matters)
- *XMTP Demo* — secure messaging integration
- *Invitations Manager* — referral-code surfaces
