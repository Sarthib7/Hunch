# Standalone (QR / deep-link) mini-app flow

When your app runs **outside** the Circles host iframe — a kiosk, a booth, your own website, a TV screen — you can't use `@aboutcircles/miniapp-sdk`. Instead, hand off to the Gnosis App on the user's phone via a deep link, and detect completion by polling on-chain events.

## The deep-link URL scheme

```
https://app.gnosis.io/transfer/{recipientAddress}/crc?amount={amountCrc}&data={urlEncodedData}
```

| Param | Format | Example |
|---|---|---|
| `recipientAddress` | 0x-prefixed Safe address (path segment) | `0xabc…123` |
| `amount` | Human-readable CRC, decimal allowed | `12.5` |
| `data` | URL-encoded output of `encodeCrcV2TransferData` | `0x010001000b4352432d414243313233` |

Render the URL as a **QR code** (any library: `qrcode`, `react-qr-code`) for in-person scanning. The Gnosis App parses the URL, prompts the user to approve the CRC transfer with the embedded metadata, and broadcasts.

## Building the URL

```ts
import { encodeCrcV2TransferData } from '@aboutcircles/sdk-utils';

function buildPaymentUrl(input: {
  recipientAddress: string;
  amountCrc: string;
  reference: string;        // your unique intent id — what you'll match against later
}) {
  const encodedData = encodeCrcV2TransferData([input.reference], 0x0001);
  const dataParam = encodeURIComponent(encodedData);
  return `https://app.gnosis.io/transfer/${input.recipientAddress}/crc?amount=${input.amountCrc}&data=${dataParam}`;
}
```

Data type tags:
- `0x0001` — UTF-8 text references (one or more strings)
- `0x1001` — structured metadata + message (richer payload)

## Confirmation flow — pull, not push

There is **no callback URL, no webhook, no postMessage**. After the user signs in the Gnosis App, your app has to look for the transfer on-chain by polling:

```jsonc
POST https://rpc.circlesubi.network/
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "circles_events",
  "params": [
    "<recipientAddress>",
    null,                     // fromBlock (null = recent)
    null,                     // toBlock
    ["CrcV2_TransferData"]    // event filter
  ]
}
```

Poll with backoff (e.g., 2s / 5s / 10s / 20s, cap at 30s). The indexer is **eventually consistent** across:

```
approval → ERC-4337 bundle → on-chain inclusion → indexer ingestion
```

Total latency from user-approval to event-visible is usually 5–30 seconds. Show a "Waiting for confirmation…" UI; never block on a single fast poll.

## Decoding and matching

```ts
import { decodeCrcV2TransferData } from '@aboutcircles/sdk-utils';

for (const event of events) {
  const decoded = decodeCrcV2TransferData(event.data);
  // decoded.references is the string[] you passed into encodeCrcV2TransferData
  if (decoded.references.includes(myIntentId)) {
    // Found the matching transfer — verify amount via the receipt logs
    await verifyTransferAmount(event.txHash, expectedAmount);
    await runBusinessLogic();
    break;
  }
}
```

**Critical**: match on the **reference**, not on the amount alone. A user could send 12.5 CRC for an unrelated reason; the reference is what proves the transfer was for *your* intent.

## Idempotent post-confirmation

User may scan + approve + then scan again, or the indexer may surface the same event twice across polling windows. Wrap business logic in a lock:

```ts
await withIntentLock(intentId, async () => {
  const current = await loadIntent(intentId);
  if (current.actionStatus === 'done') return;     // already handled
  await performBusinessAction(current);             // mint ticket, mark paid, etc.
  await markActionDone(intentId);
});
```

A naive impl: a Postgres `intents` table with `id PRIMARY KEY` and `action_status` column, with the lock being a `SELECT … FOR UPDATE` inside a transaction. Or an in-memory `Map<string, Promise>` for low-volume single-process services.

## End-to-end skeleton

```ts
// server/routes.ts
export async function createCheckout(req: Req, res: Res) {
  const intent = {
    id: nanoid(),
    recipientAddress: process.env.MERCHANT_SAFE!,
    amountCrc: req.body.amountCrc,
    productId: req.body.productId,
    expiresAt: Date.now() + 10 * 60_000,
  };
  await saveIntent(intent);

  const url = buildPaymentUrl({
    recipientAddress: intent.recipientAddress,
    amountCrc: intent.amountCrc,
    reference: intent.id,
  });

  res.json({ intentId: intent.id, qrUrl: url });
}

// client/Checkout.tsx
async function pollUntilConfirmed(intentId: string) {
  let delay = 2_000;
  while (true) {
    const res = await fetch(`/api/intents/${intentId}/status`).then(r => r.json());
    if (res.status === 'paid') return res;
    if (res.status === 'expired') throw new Error('expired');
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 30_000);
  }
}

// server/poller.ts (cron or worker)
async function checkOpenIntents() {
  const open = await getOpenIntents();
  const eventsByRecipient = await fetchEventsForRecipients(open.map(i => i.recipientAddress));
  for (const intent of open) {
    const match = eventsByRecipient[intent.recipientAddress]
      ?.flatMap(e => decodeCrcV2TransferData(e.data).references.map(r => ({ e, r })))
      .find(({ r }) => r === intent.id);
    if (match) {
      await withIntentLock(intent.id, async () => {
        if ((await loadIntent(intent.id)).actionStatus === 'done') return;
        await markPaid(intent.id, match.e.txHash);
        await fulfill(intent);
      });
    }
  }
}
```

## When NOT to use standalone

- The app needs identity / a persistent session — use embedded so you can call `signMessage`.
- The app needs to fire multiple txs in sequence — embedded's `sendTransactions` batches; standalone forces one QR per tx.
- You want to be in the marketplace and benefit from in-app discovery / activity scoring — embedded is required for `"category": "miniapp"`.

QR is great for: ticket booths, merch checkout, donation jars, vending-machine-style flows, on-site events.

## Reference impl

[`aboutcircles/circles-gnosisApp-starter-kit`](https://github.com/aboutcircles/circles-gnosisApp-starter-kit) and [`aboutcircles/merch-shop-miniapp`](https://github.com/aboutcircles/merch-shop-miniapp) are the canonical standalone references.
