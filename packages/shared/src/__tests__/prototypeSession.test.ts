import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  advancePrototypeGeneration,
  canCreatePet,
  canContinuePetSetup,
  canContinuePhotoStep,
  createInitialPrototypeSession,
  deletePrototypeOriginalPhoto,
  mockItems,
  failPrototypeGeneration,
  getGenerationAttemptKey,
  getMonotonicGenerationProgress,
  getPrototypeGenerationPollSnapshot,
  getSpendableCreditBalance,
  normalizeRestoredGeneration,
  pollPrototypeGenerationJob,
  performPrototypeCareAction,
  claimPrototypeWalkReward,
  completePrototypeWalkEarlyWithCredit,
  getActivePetBundle,
  purchasePrototypeThemeBundle,
  refreshPrototypeWalk,
  reportPrototypeGenerationIssue,
  retryPrototypeGeneration,
  selectGeneratedAssetForReaction,
  setPrototypeConsentAccepted,
  setPrototypeMockPhotoSelected,
  setPrototypeSelectedPhotoUri,
  setPrototypeWeatherCondition,
  setPrototypeWeatherEnabled,
  startPrototypeGeneration,
  startPrototypeWalk,
  togglePrototypePersonalityTag,
  updatePrototypeDraft,
  withActivePetBundle
} from "../index";
import { generatedAssetStates } from "../domain";
import type { GeneratedAsset } from "../domain";
import type { PrototypeSessionState } from "../session/prototypeSession";

const active = getActivePetBundle;

