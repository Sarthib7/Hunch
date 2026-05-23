---
name: circles
description: Build mini-apps on Circles (UBI cryptocurrency on Gnosis Chain by Gnosis/aboutcircles). Use when working anywhere in this gnosis directory; when importing `@aboutcircles/miniapp-sdk` or `@aboutcircles/sdk`; when planning, building, or submitting a Circles Garage or Launchpad entry; when integrating CRC payments (embedded iframe flow or standalone QR/deep-link flow); when querying the trust graph, group currencies, pathfinder routing, or personal CRC minting; when debugging Circles SDK issues (window-touching dynamic imports, `getAvatar` throwing on unregistered avatars, EIP-1271 vs raw message signing, the Garage Safe-management selector deny-list, iframe CSP `frame-ancestors`, host playground testing). Trigger phrases: "Circles miniapp", "Circles mini-app", "Circles SDK", "Circles Garage", "Circles Launchpad", "Gnosis Circles", "CRC token", "trust graph", "pathfinder", "group currency".
---

# Circles mini-apps

Circles is a person-to-person UBI cryptocurrency on **Gnosis Chain** (chain ID 100). Every registered human mints their own personal CRC token continuously; value flows between people via a **trust graph** and is routed by a **pathfinder** that swaps tokens hop-by-hop along trusted edges. Mini-apps are focused web UIs that plug into a user's Circles wallet through one of two host integrations.

## Pick an architecture first

