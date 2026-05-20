# Recipe: verifiable payment with embedded intent

Goal: accept a CRC payment for a specific in-app action (buying a ticket, unlocking content, claiming a bounty) **without a database that maps tx hashes to users** — using on-chain transfer metadata as the source of truth.

This works in **both** embedded and standalone modes. For standalone, replace `sendTransactions()` with a QR deep-link (see [reference/standalone-qr.md](../reference/standalone-qr.md)).

## The flow

```
1. backend  → creates HMAC-signed intent { id, buyer, productId, amount, expiry, nonce }
2. backend  → encodes intent into CRC transfer data via encodeCrcV2TransferData
3. client   → calls sendTransactions([{ to: hubV2, data: encodedTransferWithMetadata, value: '0x0' }])
4. host     → user approves; transfer broadcasts on Gnosis Chain
5. backend  → polls circles_events for CrcV2_TransferData scoped to merchant address
6. backend  → decodes references, finds the intent id, verifies HMAC, validates amount
7. backend  → signs EIP-712 receipt; returns to client; client unlocks the action
```

No db lookup between buyer and tx hash — the intent travels *inside* the on-chain transfer.

## Step 1 — backend creates the intent

```ts
// server/intent.ts
import { createHmac, randomBytes } from 'crypto';

type PaymentPayload = {
  v: 1;
  e: string;             // eventId / productId
  t: string;             // ticketTypeId / variant
  b: `0x${string}`;      // buyer address
  x: number;             // expiry unix ms
  n: string;             // nonce
};

const SECRET = process.env.INTENT_SECRET!;  // never expose to client

export function createIntent(buyer: `0x${string}`, productId: string, ticketTypeId: string) {
  const payload: PaymentPayload = {
    v: 1,
    e: productId,
    t: ticketTypeId,
    b: buyer,
    x: Date.now() + 10 * 60_000,
    n: randomBytes(8).toString('hex'),
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const hmac = createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `crc-ticket.${b64}.${hmac}`;
}

export function verifyIntent(token: string): PaymentPayload | null {
  const [tag, b64, sig] = token.split('.');
  if (tag !== 'crc-ticket') return null;
  const expected = createHmac('sha256', SECRET).update(b64).digest('base64url');
  if (sig !== expected) return null;
  const payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as PaymentPayload;
  if (payload.x < Date.now()) return null;
  return payload;
}
```

The intent token format `crc-ticket.<b64payload>.<hmac>` is opaque to anyone without `INTENT_SECRET`. The buyer carries it in the transfer metadata as a reference string.

## Step 2 — backend builds the transfer calldata + intent

```ts
// app/api/checkout/route.ts
import { encodeCrcV2TransferData } from '@aboutcircles/sdk-utils';
import { encodeFunctionData } from 'viem';
import { hubV2Abi, hubV2Address, merchantSafe } from '@/lib/circles';

export async function POST(req: Request) {
  const { buyer, productId, ticketTypeId, amountAttoCrc } = await req.json();
  const intent = createIntent(buyer, productId, ticketTypeId);

  // Embed the intent string as a transfer reference
  const metadata = encodeCrcV2TransferData([intent], 0x0001);

  // Build a Hub v2 routed-transfer calldata that carries `metadata`.
  // The exact ABI call depends on the transfer type — direct vs pathfinder-routed.
  // Pseudo-code below; in practice use TransferBuilder.constructAdvancedTransfer()
  // and append metadata to the final call.
  const data = encodeFunctionData({
    abi: hubV2Abi,
    functionName: 'operateFlowMatrix',  // or similar pathfinder entrypoint
    args: [/* …routing args…, */ metadata],
  });

  return Response.json({
    intentId: extractIdFromIntent(intent),
    transfer: { to: hubV2Address, data, value: '0x0' },
  });
}
```

`TransferBuilder.constructAdvancedTransfer()` from `@aboutcircles/sdk` does this end-to-end (pathfinder, unwrap/rewrap, approvals); inject your `metadata` into the resulting transaction array's last leg.

## Step 3 — client submits via the host

```tsx
'use client';
import { sendTransactions } from '@aboutcircles/miniapp-sdk';

async function buy(productId: string, ticketTypeId: string, amountAttoCrc: string) {
  const { intentId, transfer } = await fetch('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ buyer: address, productId, ticketTypeId, amountAttoCrc }),
  }).then(r => r.json());

  const [txHash] = await sendTransactions([transfer]);
  // Don't wait synchronously — the indexer takes 5-30s. Poll instead.
  return { intentId, txHash };
}
```

