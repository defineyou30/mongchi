import { describe, expect, it } from "vitest";

import {
  createInitialPrototypeSession,
  mockGeneratedAssets,
  mockPetProfile,
  setPrototypeConsentAccepted,
  setPrototypeMockPhotoSelected,
  updatePrototypeDraft
} from "@mongchi/shared";
import type {
  AcceptGenerationJobResponse,
  CompletePhotoUploadResponse,
  CreateGenerationJobRequest,
  CreatePetRequest,
  GeneratedAsset,
  GenerationJob,
  GenerationPollResponse,
  PetAssetsResponse,
  PetProfile,
  PhotoUploadUrlRequest,
  PhotoUploadUrlResponse,
  RetryGenerationJobResponse
} from "@mongchi/shared";

import type { MobileApiResult } from "../../shared/api";
import {
  acceptApiGeneratedPet,
  createConfiguredGenerationApiClient,
  pollApiGenerationFlow,
  retryApiGenerationFlow,
  startApiGenerationFlow
} from "./apiGenerationSession";
import type { GenerationApiClient } from "./apiGenerationSession";

const ok = <T>(data: T, status = 200): MobileApiResult<T> => ({
  ok: true,
  status,
  data
});

const apiError = <T>(code: string): MobileApiResult<T> => ({
  ok: false,
  error: {
    status: 422,
    code,
    messageSafe: "Request failed.",
    retryable: false
  }
});

const {
  activeGenerationJobId: _activeGenerationJobId,
  activeAssetId: _activeAssetId,
  ...draftPetBase
} = mockPetProfile;

const draftPet: PetProfile = {
  ...draftPetBase,
  id: "pet_api_001",
  lifecycleStatus: "draft"
};

const job: GenerationJob = {
  id: "gen_api_001",
  userId: draftPet.userId,
  petId: draftPet.id,
  sourcePhotoIds: ["photo_api_001"],
  optionalPhotoIds: [],
  status: "created",
  inputSnapshot: {
    species: draftPet.species,
    petName: draftPet.name,
    personalityTags: draftPet.personalityTags,
    talkingStyle: draftPet.talkingStyle
  },
  provider: "mock",
  costUnits: 0,
  quality: {
    qualityStatus: "pending",
    failedChecks: [],
    manualReviewRequired: false,
    retryRecommended: false
  },
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const apiAsset: GeneratedAsset = {
  ...mockGeneratedAssets[0]!,
  id: "asset_api_idle_001",
  petId: draftPet.id,
  generationJobId: job.id
};

const apiAssets: GeneratedAsset[] = mockGeneratedAssets.map((asset) => ({
  ...asset,
  id: `asset_api_${asset.state}_001`,
  petId: draftPet.id,
  generationJobId: job.id
}));

const createFakeClient = (overrides: Partial<GenerationApiClient> = {}): GenerationApiClient => ({
  createPet: async (_body: CreatePetRequest) => ok<PetProfile>(draftPet, 201),
  issuePhotoUploadUrl: async (_body: PhotoUploadUrlRequest) =>
    ok<PhotoUploadUrlResponse>({
      photoId: "photo_api_001",
      uploadUrl: "mock-signed-upload://private/user_demo_001/pet_api_001/photo_api_001",
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": "image/png"
      },
      expiresAt: "2026-06-24T09:15:00.000Z",
      maxByteSize: 10 * 1024 * 1024
    }),
  completePhotoUpload: async () =>
    ok<CompletePhotoUploadResponse>({
      photo: {
        id: "photo_api_001",
        petId: draftPet.id,
        contentType: "image/png",
        byteSize: 4096,
        status: "uploaded"
      }
    }),
  createGenerationJob: async (_body: CreateGenerationJobRequest) => ok<GenerationJob>(job, 201),
  pollGenerationJob: async () =>
    ok<GenerationPollResponse>({
      job: {
        ...job,
        status: "completed",
        completedAt: "2026-06-24T09:00:03.000Z"
      },
      assets: apiAssets
    }),
  retryGenerationJob: async () =>
    ok<RetryGenerationJobResponse>({
      job: {
        ...job,
        status: "created"
      }
    }),
  listGeneratedAssets: async () =>
    ok<PetAssetsResponse>({
      assets: apiAssets
    }),
  acceptGenerationJob: async () =>
    ok<AcceptGenerationJobResponse>({
      pet: {
        ...draftPet,
        lifecycleStatus: "active",
        activeGenerationJobId: job.id,
        activeAssetId: apiAssets[0]!.id
      },
      assets: apiAssets
    }),
  ...overrides
});

const createReadyState = () => {
  let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

  state = updatePrototypeDraft(state, {
    name: "Miso",
    species: "dog",
    talkingStyle: "gentle",
    personalityTags: ["affectionate"]
  });
  state = setPrototypeMockPhotoSelected(state, true);
  state = setPrototypeConsentAccepted(state, true);

  return state;
};

