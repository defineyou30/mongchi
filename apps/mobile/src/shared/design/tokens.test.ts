import { describe, expect, it } from "vitest";

import { fontPairFamilies, fontPairIds } from "./fontPair";
import { getFontFamilies, getTypography } from "./tokens";

const roles = ["display", "title", "body", "label", "button", "bubble"] as const;

describe("getTypography", () => {
  it("returns every role with a size, lineHeight, weight, and fontFamily for each pair", () => {
    for (const pairId of fontPairIds) {
      const typography = getTypography(pairId);

      for (const role of roles) {
        expect(typography[role].fontSize).toBeGreaterThan(0);
        expect(typography[role].lineHeight).toBeGreaterThan(0);
        expect(typography[role].fontWeight).toBeTruthy();
        expect(typography[role].fontFamily).toBeTruthy();
      }
    }
  });

  it("keeps role sizing identical across pairs (only fontFamily changes)", () => {
    const pairA = getTypography("A");
    const pairB = getTypography("B");

    for (const role of roles) {
      expect(pairB[role].fontSize).toBe(pairA[role].fontSize);
      expect(pairB[role].lineHeight).toBe(pairA[role].lineHeight);
      expect(pairB[role].fontWeight).toBe(pairA[role].fontWeight);
    }
  });

  it("switches fontFamily per pair", () => {
    const pairA = getTypography("A");
    const pairB = getTypography("B");

    for (const role of roles) {
      expect(pairA[role].fontFamily).not.toBe(pairB[role].fontFamily);
    }
  });

  it("resolves display/title/bubble from the pair's display face and body/label/button from the body face", () => {
    for (const pairId of fontPairIds) {
      const typography = getTypography(pairId);
      const families = fontPairFamilies[pairId];

      expect(typography.display.fontFamily).toBe(families.display);
      expect(typography.title.fontFamily).toBe(families.display);
      expect(typography.bubble.fontFamily).toBe(families.display);

      expect(typography.body.fontFamily).toBe(families.body);
      expect(typography.label.fontFamily).toBe(families.body);
      expect(typography.button.fontFamily).toBe(families.body);
    }
  });
});

describe("getFontFamilies", () => {
  it("matches the fontFamily slice of getTypography for every role", () => {
    for (const pairId of fontPairIds) {
      const typography = getTypography(pairId);
      const families = getFontFamilies(pairId);

      for (const role of roles) {
        expect(families[role]).toBe(typography[role].fontFamily);
      }
    }
  });
});
