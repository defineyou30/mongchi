import { describe, expect, it } from "vitest";

import { getInitialExpressionPackId, getInitialShopCategory } from "./shopRouteParams";

describe("getInitialShopCategory", () => {
  it("opens the Moments shelf from the profile CTA", () => {
    expect(getInitialShopCategory("moments")).toBe("moments");
  });

  it("uses the first value for Expo Router array params", () => {
    expect(getInitialShopCategory(["themes", "moments"])).toBe("themes");
  });

  it("falls back to Treats for unknown or absent values", () => {
    expect(getInitialShopCategory("unknown")).toBe("treats");
    expect(getInitialShopCategory(undefined)).toBe("treats");
  });
});

describe("getInitialExpressionPackId", () => {
  it("focuses a known three-pose pack from the profile CTA", () => {
    expect(getInitialExpressionPackId("pack-care-reactions")).toBe("pack-care-reactions");
  });

  it("uses the first Expo Router array value", () => {
    expect(getInitialExpressionPackId(["pack-special-days", "pack-care-reactions"])).toBe("pack-special-days");
  });

  it("ignores unknown or missing pack ids", () => {
    expect(getInitialExpressionPackId("unknown-pack")).toBeNull();
    expect(getInitialExpressionPackId(undefined)).toBeNull();
  });
});