describe("prototype first-session state", () => {
  it("moves from setup to completed generation and accepted pet", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    state = updatePrototypeDraft(state, {
      name: "Bori",
      species: "cat",
      talkingStyle: "cute",
      favoriteThing: "sun spots"
    });
    state = togglePrototypePersonalityTag(state, "curious");
    state = setPrototypeMockPhotoSelected(state, true);
    state = setPrototypeConsentAccepted(state, true);

    expect(canContinuePetSetup(state)).toBe(true);
    expect(canCreatePet(state)).toBe(true);

    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");
    state = advancePrototypeGeneration(state, "2026-06-24T09:01:01.000Z");
    state = advancePrototypeGeneration(state, "2026-06-24T09:01:02.000Z");
    state = advancePrototypeGeneration(state, "2026-06-24T09:01:03.000Z");
    state = advancePrototypeGeneration(state, "2026-06-24T09:01:04.000Z");

    expect(state.generation.status).toBe("completed");

    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:02:00.000Z");

    expect(active(state).petProfile?.name).toBe("Bori");
    expect(active(state).petProfile?.species).toBe("cat");
    expect(active(state).petProfile?.activeAssetId).toBe("asset_luna_idle_001");
    expect(active(state).acceptedAsset?.id).toBe("asset_luna_idle_001");
    expect(active(state).acceptedAsset?.state).toBe("idle");
    expect(active(state).acceptedAssets.map((asset) => asset.state)).toEqual([...generatedAssetStates]);
    expect(active(state).acceptedAssets.every((asset) => asset.id.startsWith("asset_luna_"))).toBe(true);
    expect(active(state).currentReaction?.category).toBe("generation_reveal");
  });

  it("carries an optional first memory from the setup draft into the accepted pet's memoryNote", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    state = updatePrototypeDraft(state, {
      name: "Bori",
      firstMemory: "Napping in a sunbeam together"
    });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:01:00.000Z");

    expect(active(state).petProfile?.memoryNote).toBe("Napping in a sunbeam together");
  });

  it("leaves memoryNote unset when no first memory was entered", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    state = updatePrototypeDraft(state, { name: "Bori" });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:01:00.000Z");

    expect(active(state).petProfile?.memoryNote).toBeUndefined();
  });

  it("supports generation failure and retry without external services", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, {
      name: "Miso"
    });
    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");
    state = failPrototypeGeneration(state, "2026-06-24T09:01:05.000Z");

    expect(state.generation.status).toBe("failed");
    expect(state.generation.failureMessageSafe).toContain("Miso");

    state = retryPrototypeGeneration(state, "2026-06-24T09:02:00.000Z");

    expect(state.generation.status).toBe("preprocessing");
    expect(state.generation.retryCount).toBe(1);
    expect(active(state).acceptedAssets).toEqual([]);
    expect(active(state).acceptedAsset).toBeNull();
  });

  it("stores generation issue reports as safe coarse categories", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, {
      name: "Miso"
    });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:01:00.000Z");
    state = reportPrototypeGenerationIssue(state, "wrong_pet", "2026-06-24T09:02:00.000Z");

    expect(active(state).generationIssueReport).toEqual({
      category: "wrong_pet",
      petId: "pet_local_001",
      generationStatus: "created",
      reportedAt: "2026-06-24T09:02:00.000Z"
    });
  });

  it("selects generated pet assets from reaction animation state", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    state = acceptPrototypeGeneratedPet(
      updatePrototypeDraft(state, {
        name: "Miso"
      }),
      "2026-06-24T09:01:00.000Z"
    );

    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "play")?.state).toBe("play");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "sleepy")?.state).toBe("sleep");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "idle_happy")?.state).toBe("happy");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "hungry")?.state).toBe("hungry");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "treat")?.state).toBe("treat_reaction");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "walk_return")?.state).toBe("walk_return");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "garden_help")?.state).toBe("garden_help");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "chat_portrait")?.state).toBe("chat_portrait");
    expect(selectGeneratedAssetForReaction(active(state).acceptedAssets, active(state).acceptedAsset, "walk_out")?.state).toBe("idle");
  });

  it("consumes owned treat items when a treat care action uses an inventory item", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    state = {
      ...state,
      inventory: {
        ...state.inventory,
        items: [
          ...state.inventory.items,
          {
            itemId: "item_treat_plate_biscuit",
            quantity: 2,
            acquiredAt: "2026-06-24T09:01:00.000Z",
            source: "purchase"
          }
        ]
      }
    };

    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:02:00.000Z", "item_treat_plate_biscuit");

    expect(state.inventory.items.find((item) => item.itemId === "item_treat_plate_biscuit")?.quantity).toBe(1);
    expect(active(state).currentReaction?.category).toBe("treat_common");

    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:03:00.000Z", "item_treat_plate_biscuit");

    expect(state.inventory.items.some((item) => item.itemId === "item_treat_plate_biscuit")).toBe(false);
  });

  it("auto-selects an owned treat and ignores free treat attempts without inventory", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const unchanged = performPrototypeCareAction(state, "treat", "2026-06-24T09:01:00.000Z");

    expect(unchanged.inventory).toBe(state.inventory);
    expect(active(unchanged).relationshipState).toBe(active(state).relationshipState);
    expect(active(unchanged).currentReaction).toBe(active(state).currentReaction);

    state = {
      ...state,
      inventory: {
        ...state.inventory,
        items: [
          ...state.inventory.items,
          {
            itemId: "item_treat_plate_biscuit",
            quantity: 1,
            acquiredAt: "2026-06-24T09:02:00.000Z",
            source: "purchase"
          }
        ]
      }
    };

    const treated = performPrototypeCareAction(state, "treat", "2026-06-24T09:03:00.000Z");

    expect(treated.inventory.items.some((item) => item.itemId === "item_treat_plate_biscuit")).toBe(false);
    expect(active(treated).currentReaction?.category).toBe("treat_common");
    expect(active(treated).relationshipState.bondXp).toBe(active(state).relationshipState.bondXp + 5);
  });

  it("keeps daily care, walk return, and time decay coherent across a home-session loop", () => {
    let state = acceptPrototypeGeneratedPet(
      updatePrototypeDraft(createInitialPrototypeSession("2026-06-24T07:00:00.000Z"), {
        name: "Miso"
      }),
      "2026-06-24T07:01:00.000Z"
    );

    state = performPrototypeCareAction(state, "feed", "2026-06-24T08:00:00.000Z");
    expect(active(state).careState.satiety).toBeGreaterThan(70);
    expect(active(state).currentReaction?.category).toBe("fed_recent");

    state = performPrototypeCareAction(state, "water_garden", "2026-06-24T08:05:00.000Z");
    expect(active(state).careState.gardenHealth).toBeGreaterThan(80);

    const energyBeforePlay = active(state).careState.energy;
    state = performPrototypeCareAction(state, "play", "2026-06-24T08:10:00.000Z");
    expect(active(state).careState.happiness).toBeGreaterThan(80);
    // Play still spends its full energy cost (feed/water_garden give a little
    // energy back, but play/walk's own drain is unchanged -- see the mongchi
    // "케어 체감 밸런스" fix).
    expect(active(state).careState.energy).toBe(energyBeforePlay - 8);

    state = startPrototypeWalk(state, "2026-06-24T08:20:00.000Z", 1000);
    expect(active(state).activeWalk?.status).toBe("walking");
    expect(active(state).careState.activeWalkId).toBe(active(state).activeWalk?.id);

    state = refreshPrototypeWalk(state, "2026-06-24T08:20:01.000Z");
    expect(active(state).activeWalk?.status).toBe("returned");

    state = claimPrototypeWalkReward(state, "2026-06-24T08:20:02.000Z");
    expect(active(state).activeWalk).toBeNull();
    expect(active(state).careState.activeWalkId).toBeUndefined();
    expect(state.inventory.items.find((entry) => entry.source === "walk_reward")).toBeDefined();

    const nextDay = performPrototypeCareAction(state, "affection", "2026-06-25T13:20:01.000Z");
    expect(active(nextDay).careState.satiety).toBeLessThan(active(state).careState.satiety);
    expect(active(nextDay).careState.happiness).toBeLessThanOrEqual(100);
    expect(active(nextDay).relationshipState.bondXp).toBe(active(state).relationshipState.bondXp + 4);
  });

  it("applies local care actions from the current time-projected state", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const fed = performPrototypeCareAction(state, "feed", "2026-06-25T15:00:00.000Z");

    // Catchup amplifies the +28 base gain because satiety had decayed (with a
    // floor of 15) well below the 40 catchup threshold; feed also now gives a
    // small energy recovery on top of the projected 47 -- see the mongchi
    // "케어 체감 밸런스" fix.
    expect(active(fed).careState.satiety).toBe(61);
    expect(active(fed).careState.energy).toBe(61);
    expect(active(fed).careState.updatedAt).toBe("2026-06-25T15:00:00.000Z");
  });

  it("keeps wallet credits and bond growth untouched by the pet water action", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    expect(getSpendableCreditBalance(state.wallet)).toBe(25);

    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:01:00.000Z");

    expect(active(state).relationshipState.totalTalkCount).toBe(3);
    expect(active(state).relationshipState.bondXp).toBe(69);
    expect(getSpendableCreditBalance(state.wallet)).toBe(25);

    state = performPrototypeCareAction(state, "water_garden", "2026-06-24T09:03:00.000Z");

    expect(active(state).careState.gardenHealth).toBeGreaterThan(80);
    expect(active(state).lastCareReward).toBeNull();
    expect(getSpendableCreditBalance(state.wallet)).toBe(25);
  });

  it("does not grant any item or bonus reward from the core pet water action", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const startingCredits = getSpendableCreditBalance(state.wallet);
    const startingBondXp = active(state).relationshipState.bondXp;

    state = performPrototypeCareAction(state, "water_garden", "2026-06-24T09:02:00.000Z");

    expect(getSpendableCreditBalance(state.wallet)).toBe(startingCredits);
    expect(active(state).relationshipState.bondXp).toBe(startingBondXp + 1);
    expect(active(state).lastCareReward).toBeNull();
  });

  it("polls mock generation jobs with scheduled and manual progression", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    state = updatePrototypeDraft(state, {
      name: "Miso"
    });
    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");

    expect(state.generation.status).toBe("preprocessing");
    expect(state.generation.nextPollAfter).toBe("2026-06-24T09:01:00.900Z");

    state = pollPrototypeGenerationJob(state, "2026-06-24T09:01:00.500Z");
    expect(state.generation.status).toBe("preprocessing");
    expect(state.generation.lastPolledAt).toBe("2026-06-24T09:01:00.500Z");

    state = pollPrototypeGenerationJob(state, "2026-06-24T09:01:00.900Z");
    expect(state.generation.status).toBe("safety_checking");
    expect(state.generation.pollAttemptCount).toBe(1);
    expect(state.generation.nextPollAfter).toBe("2026-06-24T09:01:01.800Z");

    state = pollPrototypeGenerationJob(state, "2026-06-24T09:01:01.000Z", { force: true });
    expect(state.generation.status).toBe("generating");
    expect(state.generation.pollAttemptCount).toBe(2);

    state = pollPrototypeGenerationJob(state, "2026-06-24T09:01:01.900Z", { force: true });
    state = pollPrototypeGenerationJob(state, "2026-06-24T09:01:02.800Z", { force: true });

    expect(state.generation.status).toBe("completed");
    expect(state.generation.nextPollAfter).toBeUndefined();

    const snapshot = getPrototypeGenerationPollSnapshot(state);
    expect(snapshot.completed).toBe(true);
    expect(snapshot.progress).toBe(100);
    expect(snapshot.jobId).toBe("gen_local_001");
  });

  it("accepts a local native photo URI and clears it when original photo is deleted", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, {
      name: "Miso"
    });
    state = setPrototypeSelectedPhotoUri(state, "file:///local/pet-photo.jpg", "library", {
      byteSize: 4096,
      mimeType: "image/jpeg"
    });
    state = setPrototypeConsentAccepted(state, true);

    expect(canCreatePet(state)).toBe(true);
    expect(state.photo.source).toBe("library");
    expect(state.photo.byteSize).toBe(4096);
    expect(state.photo.mimeType).toBe("image/jpeg");

    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:01:00.000Z");
    state = deletePrototypeOriginalPhoto(state, "2026-06-24T09:02:00.000Z");

    expect(state.photo.selectedPhotoUri).toBeNull();
    expect(state.photo.source).toBe("none");
    expect(active(state).petProfile?.originalPhotoDeletedAt).toBe("2026-06-24T09:02:00.000Z");
  });

  it("gates the photo step on photo + consent alone, independent of pet-setup draft fields", () => {
    const initial = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    // Regression guard: at the photo step the name/personality/talkingStyle fields
    // (step 3, PetSetupScreen) are still empty, so canContinuePetSetup is false here.
    // canContinuePhotoStep must NOT depend on it, or Continue stays disabled forever.
    expect(canContinuePetSetup(initial)).toBe(false);
    expect(canContinuePhotoStep(initial)).toBe(false);

    let noConsent = setPrototypeSelectedPhotoUri(initial, "file:///local/pet-photo.jpg", "library", {
      byteSize: 4096,
      mimeType: "image/jpeg"
    });

    expect(canContinuePhotoStep(noConsent)).toBe(false);

    let photoWithConsent = setPrototypeConsentAccepted(noConsent, true);

    expect(canContinuePetSetup(photoWithConsent)).toBe(false);
    expect(canContinuePhotoStep(photoWithConsent)).toBe(true);

    let mockNoConsent = setPrototypeMockPhotoSelected(initial, true);

    expect(canContinuePhotoStep(mockNoConsent)).toBe(false);

    let mockWithConsent = setPrototypeConsentAccepted(mockNoConsent, true);

    expect(canContinuePetSetup(mockWithConsent)).toBe(false);
    expect(canContinuePhotoStep(mockWithConsent)).toBe(true);
  });

  it("stores optional weather scene state without requiring location", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    expect(state.weatherState.settings.enabled).toBe(false);
    expect(state.weatherState.context.condition).toBe("clear");

    state = setPrototypeWeatherEnabled(state, true, "2026-06-24T09:01:00.000Z");
    state = setPrototypeWeatherCondition(state, "rain", "2026-06-24T09:02:00.000Z");

    expect(state.weatherState.settings.enabled).toBe(true);
    expect(state.weatherState.context).toMatchObject({
      source: "manual_city",
      condition: "rain",
      regionLabel: "Tiny Garden"
    });
  });
});

