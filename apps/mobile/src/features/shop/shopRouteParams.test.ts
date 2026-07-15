import { describe, expect, it } from "vitest";

import {
  getInitialCustomizeShopFilter,
  getInitialExpressionPackId,
  getInitialShopCategory,
  getInitialShopTab,
  isCareShopCategory
} from "./shopRouteParams";

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

describe("getInitialShopTab", () => {
  it("groups treats and toys into the care tab", () => {
    expect(getInitialShopTab("treats")).toBe("care");
    expect(getInitialShopTab("drinks")).toBe("care");
    expect(getInitialShopTab("toys")).toBe("care");
    expect(getInitialShopTab("rest")).toBe("care");
  });

  it("groups pose packs and themes into the customize tab", () => {
    expect(getInitialShopTab("moments")).toBe("customize");
    expect(getInitialShopTab("themes")).toBe("customize");
  });
});

describe("isCareShopCategory", () => {
  it("keeps the four care shelves separate from poses and themes", () => {
    expect(isCareShopCategory("treats")).toBe(true);
    expect(isCareShopCategory("drinks")).toBe(true);
    expect(isCareShopCategory("toys")).toBe(true);
    expect(isCareShopCategory("rest")).toBe(true);
    expect(isCareShopCategory("moments")).toBe(false);
    expect(isCareShopCategory("themes")).toBe(false);
  });
});

describe("getInitialCustomizeShopFilter", () => {
  it("focuses the Pose Packs sub filter from the profile CTA, keeping the moments alias", () => {
    expect(getInitialCustomizeShopFilter("moments")).toBe("moments");
  });

  it("focuses the Themes sub filter", () => {
    expect(getInitialCustomizeShopFilter("themes")).toBe("themes");
  });

  it("falls back to All for care categories or absent values", () => {
    expect(getInitialCustomizeShopFilter("treats")).toBe("all");
    expect(getInitialCustomizeShopFilter(undefined)).toBe("all");
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
