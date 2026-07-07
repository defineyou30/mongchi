import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  createInitialCareStreak,
  createInitialPrototypeSession,
  deriveAmbientPetAssetState,
  didStreakJustUseGrace,
  getActivePetBundle,
  getCareStatBand,
  getCareStreakSnackReward,
  getStreakGraceReturnLine,
  hasCaredToday,
  performPrototypeCareAction,
  projectCareStreakForNow,
  STREAK_SNACK_ITEM_ID,
  STREAK_SPECIAL_SNACK_ITEM_ID,
  updateCareStreakOnCare,
  updatePrototypeDraft
} from "../index";
import { mockCareState } from "../mock/mockData";

const active = getActivePetBundle;

describe("care stat bands", () => {
  it("maps meter values to bands", () => {
    expect(getCareStatBand(0)).toBe("critical");
    expect(getCareStatBand(19)).toBe("critical");
    expect(getCareStatBand(20)).toBe("low");
    expect(getCareStatBand(44)).toBe("low");
    expect(getCareStatBand(45)).toBe("okay");
    expect(getCareStatBand(74)).toBe("okay");
    expect(getCareStatBand(75)).toBe("great");
    expect(getCareStatBand(100)).toBe("great");
  });
});

describe("care streak", () => {
  it("counts one step per local day and grows on consecutive days", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-24T01:00:00.000Z");
    expect(streak.current).toBe(1);

    streak = updateCareStreakOnCare(streak, "2026-06-24T05:00:00.000Z");
    expect(streak.current).toBe(1);
    expect(hasCaredToday(streak, "2026-06-24T06:00:00.000Z")).toBe(true);

    streak = updateCareStreakOnCare(streak, "2026-06-25T01:00:00.000Z");
    expect(streak.current).toBe(2);
    expect(streak.best).toBe(2);
  });

  it("resets to 1 after a skipped day but keeps the best record", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-24T01:00:00.000Z");
    streak = updateCareStreakOnCare(streak, "2026-06-25T01:00:00.000Z");
    streak = updateCareStreakOnCare(streak, "2026-06-28T01:00:00.000Z");

    expect(streak.current).toBe(1);
    expect(streak.best).toBe(2);
  });

  it("projects a broken streak to zero for display without mutating history", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-24T01:00:00.000Z");

    expect(projectCareStreakForNow(streak, "2026-06-25T01:00:00.000Z").current).toBe(1);
    expect(projectCareStreakForNow(streak, "2026-06-27T01:00:00.000Z").current).toBe(0);
    expect(streak.current).toBe(1);
  });
});