## Step 4 — server-side: poll for the matching transfer

```ts
// server/poller.ts
import { decodeCrcV2TransferData } from '@aboutcircles/sdk-utils';

async function pollForIntent(intentToken: string, recipient: `0x${string}`) {
  const target = parseIntent(intentToken).id;
  let delay = 2_000;

  while (true) {
    const events = await fetch('https://rpc.circlesubi.network/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'circles_events',
        params: [recipient, null, null, ['CrcV2_TransferData']],
      }),
    }).then(r => r.json());

    for (const event of events.result ?? []) {
      const { references } = decodeCrcV2TransferData(event.data);
      for (const ref of references) {
        const payload = verifyIntent(ref);
        if (payload && extractId(ref) === target) {
          // Verify the *amount* by reading the receipt log values
          const transferred = await readTransferAmount(event.txHash, recipient);
          if (transferred >= BigInt(expectedAmount)) {
            return { event, payload };
          }
        }
      }
    }

    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 30_000);
    if (Date.now() > expiresAt) throw new Error('intent expired');
  }
}
```

**Match on the reference, not the amount.** A user could send any amount; the reference is what proves the transfer was made in response to *your* intent.

## Step 5 — server signs an EIP-712 receipt

```ts
// server/receipt.ts
import { privateKeyToAccount } from 'viem/accounts';
import { gnosis } from 'viem/chains';

const operator = privateKeyToAccount(process.env.OPERATOR_KEY as `0x${string}`);

const domain = {
  name: 'Trustpoll Receipts',
  version: '1',
  chainId: gnosis.id,
  verifyingContract: '0x...your-receipt-contract-or-zero-for-offchain',
} as const;

const types = {
  TicketReceipt: [
    { name: 'buyer', type: 'address' },
    { name: 'eventId', type: 'string' },
    { name: 'ticketTypeId', type: 'string' },
    { name: 'amount', type: 'uint256' },
    { name: 'paidAt', type: 'uint256' },
    { name: 'txHash', type: 'bytes32' },
  ],
} as const;

export async function signReceipt(input: {
  buyer: `0x${string}`; eventId: string; ticketTypeId: string;
  amount: bigint; paidAt: bigint; txHash: `0x${string}`;
}) {
  const signature = await operator.signTypedData({
    domain,
    types,
    primaryType: 'TicketReceipt',
    message: input,
  });
  return { ...input, signature };
}
```

Clients verify offline against the operator's known public address — no backend round-trip needed for re-validation.

## Step 6 — client polls status

```tsx
function useReceipt(intentId: string | null) {
  const [state, setState] = useState<{ status: 'pending' | 'ready' | 'expired'; receipt?: SignedReceipt }>({ status: 'pending' });

  useEffect(() => {
    if (!intentId) return;
    let cancel = false, delay = 2_000;

    const poll = async () => {
      while (!cancel) {
        const res = await fetch(`/api/intents/${intentId}/status`).then(r => r.json());
        if (res.status === 'ready') return setState(res);
        if (res.status === 'expired') return setState({ status: 'expired' });
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 1.5, 15_000);
      }
    };
    poll();
    return () => { cancel = true; };
  }, [intentId]);

  return state;
}
```

## Idempotency

The poller may see the same event twice across polling windows; the user may submit the same tx twice (rare with Safe but possible). Wrap fulfillment in a lock:

```ts
await withIntentLock(intentId, async () => {
  const current = await loadIntent(intentId);
  if (current.actionStatus === 'done') return;
  await fulfillAction(current);                   // mint NFT, unlock content, etc.
  await markActionDone(intentId);
});
```

Simplest backing store: a Postgres `intents` table with `PRIMARY KEY (id)` and `SELECT … FOR UPDATE` inside a transaction.

## Why this matters

This is the pattern recommended by the official [intermediate embedded mini-app guide](https://docs.aboutcircles.com/miniapps/embedded-mini-apps/intermediate-embedded-mini-app-guide.md). The on-chain transfer carries the intent; the backend confirms that the intent actually landed; the signed receipt is the proof the client uses for any subsequent privileged action. No tx-hash-to-user db lookup, no race conditions between front-end optimism and backend reality.
