import "server-only";

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
} from "viem";
import { gnosis } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import { HUB_V2_ADDRESS, safeTransferFromAbi, toTokenId } from "@/lib/circles/hub";
import { supabaseAdmin } from "@/lib/supabase/server";

// Same group whose CRC voters staked — payouts go back in the same denomination,
// which is safe because (a) the pool already holds it, (b) voters trust it (they
// held its token to stake), so the Hub's rule-of-trust check passes.
const STAKE_GROUP = "0xC19BC204eb1c1D5B3FE500E5E5dfaBaB625F286c";

const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS;
const CIRCLES_RPC = "https://rpc.aboutcircles.com/";
const ATTO = 10n ** 18n;

/** Cap how many rows we attempt per cron tick — keeps long pending queues from blowing the function timeout. */
const PAYOUT_BATCH_LIMIT = 20;

const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(CIRCLES_RPC),
});

/**
 * Insert pending payout rows for every distinct voter in a crowd_won game.
 * Equal split: floor(pool_crc / N). Idempotent — re-runs skip existing rows
 * via the (game_id, voter) primary key.
 */
export async function initiatePayouts(gameId: string): Promise<number> {
  const db = supabaseAdmin();

  const { data: game } = await db
    .from("games")
    .select("status, pool_crc")
    .eq("id", gameId)
    .maybeSingle();
  if (!game || game.status !== "crowd_won") return 0;

  // Get this game's rounds, then the voters across those rounds. Two queries
  // because supabase-js's inner-join filter syntax is brittle compared to
  // straightforward .in().
  const { data: rounds } = await db
    .from("rounds")
    .select("id")
    .eq("game_id", gameId);
  if (!rounds || rounds.length === 0) return 0;
  const roundIds = rounds.map((r) => r.id);

  const { data: voteRows } = await db
    .from("votes")
    .select("voter")
    .in("round_id", roundIds);
  if (!voteRows || voteRows.length === 0) return 0;

  const uniqueVoters = [...new Set(voteRows.map((v) => v.voter.toLowerCase()))];
  const share = Math.floor(Number(game.pool_crc) / uniqueVoters.length);
  if (share <= 0) return 0;

  const rows = uniqueVoters.map((voter) => ({
    game_id: gameId,
    voter,
    amount_crc: share,
    status: "pending",
  }));

  // Upsert with ignoreDuplicates — re-running this for the same game is a
  // no-op, never overwrites a sent payout's status back to pending.
  const { error } = await db
    .from("payouts")
    .upsert(rows, {
      onConflict: "game_id,voter",
      ignoreDuplicates: true,
    });
  if (error) {
    console.error("initiatePayouts insert failed:", error.message);
    return 0;
  }
  return uniqueVoters.length;
}

export interface ExecuteResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Send any pending payouts. Requires POOL_PAYOUT_KEY in the env (the same
 * private key as POOL_DEPLOYER_KEY — it controls the pool avatar). Without
 * it, payouts sit pending and the operator can run a manual script.
 *
 * Idempotent: status is flipped to 'sent' (with tx_hash) or 'failed' as
 * each row is processed. Crash-safe: a row left in 'pending' after a crash
 * just gets retried on the next tick.
 */
export async function executePendingPayouts(): Promise<ExecuteResult> {
  const key = process.env.POOL_PAYOUT_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return { sent: 0, failed: 0, skipped: 0 };
  }
  if (!POOL_ADDRESS) return { sent: 0, failed: 0, skipped: 0 };

  const db = supabaseAdmin();
  const { data: pending } = await db
    .from("payouts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(PAYOUT_BATCH_LIMIT);
  if (!pending || pending.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const account = privateKeyToAccount(key as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: gnosis,
    transport: http(CIRCLES_RPC),
  });

  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    const data = encodeFunctionData({
      abi: safeTransferFromAbi,
      functionName: "safeTransferFrom",
      args: [
        POOL_ADDRESS as `0x${string}`,
        row.voter as `0x${string}`,
        toTokenId(STAKE_GROUP),
        BigInt(row.amount_crc) * ATTO,
        "0x",
      ],
    });

    try {
      const hash = await wallet.sendTransaction({
        to: HUB_V2_ADDRESS as `0x${string}`,
        data,
      });
      // Wait briefly for inclusion so failed sends surface here (not silently
      // succeed and then revert). 30s is generous for Gnosis Chain.
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 30_000,
      });
      if (receipt.status !== "success") {
        throw new Error(`tx reverted: ${hash}`);
      }
      await db
        .from("payouts")
        .update({
          status: "sent",
          tx_hash: hash,
          attempted_at: new Date().toISOString(),
        })
        .eq("game_id", row.game_id)
        .eq("voter", row.voter);
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`payout to ${row.voter} failed:`, msg);
      await db
        .from("payouts")
        .update({
          status: "failed",
          attempted_at: new Date().toISOString(),
        })
        .eq("game_id", row.game_id)
        .eq("voter", row.voter);
      failed += 1;
    }
  }
  return { sent, failed, skipped: 0 };
}
