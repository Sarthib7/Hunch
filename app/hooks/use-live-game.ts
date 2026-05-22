"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];
type VoteRow = Database["public"]["Tables"]["votes"]["Row"];

export type LiveGame =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "error"; message: string }
  | { phase: "ready"; game: GameRow; round: RoundRow | null; votes: VoteRow[] };

/**
 * Streams the current game, its open round, and the live vote tally.
 * Any Realtime change to games / rounds / votes triggers a full refetch —
 * the dataset is tiny, so re-reading is simpler and safer than merging events.
 */
export function useLiveGame(): { live: LiveGame; refetch: () => void } {
  const [live, setLive] = useState<LiveGame>({ phase: "loading" });

  const refetch = useCallback(async () => {
    try {
      const { data: game, error: gameErr } = await supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (gameErr) throw gameErr;
      if (!game) {
        setLive({ phase: "empty" });
        return;
      }

      const { data: round, error: roundErr } = await supabase
        .from("rounds")
        .select("*")
        .eq("game_id", game.id)
        .eq("status", "open")
        .maybeSingle();
      if (roundErr) throw roundErr;

      let votes: VoteRow[] = [];
      if (round) {
        const { data: voteRows, error: voteErr } = await supabase
          .from("votes")
          .select("*")
          .eq("round_id", round.id);
        if (voteErr) throw voteErr;
        votes = voteRows ?? [];
      }

      setLive({ phase: "ready", game, round: round ?? null, votes });
    } catch (err) {
      setLive({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to load the game",
      });
    }
  }, []);

  useEffect(() => {
    // Initial load — refetch() is async (its setState runs after an await),
    // not the synchronous render cascade the lint rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
    const channel = supabase
      .channel("hunch-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => {
          refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds" },
        () => {
          refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => {
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { live, refetch };
}