describe("API generation session helpers", () => {
  it("resolves configured API clients without accepting unsafe production HTTP", () => {
    expect(createConfiguredGenerationApiClient(null)).toMatchObject({
      mode: "local",
      error: null,
      client: null
    });
    expect(createConfiguredGenerationApiClient("http://api.example.com")).toMatchObject({
      mode: "local",
      error: {
        code: "api_base_url_invalid"
      }
    });
    expect(createConfiguredGenerationApiClient("http://localhost:8787")).toMatchObject({
      mode: "api",
      error: null
    });
  });

  it("creates pet/photo/generation resources and maps them into local generation state", async () => {
    let completedContentHash: string | null = null;
    let uploadedPhotoId: string | null = null;
    const result = await startApiGenerationFlow(
      createFakeClient({
        completePhotoUpload: async (body) => {
          completedContentHash = body.contentHash;

          return ok<CompletePhotoUploadResponse>({
            photo: {
              id: body.photoId,
              petId: draftPet.id,
              contentType: "image/png",
              byteSize: 4096,
              status: "uploaded"
            }
          });
        }
      }),
      createReadyState(),
      "2026-06-24T09:01:00.000Z",
      async (request) => {
        uploadedPhotoId = request.signedUpload.photoId;

        return {
          ok: true,
          contentHash: `sha256:${"a".repeat(64)}`,
          byteSize: request.expectedByteSize ?? 0,
          uploaded: true
        };
      }
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        petProfile: {
          id: draftPet.id,
          activeGenerationJobId: job.id
        },
        generation: {
          status: "preprocessing",
          currentStepIndex: 0,
          startedAt: "2026-06-24T09:01:00.000Z"
        }
      }
    });
    expect(uploadedPhotoId).toBe("photo_api_001");
    expect(completedContentHash).toBe(`sha256:${"a".repeat(64)}`);
  });

  it("polls generation completion, retries jobs, and accepts generated assets", async () => {
    let acceptedAssetIds: string[] = [];
    const state = {
      ...createReadyState(),
      petProfile: {
        ...draftPet,
        activeGenerationJobId: job.id
      }
    };
    const polled = await pollApiGenerationFlow(createFakeClient(), state, "2026-06-24T09:01:03.000Z");
    const retried = await retryApiGenerationFlow(createFakeClient(), state, "2026-06-24T09:02:00.000Z");
    const accepted = await acceptApiGeneratedPet(
      createFakeClient({
        acceptGenerationJob: async (body) => {
          acceptedAssetIds = body.acceptedAssetIds;

          return ok<AcceptGenerationJobResponse>({
            pet: {
              ...draftPet,
              lifecycleStatus: "active",
              activeGenerationJobId: job.id,
              activeAssetId: apiAssets[0]!.id
            },
            assets: apiAssets
          });
        }
      }),
      {
        ...state,
        acceptedAsset: apiAssets[0]!,
        acceptedAssets: apiAssets
      }
    );

    expect(polled).toMatchObject({
      ok: true,
      data: {
        generation: {
          status: "completed",
          currentStepIndex: 4,
          completedAt: "2026-06-24T09:01:03.000Z"
        },
        acceptedAsset: {
          id: apiAssets[0]!.id
        },
        acceptedAssets: apiAssets
      }
    });
    expect(retried).toMatchObject({
      ok: true,
      data: {
        generation: {
          status: "preprocessing",
          retryCount: 1
        },
        acceptedAsset: null,
        acceptedAssets: []
      }
    });
    expect(accepted).toMatchObject({
      ok: true,
      data: {
        petProfile: {
          lifecycleStatus: "active",
          activeAssetId: apiAssets[0]!.id
        },
        acceptedAsset: {
          id: apiAssets[0]!.id
        },
        acceptedAssets: apiAssets
      }
    });
    expect(acceptedAssetIds).toEqual(apiAssets.map((asset) => asset.id));
  });

  it("returns safe errors when photo metadata is missing or API calls fail", async () => {
    const missingPhoto = await startApiGenerationFlow(createFakeClient(), createInitialPrototypeSession(), "2026-06-24T09:00:00.000Z");
    const failedCreate = await startApiGenerationFlow(
      createFakeClient({
        createPet: async () => apiError("invalid_pet_name")
      }),
      createReadyState(),
      "2026-06-24T09:00:00.000Z"
    );

    expect(missingPhoto).toMatchObject({
      ok: false,
      error: {
        code: "source_photo_required"
      }
    });
    expect(failedCreate).toMatchObject({
      ok: false,
      error: {
        code: "invalid_pet_name"
      }
    });
  });
});
