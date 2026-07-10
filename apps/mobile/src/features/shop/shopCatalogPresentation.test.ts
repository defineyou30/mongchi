import { describe, expect, it } from "vitest";

import { DEFAULT_THEME_ID, getExpressionPackById, mockInventory, mockItems } from "@mongchi/shared";

import {
  getLocalShopCatalogPresentation,
  getExpressionPackShopPresentation,
  getLocalShopSummaryPresentation,
  getPremiumPassShopPresentation,
  getServerShopSummaryPresentation,
  getThemeCardPresentation,
  isNonShoppableStarterKitItem,
  isPremiumPassProduct,
  premiumPassFallbackProduct
} from "./shopCatalogPresentation";

describe("shop catalog presentation", () => {
  it("marks inventory-owned catalog items as owned instead of locked", () => {
    const foodBowl = mockItems.find((item) => item.id === "item_food_bowl_basic");

    expect(foodBowl).toBeDefined();
    expect(getLocalShopCatalogPresentation(foodBowl!, mockInventory)).toMatchObject({
      locked: false,
      ownedQuantity: 1,
      statusKind: "owned",
      statusLabel: "Owned x1"
    });
  });

  it("keeps owned treat items repeatable for credit BM loops", () => {
    const treatPlate = mockItems.find((item) => item.id === "item_treat_plate_biscuit");

    expect(treatPlate).toBeDefined();
    expect(
      getLocalShopCatalogPresentation(treatPlate!, {
        ...mockInventory,
        items: [
          ...mockInventory.items,
          {
            itemId: "item_treat_plate_biscuit",
            quantity: 2,
            acquiredAt: "2026-06-27T08:00:00.000Z",
            source: "purchase"
          }
        ]
      })
    ).toMatchObject({
      locked: false,
      ownedQuantity: 2,
      repeatable: true,
      creditCost: 2,
      purchaseLabel: "Buy more",
      statusKind: "owned",
      statusLabel: "Owned x2"
    });
  });

  it("flags the fixed starter food bowl and toy ball as non-shoppable so the shop shelves hide them", () => {
    expect(isNonShoppableStarterKitItem("item_food_bowl_basic")).toBe(true);
    expect(isNonShoppableStarterKitItem("item_toy_ball_mint")).toBe(true);
    expect(isNonShoppableStarterKitItem("item_plush_toy_buddy")).toBe(false);
  });

  it("marks unowned catalog items as available shop previews", () => {
    const plushToy = mockItems.find((item) => item.id === "item_plush_toy_buddy");

    expect(plushToy).toBeDefined();
    expect(getLocalShopCatalogPresentation(plushToy!, mockInventory)).toMatchObject({
      locked: true,
      ownedQuantity: 0,
      creditCost: 3,
      statusKind: "available",
      statusLabel: "Available"
    });
  });

  it("shows a local Plus pass fallback when no server catalog is loaded", () => {
    expect(getPremiumPassShopPresentation([], [])).toMatchObject({
      active: false,
      product: premiumPassFallbackProduct,
      source: "local_preview",
      statusLabel: "Plus locked"
    });
  });

  it("marks the server premium chat product active from matching entitlements", () => {
    const product = { productId: "premium_chat_monthly", entitlementKey: "premium_chat", grantType: "subscription" } as const;
    const presentation = getPremiumPassShopPresentation([product], [
      {
        id: "ent_premium_chat_active",
        userId: "user_demo_001",
        key: "premium_chat",
        status: "active",
        source: "purchase",
        productId: "premium_chat_monthly",
        startsAt: "2026-01-01T00:00:00.000Z",
        ledgerEntryId: "ledger_premium_chat_active",
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);

    expect(presentation).toMatchObject({
      active: true,
      product,
      source: "server_catalog",
      statusLabel: "Active"
    });
    expect(isPremiumPassProduct(product)).toBe(true);
  });

  it("summarizes the local shop shelf from owned and locked catalog state", () => {
    const premiumPass = getPremiumPassShopPresentation([], []);

    expect(getLocalShopSummaryPresentation(mockItems, mockInventory, premiumPass)).toEqual({
      lockedCount: mockItems.length - mockInventory.items.length,
      ownedQuantity: 2,
      plusLabel: "Plus locked",
      visibleCount: mockItems.length
    });
  });

  it("summarizes server shop products from active entitlements", () => {
    const premiumProduct = { productId: "premium_chat_monthly", entitlementKey: "premium_chat", grantType: "subscription" } as const;
    const themeProduct = { productId: "theme_pack_starter", entitlementKey: "theme_pack", grantType: "durable" } as const;
    const premiumPass = getPremiumPassShopPresentation([premiumProduct, themeProduct], [
      {
        id: "ent_theme_pack_active",
        userId: "user_demo_001",
        key: "theme_pack",
        status: "active",
        source: "purchase",
        productId: "theme_pack_starter",
        startsAt: "2026-01-01T00:00:00.000Z",
        ledgerEntryId: "ledger_theme_pack_active",
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);

    expect(
      getServerShopSummaryPresentation([premiumProduct, themeProduct], [
        {
          id: "ent_theme_pack_active",
          userId: "user_demo_001",
          key: "theme_pack",
          status: "active",
          source: "purchase",
          productId: "theme_pack_starter",
          startsAt: "2026-01-01T00:00:00.000Z",
          ledgerEntryId: "ledger_theme_pack_active",
          metadata: {},
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ], premiumPass)
    ).toEqual({
      lockedCount: 0,
      ownedQuantity: 1,
      plusLabel: "Plus locked",
      visibleCount: 1
    });
  });
});

describe("expression pack shop presentation", () => {
  it("presents an affordable locked pack as an unlockable 3-state product", () => {
    const pack = getExpressionPackById("pack-everyday-moments");

    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    expect(getExpressionPackShopPresentation(pack, ["idle", "happy", "sleep"], mockInventory, undefined, false, 12)).toMatchObject({
      status: "available",
      ownedStateCount: 0,
      totalStateCount: 3,
      canAct: true,
      priceLabel: "12 cr",
      actionLabel: "Unlock pack"
    });
  });

  it("keeps a server-recorded pack in saving state until all generated assets are stored", () => {
    const pack = getExpressionPackById("pack-care-reactions");

    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    expect(
      getExpressionPackShopPresentation(
        pack,
        ["idle", "happy", "sleep", "walk_return"],
        { ...mockInventory, ownedExpressionPackIds: ["pack-care-reactions"] },
        undefined,
        false,
        0
      )
    ).toMatchObject({
      status: "generating",
      ownedStateCount: 1,
      totalStateCount: 3,
      canAct: false,
      statusLabel: "1/3 ready"
    });
  });

  it("presents a fully stored pack as owned and non-actionable", () => {
    const pack = getExpressionPackById("pack-special-days");

    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    expect(
      getExpressionPackShopPresentation(
        pack,
        ["idle", "happy", "sleep", "celebrate", "garden_help", "seasonal"],
        { ...mockInventory, ownedExpressionPackIds: ["pack-special-days"] },
        undefined,
        false,
        0
      )
    ).toMatchObject({
      status: "owned",
      ownedStateCount: 3,
      totalStateCount: 3,
      canAct: false,
      priceLabel: "Owned",
      actionLabel: "Owned"
    });
  });

  it("allows retrying a failed pack purchase only when the wallet can afford it", () => {
    const pack = getExpressionPackById("pack-everyday-moments");

    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    expect(
      getExpressionPackShopPresentation(
        pack,
        ["idle", "happy", "sleep"],
        mockInventory,
        { status: "failed", failureMessageSafe: "Try again." },
        false,
        12
      )
    ).toMatchObject({
      status: "failed",
      canAct: true,
      actionLabel: "Retry pack"
    });

    expect(
      getExpressionPackShopPresentation(
        pack,
        ["idle", "happy", "sleep"],
        mockInventory,
        { status: "failed", failureMessageSafe: "Try again." },
        false,
        0
      )
    ).toMatchObject({
      status: "failed",
      canAct: false,
      actionLabel: "Need credits"
    });
  });

  it("surfaces retry before saving when a failed job has no completed assets yet", () => {
    const pack = getExpressionPackById("pack-care-reactions");

    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    expect(
      getExpressionPackShopPresentation(
        pack,
        ["idle", "happy", "sleep"],
        { ...mockInventory, ownedExpressionPackIds: ["pack-care-reactions"] },
        { status: "failed", failureMessageSafe: "Try again." },
        false,
        12
      )
    ).toMatchObject({
      status: "failed",
      canAct: true,
      actionLabel: "Retry pack"
    });
  });
});

describe("theme card presentation (3-state Themes tab)", () => {
  it("presents the default theme as always-free, applied when selected", () => {
    const applied = getThemeCardPresentation(DEFAULT_THEME_ID, 0, mockInventory, false, 0);

    expect(applied).toMatchObject({
      status: "default_free",
      owned: true,
      applied: true,
      canAct: false,
      priceLabel: "Free",
      statusLabel: "Applied",
      actionLabel: "Applied"
    });
  });

  it("presents the default theme as free-and-actionable when a different theme is currently applied", () => {
    const inventory = { ...mockInventory, selectedTerrariumThemeId: "theme-fairy-garden" as const, ownedThemeIds: [DEFAULT_THEME_ID, "theme-fairy-garden"] };

    const presentation = getThemeCardPresentation(DEFAULT_THEME_ID, 0, inventory, false, 0);

    expect(presentation).toMatchObject({
      status: "default_free",
      owned: true,
      applied: false,
      canAct: true,
      priceLabel: "Free",
      actionLabel: "Apply"
    });
  });

  it("presents an unpurchased theme as locked with its credit price when affordable", () => {
    const presentation = getThemeCardPresentation("theme-fairy-garden", 18, mockInventory, false, 25);

    expect(presentation).toMatchObject({
      status: "locked_for_purchase",
      owned: false,
      applied: false,
      canAct: true,
      priceLabel: "18 cr",
      statusLabel: "Locked",
      actionLabel: "Unlock"
    });
  });

  it("presents an unpurchased theme as locked and non-actionable when the wallet can't afford it", () => {
    const presentation = getThemeCardPresentation("theme-fairy-garden", 18, mockInventory, false, 5);

    expect(presentation).toMatchObject({
      status: "locked_for_purchase",
      canAct: false,
      priceLabel: "18 cr"
    });
  });

  it("presents an unpurchased theme as affordable under the dev store unlock regardless of balance", () => {
    const presentation = getThemeCardPresentation("theme-fairy-garden", 18, mockInventory, true, 0);

    expect(presentation).toMatchObject({
      status: "locked_for_purchase",
      canAct: true,
      statusLabel: "Dev open"
    });
  });

  it("presents an owned (purchased) theme as free to re-apply, distinct from the default theme's free-by-default state", () => {
    const inventory = { ...mockInventory, ownedThemeIds: [DEFAULT_THEME_ID, "theme-fairy-garden"] };

    const notApplied = getThemeCardPresentation("theme-fairy-garden", 18, inventory, false, 0);
    expect(notApplied).toMatchObject({
      status: "owned",
      owned: true,
      applied: false,
      canAct: true,
      priceLabel: "Owned",
      actionLabel: "Apply"
    });

    const appliedInventory = { ...inventory, selectedTerrariumThemeId: "theme-fairy-garden" as const };
    const applied = getThemeCardPresentation("theme-fairy-garden", 18, appliedInventory, false, 0);
    expect(applied).toMatchObject({
      status: "owned",
      applied: true,
      canAct: false,
      priceLabel: "Applied",
      actionLabel: "Applied"
    });
  });
});