| | Embedded (iframe) | Standalone (QR / deep-link) |
|---|---|---|
| Where it runs | Inside the Circles host app (`circles.gnosis.io` or `circles-dev.gnosis.io`) as an iframe | Anywhere on the web — kiosk, booth, your own URL |
| Wallet UI | **Host provides it.** You never render a Connect button | User scans QR → signs in Gnosis App → returns to your page |
| Signing | `signMessage()` over postMessage; EIP-1271 verification against the user's Safe | User signs in the Gnosis App; no callback — you **poll** `circles_events` |
| Best for | Recurring use, dashboards, social tools, anything that needs identity | Merchant checkout, event tickets, one-shot payments, public screens |
| SDK | `@aboutcircles/miniapp-sdk` + `@aboutcircles/sdk` | `@aboutcircles/sdk-utils` (`encodeCrcV2TransferData`) + RPC polling |
| Start from | [`aboutcircles/embedded-miniapp-boilerplate`](https://github.com/aboutcircles/embedded-miniapp-boilerplate) | [`aboutcircles/circles-gnosisApp-starter-kit`](https://github.com/aboutcircles/circles-gnosisApp-starter-kit) |

**Default to embedded** unless the use case is explicitly public-screen / kiosk. The embedded path is what the Garage program and the Launchpad both score on (activity inside the Circles app, measured via Mixpanel).

## Bootstrap an embedded mini-app

```bash
git clone https://github.com/aboutcircles/embedded-miniapp-boilerplate
cd embedded-miniapp-boilerplate
pnpm install
pnpm dev   # http://localhost:3000 — UI renders "Not connected" outside the host
```

**Stack the boilerplate gives you:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + pnpm. Already wired: `WalletProvider` context, `useWallet()` hook, `SignInDemo`, `ProfileLookup`, CSP frame-ancestors header for `*.gnosis.io` and `*.vercel.app` in `next.config.ts`.

### Test against a real host (no submission needed)

Deploy to any public HTTPS (Vercel preview is fastest: `git push` → grab `*.vercel.app`), then open:

```
https://circles.gnosis.io/playground?url=<your-deploy-url>
```

The playground iframes your app and injects a real Safe address. No manifest, no PR, no registration needed for testing.

## The host bridge — `@aboutcircles/miniapp-sdk`

Exact exports at v0.1.31 (just five things — the entire surface):

```ts
isMiniappMode(): boolean
onWalletChange(fn: (address: string | null) => void): () => void  // returns unsubscribe
onAppData(fn: (data: string) => void): void                       // ?data= query param payloads
sendTransactions(transactions: Transaction[]): Promise<string[]>  // returns tx hashes
signMessage(message: string, signatureType?: 'erc1271' | 'raw'): Promise<{ signature, verified }>

type Transaction = { to: string; data?: string; value?: string }  // value is hex, e.g. "0x0"
```

**Mental model**: the host owns the wallet. You never construct or hold a signer; you ask the host to sign or broadcast on the user's behalf. `onWalletChange` fires immediately with the current state, then on every change — store the address in React context and re-render.

`signMessage` defaults to `'erc1271'`, which applies EIP-191 prefix-hashing on the host side and yields a Safe contract signature. A backend verifier must call `isValidSignature(eip191Hash, sig)` on the Safe — **not** `ecrecover`, since the wallet is a smart account, not an EOA. Use `'raw'` only when you need byte-exact semantics (rare).

See [reference/sdk.md](reference/sdk.md) for the full breakdown of each call, error shapes, and the postMessage protocol.

## The data layer — `@aboutcircles/sdk`

The SDK is shipped as one umbrella package plus a set of modular sub-packages you can import directly when you need lower-level access:

| Package | What's in it |
|---|---|
| `@aboutcircles/sdk` | High-level `Sdk` + avatar classes (`HumanAvatar`, `OrganisationAvatar`, `BaseGroupAvatar`) and namespaced helpers (`sdk.data`, `sdk.tokens`, `sdk.groups`, `sdk.profiles`, `sdk.register`) |
| `@aboutcircles/sdk-core` | `Core` + `circlesConfig[100]` (Hub v1/v2, NameRegistry, Migration, BaseMintPolicy, StandardTreasury, LiftERC20 addresses) |
| `@aboutcircles/sdk-rpc` | `CirclesRpc` — typed client for `circles_*` JSON-RPC methods and pathfinder |
| `@aboutcircles/sdk-runner` | `SafeContractRunner` (server) / `SafeBrowserRunner` (front-end Safe Apps); both satisfy the `ContractRunner` interface for Safe-backed signing |
| `@aboutcircles/sdk-transfers` | `TransferBuilder.constructAdvancedTransfer(from, to, amount, opts)` — orchestrates pathfinding + unwrap/approve/`operateFlowMatrix` payloads into one ordered tx list |
| `@aboutcircles/sdk-pathfinder` | `createFlowMatrix`, `packCoordinates`, `getTokenInfoMapFromPath`, `shrinkPathValues`, etc. — pure helpers for hand-building flow matrices |
| `@aboutcircles/sdk-profiles` | `Profiles.create(profile)` / `.get(cid)` — direct pinning client for the Circles profile service |
| `@aboutcircles/sdk-types` | Shared types: `ContractRunner`, `TransactionRequest`, `Profile`, `GroupProfile`, avatar models |
| `@aboutcircles/sdk-utils` | `encodeCrcV2TransferData`, `decodeCrcV2TransferData`, `cidV0ToHex`, demurrage helpers |

For mini-apps the umbrella `@aboutcircles/sdk` is enough; reach for the sub-packages when you need a Safe runner, analytics RPC views, or custom flow-matrix construction.

```ts
import { Sdk } from '@aboutcircles/sdk';
const sdk = new Sdk(); // defaults to Gnosis Chain mainnet — no contractRunner needed for reads

// Read-only (no signer required):
await sdk.data.getAvatar(address)         // → AvatarInfo | undefined
await sdk.data.getTrustRelations(address) // → AggregatedTrustRelation[]
await sdk.data.getBalances(address)       // → TokenBalance[]
await sdk.rpc.profile.getProfileView(address)
//   → { avatarInfo?, profile?, trustStats, v2Balance?, v1Balance? }   <- preferred read primitive

// Write (requires contractRunner — usually you don't, since the host signs):
const avatar = await sdk.getAvatar(address); // HumanAvatar | OrganisationAvatar | BaseGroupAvatar
await avatar.trust.add(otherAddress);
await avatar.transfer.direct(recipient, amount);
await avatar.personalToken.mint();
await avatar.groupToken.mint(group, amount);
```

**Key gotcha**: `sdk.getAvatar()` *throws* "Avatar not found" for any address whose on-chain `cidV0Digest` is empty, including most regular EOAs. For read-only lookups always use `sdk.rpc.profile.getProfileView(address)` — it returns `avatarInfo: undefined` instead of throwing.

For write flows in a mini-app: **you don't need a `contractRunner`**. Build the calldata with viem (or hand-encoded) and pass it to `sendTransactions()` — the host's Safe is the signer. The avatar's high-level write methods (`avatar.trust.add`, `avatar.transfer.direct`, …) are for non-mini-app contexts where you control a signer.

Full method-by-method reference: [reference/sdk.md](reference/sdk.md).

## Rich indexed reads — `circles_query`

For anything more complex than "watch the event stream", use the `circles_query` JSON-RPC method with the `V_CrcV2` (aggregated views) or `CrcV2` (raw events) namespaces. It accepts a structured query: `{ Namespace, Table, Columns, Filter, Order, Limit }`. Tables worth knowing:

| Table (V_CrcV2) | What it gives you |
|---|---|
| `Avatars` | Recent human / group / org registrations with `cidV0Digest` |
| `TrustRelations` | Directed trust edges with `expiryTime`; filter by `truster` or `trustee` |
| `BalancesByAccountAndToken` | Per-token balance breakdown for an account, including demurraged totals |
| `Transfers` | Indexed CRC transfers, filterable by `from`/`to`/`type` — cleaner than walking `circles_events` for analytics |
| `TotalSupply` | Per-token total supply (use with the demurrage helpers from `sdk-utils`) |
| `Groups` | Group registry with `memberCount`, `mintPolicy`, `treasury`, ERC-20 wrapper addresses |
| `GroupMemberships`, `GroupTokenHoldersBalance`, `GroupVaultBalancesByToken`, `GroupCollateralByToken` | Membership + collateral views for any group |
| `GroupMembersCount_{1h,1d}`, `GroupWrapUnWrap_{1h,1d}`, `GroupMintRedeem_{1h,1d}`, `AffiliateMembersCount_{1h,1d}`, `Erc20BalancerVaultBalance_{1h,1d}` | Pre-aggregated time-series for dashboards |

Use the raw `CrcV2` namespace (e.g. `CrcV2.CirclesBackingDeployed`) when you need un-aggregated event rows. `circles_events` is still right for *live ingestion* (it scopes by address + block range and is what a sequencer / cron should poll); `circles_query` shines for *backfill, history views, and analytics*.

## Wrapping CRC into ERC-20 and back

CRC is an ERC-1155, but most DeFi tools expect an ERC-20. Two wrapper flavours, switchable per-avatar:

* **Demurraged ERC-20** (`avatar.wrap.asDemurraged(avatar.address, atto)`) — keeps the 7%/yr decay. Use when external protocols should respect Circles economics.
* **Inflationary / static ERC-20** (`avatar.wrap.asInflationary(avatar.address, atto)`) — balance is fixed in ERC-20 terms. Use for AMM LP, lending collateral, bridges where decay breaks integrations.

Unwrap back via `avatar.wrap.unwrapDemurraged(wrapperAddr, atto)` / `unwrapInflationary(...)`. Look up an avatar's wrapper address with `sdk.core.liftERC20.erc20Circles(CirclesType.Demurrage | CirclesType.Inflation, avatar.address)` from `@aboutcircles/sdk-core`.

## Multi-hop payouts — `TransferBuilder`

The high-level avatar `transfer.advanced(...)` and the standalone `TransferBuilder.constructAdvancedTransfer(from, to, amount, opts)` both wrap the same flow: pathfinder → flow-matrix → ordered `[unwrap?, approve?, operateFlowMatrix]` tx list, returned without sending. Pass `useWrappedBalances: true` if the sender has wrapped CRC, `simulatedBalances` for what-if previews, and `maxTransfers` to cap hop count. Hand the result to `sendTransactions()` (mini-app) or your runner (server). This is the canonical implementation path for any future "automated payout to N voters" feature — don't roll your own flow matrix unless you need exotic routing.

## Profiles — pin avatar metadata to IPFS

Every avatar's on-chain `cidV0Digest` points at a JSON blob on IPFS. The blob shape is `Profile` (`name` + optional `description`, `imageUrl`, `previewImageUrl`, `location`, `geoLocation`, `extensions`). Group profiles add a required `symbol`. Pin via either:

```ts
const cid = await sdk.profiles.create(profile);              // direct pinning client
await avatar.profile.update(profile);                        // pin + on-chain updateMetadataDigest
```

`previewImageUrl` is strict: PNG/JPEG/GIF, exactly 256×256, ≤150KB, base64 data URL. Validate client-side before submitting or the service rejects the upload. Useful for setting a pool/Organisation avatar's name + image so it shows properly in the Circles host instead of as a generic Organisation tile.

## The four primitives

1. **Personal CRC** — every registered human mints their own ERC1155 token continuously (`avatar.personalToken.mint()` claims accrued issuance).
2. **Trust graph** — directed edges between avatars. "A trusts B" means *anyone holding B's CRC can swap it 1:1 for A's CRC*. This is what makes CRC fungible across people.
3. **Group currencies** — communities create a base group via `sdk.register.asGroup(...)` and accept collateral (members' CRC). Members mint group tokens by depositing collateral (`avatar.groupToken.mint(group, amount)`) and redeem to recover it.
4. **Pathfinder** — finds multi-hop swap routes through the trust graph when A and B don't directly trust each other. Returns `{ maxFlow, transfers[] }` where each `transfer` is `{ from, to, tokenOwner, value }`. Use `findPath` for a specific amount, `findMaxFlow` to size the UI upfront.

Deeper mechanics, examples, and how trust + pathfinder produce the user-facing "send limit < balance" experience: [reference/primitives.md](reference/primitives.md).

## Three patterns to know cold

**1. Sign-in (verify a Safe owns the wallet).** Sign a SIWE-style nonce client-side with `signMessage()`; verify server-side via `isValidSignature` against the Safe. See [recipes/auth-sign-in.md](recipes/auth-sign-in.md).

**2. Payment with verifiable intent.** Sign an HMAC payment intent on the backend; embed it in the CRC transfer's metadata via `encodeCrcV2TransferData`; user signs the transfer through `sendTransactions()`; backend polls `circles_events` for the matching `CrcV2_TransferData` event and signs an EIP-712 receipt. Database-less, idempotent. See [recipes/payment-intent.md](recipes/payment-intent.md).

**3. Trust-weighted vote.** Collect EIP-712-signed votes off-chain; compute each voter's weight as a function of incoming trust edges within the voter set; render live tallies. See [recipes/trust-weighted-vote.md](recipes/trust-weighted-vote.md) — this is the recipe we're using for the Trustpoll build.

## Local dev gotchas

- **Both SDKs touch `window`.** They must be imported dynamically inside a client component's `useEffect`, never at the top level of a server component, or you'll get `window is not defined` at build time.
- **No connect button.** If you find yourself building one, you're solving the wrong problem — the host *is* the wallet UI.
- **`getAvatar` throws** for unregistered avatars. Use `sdk.rpc.profile.getProfileView()` for reads, save `getAvatar` for write flows on known avatars.
- **Light mode only** in the boilerplate. Restore the `.dark { … }` block in `app/globals.css` and add `next-themes` if you need dark.
- **Tailwind v4** — no `tailwind.config.js`. Theme tokens live in `globals.css` under `@theme inline { … }`.
- **CSP `frame-ancestors`** must include `*.gnosis.io` and `*.vercel.app` (or your deploy domain). The boilerplate's `next.config.ts` already sets this; if you deploy somewhere else, edit it.

## Garage transaction policy — what the host **rejects**

Before any approval popup, the host runs your batch through a policy and rejects the whole batch if any tx:

1. Targets the user's currently-acting Safe.
2. Targets the user's primary Safe (in child-safe mode).
3. Uses any Safe-management selector: `addOwnerWithThreshold` (`0x0d582f13`), `removeOwner` (`0xf8dc5dd9`), `swapOwner` (`0xe318b52b`), `changeThreshold` (`0x694e80c3`), `setGuard` (`0xe19a9dd9`), `setFallbackHandler` (`0xf08a0323`), `enableModule` (`0x610b5925`), `disableModule` (`0xe009cfde`), `execTransaction` (`0x6a761202`).

Rejection produces a "Restricted action" modal for the user and a `tx_rejected` postMessage to the iframe. Don't try to wrap your own `execTransaction` — the host already wraps txs correctly; calling it yourself is treated as smuggling.

## Submission flows — two parallel incentive programs

| | Garage (competition) | Launchpad (rolling) |
|---|---|---|
| Structure | 6-week competition, weekly cycles | Continuous |
| Cadence | Friday deadline each cycle | Sunday 12:00 GMT weekly; monthly review |
| Prizes (CRC) | $250 / $150 / $100 (top 3 weekly) | $500 weekly App-of-the-Week + $1,000 monthly winner |
| Manifest category | `"category": "garage"` | `"category": "miniapp"` |
| Where the app lives | Anywhere — your own URL | Source must be in `CirclesMiniapps/src/routes/apps/<slug>/` |
| Where to register | [`garage.aboutcircles.com/register`](https://garage.aboutcircles.com/register) (+ PR to `static/miniapps.json`) | [Google Form](https://forms.gle/4Zw77qz1oAzgjVnv9) + PR with source |
| Apps must be | Browser-accessible, iframe-embeddable, HTTPS | Plus: source open, no private key prompts, payments transparent |

Garage submissions are judged on (1) Circles integration quality, (2) usefulness, (3) UX/polish, (4) referrals — invite links that produced a new wallet connecting in-app within the same cycle, (5) activity — weekly unique wallets opening your app inside the Circles app, measured via Mixpanel. Anti-pattern: "built-for-a-grant" apps with token features bolted onto a generic concept.

PR title convention for Garage: `feat: add <your app name> (garage)`. PR against `master` on [`aboutcircles/CirclesMiniapps`](https://github.com/aboutcircles/CirclesMiniapps).

Full schema, judging breakdown, submission checklist: [reference/submission.md](reference/submission.md).

## Standalone (QR) flow — when you need it

```
https://app.gnosis.io/transfer/{recipient}/crc?amount={human-readable-crc}&data={url-encoded-encoded-data}
```

Encode the `data` payload with `encodeCrcV2TransferData([reference], 0x0001)` from `@aboutcircles/sdk-utils`. **No callback** — your app polls `circles_events` (RPC method) scoped to the recipient, filters for `CrcV2_TransferData`, decodes with `decodeCrcV2TransferData`, matches the reference against your stored intent (not the amount alone), then runs business logic inside an idempotent lock.

Detailed flow with worked example: [reference/standalone-qr.md](reference/standalone-qr.md).

## Reference index

**Official Circles repos**
- [`aboutcircles/embedded-miniapp-boilerplate`](https://github.com/aboutcircles/embedded-miniapp-boilerplate) — Next.js 16 + shadcn starter (start here for embedded apps)
- [`aboutcircles/CirclesMiniapps`](https://github.com/aboutcircles/CirclesMiniapps) — the host marketplace repo. Submit PRs to `static/miniapps.json` here; for the `"miniapp"` category, ship your source under `src/routes/apps/<slug>/`. Also the canonical place to read how other apps were built (see roster below).
- [`aboutcircles/circles-gnosisApp-starter-kit`](https://github.com/aboutcircles/circles-gnosisApp-starter-kit) — standalone/QR starter kit (`encodeCrcV2TransferData`, deep-link patterns)
- [`aboutcircles/merch-shop-miniapp`](https://github.com/aboutcircles/merch-shop-miniapp) — reference standalone merchant flow
- [`aboutcircles/circles-groups-miniapp`](https://github.com/aboutcircles/circles-groups-miniapp) — original vanilla-JS/Vite reference the boilerplate is derived from

**Existing apps in the marketplace** (good reads when planning a new app)
- *Sign Message Demo*, *ERC20 Transfer Demo* — the two SDK demos shipped in `CirclesMiniapps/src/routes/apps/`
- *Coinflip Game* — simple game mechanic
- *VibeVote* — onchain applause meter, tap to send 1 CRC, real-time scoreboard (closest existing thing to a voting app; differentiating on **trust-weighting** is the wedge for Trustpoll)
- *Parallel Society Voting* — internal hidden, also voting-shaped
- *XMTP Demo* — secure messaging integration
- *Honeypot*, *Pixelize* — community demos showing creator-economy / mint patterns
- *Invitations Manager*, *MiniApps Builders Org Manager* — admin tooling for org/invitation management

**Docs**
- [Mini-apps overview](https://docs.aboutcircles.com/miniapps/what-are-circles-mini-apps.md)
- [Embedded mini-apps guide](https://docs.aboutcircles.com/miniapps/embedded-mini-apps.md)
- [Intermediate embedded guide](https://docs.aboutcircles.com/miniapps/embedded-mini-apps/intermediate-embedded-mini-app-guide.md) — multi-step flows, intent-matching, EIP-712 receipts
- [Standalone mini-apps](https://docs.aboutcircles.com/miniapps/standalone-mini-apps.md) — QR/deep-link patterns
- [Contributing mini-apps](https://docs.aboutcircles.com/miniapps/contribute-mini-apps.md) — manifest schema, review criteria
- [Quickstart guide for the SDK](https://docs.aboutcircles.com/circles-sdk/getting-started-with-the-sdk.md) — install + `circlesConfig[100]` + browser `ContractRunner` end-to-end
- [SDK overview](https://docs.aboutcircles.com/circles-sdk/circles-sdk-overview.md) and the [sub-package list](https://docs.aboutcircles.com/circles-sdk/circles-sdk-overview.md#dependency-packages)
- [Pathfinder](https://docs.aboutcircles.com/circles-sdk/pathfinder.md), [group currencies](https://docs.aboutcircles.com/overview/how-it-works/group-currencies.md), [rule of trust](https://docs.aboutcircles.com/user-guides/circles-features/circles-transfer-and-rule-of-trust.md), [wrapping](https://docs.aboutcircles.com/circles-sdk/wrapping-and-unwrapping.md), [profiles](https://docs.aboutcircles.com/circles-sdk/circles-profiles.md)
- [JSON-RPC API reference](https://docs.aboutcircles.com/api-reference/circles-api.md) — every `circles_*` method with request/response schemas, including the `circles_query` template library
- [Embedded mini-apps practical guide](https://docs.aboutcircles.com/miniapps/embedded-mini-apps.md) — wallet lifecycle FSM, tx-formatting adapter, request-ID race control, signing patterns
- [Agentic setup for Circles](https://docs.aboutcircles.com/miniapps/agentic-setup-for-circles.md) — Context7 MCP wiring (libraries `aboutcircles/sdk` and `aboutcircles/circles-docs`) so editor agents pull fresh API surfaces
- [CirclesTools dashboard](https://aboutcircles.github.io/CirclesTools/) — Group Checker, Trust Path Visualizer, Token Distribution Checker; useful for ops/debugging
- [Full corpus](https://docs.aboutcircles.com/llms-full.txt) — search this when something specific isn't here

**Programs**
- [`garage.aboutcircles.com`](https://garage.aboutcircles.com/) — competition, register at `/signup` then submit at `/register`. Rules at `/rules`.
- [`miniapps.aboutcircles.com/developers`](https://miniapps.aboutcircles.com/developers) — developer one-pager
- [Launchpad incentive program](https://docs.aboutcircles.com/miniapps/circles-mini-apps-launchpad.md)
- [Community Telegram](https://t.me/about_circles/499)

**Skill internals** (this skill's own files — load when needed)
- [reference/sdk.md](reference/sdk.md) — every SDK method signature with examples
- [reference/primitives.md](reference/primitives.md) — trust graph, pathfinder, group currencies in depth
- [reference/standalone-qr.md](reference/standalone-qr.md) — deep-link URL scheme, event polling, idempotency
- [reference/submission.md](reference/submission.md) — Garage + Launchpad schemas, judging rubric, PR checklist
- [recipes/auth-sign-in.md](recipes/auth-sign-in.md) — sign + EIP-1271 verify
- [recipes/payment-intent.md](recipes/payment-intent.md) — HMAC intent → embedded tx → event match → EIP-712 receipt
- [recipes/trust-weighted-vote.md](recipes/trust-weighted-vote.md) — Trustpoll mechanic (signed votes + in-degree weighting)
