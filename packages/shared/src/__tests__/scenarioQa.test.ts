import { describe, expect, it } from "vitest";

import type { CareActionType, PrototypeSessionState } from "../index";
import {
  acceptPrototypeGeneratedPet,
  createInitialPrototypeSession,
  createManualWeatherContext,
  getActivePetBundle,
  mockCareState,
  performPrototypeCareAction,
  claimPrototypeWalkReward,
  refreshPrototypeWalk,
  selectPetStatusLine,
  setPrototypeWeatherCondition,
  updatePrototypeDraft
} from "../index";

const active = getActivePetBundle;

const createAcceptedSession = (): PrototypeSessionState =>
  acceptPrototypeGeneratedPet(
    updatePrototypeDraft(createInitialPrototypeSession("2026-06-24T07:00:00.000Z"), {
      name: "Miso"
    }),
    "2026-06-24T07:01:00.000Z"
  );

const careScenarioActions = ["feed", "water_garden", "play", "affection", "talk", "rest", "treat", "walk"] as const satisfies readonly CareActionType[];

describe("scenario QA contracts", () => {
  it("exercises every home care action without leaving stale walk rewards", () => {
    for (const [index, action] of careScenarioActions.entries()) {
      let state = createAcceptedSession();

      if (action === "treat") {
        state = {
          ...state,
          inventory: {
            ...state.inventory,
            items: [
              ...state.inventory.items,
              {
                itemId: "item_treat_plate_biscuit",
                quantity: 1,
                acquiredAt: "2026-06-24T07:10:00.000Z",
                source: "purchase"
              }
            ]
          }
        };
      }

      state = performPrototypeCareAction(state, action, `2026-06-24T08:${String(index).padStart(2, "0")}:00.000Z`);

      expect(active(state).currentReaction).toBeTruthy();
      expect(active(state).relationshipState.totalCareActions).toBeGreaterThan(8);

      if (action === "walk") {
        expect(active(state).activeWalk?.status).toBe("walking");
        expect(active(state).careState.activeWalkId).toBe(active(state).activeWalk?.id);

        const returned = refreshPrototypeWalk(state, "2026-06-24T08:20:00.000Z");

        expect(active(returned).activeWalk?.status).toBe("returned");

        const claimed = claimPrototypeWalkReward(returned, "2026-06-24T08:21:00.000Z");

        expect(active(claimed).activeWalk).toBeNull();
        expect(active(claimed).careState.activeWalkId).toBeUndefined();
        expect(claimed.inventory.items.find((entry) => entry.source === "walk_reward")).toBeDefined();
      } else {
        expect(active(state).activeWalk).toBeNull();
      }
    }
  });

  it("treats the water action as pet hydration only, with no other reward side effects", () => {
    const baseState = createAcceptedSession();
    const state = performPrototypeCareAction(baseState, "water_garden", "2026-06-24T08:05:00.000Z");

    expect(active(state).careState.gardenHealth).toBeGreaterThan(80);
    expect(active(state).lastCareReward).toBeNull();
  });

  it("keeps weather, time, urgent needs, and recent actions from collapsing into one repeated line", () => {
    const stableCareState = {
      ...mockCareState,
      satiety: 82,
      happiness: 82,
      energy: 80,
      gardenHealth: 80,
      cleanliness: 80
    };
    const scenarios = [
      selectPetStatusLine({
        petName: "Miso",
        now: "2026-06-24T09:00:00.000Z",
        careState: {
          ...stableCareState,
          satiety: 18
        }
      }),
      selectPetStatusLine({
        petName: "Miso",
        now: "2026-06-24T13:00:00.000Z",
        careState: {
          ...stableCareState,
          gardenHealth: 22
        },
        weather: createManualWeatherContext("hot", "2026-06-24T13:00:00.000Z")
      }),
      selectPetStatusLine({
        petName: "Miso",
        now: "2026-06-24T13:20:00.000Z",
        careState: stableCareState,
        weather: createManualWeatherContext("rain", "2026-06-24T13:20:00.000Z")
      }),
      selectPetStatusLine({
        petName: "Miso",
        now: "2026-06-24T18:00:00.000Z",
        careState: stableCareState,
        recentAction: "play"
      }),
      selectPetStatusLine({
        petName: "Miso",
        now: "2026-06-28T09:00:00.000Z",
        careState: stableCareState,
        daysAway: 4
      })
    ];

    expect(scenarios.map((scenario) => scenario.source)).toEqual([
      "urgent_need",
      "urgent_need",
      "weather_time",
      "recent_action",
      "return"
    ]);
    expect(new Set(scenarios.map((scenario) => scenario.line)).size).toBe(scenarios.length);
  });

  it("threads manual weather into walk discovery and status copy", () => {
    let state = createAcceptedSession();

    state = setPrototypeWeatherCondition(state, "rain", "2026-06-24T08:00:00.000Z");
    state = performPrototypeCareAction(state, "walk", "2026-06-24T08:01:00.000Z");

    expect(state.weatherState.context.condition).toBe("rain");
    expect(active(state).activeWalk?.discoveryLine).toContain("rainy");
    expect(active(state).currentReaction?.ruleId).toBe("en_weather_rain_walk_001");
  });
});
