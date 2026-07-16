import { describe, expect, it } from "vitest";

import { STARTER_CREDIT_GRANT, creditPacks, getCreditPackByProductId } from "../index";

describe("STARTER_CREDIT_GRANT", () => {
  it("is 5 credits (lowered from 12 -- see supabase/migrations/0027_adjust_starter_grant_to_five.sql)", () => {
    expect(STARTER_CREDIT_GRANT).toBe(5);
  });
});

describe("creditPacks", () => {
  it("lists the three IAP packs with their confirmed credit amounts and tiers", () => {
    expect(creditPacks).toEqual([
      { productId: "credit_pack_20", credits: 20, tier: "small" },
      { productId: "credit_pack_60", credits: 60, tier: "popular" },
      { productId: "credit_pack_150", credits: 150, tier: "large" }
    ]);
  });
});

describe("getCreditPackByProductId", () => {
  it("resolves a known product id to its pack", () => {
    expect(getCreditPackByProductId("credit_pack_60")).toEqual({
      productId: "credit_pack_60",
      credits: 60,
      tier: "popular"
    });
  });

  it("returns null for an unknown product id", () => {
    expect(getCreditPackByProductId("credit_pack_9999")).toBeNull();
  });
});
