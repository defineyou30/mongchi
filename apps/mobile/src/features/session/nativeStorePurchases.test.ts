import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" }
}));

const configureMock = vi.fn();
const logInMock = vi.fn(async () => ({ customerInfo: {}, created: false }));
const getProductsMock = vi.fn(async (_ids: string[]) => [] as { identifier: string; priceString: string }[]);
const purchaseStoreProductMock = vi.fn(async () => ({ productIdentifier: "x", customerInfo: {}, transaction: {} }));
const restorePurchasesMock = vi.fn(async () => ({}));

vi.mock("react-native-purchases", () => ({
  default: {
    configure: configureMock,
    logIn: logInMock,
    getProducts: getProductsMock,
    purchaseStoreProduct: purchaseStoreProductMock,
    restorePurchases: restorePurchasesMock
  }
}));

// Every test re-imports the module fresh (vi.resetModules) so the
// module-scoped configure/product caches (see nativeStorePurchases.ts's
// configuredApiKey/storeProductCache) never leak between tests.
const importFreshModule = async () => {
  vi.resetModules();
  return import("./nativeStorePurchases");
};

describe("native store purchase helpers (RevenueCat seam)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureMock.mockReset();
    logInMock.mockReset().mockResolvedValue({ customerInfo: {}, created: false });
    getProductsMock.mockReset().mockResolvedValue([]);
    purchaseStoreProductMock.mockReset().mockResolvedValue({ productIdentifier: "x", customerInfo: {}, transaction: {} });
    restorePurchasesMock.mockReset().mockResolvedValue({});
  });

  it("getNativePurchasePlatform reflects Platform.OS on a supported platform", async () => {
    const mod = await importFreshModule();
    expect(mod.getNativePurchasePlatform()).toBe("ios");
  });

  it("isNativeStoreCheckoutEnabled requires the explicit opt-in env flag", async () => {
    const mod = await importFreshModule();
    const original = process.env.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT;

    try {
      process.env.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT = "true";
      expect(mod.isNativeStoreCheckoutEnabled()).toBe(true);

      process.env.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT = "false";
      expect(mod.isNativeStoreCheckoutEnabled()).toBe(false);

      delete process.env.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT;
      expect(mod.isNativeStoreCheckoutEnabled()).toBe(false);
    } finally {
      if (original === undefined) {
        delete process.env.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT;
      } else {
        process.env.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT = original;
      }
    }
  });

  it("logInStoreUser configures RevenueCat once and logs in with the given Supabase user id", async () => {
    const mod = await importFreshModule();

    const result = await mod.logInStoreUser("supabase-user-1");

    expect(result).toEqual({ ok: true });
    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(configureMock).toHaveBeenCalledWith({ apiKey: "appl_vcqaVXPMgBRmsuMSCTadOJUQolA" });
    expect(logInMock).toHaveBeenCalledWith("supabase-user-1");
  });

  it("does not re-configure RevenueCat on a second call", async () => {
    const mod = await importFreshModule();

    await mod.logInStoreUser("supabase-user-1");
    await mod.logInStoreUser("supabase-user-1");

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(logInMock).toHaveBeenCalledTimes(2);
  });

  it("logInStoreUser surfaces a warm message when RevenueCat's logIn rejects", async () => {
    logInMock.mockRejectedValueOnce(new Error("network unreachable"));
    const mod = await importFreshModule();

    const result = await mod.logInStoreUser("supabase-user-1");

    expect(result).toEqual({ ok: false, messageSafe: "network unreachable" });
  });

  it("fetchStoreProducts maps RevenueCat products to productId/priceString pairs", async () => {
    getProductsMock.mockResolvedValueOnce([
      { identifier: "credit_pack_20", priceString: "$1.99" },
      { identifier: "credit_pack_60", priceString: "$4.99" }
    ]);
    const mod = await importFreshModule();

    const result = await mod.fetchStoreProducts(["credit_pack_20", "credit_pack_60"]);

    expect(result).toEqual({
      ok: true,
      products: [
        { productId: "credit_pack_20", priceString: "$1.99" },
        { productId: "credit_pack_60", priceString: "$4.99" }
      ]
    });
  });

  it("purchaseStoreProduct reuses a product cached by an earlier fetchStoreProducts call", async () => {
    getProductsMock.mockResolvedValueOnce([{ identifier: "credit_pack_20", priceString: "$1.99" }]);
    const mod = await importFreshModule();

    await mod.fetchStoreProducts(["credit_pack_20"]);
    getProductsMock.mockClear();

    const result = await mod.purchaseStoreProduct("credit_pack_20");

    expect(result).toEqual({ ok: true, status: "purchased" });
    expect(getProductsMock).not.toHaveBeenCalled();
    expect(purchaseStoreProductMock).toHaveBeenCalledWith({ identifier: "credit_pack_20", priceString: "$1.99" });
  });

  it("purchaseStoreProduct fetches the product itself when nothing is cached yet", async () => {
    getProductsMock.mockResolvedValueOnce([{ identifier: "credit_pack_60", priceString: "$4.99" }]);
    const mod = await importFreshModule();

    const result = await mod.purchaseStoreProduct("credit_pack_60");

    expect(result).toEqual({ ok: true, status: "purchased" });
    expect(getProductsMock).toHaveBeenCalledWith(["credit_pack_60"]);
  });

  it("purchaseStoreProduct reports an unavailable product without calling purchaseStoreProduct", async () => {
    getProductsMock.mockResolvedValueOnce([]);
    const mod = await importFreshModule();

    const result = await mod.purchaseStoreProduct("unknown_product");

    expect(result).toEqual({ ok: false, messageSafe: "This item is not available in the store right now." });
    expect(purchaseStoreProductMock).not.toHaveBeenCalled();
  });

  it("purchaseStoreProduct classifies a user cancellation as ok:true status: cancelled", async () => {
    getProductsMock.mockResolvedValueOnce([{ identifier: "credit_pack_20", priceString: "$1.99" }]);
    purchaseStoreProductMock.mockRejectedValueOnce({ code: "1", userCancelled: true });
    const mod = await importFreshModule();

    const result = await mod.purchaseStoreProduct("credit_pack_20");

    expect(result).toEqual({ ok: true, status: "cancelled" });
  });

  it("purchaseStoreProduct classifies a pending payment as ok:true status: pending", async () => {
    getProductsMock.mockResolvedValueOnce([{ identifier: "credit_pack_20", priceString: "$1.99" }]);
    purchaseStoreProductMock.mockRejectedValueOnce({ code: "20" });
    const mod = await importFreshModule();

    const result = await mod.purchaseStoreProduct("credit_pack_20");

    expect(result).toEqual({ ok: true, status: "pending" });
  });

  it("purchaseStoreProduct surfaces any other purchase error as ok:false", async () => {
    getProductsMock.mockResolvedValueOnce([{ identifier: "credit_pack_20", priceString: "$1.99" }]);
    purchaseStoreProductMock.mockRejectedValueOnce(new Error("store unreachable"));
    const mod = await importFreshModule();

    const result = await mod.purchaseStoreProduct("credit_pack_20");

    expect(result).toEqual({ ok: false, messageSafe: "store unreachable" });
  });

  it("restoreStoreEntitlements resolves ok:true when RevenueCat's restore succeeds", async () => {
    const mod = await importFreshModule();

    const result = await mod.restoreStoreEntitlements();

    expect(result).toEqual({ ok: true });
    expect(restorePurchasesMock).toHaveBeenCalledTimes(1);
  });

  it("restoreStoreEntitlements surfaces a warm message when RevenueCat's restore rejects", async () => {
    restorePurchasesMock.mockRejectedValueOnce(new Error("restore failed"));
    const mod = await importFreshModule();

    const result = await mod.restoreStoreEntitlements();

    expect(result).toEqual({ ok: false, messageSafe: "restore failed" });
  });
});
