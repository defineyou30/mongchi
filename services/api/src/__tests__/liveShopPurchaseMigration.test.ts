import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { starterCreditItemPrices, themeBundles } from "@mongchi/shared";

// Client/server price parity (live shop, supabase/migrations/
// 0021_live_shop_purchases.sql) -- guards against the client
// (packages/shared/src/domain/wallet.ts and themeBundles.ts) and the server
// RPC's hardcoded price map ever drifting apart, since the server never
// trusts a client-supplied price. Lives here (not packages/shared) because
// reading the migration file needs Node's fs, and packages/shared is
// deliberately kept platform-agnostic (no Node-only dependencies) since it
// also ships to the React Native mobile app.
const migrationSqlPath = resolve(new URL("../../../../supabase/migrations/0021_live_shop_purchases.sql", import.meta.url).pathname);
const migrationSql = readFileSync(migrationSqlPath, "utf-8");

// item_stepping_stone_path is the one documented exception to the flat
// treat/drink=2, toy/bed=5 pricing pass -- see wallet.ts's own comment. It is
// retired from the mobile shop's UI and priced in wallet.ts only for
// services/api's legacy purchaseInventoryItem tests, so the live-shop RPC's
// price map deliberately has no entry for it (falls through to
// 'unknown_item' if ever requested).
const LIVE_SHOP_EXCLUDED_ITEM_IDS = new Set(["item_stepping_stone_path"]);

describe("live shop price parity (client wallet.ts/themeBundles.ts vs 0021_live_shop_purchases.sql)", () => {
  it("the migration's item price map matches wallet.ts's price for every non-excluded item", () => {
    for (const price of starterCreditItemPrices) {
      if (LIVE_SHOP_EXCLUDED_ITEM_IDS.has(price.itemId)) {
        continue;
      }

      const match = migrationSql.match(new RegExp(`WHEN '${price.itemId}' THEN (\\d+)`));

      expect(match, `expected ${price.itemId} to appear in purchase_inventory_item's price map`).toBeTruthy();
      expect(Number(match?.[1])).toBe(price.creditCost);
    }
  });

  it("the migration's price map has no items beyond wallet.ts's non-excluded catalog", () => {
    const migrationItemIds = [...migrationSql.matchAll(/WHEN '(item_[a-z0-9_]+)' THEN \d+/g)].map((entry) => entry[1]);
    const expectedItemIds = starterCreditItemPrices
      .map((price) => price.itemId)
      .filter((itemId) => !LIVE_SHOP_EXCLUDED_ITEM_IDS.has(itemId));

    expect(new Set(migrationItemIds)).toEqual(new Set(expectedItemIds));
  });

  it("explicitly excludes item_stepping_stone_path from the live-shop RPC's price map", () => {
    expect(migrationSql).not.toContain("WHEN 'item_stepping_stone_path'");
  });

  it("every theme bundle is present in the migration's whitelist at the flat 18-credit price", () => {
    for (const bundle of themeBundles) {
      expect(bundle.creditCost).toBe(18);
      expect(migrationSql).toContain(`'${bundle.id}'`);
    }

    expect(migrationSql).toContain("v_cost CONSTANT INTEGER := 18;");
  });
});

describe("live shop RPC structure (0021_live_shop_purchases.sql mirrors 0019_walk_early_return.sql)", () => {
  it("both RPCs pass p_request_id through to consume_credits as the idempotency ref_id", () => {
    const purchaseInventoryBody = migrationSql.split("CREATE OR REPLACE FUNCTION public.purchase_theme_bundle")[0]!;
    const purchaseThemeBody = migrationSql.split("CREATE OR REPLACE FUNCTION public.purchase_theme_bundle")[1]!;

    expect(purchaseInventoryBody).toMatch(/consume_credits\(\s*v_user,\s*v_cost,\s*'consume_shop_item',\s*'inventory_item',\s*p_request_id,/);
    expect(purchaseThemeBody).toMatch(/consume_credits\(\s*v_user,\s*v_cost,\s*'consume_theme_bundle',\s*'theme_bundle',\s*p_request_id,/);
  });

  it("both RPCs take an advisory lock keyed by the request id before charging, like purchase_walk_early_return", () => {
    expect(migrationSql).toContain("pg_advisory_xact_lock(hashtext('shop-item:' || v_user::TEXT || ':' || p_request_id))");
    expect(migrationSql).toContain("pg_advisory_xact_lock(hashtext('shop-theme:' || v_user::TEXT || ':' || p_request_id))");
  });

  it("both RPCs require authentication and are only granted to the authenticated role (0019's direct-RPC pattern)", () => {
    expect(migrationSql).toContain("v_user UUID := auth.uid();");
    expect(migrationSql).toMatch(/RAISE EXCEPTION 'purchase_inventory_item: authentication required'/);
    expect(migrationSql).toMatch(/RAISE EXCEPTION 'purchase_theme_bundle: authentication required'/);
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.purchase_inventory_item(TEXT, TEXT) TO authenticated;");
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.purchase_theme_bundle(TEXT, TEXT) TO authenticated;");
  });
});
