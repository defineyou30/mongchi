import { describe, expect, it } from "vitest";

import { acceptPrototypeGeneratedPet, createInitialPrototypeSession, grantPrototypeEventItem } from "../index";

const now = "2026-07-15T09:00:00.000Z";

describe("grantPrototypeEventItem", () => {
  it("grants one unit of the item tagged with source 'event', without touching the wallet", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const walletBefore = state.wallet;

    const result = grantPrototypeEventItem(state, "item_apple_biscuit", "2026-07-15T09:05:00.000Z");

    expect(result.wallet).toEqual(walletBefore);

    const entry = result.inventory.items.find((item) => item.itemId === "item_apple_biscuit");

    expect(entry?.quantity).toBeGreaterThanOrEqual(1);
    expect(entry?.source === "event" || entry?.source === "starter").toBe(true);
  });

  it("stacks quantity on a second grant of the same item", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const before = state.inventory.items.find((item) => item.itemId === "item_cheese_puff")?.quantity ?? 0;

    let next = grantPrototypeEventItem(state, "item_cheese_puff", "2026-07-15T09:05:00.000Z");
    next = grantPrototypeEventItem(next, "item_cheese_puff", "2026-07-15T09:06:00.000Z");

    const entry = next.inventory.items.find((item) => item.itemId === "item_cheese_puff");

    expect(entry?.quantity).toBe(before + 2);
  });

  it("works for an item the starter inventory does not already own", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    const result = grantPrototypeEventItem(state, "item_duck_biscuit", "2026-07-15T09:05:00.000Z");
    const entry = result.inventory.items.find((item) => item.itemId === "item_duck_biscuit");

    expect(entry).toBeDefined();
    expect(entry?.source).toBe("event");
  });
});
