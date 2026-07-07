import { describe, expect, it } from "vitest";

import { consumeInventoryItem, getAvailableTreatItemId } from "../domain";
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
