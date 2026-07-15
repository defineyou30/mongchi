import type { SupabaseClient } from "@supabase/supabase-js";

import type { MobileApiError } from "../../shared/api";
import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { reporter } from "../../shared/errors/reporter";
import { ensureSupabaseSession, toMobileError } from "./supabaseGenerationSession";

const walkEarlyReturnTimeoutMs = 15_000;

interface WalkEarlyReturnRpcRow {
  outcome: "completed" | "insufficient_credits";
  balance: number;
  charged_credit: number;
}

export type SupabaseWalkEarlyReturnOutcome =
  | { ok: true; serverBalance: number }
  | { ok: false; reason: "insufficient_balance"; serverBalance: number }
  | { ok: false; reason: "request_failed"; error: MobileApiError };

const isWalkEarlyReturnRpcRow = (value: unknown): value is WalkEarlyReturnRpcRow => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Partial<WalkEarlyReturnRpcRow>;

  return (
    (row.outcome === "completed" || row.outcome === "insufficient_credits") &&
    Number.isInteger(row.balance) &&
    typeof row.balance === "number" &&
    row.balance >= 0 &&
    Number.isInteger(row.charged_credit) &&
    typeof row.charged_credit === "number" &&
    row.charged_credit >= 0
  );
};

const requestFailed = (): SupabaseWalkEarlyReturnOutcome => ({
  ok: false,
  reason: "request_failed",
  error: toMobileError(0, "walk_early_return_failed", "Could not bring your friend home yet. Try again.", true)
});

export const purchaseSupabaseWalkEarlyReturn = async (
  client: SupabaseClient,
  walkId: string
): Promise<SupabaseWalkEarlyReturnOutcome> => {
  try {
    const session = await ensureSupabaseSession(client);

    if (!session.ok) {
      return { ok: false, reason: "request_failed", error: session.error };
    }

    const response = await withRequestTimeout(
      client.rpc("purchase_walk_early_return", { p_walk_id: walkId }),
      walkEarlyReturnTimeoutMs
    );
    const row = Array.isArray(response.data) && response.data.length === 1 ? response.data[0] : null;

    if (response.error || !isWalkEarlyReturnRpcRow(row)) {
      return requestFailed();
    }

    if (row.outcome === "insufficient_credits") {
      return { ok: false, reason: "insufficient_balance", serverBalance: row.balance };
    }

    return { ok: true, serverBalance: row.balance };
  } catch (cause) {
    reporter.captureMessage("walk: early-return purchase failed", {
      cause: cause instanceof Error ? cause.message : String(cause),
      walkId
    });
    return requestFailed();
  }
};
