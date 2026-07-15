import { describe, expect, it } from "vitest";

import { petSpeciesOptions } from "./petSpeciesOptions";

describe("petSpeciesOptions", () => {
  it("offers both supported generation species", () => {
    expect(petSpeciesOptions.map((option) => option.value)).toEqual(["dog", "cat"]);
  });

  it("uses localized labels instead of hard-coded species names", () => {
    expect(petSpeciesOptions.map((option) => option.labelKey)).toEqual([
      "petSetup.species.dog",
      "petSetup.species.cat"
    ]);
  });
});
