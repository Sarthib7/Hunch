// Trust verification — Hunch's Sybil firewall.
//
// An avatar may vote if it is "trust-verified". It qualifies in either of two
// ways:
//   1. The Hunch pool trusts it on-chain (Hub v2 `isTrusted`). This is the
//      authoritative voter registry — scripts/trust-voters.mjs adds the edges.
//   2. At least TRUST_THRESHOLD other avatars trust it on the Circles graph.
//
// Why both: the Circles indexer's `trustStats.trustedByCount` does not reflect
// trust edges from an Organisation avatar, and the pool IS an Organisation — so
// the pool's own trust never appears in that count. The on-chain `isTrusted`
// check is the reliable signal for the curated demo crowd; the indexer count
// keeps genuine community trust meaningful. See docs/adr/0003.

import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";

import { HUB_V2_ADDRESS, isTrustedAbi } from "./hub";

/** Minimum incoming community-trust edges for an avatar to count as verified. */
export const TRUST_THRESHOLD = 1;

/** Circles indexer JSON-RPC endpoint — also serves Gnosis `eth_call`. */
const CIRCLES_RPC = "https://rpc.aboutcircles.com/";

/** The Hunch staking-pool Organisation avatar. */
const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS;

/** Read-only Gnosis client for on-chain trust lookups. */
const gnosisClient = createPublicClient({
  chain: gnosis,
  transport: http(CIRCLES_RPC),
});

export interface TrustStatus {
  address: string;
  /** Incoming community-trust edges, per the Circles indexer. */
  trustedBy: number;
  /** Whether the Hunch pool has trusted this avatar on-chain. */
  poolTrusted: boolean;
  /** Whether this is a registered Circles avatar at all. */
  registered: boolean;
  /** Whether this avatar may vote. */
  verified: boolean;
}

interface ProfileViewResult {
  avatarInfo?: unknown;
  // The indexer returns trust counts as `trustsCount` / `trustedByCount`.
  trustStats?: { trustsCount?: number; trustedByCount?: number };
}

/** True if the Hunch pool trusts `address` on the Circles Hub (on-chain). */
async function poolTrusts(address: string): Promise<boolean> {
  if (!POOL_ADDRESS) return false;
  try {
    return await gnosisClient.readContract({
      address: HUB_V2_ADDRESS,
      abi: isTrustedAbi,
      functionName: "isTrusted",
      args: [POOL_ADDRESS as `0x${string}`, address as `0x${string}`],
    });
  } catch {
    return false;
  }
}

/** Community-trust standing + registration, from the Circles indexer. */
async function getCommunityTrust(
  address: string,
): Promise<{ trustedBy: number; registered: boolean }> {
  try {
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
    if (!res.ok) return { trustedBy: 0, registered: false };
    const json = (await res.json()) as {
      result?: ProfileViewResult;
      error?: unknown;
    };
    if (json.error || !json.result) {
      return { trustedBy: 0, registered: false };
    }
    return {
      trustedBy: json.result.trustStats?.trustedByCount ?? 0,
      registered: Boolean(json.result.avatarInfo),
    };
  } catch {
    return { trustedBy: 0, registered: false };
  }
}

/**
 * Look up an avatar's vote eligibility on Hunch.
 * Fails closed: an avatar that cannot be checked is treated as unverified.
 */
export async function getTrustStatus(address: string): Promise<TrustStatus> {
  const [poolTrusted, community] = await Promise.all([
    poolTrusts(address),
    getCommunityTrust(address),
  ]);
  return {
    address,
    trustedBy: community.trustedBy,
    poolTrusted,
    registered: community.registered || poolTrusted,
    verified: poolTrusted || community.trustedBy >= TRUST_THRESHOLD,
  };
}
