import { describe, expect, it } from "vitest";

import { applyLocalCareAction, getCareDaysAway, getCareSatisfactionScore, getCareSatisfactionSummary, mockCareState, projectCareStateForTime } from "../index";

describe("local care actions", () => {
  it("feed increases satiety and marks last fed time", () => {
    const result = applyLocalCareAction(mockCareState, {
      action: "feed",
      occurredAt: "2026-06-24T10:00:00.000Z"
    });

    expect(result.nextState.satiety).toBeGreaterThan(mockCareState.satiety);
    expect(result.nextState.happiness).toBeGreaterThan(mockCareState.happiness);
    expect(result.nextState.lastFedAt).toBe("2026-06-24T10:00:00.000Z");
  });

  it("play trades energy and cleanliness for happiness", () => {
    const result = applyLocalCareAction(mockCareState, {
      action: "play",
      occurredAt: "2026-06-24T10:05:00.000Z"
    });

    expect(result.nextState.energy).toBeLessThan(mockCareState.energy);
    expect(result.nextState.cleanliness).toBeLessThan(mockCareState.cleanliness);
    expect(result.nextState.happiness).toBeGreaterThan(mockCareState.happiness);
  });

  it("rest restores energy with a small mood lift", () => {
    const result = applyLocalCareAction(
      {
        ...mockCareState,
        energy: 18,
        happiness: 42
      },
      {
        action: "rest",
        occurredAt: "2026-06-24T10:05:00.000Z"
      }
    );

    expect(result.nextState.energy).toBeGreaterThan(18);
    expect(result.nextState.happiness).toBeGreaterThan(42);
  });

  it("projects care meters softly as time passes without creating a failure state", () => {
    const current = projectCareStateForTime(mockCareState, "2026-06-25T15:00:00.000Z");

    // Neglect decay never fully bottoms out -- a returning owner always has a
    // floor of 15 to work with instead of a wall of zeros (see the mongchi
    // "케어 체감 밸런스" fix).
    expect(current.satiety).toBe(15);
    expect(current.happiness).toBe(15);
    expect(current.energy).toBe(47);
    expect(current.cleanliness).toBe(49);
    expect(current.gardenHealth).toBe(49);
    expect(current.affection).toBeLessThan(mockCareState.affection);
    expect(current.updatedAt).toBe("2026-06-25T15:00:00.000Z");
  });

  it("derives full days away from the last interaction time", () => {
    expect(getCareDaysAway(mockCareState, "2026-06-24T23:00:00.000Z")).toBe(0);
    expect(getCareDaysAway(mockCareState, "2026-06-25T09:00:00.000Z")).toBe(1);
    expect(getCareDaysAway(mockCareState, "2026-06-28T10:00:00.000Z")).toBe(4);
  });

  it("applies actions on top of the time-projected care state", () => {
    const result = applyLocalCareAction(mockCareState, {
      action: "feed",
      occurredAt: "2026-06-25T15:00:00.000Z"
    });

    expect(result.previousState.satiety).toBe(15);
    // Catchup amplifies the +28 base gain because satiety was deep below the
    // 40 catchup threshold (floored at 15) -- see the mongchi "케어 체감
    // 밸런스" fix so neglect-recovery actions actually move the needle.
    expect(result.nextState.satiety).toBe(61);
    expect(result.nextState.lastFedAt).toBe("2026-06-25T15:00:00.000Z");
  });

  it("derives satisfaction from current care meters and interaction freshness", () => {
    const freshScore = getCareSatisfactionScore(mockCareState, "2026-06-24T09:30:00.000Z");
    const staleScore = getCareSatisfactionScore(mockCareState, "2026-06-28T09:30:00.000Z");

    expect(freshScore).toBe(67);
    expect(staleScore).toBeLessThan(freshScore);
  });

  it("summarizes satisfaction into a mood label and the most useful care need", () => {
    const summary = getCareSatisfactionSummary(
      {
        ...mockCareState,
        satiety: 12,
        happiness: 44,
        cleanliness: 44,
        energy: 44,
        gardenHealth: 44,
        lastInteractionAt: "2026-06-24T09:00:00.000Z"
      },
      "2026-06-24T09:30:00.000Z"
    );

    expect(summary.label).toBe("Needs care");
    expect(summary.primaryNeed).toBe("food");
    expect(summary.recommendedAction).toBe("feed");
    expect(summary.recommendedActionLabel).toBe("Feed");
    expect(summary.hint).toBe("A meal would help most.");
    expect(summary.breakdown.satiety).toBe(12);
  });

  it("recommends water when thirst is the weakest visible care need", () => {
    const summary = getCareSatisfactionSummary(
      {
        ...mockCareState,
        satiety: 80,
        happiness: 76,
        cleanliness: 74,
        energy: 72,
        gardenHealth: 18,
        lastInteractionAt: "2026-06-24T09:00:00.000Z"
      },
      "2026-06-24T09:30:00.000Z"
    );

    expect(summary.primaryNeed).toBe("thirst");
    expect(summary.recommendedAction).toBe("water_garden");
    expect(summary.recommendedActionLabel).toBe("Water");
  });

  it("recommends rest when energy is the weakest visible care need", () => {
    const summary = getCareSatisfactionSummary(
      {
        ...mockCareState,
        satiety: 80,
        happiness: 76,
        cleanliness: 74,
        energy: 18,
        gardenHealth: 72,
        lastInteractionAt: "2026-06-24T09:00:00.000Z"
      },
      "2026-06-24T09:30:00.000Z"
    );

    expect(summary.primaryNeed).toBe("rest");
    expect(summary.recommendedAction).toBe("rest");
    expect(summary.recommendedActionLabel).toBe("Rest");
  });

  it("applies special action items as stronger but still capped care boosts", () => {
    const basePlay = applyLocalCareAction(
      {
        ...mockCareState,
        happiness: 40,
        affection: 40
      },
      {
        action: "play",
        occurredAt: "2026-06-24T10:05:00.000Z"
      }
    );
    const plushPlay = applyLocalCareAction(
      {
        ...mockCareState,
        happiness: 40,
        affection: 40
      },
      {
        action: "play",
        itemId: "item_plush_toy_buddy",
        occurredAt: "2026-06-24T10:05:00.000Z"
      }
    );

    expect(plushPlay.nextState.happiness).toBeGreaterThan(basePlay.nextState.happiness);
    expect(plushPlay.nextState.affection).toBeGreaterThan(basePlay.nextState.affection);
  });

  it("gives the Rose Cushion affection action a bonus energy lift, standing in for a rest moment (see mongchi Tier 4 item individuality)", () => {
    const baseAffection = applyLocalCareAction(
      { ...mockCareState, energy: 50 },
      {
        action: "affection",
        occurredAt: "2026-06-24T10:05:00.000Z"
      }
    );
    const cushionAffection = applyLocalCareAction(
      { ...mockCareState, energy: 50 },
      {
        action: "affection",
        itemId: "item_cushion_rose",
        occurredAt: "2026-06-24T10:05:00.000Z"
      }
    );

    // Base affection has no energy effect at all; the cushion adds one on
    // top, roughly half of rest's own +28 gain -- a real nap-sized bonus
    // without fully substituting for the dedicated rest action.
    expect(baseAffection.nextState.energy).toBe(50);
    expect(cushionAffection.nextState.energy).toBeGreaterThan(baseAffection.nextState.energy);
  });
});
