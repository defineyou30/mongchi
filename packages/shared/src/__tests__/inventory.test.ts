import { describe, expect, it } from "vitest";

import {
  consumeInventoryItem,
  getAvailableTreatItemId,
  isCareItemEligibleForAction,
  isConsumableCareItem,
  isDrinkInventoryItem,
  isSleepInventoryItem
} from "../domain";
import type { Inventory } from "../domain";
import { mockItems } from "../mock/mockData";

const inventory: Inventory = {
  userId: "user_inventory_test_001",
  items: [
    {
      itemId: "item_treat_plate_biscuit",
      quantity: 2,
      acquiredAt: "2026-06-24T09:00:00.000Z",
      source: "purchase"
    },
    {
      itemId: "item_toy_ball_mint",
      quantity: 1,
      acquiredAt: "2026-06-24T09:00:00.000Z",
      source: "starter"
    }
  ],
  ownedThemeIds: [],
  placedItems: [],
  updatedAt: "2026-06-24T09:00:00.000Z"
};

describe("inventory item consumption", () => {
  it("spends one consumable item while keeping the remaining quantity", () => {
    const result = consumeInventoryItem(inventory, "item_treat_plate_biscuit", "2026-06-24T09:05:00.000Z");

    expect(result).toMatchObject({
      ok: true,
      consumedQuantity: 1,
      inventory: {
        updatedAt: "2026-06-24T09:05:00.000Z"
      }
    });

    if (!result.ok) {
      throw new Error("Expected item consumption to succeed.");
    }

    expect(result.inventory.items.find((entry) => entry.itemId === "item_treat_plate_biscuit")?.quantity).toBe(1);
  });

  it("drops the item entry entirely once the last owned unit is consumed", () => {
    const once = consumeInventoryItem(inventory, "item_treat_plate_biscuit", "2026-06-24T09:05:00.000Z");

    if (!once.ok) {
      throw new Error("Expected first item consumption to succeed.");
    }

    const twice = consumeInventoryItem(once.inventory, "item_treat_plate_biscuit", "2026-06-24T09:06:00.000Z");

    expect(twice).toMatchObject({
      ok: true,
      consumedQuantity: 1
    });

    if (!twice.ok) {
      throw new Error("Expected second item consumption to succeed.");
    }

    expect(twice.inventory.items.some((entry) => entry.itemId === "item_treat_plate_biscuit")).toBe(false);
    expect(twice.inventory.items.find((entry) => entry.itemId === "item_toy_ball_mint")?.quantity).toBe(1);
  });

  it("rejects missing or understocked items", () => {
    expect(consumeInventoryItem(inventory, "missing_item", "2026-06-24T09:05:00.000Z")).toEqual({
      ok: false,
      reason: "item_not_found"
    });
    expect(consumeInventoryItem(inventory, "item_treat_plate_biscuit", "2026-06-24T09:05:00.000Z", 3)).toEqual({
      ok: false,
      reason: "item_not_found"
    });
  });
});

describe("available treat lookup", () => {
  it("selects a usable treat item from owned inventory", () => {
    expect(getAvailableTreatItemId(inventory, mockItems)).toBe("item_treat_plate_biscuit");
    expect(
      getAvailableTreatItemId(
        {
          ...inventory,
          items: inventory.items.filter((item) => item.itemId !== "item_treat_plate_biscuit")
        },
        mockItems
      )
    ).toBeNull();
  });
});

describe("care item consumption semantics", () => {
  it("treats and drinks are consumable while toys and beds remain durable", () => {
    const findItem = (itemId: string) => {
      const item = mockItems.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new Error(`Missing item fixture: ${itemId}`);
      }

      return item;
    };

    expect(isDrinkInventoryItem(findItem("item_milk_pup_cup"))).toBe(true);
    expect(isConsumableCareItem(findItem("item_milk_pup_cup"))).toBe(true);
    expect(isConsumableCareItem(findItem("item_treat_plate_biscuit"))).toBe(true);
    expect(isConsumableCareItem(findItem("item_plush_toy_buddy"))).toBe(false);
    expect(isConsumableCareItem(findItem("item_cushion_rose"))).toBe(false);
  });

  it("flags bed/rest furniture as sleep items but not toys or treats", () => {
    const findItem = (itemId: string) => {
      const item = mockItems.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new Error(`Missing item fixture: ${itemId}`);
      }

      return item;
    };

    expect(isSleepInventoryItem(findItem("item_garden_hammock"))).toBe(true);
    expect(isSleepInventoryItem(findItem("item_cushion_rose"))).toBe(true);
    expect(isSleepInventoryItem(findItem("item_plush_toy_buddy"))).toBe(false);
    expect(isSleepInventoryItem(findItem("item_treat_plate_biscuit"))).toBe(false);
  });

  it("only allows catalog items on their authored care actions", () => {
    const findItem = (itemId: string) => {
      const item = mockItems.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new Error(`Missing item fixture: ${itemId}`);
      }

      return item;
    };

    expect(isCareItemEligibleForAction(findItem("item_food_bowl_basic"), "feed")).toBe(true);
    expect(isCareItemEligibleForAction(findItem("item_toy_ball_mint"), "play")).toBe(true);
    expect(isCareItemEligibleForAction(findItem("item_cushion_rose"), "affection")).toBe(true);
    expect(isCareItemEligibleForAction(findItem("item_milk_pup_cup"), "water_garden")).toBe(true);
    expect(isCareItemEligibleForAction(findItem("item_treat_plate_biscuit"), "treat")).toBe(true);

    expect(isCareItemEligibleForAction(findItem("item_food_bowl_basic"), "play")).toBe(false);
    expect(isCareItemEligibleForAction(findItem("item_toy_ball_mint"), "affection")).toBe(false);
    expect(isCareItemEligibleForAction(findItem("item_milk_pup_cup"), "treat")).toBe(false);
    expect(isCareItemEligibleForAction(findItem("item_cushion_rose"), "talk")).toBe(false);
  });
});
