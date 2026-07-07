import { describe, expect, it } from "vitest";

import type { ApiRuntimeConfig } from "../apiRuntimeConfig";
import { createHttpStorePurchaseVerifier, createHttpStorePurchaseVerifierFromRuntimeConfig } from "../storePurchaseVerifier";
import type { HttpStorePurchaseVerifierFetch } from "../storePurchaseVerifier";

const validHash = `sha256:${"a".repeat(64)}`;

describe("HTTP store purchase verifier", () => {
  it("posts purchase verification requests with server-only authorization and normalizes the purchase response", async () => {
    const requests: Array<{ url: string; init: Parameters<HttpStorePurchaseVerifierFetch>[1] }> = [];
    const fetch: HttpStorePurchaseVerifierFetch = async (url, init) => {
      requests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          purchase: {
            platform: "ios",
            productId: "premium_chat_monthly",
            transactionId: "ios_txn_store_001",
            receiptHash: validHash,
            verifiedAt: "2026-06-24T10:00:00.000Z",
            environment: "production"
          }
        })
      };
    };
    const verifier = createHttpStorePurchaseVerifier({
      endpoint: "https://store-verifier.example.test/",
      apiKey: "server-store-verifier-secret",
      fetch
    });

    const result = await verifier.verifyPurchase({
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_store_001",
      receiptHash: validHash,
      storeVerificationToken: "app-store-jws.header.payload.signature",
      userId: "user_store_001",
      requestedAt: "2026-06-24T10:00:00.000Z"
    });

    expect(result).toEqual({
      ok: true,
      purchase: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_store_001",
        receiptHash: validHash,
        verifiedAt: "2026-06-24T10:00:00.000Z",
        environment: "production"
      }
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://store-verifier.example.test");
    expect(requests[0]?.init.headers.Authorization).toBe("Bearer server-store-verifier-secret");
    expect(JSON.parse(requests[0]?.init.body ?? "{}")).toEqual({
      operation: "verify_purchase",
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_store_001",
      receiptHash: validHash,
      storeVerificationToken: "app-store-jws.header.payload.signature",
      userId: "user_store_001",
      requestedAt: "2026-06-24T10:00:00.000Z"
    });
  });

  it("supports restore verification through the same verifier endpoint", async () => {
    const requests: Array<{ body: unknown }> = [];
    const fetch: HttpStorePurchaseVerifierFetch = async (_url, init) => {
      requests.push({ body: JSON.parse(init.body) });

      return {
        status: 200,
        json: async () => ({
          purchases: [
            {
              platform: "android",
              productId: "premium_chat_monthly",
              transactionId: "gpa.1234-5678-9012",
              receiptHash: validHash,
              environment: "sandbox"
            }
          ]
        })
      };
    };
    const verifier = createHttpStorePurchaseVerifier({
      endpoint: "https://store-verifier.example.test",
      apiKey: "server-store-verifier-secret",
      fetch
    });

    const result = await verifier.restorePurchases?.({
      platform: "android",
      transactionIds: ["gpa.1234-5678-9012"],
      purchases: [
        {
          productId: "premium_chat_monthly",
          transactionId: "gpa.1234-5678-9012",
          receiptHash: validHash,
          storeVerificationToken: "google-play-purchase-token"
        }
      ],
      userId: "user_store_001",
      requestedAt: "2026-06-24T10:00:00.000Z"
    });

    expect(result).toEqual({
      ok: true,
      purchases: [
        {
          platform: "android",
          productId: "premium_chat_monthly",
          transactionId: "gpa.1234-5678-9012",
          receiptHash: validHash,
          environment: "sandbox"
        }
      ]
    });
    expect(requests[0]?.body).toEqual({
      operation: "restore_purchases",
      platform: "android",
      transactionIds: ["gpa.1234-5678-9012"],
      purchases: [
        {
          productId: "premium_chat_monthly",
          transactionId: "gpa.1234-5678-9012",
          receiptHash: validHash,
          storeVerificationToken: "google-play-purchase-token"
        }
      ],
      userId: "user_store_001",
      requestedAt: "2026-06-24T10:00:00.000Z"
    });
  });

  it("fails closed for verifier transport errors and invalid success payloads", async () => {
    const unavailable = createHttpStorePurchaseVerifier({
      endpoint: "https://store-verifier.example.test",
      apiKey: "server-store-verifier-secret",
      fetch: async () => {
        throw new Error("network down");
      }
    });
    const invalid = createHttpStorePurchaseVerifier({
      endpoint: "https://store-verifier.example.test",
      apiKey: "server-store-verifier-secret",
      fetch: async () => ({
        status: 200,
        json: async () => ({
          purchase: {
            platform: "ios",
            productId: "premium_chat_monthly",
            transactionId: "ios_txn_store_001",
            receiptHash: "raw-receipt",
            environment: "production"
          }
        })
      })
    });

    await expect(
      unavailable.verifyPurchase({
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_store_001",
        receiptHash: validHash,
        userId: "user_store_001",
        requestedAt: "2026-06-24T10:00:00.000Z"
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        status: 503,
        code: "store_verifier_unavailable",
        messageSafe: "Store purchase verification is unavailable."
      }
    });
    await expect(
      invalid.verifyPurchase({
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_store_001",
        receiptHash: validHash,
        userId: "user_store_001",
        requestedAt: "2026-06-24T10:00:00.000Z"
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        status: 503,
        code: "store_verifier_invalid_response",
        messageSafe: "Store purchase verification returned an invalid response."
      }
    });
  });

  it("maps safe verifier rejection responses without leaking raw provider details", async () => {
    const verifier = createHttpStorePurchaseVerifier({
      endpoint: "https://store-verifier.example.test",
      apiKey: "server-store-verifier-secret",
      fetch: async () => ({
        status: 409,
        json: async () => ({
          error: {
            status: 409,
            code: "purchase_already_claimed",
            messageSafe: "This purchase is already linked to another account.",
            rawReceipt: "must-not-leak"
          }
        })
      })
    });

    await expect(
      verifier.verifyPurchase({
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_store_001",
        receiptHash: validHash,
        storeVerificationToken: "app-store-jws.header.payload.signature",
        userId: "user_store_001",
        requestedAt: "2026-06-24T10:00:00.000Z"
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        status: 409,
        code: "purchase_already_claimed",
        messageSafe: "This purchase is already linked to another account."
      }
    });
  });

  it("emits verifier telemetry without receipt tokens, hashes, or transaction ids", async () => {
    const events: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const verifier = createHttpStorePurchaseVerifier({
      endpoint: "https://store-verifier.example.test",
      apiKey: "server-store-verifier-secret",
      logger: {
        info: (event, metadata) => events.push({ event, metadata }),
        error: (event, metadata) => events.push({ event, metadata })
      },
      fetch: async () => ({
        status: 422,
        json: async () => ({
          error: {
            status: 422,
            code: "store_receipt_invalid",
            messageSafe: "The store could not verify this purchase."
          }
        })
      })
    });

    await verifier.verifyPurchase({
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_store_telemetry_001",
      receiptHash: validHash,
      storeVerificationToken: "app-store-jws.header.payload.signature",
      userId: "user_store_001",
      requestedAt: "2026-06-24T10:00:00.000Z"
    });

    expect(events).toEqual([
      {
        event: "store_purchase_verifier_rejected",
        metadata: expect.objectContaining({
          operation: "verify_purchase",
          platform: "ios",
          productId: "premium_chat_monthly",
          httpStatus: 422
        })
      }
    ]);
    expect(JSON.stringify(events)).not.toContain("app-store-jws.header.payload.signature");
    expect(JSON.stringify(events)).not.toContain(validHash);
    expect(JSON.stringify(events)).not.toContain("ios_txn_store_telemetry_001");
  });

  it("creates a verifier from runtime config", async () => {
    const config: ApiRuntimeConfig = {
      releaseProfile: "development",
      production: false,
      allowMockGenerationPolling: true,
      auth: null,
      database: null,
      storage: null,
      commerceWebhookSecret: null,
      storeVerifier: {
        provider: "http",
        endpoint: "https://store-verifier.example.test",
        apiKey: "server-store-verifier-secret"
      },
      premiumChat: null
    };
    const requests: Array<{ url: string; init: Parameters<HttpStorePurchaseVerifierFetch>[1] }> = [];
    const verifier = createHttpStorePurchaseVerifierFromRuntimeConfig(config, {
      fetch: async (url, init) => {
        requests.push({ url, init });

        return {
          status: 200,
          json: async () => ({
            purchase: {
              platform: "ios",
              productId: "premium_chat_monthly",
              transactionId: "ios_txn_store_001",
              receiptHash: validHash,
              environment: "production"
            }
          })
        };
      }
    });

    await verifier.verifyPurchase({
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_store_001",
      receiptHash: validHash,
      userId: "user_store_001",
      requestedAt: "2026-06-24T10:00:00.000Z"
    });

    expect(requests[0]?.url).toBe("https://store-verifier.example.test");
    expect(requests[0]?.init.headers.Authorization).toBe("Bearer server-store-verifier-secret");
  });
});
