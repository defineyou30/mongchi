import { describe, expect, it } from "vitest";

import type { MobileApiFetch, MobileApiRequestInit } from "./mobileApiClient";
import { createMobileApiClient, resolveMobileApiBaseUrl } from "./mobileApiClient";

const createJsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body)
});

describe("mobile API client", () => {
  it("resolves API base URLs without allowing unsafe production HTTP", () => {
    expect(resolveMobileApiBaseUrl(" https://api.example.com/v1/ ")).toEqual({
      ok: true,
      baseUrl: "https://api.example.com/v1"
    });
    expect(resolveMobileApiBaseUrl("http://localhost:8787")).toEqual({
      ok: true,
      baseUrl: "http://localhost:8787"
    });
    expect(resolveMobileApiBaseUrl("")).toMatchObject({
      ok: false,
      error: { code: "api_base_url_invalid" }
    });
    expect(resolveMobileApiBaseUrl("http://api.example.com")).toMatchObject({
      ok: false,
      error: { code: "api_base_url_invalid" }
    });
  });

  it("sends auth headers and encoded paths without storing provider secrets", async () => {
    const calls: Array<{ url: string; init: MobileApiRequestInit }> = [];
    const fetchImpl: MobileApiFetch = async (url, init) => {
      calls.push({ url, init });

      return createJsonResponse(200, {
        id: "gen_001",
        status: "completed"
      });
    };
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com/",
      authTokenProvider: () => "session-token",
      localeProvider: () => "ja-JP",
      timezoneProvider: () => "Asia/Tokyo",
      fetchImpl
    });

    const result = await client.getGenerationJob("gen id/with slash");

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.example.com/v1/generation-jobs/gen%20id%2Fwith%20slash");
    expect(calls[0]?.init.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer session-token",
      "x-locale": "ja-JP",
      "x-timezone": "Asia/Tokyo"
    });
    expect(JSON.stringify(calls[0]?.init)).not.toMatch(/openai|provider|secret|receipt/i);
  });

  it("omits auth headers when no provider token is available", async () => {
    const calls: Array<{ url: string; init: MobileApiRequestInit }> = [];
    const fetchImpl: MobileApiFetch = async (url, init) => {
      calls.push({ url, init });

      return createJsonResponse(200, { id: "user_demo_001" });
    };
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com",
      authTokenProvider: async () => null,
      fetchImpl
    });

    await client.getCurrentUser();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.headers).toMatchObject({
      Accept: "application/json"
    });
    expect(calls[0]?.init.headers).not.toHaveProperty("Authorization");
  });

  it("bounds requests that never settle", async () => {
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com",
      requestTimeoutMs: 5,
      fetchImpl: async () => new Promise<never>(() => undefined)
    });

    await expect(client.getCurrentUser()).resolves.toMatchObject({
      ok: false,
      error: { code: "network_timeout", retryable: true }
    });
  });

  it("routes pet list, update, and delete requests through typed endpoint methods", async () => {
    const calls: Array<{ url: string; init: MobileApiRequestInit }> = [];
    const fetchImpl: MobileApiFetch = async (url, init) => {
      calls.push({ url, init });

      return createJsonResponse(200, { pets: [] });
    };
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl
    });

    await client.listPets();
    await client.updatePet("pet id/1", { name: "Nori" });
    await client.deletePet("pet id/1");
    await client.deleteOriginalPhotos({ petId: "pet id/1" });
    await client.deleteChatHistory();
    await client.deletePrivacyPet("pet id/1");
    await client.pollGenerationJob("gen id/1");
    await client.getGeneratedAssetSignedUrl("asset id/1");

    expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
      "GET https://api.example.com/v1/pets",
      "PATCH https://api.example.com/v1/pets/pet%20id%2F1",
      "DELETE https://api.example.com/v1/pets/pet%20id%2F1",
      "DELETE https://api.example.com/v1/privacy/original-photos",
      "DELETE https://api.example.com/v1/privacy/chat-history",
      "DELETE https://api.example.com/v1/privacy/pet/pet%20id%2F1",
      "POST https://api.example.com/v1/generation-jobs/gen%20id%2F1/poll",
      "GET https://api.example.com/v1/assets/asset%20id%2F1/signed-url"
    ]);
    expect(calls[1]?.init.body).toBe(JSON.stringify({ name: "Nori" }));
    expect(calls[3]?.init.body).toBe(JSON.stringify({ petId: "pet id/1" }));
  });

  it("routes daily loop catalog, inventory, care, and walk endpoint methods", async () => {
    const calls: Array<{ url: string; init: MobileApiRequestInit }> = [];
    const fetchImpl: MobileApiFetch = async (url, init) => {
      calls.push({ url, init });

      return createJsonResponse(200, {});
    };
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com/",
      fetchImpl
    });

    await client.getCareState("pet id/1");
    await client.performCareAction("pet id/1", {
      action: "feed",
      occurredAt: "2026-06-24T09:00:00.000Z"
    });
    await client.startWalk("pet id/1");
    await client.claimWalkReward("walk id/1");
    await client.getReactionCatalog();
    await client.getItemCatalog();
    await client.getInventory();
    await client.purchaseInventoryItem({ itemId: "item id/1" });
    await client.placeInventoryItem({ itemId: "item id/1" });
    await client.removePlacedItem("item id/1");
    await client.getCommerceProducts();
    await client.getEntitlements();
    await client.verifyPurchase({
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "txn_001",
      receiptHash: "sha256:mock",
      storeVerificationToken: "app-store-jws.header.payload.signature"
    });
    await client.restorePurchases({
      platform: "android",
      transactionIds: ["gpa.1234-5678-9012"],
      purchases: [
        {
          productId: "premium_chat_monthly",
          transactionId: "gpa.1234-5678-9012",
          receiptHash: "sha256:mock",
          storeVerificationToken: "google-play-purchase-token"
        }
      ]
    });

    expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
      "GET https://api.example.com/v1/pets/pet%20id%2F1/care-state",
      "POST https://api.example.com/v1/pets/pet%20id%2F1/care-actions",
      "POST https://api.example.com/v1/pets/pet%20id%2F1/walks",
      "POST https://api.example.com/v1/walks/walk%20id%2F1/claim",
      "GET https://api.example.com/v1/reaction-catalog",
      "GET https://api.example.com/v1/catalog/items",
      "GET https://api.example.com/v1/inventory",
      "POST https://api.example.com/v1/inventory/purchases",
      "POST https://api.example.com/v1/inventory/placements",
      "DELETE https://api.example.com/v1/inventory/placements/item%20id%2F1",
      "GET https://api.example.com/v1/commerce/products",
      "GET https://api.example.com/v1/entitlements",
      "POST https://api.example.com/v1/commerce/purchases/verify",
      "POST https://api.example.com/v1/commerce/restore"
    ]);
    expect(calls[1]?.init.body).toBe(JSON.stringify({ action: "feed", occurredAt: "2026-06-24T09:00:00.000Z" }));
    expect(calls[7]?.init.body).toBe(JSON.stringify({ itemId: "item id/1" }));
    expect(calls[8]?.init.body).toBe(JSON.stringify({ itemId: "item id/1" }));
    expect(calls[12]?.init.body).toBe(
      JSON.stringify({
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "txn_001",
        receiptHash: "sha256:mock",
        storeVerificationToken: "app-store-jws.header.payload.signature"
      })
    );
    expect(calls[13]?.init.body).toBe(
      JSON.stringify({
        platform: "android",
        transactionIds: ["gpa.1234-5678-9012"],
        purchases: [
          {
            productId: "premium_chat_monthly",
            transactionId: "gpa.1234-5678-9012",
            receiptHash: "sha256:mock",
            storeVerificationToken: "google-play-purchase-token"
          }
        ]
      })
    );
  });

  it("serializes JSON requests and maps safe API errors", async () => {
    const calls: Array<{ url: string; init: MobileApiRequestInit }> = [];
    const fetchImpl: MobileApiFetch = async (url, init) => {
      calls.push({ url, init });

      return createJsonResponse(422, {
        error: {
          code: "source_photo_required",
          messageSafe: "A source pet photo is required."
        }
      });
    };
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl
    });
    const result = await client.createGenerationJob({
      petId: "pet_001",
      sourcePhotoIds: [],
      optionalPhotoIds: []
    });

    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json"
    });
    expect(calls[0]?.init.body).toBe(JSON.stringify({ petId: "pet_001", sourcePhotoIds: [], optionalPhotoIds: [] }));
    expect(result).toEqual({
      ok: false,
      error: {
        status: 422,
        code: "source_photo_required",
        messageSafe: "A source pet photo is required.",
        retryable: false
      }
    });
  });

  it("sends category-only generation issue reports", async () => {
    const calls: Array<{ url: string; init: MobileApiRequestInit }> = [];
    const fetchImpl: MobileApiFetch = async (url, init) => {
      calls.push({ url, init });

      return createJsonResponse(201, {
        reportId: "gen_issue_001",
        petId: "pet_001",
        generationJobId: "gen_001",
        category: "wrong_pet",
        reportedAt: "2026-06-24T09:10:00.000Z"
      });
    };
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl
    });

    const result = await client.reportGenerationIssue({
      petId: "pet_001",
      generationJobId: "gen_001",
      category: "wrong_pet"
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.example.com/v1/generation-issue-reports");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe(
      JSON.stringify({
        petId: "pet_001",
        generationJobId: "gen_001",
        category: "wrong_pet"
      })
    );
    expect(calls[0]?.init.body).not.toMatch(/photo|image|message|text|prompt/i);
  });

  it("returns retryable safe errors for network failures", async () => {
    const client = createMobileApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl: async () => {
        throw new Error("raw low-level failure");
      }
    });

    await expect(client.getCurrentUser()).resolves.toEqual({
      ok: false,
      error: {
        status: 0,
        code: "network_error",
        messageSafe: "Network request failed. Check your connection and try again.",
        retryable: true
      }
    });
  });
});