describe("prototype walk reward loop", () => {
  it("sends the pet walking and clears the path automatically after the timer", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, {
      name: "Miso"
    });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:00:10.000Z");
    const happinessBeforeWalk = active(state).careState.happiness;
    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);

    expect(active(state).activeWalk?.status).toBe("walking");
    expect(active(state).careState.activeWalkId).toBe(active(state).activeWalk?.id);

    state = refreshPrototypeWalk(state, "2026-06-24T09:01:00.500Z");
    expect(active(state).activeWalk?.status).toBe("walking");

    state = refreshPrototypeWalk(state, "2026-06-24T09:01:01.000Z");
    expect(active(state).activeWalk?.status).toBe("returned");
    expect(active(state).careState.happiness).toBeGreaterThan(happinessBeforeWalk);
    expect(active(state).currentReaction?.category).toBe("walk_return_common");

    state = claimPrototypeWalkReward(state, "2026-06-24T09:01:02.000Z");
    expect(active(state).activeWalk).toBeNull();
    expect(active(state).careState.activeWalkId).toBeUndefined();
    expect(state.inventory.items.some((entry) => entry.source === "walk_reward")).toBe(true);
    expect(active(state).lastCareReward).toMatchObject({ type: "item", quantity: 1 });
  });

  it("uses weather-aware walk episodes and discovery copy", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, {
      name: "Miso"
    });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:00:10.000Z");
    state = setPrototypeWeatherCondition(state, "rain", "2026-06-24T09:00:20.000Z");
    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);

    expect(active(state).activeWalk?.discoveryLine).toContain("rainy");
    expect(active(state).currentReaction?.ruleId).toBe("en_weather_rain_walk_001");
  });

  it("always rewards a consumable treat/food item from a walk, in any weather", () => {
    const weatherConditions = [
      "clear",
      "partly_cloudy",
      "cloudy",
      "rain",
      "storm",
      "snow",
      "fog",
      "wind",
      "hot",
      "cold"
    ] as const;

    for (const condition of weatherConditions) {
      let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
      state = updatePrototypeDraft(state, { name: "Miso" });
      state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:00:10.000Z");
      state = setPrototypeWeatherCondition(state, condition, "2026-06-24T09:00:20.000Z");
      state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);

      const rewardItemId = active(state).activeWalk?.rewardItemIds[0];
      const rewardItem = mockItems.find((item) => item.id === rewardItemId);

      expect(rewardItem).toBeDefined();
      expect(["food", "treat"]).toContain(rewardItem?.category);
    }
  });
});

