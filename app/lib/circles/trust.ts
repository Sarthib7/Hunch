// Trust verification — Quorum's Sybil firewall.
//
// An avatar may vote only if it is "trust-verified": at least TRUST_THRESHOLD
// other avatars trust it on the Circles graph (incoming trust edges). v1 uses
// a deliberately low threshold of 1 — see PRD.md §4. The Circles trust graph
// IS the voter registry; this module is the gate.

/** Minimum incoming trust edges for an avatar to count as a verified voter. */
export const TRUST_THRESHOLD = 1;

/** Circles indexer JSON-RPC endpoint (Gnosis Chain mainnet). */
const CIRCLES_RPC = "https://rpc.aboutcircles.com/";

export interface TrustStatus {
  address: string;
  /** Incoming trust edges — how many avatars trust this one. */
  trustedBy: number;
  /** Whether this is a registered Circles avatar at all. */
  registered: boolean;
  /** Whether this avatar may vote (trustedBy >= TRUST_THRESHOLD). */
  verified: boolean;
}

interface ProfileViewResult {
  avatarInfo?: unknown;
  // The indexer returns trust counts as `trustsCount` / `trustedByCount`
  // (confirmed against the live RPC and the boilerplate's ProfileLookup).
  trustStats?: { trustsCount?: number; trustedByCount?: number };
}

/**
 * Look up an avatar's trust standing on the Circles graph.
 * Throws on network / RPC failure — callers should fail closed
 * (treat an un-checkable address as unverified).
 */
export async function getTrustStatus(address: string): Promise<TrustStatus> {
  const res = await fetch(CIRCLES_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "circles_getProfileView",
      params: [address],
    }),
  });

  if (!res.ok) {
    throw new Error(`Circles RPC returned ${res.status} for ${address}`);
  }

  const json = (await res.json()) as {
    result?: ProfileViewResult;
    error?: { message?: string };
  };
  if (json.error) {
    throw new Error(
      `Circles RPC error for ${address}: ${json.error.message ?? "unknown"}`,
    );
  }

  const trustedBy = json.result?.trustStats?.trustedByCount ?? 0;
  return {
    address,
    trustedBy,
    registered: Boolean(json.result?.avatarInfo),
    verified: trustedBy >= TRUST_THRESHOLD,
  };
}
