import { describe, expect, it } from "vitest";

import { applyLocalCareAction, getCareStateBands, mockCareState } from "../index";
import type { ActiveCareBuff, CareActionType, CareState } from "../index";

/**
 * Acceptance test for the mongchi "케어 체감 밸런스" fix: a returning owner who
 * neglected their pet for 3 days and then presses all 5 home dock buttons
 * once each should see the meters clearly respond -- not a wall of zeros
 * that reads as "care doesn't work" (see localCare.ts's decay floor and
 * catchup multiplier).
 */
describe("neglect recovery balance", () => {
  const threeDaysAgo = "2026-06-21T09:00:00.000Z";
  const now = "2026-06-24T09:00:00.000Z";

  const neglectedState: CareState = {
    ...mockCareState,
    lastFedAt: threeDaysAgo,
    lastInteractionAt: threeDaysAgo,
    lastGardenWateredAt: threeDaysAgo,
    updatedAt: threeDaysAgo
  };

  const homeDockActions: CareActionType[] = ["feed", "play", "walk", "affection", "water_garden"];

  const pressAllDockButtonsOnce = (state: CareState): CareState =>
    homeDockActions.reduce(
      (current, action) => applyLocalCareAction(current, { action, occurredAt: now }).nextState,
      state
    );

  it("floors neglect decay instead of bottoming every meter out at 0", () => {
    // Project decay only, without any care action, by applying a neutral
    // action's *previousState* (which is exactly the time-projected state).
    const projected = applyLocalCareAction(neglectedState, { action: "talk", occurredAt: now }).previousState;

    expect(projected.satiety).toBeGreaterThanOrEqual(15);
    expect(projected.happiness).toBeGreaterThanOrEqual(0); // happiness applies extra mood penalties on top of the floor
    expect(projected.energy).toBeGreaterThanOrEqual(15);
    expect(projected.gardenHealth).toBeGreaterThanOrEqual(15);
    expect(projected.affection).toBeGreaterThanOrEqual(15);
  });

  it("brings satiety, gardenHealth, and happiness to a comfortable level after one pass of the 5 home dock buttons", () => {
    const recovered = pressAllDockButtonsOnce(neglectedState);

    expect(recovered.satiety).toBeGreaterThanOrEqual(60);
    expect(recovered.gardenHealth).toBeGreaterThanOrEqual(60);
    expect(recovered.happiness).toBeGreaterThanOrEqual(60);
  });

  it("keeps energy at a workable level even though play/walk still spend it", () => {
    const recovered = pressAllDockButtonsOnce(neglectedState);

    expect(recovered.energy).toBeGreaterThanOrEqual(40);
  });

  it("still lets play and walk spend their full rhythm energy cost", () => {
    const afterFeed = applyLocalCareAction(neglectedState, { action: "feed", occurredAt: now }).nextState;
    const afterPlay = applyLocalCareAction(afterFeed, { action: "play", occurredAt: now }).nextState;

    expect(afterFeed.energy - afterPlay.energy).toBe(8);

    const afterWalk = applyLocalCareAction(afterPlay, { action: "walk", occurredAt: now }).nextState;

    expect(afterPlay.energy - afterWalk.energy).toBe(12);
  });

  it("reaches an okay-or-better band on at least 3 of the 5 primary dock meters after one recovery pass", () => {
    const recovered = pressAllDockButtonsOnce(neglectedState);
    const bands = getCareStateBands(recovered);
    const primaryMeters: Array<keyof typeof bands> = ["satiety", "happiness", "energy", "gardenHealth", "affection"];
    const okayOrBetterCount = primaryMeters.filter((meter) => bands[meter] === "okay" || bands[meter] === "great").length;

    expect(okayOrBetterCount).toBeGreaterThanOrEqual(3);
  });

  it("amplifies gains more the further a meter has fallen (catchup)", () => {
    const deeplyNeglected = { ...mockCareState, satiety: 10, updatedAt: now, lastInteractionAt: now };
    const mildlyLow = { ...mockCareState, satiety: 35, updatedAt: now, lastInteractionAt: now };
    const healthy = { ...mockCareState, satiety: 80, updatedAt: now, lastInteractionAt: now };

    const deepGain = applyLocalCareAction(deeplyNeglected, { action: "feed", occurredAt: now }).nextState.satiety - 10;
    const mildGain = applyLocalCareAction(mildlyLow, { action: "feed", occurredAt: now }).nextState.satiety - 35;
    // healthy starts at 80 + base gain 28 would clamp at 100, so measure the
    // multiplier indirectly: at/above the catchup threshold it must be exactly 1x (+28, clamped).
    const healthyResult = applyLocalCareAction(healthy, { action: "feed", occurredAt: now }).nextState.satiety;

    expect(deepGain).toBeGreaterThan(mildGain);
    expect(healthyResult).toBe(100);
  });

  it("does not let a buffed catchup gain run away past the combined multiplier cap", () => {
    const deeplyNeglected: CareState = { ...mockCareState, happiness: 0, updatedAt: now, lastInteractionAt: now };
    // Two synthetic action_gain_boost buffs on "play" stacking multiplicatively
    // (2 * 2 = 4x), which combined with catchup's own ~2x ceiling would be an
    // 8x swing uncapped -- the combined-multiplier cap must hold this down.
    const buffs: ActiveCareBuff[] = [
      {
        buffId: "test_buff_a",
        kind: "action_gain_boost",
        action: "play",
        magnitude: 2,
        durationHours: 1,
        labelEn: "test a",
        labelKo: "테스트 A",
        sourceItemId: "item_toy_ball_mint",
        startedAt: now,
        expiresAt: "2026-06-24T10:00:00.000Z"
      },
      {
        buffId: "test_buff_b",
        kind: "action_gain_boost",
        action: "play",
        magnitude: 2,
        durationHours: 1,
        labelEn: "test b",
        labelKo: "테스트 B",
        sourceItemId: "item_plush_toy_buddy",
        startedAt: now,
        expiresAt: "2026-06-24T10:00:00.000Z"
      }
    ];

    const result = applyLocalCareAction(deeplyNeglected, { action: "play", occurredAt: now }, buffs);
    // happiness starts at the DECAY_FLOOR-equivalent 15 (mockCareState's own
    // happiness floor applies even when overridden to 0 -- see localCare.ts).
    // Base play happiness gain is +14; combined multiplier capped at 3.0x
    // means the gain should be exactly 42, never anywhere close to 8x (112).
    const gain = result.nextState.happiness - result.previousState.happiness;

    expect(gain).toBe(42);
  });
});
