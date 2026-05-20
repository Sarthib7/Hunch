# Recipe: trust-weighted voting (the Trustpoll mechanic)

Goal: collect votes from a defined voter set and weight each vote by **how many other voters trust the caster**. This is the core Circles-native mechanic that distinguishes Trustpoll from generic 1-wallet-1-vote polls (which Sybil-resistant attackers trivially break by spinning up addresses).

Used in: Trustpoll (this project), but generalizes to any group-decision app.

## The mechanic

For voter `v` in voter-set `V`, with vote `c` ∈ choices:

```
weight(v) = |{ u ∈ V \ {v} : u trusts v }|
```

The weight is the **in-degree** of `v` within the voter set's induced subgraph. Aggregate:

```
score(c) = Σ_{v: vote(v) = c} weight(v)
```

A Sybil voter that nobody trusts contributes weight 0. A well-connected member of the group contributes weight equal to the number of group members who trust them.

**Variants to consider:**
- **Mutual-only**: only count `u ↔ v` (both directions). More conservative; reduces "I trust them but they don't trust me" inflations.
- **Normalized**: divide weight(v) by total weight to show share-of-influence transparently.
- **Quadratic**: `weight(v) = sqrt(in-degree(v))` to reduce influence of hyper-connected nodes.
- **Min-threshold**: ignore voters with `weight(v) < 1` (only-self-trusted addresses).

Start with raw in-degree for v0 — easy to explain ("your vote weight = how many group members trust you"), easy to verify by hand on a small voter set.

## Architecture

```
client (mini-app)
  ↓ wallet from onWalletChange
  ↓ EIP-712-sign vote { pollId, choice, votedAt }
  ↓ POST /api/votes
server
  ↓ verify signature against voter's Safe (EIP-1271)
  ↓ upsert into votes table (unique on (pollId, voterAddress))
  ↓ fan-out to live result view (Postgres listen/notify, or Supabase Realtime)
result view
  ← compute weights from precomputed in-degree table
  ← aggregate by choice, render % share
```

Votes are off-chain (signed, verifiable, free). On-chain would be 1 tx per vote — friction kills participation for v0. If on-chain auditability matters later, periodically anchor a Merkle root of all votes to a contract.

## Step 1 — voter signs the vote

```tsx
'use client';
import { signMessage } from '@aboutcircles/miniapp-sdk';
import { useWallet } from '@/hooks/use-wallet';

async function castVote(pollId: string, choice: string) {
  const { address } = useWallet();
  if (!address) return;

  // Use a plain message (signMessage doesn't expose typed-data; the host hashes
  // EIP-191-style so plain strings are fine for v0).
  const votedAt = new Date().toISOString();
  const message = [
    'Trustpoll vote',
    `Poll: ${pollId}`,
    `Choice: ${choice}`,
    `Voter: ${address}`,
    `At: ${votedAt}`,
  ].join('\n');

  const { signature } = await signMessage(message);

  await fetch('/api/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pollId, choice, voter: address, votedAt, signature, signatureType: 'erc1271', message }),
  });
}
```

If you later want strict EIP-712 typed-data semantics (better wallet UX in non-Safe wallets, machine-readable in indexers), you'd extend `@aboutcircles/miniapp-sdk` to expose `signTypedData` — currently it only exposes `signMessage`, so EIP-191/EIP-1271 message hashing is the path.

## Step 2 — server verifies and stores

```ts
// app/api/votes/route.ts
import { createPublicClient, http, hashMessage, getAddress } from 'viem';
import { gnosis } from 'viem/chains';
import { db } from '@/lib/db';

const client = createPublicClient({ chain: gnosis, transport: http() });
const EIP1271_MAGIC = '0x1626ba7e' as const;

export async function POST(req: Request) {
  const { pollId, choice, voter, votedAt, signature, message } = await req.json();

  // 1. Sanity checks
  const poll = await db.poll.findUnique({ where: { id: pollId } });
  if (!poll) return Response.json({ error: 'no poll' }, { status: 404 });
  if (poll.closedAt && new Date(votedAt) > poll.closedAt) {
    return Response.json({ error: 'poll closed' }, { status: 400 });
  }
  if (!poll.choices.includes(choice)) {
    return Response.json({ error: 'invalid choice' }, { status: 400 });
  }
  if (!poll.voterSet.includes(voter.toLowerCase())) {
    return Response.json({ error: 'not in voter set' }, { status: 403 });
  }

  // 2. Verify signature against the Safe (EIP-1271)
  const result = await client.readContract({
    address: getAddress(voter),
    abi: [{
      name: 'isValidSignature', type: 'function', stateMutability: 'view',
      inputs: [{ name: 'hash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }],
      outputs: [{ type: 'bytes4' }],
    }],
    functionName: 'isValidSignature',
    args: [hashMessage(message), signature],
  });
  if (result !== EIP1271_MAGIC) return Response.json({ error: 'bad sig' }, { status: 401 });

  // 3. Upsert (allow vote changes until poll closes)
  await db.vote.upsert({
    where: { pollId_voter: { pollId, voter: voter.toLowerCase() } },
    update: { choice, votedAt, signature, message },
    create: { pollId, voter: voter.toLowerCase(), choice, votedAt, signature, message },
  });

  return Response.json({ ok: true });
}
```

