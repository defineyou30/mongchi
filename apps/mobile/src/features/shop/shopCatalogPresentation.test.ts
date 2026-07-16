import { describe, expect, it } from "vitest";

import { DEFAULT_THEME_ID, getExpressionPackById, mockInventory, mockItems } from "@mongchi/shared";

import {
  getLocalShopCatalogPresentation,
  getLocalizedCatalogItemCopy,
  getLocalizedExpressionPackCopy,
  getExpressionPackShopPresentation,
  getLocalShopSummaryPresentation,
  getServerShopSummaryPresentation,
  getShopCareMomentPreviewAction,
  getThemeCardPresentation,
  isNonShoppableStarterKitItem,
  isPremiumPassProduct,
  shouldShowOwnedQuantityBadge
} from "./shopCatalogPresentation";

describe("shop catalog presentation", () => {
  it("marks inventory-owned catalog items as owned instead of locked", () => {
    const foodBowl = mockItems.find((item) => item.id === "item_food_bowl_basic");

    expect(foodBowl).toBeDefined();
    if (!foodBowl) {
      return;
    }
    expect(getLocalShopCatalogPresentation(foodBowl, mockInventory)).toMatchObject({
      locked: false,
      ownedQuantity: 1,
      statusKind: "owned",
      statusLabel: "Owned x1"
    });
  });

  it("keeps owned treat items repeatable for credit BM loops", () => {
    const treatPlate = mockItems.find((item) => item.id === "item_treat_plate_biscuit");

    expect(treatPlate).toBeDefined();
    if (!treatPlate) {
      return;
    }
    expect(
      getLocalShopCatalogPresentation(treatPlate, {
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
    if (!plushToy) {
      return;
    }
    expect(getLocalShopCatalogPresentation(plushToy, mockInventory)).toMatchObject({
      locked: true,
      ownedQuantity: 0,
      creditCost: 5,
      statusKind: "available",
      statusLabel: "Available"
    });
  });

  it("localizes Korean catalog names and stable shop statuses without changing item ids", () => {
    const plushToy = mockItems.find((item) => item.id === "item_plush_toy_buddy");

    expect(plushToy).toBeDefined();
    if (!plushToy) {
      return;
    }

    expect(getLocalizedCatalogItemCopy(plushToy, "ko-KR")).toMatchObject({ name: "친구 봉제 인형" });
    expect(getLocalShopCatalogPresentation(plushToy, mockInventory, "ko-KR")).toMatchObject({ statusLabel: "구매 가능" });
    expect(plushToy.id).toBe("item_plush_toy_buddy");
  });

  it("localizes Japanese and French catalog copy and available state", () => {
    const plushToy = mockItems.find((item) => item.id === "item_plush_toy_buddy");

    expect(plushToy).toBeDefined();
    if (!plushToy) {
      return;
    }

    expect(getLocalizedCatalogItemCopy(plushToy, "ja-JP")).toMatchObject({ name: "おともだちぬいぐるみ" });
    expect(getLocalShopCatalogPresentation(plushToy, mockInventory, "ja-JP")).toMatchObject({ statusLabel: "利用可能" });
    expect(getLocalizedCatalogItemCopy(plushToy, "fr-FR")).toMatchObject({ name: "Peluche compagnon" });
    expect(getLocalShopCatalogPresentation(plushToy, mockInventory, "fr-FR")).toMatchObject({ statusLabel: "Disponible" });
  });

  it("keeps every generated shop item priced and localized", () => {
    const generatedItems = [
      ["item_rope_ring_mint", "available"],
      ["item_star_squeaker_sunny", "available"],
      ["item_ribbon_wand_garden", "premium"],
      ["item_clover_puzzle_mint", "premium"],
      ["item_cloud_cushion_sky", "premium"]
    ] as const;

    for (const [itemId, statusKind] of generatedItems) {
      const item = mockItems.find((candidate) => candidate.id === itemId);

      expect(item, `${itemId} should be in the shared catalog`).toBeDefined();
      if (!item) {
        continue;
      }

      expect(getLocalizedCatalogItemCopy(item, "ko-KR").name).not.toBe(item.name);
      expect(getLocalShopCatalogPresentation(item, mockInventory)).toMatchObject({
        creditCost: expect.any(Number),
        statusKind
      });
    }
  });

  it("stocks twelve visible items in every care shelf", () => {
    const visibleItems = mockItems.filter((item) => !isNonShoppableStarterKitItem(item.id));
    const treats = visibleItems.filter(
      (item) => item.category !== "drink" && (item.category === "food" || item.category === "treat" || item.behaviorTags.includes("treat"))
    );
    const drinks = visibleItems.filter((item) => item.category === "drink" || item.behaviorTags.includes("drink"));
    const toys = visibleItems.filter((item) => item.category === "toy");
    const rest = visibleItems.filter((item) => item.category === "bed");

    expect({ treats: treats.length, drinks: drinks.length, toys: toys.length, rest: rest.length }).toEqual({
      treats: 12,
      drinks: 12,
      toys: 12,
      rest: 12
    });
  });

  it("keeps owned drinks repeat-purchasable", () => {
    const drink = mockItems.find((item) => item.id === "item_milk_pup_cup");

    expect(drink).toBeDefined();
    if (!drink) {
      return;
    }

    const inventory = {
      ...mockInventory,
      items: [...mockInventory.items, { itemId: drink.id, quantity: 2, acquiredAt: "2026-06-24T09:00:00.000Z", source: "purchase" as const }]
    };

    expect(getLocalShopCatalogPresentation(drink, inventory)).toMatchObject({
      ownedQuantity: 2,
      purchaseLabel: "Buy more",
      repeatable: true
    });
  });

  it("prices and localizes every expanded care item across all supported locales", () => {
    const locales = ["en-US", "ko-KR", "ja-JP", "zh-TW", "de-DE", "fr-FR", "pt-BR", "es-MX"] as const;
    const unknownNames = new Set([
      "Cozy item",
      "포근한 아이템",
      "ほっこりアイテム",
      "溫馨小物",
      "Gemütlicher Fund",
      "Petit objet douillet",
      "Item aconchegante",
      "Artículo acogedor"
    ]);
    const expandedItems = mockItems.filter(
      (item) =>
        !isNonShoppableStarterKitItem(item.id) &&
        (item.category === "drink" || item.category === "toy" || item.category === "bed" || item.category === "treat" || item.behaviorTags.includes("treat"))
    );

    expect(expandedItems).toHaveLength(48);
    for (const item of expandedItems) {
      expect(getLocalShopCatalogPresentation(item, mockInventory).creditCost).toEqual(expect.any(Number));
      for (const locale of locales) {
        expect(unknownNames.has(getLocalizedCatalogItemCopy(item, locale).name), `${item.id} should be localized for ${locale}`).toBe(false);
      }
    }
  });

  it("keeps the local summary independent from removed chat-pass presentation", () => {
    expect(getLocalShopSummaryPresentation(mockItems, mockInventory, "es-MX")).not.toHaveProperty("plusLabel");
  });

  it("classifies every chat-pass identity as non-shoppable", () => {
    expect(isPremiumPassProduct({ productId: "premium_chat_monthly", entitlementKey: "premium_chat", grantType: "subscription" })).toBe(true);
    expect(isPremiumPassProduct({ productId: "plus_monthly", entitlementKey: "subscription_plus", grantType: "subscription" })).toBe(true);
    expect(isPremiumPassProduct({ productId: "theme_pack_starter", entitlementKey: "theme_pack", grantType: "durable" })).toBe(false);
  });

  it("summarizes the local shop shelf from owned and locked catalog state", () => {
    expect(getLocalShopSummaryPresentation(mockItems, mockInventory)).toEqual({
      lockedCount: mockItems.length - mockInventory.items.length,
      ownedQuantity: 2,
      visibleCount: mockItems.length
    });
  });

  it("summarizes server shop products from active entitlements", () => {
    const premiumProduct = { productId: "premium_chat_monthly", entitlementKey: "premium_chat", grantType: "subscription" } as const;
    const themeProduct = { productId: "theme_pack_starter", entitlementKey: "theme_pack", grantType: "durable" } as const;
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
      ])
    ).toEqual({
      lockedCount: 0,
      ownedQuantity: 1,
      visibleCount: 1
    });
  });
});