describe("care streak one-day grace", () => {
  it("keeps the streak alive (and growing) across exactly one skipped day", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-24T09:00:00.000Z"); // day 1
    streak = updateCareStreakOnCare(streak, "2026-06-25T09:00:00.000Z"); // day 2
    // 06-26 skipped entirely -- exactly one day gap.
    streak = updateCareStreakOnCare(streak, "2026-06-27T09:00:00.000Z");

    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    expect(streak.graceUsedAt).toBe("2026-06-27T09:00:00.000Z");
  });

  it("still resets to 1 when two or more days are skipped, regardless of grace availability", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-24T09:00:00.000Z");
    streak = updateCareStreakOnCare(streak, "2026-06-25T09:00:00.000Z");
    // 06-26 and 06-27 both skipped -- a two-day gap, beyond the one-day grace.
    streak = updateCareStreakOnCare(streak, "2026-06-28T09:00:00.000Z");

    expect(streak.current).toBe(1);
    expect(streak.graceUsedAt).toBeFalsy();
  });

  it("does not grant a second grace within 7 days of the last one, resetting instead", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-24T09:00:00.000Z"); // day 1
    streak = updateCareStreakOnCare(streak, "2026-06-25T09:00:00.000Z"); // day 2
    streak = updateCareStreakOnCare(streak, "2026-06-27T09:00:00.000Z"); // grace used, streak 3
    expect(streak.graceUsedAt).toBe("2026-06-27T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-28T09:00:00.000Z"); // day 4
    // Only 2 days after the last grace use -- still within the 7-day cooldown.
    streak = updateCareStreakOnCare(streak, "2026-06-30T09:00:00.000Z");

    expect(streak.current).toBe(1);
  });

  it("allows a fresh grace once 7 days have passed since the last one", () => {
    let streak = createInitialCareStreak("2026-06-01T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-01T09:00:00.000Z"); // day 1
    streak = updateCareStreakOnCare(streak, "2026-06-02T09:00:00.000Z"); // day 2
    streak = updateCareStreakOnCare(streak, "2026-06-04T09:00:00.000Z"); // skip 06-03 -- grace used, streak 3
    expect(streak.graceUsedAt).toBe("2026-06-04T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-05T09:00:00.000Z"); // day 4
    streak = updateCareStreakOnCare(streak, "2026-06-06T09:00:00.000Z"); // day 5
    streak = updateCareStreakOnCare(streak, "2026-06-07T09:00:00.000Z"); // day 6
    streak = updateCareStreakOnCare(streak, "2026-06-08T09:00:00.000Z"); // day 7
    streak = updateCareStreakOnCare(streak, "2026-06-09T09:00:00.000Z"); // day 8
    streak = updateCareStreakOnCare(streak, "2026-06-10T09:00:00.000Z"); // day 9
    streak = updateCareStreakOnCare(streak, "2026-06-11T09:00:00.000Z"); // day 10
    // 7 full days after the last grace use (06-04 -> 06-11), so skipping
    // 06-12 and returning on 06-13 is eligible for a fresh grace.
    streak = updateCareStreakOnCare(streak, "2026-06-13T09:00:00.000Z");

    expect(streak.current).toBe(11);
    expect(streak.graceUsedAt).toBe("2026-06-13T09:00:00.000Z");
  });

  it("keeps a saved grace-eligible streak displayed (not projected to zero) while grace is still available", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");

    streak = updateCareStreakOnCare(streak, "2026-06-24T09:00:00.000Z");
    streak = updateCareStreakOnCare(streak, "2026-06-25T09:00:00.000Z");

    // One day skipped (06-26) -- grace has not been "spent" yet (no care action
    // has happened on 06-27), but the display should not scare the user with a
    // premature reset while grace is still on offer.
    const projected = projectCareStreakForNow(streak, "2026-06-27T09:00:00.000Z");
    expect(projected.current).toBe(2);
  });

  it("reports didStreakJustUseGrace true only on the turn grace actually fires", () => {
    let streak = createInitialCareStreak("2026-06-24T09:00:00.000Z");
    streak = updateCareStreakOnCare(streak, "2026-06-24T09:00:00.000Z");
    const beforeGrace = updateCareStreakOnCare(streak, "2026-06-25T09:00:00.000Z");

    expect(didStreakJustUseGrace(streak, beforeGrace)).toBe(false);

    const afterGrace = updateCareStreakOnCare(beforeGrace, "2026-06-27T09:00:00.000Z");
    expect(didStreakJustUseGrace(beforeGrace, afterGrace)).toBe(true);

    // A later, unrelated care action must not keep reporting "just used".
    const laterAction = updateCareStreakOnCare(afterGrace, "2026-06-28T09:00:00.000Z");
    expect(didStreakJustUseGrace(afterGrace, laterAction)).toBe(false);
  });

  it("returns a warm, non-guilt-tripping return line naming the pet", () => {
    const line = getStreakGraceReturnLine("Miso");

    expect(line).toBe("Miso kept your streak warm while you were away.");
    expect(line.toLowerCase()).not.toContain("lost");
    expect(line.toLowerCase()).not.toContain("broke");
  });
});

