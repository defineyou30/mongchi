import { describe, expect, it } from "vitest";

import { generatedAssetStates, mockCareState, mockCreditWallet, mockInventory, mockPetProfile, mockRelationshipState } from "@mongchi/shared";
import type { CareState, Conversation, ConversationMessage, CreditWallet, Entitlement, Inventory, PetProfile } from "@mongchi/shared";

import type { ApiResult } from "../service";
import { createMockApiService } from "../service";
import type { StorePurchaseVerifier } from "../purchaseVerifier";
import type { PrivateStorageSigner } from "../storageSigner";

const userContext = { userId: "user_demo_001" };
const otherUserContext = { userId: "user_other_001" };
const validHash = `sha256:${"a".repeat(64)}`;

const activePremiumChatEntitlement: Entitlement = {
  id: "ent_premium_chat_001",
  userId: userContext.userId,
  key: "premium_chat",
  status: "active",
  source: "purchase",
  productId: "premium_chat_monthly",
  startsAt: "2026-06-24T08:00:00.000Z",
  ledgerEntryId: "ledger_premium_chat_001",
  metadata: {
    serverVerified: true
  },
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const emptyCreditWallet: CreditWallet = {
  ...mockCreditWallet,
  credits: 0,
  bonusCredits: 0,
  freeChatTickets: 0
};

const unwrap = <T>(result: ApiResult<T>): T => {
  if (!result.ok) {
    throw new Error(`${result.error.status} ${result.error.code}`);
  }

  return result.data;
};

const expectApiError = <T>(result: ApiResult<T>, status: number, code: string) => {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected API error");
  }

  expect(result.error.status).toBe(status);
  expect(result.error.code).toBe(code);
};

const createDraftPet = (): PetProfile => {
  const {
    activeAssetId: _activeAssetId,
    activeGenerationJobId: _activeGenerationJobId,
    originalPhotoDeletedAt: _originalPhotoDeletedAt,
    ...basePet
  } = mockPetProfile;

  return {
    ...basePet,
    id: "pet_generation_test_001",
    name: "Nori",
    lifecycleStatus: "draft"
  };
};

const createUploadedGenerationJob = () => {
  const pet = createDraftPet();
  const service = createMockApiService({ seed: { pets: [pet], generatedAssets: [] } });
  const upload = unwrap(
    service.issuePhotoUploadUrl(userContext, { petId: pet.id, contentType: "image/jpeg", byteSize: 4096 })
  );

  unwrap(service.completePhotoUpload(userContext, { photoId: upload.photoId, contentHash: validHash }));

  const job = unwrap(
    service.createGenerationJob(userContext, {
      petId: pet.id,
      sourcePhotoIds: [upload.photoId],
      optionalPhotoIds: []
    })
  );

  return { job, pet, service };
};

describe("mock API service user and pet profile boundary", () => {
  it("derives current user onboarding state from owned pets and jobs", () => {
    const emptyService = createMockApiService({ seed: { pets: [] } });
    const defaultService = createMockApiService();

    expect(unwrap(emptyService.getCurrentUser(userContext)).onboardingState).toBe("new");
    expect(unwrap(defaultService.getCurrentUser(userContext)).onboardingState).toBe("pet_active");
    expect(unwrap(defaultService.getCurrentUser(otherUserContext)).onboardingState).toBe("new");
    expectApiError(defaultService.getCurrentUser({}), 401, "auth_required");
  });

  it("creates draft pets with sanitized profile fields and lists only owned live pets", () => {
    const service = createMockApiService({ seed: { pets: [] } });

    expectApiError(
      service.createPet(userContext, {
        name: "",
        species: "dog",
        personalityTags: ["curious"],
        talkingStyle: "gentle"
      }),
      422,
      "invalid_pet_name"
    );
    expectApiError(
      service.createPet(userContext, {
        name: "Nori",
        species: "hamster" as "dog",
        personalityTags: ["curious"],
        talkingStyle: "gentle"
      }),
      422,
      "invalid_pet_species"
    );
    expectApiError(
      service.createPet(userContext, {
        name: "Nori",
        species: "dog",
        personalityTags: ["curious", "curious"],
        talkingStyle: "gentle"
      }),
      422,
      "invalid_personality_tags"
    );

    const created = unwrap(
      service.createPet(userContext, {
        name: "  Nori   Bean  ",
        species: "cat",
        personalityTags: ["curious", "sleepy"],
        talkingStyle: "comforting",
        favoriteThing: "  moss pillows  "
      })
    );

    expect(created).toMatchObject({
      userId: userContext.userId,
      name: "Nori Bean",
      species: "cat",
      personalityTags: ["curious", "sleepy"],
      talkingStyle: "comforting",
      favoriteThing: "moss pillows",
      lifecycleStatus: "draft"
    });
    expect(unwrap(service.getCurrentUser(userContext)).onboardingState).toBe("pet_created");
    expect(unwrap(service.listPets(userContext)).pets.map((pet) => pet.id)).toEqual([created.id]);
    expect(unwrap(service.listPets(otherUserContext)).pets).toHaveLength(0);
  });

  it("exports restorable snapshots without reusing generated ids", () => {
    const service = createMockApiService({ seed: { pets: [], generatedAssets: [] } });
    const firstPet = unwrap(
      service.createPet(userContext, {
        name: "Nori",
        species: "dog",
        personalityTags: ["curious"],
        talkingStyle: "gentle"
      })
    );
    const upload = unwrap(
      service.issuePhotoUploadUrl(userContext, { petId: firstPet.id, contentType: "image/png", byteSize: 4096 })
    );

    unwrap(service.completePhotoUpload(userContext, { photoId: upload.photoId, contentHash: validHash }));

    const restored = createMockApiService({ seed: service.snapshot() });
    const secondPet = unwrap(
      restored.createPet(userContext, {
        name: "Dubu",
        species: "cat",
        personalityTags: ["sleepy"],
        talkingStyle: "comforting"
      })
    );

    expect(unwrap(restored.listPets(userContext)).pets.map((pet) => pet.id)).toEqual([firstPet.id, secondPet.id]);
    expect(restored.inspectState().photos).toContainEqual(
      expect.objectContaining({
        id: upload.photoId,
        petId: firstPet.id,
        contentHash: validHash
      })
    );
    expect(secondPet.id).not.toBe(firstPet.id);
  });

  it("updates only owned pets and can clear optional profile fields", () => {
    const service = createMockApiService({ seed: { pets: [] } });
    const created = unwrap(
      service.createPet(userContext, {
        name: "Nori",
        species: "dog",
        personalityTags: ["playful"],
        talkingStyle: "cute",
        favoriteThing: "ball"
      })
    );

    expectApiError(service.updatePet(otherUserContext, created.id, { name: "Mine" }), 404, "pet_not_found");
    expectApiError(service.updatePet(userContext, created.id, { memoryNote: "x".repeat(241) }), 422, "invalid_memory_note");

    const updated = unwrap(
      service.updatePet(userContext, created.id, {
        name: "  Nori   Star ",
        personalityTags: ["affectionate", "calm"],
        favoriteThing: "",
        memoryNote: "  likes tiny lanterns  "
      })
    );

    expect(updated.name).toBe("Nori Star");
    expect(updated.personalityTags).toEqual(["affectionate", "calm"]);
    expect(updated.favoriteThing).toBeUndefined();
    expect(updated.memoryNote).toBe("likes tiny lanterns");
  });

  it("deletes owned pets, hides them from reads, and deletes original photo metadata", () => {
    const service = createMockApiService();
    const upload = unwrap(
      service.issuePhotoUploadUrl(userContext, { petId: mockPetProfile.id, contentType: "image/png", byteSize: 4096 })
    );

    expectApiError(service.deletePet(otherUserContext, mockPetProfile.id), 404, "pet_not_found");

    const deleted = unwrap(service.deletePet(userContext, mockPetProfile.id));

    expect(deleted).toEqual({
      deletedPetId: mockPetProfile.id,
      deletedAt: "2026-06-24T09:00:00.000Z"
    });
    expectApiError(service.findOwnedPet(userContext, mockPetProfile.id), 404, "pet_not_found");
    expectApiError(service.findOwnedPhoto(userContext, upload.photoId), 404, "photo_not_found");
    expect(unwrap(service.listPets(userContext)).pets).toHaveLength(0);
  });
});

