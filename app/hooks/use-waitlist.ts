"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

export type WaitlistState = "loading" | "off-list" | "on-list" | "trusted";

export interface WaitlistStatus {
  state: WaitlistState;
  /** Refresh the status; useful after a fresh POST /api/waitlist. */
  refetch: () => void;
}

/**
 * Reactive waitlist status for a given address. Reads the matching row and
 * subscribes to changes on it (so the UI flips the moment the operator
 * marks the entry as trusted, or the moment the visitor submits).
 */
export function useWaitlist(address: string | null): WaitlistStatus {
  const [state, setState] = useState<WaitlistState>("loading");

  const refetch = useCallback(async () => {
    if (!address) {
      setState("off-list");
      return;
    }
    const lower = address.toLowerCase();
    const { data, error } = await supabase
      .from("waitlist")
      .select("trusted")
      .eq("address", lower)
      .maybeSingle();
    // If the table doesn't exist yet (pre-migration), default to off-list so
    // the user still sees the join button (the POST will surface the real
    // error if they click it).
    if (error || !data) {
      setState("off-list");
      return;
    }
    setState(data.trusted ? "trusted" : "on-list");
  }, [address]);

  useEffect(() => {
    if (!address) return;
    // refetch's setState fires after an await — not a sync cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
    const lower = address.toLowerCase();
    const channel = supabase
      .channel(`waitlist-${lower}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waitlist",
          filter: `address=eq.${lower}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [address, refetch]);

  return { state, refetch };
}
