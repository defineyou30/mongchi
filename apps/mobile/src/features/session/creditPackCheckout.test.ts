import { describe, expect, it } from "vitest";

import {
  classifyRevenueCatPurchaseError,
  creditPackProductIds,
  isCreditPackProductId,
  mapStoreProductsToPricingById,
  shouldStopCreditBalancePolling
} from "./creditPackCheckout";

describe("creditPackProductIds / isCreditPackProductId", () => {
  it("lists exactly the three RevenueCat-registered credit pack product ids", () => {
    expect(creditPackProductIds).toEqual(["credit_pack_20", "credit_pack_60", "credit_pack_150"]);
  });

  it("recognizes a known credit pack product id", () => {
    expect(isCreditPackProductId("credit_pack_60")).toBe(true);
  });

  it("rejects a product id outside the credit pack catalog", () => {
    expect(isCreditPackProductId("theme_pack_starter")).toBe(false);
  });
});

describe("classifyRevenueCatPurchaseError", () => {
  it("classifies userCancelled as cancelled", () => {
    expect(classifyRevenueCatPurchaseError({ userCancelled: true, code: "0" })).toBe("cancelled");
  });

  it("classifies the PURCHASE_CANCELLED_ERROR code as cancelled even without userCancelled set", () => {
    expect(classifyRevenueCatPurchaseError({ code: "1" })).toBe("cancelled");
  });

  it("classifies the PAYMENT_PENDING_ERROR code as pending", () => {
    expect(classifyRevenueCatPurchaseError({ code: "20" })).toBe("pending");
  });

  it("classifies any other error code as failed", () => {
    expect(classifyRevenueCatPurchaseError({ code: "2" })).toBe("failed");
  });

  it("classifies a non-object thrown value as failed", () => {
    expect(classifyRevenueCatPurchaseError("network down")).toBe("failed");
    expect(classifyRevenueCatPurchaseError(null)).toBe("failed");
    expect(classifyRevenueCatPurchaseError(undefined)).toBe("failed");
  });

  it("does not treat userCancelled: false as a cancellation", () => {
    expect(classifyRevenueCatPurchaseError({ userCancelled: false, code: "2" })).toBe("failed");
  });
});

describe("mapStoreProductsToPricingById", () => {
  it("maps fetched store products into a productId -> priceString lookup", () => {
    expect(
      mapStoreProductsToPricingById([
        { productId: "credit_pack_20", priceString: "$1.99" },
        { productId: "credit_pack_60", priceString: "$4.99" }
      ])
    ).toEqual({
      credit_pack_20: "$1.99",
      credit_pack_60: "$4.99"
    });
  });

  it("returns an empty object for an empty product list", () => {
    expect(mapStoreProductsToPricingById([])).toEqual({});
  });
});

describe("shouldStopCreditBalancePolling", () => {
  it("stops once the current balance exceeds the previous balance", () => {
    expect(
      shouldStopCreditBalancePolling({ attempt: 2, maxAttempts: 10, previousBalance: 12, currentBalance: 32 })
    ).toBe(true);
  });

  it("keeps polling while the balance is unchanged and attempts remain", () => {
    expect(
      shouldStopCreditBalancePolling({ attempt: 3, maxAttempts: 10, previousBalance: 12, currentBalance: 12 })
    ).toBe(false);
  });

  it("stops once the attempt budget is exhausted even without a balance increase", () => {
    expect(
      shouldStopCreditBalancePolling({ attempt: 10, maxAttempts: 10, previousBalance: 12, currentBalance: 12 })
    ).toBe(true);
  });

  it("does not stop for a balance that dropped (e.g. a concurrent spend elsewhere)", () => {
    expect(
      shouldStopCreditBalancePolling({ attempt: 1, maxAttempts: 10, previousBalance: 12, currentBalance: 5 })
    ).toBe(false);
  });
});
