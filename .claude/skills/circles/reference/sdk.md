# Circles SDK reference

Two packages, both at v0.1.31, both ship from `aboutcircles`. Read this file when you need an exact signature.

```bash
pnpm add @aboutcircles/miniapp-sdk @aboutcircles/sdk
# Standalone/QR only:
pnpm add @aboutcircles/sdk-utils
```

---

## `@aboutcircles/miniapp-sdk` — the host bridge

The entire surface, verbatim from `dist/index.d.ts`:

```ts
export interface Transaction {
  to: string;
  data?: string;
  value?: string;  // hex string, e.g. "0x0"
}

export interface SignResult {
  signature: string;
  verified: boolean;
}

export type SignatureType = 'erc1271' | 'raw';

export function isMiniappMode(): boolean;
export function onAppData(fn: (data: string) => void): void;
export function onWalletChange(fn: (address: string | null) => void): () => void;
export function sendTransactions(transactions: Transaction[]): Promise<string[]>;
export function signMessage(message: string, signatureType?: SignatureType): Promise<SignResult>;
```

### `isMiniappMode()`

Returns `true` when the page is loaded inside the Circles host iframe. Useful for branching UI ("connect via Circles" vs "scan this QR").

### `onWalletChange(fn)`

Registers a listener. Fires **immediately** with the current wallet state (so use it to initialize), then again on every change. Returns an unsubscribe function — call it on unmount. The address is the user's Safe address (smart contract account), not an EOA.

```ts
const unsubscribe = onWalletChange((address) => {
  setWallet(address ?? null);
});
return unsubscribe;
```

### `onAppData(fn)`

Receives base64-encoded application-specific data passed via the host's `?data=` query param. Use this for deep-link payloads where one mini-app launches another with context. Decode with `atob` (or `Buffer.from(data, 'base64')`).

### `sendTransactions(txs)`

Asks the host to sign and broadcast the batch through the user's Safe. Returns the tx hashes. Each `Transaction` is `{ to, data?, value? }` where `value` is a **hex string** (`"0x0"`, not `"0"`). BigInts must be `.toString(16)`-ed and `0x`-prefixed before crossing the JSON boundary.

```ts
const hashes = await sendTransactions([
  { to: hubV2, data: encodedTrust, value: '0x0' },
  { to: hubV2, data: encodedMint, value: '0x0' },
]);
```

The host's policy will reject the whole batch if any tx hits the Safe-management deny-list (see Garage transaction policy in [submission.md](submission.md)). On rejection the promise rejects and you receive a `tx_rejected` postMessage.

### `signMessage(message, signatureType?)`

Defaults to `'erc1271'` — the host applies EIP-191 prefix hashing (`keccak256("\x19Ethereum Signed Message:\n" + len + message)`) and uses that hash inside the EIP-712 `SafeMessage` envelope. **Backend verifiers must call `isValidSignature(eip191Hash, sig)` on the user's Safe**, not `ecrecover` — the wallet is a smart account.

Use `'raw'` only when you need byte-exact UTF-8 semantics; the two signature types are not interchangeable, so **persist `signatureType` alongside the signature** so the verifier knows which input to hash.

```ts
const { signature, verified } = await signMessage(
  `Sign in to Trustpoll\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`
);
// `verified` is the host's pre-validation; re-verify server-side before issuing a session.
```

### Error model

Normalize errors with a single helper:

```ts
export function normalizeError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const e = err as { shortMessage?: string; message?: string };
  return e.shortMessage ?? e.message ?? String(err);
}
```

Common kinds: `validation_error`, `user_rejected`, `network_error`, `host_bridge_error`, `unexpected_error`. Map to user-facing copy.

---

## `@aboutcircles/sdk` — read + write data

### Construction

```ts
import { Sdk } from '@aboutcircles/sdk';

const sdk = new Sdk();                  // default: Gnosis Chain mainnet, read-only
const sdk = new Sdk(config);            // custom CirclesConfig
const sdk = new Sdk(config, runner);    // with ContractRunner for write flows
```

The `ContractRunner` is **not** needed in a mini-app — host signs everything via `sendTransactions()`. It's required only when you control a signer (server-side scripts, indexer tools).

