import type { SupabaseClient } from "@supabase/supabase-js";

import type { MobileApiError } from "../../shared/api";
import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { reporter } from "../../shared/errors/reporter";
import { ensureSupabaseSession, toMobileError } from "./supabaseGenerationSession";

const shopPurchaseTimeoutMs = 15_000;

interface ShopPurchaseRpcRow {
  outcome: "purchased" | "insufficient_credits" | "unknown_item";
  balance: number;
}

export type SupabaseShopPurchaseOutcome =
  | { ok: true; serverBalance: number }
  | { ok: false; reason: "insufficient_balance"; serverBalance: number }
  | { ok: false; reason: "unknown_item" }
  | { ok: false; reason: "request_failed"; error: MobileApiError };

const isShopPurchaseRpcRow = (value: unknown): value is ShopPurchaseRpcRow => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Partial<ShopPurchaseRpcRow>;

  return (
    (row.outcome === "purchased" || row.outcome === "insufficient_credits" || row.outcome === "unknown_item") &&
    Number.isInteger(row.balance) &&
    typeof row.balance === "number" &&
    row.balance >= 0
  );
};

const requestFailed = (messageSafe: string): SupabaseShopPurchaseOutcome => ({
  ok: false,
  reason: "request_failed",
  error: toMobileError(0, "shop_purchase_failed", messageSafe, true)
});

/**
 * Shared RPC round-trip for both live-shop purchase RPCs
 * (purchase_inventory_item / purchase_theme_bundle, 0021_live_shop_purchases.sql)
 * -- both return the same (outcome, balance) shape, so only the RPC name and
 * params differ per caller below.
 */
const callShopPurchaseRpc = async (
  client: SupabaseClient,
  rpcName: "purchase_inventory_item" | "purchase_theme_bundle",
  params: Record<string, string>,
  failureMessageSafe: string,
  diagnosticContext: Record<string, unknown>
): Promise<SupabaseShopPurchaseOutcome> => {
  try {
    const session = await ensureSupabaseSession(client);

    if (!session.ok) {
      return { ok: false, reason: "request_failed", error: session.error };
    }

    const response = await withRequestTimeout(client.rpc(rpcName, params), shopPurchaseTimeoutMs);
    const row = Array.isArray(response.data) && response.data.length === 1 ? response.data[0] : null;

    if (response.error || !isShopPurchaseRpcRow(row)) {
      return requestFailed(failureMessageSafe);
    }

    if (row.outcome === "unknown_item") {
      return { ok: false, reason: "unknown_item" };
    }

    if (row.outcome === "insufficient_credits") {
      return { ok: false, reason: "insufficient_balance", serverBalance: row.balance };
    }

    return { ok: true, serverBalance: row.balance };
  } catch (cause) {
    reporter.captureMessage("shop: purchase failed", {
      cause: cause instanceof Error ? cause.message : String(cause),
      ...diagnosticContext
    });
    return requestFailed(failureMessageSafe);
  }
};

export const purchaseSupabaseInventoryItem = (
  client: SupabaseClient,
  itemId: string,
  requestId: string
): Promise<SupabaseShopPurchaseOutcome> =>
  callShopPurchaseRpc(
    client,
    "purchase_inventory_item",
    { p_item_id: itemId, p_request_id: requestId },
    "Could not complete that purchase yet. Try again.",
    { itemId, requestId }
  );

export const purchaseSupabaseThemeBundle = (
  client: SupabaseClient,
  bundleId: string,
  requestId: string
): Promise<SupabaseShopPurchaseOutcome> =>
  callShopPurchaseRpc(
    client,
    "purchase_theme_bundle",
    { p_bundle_id: bundleId, p_request_id: requestId },
    "Could not unlock that theme yet. Try again.",
    { bundleId, requestId }
  );