describe("care streak snack reward lookup", () => {
  it("has no reward below day 3", () => {
    expect(getCareStreakSnackReward(0)).toBeNull();
    expect(getCareStreakSnackReward(1)).toBeNull();
    expect(getCareStreakSnackReward(2)).toBeNull();
    expect(getCareStreakSnackReward(4)).toBeNull();
  });

  it("grants a plain snack on non-7 multiples of 3", () => {
    expect(getCareStreakSnackReward(3)).toEqual({ itemId: STREAK_SNACK_ITEM_ID, special: false });
    expect(getCareStreakSnackReward(6)).toEqual({ itemId: STREAK_SNACK_ITEM_ID, special: false });
    expect(getCareStreakSnackReward(9)).toEqual({ itemId: STREAK_SNACK_ITEM_ID, special: false });
  });

  it("grants the special snack on day 7 and every multiple of 7 after that", () => {
    expect(getCareStreakSnackReward(7)).toEqual({ itemId: STREAK_SPECIAL_SNACK_ITEM_ID, special: true });
    expect(getCareStreakSnackReward(14)).toEqual({ itemId: STREAK_SPECIAL_SNACK_ITEM_ID, special: true });
  });

  it("prefers the special snack over the plain one when day 21 hits both cadences", () => {
    expect(getCareStreakSnackReward(21)).toEqual({ itemId: STREAK_SPECIAL_SNACK_ITEM_ID, special: true });
  });
});

describe("care streak snack reward integration", () => {
  const buildAcceptedPet = (now: string) =>
    acceptPrototypeGeneratedPet(updatePrototypeDraft(createInitialPrototypeSession(now), { name: "Miso" }), now);

  it("grants a snack into the inventory the day the streak reaches 3, not on day 4", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:01:00.000Z"); // day 1
    state = performPrototypeCareAction(state, "talk", "2026-06-25T09:01:00.000Z"); // day 2
    state = performPrototypeCareAction(state, "talk", "2026-06-26T09:01:00.000Z"); // day 3 -- snack day

    expect(state.careStreak.current).toBe(3);
    const snackEntry = state.inventory.items.find((entry) => entry.itemId === STREAK_SNACK_ITEM_ID && entry.source === "streak_reward");
    expect(snackEntry).toBeDefined();
    expect(snackEntry?.quantity).toBe(1);

    state = performPrototypeCareAction(state, "talk", "2026-06-27T09:01:00.000Z"); // day 4 -- no new snack

    const snackEntryAfterDay4 = state.inventory.items.find((entry) => entry.itemId === STREAK_SNACK_ITEM_ID && entry.source === "streak_reward");
    expect(snackEntryAfterDay4?.quantity).toBe(1);
  });

  it("does not re-grant a snack for a second care action on the same streak day", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:01:00.000Z"); // day 1
    state = performPrototypeCareAction(state, "talk", "2026-06-25T09:01:00.000Z"); // day 2
    state = performPrototypeCareAction(state, "talk", "2026-06-26T09:01:00.000Z"); // day 3 -- snack day
    state = performPrototypeCareAction(state, "talk", "2026-06-26T14:00:00.000Z"); // still day 3

    const snackEntry = state.inventory.items.find((entry) => entry.itemId === STREAK_SNACK_ITEM_ID && entry.source === "streak_reward");
    expect(snackEntry?.quantity).toBe(1);
  });

  it("grants the special snack on the 7-day streak", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    const dayKeys = [
      "2026-06-24T09:01:00.000Z",
      "2026-06-25T09:01:00.000Z",
      "2026-06-26T09:01:00.000Z",
      "2026-06-27T09:01:00.000Z",
      "2026-06-28T09:01:00.000Z",
      "2026-06-29T09:01:00.000Z",
      "2026-06-30T09:01:00.000Z"
    ];

    for (const day of dayKeys) {
      state = performPrototypeCareAction(state, "talk", day);
    }

    expect(state.careStreak.current).toBe(7);
    const specialEntry = state.inventory.items.find(
      (entry) => entry.itemId === STREAK_SPECIAL_SNACK_ITEM_ID && entry.source === "streak_reward"
    );
    expect(specialEntry).toBeDefined();
  });

  it("restarts the snack cadence after the streak resets", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:01:00.000Z"); // day 1
    state = performPrototypeCareAction(state, "talk", "2026-06-25T09:01:00.000Z"); // day 2
    state = performPrototypeCareAction(state, "talk", "2026-06-26T09:01:00.000Z"); // day 3 -- snack

    expect(state.careStreak.current).toBe(3);

    // Skip several days -- streak resets to 1 on the next care action.
    state = performPrototypeCareAction(state, "talk", "2026-07-02T09:01:00.000Z");
    expect(state.careStreak.current).toBe(1);

    state = performPrototypeCareAction(state, "talk", "2026-07-03T09:01:00.000Z"); // day 2 of new streak
    state = performPrototypeCareAction(state, "talk", "2026-07-04T09:01:00.000Z"); // day 3 of new streak -- snack again

    expect(state.careStreak.current).toBe(3);
    const snackEntry = state.inventory.items.find((entry) => entry.itemId === STREAK_SNACK_ITEM_ID && entry.source === "streak_reward");
    expect(snackEntry?.quantity).toBe(2);
  });
});

