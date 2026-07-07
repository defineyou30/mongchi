import { describe, expect, it } from "vitest";

import { createInitialPrototypeSession, getActivePetBundle, getPetBundle, withActivePetBundle } from "../index";

const now = "2026-06-24T09:00:00.000Z";

describe("PetBundle lens helpers", () => {
  it("getActivePetBundle reads the bundle at state.pets[state.activePetId]", () => {
    const state = createInitialPrototypeSession(now);

    expect(getActivePetBundle(state)).toBe(state.pets[state.activePetId]);
  });

  it("getPetBundle returns undefined for an unknown pet id", () => {
    const state = createInitialPrototypeSession(now);

    expect(getPetBundle(state, "pet_does_not_exist")).toBeUndefined();
    expect(getPetBundle(state, state.activePetId)).toBe(state.pets[state.activePetId]);
  });

  it("withActivePetBundle merges a Partial<PetBundle> patch into only the active bundle", () => {
    const state = createInitialPrototypeSession(now);

    const next = withActivePetBundle(state, (bundle) => ({
      careState: { ...bundle.careState, satiety: 42 }
    }));

    expect(getActivePetBundle(next).careState.satiety).toBe(42);
    // Every other bundle field is untouched.
    expect(getActivePetBundle(next).relationshipState).toBe(getActivePetBundle(state).relationshipState);
    expect(getActivePetBundle(next).memories).toBe(getActivePetBundle(state).memories);
  });

  it("withActivePetBundle leaves shared top-level fields and other bundles untouched", () => {
    const state = createInitialPrototypeSession(now);
    const secondPetId = "pet_local_002";
    const stateWithSecondPet = {
      ...state,
      pets: {
        ...state.pets,
        [secondPetId]: getActivePetBundle(state)
      }
    };

    const next = withActivePetBundle(stateWithSecondPet, (bundle) => ({
      careState: { ...bundle.careState, happiness: 5 }
    }));

    // Shared fields are byte-identical (same reference) since withActivePetBundle never touches them.
    expect(next.wallet).toBe(stateWithSecondPet.wallet);
    expect(next.inventory).toBe(stateWithSecondPet.inventory);
    expect(next.careStreak).toBe(stateWithSecondPet.careStreak);
    // The non-active bundle is untouched.
    expect(next.pets[secondPetId]).toBe(stateWithSecondPet.pets[secondPetId]);
    // Only the active bundle's careState changed.
    expect(getActivePetBundle(next).careState.happiness).toBe(5);
  });

  it("withActivePetBundle can patch multiple bundle fields in one call", () => {
    const state = createInitialPrototypeSession(now);

    const next = withActivePetBundle(state, () => ({
      currentReaction: { ruleId: "test_rule", category: "affection_high", line: "hi", animation: "happy", priority: 1 },
      lastCareReward: { type: "item", itemId: "item_treat_plate_biscuit", quantity: 1 }
    }));

    expect(getActivePetBundle(next).currentReaction?.ruleId).toBe("test_rule");
    expect(getActivePetBundle(next).lastCareReward?.itemId).toBe("item_treat_plate_biscuit");
  });
});