### `sdk.data: CirclesData`

The high-level read layer. No signer required.

```ts
sdk.data.getAvatar(address): Promise<AvatarInfo | undefined>
sdk.data.getTrustRelations(address): Promise<AggregatedTrustRelation[]>
sdk.data.getBalances(address): Promise<TokenBalance[]>
sdk.data.getAllInvitations(address, minimumBalance?: string): Promise<AllInvitationsResponse>
```

`AggregatedTrustRelation` includes the counterpart avatar and a `relation` of type `TrustRelationType` — `mutuallyTrusts`, `trustedBy` (incoming-only), `trusts` (outgoing-only), etc. **Use this to derive the trust graph for weighted voting.**

### `sdk.rpc` — the low-level RPC client

Includes `profile`, `pathfinder`, and event subscriptions. The most-used:

```ts
sdk.rpc.profile.getProfileView(address): Promise<{
  avatarInfo?: AvatarInfo;        // present iff registered
  profile?: Profile;
  trustStats: { trustsCount: number; trustedByCount: number };
  v2Balance?: bigint;
  v1Balance?: bigint;
}>

sdk.rpc.profile.getProfileByCid(cidV0): Promise<Profile | undefined>
```

`getProfileView` is the **preferred read primitive** — it never throws on unregistered addresses, instead returning `avatarInfo: undefined`. Use it everywhere `sdk.getAvatar()` would throw.

`sdk.rpc.pathfinder` exposes:

```ts
sdk.rpc.pathfinder.findPath(params): Promise<PathfindingResult>
sdk.rpc.pathfinder.findMaxFlow(params): Promise<bigint>

// FindPathParams:
{
  from: Address;
  to: Address;
  targetFlow: bigint;            // required for findPath
  useWrappedBalances?: boolean;  // include ERC20-wrapped CRC in routing
  fromTokens?: Address[];        // pin source tokens
  toTokens?: Address[];          // pin dest tokens
  excludeTokens?: Address[];
  maxTransfers?: number;         // hop cap
  simulatedBalances?: ...;       // for what-if UI sliders
}

// PathfindingResult:
{ maxFlow: bigint; transfers: Array<{ from, to, tokenOwner, value }> }
```

`tokenOwner` is the ERC1155 owner whose CRC denomination is being moved on each leg. If `maxFlow === 0`, no route exists for that amount; check `findMaxFlow` to set UI bounds.

### `sdk.profiles` — IPFS profile management

```ts
sdk.profiles.create(profile: Profile): Promise<string>     // pins to IPFS, returns CID
sdk.profiles.get(cid: string): Promise<Profile | undefined>
```

### `sdk.register` — create new identities

```ts
sdk.register.asHuman(inviter: Address, profile: Profile | string): Promise<HumanAvatar>
sdk.register.asOrganization(profile: Profile | string): Promise<OrganisationAvatar>
sdk.register.asGroup(
  owner: Address,
  service: Address,
  feeCollection: Address,
  initialConditions: Address[],
  name: string,            // <= 19 chars
  symbol: string,
  profile: Profile | string,
): Promise<BaseGroupAvatar>
```

These require a `ContractRunner` (writes). From within a mini-app you'd build the calldata for these contract calls and pass them to `sendTransactions()` instead.

### `sdk.getAvatar(address, autoSubscribeEvents?)`

Returns a write-capable `HumanAvatar | OrganisationAvatar | BaseGroupAvatar`. **Throws** "Avatar not found" if the address has no on-chain `cidV0Digest` — i.e., most non-Circles EOAs. Wrap in try/catch or prefer `getProfileView` for read paths.

### `HumanAvatar` — the write surface for a registered human

