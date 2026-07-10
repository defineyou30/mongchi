import { describe, expect, it } from "vitest";

import {
  createInitialPrototypeSession,
  getActivePetBundle,
  makeMockGeneratedAsset,
  startPrototypeGeneration,
  updatePrototypeDraft,
  withActivePetBundle
} from "@mongchi/shared";

import { getInitialPetLaunchRoute } from "./initialPetLaunchRoute";

describe("getInitialPetLaunchRoute", () => {
  it("routes each persisted initial-pet state to one deterministic recovery surface", () => {
    const fresh = createInitialPrototypeSession("2026-07-10T09:00:00.000Z");
    expect(getInitialPetLaunchRoute({ ...fresh, ...getActivePetBundle(fresh), hasSeenWelcome: false })).toBe("/welcome");
    expect(getInitialPetLaunchRoute({ ...fresh, ...getActivePetBundle(fresh), hasSeenWelcome: true })).toBe("/onboarding");

    let setup = updatePrototypeDraft(fresh, { name: "Miso" });
    setup = {
      ...setup,
      photo: {
        ...setup.photo,
        selectedMockPhoto: true,
        source: "sample",
        consentAccepted: true
      }
    };
    expect(getInitialPetLaunchRoute({ ...setup, ...getActivePetBundle(setup), hasSeenWelcome: true })).toBe("/pet-setup");

    const generating = startPrototypeGeneration(setup, "2026-07-10T09:01:00.000Z");
    expect(getInitialPetLaunchRoute({ ...generating, ...getActivePetBundle(generating), hasSeenWelcome: true })).toBe("/generation");

    const failed = {
      ...generating,
      generation: { ...generating.generation, status: "failed" as const }
    };
    expect(getInitialPetLaunchRoute({ ...failed, ...getActivePetBundle(failed), hasSeenWelcome: true })).toBe("/generation");

    const revealed = withActivePetBundle(
      {
        ...generating,
        generation: { ...generating.generation, status: "completed" as const }
      },
      () => ({
        acceptedAsset: makeMockGeneratedAsset("idle", { petId: "pet_local_001", generationJobId: "gen_local_001" })
      })
    );
    expect(getInitialPetLaunchRoute({ ...revealed, ...getActivePetBundle(revealed), hasSeenWelcome: true })).toBe("/pet-reveal");

    const accepted = withActivePetBundle(revealed, (bundle) => ({
      petProfile: bundle.petProfile ? { ...bundle.petProfile, lifecycleStatus: "active" as const } : null
    }));
    expect(getInitialPetLaunchRoute({ ...accepted, ...getActivePetBundle(accepted), hasSeenWelcome: true })).toBe("/terrarium");
  });
});