describe("paid early walk return (bring home now)", () => {
  it("spends 1 credit and brings the pet home immediately", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:00:10.000Z");
    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 60_000);
    const balanceBeforeSpend = getSpendableCreditBalance(state.wallet);

    expect(active(state).activeWalk?.status).toBe("walking");

    const result = completePrototypeWalkEarlyWithCredit(state, "2026-06-24T09:01:05.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected completePrototypeWalkEarlyWithCredit to succeed");
    }

    expect(getSpendableCreditBalance(result.state.wallet)).toBe(balanceBeforeSpend - 1);
    expect(active(result.state).activeWalk?.status).toBe("returned");
  });

  it("does not touch the wallet or the walk when the balance is insufficient", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:00:10.000Z");
    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 60_000);
    state = {
      ...state,
      wallet: { ...state.wallet, credits: 0, bonusCredits: 0 }
    };

    const result = completePrototypeWalkEarlyWithCredit(state, "2026-06-24T09:01:05.000Z");

    expect(result).toEqual({ ok: false, reason: "insufficient_balance" });
    expect(active(state).activeWalk?.status).toBe("walking");
    expect(getSpendableCreditBalance(state.wallet)).toBe(0);
  });

  it("reports no_active_walk when the pet is not currently walking", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:00:10.000Z");

    const result = completePrototypeWalkEarlyWithCredit(state, "2026-06-24T09:01:05.000Z");

    expect(result).toEqual({ ok: false, reason: "no_active_walk" });
  });
});

describe("generation progress gauge monotonicity", () => {
  it("clamps a lower incoming progress reading up to the previously seen max", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");
    state = advancePrototypeGeneration(state, "2026-06-24T09:01:01.000Z");
    state = advancePrototypeGeneration(state, "2026-06-24T09:01:02.000Z");

    const highWaterMark = getMonotonicGenerationProgress(state, 0);

    // Simulate a stale/out-of-order poll response that reports an earlier
    // step than what has already been displayed.
    const regressedState = advancePrototypeGeneration(
      { ...state, generation: { ...state.generation, currentStepIndex: 0, status: "preprocessing" } },
      "2026-06-24T09:01:03.000Z"
    );

    expect(getMonotonicGenerationProgress(regressedState, highWaterMark)).toBe(highWaterMark);
  });

  it("tracks forward progress normally when readings only increase", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");

    let maxProgress = getMonotonicGenerationProgress(state, 0);

    state = advancePrototypeGeneration(state, "2026-06-24T09:01:01.000Z");
    const next = getMonotonicGenerationProgress(state, maxProgress);

    expect(next).toBeGreaterThan(maxProgress);
    maxProgress = next;

    state = advancePrototypeGeneration(state, "2026-06-24T09:01:02.000Z");
    const nextAgain = getMonotonicGenerationProgress(state, maxProgress);

    expect(nextAgain).toBeGreaterThanOrEqual(maxProgress);
  });

  it("scopes the attempt key to the active job and retry count, so a retry can legitimately reset the gauge", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");

    const attemptKeyBeforeRetry = getGenerationAttemptKey(state);

    state = failPrototypeGeneration(state, "2026-06-24T09:01:05.000Z");
    state = retryPrototypeGeneration(state, "2026-06-24T09:02:00.000Z");

    const attemptKeyAfterRetry = getGenerationAttemptKey(state);

    expect(attemptKeyAfterRetry).not.toBe(attemptKeyBeforeRetry);
  });
});

