import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  createAppleAppStorePurchaseVerifier,
  createAppleAppStoreServerApiJwt,
  createDirectStorePurchaseVerifierFromRuntimeConfig,
  createDirectStorePurchaseVerifier,
  createGooglePlayPurchaseVerifier,
  createGoogleServiceAccountAccessTokenProvider
} from "../directStorePurchaseVerifiers";
import type { StoreApiFetch } from "../directStorePurchaseVerifiers";

const validHash = `sha256:${"c".repeat(64)}`;

const base64Url = (value: unknown): string =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signedAppleTransaction = (payload: Record<string, unknown>) =>
  `${base64Url({ alg: "ES256", x5c: ["test-cert"] })}.${base64Url(payload)}.signature`;

describe("direct store purchase verifiers", () => {
  it("creates App Store Server API JWTs with the required claims", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const token = createAppleAppStoreServerApiJwt({
      issuerId: "issuer-001",
      keyId: "key-001",
      bundleId: "app.mongchi.mobile",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      now: () => "2026-06-24T09:00:00.000Z"
    });
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    expect(JSON.parse(Buffer.from(encodedHeader ?? "", "base64url").toString("utf8"))).toMatchObject({
      alg: "ES256",
      kid: "key-001"
    });
    expect(JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"))).toMatchObject({
      iss: "issuer-001",
      aud: "appstoreconnect-v1",
      bid: "app.mongchi.mobile",
      iat: 1782291600,
      exp: 1782292500
    });
    expect(Buffer.from(encodedSignature ?? "", "base64url")).toHaveLength(64);
  });

  it("verifies iOS purchases through the App Store transaction endpoint", async () => {
    const signedTransactionInfo = signedAppleTransaction({
      transactionId: "ios_txn_direct_001",
      originalTransactionId: "ios_original_001",
      productId: "premium_chat_monthly",
      bundleId: "app.mongchi.mobile",
      environment: "Production"
    });
    const requests: Array<{ url: string; init: Parameters<StoreApiFetch>[1] }> = [];
    const fetch: StoreApiFetch = async (url, init) => {
      requests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          signedTransactionInfo
        })
      };
    };
    const verifier = createAppleAppStorePurchaseVerifier({
      bundleId: "app.mongchi.mobile",
      jwtProvider: async () => "apple-server-jwt",
      fetch
    });

    const result = await verifier.verifyPurchase({
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_direct_001",
      receiptHash: validHash,
      storeVerificationToken: signedTransactionInfo,
      userId: "user_store_001",
      requestedAt: "2026-06-24T09:05:00.000Z"
    });

    expect(result).toEqual({
      ok: true,
      purchase: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_direct_001",
        receiptHash: validHash,
        verifiedAt: "2026-06-24T09:05:00.000Z",
        environment: "production"
      }
    });
    expect(requests[0]?.url).toBe("https://api.storekit.itunes.apple.com/inApps/v1/transactions/ios_txn_direct_001");
    expect(requests[0]?.init.headers.Authorization).toBe("Bearer apple-server-jwt");
  });

  it("checks App Store signed transaction JWS signatures when a verifier is configured", async () => {
    const signedTransactionInfo = signedAppleTransaction({
      transactionId: "ios_txn_direct_001",
      productId: "premium_chat_monthly",
      bundleId: "app.mongchi.mobile",
      environment: "Production"
    });
    const signedTransactionVerifier = {
      verifyAppStoreJws: vi.fn(() => true)
    };
    const verifier = createAppleAppStorePurchaseVerifier({
      bundleId: "app.mongchi.mobile",
      jwtProvider: async () => "apple-server-jwt",
      signedTransactionVerifier,
      fetch: async () => ({
        status: 200,
        json: async () => ({
          signedTransactionInfo
        })
      })
    });

    await expect(
      verifier.verifyPurchase({
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_direct_001",
        receiptHash: validHash,
        userId: "user_store_001",
        requestedAt: "2026-06-24T09:05:00.000Z"
      })
    ).resolves.toMatchObject({
      ok: true
    });
    expect(signedTransactionVerifier.verifyAppStoreJws).toHaveBeenCalledWith({
      jws: signedTransactionInfo,
      purpose: "transaction"
    });
  });

  it("rejects App Store transaction responses with invalid configured JWS signatures", async () => {
    const signedTransactionInfo = signedAppleTransaction({
      transactionId: "ios_txn_direct_001",
      productId: "premium_chat_monthly",
      bundleId: "app.mongchi.mobile",
      environment: "Production",
      rawProviderDetail: "must-not-leak"
    });
    const verifier = createAppleAppStorePurchaseVerifier({
      bundleId: "app.mongchi.mobile",
      jwtProvider: async () => "apple-server-jwt",
      signedTransactionVerifier: {
        verifyAppStoreJws: () => false
      },
      fetch: async () => ({
        status: 200,
        json: async () => ({
          signedTransactionInfo
        })
      })
    });

    const result = await verifier.verifyPurchase({
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_direct_001",
      receiptHash: validHash,
      userId: "user_store_001",
      requestedAt: "2026-06-24T09:05:00.000Z"
    });

    expect(result).toEqual({
      ok: false,
      error: {
        status: 503,
        code: "store_verifier_invalid_response",
        messageSafe: "Store purchase verification returned an invalid response."
      }
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  it("rejects App Store transaction mismatches without returning raw provider payloads", async () => {
    const signedTransactionInfo = signedAppleTransaction({
      transactionId: "ios_txn_direct_001",
      productId: "theme_pack_starter",
      bundleId: "app.mongchi.mobile",
      environment: "Production"
    });
    const verifier = createAppleAppStorePurchaseVerifier({
      bundleId: "app.mongchi.mobile",
      jwtProvider: async () => "apple-server-jwt",
      fetch: async () => ({
        status: 200,
        json: async () => ({
          signedTransactionInfo
        })
      })
    });

    const result = await verifier.verifyPurchase({
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_direct_001",
      receiptHash: validHash,
      userId: "user_store_001",
      requestedAt: "2026-06-24T09:05:00.000Z"
    });

    expect(result).toEqual({
      ok: false,
      error: {
        status: 409,
        code: "store_receipt_mismatch",
        messageSafe: "The store could not verify this purchase."
      }
    });
    expect(JSON.stringify(result)).not.toContain("theme_pack_starter");
  });

  it("requests Google OAuth tokens for Android Publisher API service accounts", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const requests: Array<{ url: string; init: Parameters<StoreApiFetch>[1] }> = [];
    const fetch: StoreApiFetch = async (url, init) => {
      requests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          access_token: "google-access-token",
          expires_in: 3600
        })
      };
    };
    const provider = createGoogleServiceAccountAccessTokenProvider({
      clientEmail: "android-publisher@tinypet.iam.gserviceaccount.com",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      fetch,
      now: () => "2026-06-24T09:00:00.000Z"
    });

    await expect(provider()).resolves.toBe("google-access-token");

    expect(requests[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.body).toContain("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer");
  });

  it("verifies Android subscriptions through Google Play Developer API", async () => {
    const requests: Array<{ url: string; init: Parameters<StoreApiFetch>[1] }> = [];
    const fetch: StoreApiFetch = async (url, init) => {
      requests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          latestOrderId: "gpa.1234-5678-9012",
          startTime: "2026-06-24T09:04:00Z",
          testPurchase: {},
          lineItems: [
            {
              productId: "premium_chat_monthly",
              expiryTime: "2026-07-24T09:04:00Z"
            }
          ]
        })
      };
    };
    const verifier = createGooglePlayPurchaseVerifier({
      packageName: "app.mongchi.mobile",
      accessTokenProvider: async () => "google-access-token",
      fetch
    });

    const result = await verifier.verifyPurchase({
      platform: "android",
      productId: "premium_chat_monthly",
      transactionId: "gpa.1234-5678-9012",
      receiptHash: validHash,
      storeVerificationToken: "google-play-purchase-token",
      userId: "user_store_001",
      requestedAt: "2026-06-24T09:05:00.000Z"
    });

    expect(result).toEqual({
      ok: true,
      purchase: {
        platform: "android",
        productId: "premium_chat_monthly",
        transactionId: "gpa.1234-5678-9012",
        receiptHash: validHash,
        verifiedAt: "2026-06-24T09:04:00.000Z",
        environment: "sandbox"
      }
    });
    expect(requests[0]?.url).toBe(
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/app.mongchi.mobile/purchases/subscriptionsv2/tokens/google-play-purchase-token"
    );
    expect(requests[0]?.init.headers.Authorization).toBe("Bearer google-access-token");
  });

  it("restores Android purchases with request-scoped Google Play purchase tokens", async () => {
    const requests: Array<{ url: string; init: Parameters<StoreApiFetch>[1] }> = [];
    const fetch: StoreApiFetch = async (url, init) => {
      requests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          latestOrderId: "gpa.1234-5678-9012",
          startTime: "2026-06-24T09:04:00Z",
          testPurchase: {},
          lineItems: [
            {
              productId: "premium_chat_monthly",
              expiryTime: "2026-07-24T09:04:00Z"
            }
          ]
        })
      };
    };
    const verifier = createGooglePlayPurchaseVerifier({
      packageName: "app.mongchi.mobile",
      accessTokenProvider: async () => "google-access-token",
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
          storeVerificationToken: "google-play-restore-token"
        }
      ],
      userId: "user_store_001",
      requestedAt: "2026-06-24T09:05:00.000Z"
    });

    expect(result).toEqual({
      ok: true,
      purchases: [
        {
          platform: "android",
          productId: "premium_chat_monthly",
          transactionId: "gpa.1234-5678-9012",
          receiptHash: validHash,
          verifiedAt: "2026-06-24T09:04:00.000Z",
          environment: "sandbox"
        }
      ]
    });
    expect(requests[0]?.url).toBe(
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/app.mongchi.mobile/purchases/subscriptionsv2/tokens/google-play-restore-token"
    );
  });

  it("routes direct verifiers by mobile platform", async () => {
    const verifier = createDirectStorePurchaseVerifier({
      appStore: {
        verifyPurchase: async (input) => ({
          ok: true,
          purchase: {
            platform: "ios",
            productId: input.productId,
            transactionId: input.transactionId,
            receiptHash: input.receiptHash,
            environment: "production"
          }
        })
      }
    });

    await expect(
      verifier.verifyPurchase({
        platform: "android",
        productId: "premium_chat_monthly",
        transactionId: "gpa.1234-5678-9012",
        receiptHash: validHash,
        userId: "user_store_001",
        requestedAt: "2026-06-24T09:05:00.000Z"
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        status: 503,
        code: "google_play_verifier_unavailable",
        messageSafe: "Store purchase verification is unavailable."
      }
    });
  });

  it("creates direct store verifiers from runtime config", async () => {
    const signedTransactionInfo = signedAppleTransaction({
      transactionId: "ios_txn_runtime_direct_001",
      productId: "premium_chat_monthly",
      bundleId: "app.mongchi.mobile",
      environment: "Sandbox"
    });
    const fetch: StoreApiFetch = async () => ({
      status: 200,
      json: async () => ({
        signedTransactionInfo
      })
    });
    const verifier = createDirectStorePurchaseVerifierFromRuntimeConfig(
      {
        releaseProfile: "production",
        production: true,
        allowMockGenerationPolling: false,
        auth: null,
        database: null,
        storage: null,
        commerceWebhookSecret: "commerce-webhook-secret-001",
        storeVerifier: {
          provider: "direct",
          appStore: {
            bundleId: "app.mongchi.mobile",
            issuerId: "issuer-001",
            keyId: "key-001",
            privateKey: "unused-when-token-provider-is-injected",
            environment: "sandbox"
          },
          googlePlay: {
            packageName: "app.mongchi.mobile",
            serviceAccountClientEmail: "android-publisher@tinypet.iam.gserviceaccount.com",
            serviceAccountPrivateKey: "unused-when-token-provider-is-injected"
          }
        },
        premiumChat: null
      },
      {
        fetch,
        appStoreJwtProvider: async () => "apple-server-jwt",
        googlePlayAccessTokenProvider: async () => "google-access-token"
      }
    );

    await expect(
      verifier.verifyPurchase({
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_runtime_direct_001",
        receiptHash: validHash,
        userId: "user_store_001",
        requestedAt: "2026-06-24T09:05:00.000Z"
      })
    ).resolves.toMatchObject({
      ok: true,
      purchase: {
        environment: "sandbox"
      }
    });
  });
});