describe("care streak grace integration (return session surfacing)", () => {
  const buildAcceptedPet = (now: string) =>
    acceptPrototypeGeneratedPet(updatePrototypeDraft(createInitialPrototypeSession(now), { name: "Miso" }), now);

  it("surfaces the warm grace-return line as the session's reaction when grace kicks in", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:01:00.000Z"); // day 1
    state = performPrototypeCareAction(state, "talk", "2026-06-25T09:01:00.000Z"); // day 2
    // 06-26 skipped entirely -- one-day grace should kick in on return.
    state = performPrototypeCareAction(state, "talk", "2026-06-27T09:01:00.000Z");

    expect(state.careStreak.current).toBe(3);
    expect(state.careStreak.graceUsedAt).toBe("2026-06-27T09:01:00.000Z");
    expect(active(state).currentReaction?.line).toBe(getStreakGraceReturnLine("Miso"));
  });

  it("still grants the day-3 snack into inventory even when the grace return line takes the reaction slot", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:01:00.000Z"); // day 1
    state = performPrototypeCareAction(state, "talk", "2026-06-25T09:01:00.000Z"); // day 2
    state = performPrototypeCareAction(state, "talk", "2026-06-27T09:01:00.000Z"); // grace -> streak 3, snack day

    const snackEntry = state.inventory.items.find((entry) => entry.itemId === STREAK_SNACK_ITEM_ID && entry.source === "streak_reward");
    expect(snackEntry?.quantity).toBe(1);
    expect(active(state).currentReaction?.line).toBe(getStreakGraceReturnLine("Miso"));
  });

  it("does not show the grace line on an ordinary consecutive-day care action", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:01:00.000Z"); // day 1
    state = performPrototypeCareAction(state, "talk", "2026-06-25T09:01:00.000Z"); // day 2 -- no gap, no grace

    expect(state.careStreak.graceUsedAt).toBeFalsy();
    expect(active(state).currentReaction?.line).not.toBe(getStreakGraceReturnLine("Miso"));
  });
});

describe("ambient pet expression", () => {
  const healthy = { ...mockCareState, satiety: 80, happiness: 80, energy: 80, affection: 80, gardenHealth: 80, cleanliness: 80 };

  it("shows sick when two or more meters are critical", () => {
    expect(deriveAmbientPetAssetState({ ...healthy, satiety: 10, happiness: 12 })).toBe("sick");
  });

  it("prioritizes hunger, exhaustion, and messiness in that order", () => {
    expect(deriveAmbientPetAssetState({ ...healthy, satiety: 10 })).toBe("hungry");
    expect(deriveAmbientPetAssetState({ ...healthy, energy: 10 })).toBe("sleep");
    expect(deriveAmbientPetAssetState({ ...healthy, cleanliness: 10 })).toBe("messy");
  });

  it("shows sad on low happiness and happy when glowing", () => {
    expect(deriveAmbientPetAssetState({ ...healthy, happiness: 30 })).toBe("sad");
    expect(deriveAmbientPetAssetState(healthy, "glowing")).toBe("happy");
    expect(deriveAmbientPetAssetState(healthy)).toBe("idle");
  });
});
