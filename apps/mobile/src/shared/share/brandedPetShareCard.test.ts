import { describe, expect, it } from "vitest";

import { buildBrandedPetShareCardCopy } from "./brandedPetShareCard";

describe("buildBrandedPetShareCardCopy", () => {
  it("builds a warm, branded dayless card without inventing a link", () => {
    expect(buildBrandedPetShareCardCopy({ petName: " Miso " })).toEqual({
      petName: "Miso",
      warmLine: "A tiny friend, always close.",
      attribution: "Made with MongChi",
      publicUrl: null
    });
  });

  it("uses relationship time when it is available", () => {
    expect(buildBrandedPetShareCardCopy({ petName: "Luna", daysTogether: 12 }).warmLine).toBe(
      "12 days of tiny garden moments."
    );
  });

  it("only retains a valid configured public URL", () => {
    expect(
      buildBrandedPetShareCardCopy({ petName: "Miso", publicUrl: "https://mongchi.app" }).publicUrl
    ).toBe("https://mongchi.app");
    expect(
      buildBrandedPetShareCardCopy({ petName: "Miso", publicUrl: "https://example.com/app" }).publicUrl
    ).toBeNull();
  });
});