// Multi-pet W1 (docs/multi-pet-w1-design.md section 4): a second pet's
// generation flow must never destroy the first (active) pet's already-
// accepted assets. Before W1, startPrototypeGeneration/retryPrototypeGeneration
// unconditionally cleared acceptedAsset/acceptedAssets -- harmless while
// there was only ever one pet, but that same code path would have wiped an
// existing pet's sprite the moment a second pet's generation could start.
// These regression tests prove the active bundle's assets now survive both
// calls untouched, which is the structural precondition W3 (a real second
// pet) depends on.
describe("generation isolation (does not destroy the active pet's assets)", () => {
  it("startPrototypeGeneration leaves the active bundle's acceptedAssets untouched", () => {
    let state = acceptPrototypeGeneratedPet(updatePrototypeDraft(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"), { name: "Miso" }), "2026-06-24T09:00:10.000Z");
    const assetsBefore = active(state).acceptedAssets;
    const assetBefore = active(state).acceptedAsset;

    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");

    expect(active(state).acceptedAssets).toBe(assetsBefore);
    expect(active(state).acceptedAsset).toBe(assetBefore);
    expect(active(state).acceptedAssets.length).toBeGreaterThan(0);
  });

  it("retryPrototypeGeneration leaves the active bundle's acceptedAssets untouched", () => {
    let state = acceptPrototypeGeneratedPet(updatePrototypeDraft(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"), { name: "Miso" }), "2026-06-24T09:00:10.000Z");
    const assetsBefore = active(state).acceptedAssets;
    const assetBefore = active(state).acceptedAsset;

    state = retryPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");

    expect(active(state).acceptedAssets).toBe(assetsBefore);
    expect(active(state).acceptedAsset).toBe(assetBefore);
    expect(active(state).acceptedAssets.length).toBeGreaterThan(0);
  });

  it("a start->retry sequence still leaves the active bundle's assets intact", () => {
    let state = acceptPrototypeGeneratedPet(updatePrototypeDraft(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"), { name: "Miso" }), "2026-06-24T09:00:10.000Z");
    const assetsBefore = active(state).acceptedAssets;

    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");
    state = failPrototypeGeneration(state, "2026-06-24T09:01:05.000Z");
    state = retryPrototypeGeneration(state, "2026-06-24T09:02:00.000Z");

    expect(active(state).acceptedAssets).toEqual(assetsBefore);
  });
});

describe("acceptPrototypeGeneratedPet preserveAssets option", () => {
  const makeSignedAsset = (state: PrototypeSessionState = createInitialPrototypeSession("2026-07-03T09:00:00.000Z")): GeneratedAsset => ({
    id: "job_supabase_001:idle",
    petId: active(state).petProfile?.id ?? "pet_local_001",
    generationJobId: "job_supabase_001",
    state: "idle",
    uri: "https://signed.example.com/avatars/idle.png",
    width: 1024,
    height: 1024,
    contentHash: "avatars/job_supabase_001/idle.png",
    mimeType: "image/png",
    storageClass: "private_app_asset",
    version: 1,
    qualityStatus: "passed",
    createdAt: "2026-07-03T09:02:00.000Z",
    updatedAt: "2026-07-03T09:02:00.000Z"
  });

  it("keeps the real signed acceptedAsset/acceptedAssets instead of overwriting them with mock assets", () => {
    let state = createInitialPrototypeSession("2026-07-03T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });

    const signedAsset = makeSignedAsset(state);
    state = withActivePetBundle(state, () => ({
      acceptedAsset: signedAsset,
      acceptedAssets: [signedAsset]
    }));

    const result = acceptPrototypeGeneratedPet(state, "2026-07-03T09:03:00.000Z", { preserveAssets: true });

    expect(active(result).acceptedAsset).toBe(signedAsset);
    expect(active(result).acceptedAssets).toEqual([signedAsset]);
  });

  it("still generates local mock assets by default (preserveAssets omitted)", () => {
    let state = createInitialPrototypeSession("2026-07-03T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });

    const result = acceptPrototypeGeneratedPet(state, "2026-07-03T09:03:00.000Z");

    expect(active(result).acceptedAssets.length).toBeGreaterThan(0);
    expect(active(result).acceptedAsset?.uri).not.toContain("signed.example.com");
  });
});

describe("normalizeRestoredGeneration", () => {
  it("downgrades an in-flight status (e.g. generating) to a failed job with a warm interrupted-retry message", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");
    state = advancePrototypeGeneration(state, "2026-06-24T09:01:01.000Z");

    expect(state.generation.status).toBe("safety_checking");

    const normalized = normalizeRestoredGeneration(state, "2026-06-24T10:00:00.000Z");

    expect(normalized.generation.status).toBe("failed");
    expect(normalized.generation.failureCode).toBe("generation_interrupted");
    expect(normalized.generation.failureMessageSafe).toBe(
      "We lost track while your friend was moving in. Let's try once more."
    );
    expect(normalized.generation.nextPollAfter).toBeUndefined();
  });

  it("downgrades a completed status with no accepted assets (stranded before poll response landed)", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = withActivePetBundle(
      {
        ...state,
        generation: {
          ...state.generation,
          status: "completed",
          completedAt: "2026-06-24T09:05:00.000Z"
        }
      },
      () => ({ acceptedAssets: [] })
    );

    const normalized = normalizeRestoredGeneration(state, "2026-06-24T10:00:00.000Z");

    expect(normalized.generation.status).toBe("failed");
    expect(normalized.generation.failureCode).toBe("generation_interrupted");
  });

  it("leaves a completed status with accepted assets untouched", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:02:00.000Z");
    state = {
      ...state,
      generation: {
        ...state.generation,
        status: "completed",
        completedAt: "2026-06-24T09:05:00.000Z"
      }
    };

    const normalized = normalizeRestoredGeneration(state, "2026-06-24T10:00:00.000Z");

    expect(normalized).toBe(state);
  });

  it("leaves an already-failed status untouched", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso" });
    state = startPrototypeGeneration(state, "2026-06-24T09:01:00.000Z");
    state = failPrototypeGeneration(state, "2026-06-24T09:01:05.000Z", "mock_quality_gate_failed");

    const normalized = normalizeRestoredGeneration(state, "2026-06-24T10:00:00.000Z");

    expect(normalized).toBe(state);
    expect(normalized.generation.failureCode).toBe("mock_quality_gate_failed");
  });

  it("leaves the pre-start 'created' status untouched", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    const normalized = normalizeRestoredGeneration(state, "2026-06-24T10:00:00.000Z");

    expect(normalized).toBe(state);
  });
});

describe("memory + care stats spine", () => {
  const buildAcceptedPet = (now: string) =>
    acceptPrototypeGeneratedPet(updatePrototypeDraft(createInitialPrototypeSession(now), { name: "Miso" }), now);

  it("records a moved_in memory when the pet is accepted", () => {
    const state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    const movedIn = active(state).memories.find((entry) => entry.type === "moved_in");
    expect(movedIn).toBeDefined();
    expect(movedIn?.occurredAt).toBe("2026-06-24T09:00:00.000Z");
  });

  it("carries an existing first-memory note into the moved_in entry's refs", () => {
    let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    state = updatePrototypeDraft(state, { name: "Miso", firstMemory: "The rainy afternoon we met." });
    state = acceptPrototypeGeneratedPet(state, "2026-06-24T09:00:00.000Z");

    const movedIn = active(state).memories.find((entry) => entry.type === "moved_in");
    expect(movedIn?.refs?.note).toBe("The rainy afternoon we met.");
  });

  it("records first_walk and first_find on the first walk claim, and bumps care stats", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);
    state = refreshPrototypeWalk(state, "2026-06-24T09:01:01.000Z");
    state = claimPrototypeWalkReward(state, "2026-06-24T09:01:02.000Z");

    expect(active(state).memories.some((entry) => entry.type === "first_walk")).toBe(true);
    expect(active(state).memories.some((entry) => entry.type === "first_find")).toBe(true);
    expect(active(state).careStats.walkCount).toBe(1);
    expect(active(state).careStats.totalCareActions).toBeGreaterThan(0);
  });

  it("does not record a second first_walk/first_find on a later walk", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);
    state = refreshPrototypeWalk(state, "2026-06-24T09:01:01.000Z");
    state = claimPrototypeWalkReward(state, "2026-06-24T09:01:02.000Z");

    state = startPrototypeWalk(state, "2026-06-24T10:00:00.000Z", 1000);
    state = refreshPrototypeWalk(state, "2026-06-24T10:00:01.000Z");
    state = claimPrototypeWalkReward(state, "2026-06-24T10:00:02.000Z");

    expect(active(state).memories.filter((entry) => entry.type === "first_walk")).toHaveLength(1);
    expect(active(state).careStats.walkCount).toBe(2);
  });

  it("records a bond_level memory when a care action crosses a bond level", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    // mockRelationshipState starts at bondXp 66 (level 1); affection grants 4
    // XP per action, so 9 actions (36 xp) crosses the level-2 threshold at 100.
    for (let i = 0; i < 9; i += 1) {
      state = performPrototypeCareAction(state, "affection", `2026-06-24T09:0${i}:00.000Z`);
    }

    expect(active(state).relationshipState.bondLevel).toBeGreaterThanOrEqual(2);
    const bondMemory = active(state).memories.find((entry) => entry.type === "bond_level" && entry.refs?.bondLevel === 2);
    expect(bondMemory).toBeDefined();
  });

  it("records a streak_milestone memory on the 7-day streak, matching the existing snack cadence", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    const days = [
      "2026-06-24T09:01:00.000Z",
      "2026-06-25T09:01:00.000Z",
      "2026-06-26T09:01:00.000Z",
      "2026-06-27T09:01:00.000Z",
      "2026-06-28T09:01:00.000Z",
      "2026-06-29T09:01:00.000Z",
      "2026-06-30T09:01:00.000Z"
    ];

    for (const day of days) {
      state = performPrototypeCareAction(state, "talk", day);
    }

    expect(state.careStreak.current).toBe(7);
    const streakMemory = active(state).memories.find((entry) => entry.type === "streak_milestone" && entry.refs?.streakCount === 7);
    expect(streakMemory).toBeDefined();
  });

  it("records a first_treat memory only the first time a treat is given, and tracks the treat item in care stats", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    // The starter inventory has no treat/food item to consume yet -- bring one
    // home from a walk first, same as a real player would.
    state = startPrototypeWalk(state, "2026-06-24T09:01:00.000Z", 1000);
    state = refreshPrototypeWalk(state, "2026-06-24T09:01:01.000Z");
    state = claimPrototypeWalkReward(state, "2026-06-24T09:01:02.000Z");

    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:02:00.000Z");

    const firstTreatMemory = active(state).memories.find((entry) => entry.type === "first_treat");
    expect(firstTreatMemory).toBeDefined();
    expect(Object.keys(active(state).careStats.treatItemCounts).length).toBeGreaterThan(0);

    // Bring home a second treat/food item so the follow-up treat action has
    // something to consume, and confirm the memory still only recorded once.
    state = startPrototypeWalk(state, "2026-06-24T09:03:00.000Z", 1000);
    state = refreshPrototypeWalk(state, "2026-06-24T09:03:01.000Z");
    state = claimPrototypeWalkReward(state, "2026-06-24T09:03:02.000Z");
    state = performPrototypeCareAction(state, "treat", "2026-06-24T10:00:00.000Z");

    expect(active(state).memories.filter((entry) => entry.type === "first_treat")).toHaveLength(1);
  });

  it("records a theme_applied memory once per theme purchase", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    const result = purchasePrototypeThemeBundle(state, "bundle_fairy_garden", "2026-06-24T09:01:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const themeMemory = active(result.state).memories.find((entry) => entry.type === "theme_applied");
    expect(themeMemory).toBeDefined();
    expect(themeMemory?.refs?.itemId).toBe("theme-fairy-garden");
  });

  it("records a days_milestone memory once daysTogether crosses 7 since the pet's createdAt", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "talk", "2026-07-01T09:01:00.000Z");

    const daysMemory = active(state).memories.find((entry) => entry.type === "days_milestone");
    expect(daysMemory).toBeDefined();
    expect(daysMemory?.refs?.daysTogether).toBe(7);
  });

  it("does not re-record the same days_milestone twice", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = performPrototypeCareAction(state, "talk", "2026-07-01T09:01:00.000Z");
    state = performPrototypeCareAction(state, "talk", "2026-07-01T15:00:00.000Z");

    expect(active(state).memories.filter((entry) => entry.type === "days_milestone" && entry.refs?.daysTogether === 7)).toHaveLength(1);
  });

  it("bumps care stats on every care action, including the action taken during a walk", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = performPrototypeCareAction(state, "feed", "2026-06-24T09:01:00.000Z");
    state = performPrototypeCareAction(state, "play", "2026-06-24T09:02:00.000Z");
    state = startPrototypeWalk(state, "2026-06-24T09:03:00.000Z", 1000);

    expect(active(state).careStats.actionCounts.feed).toBe(1);
    expect(active(state).careStats.actionCounts.play).toBe(1);
    expect(active(state).careStats.walkCount).toBe(1);
    expect(active(state).careStats.totalCareActions).toBeGreaterThanOrEqual(2);
  });

  it("caps treat bond XP at 3 grants per local day, but always applies the treat's stat/mood effects", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = {
      ...state,
      inventory: {
        ...state.inventory,
        items: [
          ...state.inventory.items,
          {
            itemId: "item_treat_plate_biscuit",
            quantity: 10,
            acquiredAt: "2026-06-24T09:00:00.000Z",
            source: "purchase"
          }
        ]
      }
    };

    const bondXpBefore = active(state).relationshipState.bondXp;
    const satietyBefore = active(state).careState.satiety;

    // First 3 treats of the day each grant the normal +5 bond XP.
    for (let i = 0; i < 3; i += 1) {
      const before = active(state).relationshipState.bondXp;
      state = performPrototypeCareAction(state, "treat", `2026-06-24T09:0${i + 1}:00.000Z`, "item_treat_plate_biscuit");
      expect(active(state).relationshipState.bondXp).toBe(before + 5);
    }

    expect(active(state).relationshipState.bondXp).toBe(bondXpBefore + 15);

    // A 4th treat the same day still fills the bowl and lifts mood/affection,
    // but grants no further bond XP -- the emotional side of giving a treat
    // is never gated, only the XP farming.
    const beforeFourth = active(state).relationshipState.bondXp;
    const satietyBeforeFourth = active(state).careState.satiety;
    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:10:00.000Z", "item_treat_plate_biscuit");

    expect(active(state).relationshipState.bondXp).toBe(beforeFourth);
    expect(active(state).careState.satiety).toBeGreaterThan(satietyBeforeFourth);
    expect(active(state).careState.satiety).toBeGreaterThanOrEqual(satietyBefore);

    // The next calendar day resets the cap.
    const beforeNextDay = active(state).relationshipState.bondXp;
    state = performPrototypeCareAction(state, "treat", "2026-06-26T09:00:00.000Z", "item_treat_plate_biscuit");
    expect(active(state).relationshipState.bondXp).toBe(beforeNextDay + 5);
  });

  it("caps talk bond XP at 10 grants per local day, but always applies talk's mood/affection effects", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    for (let i = 0; i < 10; i += 1) {
      const before = active(state).relationshipState.bondXp;
      state = performPrototypeCareAction(state, "talk", `2026-06-24T09:${`${i}`.padStart(2, "0")}:00.000Z`);
      expect(active(state).relationshipState.bondXp).toBe(before + 3);
    }

    const beforeEleventh = active(state).relationshipState.bondXp;
    const happinessBeforeEleventh = active(state).careState.happiness;
    state = performPrototypeCareAction(state, "talk", "2026-06-24T09:15:00.000Z");

    expect(active(state).relationshipState.bondXp).toBe(beforeEleventh);
    expect(active(state).careState.happiness).toBeGreaterThanOrEqual(happinessBeforeEleventh);
  });

  it("caps play bond XP at 5 grants per local day, but always applies play's mood effects (special toys bypass the cooldown, not the XP cap)", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    // First 5 plays of the day (as if a special toy like Buddy Plush bypassed
    // the base 20-minute play cooldown -- see terrariumHomeInteractionContract.ts)
    // each grant the normal +2 bond XP.
    for (let i = 0; i < 5; i += 1) {
      const before = active(state).relationshipState.bondXp;
      state = performPrototypeCareAction(state, "play", `2026-06-24T09:0${i}:00.000Z`, "item_plush_toy_buddy");
      expect(active(state).relationshipState.bondXp).toBe(before + 2);
    }

    // A 6th play the same day still lifts happiness (and can still cost
    // energy), but grants no further bond XP -- only XP farming is capped.
    const beforeSixth = active(state).relationshipState.bondXp;
    const happinessBeforeSixth = active(state).careState.happiness;
    state = performPrototypeCareAction(state, "play", "2026-06-24T09:10:00.000Z", "item_plush_toy_buddy");

    expect(active(state).relationshipState.bondXp).toBe(beforeSixth);
    expect(active(state).careState.happiness).toBeGreaterThanOrEqual(happinessBeforeSixth);

    // The next calendar day resets the cap.
    const beforeNextDay = active(state).relationshipState.bondXp;
    state = performPrototypeCareAction(state, "play", "2026-06-26T09:00:00.000Z", "item_plush_toy_buddy");
    expect(active(state).relationshipState.bondXp).toBe(beforeNextDay + 2);
  });
});