describe("mock API service auth and upload boundary", () => {
  it("requires auth and hides pets owned by another user", () => {
    const service = createMockApiService();

    expectApiError(
      service.issuePhotoUploadUrl({}, { petId: mockPetProfile.id, contentType: "image/png", byteSize: 1024 }),
      401,
      "auth_required"
    );
    expectApiError(
      service.issuePhotoUploadUrl(otherUserContext, { petId: mockPetProfile.id, contentType: "image/png", byteSize: 1024 }),
      404,
      "pet_not_found"
    );
  });

  it("issues private short-lived upload URLs only for valid source photo metadata", () => {
    const service = createMockApiService();

    expectApiError(
      service.issuePhotoUploadUrl(userContext, {
        petId: mockPetProfile.id,
        contentType: "image/gif" as "image/png",
        byteSize: 1024
      }),
      422,
      "unsupported_photo_type"
    );
    expectApiError(
      service.issuePhotoUploadUrl(userContext, {
        petId: mockPetProfile.id,
        contentType: "image/png",
        byteSize: 11 * 1024 * 1024
      }),
      422,
      "photo_too_large"
    );

    const response = unwrap(
      service.issuePhotoUploadUrl(userContext, { petId: mockPetProfile.id, contentType: "image/png", byteSize: 4096 })
    );

    expect(response.maxByteSize).toBe(10 * 1024 * 1024);
    expect(response.uploadUrl).toContain(`mock-signed-upload://private/${userContext.userId}/${mockPetProfile.id}/`);
    expect(response.uploadUrl.startsWith("https://")).toBe(false);
    expect(response.expiresAt).toBe("2026-06-24T09:15:00.000Z");

    const photo = service.inspectState().photos.find((candidate) => candidate.id === response.photoId);
    expect(photo?.status).toBe("upload_url_issued");
  });

  it("can disable mock storage signing for production-style service mounts", () => {
    const service = createMockApiService({ allowMockStorageSigning: false });
    const assetId = service.inspectState().generatedAssets[0]!.id;

    expectApiError(
      service.issuePhotoUploadUrl(otherUserContext, { petId: mockPetProfile.id, contentType: "image/png", byteSize: 4096 }),
      404,
      "pet_not_found"
    );
    expectApiError(
      service.issuePhotoUploadUrl(userContext, { petId: mockPetProfile.id, contentType: "image/png", byteSize: 4096 }),
      503,
      "storage_signing_unavailable"
    );
    expectApiError(service.issueGeneratedAssetReadUrl(otherUserContext, assetId), 404, "generated_asset_not_found");
    expectApiError(service.issueGeneratedAssetReadUrl(userContext, assetId), 503, "storage_signing_unavailable");
  });

  it("can issue upload and read URLs through an injected private storage signer", async () => {
    const signerCalls: Array<{ kind: "upload" | "read"; id: string }> = [];
    const signer: PrivateStorageSigner = {
      createOriginalPhotoUpload: async (input) => {
        signerCalls.push({ kind: "upload", id: input.photoId });

        return {
          ok: true,
          signed: {
            uploadUrl: `https://storage.example.com/uploads/${input.photoId}`,
            uploadMethod: "PUT",
            uploadHeaders: {
              "Content-Type": input.contentType,
              "x-storage-scope": "private-original-photo"
            },
            expiresAt: input.expiresAt,
            maxByteSize: input.maxByteSize
          }
        };
      },
      createGeneratedAssetRead: async (input) => {
        signerCalls.push({ kind: "read", id: input.assetId });

        return {
          ok: true,
          signed: {
            signedUrl: `https://storage.example.com/assets/${input.assetId}`,
            expiresAt: input.expiresAt,
            contentType: input.contentType
          }
        };
      }
    };
    const service = createMockApiService({
      allowMockStorageSigning: false,
      privateStorageSigner: signer
    });
    const assetId = service.inspectState().generatedAssets[0]!.id;

    expectApiError(
      service.issuePhotoUploadUrl(userContext, { petId: mockPetProfile.id, contentType: "image/png", byteSize: 4096 }),
      503,
      "storage_signing_unavailable"
    );

    const upload = unwrap(
      await service.issuePhotoUploadUrlWithStorageSigner(userContext, {
        petId: mockPetProfile.id,
        contentType: "image/png",
        byteSize: 4096
      })
    );
    const read = unwrap(await service.issueGeneratedAssetReadUrlWithStorageSigner(userContext, assetId));

    expect(upload.uploadUrl).toBe(`https://storage.example.com/uploads/${upload.photoId}`);
    expect(upload.uploadHeaders).toMatchObject({
      "Content-Type": "image/png",
      "x-storage-scope": "private-original-photo"
    });
    expect(read.signedUrl).toBe(`https://storage.example.com/assets/${assetId}`);
    expect(service.inspectState().photos.find((photo) => photo.id === upload.photoId)?.uploadUrl).toBe(upload.uploadUrl);
    expect(signerCalls).toEqual([
      { kind: "upload", id: upload.photoId },
      { kind: "read", id: assetId }
    ]);
  });

  it("requires valid upload completion before creating generation jobs", () => {
    const service = createMockApiService();
    const upload = unwrap(
      service.issuePhotoUploadUrl(userContext, { petId: mockPetProfile.id, contentType: "image/jpeg", byteSize: 4096 })
    );

    expectApiError(
      service.createGenerationJob(userContext, {
        petId: mockPetProfile.id,
        sourcePhotoIds: [upload.photoId],
        optionalPhotoIds: []
      }),
      409,
      "photo_upload_incomplete"
    );
    expectApiError(
      service.completePhotoUpload(userContext, { photoId: upload.photoId, contentHash: "not-a-valid-hash" }),
      422,
      "invalid_content_hash"
    );

    const completed = unwrap(service.completePhotoUpload(userContext, { photoId: upload.photoId, contentHash: validHash }));
    expect(completed.photo.status).toBe("uploaded");

    const job = unwrap(
      service.createGenerationJob(userContext, {
        petId: mockPetProfile.id,
        sourcePhotoIds: [upload.photoId],
        optionalPhotoIds: []
      })
    );

    expect(job.status).toBe("created");
    expect(job.provider).toBe("mock");
    expect(job.costUnits).toBe(0);
    expect(job.inputSnapshot.petName).toBe(mockPetProfile.name);
    expectApiError(service.findOwnedGenerationJob(otherUserContext, job.id), 404, "generation_job_not_found");
  });

  it("prevents photo reuse across pets and deletes original photo metadata independently", () => {
    const secondPet: PetProfile = {
      ...mockPetProfile,
      id: "pet_second_001",
      name: "Nori",
      activeGenerationJobId: "gen_second_001",
      activeAssetId: "asset_second_idle_001"
    };
    const service = createMockApiService({ seed: { pets: [mockPetProfile, secondPet] } });
    const upload = unwrap(
      service.issuePhotoUploadUrl(userContext, { petId: mockPetProfile.id, contentType: "image/webp", byteSize: 4096 })
    );

    unwrap(service.completePhotoUpload(userContext, { photoId: upload.photoId, contentHash: validHash }));

    expectApiError(
      service.createGenerationJob(userContext, {
        petId: secondPet.id,
        sourcePhotoIds: [upload.photoId],
        optionalPhotoIds: []
      }),
      403,
      "photo_pet_mismatch"
    );

    const deletion = unwrap(service.deleteOriginalPhotos(userContext, { petId: mockPetProfile.id }));
    expect(deletion.deletedPhotoIds).toEqual([upload.photoId]);
    expectApiError(service.findOwnedPhoto(userContext, upload.photoId), 404, "photo_not_found");

    const pet = unwrap(service.findOwnedPet(userContext, mockPetProfile.id));
    expect(pet.originalPhotoDeletedAt).toBe("2026-06-24T09:00:00.000Z");
  });
});

