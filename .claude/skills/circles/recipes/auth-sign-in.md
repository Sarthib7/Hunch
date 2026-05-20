# Recipe: sign-in with Safe message signing (EIP-1271)

Goal: prove the user controls the Safe address the host injected, and issue a session.

## Client — request the signature

```tsx
'use client';
import { signMessage } from '@aboutcircles/miniapp-sdk';
import { useWallet } from '@/hooks/use-wallet';

export function SignInButton() {
  const { address } = useWallet();

  const handleSignIn = async () => {
    if (!address) return;

    // 1. Get a nonce from the server (prevents replay attacks)
    const { nonce } = await fetch('/api/auth/nonce', { method: 'POST' }).then(r => r.json());

    // 2. Construct a SIWE-style message
    const message = [
      'Sign in to Trustpoll',
      `Address: ${address}`,
      `Nonce: ${nonce}`,
      `Issued: ${new Date().toISOString()}`,
    ].join('\n');

    // 3. Ask the host to sign with the Safe
    const { signature, verified } = await signMessage(message);
    // `verified` is the host's pre-validation. Re-verify server-side.

    // 4. Send to backend for verification + session cookie
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, message, signature, signatureType: 'erc1271' }),
    });
    if (!res.ok) throw new Error('sign-in failed');
  };

  return <button onClick={handleSignIn} disabled={!address}>Sign in with Circles</button>;
}
```

**Why store `signatureType`?** The host hashes the message differently for `'erc1271'` (default — EIP-191 prefix-hashed) vs `'raw'` (raw UTF-8 bytes). The verifier needs to know which input to pass to `isValidSignature`. Persist it.

## Server — verify against the Safe (EIP-1271)

```ts
// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, hashMessage, getAddress } from 'viem';
import { gnosis } from 'viem/chains';
import { redis } from '@/lib/redis';
import { sealSession } from '@/lib/session';

const client = createPublicClient({ chain: gnosis, transport: http() });

const EIP1271_MAGIC_VALUE = '0x1626ba7e' as const;

export async function POST(req: NextRequest) {
  const { address, message, signature, signatureType } = await req.json();

  // 1. Re-derive the nonce from the message and check it
  const nonce = /Nonce: (\S+)/.exec(message)?.[1];
  if (!nonce) return NextResponse.json({ error: 'no nonce' }, { status: 400 });
  const consumed = await redis.set(`nonce:${nonce}`, '1', { NX: true, EX: 300 });
  if (!consumed) return NextResponse.json({ error: 'nonce reused' }, { status: 400 });

  // 2. Compute the hash that the host signed
  //    - 'erc1271': host EIP-191-prefixed the message, then put the hash in SafeMessage.message
  //    - 'raw': host used raw UTF-8 bytes
  const hashToCheck =
    signatureType === 'raw'
      ? new TextEncoder().encode(message)  // raw bytes
      : hashMessage(message);              // EIP-191 prefix hash

  // 3. Call isValidSignature on the Safe contract
  const result = await client.readContract({
    address: getAddress(address),
    abi: [{
      name: 'isValidSignature',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'hash', type: 'bytes32' },
        { name: 'signature', type: 'bytes' },
      ],
      outputs: [{ type: 'bytes4' }],
    }],
    functionName: 'isValidSignature',
    args: [hashToCheck as `0x${string}`, signature as `0x${string}`],
  });

  if (result !== EIP1271_MAGIC_VALUE) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  // 4. Issue a session
  const session = await sealSession({ address, issuedAt: Date.now() });
  return NextResponse.json({ ok: true }, {
    headers: { 'Set-Cookie': `session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax` },
  });
}
```

`0x1626ba7e` is the EIP-1271 magic return value indicating "valid signature." Anything else (including a revert) means invalid.

## Nonce endpoint

```ts
// app/api/auth/nonce/route.ts
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { redis } from '@/lib/redis';

export async function POST() {
  const nonce = randomBytes(16).toString('hex');
  // Pre-register the nonce as unconsumed; the verify route will SET-NX it
  return NextResponse.json({ nonce });
}
```

(For simpler apps without Redis, store consumed nonces in Postgres with a `UNIQUE` constraint and a TTL cron, or skip nonce reuse protection if the session itself is short-lived.)

## Why not just trust `verified` from the client?

The `verified` field returned by `signMessage` is the **host's own pre-validation** — useful for snappy client UI but not authoritative. Always re-verify server-side before issuing any session token or privileged action.

## Common pitfalls

- **Calling `ecrecover` instead of `isValidSignature`** — the Safe is a smart contract, not an EOA. `ecrecover` will silently return a random address that doesn't match.
- **Forgetting to URL-decode the signature on the server** — depends on transport; JSON POST is fine, query-string isn't.
- **Reusing a single global nonce** — replayable across users. One-shot, per-attempt nonces only.
- **Verifying against `address` from the client** without checking it matches the wallet — the client controls all request fields; the *signature* binds them. If the signature verifies for `address`, you've confirmed `address`. The client could lie about which Safe to check; the signature check is what makes that lie costly.
