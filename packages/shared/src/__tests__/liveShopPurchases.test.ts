import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  createInitialPrototypeSession,
  getActivePetBundle,
  recordCreditItemPurchase,
  recordThemeBundlePurchase,
  starterCreditItemPrices,
  themeBundles
} from "../index";

const now = "2026-06-24T09:00:00.000Z";
const active = getActivePetBundle;

describe("recordCreditItemPurchase (server-authoritative live-shop purchase)", () => {
  it("grants one unit of the item WITHOUT touching the wallet", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const walletBefore = state.wallet;

    const result = recordCreditItemPurchase(state, "item_bone_biscuit", "2026-06-24T09:05:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    // The whole point of this function: credits were already debited
    // server-side (consume_credits via purchase_inventory_item) before this
    // is ever reached, so it must never spend the local wallet.
    expect(result.state.wallet).toEqual(walletBefore);
    const entry = result.state.inventory.items.find((item) => item.itemId === "item_bone_biscuit");
    expect(entry?.quantity).toBe(1);
    expect(entry?.source).toBe("purchase");
  });

  it("stacks quantity on a second grant of the same item", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    const first = recordCreditItemPurchase(state, "item_bone_biscuit", "2026-06-24T09:05:00.000Z");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = recordCreditItemPurchase(first.state, "item_bone_biscuit", "2026-06-24T09:06:00.000Z");
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    const entry = second.state.inventory.items.find((item) => item.itemId === "item_bone_biscuit");
    expect(entry?.quantity).toBe(2);
  });

  it("returns item_not_found for an item outside the credit catalog, leaving state untouched", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    const result = recordCreditItemPurchase(state, "item_does_not_exist", now);

    expect(result).toEqual({ ok: false, reason: "item_not_found" });
  });
});

describe("recordThemeBundlePurchase (server-authoritative live-shop purchase)", () => {
  it("grants ownership and applies the theme WITHOUT touching the wallet", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const walletBefore = state.wallet;
    const bundle = themeBundles[0]!;

    const result = recordThemeBundlePurchase(state, bundle.id, "2026-06-24T09:05:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.alreadyOwned).toBe(false);
    expect(result.state.wallet).toEqual(walletBefore);
    expect(result.state.inventory.selectedTerrariumThemeId).toBe(bundle.themeId);
    expect(result.state.inventory.ownedThemeIds).toContain(bundle.themeId);
    expect(active(result.state).currentReaction).toBeTruthy();
  });

  it("re-applying an already-owned theme reports alreadyOwned and never touches the wallet", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const bundle = themeBundles[0]!;

    const first = recordThemeBundlePurchase(state, bundle.id, "2026-06-24T09:05:00.000Z");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = recordThemeBundlePurchase(first.state, bundle.id, "2026-06-24T09:06:00.000Z");
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(second.alreadyOwned).toBe(true);
    expect(second.state.wallet).toEqual(state.wallet);
    // Ownership list is not duplicated by re-recording an owned theme.
    expect(second.state.inventory.ownedThemeIds.filter((id) => id === bundle.themeId)).toHaveLength(1);
  });

  it("returns bundle_not_found for an unknown bundle id, leaving state untouched", () => {
    const state = createInitialPrototypeSession(now);

    const result = recordThemeBundlePurchase(state, "bundle_missing", now);

    expect(result).toEqual({ ok: false, reason: "bundle_not_found" });
  });
});

// -----------------------------------------------------------------------------
// Live-shop pricing rule (domain-only half of the client/server price parity
// guard -- the other half, comparing these constants against
// 0021_live_shop_purchases.sql's hardcoded price map, lives in
// services/api/src/__tests__/liveShopPurchaseMigration.test.ts since reading
// the migration file needs Node's fs, which this platform-agnostic package
// deliberately doesn't depend on).
// -----------------------------------------------------------------------------

// item_stepping_stone_path is the one documented exception to the flat
// treat/drink=2, toy/bed=5 pricing pass -- see wallet.ts's own comment. It is
// retired from the mobile shop's UI and priced in wallet.ts only for
// services/api's legacy purchaseInventoryItem tests, so the live-shop RPC's
// price map deliberately has no entry for it.
const LIVE_SHOP_EXCLUDED_ITEM_IDS = new Set(["item_stepping_stone_path"]);

describe("live shop pricing rule (wallet.ts/themeBundles.ts)", () => {
  it("every non-excluded catalog item follows the treat/drink=2, toy/bed=5 rule", () => {
    for (const price of starterCreditItemPrices) {
      if (LIVE_SHOP_EXCLUDED_ITEM_IDS.has(price.itemId)) {
        continue;
      }

      expect([2, 5]).toContain(price.creditCost);
    }
  });

  it("every theme bundle costs a flat 18 credits", () => {
    for (const bundle of themeBundles) {
      expect(bundle.creditCost).toBe(18);
    }
  });
});