describe("mock API service generation lifecycle", () => {
  it("polls mock generation jobs through active states and returns generated assets on completion", () => {
    const { job, service } = createUploadedGenerationJob();
    const statuses = [
      unwrap(service.pollGenerationJob(userContext, job.id)).job.status,
      unwrap(service.pollGenerationJob(userContext, job.id)).job.status,
      unwrap(service.pollGenerationJob(userContext, job.id)).job.status,
      unwrap(service.pollGenerationJob(userContext, job.id)).job.status,
      unwrap(service.pollGenerationJob(userContext, job.id)).job.status
    ];
    const completed = unwrap(service.pollGenerationJob(userContext, job.id));

    expect(statuses).toEqual(["preprocessing", "safety_checking", "generating", "quality_checking", "completed"]);
    expect(completed.job.status).toBe("completed");
    expect(completed.assets.map((asset) => asset.state)).toEqual([...generatedAssetStates]);
    expect(completed.assets.every((asset) => asset.generationJobId === job.id)).toBe(true);
    expectApiError(service.pollGenerationJob(otherUserContext, job.id), 404, "generation_job_not_found");
  });

  it("completes, lists, and accepts generated assets only for the owning pet", () => {
    const { job, pet, service } = createUploadedGenerationJob();

    expect(unwrap(service.listGeneratedAssets(userContext, pet.id)).assets).toHaveLength(0);
    expectApiError(
      service.acceptGenerationJob(userContext, { jobId: job.id, acceptedAssetIds: ["asset_missing"] }),
      409,
      "generation_not_completed"
    );

    const completed = unwrap(service.completeMockGenerationJob(userContext, job.id));

    expect(completed.job.status).toBe("completed");
    expect(completed.job.quality.qualityStatus).toBe("passed");
    expect(completed.assets.map((asset) => asset.state)).toEqual([...generatedAssetStates]);
    expect(completed.assets.every((asset) => asset.petId === pet.id && asset.generationJobId === job.id)).toBe(true);
    expect(unwrap(service.getGenerationJob(userContext, job.id)).status).toBe("completed");
    expectApiError(service.getGenerationJob(otherUserContext, job.id), 404, "generation_job_not_found");

    const listedAssets = unwrap(service.listGeneratedAssets(userContext, pet.id)).assets;
    expect(listedAssets.map((asset) => asset.id)).toEqual(completed.assets.map((asset) => asset.id));
    const signedReadUrl = unwrap(service.issueGeneratedAssetReadUrl(userContext, completed.assets[0]!.id));
    expect(signedReadUrl).toMatchObject({
      assetId: completed.assets[0]!.id,
      petId: pet.id,
      contentType: completed.assets[0]!.mimeType,
      storageClass: "private_app_asset",
      expiresAt: "2026-06-24T09:10:00.000Z"
    });
    expect(signedReadUrl.signedUrl).toContain(`mock-signed-read://private/${userContext.userId}/${pet.id}/`);
    expect(signedReadUrl.signedUrl.startsWith("https://")).toBe(false);
    expectApiError(service.issueGeneratedAssetReadUrl(otherUserContext, completed.assets[0]!.id), 404, "generated_asset_not_found");
    expectApiError(service.issueGeneratedAssetReadUrl(userContext, "asset_missing"), 404, "generated_asset_not_found");
    expectApiError(
      service.acceptGenerationJob(userContext, { jobId: job.id, acceptedAssetIds: ["asset_missing"] }),
      404,
      "generated_asset_not_found"
    );

    const accepted = unwrap(
      service.acceptGenerationJob(userContext, {
        jobId: job.id,
        acceptedAssetIds: [completed.assets[0]!.id]
      })
    );

    expect(accepted.pet.lifecycleStatus).toBe("active");
    expect(accepted.pet.activeGenerationJobId).toBe(job.id);
    expect(accepted.pet.activeAssetId).toBe(completed.assets[0]!.id);
    expect(accepted.assets).toHaveLength(1);
  });

  it("persists worker-completed private generated asset metadata", () => {
    const { job, pet, service } = createUploadedGenerationJob();

    expectApiError(
      service.completeGenerationJob(userContext, {
        jobId: job.id,
        assets: [
          {
            state: "idle",
            uri: "https://cdn.example.com/public/pet.png",
            width: 512,
            height: 512,
            contentHash: `sha256:${"b".repeat(64)}`,
            mimeType: "image/png"
          }
        ]
      }),
      422,
      "invalid_generated_asset_uri"
    );

    const completed = unwrap(
      service.completeGenerationJob(userContext, {
        jobId: job.id,
        provider: "openai",
        costUnits: 12,
        quality: {
          qualityStatus: "passed",
          qualityScore: 0.96,
          failedChecks: [],
          manualReviewRequired: false,
          retryRecommended: false
        },
        completedAt: "2026-06-24T09:07:00.000Z",
        assets: [
          {
            id: "asset_worker_idle_001",
            state: "idle",
            uri: "s3://tiny-pet-private/generated/pet_generation_test_001/gen_worker/idle.png",
            thumbnailUri: "s3://tiny-pet-private/generated/pet_generation_test_001/gen_worker/idle-thumb.png",
            width: 512,
            height: 512,
            contentHash: `sha256:${"c".repeat(64)}`,
            mimeType: "image/png",
            version: 2
          }
        ]
      })
    );

    expect(completed.job.status).toBe("completed");
    expect(completed.job.provider).toBe("openai");
    expect(completed.job.costUnits).toBe(12);
    expect(completed.job.completedAt).toBe("2026-06-24T09:07:00.000Z");
    expect(completed.assets).toEqual([
      {
        id: "asset_worker_idle_001",
        petId: pet.id,
        generationJobId: job.id,
        state: "idle",
        uri: "s3://tiny-pet-private/generated/pet_generation_test_001/gen_worker/idle.png",
        thumbnailUri: "s3://tiny-pet-private/generated/pet_generation_test_001/gen_worker/idle-thumb.png",
        width: 512,
        height: 512,
        contentHash: `sha256:${"c".repeat(64)}`,
        mimeType: "image/png",
        storageClass: "private_app_asset",
        version: 2,
        qualityStatus: "passed",
        createdAt: "2026-06-24T09:07:00.000Z",
        updatedAt: "2026-06-24T09:07:00.000Z"
      }
    ]);
    expect(unwrap(service.listGeneratedAssets(userContext, pet.id)).assets[0]?.uri).toBe(
      "s3://tiny-pet-private/generated/pet_generation_test_001/gen_worker/idle.png"
    );
  });

  it("retries failed generation jobs without retrying completed jobs", () => {
    const { job, service } = createUploadedGenerationJob();

    const failed = unwrap(service.failGenerationJobForQualityGate(userContext, job.id, ["pet_not_clear"]));

    expect(failed.status).toBe("failed");
    expect(failed.failure?.retryable).toBe(true);
    expect(failed.quality.failedChecks).toEqual(["pet_not_clear"]);

    const retried = unwrap(service.retryGenerationJob(userContext, job.id));

    expect(retried.job.status).toBe("created");
    expect(retried.job.failure).toBeUndefined();
    expect(retried.job.quality.qualityStatus).toBe("pending");
    expect(retried.job.quality.failedChecks).toEqual([]);

    unwrap(service.completeMockGenerationJob(userContext, job.id));

    expectApiError(service.retryGenerationJob(userContext, job.id), 409, "generation_job_not_retryable");
    expectApiError(service.failGenerationJobForQualityGate(userContext, job.id), 409, "generation_job_already_completed");
  });
});

