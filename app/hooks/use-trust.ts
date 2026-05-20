"use client";

import { useEffect, useState } from "react";

import { getTrustStatus } from "@/lib/circles/trust";

/**
 * The current avatar's vote eligibility (the Sybil gate).
 * Returns `null` while checking, then `true`/`false` — fails closed to `false`.
 */
export function useTrust(address: string | null): boolean | null {
  const [result, setResult] = useState<{
    address: string | null;
    verified: boolean | null;
  }>({ address: null, verified: null });

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getTrustStatus(address)
      .then((status) => {
        if (!cancelled) setResult({ address, verified: status.verified });
      })
      .catch(() => {
        if (!cancelled) setResult({ address, verified: false });
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // The result counts only if it's for the address being asked about right now;
  // otherwise we're still checking (or the address just changed).
  return result.address === address ? result.verified : null;
}
