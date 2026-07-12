import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type {
  AcceptGenerationJobResponse,
  CareActionResponse,
  CreateGenerationJobRequest,
  CurrentUserResponse,
  DeletePetResponse,
  GeneratedAssetSignedUrlResponse,
  GenerationIssueReportResponse,
  InventoryPlacementResponse,
  ItemCatalogResponse,
  ListPetsResponse,
  PetAssetsResponse,
  PhotoUploadUrlResponse,
  ReactionCatalogResponse,
  StartWalkResponse
} from "../contracts";
import { createApiHttpRouter } from "../httpRouter";
import type { ApiHttpResponse } from "../httpRouter";
import type { StorePurchaseVerifier } from "../purchaseVerifier";
import type { ApiSessionVerifier } from "../sessionVerifier";
import type { PrivateStorageSigner } from "../storageSigner";
import type { CompletePhotoUploadResponse } from "../service";

const validHash = `sha256:${"b".repeat(64)}`;
const userHeaders = {
  authorization: "Bearer user_router_001",
  "x-locale": "en-US",
  "x-timezone": "America/New_York"
};
const base64Url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const jws = (payload: unknown): string => `${base64Url({ alg: "ES256" })}.${base64Url(payload)}.signature`;
const googlePubSubBody = (payload: unknown) => ({
  message: {
    data: Buffer.from(JSON.stringify(payload)).toString("base64"),
    messageId: "msg_router_store_001"
  }
});

const expectError = (response: ApiHttpResponse, status: number, code: string) => {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({
    error: {
      status,
      code
    }
  });
};

