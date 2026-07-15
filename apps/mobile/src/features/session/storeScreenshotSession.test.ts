import { describe, expect, it } from "vitest";

import { generatedAssetStates, generationSteps, getActivePetBundle } from "@mongchi/shared";

import {
  createStoreScreenshotSession,
  normalizeStoreScreenshotPreset,
  storeScreenshotPresetRoutes,
  storeScreenshotPresets
} from "./storeScreenshotSession";

const active = getActivePetBundle;

describe("store screenshot session presets", () => {
  it("keeps the store screenshot flow order aligned with the native app journey", () => {
    expect(storeScreenshotPresets).toEqual([
      "welcome",
      "photo-upload",
      "pet-setup",
      "hatching",
      "pet-reveal",
      "terrarium",
      "terrarium-walk",
      "terrarium-walk-empty",
      "chat",
      "shop"
    ]);
    expect(storeScreenshotPresetRoutes).toMatchObject({
      welcome: "/welcome",
      "pet-setup": "/pet-setup",
      "photo-upload": "/photo-upload",
      hatching: "/generation",
      "pet-reveal": "/pet-reveal",
      terrarium: "/terrarium",
      "terrarium-walk": "/terrarium",
      "terrarium-walk-empty": "/terrarium",
      chat: "/chat",
      shop: "/shop"
    });
  });

  it("normalizes canonical names and capture aliases", () => {
    expect(normalizeStoreScreenshotPreset("welcome")).toBe("welcome");
    expect(normalizeStoreScreenshotPreset("AI_CHAT")).toBe("chat");
    expect(normalizeStoreScreenshotPreset("generation")).toBe("hatching");
    expect(normalizeStoreScreenshotPreset("walk")).toBe("terrarium-walk");
    expect(normalizeStoreScreenshotPreset("walk_empty")).toBe("terrarium-walk-empty");
    expect(normalizeStoreScreenshotPreset("walk-reward-shop")).toBeNull();
    expect(normalizeStoreScreenshotPreset("unknown")).toBeNull();
  });

  it("creates a hatching state that stays stable long enough to capture", () => {
    const state = createStoreScreenshotSession("hatching", "2026-06-24T09:00:00.000Z");

    expect(state.draft.name).toBe("Miso");
    expect(state.photo.selectedMockPhoto).toBe(true);
    expect(state.photo.consentAccepted).toBe(true);
    expect(state.generation.status).toBe("generating");
    expect(state.generation.currentStepIndex).toBe(2);
    expect(state.generation.nextPollAfter).toBe("2026-06-24T10:00:00.000Z");
  });

  it("creates reveal and terrarium-ready states from separate presets", () => {
    const reveal = createStoreScreenshotSession("pet-reveal", "2026-06-24T09:00:00.000Z");
    const terrarium = createStoreScreenshotSession("terrarium", "2026-06-24T09:00:00.000Z");

    expect(reveal.generation.status).toBe("completed");
    expect(reveal.generation.currentStepIndex).toBe(generationSteps.length - 1);
    expect(active(reveal).petProfile).toBeNull();
    expect(active(reveal).acceptedAsset).toBeNull();
    expect(active(terrarium).petProfile?.name).toBe("Miso");
    expect(active(terrarium).acceptedAsset?.state).toBe("idle");
    expect(active(terrarium).acceptedAssets.map((asset) => asset.state)).toEqual([...generatedAssetStates]);
    expect(active(terrarium).currentReaction?.line).not.toMatch(/[가-힣]/);
  });

  it("creates shop states without walk reward inventory side effects", () => {
    const state = createStoreScreenshotSession("shop", "2026-06-24T09:00:00.000Z");

    expect(active(state).activeWalk).toBeNull();
    expect(state.firstRewardClaimedAt).toBeNull();
    expect(state.inventory.items.find((entry) => entry.source === "walk_reward")).toBeUndefined();
    expect(active(state).currentReaction?.category).not.toBe("new_item");
    expect(active(state).currentReaction?.line).not.toMatch(/[가-힣]/);
  });

  it("creates walking states with funded and empty gem balances", () => {
    const funded = createStoreScreenshotSession("terrarium-walk", "2026-06-24T09:00:00.000Z");
    const empty = createStoreScreenshotSession("terrarium-walk-empty", "2026-06-24T09:00:00.000Z");

    expect(active(funded).activeWalk?.status).toBe("walking");
    expect(active(funded).activeWalk?.returnAt).toBe("2026-06-24T09:03:00.000Z");
    expect(funded.wallet.credits).toBe(12);
    expect(active(empty).activeWalk?.status).toBe("walking");
    expect(empty.wallet.credits).toBe(0);
    expect(empty.wallet.bonusCredits).toBe(0);
  });
});
