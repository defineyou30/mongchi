import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { GeneratedAsset, GeneratedAssetState, GenerationJob, GenerationJobStatus } from "@mongchi/shared";

import { firstPassAssetStates } from "../pipeline";
import type { GenerationWorkerRepositories, WorkerOriginalPhotoRecord } from "../generationWorker";
import { runNextGenerationJob } from "../generationWorker";

const asciiBytes = (value: string): number[] => [...value].map((char) => char.charCodeAt(0));
const uint32BigEndian = (value: number) => [(value >>> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
const pngCrcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

const pngCrc32 = (bytes: readonly number[]): number => {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (pngCrcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const makePngChunk = (type: string, data: number[]) => {
  const typeBytes = asciiBytes(type);
  const crc = pngCrc32([...typeBytes, ...data]);

  return [...uint32BigEndian(data.length), ...typeBytes, ...data, ...uint32BigEndian(crc)];
};

const makePngRaster = (width: number, height: number) => {
  const rowBytes = width * 4;
  const raster = new Uint8Array(height * (rowBytes + 1));

  for (let row = 0; row < height; row += 1) {
    raster[row * (rowBytes + 1)] = 0;
  }

  return raster;
};

const makePngBytes = (width = 800, height = 600) =>
  new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...makePngChunk("IHDR", [...uint32BigEndian(width), ...uint32BigEndian(height), 0x08, 0x06, 0x00, 0x00, 0x00]),
    ...makePngChunk("IDAT", [...deflateSync(makePngRaster(width, height))]),
    ...makePngChunk("IEND", [])
  ]);

const job: GenerationJob = {
  id: "gen_worker_001",
  userId: "user_worker_001",
  petId: "pet_worker_001",
  sourcePhotoIds: ["photo_worker_001"],
  optionalPhotoIds: [],
  status: "queued",
  inputSnapshot: {
    species: "dog",
    petName: "Bori",
    personalityTags: ["playful"],
    talkingStyle: "cute"
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

const sourcePhoto: WorkerOriginalPhotoRecord = {
  id: "photo_worker_001",
  userId: "user_worker_001",
  petId: "pet_worker_001",
  contentType: "image/png",
  byteSize: makePngBytes().byteLength,
  status: "uploaded",
  storageUri: "s3://tiny-pet-private/original/photo_worker_001.png"
};

const makeProviderAssets = (states: readonly GeneratedAssetState[]) =>
  states.map((state) => ({
    state,
    bytes: makePngBytes(512, 512),
    width: 512,
    height: 512,
    contentHash: `sha256:${state.padEnd(64, "a").slice(0, 64).replace(/[^a-f0-9]/g, "a")}`,
    mimeType: "image/png" as const,
    transparentBackground: true
  }));

const makeRepositories = (queuedJob: GenerationJob | null = job) => {
  let currentJob = queuedJob;
  const statuses: GenerationJobStatus[] = [];
  const assets: GeneratedAsset[] = [];
  const repositories: GenerationWorkerRepositories = {
    generation: {
      claimNextGenerationJob: async (input) => {
        if (!currentJob) {
          return null;
        }

        currentJob = {
          ...currentJob,
          status: "claimed",
          provider: input.provider ?? currentJob.provider,
          updatedAt: input.claimedAt
        };

        return currentJob;
      },
      updateGenerationJobStatus: async (input) => {
        statuses.push(input.status);

        if (!currentJob) {
          return null;
        }

        currentJob = {
          ...currentJob,
          status: input.status,
          updatedAt: input.updatedAt
        };

        return currentJob;
      },
      findOwnedOriginalPhoto: async () => sourcePhoto,
      upsertGeneratedAsset: async ({ asset }) => {
        assets.push(asset);

        return asset;
      },
      upsertGenerationJob: async ({ job: nextJob }) => {
        currentJob = nextJob;

        return nextJob;
      }
    }
  };

  return {
    repositories,
    statuses,
    assets,
    getCurrentJob: () => currentJob
  };
};

describe("generation worker runtime", () => {
  it("returns idle when no generation job can be claimed", async () => {
    const { repositories } = makeRepositories(null);
    const result = await runNextGenerationJob({
      repositories,
      sourcePhotoReader: {
        readOriginalPhoto: async () => ({ bytes: makePngBytes() })
      },
      provider: {
        provider: "openai",
        generate: async () => {
          throw new Error("Provider should not be called without a claimed job.");
        }
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async () => ({ uri: "s3://unused" })
      }
    });

    expect(result).toEqual({
      status: "idle",
      claimedJob: null
    });
  });

  it("claims a job, validates source photos, runs provider quality gate, stores private assets, and completes the job", async () => {
    const { repositories, statuses, assets } = makeRepositories();
    const providerAssets = makeProviderAssets(firstPassAssetStates);
    const result = await runNextGenerationJob({
      repositories,
      now: () => "2026-06-24T09:10:00.000Z",
      sourcePhotoReader: {
        readOriginalPhoto: async (input) => {
          expect(input.storageUri).toBe(sourcePhoto.storageUri);

          return { bytes: makePngBytes() };
        }
      },
      provider: {
        provider: "openai",
        generate: async (input) => {
          expect(input.job.id).toBe(job.id);
          expect(input.sourcePhotos[0]).toMatchObject({
            photoId: sourcePhoto.id,
            contentType: "image/png",
            width: 800,
            height: 600,
            metadataRemoved: false
          });

          return {
            provider: "openai",
            costUnits: 18,
            assets: providerAssets,
            qualitySignals: {
              requestedSpecies: "dog",
              detectedSpecies: "dog",
              petVisibilityConfidence: 0.94,
              detectedPetCount: 1,
              safetyApproved: true,
              styleMatchScore: 0.91,
              providerConfidence: 0.9,
              assets: providerAssets.map((asset) => ({
                state: asset.state,
                width: asset.width,
                height: asset.height,
                transparentBackground: asset.transparentBackground,
                contentHash: asset.contentHash
              }))
            }
          };
        }
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async (input) => ({
          uri: `s3://tiny-pet-private/generated/${input.job.id}/${input.asset.state}.png`
        })
      }
    });

    expect(result.status).toBe("completed");

    if (result.status !== "completed") {
      throw new Error("Expected worker completion.");
    }

    expect(statuses).toEqual([
      "validating",
      "preprocessing",
      "safety_checking",
      "generating",
      "postprocessing",
      "quality_checking",
      "uploading_assets"
    ]);
    expect(result.job).toMatchObject({
      id: job.id,
      status: "completed",
      provider: "openai",
      costUnits: 18,
      completedAt: "2026-06-24T09:10:00.000Z",
      quality: {
        qualityStatus: "passed"
      }
    });
    expect(result.assets).toHaveLength(firstPassAssetStates.length);
    expect(assets.map((asset) => asset.uri)).toEqual(
      firstPassAssetStates.map((state) => `s3://tiny-pet-private/generated/${job.id}/${state}.png`)
    );
  });

  it("normalizes provider and storage asset metadata before persistence", async () => {
    const { repositories, assets } = makeRepositories();
    const providerAssets = makeProviderAssets(["idle"]).map((asset) => ({
      ...asset,
      id: " asset_custom_idle_001 ",
      contentHash: "A".repeat(64),
      version: 2
    }));
    const result = await runNextGenerationJob({
      repositories,
      now: () => "2026-06-24T09:12:00.000Z",
      requiredAssetStates: ["idle"],
      sourcePhotoReader: {
        readOriginalPhoto: async () => ({ bytes: makePngBytes() })
      },
      provider: {
        provider: "openai",
        generate: async () => ({
          provider: "openai",
          costUnits: 4,
          assets: providerAssets,
          qualitySignals: {
            requestedSpecies: "dog",
            detectedSpecies: "dog",
            petVisibilityConfidence: 0.94,
            detectedPetCount: 1,
            safetyApproved: true,
            styleMatchScore: 0.91,
            providerConfidence: 0.9,
            assets: providerAssets.map((asset) => ({
              state: asset.state,
              width: asset.width,
              height: asset.height,
              transparentBackground: asset.transparentBackground,
              contentHash: asset.contentHash
            }))
          }
        })
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async (input) => {
          expect(input.asset.contentHash).toBe(`sha256:${"a".repeat(64)}`);

          return {
            uri: `s3://tiny-pet-private/generated/${input.job.id}/${input.asset.state}.png`,
            contentHash: "B".repeat(64)
          };
        }
      }
    });

    expect(result.status).toBe("completed");

    if (result.status !== "completed") {
      throw new Error("Expected worker completion.");
    }

    expect(assets[0]).toMatchObject({
      id: "asset_custom_idle_001",
      state: "idle",
      uri: `s3://tiny-pet-private/generated/${job.id}/idle.png`,
      contentHash: `sha256:${"b".repeat(64)}`,
      version: 2
    });
  });

  it("fails before persisting assets when storage metadata is unsafe", async () => {
    const { repositories, assets, statuses } = makeRepositories();
    const providerAssets = makeProviderAssets(["idle"]);
    const result = await runNextGenerationJob({
      repositories,
      now: () => "2026-06-24T09:14:00.000Z",
      requiredAssetStates: ["idle"],
      sourcePhotoReader: {
        readOriginalPhoto: async () => ({ bytes: makePngBytes() })
      },
      provider: {
        provider: "openai",
        generate: async () => ({
          provider: "openai",
          costUnits: 4,
          assets: providerAssets,
          qualitySignals: {
            requestedSpecies: "dog",
            detectedSpecies: "dog",
            petVisibilityConfidence: 0.94,
            detectedPetCount: 1,
            safetyApproved: true,
            styleMatchScore: 0.91,
            providerConfidence: 0.9,
            assets: providerAssets.map((asset) => ({
              state: asset.state,
              width: asset.width,
              height: asset.height,
              transparentBackground: asset.transparentBackground
            }))
          }
        })
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async () => ({
          uri: "https://public.example/generated/idle.png"
        })
      }
    });

    expect(result.status).toBe("failed");

    if (result.status !== "failed") {
      throw new Error("Expected worker failure.");
    }

    expect(statuses).toContain("uploading_assets");
    expect(result.failureCode).toBe("generation_worker_failed");
    expect(assets).toHaveLength(0);
  });

  it("marks the job failed when provider output does not pass the quality gate", async () => {
    const { repositories, statuses } = makeRepositories();
    const providerAssets = makeProviderAssets(["base"]);
    const result = await runNextGenerationJob({
      repositories,
      now: () => "2026-06-24T09:20:00.000Z",
      sourcePhotoReader: {
        readOriginalPhoto: async () => ({ bytes: makePngBytes() })
      },
      provider: {
        provider: "openai",
        generate: async () => ({
          provider: "openai",
          costUnits: 8,
          assets: providerAssets,
          qualitySignals: {
            requestedSpecies: "dog",
            detectedSpecies: "cat",
            petVisibilityConfidence: 0.42,
            detectedPetCount: 2,
            safetyApproved: true,
            styleMatchScore: 0.9,
            providerConfidence: 0.9,
            assets: providerAssets.map((asset) => ({
              state: asset.state,
              width: asset.width,
              height: asset.height,
              transparentBackground: asset.transparentBackground
            }))
          }
        })
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async () => {
          throw new Error("Assets should not be stored after a quality failure.");
        }
      }
    });

    expect(result.status).toBe("failed");

    if (result.status !== "failed") {
      throw new Error("Expected worker failure.");
    }

    expect(statuses).toEqual(["validating", "preprocessing", "safety_checking", "generating", "postprocessing", "quality_checking"]);
    expect(result.failureCode).toBe("quality_gate_failed");
    expect(result.job).toMatchObject({
      status: "failed",
      failure: {
        failureCode: "quality_gate_failed",
        retryable: true,
        refundCreditRequired: false
      },
      quality: {
        qualityStatus: "failed",
        retryRecommended: true
      }
    });
    expect(result.job.quality.failedChecks).toEqual(
      expect.arrayContaining(["required_asset_missing", "wrong_species", "no_pet_visible", "multiple_pets_visible"])
    );
  });

  it("fails before provider generation when source photo safety precheck blocks the upload", async () => {
    const { repositories, statuses } = makeRepositories();
    const result = await runNextGenerationJob({
      repositories,
      now: () => "2026-06-24T09:23:00.000Z",
      sourcePhotoReader: {
        readOriginalPhoto: async () => ({ bytes: makePngBytes() })
      },
      sourcePhotoSafetyChecker: {
        checkSourcePhotos: async (input) => {
          expect(input.job.id).toBe(job.id);
          expect(input.sourcePhotos[0]?.photoId).toBe(sourcePhoto.id);

          return {
            ok: false,
            failureCode: "source_photo_safety_failed",
            failureMessageSafe: "Source photo could not pass safety checks. Choose another photo.",
            retryable: true,
            quality: {
              qualityStatus: "failed",
              qualityScore: 0.18,
              failedChecks: ["source_photo_unsafe_content"],
              manualReviewRequired: false,
              retryRecommended: true
            },
            signals: [
              {
                photoId: sourcePhoto.id,
                safetyApproved: false,
                manualReviewRequired: false,
                confidence: 0.18,
                failedChecks: ["source_photo_unsafe_content"]
              }
            ]
          };
        }
      },
      provider: {
        provider: "openai",
        generate: async () => {
          throw new Error("Provider should not be called after source photo safety failure.");
        }
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async () => {
          throw new Error("Assets should not be stored after source photo safety failure.");
        }
      }
    });

    expect(statuses).toEqual(["validating", "preprocessing", "safety_checking"]);
    expect(result.status).toBe("failed");

    if (result.status !== "failed") {
      throw new Error("Expected worker failure.");
    }

    expect(result.failureCode).toBe("source_photo_safety_failed");
    expect(result.job.failure).toMatchObject({
      failureCode: "source_photo_safety_failed",
      failureMessageSafe: "Source photo could not pass safety checks. Choose another photo.",
      retryable: true
    });
    expect(result.job.quality).toEqual({
      qualityStatus: "failed",
      qualityScore: 0.18,
      failedChecks: ["source_photo_unsafe_content"],
      manualReviewRequired: false,
      retryRecommended: true
    });
  });

  it("preserves manual-review metadata when source photo safety precheck requests review", async () => {
    const { repositories, statuses } = makeRepositories();
    const result = await runNextGenerationJob({
      repositories,
      now: () => "2026-06-24T09:24:00.000Z",
      sourcePhotoReader: {
        readOriginalPhoto: async () => ({ bytes: makePngBytes() })
      },
      sourcePhotoSafetyChecker: {
        checkSourcePhotos: async () => ({
          ok: false,
          failureCode: "source_photo_manual_review_required",
          failureMessageSafe: "Source photo needs review before generation can continue.",
          retryable: false,
          quality: {
            qualityStatus: "manual_review",
            qualityScore: 0.52,
            failedChecks: ["source_photo_manual_review_required"],
            manualReviewRequired: true,
            retryRecommended: false
          },
          signals: [
            {
              photoId: sourcePhoto.id,
              safetyApproved: false,
              manualReviewRequired: true,
              confidence: 0.52,
              failedChecks: ["source_photo_manual_review_required"]
            }
          ]
        })
      },
      provider: {
        provider: "openai",
        generate: async () => {
          throw new Error("Provider should not be called while source photo awaits review.");
        }
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async () => {
          throw new Error("Assets should not be stored while source photo awaits review.");
        }
      }
    });

    expect(statuses).toEqual(["validating", "preprocessing", "safety_checking"]);
    expect(result.status).toBe("failed");

    if (result.status !== "failed") {
      throw new Error("Expected worker failure.");
    }

    expect(result.failureCode).toBe("source_photo_manual_review_required");
    expect(result.job.failure?.retryable).toBe(false);
    expect(result.job.quality).toMatchObject({
      qualityStatus: "manual_review",
      manualReviewRequired: true,
      retryRecommended: false,
      failedChecks: ["source_photo_manual_review_required"]
    });
  });

  it("preserves manual-review quality metadata when the quality gate requires review", async () => {
    const { repositories } = makeRepositories();
    const providerAssets = makeProviderAssets(firstPassAssetStates);
    const result = await runNextGenerationJob({
      repositories,
      now: () => "2026-06-24T09:25:00.000Z",
      sourcePhotoReader: {
        readOriginalPhoto: async () => ({ bytes: makePngBytes() })
      },
      provider: {
        provider: "openai",
        generate: async () => ({
          provider: "openai",
          costUnits: 11,
          assets: providerAssets,
          qualitySignals: {
            requestedSpecies: "dog",
            detectedSpecies: "dog",
            petVisibilityConfidence: 0.95,
            detectedPetCount: 1,
            safetyApproved: true,
            styleMatchScore: 0.92,
            providerConfidence: 0.91,
            manualReviewRequired: true,
            assets: providerAssets.map((asset) => ({
              state: asset.state,
              width: asset.width,
              height: asset.height,
              transparentBackground: asset.transparentBackground
            }))
          }
        })
      },
      generatedAssetStorage: {
        writeGeneratedAsset: async () => {
          throw new Error("Manual-review outputs should not be stored before review.");
        }
      }
    });

    expect(result.status).toBe("failed");

    if (result.status !== "failed") {
      throw new Error("Expected worker failure.");
    }

    expect(result.job.quality).toMatchObject({
      qualityStatus: "manual_review",
      manualReviewRequired: true,
      retryRecommended: false,
      failedChecks: ["manual_review_required"]
    });
    expect(result.job.failure?.retryable).toBe(false);
  });
});
