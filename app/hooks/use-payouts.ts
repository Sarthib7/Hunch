"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type PayoutRow = Database["public"]["Tables"]["payouts"]["Row"];

export interface PayoutSummary {
  rows: PayoutRow[];
  sent: number;
  pending: number;
  failed: number;
  total: number;
  loaded: boolean;
}

/**
 * Reactive payout summary for a finished game. Reads all payout rows for the
 * game and subscribes to changes so progress ("3 / 6 voters paid") flips
 * live as the cron processes each one.
 */
export function usePayouts(gameId: string | null): PayoutSummary {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from("payouts")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true });
    setRows(data ?? []);
    setLoaded(true);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    // refetch's setState fires after an await — not a sync cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
    const channel = supabase
      .channel(`payouts-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payouts",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, refetch]);

  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  return {
    rows,
    sent,
    pending,
    failed,
    total: rows.length,
    loaded,
  };
}
