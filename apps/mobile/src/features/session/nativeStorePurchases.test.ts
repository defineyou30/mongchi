import { describe, expect, it, vi } from "vitest";

import type { CommerceProduct } from "@mongchi/shared";
import type { Purchase } from "expo-iap";

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: {
    SHA256: "SHA-256"
  },
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => `digest-${value}`)
}));

vi.mock("react-native", () => ({
  Platform: {
    OS: "android"
  }
}));

import { buildStoreRestorePurchasesRequest } from "./nativeStorePurchases";

const products: CommerceProduct[] = [
  { productId: "premium_chat_monthly", entitlementKey: "premium_chat", grantType: "subscription" },
  { productId: "theme_pack_starter", entitlementKey: "theme_pack", grantType: "durable" }
];

const purchase = (patch: Partial<Purchase>): Purchase =>
  ({
    id: "purchase_id_001",
    productId: "premium_chat_monthly",
    purchaseState: "purchased",
    purchaseToken: "google-play-purchase-token",
    transactionId: "gpa.1234-5678-9012",
    ...patch
  }) as Purchase;

describe("native store purchase helpers", () => {
  it("builds request-scoped restore purchase tokens from available store purchases", async () => {
    const result = await buildStoreRestorePurchasesRequest("android", products, [
      purchase({}),
      purchase({ productId: "unknown_legacy_product", transactionId: "gpa.0000-0000-0000" }),
      purchase({ purchaseState: "pending", transactionId: "gpa.9999-9999-9999" })
    ]);

    expect(result).toEqual({
      eligibleCount: 1,
      skippedCount: 2,
      request: {
        platform: "android",
        transactionIds: ["gpa.1234-5678-9012"],
        purchases: [
          {
            productId: "premium_chat_monthly",
            transactionId: "gpa.1234-5678-9012",
            receiptHash: "sha256:digest-google-play-purchase-token",
            storeVerificationToken: "google-play-purchase-token"
          }
        ]
      }
    });
  });
});