describe("API HTTP router", () => {
  it.each(["en-US", "ko-KR", "ja-JP", "zh-TW", "de-DE", "fr-FR", "pt-BR", "es-MX"])(
    "preserves the supported %s locale from the request header",
    (locale) => {
      const router = createApiHttpRouter();

      const response = router.handle({
        method: "GET",
        path: "/v1/me",
        headers: {
          authorization: "Bearer user_demo_001",
          "x-locale": locale
        }
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ locale });
    }
  );

  it("accepts Portuguese in the weather request body locale boundary", () => {
    const router = createApiHttpRouter();

    const response = router.handle({
      method: "POST",
      path: "/v1/weather/current",
      headers: userHeaders,
      body: {
        approximateLatitude: 37.5,
        approximateLongitude: 127,
        requestedAt: "2026-07-12T09:00:00.000Z",
        locale: "pt-BR"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      weather: {
        regionLabel: "Clima local aproximado"
      }
    });
  });

  it("resolves default auth from headers and returns safe auth errors", () => {
    const router = createApiHttpRouter();

    const unauthenticated = router.handle({ method: "GET", path: "/v1/me" });

    expectError(unauthenticated, 401, "auth_required");

    const authenticated = router.handle({
      method: "GET",
      path: "/v1/me?ignored=true",
      headers: {
        authorization: "Bearer user_demo_001",
        "x-locale": "en-US",
        "x-timezone": "America/New_York"
      }
    });

    expect(authenticated.status).toBe(200);
    expect(authenticated.body as CurrentUserResponse).toMatchObject({
      userId: "user_demo_001",
      locale: "en-US",
      timezone: "America/New_York",
      onboardingState: "pet_active"
    });
  });

  it("can disable default mock auth for production-style mounts", () => {
    const router = createApiHttpRouter({ allowMockAuth: false });

    expectError(
      router.handle({
        method: "GET",
        path: "/v1/me",
        headers: {
          authorization: "Bearer user_demo_001",
          "x-mock-user-id": "user_demo_001"
        }
      }),
      401,
      "auth_required"
    );

    const trustedAuthRouter = createApiHttpRouter({
      allowMockAuth: false,
      resolveAuthContext: () => ({
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York"
      })
    });
    const response = trustedAuthRouter.handle({
      method: "GET",
      path: "/v1/me",
      headers: {
        authorization: "Bearer ignored-dev-token"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body as CurrentUserResponse).toMatchObject({
      userId: "user_provider_001",
      locale: "en-US",
      timezone: "America/New_York"
    });
  });

  it("routes async requests through an injected session verifier", async () => {
    const verifierCalls: Array<{ token: string; locale: string; timezone: string }> = [];
    const sessionVerifier: ApiSessionVerifier = {
      verifySession: async (input) => {
        verifierCalls.push({
          token: input.token,
          locale: input.locale,
          timezone: input.timezone
        });

        return {
          ok: true,
          session: {
            userId: "user_provider_001",
            locale: input.locale,
            timezone: input.timezone,
            provider: "test-provider",
            subject: "provider-subject-001"
          }
        };
      }
    };
    const router = createApiHttpRouter({
      allowMockAuth: false,
      sessionVerifier
    });

    expectError(
      router.handle({
        method: "GET",
        path: "/v1/me",
        headers: {
          authorization: "Bearer provider-token-001",
          "x-locale": "en-US",
          "x-timezone": "America/New_York"
        }
      }),
      401,
      "auth_required"
    );

    const response = await router.handleAsync({
      method: "GET",
      path: "/v1/me",
      headers: {
        authorization: "Bearer provider-token-001",
        "x-locale": "en-US",
        "x-timezone": "America/New_York"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      userId: "user_provider_001",
      locale: "en-US",
      timezone: "America/New_York"
    });
    expect(verifierCalls).toEqual([
      {
        token: "provider-token-001",
        locale: "en-US",
        timezone: "America/New_York"
      }
    ]);
  });

  it("returns safe async auth errors from the session verifier", async () => {
    const sessionVerifier: ApiSessionVerifier = {
      verifySession: async () => ({
        ok: false,
        error: {
          status: 401,
          code: "session_invalid",
          messageSafe: "Sign in is required."
        }
      })
    };
    const router = createApiHttpRouter({
      allowMockAuth: false,
      sessionVerifier
    });

    expectError(
      await router.handleAsync({
        method: "GET",
        path: "/v1/me",
        headers: {
          authorization: "Bearer invalid-provider-token"
        }
      }),
      401,
      "session_invalid"
    );
  });

  it("routes signed storage URLs through an injected async private storage signer", async () => {
    const signer: PrivateStorageSigner = {
      createOriginalPhotoUpload: async (input) => ({
        ok: true,
        signed: {
          uploadUrl: `https://storage.example.com/uploads/${input.photoId}`,
          uploadMethod: "PUT",
          uploadHeaders: {
            "Content-Type": input.contentType
          }
        }
      }),
      createGeneratedAssetRead: async (input) => ({
        ok: true,
        signed: {
          signedUrl: `https://storage.example.com/assets/${input.assetId}`,
          contentType: input.contentType
        }
      })
    };
    const router = createApiHttpRouter({
      allowMockStorageSigning: false,
      privateStorageSigner: signer
    });
    const headers = {
      ...userHeaders,
      authorization: "Bearer user_demo_001"
    };
    const assetId = router.service.inspectState().generatedAssets[0]!.id;
    const syncUpload = router.handle({
      method: "POST",
      path: "/v1/photos/upload-url",
      headers,
      body: {
        petId: "pet_miso_001",
        contentType: "image/png",
        byteSize: 4096
      }
    });
    const asyncUpload = await router.handleAsync({
      method: "POST",
      path: "/v1/photos/upload-url",
      headers,
      body: {
        petId: "pet_miso_001",
        contentType: "image/png",
        byteSize: 4096
      }
    });
    const asyncRead = await router.handleAsync({
      method: "GET",
      path: `/v1/assets/${encodeURIComponent(assetId)}/signed-url`,
      headers
    });

    expectError(syncUpload, 503, "storage_signing_unavailable");
    expect(asyncUpload.status).toBe(201);
    expect((asyncUpload.body as PhotoUploadUrlResponse).uploadUrl).toMatch(/^https:\/\/storage\.example\.com\/uploads\//);
    expect(asyncRead.status).toBe(200);
    expect((asyncRead.body as GeneratedAssetSignedUrlResponse).signedUrl).toBe(
      `https://storage.example.com/assets/${assetId}`
    );
  });

  it("can disable mock purchase verification for production-style mounts", () => {
    const router = createApiHttpRouter({ allowMockPurchaseVerification: false });
    const headers = {
      ...userHeaders,
      authorization: "Bearer user_demo_001"
    };

    const products = router.handle({ method: "GET", path: "/v1/commerce/products", headers });
    const verified = router.handle({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers,
      body: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_router_disabled_001",
        receiptHash: validHash
      }
    });
    const restored = router.handle({
      method: "POST",
      path: "/v1/commerce/restore",
      headers,
      body: {
        platform: "ios",
        transactionIds: ["ios_router_disabled_001"]
      }
    });

    expect(products.status).toBe(200);
    expectError(verified, 503, "purchase_verification_unavailable");
    expectError(restored, 503, "purchase_verification_unavailable");
    expect(router.service.inspectState().purchaseLedger).toHaveLength(0);
  });

  it("routes commerce verification through an injected async store verifier", async () => {
    const verifier: StorePurchaseVerifier = {
      verifyPurchase: async (input) => ({
        ok: true,
        purchase: {
          platform: input.platform,
          productId: input.productId,
          transactionId: input.transactionId,
          receiptHash: input.receiptHash,
          verifiedAt: "2026-06-24T10:15:00.000Z",
          environment: "production"
        }
      })
    };
    const router = createApiHttpRouter({
      allowMockPurchaseVerification: false,
      purchaseVerifier: verifier
    });
    const headers = {
      ...userHeaders,
      authorization: "Bearer user_demo_001"
    };
    const syncResponse = router.handle({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers,
      body: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_router_store_001",
        receiptHash: validHash
      }
    });
    const asyncResponse = await router.handleAsync({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers,
      body: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_router_store_001",
        receiptHash: validHash
      }
    });

    expectError(syncResponse, 503, "purchase_verification_unavailable");
    expect(asyncResponse.status).toBe(201);
    expect(asyncResponse.body).toMatchObject({
      serverVerified: true,
      entitlements: [
        {
          key: "premium_chat",
          source: "purchase"
        }
      ]
    });
  });

  it("requires a commerce webhook secret before routing purchase revocations", () => {
    const routerWithoutSecret = createApiHttpRouter();
    const router = createApiHttpRouter({
      commerceWebhookSecret: "commerce-webhook-secret-001"
    });
    const headers = {
      ...userHeaders,
      authorization: "Bearer user_demo_001"
    };
    const purchase = router.handle({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers,
      body: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_router_revoke_001",
        receiptHash: validHash
      }
    });
    const unavailable = routerWithoutSecret.handle({
      method: "POST",
      path: "/v1/commerce/purchases/revoke",
      body: {
        platform: "ios",
        transactionId: "ios_router_revoke_001",
        reason: "refund"
      }
    });
    const forbidden = router.handle({
      method: "POST",
      path: "/v1/commerce/purchases/revoke",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "wrong-secret"
      },
      body: {
        platform: "ios",
        transactionId: "ios_router_revoke_001",
        reason: "refund"
      }
    });
    const revoked = router.handle({
      method: "POST",
      path: "/v1/commerce/purchases/revoke",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "commerce-webhook-secret-001"
      },
      body: {
        platform: "ios",
        transactionId: "ios_router_revoke_001",
        reason: "refund"
      }
    });

    expect(purchase.status).toBe(201);
    expectError(unavailable, 503, "commerce_webhook_unavailable");
    expectError(forbidden, 403, "commerce_webhook_forbidden");
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({
      revoked: true,
      entitlement: {
        status: "revoked"
      }
    });
    expect(router.service.inspectState().purchaseLedger[0]).toMatchObject({
      status: "revoked",
      revocationReason: "refund"
    });
  });

  it("routes App Store server notifications through the commerce webhook ingress", () => {
    const appStoreJwsVerifier = {
      verifyAppStoreJws: vi.fn(() => true)
    };
    const router = createApiHttpRouter({
      commerceWebhookSecret: "commerce-webhook-secret-001",
      storeWebhookOptions: {
        appStoreBundleId: "app.mongchi.mobile",
        appStoreJwsVerifier
      }
    });
    const purchase = router.handle({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers: userHeaders,
      body: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_router_store_webhook_001",
        receiptHash: validHash
      }
    });
    const revoked = router.handle({
      method: "POST",
      path: "/v1/commerce/store-webhooks",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "commerce-webhook-secret-001"
      },
      body: {
        signedPayload: jws({
          notificationType: "REFUND",
          data: {
            bundleId: "app.mongchi.mobile",
            signedTransactionInfo: jws({
              transactionId: "ios_router_store_webhook_001",
              productId: "premium_chat_monthly",
              bundleId: "app.mongchi.mobile"
            })
          }
        })
      }
    });

    expect(purchase.status).toBe(201);
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({
      revoked: true,
      entitlement: {
        status: "revoked",
        metadata: {
          revocationReason: "refund"
        }
      }
    });
    expect(appStoreJwsVerifier.verifyAppStoreJws).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "notification"
      })
    );
    expect(appStoreJwsVerifier.verifyAppStoreJws).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "transaction"
      })
    );
  });

  it("routes Google Play RTDN revocations by token hash without storing the token", () => {
    const purchaseToken = "google-play-token-production-router-001";
    const receiptHash = `sha256:${createHash("sha256").update(purchaseToken).digest("hex")}`;
    const webhookEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const router = createApiHttpRouter({
      commerceWebhookSecret: "commerce-webhook-secret-001",
      storeWebhookOptions: {
        googlePlayPackageName: "app.mongchi.mobile"
      },
      commerceWebhookLogger: {
        info: (event, metadata) => webhookEvents.push({ event, metadata }),
        error: (event, metadata) => webhookEvents.push({ event, metadata })
      }
    });
    const purchase = router.handle({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers: userHeaders,
      body: {
        platform: "android",
        productId: "premium_chat_monthly",
        transactionId: "gpa.1234-5678-9012",
        receiptHash
      }
    });
    const renewed = router.handle({
      method: "POST",
      path: "/v1/commerce/store-webhooks",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "commerce-webhook-secret-001"
      },
      body: googlePubSubBody({
        version: "1.0",
        packageName: "app.mongchi.mobile",
        subscriptionNotification: {
          version: "1.0",
          notificationType: 2,
          purchaseToken,
          subscriptionId: "premium_chat_monthly"
        }
      })
    });
    const revoked = router.handle({
      method: "POST",
      path: "/v1/commerce/store-webhooks",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "commerce-webhook-secret-001"
      },
      body: googlePubSubBody({
        version: "1.0",
        packageName: "app.mongchi.mobile",
        subscriptionNotification: {
          version: "1.0",
          notificationType: 12,
          purchaseToken,
          subscriptionId: "premium_chat_monthly"
        }
      })
    });

    expect(purchase.status).toBe(201);
    expect(renewed.status).toBe(202);
    expect(renewed.body).toMatchObject({
      ignored: true,
      reason: "store_notification_not_relevant"
    });
    expect(revoked.status).toBe(200);
    expect(router.service.inspectState().purchaseLedger[0]).toMatchObject({
      status: "revoked",
      revocationReason: "store_revoke"
    });
    expect(webhookEvents).toEqual([
      {
        event: "commerce_store_webhook_ignored",
        metadata: {
          source: "google_play_rtdn",
          eventType: "2",
          status: 202
        }
      },
      {
        event: "commerce_store_webhook_processed",
        metadata: {
          source: "google_play_rtdn",
          action: "revoke_by_receipt_hash",
          platform: "android",
          reason: "store_revoke",
          status: 200
        }
      }
    ]);
    expect(JSON.stringify(router.service.inspectState().purchaseLedger)).not.toContain(purchaseToken);
    expect(JSON.stringify(webhookEvents)).not.toContain(purchaseToken);
    expect(JSON.stringify(webhookEvents)).not.toContain(receiptHash);
  });

  it("routes pet create, list, update, and delete through the mock service", () => {
    const router = createApiHttpRouter();

    const created = router.handle({
      method: "POST",
      path: "/v1/pets",
      headers: userHeaders,
      body: {
        name: "  Nori   Bean ",
        species: "dog",
        personalityTags: ["playful", "curious"],
        talkingStyle: "cute",
        favoriteThing: "tiny ball"
      }
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      userId: "user_router_001",
      name: "Nori Bean",
      lifecycleStatus: "draft"
    });

    const petId = (created.body as { id: string }).id;
    const listed = router.handle({ method: "GET", path: "/v1/pets", headers: userHeaders });

    expect(listed.status).toBe(200);
    expect((listed.body as ListPetsResponse).pets.map((pet) => pet.id)).toContain(petId);

    const updated = router.handle({
      method: "PATCH",
      path: `/v1/pets/${encodeURIComponent(petId)}`,
      headers: userHeaders,
      body: {
        name: "Nori Star",
        favoriteThing: ""
      }
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: petId,
      name: "Nori Star"
    });
    expect((updated.body as { favoriteThing?: string }).favoriteThing).toBeUndefined();

    const deleted = router.handle({
      method: "DELETE",
      path: `/v1/pets/${encodeURIComponent(petId)}`,
      headers: userHeaders
    });

    expect(deleted.status).toBe(200);
    expect(deleted.body as DeletePetResponse).toEqual({
      deletedPetId: petId,
      deletedAt: "2026-06-24T09:00:00.000Z"
    });

    const listedAfterDelete = router.handle({ method: "GET", path: "/v1/pets", headers: userHeaders });

    expect((listedAfterDelete.body as ListPetsResponse).pets.some((pet) => pet.id === petId)).toBe(false);
  });

  it("routes source photo upload, generation job read, asset listing, and accept", async () => {
    const router = createApiHttpRouter();
    const createdPet = router.handle({
      method: "POST",
      path: "/v1/pets",
      headers: userHeaders,
      body: {
        name: "Miso",
        species: "dog",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle"
      }
    });
    const petId = (createdPet.body as { id: string }).id;
    const upload = router.handle({
      method: "POST",
      path: "/v1/photos/upload-url",
      headers: userHeaders,
      body: {
        petId,
        contentType: "image/png",
        byteSize: 4096
      }
    });

    expect(upload.status).toBe(201);

    const photoId = (upload.body as PhotoUploadUrlResponse).photoId;
    const completedUpload = router.handle({
      method: "POST",
      path: "/v1/photos/complete-upload",
      headers: userHeaders,
      body: {
        photoId,
        contentHash: validHash
      }
    });

    expect(completedUpload.status).toBe(200);
    expect((completedUpload.body as CompletePhotoUploadResponse).photo.status).toBe("uploaded");

    const generationRequest: CreateGenerationJobRequest = {
      petId,
      sourcePhotoIds: [photoId],
      optionalPhotoIds: []
    };
    const createdJob = router.handle({
      method: "POST",
      path: "/v1/generation-jobs",
      headers: userHeaders,
      body: generationRequest
    });

    expect(createdJob.status).toBe(201);

    const jobId = (createdJob.body as { id: string }).id;
    const readJob = router.handle({
      method: "GET",
      path: `/v1/generation-jobs/${encodeURIComponent(jobId)}`,
      headers: userHeaders
    });

    expect(readJob.status).toBe(200);
    expect(readJob.body).toMatchObject({
      id: jobId,
      status: "created"
    });

    const polledJob = router.handle({
      method: "POST",
      path: `/v1/generation-jobs/${encodeURIComponent(jobId)}/poll`,
      headers: userHeaders
    });

    expect(polledJob.status).toBe(200);
    expect(polledJob.body).toMatchObject({
      job: {
        id: jobId,
        status: "preprocessing"
      },
      assets: []
    });

    const completedJob = await router.service.completeMockGenerationJob({ userId: "user_router_001" }, jobId);

    expect(completedJob.ok).toBe(true);

    if (!completedJob.ok) {
      throw new Error("Expected completed mock generation job");
    }

    const listedAssets = router.handle({
      method: "GET",
      path: `/v1/pets/${encodeURIComponent(petId)}/assets`,
      headers: userHeaders
    });

    expect(listedAssets.status).toBe(200);
    expect((listedAssets.body as PetAssetsResponse).assets).toHaveLength(completedJob.data.assets.length);

    const signedReadUrl = router.handle({
      method: "GET",
      path: `/v1/assets/${encodeURIComponent(completedJob.data.assets[0]!.id)}/signed-url`,
      headers: userHeaders
    });

    expect(signedReadUrl.status).toBe(200);
    expect(signedReadUrl.body as GeneratedAssetSignedUrlResponse).toMatchObject({
      assetId: completedJob.data.assets[0]!.id,
      petId,
      storageClass: "private_app_asset",
      expiresAt: "2026-06-24T09:10:00.000Z"
    });

    const accepted = router.handle({
      method: "POST",
      path: `/v1/generation-jobs/${encodeURIComponent(jobId)}/accept`,
      headers: userHeaders,
      body: {
        acceptedAssetIds: [completedJob.data.assets[0]?.id]
      }
    });

    expect(accepted.status).toBe(200);
    expect((accepted.body as AcceptGenerationJobResponse).pet).toMatchObject({
      id: petId,
      lifecycleStatus: "active",
      activeGenerationJobId: jobId
    });

    const issueReport = router.handle({
      method: "POST",
      path: "/v1/generation-issue-reports",
      headers: userHeaders,
      body: {
        petId,
        generationJobId: jobId,
        category: "wrong_pet"
      }
    });

    expect(issueReport.status).toBe(201);
    expect(issueReport.body as GenerationIssueReportResponse).toMatchObject({
      petId,
      generationJobId: jobId,
      category: "wrong_pet",
      reportedAt: "2026-06-24T09:00:00.000Z"
    });
    expect(router.service.inspectState().generationIssueReports).toMatchObject([
      {
        userId: "user_router_001",
        petId,
        generationJobId: jobId,
        category: "wrong_pet"
      }
    ]);

    const deletedOriginalPhotos = router.handle({
      method: "DELETE",
      path: "/v1/privacy/original-photos",
      headers: userHeaders,
      body: {
        petId
      }
    });

    expect(deletedOriginalPhotos.status).toBe(200);
    expect(deletedOriginalPhotos.body).toMatchObject({
      deletedPhotoIds: [photoId],
      deletedAt: "2026-06-24T09:00:00.000Z"
    });
  });

  it("rejects mismatched path/body identifiers and unknown routes safely", () => {
    const router = createApiHttpRouter();

    expectError(
      router.handle({
        method: "POST",
        path: "/v1/generation-jobs/gen_path/accept",
        headers: userHeaders,
        body: {
          jobId: "gen_body",
          acceptedAssetIds: []
        }
      }),
      422,
      "path_body_mismatch"
    );

    expectError(router.handle({ method: "GET", path: "/v1/catalog/themes", headers: userHeaders }), 404, "route_not_found");
  });

  it("routes privacy chat history and pet deletion endpoints", async () => {
    const router = createApiHttpRouter();
    const demoHeaders = {
      ...userHeaders,
      authorization: "Bearer user_demo_001"
    };
    const verified = await router.service.verifyPurchase(
      { userId: "user_demo_001" },
      {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_router_chat_001",
        receiptHash: validHash
      }
    );

    expect(verified.ok).toBe(true);

    const conversation = router.handle({
      method: "POST",
      path: "/v1/conversations",
      headers: demoHeaders,
      body: {
        petId: "pet_miso_001",
        disclosureAccepted: true
      }
    });

    expect(conversation.status).toBe(201);

    const conversationId = (conversation.body as { conversation: { id: string } }).conversation.id;
    const message = router.handle({
      method: "POST",
      path: `/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      headers: demoHeaders,
      body: {
        text: "hello"
      }
    });

    expect(message.status).toBe(200);

    const readConversation = router.handle({
      method: "GET",
      path: `/v1/conversations/${encodeURIComponent(conversationId)}`,
      headers: demoHeaders
    });

    expect(readConversation.status).toBe(200);
    expect(readConversation.body).toMatchObject({
      conversation: {
        id: conversationId,
        status: "open"
      },
      messages: [
        {
          sender: "user"
        },
        {
          sender: "pet_ai"
        }
      ]
    });

    const deletedSingleConversation = router.handle({
      method: "DELETE",
      path: `/v1/conversations/${encodeURIComponent(conversationId)}`,
      headers: demoHeaders
    });

    expect(deletedSingleConversation.status).toBe(200);
    expect(deletedSingleConversation.body).toMatchObject({
      deletedConversationId: conversationId,
      deletedAt: "2026-06-24T09:00:00.000Z"
    });
    expect((deletedSingleConversation.body as { deletedMessageIds: string[] }).deletedMessageIds).toHaveLength(2);

    const secondConversation = router.handle({
      method: "POST",
      path: "/v1/conversations",
      headers: demoHeaders,
      body: {
        petId: "pet_miso_001",
        disclosureAccepted: true
      }
    });
    const secondConversationId = (secondConversation.body as { conversation: { id: string } }).conversation.id;

    const deletedChat = router.handle({
      method: "DELETE",
      path: "/v1/privacy/chat-history",
      headers: demoHeaders
    });

    expect(deletedChat.status).toBe(200);
    expect(deletedChat.body).toMatchObject({
      deletedConversationIds: [secondConversationId],
      deletedAt: "2026-06-24T09:00:00.000Z"
    });
    expect((deletedChat.body as { deletedMessageIds: string[] }).deletedMessageIds).toHaveLength(0);

    const deletedPet = router.handle({
      method: "DELETE",
      path: "/v1/privacy/pet/pet_miso_001",
      headers: demoHeaders
    });

    expect(deletedPet.status).toBe(200);
    expect(deletedPet.body).toMatchObject({
      deletedPetId: "pet_miso_001",
      deletedAt: "2026-06-24T09:00:00.000Z"
    });
  });

  it("routes daily loop catalog, inventory, care, and walk endpoints", () => {
    const router = createApiHttpRouter();
    const demoHeaders = {
      ...userHeaders,
      authorization: "Bearer user_demo_001"
    };
    const reactions = router.handle({ method: "GET", path: "/v1/reaction-catalog", headers: demoHeaders });
    const items = router.handle({ method: "GET", path: "/v1/catalog/items", headers: demoHeaders });
    const inventory = router.handle({ method: "GET", path: "/v1/inventory", headers: demoHeaders });
    const removedPlacement = router.handle({
      method: "DELETE",
      path: "/v1/inventory/placements/item_toy_ball_mint",
      headers: demoHeaders
    });
    const placedInventory = router.handle({
      method: "POST",
      path: "/v1/inventory/placements",
      headers: demoHeaders,
      body: {
        itemId: "item_toy_ball_mint"
      }
    });
    const commerceProducts = router.handle({ method: "GET", path: "/v1/commerce/products", headers: demoHeaders });
    const entitlements = router.handle({ method: "GET", path: "/v1/entitlements", headers: demoHeaders });
    const careState = router.handle({ method: "GET", path: "/v1/pets/pet_miso_001/care-state", headers: demoHeaders });
    const careAction = router.handle({
      method: "POST",
      path: "/v1/pets/pet_miso_001/care-actions",
      headers: demoHeaders,
      body: {
        action: "feed",
        occurredAt: "2026-06-24T09:10:00.000Z"
      }
    });
    const walk = router.handle({
      method: "POST",
      path: "/v1/pets/pet_miso_001/walks",
      headers: demoHeaders
    });

    expect(reactions.status).toBe(200);
    expect((reactions.body as ReactionCatalogResponse).locale).toBe("en-US");
    expect(items.status).toBe(200);
    expect((items.body as ItemCatalogResponse).items.map((item) => item.id)).toContain("item_toy_ball_mint");
    expect(inventory.status).toBe(200);
    expect(inventory.body).toMatchObject({ userId: "user_demo_001" });
    expect(removedPlacement.status).toBe(200);
    expect((removedPlacement.body as InventoryPlacementResponse).inventory.placedItems.some((item) => item.itemId === "item_toy_ball_mint")).toBe(
      false
    );
    expect(placedInventory.status).toBe(200);
    expect((placedInventory.body as InventoryPlacementResponse).inventory.placedItems).toContainEqual(
      expect.objectContaining({ itemId: "item_toy_ball_mint" })
    );
    expect(commerceProducts.status).toBe(200);
    expect((commerceProducts.body as { products: Array<{ productId: string }> }).products.map((product) => product.productId)).toContain(
      "premium_chat_monthly"
    );
    expect(entitlements.status).toBe(200);
    expect(entitlements.body).toMatchObject({ entitlements: [] });
    expect(careState.status).toBe(200);
    expect(careState.body).toMatchObject({ petId: "pet_miso_001" });
    expect(careAction.status).toBe(200);
    expect((careAction.body as CareActionResponse).reaction?.category).toBe("fed_recent");
    expect(walk.status).toBe(201);
    expect((walk.body as StartWalkResponse).walk).toMatchObject({
      petId: "pet_miso_001",
      status: "walking"
    });
  });
});
