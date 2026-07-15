import type { SupabaseClient } from "@supabase/supabase-js";

import type { MobileApiError } from "../../shared/api";
import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { reporter } from "../../shared/errors/reporter";
import { ensureSupabaseSession, toMobileError } from "./supabaseGenerationSession";

const rewardClaimTimeoutMs = 15_000;

interface RewardClaimRpcRow {
  outcome: "granted" | "already_claimed" | "unknown_reward";
  balance: number;
}

export type SupabaseRewardClaimOutcome =
  | { ok: true; outcome: "granted" | "already_claimed"; serverBalance: number }
  | { ok: false; reason: "unknown_reward" }
  | { ok: false; reason: "request_failed"; error: MobileApiError };

const isRewardClaimRpcRow = (value: unknown): value is RewardClaimRpcRow => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Partial<RewardClaimRpcRow>;

  return (
    (row.outcome === "granted" || row.outcome === "already_claimed" || row.outcome === "unknown_reward") &&
    Number.isInteger(row.balance) &&
    typeof row.balance === "number" &&
    row.balance >= 0
  );
};

/**
 * Claims a fixed-amount credit reward (settlement mission, care-streak
 * milestone, monthly letter, walk journal completion, or bond level) via
 * claim_credit_reward (0023_credit_reward_claims.sql). The server owns the
 * reward whitelist and the amount -- this only ever passes the reward key,
 * never a client-supplied amount. Idempotent server-side: a rewardKey
 * already claimed by this user comes back as "already_claimed" (not an
 * error), so callers can safely retry without double-crediting.
 */
export const claimSupabaseCreditReward = async (
  client: SupabaseClient,
  rewardKey: string
): Promise<SupabaseRewardClaimOutcome> => {
  try {
    const session = await ensureSupabaseSession(client);

    if (!session.ok) {
      return { ok: false, reason: "request_failed", error: session.error };
    }

    const response = await withRequestTimeout(
      client.rpc("claim_credit_reward", { p_reward_key: rewardKey }),
      rewardClaimTimeoutMs
    );
    const row = Array.isArray(response.data) && response.data.length === 1 ? response.data[0] : null;

    if (response.error || !isRewardClaimRpcRow(row)) {
      return {
        ok: false,
        reason: "request_failed",
        error: toMobileError(0, "reward_claim_failed", "Could not claim that reward yet. Try again.", true)
      };
    }

    if (row.outcome === "unknown_reward") {
      return { ok: false, reason: "unknown_reward" };
    }

    return { ok: true, outcome: row.outcome, serverBalance: row.balance };
  } catch (cause) {
    reporter.captureMessage("reward: claim failed", {
      cause: cause instanceof Error ? cause.message : String(cause),
      rewardKey
    });

    return {
      ok: false,
      reason: "request_failed",
      error: toMobileError(0, "reward_claim_failed", "Could not claim that reward yet. Try again.", true)
    };
  }
};