describe("item individuality reactions (docs/gamefeel-sound-plan.md §1 Tier 4)", () => {
  const buildAcceptedPet = (now: string) =>
    acceptPrototypeGeneratedPet(updatePrototypeDraft(createInitialPrototypeSession(now), { name: "Miso" }), now);

  const grantItem = (state: ReturnType<typeof buildAcceptedPet>, itemId: string, quantity: number, acquiredAt: string) => ({
    ...state,
    inventory: {
      ...state.inventory,
      items: [...state.inventory.items, { itemId, quantity, acquiredAt, source: "purchase" as const }]
    }
  });

  it("gives a curious first-taste reaction the first time a treat item is given, not the generic treat_common line", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_treat_plate_biscuit", 5, "2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:01:00.000Z", "item_treat_plate_biscuit");

    expect(active(state).currentReaction?.category).toBe("treat_common");
    expect(active(state).currentReaction?.ruleId).toBe("en_treat_first_time_001");
  });

  it("gives the favorite-treat reaction once a treat item is the pet's most-gifted, but not on its first-ever gift", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_treat_plate_biscuit", 5, "2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:01:00.000Z", "item_treat_plate_biscuit");
    expect(active(state).currentReaction?.ruleId).not.toBe("en_treat_favorite_001");

    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:05:00.000Z", "item_treat_plate_biscuit");

    expect(active(state).currentReaction?.category).toBe("treat_special");
    expect(active(state).currentReaction?.ruleId).toBe("en_treat_favorite_001");
    expect(active(state).currentReaction?.line).toMatch(/favorite/i);
  });

  it("does not treat a still-tied treat item as the favorite yet", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_treat_plate_biscuit", 5, "2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_bone_biscuit", 5, "2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:01:00.000Z", "item_treat_plate_biscuit");
    state = performPrototypeCareAction(state, "treat", "2026-06-24T09:03:00.000Z", "item_bone_biscuit");

    // Each item was only given once so far -- a tie, not a favorite.
    expect(active(state).currentReaction?.ruleId).not.toBe("en_treat_favorite_001");
  });

  it("gives Buddy Plush its own dedicated play reaction instead of the generic play line", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_plush_toy_buddy", 3, "2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "play", "2026-06-24T09:01:00.000Z", "item_plush_toy_buddy");

    expect(active(state).currentReaction?.ruleId).toBe("en_toy_buddy_plush_001");
    expect(active(state).currentReaction?.line).toMatch(/buddy/i);
  });

  it("leaves the base ball play reaction untouched when no special toy item is used", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "play", "2026-06-24T09:01:00.000Z");

    expect(active(state).currentReaction?.ruleId).not.toBe("en_toy_buddy_plush_001");
  });

  it("gives Rose Cushion its own cozy-nap reaction and a bonus energy lift on top of the base affection effect", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_cushion_rose", 3, "2026-06-24T09:00:00.000Z");

    const energyBefore = active(state).careState.energy;
    const basePet = performPrototypeCareAction(buildAcceptedPet("2026-06-24T09:00:00.000Z"), "affection", "2026-06-24T09:01:00.000Z");

    state = performPrototypeCareAction(state, "affection", "2026-06-24T09:01:00.000Z", "item_cushion_rose");

    expect(active(state).currentReaction?.ruleId).toBe("en_cushion_rose_nap_001");
    expect(active(state).careState.energy).toBeGreaterThan(energyBefore);
    expect(active(state).careState.energy).toBeGreaterThan(active(basePet).careState.energy);
  });

  it("tracks Buddy Plush and Rose Cushion usage counts in careStats, independent of each other", () => {
    let state = buildAcceptedPet("2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_plush_toy_buddy", 3, "2026-06-24T09:00:00.000Z");
    state = grantItem(state, "item_cushion_rose", 3, "2026-06-24T09:00:00.000Z");

    state = performPrototypeCareAction(state, "play", "2026-06-24T09:01:00.000Z", "item_plush_toy_buddy");
    state = performPrototypeCareAction(state, "play", "2026-06-24T09:22:00.000Z", "item_plush_toy_buddy");
    state = performPrototypeCareAction(state, "affection", "2026-06-24T09:23:00.000Z", "item_cushion_rose");

    expect(active(state).careStats.itemUsageCounts?.item_plush_toy_buddy).toBe(2);
    expect(active(state).careStats.itemUsageCounts?.item_cushion_rose).toBe(1);
  });
});