describe("expression pack shop presentation", () => {
  it("localizes Japanese and French expression shelf content and pose accessibility copy", () => {
    const pack = getExpressionPackById("pack-everyday-moments");

    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    expect(getLocalizedExpressionPackCopy(pack, "ja-JP")).toMatchObject({
      name: "日々のひととき",
      poseCopyByState: { curious: { name: "興味津々", usage: "何かが目に留まった時" } }
    });
    expect(getLocalizedExpressionPackCopy(pack, "fr-FR")).toMatchObject({
      name: "Moments du quotidien",
      poseCopyByState: { curious: { name: "Curieux", usage: "Quand quelque chose attire son regard" } }
    });
  });

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
      priceLabel: "12",
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
      actionLabel: "Get credits"
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

  it("localizes French expression pack price, locked state, and action", () => {
    const pack = getExpressionPackById("pack-everyday-moments");

    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    expect(getExpressionPackShopPresentation(pack, ["idle", "happy", "sleep"], mockInventory, undefined, false, 0, "fr-FR")).toMatchObject({
      status: "locked",
      priceLabel: "12",
      statusLabel: "Verrouillé",
      actionLabel: "Obtenir des crédits"
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
      priceLabel: "18",
      statusLabel: "Locked",
      actionLabel: "Unlock"
    });
  });

  it("presents an unpurchased theme as locked and non-actionable when the wallet can't afford it", () => {
    const presentation = getThemeCardPresentation("theme-fairy-garden", 18, mockInventory, false, 5);

    expect(presentation).toMatchObject({
      status: "locked_for_purchase",
      canAct: false,
      priceLabel: "18"
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

  it("localizes Japanese applied and Spanish locked theme states", () => {
    expect(getThemeCardPresentation(DEFAULT_THEME_ID, 0, mockInventory, false, 0, "ja-JP")).toMatchObject({
      priceLabel: "無料",
      statusLabel: "適用済み",
      actionLabel: "適用済み"
    });
    expect(getThemeCardPresentation("theme-fairy-garden", 18, mockInventory, false, 25, "es-MX")).toMatchObject({
      priceLabel: "18",
      statusLabel: "Bloqueado",
      actionLabel: "Desbloquear"
    });
  });
});

describe("getShopCareMomentPreviewAction", () => {
  it("maps every care shelf to the home screen's Tier 2 care moment it previews", () => {
    expect(getShopCareMomentPreviewAction("treats")).toBe("feed");
    expect(getShopCareMomentPreviewAction("drinks")).toBe("water_garden");
    expect(getShopCareMomentPreviewAction("toys")).toBe("play");
    expect(getShopCareMomentPreviewAction("rest")).toBe("affection");
  });

  it("has no animated moment for non-care shelves, which keep their static preview", () => {
    expect(getShopCareMomentPreviewAction("moments")).toBeNull();
    expect(getShopCareMomentPreviewAction("themes")).toBeNull();
  });
});

describe("shouldShowOwnedQuantityBadge", () => {
  it("shows the x{n} badge for an owned repeatable (consumable) item", () => {
    expect(shouldShowOwnedQuantityBadge({ repeatable: true, ownedQuantity: 3 })).toBe(true);
  });

  it("hides the badge for an owned non-repeatable item, which already states its count in the price pill", () => {
    expect(shouldShowOwnedQuantityBadge({ repeatable: false, ownedQuantity: 1 })).toBe(false);
  });

  it("hides the badge for a repeatable item with nothing owned yet", () => {
    expect(shouldShowOwnedQuantityBadge({ repeatable: true, ownedQuantity: 0 })).toBe(false);
  });
});