describe("mock API service premium chat boundary", () => {
  it("requires AI disclosure and a Plus pass or wallet spend before premium chat opens", () => {
    const service = createMockApiService({ seed: { wallets: [emptyCreditWallet] } });

    expectApiError(
      service.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true }),
      403,
      "premium_chat_payment_required"
    );

    const walletService = createMockApiService();

    const walletConversation = unwrap(
      walletService.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true })
    );

    expect(walletConversation.conversation.type).toBe("premium_ai_chat");

    const entitledService = createMockApiService({
      seed: {
        entitlements: [activePremiumChatEntitlement],
        wallets: [emptyCreditWallet]
      }
    });

    expectApiError(
      entitledService.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: false }),
      422,
      "ai_disclosure_required"
    );

    const conversation = unwrap(
      entitledService.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true })
    );

    expect(conversation.conversation.type).toBe("premium_ai_chat");
    expect(conversation.conversation.disclosureAcceptedAt).toBe("2026-06-24T09:00:00.000Z");
    expect(conversation.disclosureText).toContain("AI-generated conversation");
  });

  it("moderates premium chat input before storing or returning mock provider output", () => {
    const service = createMockApiService({ seed: { entitlements: [activePremiumChatEntitlement] } });
    const conversation = unwrap(
      service.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true })
    );

    expectApiError(
      service.sendPremiumConversationMessage(userContext, {
        conversationId: conversation.conversation.id,
        text: "Can you give medical advice and diagnose this?"
      }),
      422,
      "safety_professional_advice"
    );
    expectApiError(
      service.sendPremiumConversationMessage(userContext, {
        conversationId: conversation.conversation.id,
        text: "I want to kill myself"
      }),
      422,
      "safety_self_harm"
    );

    const response = unwrap(
      service.sendPremiumConversationMessage(userContext, {
        conversationId: conversation.conversation.id,
        text: "   hello    tiny friend   "
      })
    );

    expect(response.userMessage.text).toBe("hello tiny friend");
    expect(response.userMessage.safetyFlags).toEqual([]);
    expect(response.petMessage.sender).toBe("pet_ai");
    expect(response.petMessage.text).toContain("mock moderated AI gateway");

    const state = service.inspectState();
    expect(state.conversationMessages).toHaveLength(2);
  });

  it("rate limits premium chat turns before storing mock messages", () => {
    const service = createMockApiService({
      seed: { entitlements: [activePremiumChatEntitlement] },
      premiumChatPolicy: {
        maxUserMessagesPerWindow: 1,
        rateLimitWindowMs: 60_000
      }
    });
    const conversation = unwrap(
      service.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true })
    );

    unwrap(
      service.sendPremiumConversationMessage(userContext, {
        conversationId: conversation.conversation.id,
        text: "hello tiny friend"
      })
    );
    expectApiError(
      service.sendPremiumConversationMessage(userContext, {
        conversationId: conversation.conversation.id,
        text: "one more message"
      }),
      429,
      "premium_chat_rate_limited"
    );
    expect(service.inspectState().conversationMessages).toHaveLength(2);
  });

  it("reads and deletes one owned premium conversation thread", () => {
    const service = createMockApiService({ seed: { entitlements: [activePremiumChatEntitlement] } });
    const conversation = unwrap(
      service.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true })
    );
    const response = unwrap(
      service.sendPremiumConversationMessage(userContext, {
        conversationId: conversation.conversation.id,
        text: "hello tiny friend"
      })
    );

    expectApiError(service.getConversationThread(otherUserContext, conversation.conversation.id), 404, "conversation_not_found");

    const thread = unwrap(service.getConversationThread(userContext, conversation.conversation.id));

    expect(thread.conversation.id).toBe(conversation.conversation.id);
    expect(thread.messages.map((message) => message.id)).toEqual([response.userMessage.id, response.petMessage.id]);

    const deletion = unwrap(service.deleteConversation(userContext, conversation.conversation.id));

    expect(deletion).toEqual({
      deletedConversationId: conversation.conversation.id,
      deletedMessageIds: [response.userMessage.id, response.petMessage.id],
      deletedAt: "2026-06-24T09:00:00.000Z"
    });
    expectApiError(service.getConversationThread(userContext, conversation.conversation.id), 404, "conversation_not_found");
    expect(service.inspectState().conversationMessages).toHaveLength(0);
  });

  it("filters premium conversation thread messages by retention policy", () => {
    const conversation: Conversation = {
      id: "conv_retention_001",
      userId: userContext.userId,
      petId: mockPetProfile.id,
      type: "premium_ai_chat",
      status: "open",
      disclosureAcceptedAt: "2026-06-24T08:58:00.000Z",
      createdAt: "2026-06-24T08:58:00.000Z",
      updatedAt: "2026-06-24T08:58:00.000Z"
    };
    const messages: ConversationMessage[] = [
      {
        id: "msg_retention_old_001",
        conversationId: conversation.id,
        sender: "user",
        text: "old note",
        safetyFlags: [],
        createdAt: "2026-06-24T08:58:59.000Z"
      },
      {
        id: "msg_retention_retained_001",
        conversationId: conversation.id,
        sender: "pet_ai",
        text: "fresh note",
        safetyFlags: [],
        createdAt: "2026-06-24T08:59:30.000Z"
      },
      {
        id: "msg_retention_future_001",
        conversationId: conversation.id,
        sender: "pet_ai",
        text: "future note",
        safetyFlags: [],
        createdAt: "2026-06-24T09:00:01.000Z"
      }
    ];
    const service = createMockApiService({
      seed: {
        entitlements: [activePremiumChatEntitlement],
        conversations: [conversation],
        conversationMessages: messages
      },
      premiumChatPolicy: {
        retentionWindowMs: 60_000
      }
    });

    const thread = unwrap(service.getConversationThread(userContext, conversation.id));

    expect(thread.messages.map((message) => message.id)).toEqual(["msg_retention_retained_001"]);
    expect(service.inspectState().conversationMessages).toHaveLength(3);
  });

  it("deletes owned premium chat history without exposing other users", () => {
    const service = createMockApiService({ seed: { entitlements: [activePremiumChatEntitlement] } });
    const conversation = unwrap(
      service.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true })
    );

    unwrap(
      service.sendPremiumConversationMessage(userContext, {
        conversationId: conversation.conversation.id,
        text: "hello tiny friend"
      })
    );

    expectApiError(service.deleteChatHistory({}), 401, "auth_required");

    const otherUserDeletion = unwrap(service.deleteChatHistory(otherUserContext));

    expect(otherUserDeletion.deletedConversationIds).toEqual([]);
    expect(otherUserDeletion.deletedMessageIds).toEqual([]);

    const deletion = unwrap(service.deleteChatHistory(userContext));

    expect(deletion).toEqual({
      deletedConversationIds: [conversation.conversation.id],
      deletedMessageIds: expect.arrayContaining([expect.stringMatching(/^msg_mock_/), expect.stringMatching(/^msg_mock_/)]),
      deletedAt: "2026-06-24T09:00:00.000Z"
    });
    expect(deletion.deletedMessageIds).toHaveLength(2);
    expect(service.inspectState().conversations).toContainEqual(
      expect.objectContaining({
        id: conversation.conversation.id,
        status: "deleted",
        deletedAt: "2026-06-24T09:00:00.000Z"
      })
    );
    expect(service.inspectState().conversationMessages).toHaveLength(0);
  });

  it("hides premium conversations from other users and revoked entitlements", () => {
    const revokedEntitlement: Entitlement = {
      ...activePremiumChatEntitlement,
      id: "ent_premium_chat_revoked",
      status: "revoked",
      ledgerEntryId: "ledger_premium_chat_revoked"
    };
    const service = createMockApiService({ seed: { entitlements: [activePremiumChatEntitlement] } });
    const revokedService = createMockApiService({ seed: { entitlements: [revokedEntitlement], wallets: [emptyCreditWallet] } });
    const conversation = unwrap(
      service.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true })
    );

    expectApiError(
      service.sendPremiumConversationMessage(otherUserContext, {
        conversationId: conversation.conversation.id,
        text: "hello"
      }),
      404,
      "conversation_not_found"
    );
    expectApiError(
      revokedService.createPremiumConversation(userContext, { petId: mockPetProfile.id, disclosureAccepted: true }),
      403,
      "premium_chat_payment_required"
    );
  });
});

