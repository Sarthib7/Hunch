"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

/**
 * Per-voter cooldown duration, mirrored from the server's VOTER_COOLDOWN_MS.
 * NEXT_PUBLIC_HUNCH_VOTER_COOLDOWN_MS keeps the client and server in sync
 * when the env override is set; otherwise the 1-hour default holds.
 */
const COOLDOWN_MS = Number(
  process.env.NEXT_PUBLIC_HUNCH_VOTER_COOLDOWN_MS ?? 60 * 60 * 1000,
);

export interface VoterCooldown {
  /** True while the voter is in cooldown (server would reject another vote). */
  inCooldown: boolean;
  /** ms until the cooldown lifts; 0 when not in cooldown. */
  msRemaining: number;
  /** Total cooldown window (for progress UIs). */
  totalMs: number;
}

/**
 * Reactive cooldown for the connected voter. Reads the voter's most recent
 * recorded vote, subscribes to vote inserts to refresh, and ticks every
 * second so the countdown renders smoothly.
 *
 * Address-change edge case: when `address` flips between two connected
 * accounts, the previously-loaded `lastVoteAt` lingers for one render until
 * `refetch` completes against the new address — acceptable since a Circles
 * host rarely hot-swaps accounts.
 */
export function useVoterCooldown(address: string | null): VoterCooldown {
  const [lastVoteAt, setLastVoteAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refetch = useCallback(async () => {
    if (!address) return;
    const { data } = await supabase
      .from("votes")
      .select("created_at")
      .ilike("voter", address.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastVoteAt(data ? new Date(data.created_at).getTime() : null);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    // refetch's setState runs after an await — not a synchronous cascading
    // render, so the react-hooks/set-state-in-effect rule's concern doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
    const channel = supabase
      .channel(`voter-cooldown-${address}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes" },
        () => {
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [address, refetch]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!address || COOLDOWN_MS <= 0 || lastVoteAt === null) {
    return { inCooldown: false, msRemaining: 0, totalMs: COOLDOWN_MS };
  }
  const expiresAt = lastVoteAt + COOLDOWN_MS;
  const msRemaining = Math.max(0, expiresAt - now);
  return {
    inCooldown: msRemaining > 0,
    msRemaining,
    totalMs: COOLDOWN_MS,
  };
}

/** Format a ms duration as "Hh Mm" or "M:SS" (mirrors the prior Countdown style). */
export function formatCooldown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
