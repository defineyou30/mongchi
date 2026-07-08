import { describe, expect, it } from "vitest";

import { mockItems } from "@mongchi/shared";
import type { Item } from "@mongchi/shared";

import { getHomeDockActionForItem } from "./terrariumHomeCareMenu";

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