describe("mock API service commerce entitlement ledger", () => {
  it("lists server-owned commerce products and only current-user entitlements", () => {
    const service = createMockApiService({
      seed: {
        entitlements: [
          activePremiumChatEntitlement,
          {
            ...activePremiumChatEntitlement,
            id: "ent_other_user_premium_chat",
            userId: otherUserContext.userId,
            ledgerEntryId: "ledger_other_user_premium_chat"
          }
        ]
      }
    });

    expectApiError(service.listCommerceProducts({}), 401, "auth_required");
    expectApiError(service.listEntitlements({}), 401, "auth_required");

    const products = unwrap(service.listCommerceProducts(userContext));
    const entitlements = unwrap(service.listEntitlements(userContext));

    expect(products.products.map((product) => product.productId)).toEqual([
      "premium_chat_monthly",
      "extra_pet_slot_1",
      "regeneration_credit_1",
      "theme_pack_starter"
    ]);
    expect(entitlements.entitlements).toHaveLength(1);
    expect(entitlements.entitlements[0]).toMatchObject({
      id: activePremiumChatEntitlement.id,
      userId: userContext.userId,
      key: "premium_chat"
    });
  });

  it("verifies purchases server-side and grants entitlements idempotently", () => {
    const service = createMockApiService();
    const request = {
      platform: "ios" as const,
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_001",
      receiptHash: validHash
    };

    expectApiError(
      service.verifyPurchase(userContext, { ...request, productId: "unknown_product" }),
      422,
      "unknown_product"
    );
    expectApiError(
      service.verifyPurchase(userContext, { ...request, receiptHash: "raw-receipt-token" }),
      422,
      "invalid_receipt_hash"
    );
    expectApiError(
      service.verifyPurchase(userContext, { ...request, storeVerificationToken: "short" }),
      422,
      "invalid_store_verification_token"
    );
    expectApiError(
      service.verifyPurchase(userContext, { ...request, storeVerificationToken: "valid-token\nwith-control" }),
      422,
      "invalid_store_verification_token"
    );

    const first = unwrap(service.verifyPurchase(userContext, request));
    const second = unwrap(service.verifyPurchase(userContext, request));

    expect(first.serverVerified).toBe(true);
    expect(first.entitlements).toHaveLength(1);
    expect(first.entitlements[0]?.key).toBe("premium_chat");
    expect(first.entitlements[0]?.status).toBe("active");
    expect(first.entitlements[0]?.endsAt).toBe("2026-07-24T09:00:00.000Z");
    expect(second.entitlements[0]?.id).toBe(first.entitlements[0]?.id);
    expect(service.inspectState().entitlements).toHaveLength(1);
    expect(service.inspectState().purchaseLedger).toHaveLength(1);
    expect(unwrap(service.hasActiveEntitlement(userContext, "premium_chat")).active).toBe(true);
  });

  it("can disable mock purchase verification for production-style service mounts", () => {
    const service = createMockApiService({ allowMockPurchaseVerification: false });
    const request = {
      platform: "ios" as const,
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_disabled_001",
      receiptHash: validHash
    };

    expect(unwrap(service.listCommerceProducts(userContext)).products).toHaveLength(4);
    expectApiError(service.verifyPurchase(userContext, request), 503, "purchase_verification_unavailable");
    expectApiError(
      service.restorePurchases(userContext, {
        platform: "ios",
        transactionIds: [request.transactionId]
      }),
      503,
      "purchase_verification_unavailable"
    );
    expect(service.inspectState().entitlements).toHaveLength(0);
    expect(service.inspectState().purchaseLedger).toHaveLength(0);
  });

  it("can grant purchases through an injected store verifier when mock verification is disabled", async () => {
    const verifierCalls: Array<{ userId: string; transactionId: string; storeVerificationToken: string | undefined }> = [];
    const verifier: StorePurchaseVerifier = {
      verifyPurchase: async (input) => {
        verifierCalls.push({
          userId: input.userId,
          transactionId: input.transactionId,
          storeVerificationToken: input.storeVerificationToken
        });

        return {
          ok: true,
          purchase: {
            platform: input.platform,
            productId: input.productId,
            transactionId: input.transactionId,
            receiptHash: input.receiptHash,
            verifiedAt: "2026-06-24T10:00:00.000Z",
            environment: "production"
          }
        };
      },
      restorePurchases: async (input) => ({
        ok: true,
        purchases: input.transactionIds.map((transactionId) => ({
          platform: input.platform,
          productId: "premium_chat_monthly",
          transactionId,
          receiptHash: validHash,
          verifiedAt: "2026-06-24T10:05:00.000Z",
          environment: "production"
        }))
      })
    };
    const storeVerificationToken = "app-store-jws.header.payload.signature";
    const service = createMockApiService({
      allowMockPurchaseVerification: false,
      purchaseVerifier: verifier
    });
    const request = {
      platform: "ios" as const,
      productId: "premium_chat_monthly",
      transactionId: "ios_store_001",
      receiptHash: validHash,
      storeVerificationToken
    };

    expectApiError(service.verifyPurchase(userContext, request), 503, "purchase_verification_unavailable");

    const verified = unwrap(await service.verifyPurchaseWithStoreVerifier(userContext, request));
    const restored = unwrap(
      await service.restorePurchasesWithStoreVerifier(userContext, {
        platform: "ios",
        transactionIds: ["ios_store_001", "ios_store_002"]
      })
    );

    expect(verifierCalls).toEqual([{ userId: userContext.userId, transactionId: "ios_store_001", storeVerificationToken }]);
    expect(verified.entitlements[0]).toMatchObject({
      key: "premium_chat",
      source: "purchase",
      startsAt: "2026-06-24T10:00:00.000Z",
      metadata: expect.objectContaining({
        storeEnvironment: "production"
      })
    });
    expect(restored.entitlements.map((entitlement) => entitlement.source)).toEqual(["restore", "restore"]);
    expect(service.inspectState().purchaseLedger).toHaveLength(2);
    expect(JSON.stringify(service.inspectState().purchaseLedger)).not.toContain(storeVerificationToken);
    expect(JSON.stringify(verified)).not.toContain(storeVerificationToken);
  });

  it("rejects store verifier results that do not match the purchase request", async () => {
    const verifier: StorePurchaseVerifier = {
      verifyPurchase: async (input) => ({
        ok: true,
        purchase: {
          platform: input.platform,
          productId: "theme_pack_starter",
          transactionId: input.transactionId,
          receiptHash: input.receiptHash,
          environment: "production"
        }
      })
    };
    const service = createMockApiService({
      allowMockPurchaseVerification: false,
      purchaseVerifier: verifier
    });

    expectApiError(
      await service.verifyPurchaseWithStoreVerifier(userContext, {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_store_mismatch_001",
        receiptHash: validHash
      }),
      409,
      "purchase_verification_mismatch"
    );
    expect(service.inspectState().purchaseLedger).toHaveLength(0);
  });

  it("passes request-scoped restore purchase tokens to the store verifier", async () => {
    const restoreCalls: Array<{ transactionIds: string[]; token: string | undefined }> = [];
    const service = createMockApiService({
      allowMockPurchaseVerification: false,
      purchaseVerifier: {
        verifyPurchase: async () => ({
          ok: false,
          error: {
            status: 503,
            code: "unused",
            messageSafe: "Unused."
          }
        }),
        restorePurchases: async (input) => {
          restoreCalls.push({
            transactionIds: input.transactionIds,
            token: input.purchases?.[0]?.storeVerificationToken
          });

          return {
            ok: true,
            purchases: [
              {
                platform: input.platform,
                productId: "premium_chat_monthly",
                transactionId: "gpa.1234-5678-9012",
                receiptHash: validHash,
                verifiedAt: "2026-06-24T10:05:00.000Z",
                environment: "production"
              }
            ]
          };
        }
      }
    });
    const restored = unwrap(
      await service.restorePurchasesWithStoreVerifier(userContext, {
        platform: "android",
        transactionIds: [],
        purchases: [
          {
            productId: "premium_chat_monthly",
            transactionId: "gpa.1234-5678-9012",
            receiptHash: validHash,
            storeVerificationToken: "google-play-restore-token"
          }
        ]
      })
    );

    expect(restoreCalls).toEqual([
      {
        transactionIds: ["gpa.1234-5678-9012"],
        token: "google-play-restore-token"
      }
    ]);
    expect(restored.entitlements[0]).toMatchObject({
      key: "premium_chat",
      source: "restore"
    });
    expect(JSON.stringify(service.inspectState().purchaseLedger)).not.toContain("google-play-restore-token");
  });

  it("blocks transaction reuse across users", () => {
    const service = createMockApiService();
    const request = {
      platform: "android" as const,
      productId: "premium_chat_monthly",
      transactionId: "gpa.1234-5678-9012",
      receiptHash: validHash
    };

    unwrap(service.verifyPurchase(userContext, request));

    expectApiError(service.verifyPurchase(otherUserContext, request), 409, "purchase_belongs_to_another_user");
  });

  it("restores purchases without double granting and ignores revoked entitlements", () => {
    const service = createMockApiService();
    const request = {
      platform: "ios" as const,
      productId: "premium_chat_monthly",
      transactionId: "ios_restore_001",
      receiptHash: validHash
    };

    const verified = unwrap(service.verifyPurchase(userContext, request));
    const restored = unwrap(
      service.restorePurchases(userContext, {
        platform: "ios",
        transactionIds: [request.transactionId, request.transactionId, "missing_txn_001"]
      })
    );

    expect(restored.entitlements).toHaveLength(1);
    expect(restored.entitlements[0]?.id).toBe(verified.entitlements[0]?.id);
    expect(restored.entitlements[0]?.source).toBe("restore");
    expect(service.inspectState().entitlements).toHaveLength(1);

    const revoked = unwrap(
      service.revokePurchase({
        platform: "ios",
        transactionId: request.transactionId,
        reason: "refund"
      })
    );

    expect(revoked.entitlement.status).toBe("revoked");
    expect(unwrap(service.hasActiveEntitlement(userContext, "premium_chat")).active).toBe(false);

    const restoredAfterRevoke = unwrap(
      service.restorePurchases(userContext, {
        platform: "ios",
        transactionIds: [request.transactionId]
      })
    );

    expect(restoredAfterRevoke.entitlements).toHaveLength(0);
  });

  it("supports durable and consumable product entitlement metadata", () => {
    const service = createMockApiService();
    const durable = unwrap(
      service.verifyPurchase(userContext, {
        platform: "ios",
        productId: "extra_pet_slot_1",
        transactionId: "ios_slot_001",
        receiptHash: validHash
      })
    );
    const consumable = unwrap(
      service.verifyPurchase(userContext, {
        platform: "android",
        productId: "regeneration_credit_1",
        transactionId: "gpa.regen.001",
        receiptHash: validHash
      })
    );

    expect(durable.entitlements[0]?.key).toBe("extra_pet_slot");
    expect(durable.entitlements[0]?.endsAt).toBeUndefined();
    expect(durable.entitlements[0]?.metadata.grantType).toBe("durable");
    expect(consumable.entitlements[0]?.key).toBe("regeneration_credit");
    expect(consumable.entitlements[0]?.metadata.grantType).toBe("consumable");
    expect(consumable.wallet?.credits).toBe(mockCreditWallet.credits + 1);
  });

  it("credits the wallet once for consumable commerce purchases", () => {
    const service = createMockApiService({ seed: { wallets: [emptyCreditWallet] } });
    const request = {
      platform: "ios" as const,
      productId: "regeneration_credit_1",
      transactionId: "ios_regen_credit_once_001",
      receiptHash: validHash
    };

    const first = unwrap(service.verifyPurchase(userContext, request));
    const second = unwrap(service.verifyPurchase(userContext, request));
    const restored = unwrap(
      service.restorePurchases(userContext, {
        platform: "ios",
        transactionIds: [request.transactionId]
      })
    );
    const wallet = service.inspectState().wallets.find((entry) => entry.userId === userContext.userId);

    expect(first.wallet).toMatchObject({
      credits: 1,
      bonusCredits: 0,
      freeChatTickets: 0
    });
    expect(second.wallet?.credits).toBe(1);
    expect(restored.wallet?.credits).toBe(1);
    expect(wallet?.credits).toBe(1);
    expect(service.inspectState().entitlements).toHaveLength(1);
    expect(service.inspectState().purchaseLedger).toHaveLength(1);
  });
});

