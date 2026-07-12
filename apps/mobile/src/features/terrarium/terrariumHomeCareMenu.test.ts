import { describe, expect, it } from "vitest";

import { mockInventory, mockItems } from "@mongchi/shared";
import type { Item } from "@mongchi/shared";

import { getHomeDockActionForItem, getVisibleHomeCareMenuOptions } from "./terrariumHomeCareMenu";

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
    expect(getHomeDockActionForItem(findItem("item_milk_pup_cup"))).toBe("feed");
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
      { id: "base-clean", title: "洗澡", meta: "+清爽" }
    ]);
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
});
