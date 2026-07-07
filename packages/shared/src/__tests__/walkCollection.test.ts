import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  addToWalkCollection,
  claimPrototypeWalkReward,
  createInitialPrototypeSession,
  getSpendableCreditBalance,
  getWalkCollectionProgress,
  isWalkCollectionComplete,
  refreshPrototypeWalk,
  rollWalkCollectible,
  startPrototypeWalk,
  walkCollectibles,
  WALK_COLLECTION_COMPLETE_CREDITS
} from "../index";
import type { WalkCollectionState } from "../index";

const now = "2026-06-24T09:00:00.000Z";

describe("walk collectible rolls", () => {
  it("is deterministic for the same walk seed and respects weather pools", () => {
    const first = rollWalkCollectible("rain", "walk_12345");
    const second = rollWalkCollectible("rain", "walk_12345");

    expect(first.id).toBe(second.id);

    if (first.rarity === "common") {
      expect(first.weather.length === 0 || first.weather.includes("rain")).toBe(true);
    }
  });

  it("tracks first finds and duplicate counts", () => {
    let collection: WalkCollectionState = {};

    const firstAdd = addToWalkCollection(collection, "col_rain_bead", now);
    expect(firstAdd.isNew).toBe(true);
    collection = firstAdd.collection;

    const secondAdd = addToWalkCollection(collection, "col_rain_bead", now);
    expect(secondAdd.isNew).toBe(false);
    expect(secondAdd.collection.col_rain_bead?.count).toBe(2);
  });

  it("reports completion and progress", () => {
    const full: WalkCollectionState = Object.fromEntries(
      walkCollectibles.map((collectible) => [collectible.id, { count: 1, firstFoundAt: now }])
    );

    expect(isWalkCollectionComplete(full)).toBe(true);
    expect(getWalkCollectionProgress(full)).toEqual({ found: walkCollectibles.length, total: walkCollectibles.length });
    expect(isWalkCollectionComplete({})).toBe(false);
  });
});

describe("walk claim collects discoveries", () => {
  it("adds a collectible to the journal when the walk reward is claimed", () => {
    let state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);
    state = refreshPrototypeWalk(state, "2026-06-24T09:01:01.000Z");
    state = claimPrototypeWalkReward(state, "2026-06-24T09:01:02.000Z");

    expect(state.lastWalkDiscovery).not.toBeNull();
    expect(state.lastWalkDiscovery?.isNew).toBe(true);
    expect(getWalkCollectionProgress(state.walkCollection).found).toBe(1);
    expect(state.currentReaction?.ruleId).toContain("walk_discovery_");
  });

  it("grants the completion bonus when the final collectible is found", () => {
    let state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);
    state = refreshPrototypeWalk(state, "2026-06-24T09:01:01.000Z");

    // Pre-fill the journal with everything except what this walk will find.
    const pending = rollWalkCollectible(state.weatherState.context.condition, state.activeWalk!.id);
    const nearlyFull: WalkCollectionState = Object.fromEntries(
      walkCollectibles.filter((collectible) => collectible.id !== pending.id).map((collectible) => [collectible.id, { count: 1, firstFoundAt: now }])
    );
    state = { ...state, walkCollection: nearlyFull };

    const spendableBefore = getSpendableCreditBalance(state.wallet);
    const bonusCreditsBefore = state.wallet.bonusCredits;
    const creditsBefore = state.wallet.credits;

    state = claimPrototypeWalkReward(state, "2026-06-24T09:01:02.000Z");

    expect(isWalkCollectionComplete(state.walkCollection)).toBe(true);
    expect(state.lastWalkDiscovery?.collectionCompleted).toBe(true);
    // The completion bonus must land in bonusCredits (play-earned bucket),
    // never the paid credits bucket.
    expect(state.wallet.bonusCredits).toBe(bonusCreditsBefore + WALK_COLLECTION_COMPLETE_CREDITS);
    expect(state.wallet.credits).toBe(creditsBefore);
    expect(getSpendableCreditBalance(state.wallet)).toBe(spendableBefore + WALK_COLLECTION_COMPLETE_CREDITS);
    expect(state.currentReaction?.ruleId).toBe("walk_collection_complete");
  });
});