describe("mock API service daily loop boundary", () => {
  it("exposes authored catalog, reaction catalog, inventory, and owned care state", () => {
    const service = createMockApiService();

    expectApiError(service.getInventory({}), 401, "auth_required");
    expectApiError(service.getCareState(otherUserContext, mockPetProfile.id), 404, "pet_not_found");

    const itemCatalog = unwrap(service.getItemCatalog(userContext));
    const reactionCatalog = unwrap(service.getReactionCatalog({ ...userContext, locale: "en-US" }));
    const inventory = unwrap(service.getInventory({ userId: "user_new_001" }));
    const careState = unwrap(service.getCareState(userContext, mockPetProfile.id));

    expect(itemCatalog.items.map((item) => item.id)).toContain("item_flower_pot_sunny");
    expect(reactionCatalog).toMatchObject({
      locale: "en-US",
      version: "starter-2026-06-24"
    });
    expect(reactionCatalog.rules.every((rule) => rule.locale === "en-US")).toBe(true);
    expect(inventory.userId).toBe("user_new_001");
    expect(inventory.items.map((item) => item.itemId)).toEqual(["item_food_bowl_basic", "item_toy_ball_mint"]);
    expect(careState.petId).toBe(mockPetProfile.id);
    expect(careState.satiety).toBe(mockCareState.satiety);
  });

  it("resolves current weather from approximate coordinates and caches by rounded region", () => {
    const service = createMockApiService({
      now: () => "2026-06-24T09:00:00.000Z"
    });

    expectApiError(
      service.getCurrentWeather({}, {
        approximateLatitude: 37.6,
        approximateLongitude: 127,
        requestedAt: "2026-06-24T09:00:00.000Z"
      }),
      401,
      "auth_required"
    );
    expectApiError(
      service.getCurrentWeather(userContext, {
        approximateLatitude: 120,
        approximateLongitude: 127,
        requestedAt: "2026-06-24T09:00:00.000Z"
      }),
      422,
      "invalid_weather_coordinates"
    );

    const first = unwrap(
      service.getCurrentWeather(userContext, {
        approximateLatitude: 37.566535,
        approximateLongitude: 126.977969,
        requestedAt: "2026-06-24T09:00:00.000Z"
      })
    );
    const second = unwrap(
      service.getCurrentWeather(userContext, {
        approximateLatitude: 37.6,
        approximateLongitude: 127,
        requestedAt: "2026-06-24T09:01:00.000Z"
      })
    );

    expect(first.cache).toMatchObject({
      key: "weather:37.6:127.0",
      approximateLatitude: 37.6,
      approximateLongitude: 127,
      maxAgeSeconds: 1800
    });
    expect(first.weather.source).toBe("device_location");
    expect(second.weather.source).toBe("cached");
    expect(second.cache.key).toBe(first.cache.key);
  });

  it("projects stale care state on read without persisting the projected meters", () => {
    const staleCareState: CareState = {
      ...mockCareState,
      updatedAt: "2026-06-24T09:00:00.000Z",
      lastInteractionAt: "2026-06-24T09:00:00.000Z"
    };
    const service = createMockApiService({
      now: () => "2026-06-25T15:00:00.000Z",
      seed: {
        careStates: [staleCareState]
      }
    });

    const projected = unwrap(service.getCareState(userContext, mockPetProfile.id));

    expect(projected.updatedAt).toBe("2026-06-25T15:00:00.000Z");
    expect(projected.satiety).toBeLessThan(staleCareState.satiety);
    expect(projected.energy).toBeLessThan(staleCareState.energy);
    expect(projected.cleanliness).toBeLessThan(staleCareState.cleanliness);
    expect(service.inspectState().careStates[0]).toMatchObject({
      satiety: staleCareState.satiety,
      energy: staleCareState.energy,
      cleanliness: staleCareState.cleanliness,
      updatedAt: staleCareState.updatedAt
    });
  });

  it("processes care actions with ownership, inventory, and authored reactions", () => {
    const service = createMockApiService();

    expectApiError(
      service.performCareAction(otherUserContext, mockPetProfile.id, {
        action: "feed",
        occurredAt: "2026-06-24T09:05:00.000Z"
      }),
      404,
      "pet_not_found"
    );
    expectApiError(
      service.performCareAction(userContext, mockPetProfile.id, {
        action: "dance" as "feed",
        occurredAt: "2026-06-24T09:05:00.000Z"
      }),
      422,
      "invalid_care_action"
    );
    expectApiError(
      service.performCareAction(userContext, mockPetProfile.id, {
        action: "treat",
        itemId: "missing_item",
        occurredAt: "2026-06-24T09:05:00.000Z"
      }),
      404,
      "inventory_item_not_found"
    );
    expectApiError(
      service.performCareAction(userContext, mockPetProfile.id, {
        action: "treat",
        occurredAt: "2026-06-24T09:05:00.000Z"
      }),
      404,
      "treat_item_not_found"
    );

    const result = unwrap(
      service.performCareAction(userContext, mockPetProfile.id, {
        action: "feed",
        occurredAt: "2026-06-24T09:05:00.000Z"
      })
    );

    expect(result.careState.satiety).toBeGreaterThan(mockCareState.satiety);
    expect(result.careState.lastFedAt).toBe("2026-06-24T09:05:00.000Z");
    expect(result.reaction).toMatchObject({
      category: "fed_recent",
      animation: "happy"
    });
    expect(result.reward).toBeNull();
    expect(service.inspectState().recentReactions[0]).toMatchObject({
      userId: userContext.userId,
      petId: mockPetProfile.id,
      ruleId: result.reaction?.ruleId
    });
  });

  it("grants bonus wallet value and bond xp when a garden plant blooms", () => {
    const bloomingInventory: Inventory = {
      ...mockInventory,
      items: [
        ...mockInventory.items,
        {
          itemId: "item_flower_pot_sunny",
          quantity: 1,
          acquiredAt: "2026-06-24T09:00:00.000Z",
          source: "walk_reward"
        }
      ],
      placedItems: [
        ...mockInventory.placedItems,
        {
          itemId: "item_flower_pot_sunny",
          slot: "garden",
          x: 0.82,
          y: 0.72,
          rotation: 5
        }
      ],
      plantGrowth: [
        {
          itemId: "item_flower_pot_sunny",
          stageIndex: 2,
          waterPoints: 1,
          lastWateredAt: "2026-06-24T09:00:00.000Z",
          updatedAt: "2026-06-24T09:00:00.000Z"
        }
      ]
    };
    const service = createMockApiService({
      seed: {
        inventories: [bloomingInventory]
      }
    });

    const result = unwrap(
      service.performCareAction(userContext, mockPetProfile.id, {
        action: "water_garden",
        occurredAt: "2026-06-24T09:05:00.000Z"
      })
    );

    expect(result.reward).toEqual({
      type: "plant_bloom",
      itemId: "item_flower_pot_sunny",
      bonusCredits: 1,
      bondXp: 3
    });
    expect(result.wallet).toMatchObject({
      bonusCredits: mockCreditWallet.bonusCredits + 1
    });
    expect(result.relationshipState.bondXp).toBe(mockRelationshipState.bondXp + 4);
    expect(result.inventory?.plantGrowth?.find((entry) => entry.itemId === "item_flower_pot_sunny")).toMatchObject({
      stageIndex: 3,
      waterPoints: 0
    });
    expect(service.inspectState().wallets.find((wallet) => wallet.userId === userContext.userId)?.bonusCredits).toBe(
      mockCreditWallet.bonusCredits + 1
    );
  });

  it("consumes owned treat inventory when a treat care action runs with or without an item id", () => {
    const treatInventory: Inventory = {
      ...mockInventory,
      items: [
        ...mockInventory.items,
        {
          itemId: "item_treat_plate_biscuit",
          quantity: 2,
          acquiredAt: "2026-06-24T09:00:00.000Z",
          source: "purchase"
        }
      ],
      placedItems: [
        ...mockInventory.placedItems,
        {
          itemId: "item_treat_plate_biscuit",
          slot: "pet_corner",
          x: 0.42,
          y: 0.72,
          rotation: 0
        }
      ],
      updatedAt: "2026-06-24T09:00:00.000Z"
    };
    const service = createMockApiService({
      seed: {
        inventories: [treatInventory]
      }
    });

    const result = unwrap(
      service.performCareAction(userContext, mockPetProfile.id, {
        action: "treat",
        occurredAt: "2026-06-24T09:05:00.000Z"
      })
    );

    expect(result.inventory?.items.find((item) => item.itemId === "item_treat_plate_biscuit")?.quantity).toBe(1);
    expect(result.inventory?.placedItems.some((item) => item.itemId === "item_treat_plate_biscuit")).toBe(true);
    expect(result.reaction).toMatchObject({
      category: "treat_common",
      animation: "treat"
    });

    const second = unwrap(
      service.performCareAction(userContext, mockPetProfile.id, {
        action: "treat",
        itemId: "item_treat_plate_biscuit",
        occurredAt: "2026-06-24T09:06:00.000Z"
      })
    );

    expect(second.inventory?.items.some((item) => item.itemId === "item_treat_plate_biscuit")).toBe(false);
    expect(second.inventory?.placedItems.some((item) => item.itemId === "item_treat_plate_biscuit")).toBe(false);
  });

  it("places and removes owned inventory items through the API boundary", () => {
    const service = createMockApiService();

    expectApiError(service.placeInventoryItem(userContext, { itemId: "missing_item" }), 404, "inventory_item_not_found");

    const removed = unwrap(service.removePlacedItem(userContext, "item_toy_ball_mint"));

    expect(removed.inventory.placedItems.some((item) => item.itemId === "item_toy_ball_mint")).toBe(false);

    const placed = unwrap(service.placeInventoryItem(userContext, { itemId: "item_toy_ball_mint" }));

    expect(placed.inventory.placedItems.find((item) => item.itemId === "item_toy_ball_mint")).toMatchObject({
      itemId: "item_toy_ball_mint"
    });
    expect(service.inspectState().inventories.find((inventory) => inventory.userId === userContext.userId)?.placedItems).toContainEqual(
      expect.objectContaining({ itemId: "item_toy_ball_mint" })
    );
  });

  it("places treat items without replacing food or toy home lanes", () => {
    const service = createMockApiService({
      seed: {
        inventories: [
          {
            ...mockInventory,
            items: [
              ...mockInventory.items,
              {
                itemId: "item_treat_plate_biscuit",
                quantity: 1,
                acquiredAt: "2026-06-24T09:00:00.000Z",
                source: "purchase"
              }
            ]
          }
        ]
      }
    });

    const placed = unwrap(service.placeInventoryItem(userContext, { itemId: "item_treat_plate_biscuit" }));

    expect(placed.inventory.placedItems.some((item) => item.itemId === "item_food_bowl_basic")).toBe(true);
    expect(placed.inventory.placedItems.some((item) => item.itemId === "item_toy_ball_mint")).toBe(true);
    expect(placed.inventory.placedItems.find((item) => item.itemId === "item_treat_plate_biscuit")).toMatchObject({
      x: 0.82,
      y: 0.84
    });
  });

  it("spends credits to purchase catalog items into inventory", () => {
    const service = createMockApiService();
    const emptyWalletService = createMockApiService({ seed: { wallets: [emptyCreditWallet] } });

    expectApiError(
      service.purchaseInventoryItem(userContext, { itemId: "item_food_bowl_basic" }),
      422,
      "item_not_credit_purchasable"
    );
    expectApiError(
      emptyWalletService.purchaseInventoryItem(userContext, { itemId: "item_stepping_stone_path" }),
      403,
      "insufficient_credits"
    );

    const purchased = unwrap(
      service.purchaseInventoryItem(userContext, { itemId: "item_stepping_stone_path" })
    );

    expect(purchased).toMatchObject({
      item: {
        id: "item_stepping_stone_path"
      },
      creditCost: 3,
      wallet: {
        bonusCredits: mockCreditWallet.bonusCredits - 3
      },
      walletSpend: {
        freeChatTicketsSpent: 0,
        bonusCreditsSpent: 3,
        creditsSpent: 0
      },
      inventory: {
        items: expect.arrayContaining([
          expect.objectContaining({
            itemId: "item_stepping_stone_path",
            quantity: 1,
            source: "purchase"
          })
        ])
      }
    });
    expect(service.inspectState().wallets.find((wallet) => wallet.userId === userContext.userId)?.bonusCredits).toBe(
      mockCreditWallet.bonusCredits - 3
    );
  });

  it("starts walks, blocks duplicates, and claims returned rewards once", () => {
    let currentNow = "2026-06-24T09:00:00.000Z";
    const service = createMockApiService({ now: () => currentNow });
    const started = unwrap(service.startWalk(userContext, mockPetProfile.id));

    expect(started.walk).toMatchObject({
      userId: userContext.userId,
      petId: mockPetProfile.id,
      status: "walking",
      returnAt: "2026-06-24T09:00:15.000Z"
    });
    expect(unwrap(service.getCareState(userContext, mockPetProfile.id)).activeWalkId).toBe(started.walk.id);
    expectApiError(service.startWalk(userContext, mockPetProfile.id), 409, "walk_already_active");
    expectApiError(service.claimWalkReward(userContext, started.walk.id), 409, "walk_not_returned");

    currentNow = "2026-06-24T09:00:15.000Z";

    const claimed = unwrap(service.claimWalkReward(userContext, started.walk.id));
    const flowerPot = claimed.inventory.items.find((item) => item.itemId === "item_flower_pot_sunny");

    expect(claimed.walk).toMatchObject({
      id: started.walk.id,
      status: "claimed",
      claimedAt: currentNow
    });
    expect(flowerPot?.quantity).toBe(1);
    expect(claimed.inventory.placedItems.some((item) => item.itemId === "item_flower_pot_sunny")).toBe(true);
    expect(unwrap(service.getCareState(userContext, mockPetProfile.id)).activeWalkId).toBeUndefined();
    expect(claimed.reaction).toMatchObject({
      category: "new_item",
      animation: "idle_happy"
    });
    expectApiError(service.claimWalkReward(userContext, started.walk.id), 409, "walk_already_claimed");
  });

  it("localizes directly generated walk discovery copy for Spanish", () => {
    const service = createMockApiService({ now: () => "2026-06-24T09:00:00.000Z" });

    const started = unwrap(service.startWalk({ ...userContext, locale: "es-MX" }, mockPetProfile.id));

    expect(started.walk.discoveryLine).toBe("Una hojita pensó en ti.");
  });
});
