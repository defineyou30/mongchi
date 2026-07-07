import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  addActiveCareBuff,
  applyLocalCareAction,
  careBuffTemplatesByItem,
  consumeActionBuffUses,
  createActiveCareBuff,
  createInitialPrototypeSession,
  getActionGainMultiplier,
  getActivePetBundle,
  getBondXpMultiplier,
  performPrototypeCareAction,
  projectCareStateForTime,
  pruneActiveCareBuffs
} from "../index";
import type { ActiveCareBuff, CareState } from "../index";
import { mockCareState } from "../mock/mockData";

const now = "2026-06-24T09:00:00.000Z";
const hoursLater = (hours: number): string => new Date(new Date(now).getTime() + hours * 60 * 60 * 1000).toISOString();
const active = getActivePetBundle;

const makeCareState = (overrides: Partial<CareState> = {}): CareState => ({
  ...mockCareState,
  satiety: 80,
  happiness: 80,
  energy: 60,
  affection: 60,
  gardenHealth: 80,
  cleanliness: 80,
  lastInteractionAt: now,
  lastGardenWateredAt: now,
  updatedAt: now,
  ...overrides
});

describe("care buff lifecycle", () => {
  it("creates, prunes, and replaces buffs without stacking", () => {
    const template = careBuffTemplatesByItem.item_berry_yogurt!;
    let buffs: ActiveCareBuff[] = addActiveCareBuff([], template, "item_berry_yogurt", now);

    expect(buffs).toHaveLength(1);
    expect(buffs[0]?.expiresAt).toBe(hoursLater(4));

    buffs = addActiveCareBuff(buffs, template, "item_berry_yogurt", hoursLater(1));
    expect(buffs).toHaveLength(1);
    expect(buffs[0]?.expiresAt).toBe(hoursLater(5));

    expect(pruneActiveCareBuffs(buffs, hoursLater(6))).toHaveLength(0);
  });

  it("consumes limited uses from action boost buffs", () => {
    const template = careBuffTemplatesByItem.item_plush_toy_buddy!;
    let buffs = addActiveCareBuff([], template, "item_plush_toy_buddy", now);

    expect(getActionGainMultiplier(buffs, "play", now)).toBe(1.5);
    buffs = consumeActionBuffUses(buffs, "play", now);
    buffs = consumeActionBuffUses(buffs, "play", now);
    expect(buffs[0]?.usesLeft).toBe(1);
    buffs = consumeActionBuffUses(buffs, "play", now);
    expect(buffs).toHaveLength(0);
  });
});

describe("buff effects on care math", () => {
  it("reduces satiety decay while the full-belly buff is active", () => {
    const buff = createActiveCareBuff(careBuffTemplatesByItem.item_berry_yogurt!, "item_berry_yogurt", now);
    const state = makeCareState();
    const later = hoursLater(6);

    const withoutBuff = projectCareStateForTime(state, later);
    const withBuff = projectCareStateForTime(state, later, [buff]);

    // 6h elapsed, 2h grace -> 4h decay at 4/h = -16. Buff covers hours 2..4 at half decay -> +4 credit.
    expect(withoutBuff.satiety).toBe(64);
    expect(withBuff.satiety).toBe(68);
    expect(withBuff.energy).toBe(withoutBuff.energy);
  });

  it("boosts play gains with the favorite-toy buff", () => {
    const buff = createActiveCareBuff(careBuffTemplatesByItem.item_plush_toy_buddy!, "item_plush_toy_buddy", now);
    const state = makeCareState({ happiness: 50 });

    const withoutBuff = applyLocalCareAction(state, { action: "play", occurredAt: now });
    const withBuff = applyLocalCareAction(state, { action: "play", occurredAt: now }, [buff]);

    const baseGain = withoutBuff.nextState.happiness - withoutBuff.previousState.happiness;
    const boostedGain = withBuff.nextState.happiness - withBuff.previousState.happiness;

    expect(boostedGain).toBe(Math.round(baseGain * 1.5));
    // Losses stay untouched by the boost.
    expect(withBuff.nextState.energy).toBe(withoutBuff.nextState.energy);
  });

  it("doubles bond xp while the training treat buff is active", () => {
    const buff = createActiveCareBuff(careBuffTemplatesByItem.item_duck_biscuit!, "item_duck_biscuit", now);

    expect(getBondXpMultiplier([buff], now)).toBe(2);
    expect(getBondXpMultiplier([buff], hoursLater(3))).toBe(1);
  });
});

describe("buffs in the prototype session", () => {
  it("starts a buff when its item is used and grants boosted bond xp afterward", () => {
    let state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    state = performPrototypeCareAction(state, "treat", hoursLater(1), "item_duck_biscuit");
    expect(state.activeBuffs).toHaveLength(1);
    expect(state.activeBuffs[0]?.buffId).toBe("buff_training_treat");

    const bondBefore = active(state).relationshipState.bondXp;

    state = performPrototypeCareAction(state, "talk", hoursLater(1.5));
    // talk grants 3 xp, doubled to 6 by the training treat buff.
    expect(active(state).relationshipState.bondXp - bondBefore).toBe(6);
  });
});
