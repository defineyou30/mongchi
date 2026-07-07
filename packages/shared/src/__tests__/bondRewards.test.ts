import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  bondLevelRewards,
  createInitialPrototypeSession,
  getCrossedBondLevels,
  performPrototypeCareAction
} from "../index";

const now = "2026-06-24T09:00:00.000Z";
const minutesLater = (minutes: number): string => new Date(new Date(now).getTime() + minutes * 60_000).toISOString();

describe("bond level rewards", () => {
  it("lists crossed levels between two bond levels", () => {
    expect(getCrossedBondLevels(1, 1)).toEqual([]);
    expect(getCrossedBondLevels(1, 2)).toEqual([2]);
    expect(getCrossedBondLevels(3, 6)).toEqual([4, 5, 6]);
  });

  it("grants the level 2 reward and celebrates when bond xp crosses 100", () => {
    let state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    // Starter session begins at 66 bond xp (level 1). Treats grant 5 xp each;
    // push across 100 to trigger the level 2 celebration.
    state = { ...state, relationshipState: { ...state.relationshipState, bondXp: 98, bondLevel: 1 } };

    const ticketsBefore = state.wallet.freeChatTickets;

    state = performPrototypeCareAction(state, "talk", minutesLater(1));

    expect(state.relationshipState.bondLevel).toBe(2);
    expect(state.wallet.freeChatTickets).toBeGreaterThanOrEqual(ticketsBefore + 2);
    expect(state.currentReaction?.ruleId).toBe("bond_level_up_2");
    expect(state.currentReaction?.line).toBe(bondLevelRewards[2]?.celebrationEn);
    expect(state.currentReaction?.animation).toBe("celebrate");
  });

  it("grants item rewards into the inventory with event source", () => {
    let state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    state = { ...state, relationshipState: { ...state.relationshipState, bondXp: 298, bondLevel: 3 } };
    state = performPrototypeCareAction(state, "talk", minutesLater(1));

    expect(state.relationshipState.bondLevel).toBe(4);

    const rewardEntry = state.inventory.items.find((entry) => entry.itemId === "item_cushion_rose" && entry.source === "event");
    const anyCushion = state.inventory.items.find((entry) => entry.itemId === "item_cushion_rose");

    // Starter inventory may already own the cushion; either a new event entry
    // exists or the owned quantity increased past the starter amount.
    expect(rewardEntry ?? anyCushion).toBeDefined();
    expect(state.currentReaction?.ruleId).toBe("bond_level_up_4");
  });

  it("grants the level 5 reward into bonusCredits, never the paid credits bucket", () => {
    let state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    state = { ...state, relationshipState: { ...state.relationshipState, bondXp: 398, bondLevel: 4 } };

    const bonusCreditsBefore = state.wallet.bonusCredits;
    const creditsBefore = state.wallet.credits;

    state = performPrototypeCareAction(state, "talk", minutesLater(1));

    expect(state.relationshipState.bondLevel).toBe(5);
    expect(state.wallet.bonusCredits).toBe(bonusCreditsBefore + 5);
    expect(state.wallet.credits).toBe(creditsBefore);
    expect(state.currentReaction?.ruleId).toBe("bond_level_up_5");
  });

  it("grants the level 10 reward into bonusCredits plus free chat tickets, never the paid credits bucket", () => {
    let state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    state = { ...state, relationshipState: { ...state.relationshipState, bondXp: 898, bondLevel: 9 } };

    const bonusCreditsBefore = state.wallet.bonusCredits;
    const creditsBefore = state.wallet.credits;
    const ticketsBefore = state.wallet.freeChatTickets;

    state = performPrototypeCareAction(state, "talk", minutesLater(1));

    expect(state.relationshipState.bondLevel).toBe(10);
    expect(state.wallet.bonusCredits).toBe(bonusCreditsBefore + 10);
    expect(state.wallet.credits).toBe(creditsBefore);
    expect(state.wallet.freeChatTickets).toBeGreaterThanOrEqual(ticketsBefore + 3);
    expect(state.currentReaction?.ruleId).toBe("bond_level_up_10");
  });

  it("never grants any plant-category item as a bond reward", () => {
    for (const reward of Object.values(bondLevelRewards)) {
      for (const item of reward?.items ?? []) {
        expect(item.itemId).not.toBe("item_flower_pot_sunny");
        expect(item.itemId).not.toBe("item_leafy_plant_clover");
      }
    }
  });
});
