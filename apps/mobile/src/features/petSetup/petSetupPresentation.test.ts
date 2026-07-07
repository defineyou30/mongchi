import { describe, expect, it } from "vitest";

import type { PetSetupDraft } from "@mongchi/shared";

import { getPetSetupSummaryPresentation } from "./petSetupPresentation";

describe("pet setup presentation", () => {
  it("builds the compact setup art summary from the current draft", () => {
    const draft: PetSetupDraft = {
      name: "  Miso  ",
      species: "dog",
      personalityTags: ["playful", "curious"],
      talkingStyle: "gentle",
      favoriteThing: ""
    };

    expect(getPetSetupSummaryPresentation(draft)).toEqual({
      detailLabel: "Dog / Gentle",
      nameLabel: "Miso",
      speciesLabel: "Dog",
      talkingStyleLabel: "Gentle"
    });
  });
});