The unique constraint `(pollId, voter)` means each address can change its vote until close — natural UX, and prevents double-counting.

## Step 3 — precompute in-degrees for the voter set

Trust graph queries are not cheap; run this once when the poll opens and again on close (in case anyone added trust during the window).

```ts
// server/weights.ts
import { Sdk } from '@aboutcircles/sdk';

const sdk = new Sdk();

export async function computeInDegrees(voterSet: string[]) {
  // For each voter, fetch their incoming trust relations, count how many are in the voter set.
  const voterLower = new Set(voterSet.map(v => v.toLowerCase()));
  const inDegree = new Map<string, number>();

  await Promise.all(voterSet.map(async (voter) => {
    const relations = await sdk.data.getTrustRelations(voter);
    // We want relations where `voter` is trusted BY others in the set.
    // 'trustedBy' and 'mutuallyTrusts' both mean someone trusts `voter`.
    let count = 0;
    for (const rel of relations) {
      const counterpart = rel.counterpart.toLowerCase();
      if (
        (rel.relation === 'trustedBy' || rel.relation === 'mutuallyTrusts') &&
        voterLower.has(counterpart) &&
        counterpart !== voter.toLowerCase()
      ) {
        count++;
      }
    }
    inDegree.set(voter.toLowerCase(), count);
  }));

  return inDegree;  // Map<voterAddress, weight>
}
```

Cache the resulting weights in a `poll_weights` table. Update on poll close. For larger voter sets (>200), parallelize with care — the indexer rate-limits.

## Step 4 — aggregate weighted results

```ts
// server/results.ts
export async function getPollResults(pollId: string) {
  const [votes, weights] = await Promise.all([
    db.vote.findMany({ where: { pollId } }),
    db.pollWeight.findMany({ where: { pollId } }),
  ]);
  const weightOf = new Map(weights.map(w => [w.voter, w.weight]));

  const byChoice = new Map<string, number>();
  let totalWeight = 0;
  for (const v of votes) {
    const w = weightOf.get(v.voter) ?? 0;
    byChoice.set(v.choice, (byChoice.get(v.choice) ?? 0) + w);
    totalWeight += w;
  }

  return {
    totalVoters: votes.length,
    totalWeight,
    results: [...byChoice].map(([choice, weight]) => ({
      choice,
      weight,
      share: totalWeight === 0 ? 0 : weight / totalWeight,
    })),
  };
}
```

## Step 5 — live view

Two cheap options:
- **Polling**: client refetches `/api/polls/:id/results` every 3-5s. Good enough for low-volume.
- **Supabase Realtime**: subscribe to `vote` inserts on the `pollId` channel; recompute client-side or refetch on each event.

For a wow-factor demo, Supabase Realtime gives instant tally updates as votes land.

## Step 6 — transparency

Show each voter's weight on the results page (and link to their Circles profile via `sdk.rpc.profile.getProfileView`). This sells the mechanic: "Alice's vote counted for 12 because 12 other group members trust her, while Bob (a brand-new wallet) counted for 0."

```tsx
<VoterTable rows={voters.map(v => ({
  address: v.voter,
  weight: weights.get(v.voter) ?? 0,
  choice: votes.find(x => x.voter === v.voter)?.choice ?? '—',
  avatarUrl: profileCache.get(v.voter)?.image,
}))} />
```

## Voter set definition (the harder design question)

How do you decide *who* can vote? Three options for v0:

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Pasted list** | Poll creator pastes addresses into a textarea | Simplest; works today | Manual; doesn't scale to "the whole community" |
| **Group-scoped** | Voter set = addresses holding a specific group token | Auto-membership; group native | Needs the group to exist; "holding" is a moving target |
| **Trust-set** | Voter set = addresses with N+ incoming trust within K hops of poll creator | Most Circles-native | Expensive to compute; hard to explain to users |

**Start with pasted list** for the MVP. Add group-scoped as a v2 once the group lookup story is clear — `sdk.data` doesn't expose `getGroupMembers()` directly, so this needs more research.

## Edge cases

- **Voter has no trust edges in the set**: weight 0. Their vote is recorded (for transparency) but doesn't move the tally. UI should warn them at vote-cast time.
- **Voter is the only one with high weight**: poll is effectively a dictator's call. Show the weight distribution upfront ("top voter weight: 14, median: 3") so participants understand stakes.
- **Vote changes before close**: upsert on `(pollId, voter)`. Show the updated tally; optionally show "X changed their vote from A to B" for transparency.
- **Trust changes mid-poll**: recompute weights at close. Cache pre-close weights too for "live during voting" tally.
- **Empty voter set or zero total weight**: render "Not enough trusted participants yet" instead of dividing by zero.

## Why this matters for Garage judging

Trust-weighted voting checks every box on the rubric:
- ✅ **Circles integration quality** — the trust graph IS the mechanic, not a payment skin
- ✅ **Usefulness** — every group needs to make decisions; Sybil-resistance is non-trivial
- ✅ **Polish** — transparent weight display is a UX win
- ✅ **Activity** — recurring polls drive repeat opens (judging measures weekly unique opens)
- ✅ **Referrals** — natural "invite trusted neighbors to vote" loop

The mechanic also distinguishes Trustpoll from existing voting apps in the marketplace (*VibeVote*, *Parallel Society Voting*) — neither uses trust-graph weighting. That's the wedge.
