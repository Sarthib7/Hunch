# The four Circles primitives

Read this when designing an app that needs to leverage Circles *uniquely* — i.e., to avoid the "bolted-on CRC" anti-pattern that gets penalized in judging.

## 1. Personal CRC (UBI minting)

Each registered human mints their own ERC1155 token continuously, on Gnosis Chain (chain ID 100). The token is denominated in **atto-circles** (1 CRC = 1e18 atto-CRC). Issuance accrues per second; users claim via `avatar.personalToken.mint()`.

```ts
const { amount, startPeriod, endPeriod } = await avatar.personalToken.getMintableAmount();
// amount: bigint of atto-CRC ready to mint
// startPeriod / endPeriod: bigint period markers

import { attoCirclesToCircles } from '@aboutcircles/sdk-utils/circlesConverter';
console.log(`${attoCirclesToCircles(amount)} CRC mintable`);
```

`avatar.personalToken.stop()` permanently halts minting for that avatar — **irreversible**, used for retiring an account.

## 2. The trust graph (the load-bearing primitive)

**Trust is a directed edge** between avatars. "A trusts B" means: *anyone holding B's CRC can swap it 1:1 for A's CRC*. This is the mechanic that turns N personal currencies into a fungible network.

Important: trust is **not** the same as friendship or follow. It's an explicit economic statement — *I accept B's tokens at par*.

```ts
// Read the full trust list for an address
const relations = await sdk.data.getTrustRelations(address);
// relations: AggregatedTrustRelation[]
// each has { counterpart, relation: 'mutuallyTrusts' | 'trustedBy' | 'trusts' | ... }

// Point checks
const avatar = await sdk.getAvatar(myAddress);
await avatar.trust.isTrusting(otherAddress);   // do I trust them?
await avatar.trust.isTrustedBy(otherAddress);  // do they trust me?

// Mutate (requires the host to sign the tx — pass to sendTransactions in a mini-app)
await avatar.trust.add(otherAddress);          // add a trust edge to otherAddress
await avatar.trust.add([a, b, c]);             // batch
await avatar.trust.add(otherAddress, expiryBigInt); // optional expiry
await avatar.trust.remove(otherAddress);
```

**The `TrustRelationType` values map to directionality**:
- `mutuallyTrusts` — both sides trust each other
- `trusts` — outgoing only (you trust them, they don't trust you back)
- `trustedBy` — incoming only (they trust you, you don't trust them back)

For trust-weighted voting, you want **incoming** edges (`trustedBy` + `mutuallyTrusts`) within the voter set — these are the trusters who validated this voter.

## 3. The rule of trust (transfer mechanic)

When A wants to send X CRC to B but doesn't directly trust them, the system finds a chain through intermediaries. Each leg is a 1:1 swap: A's CRC becomes C's CRC (if A trusts C), C's CRC becomes B's CRC (if B trusts C). The user sees "send limit" — the **maximum amount currently routable** to B given current trust + holdings — which is often less than the total balance.

The user-facing nuance: the gap between balance and send-limit is normal. Your UI should display the routable amount, not the total balance, when prompting a send. Use `findMaxFlow` to size the input field's max value.

## 4. The pathfinder (routing)

```ts
import { Sdk } from '@aboutcircles/sdk';
const sdk = new Sdk();

// Single-amount routing
const result = await sdk.rpc.pathfinder.findPath({
  from: alice,
  to: bob,
  targetFlow: 10n * 10n ** 18n,   // 10 CRC in atto-circles
  useWrappedBalances: true,        // include ERC20-wrapped CRC if needed
  maxTransfers: 4,
});

if (result.maxFlow < 10n * 10n ** 18n) {
  // Couldn't route the full amount — fall back to result.maxFlow or refuse
}

// `result.transfers` is the ordered leg list:
// [{ from: alice, to: charlie, tokenOwner: aliceTokenOwner, value: 6n*10n**18n },
//  { from: charlie, to: bob,    tokenOwner: charlieTokenOwner, value: 4n*10n**18n }, ...]
```

To **execute** the path: `TransferBuilder.constructAdvancedTransfer()` wraps `findPath` + unwrap/rewrap + approvals into an ordered transaction array. In a mini-app, pass that array to `sendTransactions()`.

`findMaxFlow` returns just the max routable bigint — cheaper, use it for slider/input bounds before the user picks an amount.

**Failure modes**:
| Symptom | Cause | Fix |
|---|---|---|
| `maxFlow === 0` | No trust path | Verify trust edges; user must either build trust or ask recipient to trust someone in their network |
| `maxFlow < targetFlow` | Insufficient intermediary balances | Lower the request or use `useWrappedBalances: true` |
| Inconsistent results across calls | Trust/balances changed mid-flight | Show "send limit" reactively; re-query before sending |

## Group currencies

Groups are a collateralized currency. Created via `sdk.register.asGroup(...)`:

```ts
const group = await sdk.register.asGroup(
  ownerAddress,
  serviceAddress,          // operational signer
  feeCollectionAddress,    // where group fees go
  [],                      // initialConditions: addresses for membership/trust conditions
  'My Group',              // name (<= 19 chars)
  'MYG',                   // symbol
  { name: 'My Group', description: '…' },   // profile (Profile | CID)
);
```

**Mechanics**:
- The group trusts specific token types (declared via `initialConditions` or added later as trust edges).
- Members deposit those trusted tokens as collateral and mint group tokens proportionally: `avatar.groupToken.mint(group, amount)`.
- Group tokens redeem back to collateral via `groupRedeem()` (burns group tokens, returns underlying).
- There's **no formal membership list** — "members" are simply addresses holding the group's currency (or trusted by it). Don't expect a `getMembers()` call to exist.

This is why "voter set" in a group-scoped poll has to be enumerated explicitly or derived from trust edges + holdings — there's no first-class group roster.

**Pricing-by-trust pattern**: a group can set different acceptance rates per collateral token, effectively pricing-discriminating based on trust. Useful for in-group economies.

## How the primitives compose

| Goal | Primitives used | Example pattern |
|---|---|---|
| Sybil-resistant voting | trust graph (in-degree) | weight = count of voter-set trusters |
| Loyalty / membership currency | groups + personal CRC collateral | local food co-op with group token redeemable for shifts |
| Cross-community payment | pathfinder + trust | "send 10 CRC to anyone the network can reach" |
| Reputation / proof-of-personhood | trust edges as social attestations | gating content on having ≥ N incoming trust edges |
| UBI claim widget | personal CRC mint | one-tap weekly "claim your CRC" mini-app |
| Pay-it-forward chains | trust graph topology + transfers | force each hop to be a trusted neighbor; visualize chain |

## Anti-patterns the judging penalizes

- Accepting CRC payment as the *only* Circles touch — your app would work identically with USDC.
- Building a parallel social graph (likes, follows) when the trust graph is right there.
- Ignoring pathfinder and demanding direct trust between sender and recipient — fragile UX.
- Treating "group" as "Discord-like membership list" — it's a currency, not a chat room.
