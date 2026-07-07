import { describe, expect, it } from "vitest";

import { mockInventory, mockItems } from "@mongchi/shared";

import { getInventorySummaryPresentation } from "./inventoryPresentation";

describe("inventory presentation", () => {
  it("derives owned counts from inventory state", () => {
    const summary = getInventorySummaryPresentation(mockItems, mockInventory);

    expect(summary.ownedQuantity).toBe(mockInventory.items.reduce((total, entry) => total + entry.quantity, 0));
    expect(summary.previewItems).toEqual(summary.ownedItems.slice(0, 5));
    expect(summary.ownedItems).toHaveLength(mockInventory.items.length);
  });

  it("sums quantities across owned rows", () => {
    const summary = getInventorySummaryPresentation(mockItems, {
      ...mockInventory,
      items: [
        {
          itemId: "item_food_bowl_basic",
          quantity: 3,
          acquiredAt: "2026-06-27T08:00:00.000Z",
          source: "starter"
        }
      ]
    });

    expect(summary.ownedItems).toHaveLength(1);
    expect(summary.ownedQuantity).toBe(3);
  });

  it("skips owned entries with no matching catalog item", () => {
    const summary = getInventorySummaryPresentation(mockItems, {
      ...mockInventory,
      items: [
        ...mockInventory.items,
        {
          itemId: "item_unknown_ghost",
          quantity: 1,
          acquiredAt: "2026-06-27T08:00:00.000Z",
          source: "purchase"
        }
      ]
    });

    expect(summary.ownedItems.some((presentation) => presentation.item.id === "item_unknown_ghost")).toBe(false);
  });
});
