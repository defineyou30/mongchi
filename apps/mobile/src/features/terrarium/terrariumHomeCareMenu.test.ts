import { describe, expect, it } from "vitest";

import { isTreatInventoryItem, mockInventory, mockItems } from "@mongchi/shared";
import type { Item } from "@mongchi/shared";

import { getHomeDockActionForItem, getShopCategoryForHomeAction, getVisibleHomeCareMenuOptions } from "./terrariumHomeCareMenu";

const findItem = (itemId: string): Item => {
  const item = mockItems.find((candidate) => candidate.id === itemId);

  if (!item) {
    throw new Error(`fixture setup error: ${itemId} missing from mockItems`);
  }

  return item;
};

describe("getHomeDockActionForItem", () => {
  it("routes Buddy Plush to the play tray (docs/gamefeel-sound-plan.md §1 Tier 4 'Give now')", () => {
    expect(getHomeDockActionForItem(findItem("item_plush_toy_buddy"))).toBe("play");
  });

  it("routes the Rose Cushion to the affection tray", () => {
    expect(getHomeDockActionForItem(findItem("item_cushion_rose"))).toBe("affection");
  });

  it("routes any treat item to the feed tray", () => {
    expect(getHomeDockActionForItem(findItem("item_treat_plate_biscuit"))).toBe("feed");
    expect(getHomeDockActionForItem(findItem("item_milk_pup_cup"))).toBe("water_garden");
  });

  it("returns null for the base ball -- it has no dock tray of its own, it *is* the play tray's base option", () => {
    expect(getHomeDockActionForItem(findItem("item_toy_ball_mint"))).toBeNull();
  });

  it("returns null for an item with no special care use (e.g. the starter food bowl)", () => {
    expect(getHomeDockActionForItem(findItem("item_food_bowl_basic"))).toBeNull();
  });
});

describe("getVisibleHomeCareMenuOptions", () => {
  it("offers a Bath option in the water tray, wired to the clean care action", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "water_garden",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: mockInventory
    });

    const bath = options.find((option) => option.id === "base-clean");

    expect(bath).toBeDefined();
    expect(bath?.action).toBe("clean");
    expect(bath?.title).toBe("Bath");
    expect(bath?.owned).toBe(true);
    expect(bath?.itemId).toBeUndefined();
  });

  it("keeps the base Water option (action water_garden) ahead of Bath in the tray", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "water_garden",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: mockInventory
    });

    expect(options[0]?.action).toBe("water_garden");
    expect(options[1]?.id).toBe("base-clean");
  });

  it("localizes the water and bath base options for Traditional Chinese", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "water_garden",
      catalogItems: [],
      devStoreUnlocked: false,
      inventory: mockInventory,
      locale: "zh-TW"
    });

    expect(options).toMatchObject([
      { id: "base-water", title: "喝水", meta: "+水分" },
      { id: "base-clean", title: "洗澡", meta: "+清爽" },
      { id: "more-water_garden", title: "更多飲品", meta: "商店" }
    ]);
  });

  it("shows a heart icon (not the pink petBed art) for the base Pet option in the affection tray", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "affection",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: mockInventory
    });

    const basePet = options.find((option) => option.id === "base-affection");

    expect(basePet).toBeDefined();
    expect(basePet?.assetKey).toBe("heart");
  });

  it("does not leak the Bath option into unrelated trays (e.g. feed)", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: mockInventory
    });

    expect(options.some((option) => option.id === "base-clean")).toBe(false);
  });

  it("shows each treat's localized catalog name instead of the generic Treat label", () => {
    const inventory = {
      ...mockInventory,
      items: [
        ...mockInventory.items,
        {
          itemId: "item_chicken_jerky" as const,
          quantity: 2,
          acquiredAt: "2026-06-24T09:00:00.000Z",
          source: "purchase" as const
        }
      ]
    };
    const englishOptions = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory,
      locale: "en-US"
    });
    const koreanOptions = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory,
      locale: "ko-KR"
    });

    expect(englishOptions.find((option) => option.itemId === "item_chicken_jerky")?.title).toBe("Chicken Jerky");
    expect(koreanOptions.find((option) => option.itemId === "item_chicken_jerky")?.title).toBe("치킨 육포");
  });

  it("keeps every purchased item reachable beyond the preview cap and puts an inventory handoff first", () => {
    const drinkItems = mockItems.filter((item) => item.category === "drink");
    const inventory = {
      ...mockInventory,
      items: [
        ...mockInventory.items,
        ...drinkItems.map((item, index) => ({
          itemId: item.id,
          quantity: 1,
          acquiredAt: `2026-06-24T09:${String(index).padStart(2, "0")}:00.000Z`,
          source: "purchase" as const
        }))
      ]
    };
    const preferredItemId = drinkItems.at(-1)?.id;
    const options = getVisibleHomeCareMenuOptions({
      action: "water_garden",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory,
      limit: 4,
      preferredItemId
    });
    const ownedDrinkOptions = options.filter((option) => option.itemId && option.owned);

    expect(ownedDrinkOptions).toHaveLength(12);
    expect(ownedDrinkOptions[0]?.itemId).toBe(preferredItemId);
  });

  it("never renders an unowned catalog item as its own translucent tile", () => {
    // mockInventory owns no treats by default, so every feed-tray treat in
    // mockItems is unowned -- none of them should still surface as an
    // individual option (only the trailing More treats tile may stand in
    // for all of them).
    const treatItems = mockItems.filter((item) => isTreatInventoryItem(item));
    const options = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: mockInventory
    });

    treatItems.forEach((item) => {
      expect(options.some((option) => option.itemId === item.id)).toBe(false);
    });
  });

  it("shows only the base option and a More treats tile when nothing is owned yet", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: mockInventory
    });

    expect(options).toMatchObject([{ id: "base-feed" }, { id: "more-feed", title: "More treats", owned: false }]);
  });

  it("drops the More tile once dev-store mode already treats everything as owned", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: true,
      inventory: mockInventory
    });

    expect(options.some((option) => option.id === "more-feed")).toBe(false);
    expect(options.every((option) => option.owned)).toBe(true);
  });

  it("never adds a More tile to the walk tray -- its only special item isn't sold in the shop", () => {
    const options = getVisibleHomeCareMenuOptions({
      action: "walk",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: mockInventory
    });

    expect(options.some((option) => option.id === "more-walk")).toBe(false);
  });
});

describe("getShopCategoryForHomeAction", () => {
  it("maps each care action with a real shop aisle to its category", () => {
    expect(getShopCategoryForHomeAction("feed")).toBe("treats");
    expect(getShopCategoryForHomeAction("water_garden")).toBe("drinks");
    expect(getShopCategoryForHomeAction("play")).toBe("toys");
    expect(getShopCategoryForHomeAction("affection")).toBe("rest");
  });

  it("returns null for walk -- item_stepping_stone_path isn't sold anywhere in the shop", () => {
    expect(getShopCategoryForHomeAction("walk")).toBeNull();
  });
});