```ts
avatar.balances:
  getTotal(): Promise<bigint>                   // total CRC across all hops
  getTokenBalances(): Promise<TokenBalanceRow[]>
  getTotalSupply(): Promise<bigint>

avatar.trust:
  add(avatarOrList: Address | Address[], expiry?: bigint): Promise<TransactionReceipt>
  remove(avatarOrList: Address | Address[]): Promise<TransactionReceipt>
  isTrusting(address): Promise<boolean>
  isTrustedBy(address): Promise<boolean>
  getAll(): Promise<AggregatedTrustRelation[]>

avatar.personalToken:
  getMintableAmount(): Promise<{ amount: bigint; startPeriod: bigint; endPeriod: bigint }>
  mint(): Promise<TransactionReceipt>
  stop(): Promise<TransactionReceipt>    // irreversible

avatar.groupToken:
  mint(group: Address, amount: bigint): Promise<TransactionReceipt>
  // plus: getMaxMintable, redeem flows

avatar.transfer:
  direct(recipient, amount): Promise<TransactionReceipt>
  // pathfinder-based methods for routed transfers

avatar.history:
  // transaction history queries

avatar.invitation:
  getReferralCode(): Promise<{ transactions: TransactionRequest[]; privateKey: Hex }>
  invite(invitee: Address): Promise<TransactionRequest[]>
  getProxyInviters(): Promise<ProxyInviter[]>
  findInvitePath(proxyInviterAddress?): Promise<PathfindingResult>
  computeAddress(signer: Address): Address
  generateReferrals(count: number): Promise<{ secrets, signers, transactionReceipt }>
  getQuota(): Promise<bigint>
  getInvitationFee(): Promise<bigint>        // 96 CRC per invite
  getInvitationModule(): Promise<Address>
  listReferrals(limit?, offset?): Promise<ReferralPreviewList>
```

For invitation-referral mechanics (one of the Garage judging criteria), `invitation.getReferralCode()` returns a tx batch + a private key to share with the invitee. Hand off via deep link — the invitee uses the privkey to bootstrap a Safe and become a registered Circles avatar.

### `BaseGroupAvatar` — write surface for a group

Similar shape: `trust`, `groupToken` (mint/redeem from the group's side), settings for collateral conditions.

### Re-exported types

```ts
export type {
  Avatar, AggregatedTrustRelation, TrustRelationType,
  CirclesEvent, CirclesEventType, Observable,
  TransactionHistoryRow, SearchResultProfile, GroupTokenHolderRow,
  AvatarType, AvatarRow, TokenBalanceRow, TrustRelationRow,
  CirclesQuery, GroupType, ContractRunner,
  CirclesData,
  PathfindingOptions,
} from '@aboutcircles/sdk';
```

---

## `@aboutcircles/sdk-utils` — encoding helpers (standalone path)

```ts
import {
  encodeCrcV2TransferData,
  decodeCrcV2TransferData,
} from '@aboutcircles/sdk-utils';

// Encode a UTF-8 reference (data type 0x0001) for embedding in a transfer
const data = encodeCrcV2TransferData(['order_42_nonce_abc'], 0x0001);

// Decode an event payload back to the reference list
const { references } = decodeCrcV2TransferData(eventData);
```

Data type tags:
- `0x0001` — UTF-8 text references (simple use case)
- `0x1001` — message + structured metadata (richer context)

The package also exports sub-paths: `/bytes`, `/abi`, `/cid`, `/address`, `/constants`, `/circlesConverter`, `/errors`, `/contractErrors`, `/crypto`. `circlesConverter` has `attoCirclesToCircles(amount: bigint)` and inverse — use these for display formatting.

---

## RPC endpoint

```
https://rpc.circlesubi.network/
```

Custom JSON-RPC method `circles_events`:

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "circles_events",
  "params": [
    "<address>",                  // scope to this address
    <fromBlock or null>,
    <toBlock or null>,
    ["CrcV2_TransferData"]        // event filter
  ]
}
```

Other useful event types: `CrcV2_Transfer`, `CrcV2_Trust`, `CrcV2_RegisterHuman`, `CrcV2_RegisterGroup`. Poll with backoff; the indexer has eventual consistency across approval → ERC-4337 bundle → on-chain inclusion → index.

---

## Server-side initialization

The SDK is browser-first but works in Node. For backend verification or indexer scripts:

```ts
// server-side
import { Sdk } from '@aboutcircles/sdk';
const sdk = new Sdk();           // read-only is fine for verifying signatures, polling events
```

For backend EIP-712 receipt signing, use viem's `signTypedData` with a server-managed operator key — never expose the privkey to the client. See [recipes/payment-intent.md](../recipes/payment-intent.md).
