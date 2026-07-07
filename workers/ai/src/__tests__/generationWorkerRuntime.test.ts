import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { generatedAssetStates, type GeneratedAsset, type GenerationJob, type GenerationJobStatus } from "@mongchi/shared";

import type {
  GeneratedAssetStorageWriteResult,
  GenerationProviderAdapter,
  GenerationWorkerRepositories,
  OriginalPhotoReadResult
} from "../generationWorker";
import {
  createGenerationWorkerBatchRuntime,
  createOpenAiGenerationWorkerBatchRuntime,
  createS3GenerationWorkerStorageFromRuntimeConfig
} from "../generationWorkerRuntime";
import type { OpenAiImageProviderFetch } from "../openAiImageProvider";
import type { OpenAiResponsesFetch } from "../openAiSourcePhotoSafetyClassifier";
import type { S3GenerationWorkerStorage } from "../s3WorkerStorage";
import type { WorkerRuntimeConfig } from "../workerRuntimeConfig";

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

const makePngBytes = (width = 128, height = 128) =>
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

const makeConfig = (production: boolean, maxJobsPerRun = 2): WorkerRuntimeConfig => ({
  releaseProfile: production ? "production" : "development",
  production,
  database: null,
  storage: {
    bucket: "tiny-pet-private",
    region: "us-east-1",
    accessKeyId: "AKIAWORKERKEY",
    secretAccessKey: "worker-secret-key",
    endpoint: "https://s3.us-east-1.amazonaws.com",
    forcePathStyle: false,
    generatedAssetPrefix: "generated/prod"
  },
  provider: {
    provider: "openai",
    apiKey: "provider-secret-key"
  },
  qualityGate: {
    minimumPetVisibilityConfidence: 0.72,
    minimumStyleMatchScore: 0.7,
    minimumProviderConfidence: 0.68
  },
  maxJobsPerRun
});

const makeOpenAiConfig = (): WorkerRuntimeConfig => ({
  ...makeConfig(true, 1),
  provider: {
    provider: "openai",
    apiKey: "runtime-openai-key",
    model: "runtime-image-model",
    safetyModel: "runtime-vision-model"
  }
});

const sourcePhoto = {
  id: "photo_runtime_001",
  userId: "user_runtime_001",
  petId: "pet_runtime_001",
  contentType: "image/png" as const,
  byteSize: makePngBytes().byteLength,
  status: "uploaded",
  storageUri: "s3://tiny-pet-private/original/photo_runtime_001.png"
};

const makeJob = (id: string): GenerationJob => ({
  id,
  userId: sourcePhoto.userId,
  petId: sourcePhoto.petId,
  sourcePhotoIds: [sourcePhoto.id],
  optionalPhotoIds: [],
  status: "queued",
  inputSnapshot: {
    species: "dog",
    petName: "Miso",
    personalityTags: ["curious"],
    talkingStyle: "gentle"
  },
  provider: "mock",
  costUnits: 0,
  quality: {
    qualityStatus: "pending",
    failedChecks: [],
    manualReviewRequired: false,
    retryRecommended: false
  },
  createdAt: "2026-06-24T12:00:00.000Z",
  updatedAt: "2026-06-24T12:00:00.000Z"
});

const makeRepositories = (queuedJobs: GenerationJob[]) => {
  const queue = [...queuedJobs];
  const claimedJobIds: string[] = [];
  const statuses: GenerationJobStatus[] = [];
  const repositories: GenerationWorkerRepositories = {
    generation: {
      claimNextGenerationJob: async (input) => {
        const job = queue.shift() ?? null;

        if (!job) {
          return null;
        }

        claimedJobIds.push(job.id);

        return {
          ...job,
          status: "claimed",
          provider: input.provider ?? job.provider,
          updatedAt: input.claimedAt
        };
      },
      updateGenerationJobStatus: async (input) => {
        statuses.push(input.status);

        return null;
      },
      findOwnedOriginalPhoto: async () => sourcePhoto,
      upsertGeneratedAsset: async ({ asset }: { asset: GeneratedAsset }) => asset,
      upsertGenerationJob: async ({ job }) => job
    }
  };

  return {
    claimedJobIds,
    repositories,
    statuses
  };
};

const storage: S3GenerationWorkerStorage = {
  readOriginalPhoto: async (): Promise<OriginalPhotoReadResult> => ({
    bytes: makePngBytes(),
    declaredContentType: "image/png"
  }),
  writeGeneratedAsset: async ({ job, asset }): Promise<GeneratedAssetStorageWriteResult> => ({
    uri: `s3://tiny-pet-private/generated/${job.id}/${asset.state}.png`
  })
};

const makeOpenAiResponsesFetch = (
  requests: Array<{ url: string; init: Parameters<OpenAiResponsesFetch>[1] }>
): OpenAiResponsesFetch => {
  const payloads = [
    {
      safetyApproved: true,
      manualReviewRequired: false,
      confidence: 0.94,
      failedChecks: [],
      warnings: []
    },
    {
      detectedSpecies: "dog",
      petVisibilityConfidence: 0.95,
      detectedPetCount: 1,
      safetyApproved: true,
      styleMatchScore: 0.92,
      providerConfidence: 0.9,
      manualReviewRequired: false
    }
  ];

  return async (url, init) => {
    requests.push({ url, init });

    return {
      status: 200,
      json: async () => ({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(payloads.shift() ?? payloads[0])
              }
            ]
          }
        ]
      })
    };
  };
};

const makeOpenAiImageFetch = (
  requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }>
): OpenAiImageProviderFetch => {
  const outputPng = makePngBytes(512, 512);

  return async (url, init) => {
    requests.push({ url, init });

    return {
      status: 200,
      json: async () => ({
        data: [
          {
            b64_json: Buffer.from(outputPng).toString("base64")
          }
        ],
        usage: {
          total_tokens: 9
        }
      })
    };
  };
};

const failingProvider: GenerationProviderAdapter = {
  provider: "openai",
  generate: async () => {
    throw new Error("provider unavailable");
  }
};

const lowVisibilityProvider: GenerationProviderAdapter = {
  provider: "openai",
  generate: async ({ job, requiredAssetStates }) => {
    const assets = requiredAssetStates.map((state) => ({
      state,
      bytes: makePngBytes(512, 512),
      width: 512,
      height: 512,
      contentHash: `sha256:${state.padEnd(64, "b").slice(0, 64).replace(/[^a-f0-9]/g, "b")}`,
      mimeType: "image/png" as const,
      transparentBackground: true
    }));

    return {
      provider: "openai",
      costUnits: 1,
      assets,
      qualitySignals: {
        requestedSpecies: job.inputSnapshot.species,
        detectedSpecies: job.inputSnapshot.species,
        petVisibilityConfidence: 0.8,
        detectedPetCount: 1,
        safetyApproved: true,
        styleMatchScore: 0.95,
        providerConfidence: 0.95,
        assets: assets.map((asset) => ({
          state: asset.state,
          width: asset.width,
          height: asset.height,
          transparentBackground: asset.transparentBackground,
          contentHash: asset.contentHash
        }))
      }
    };
  }
};

describe("generation worker runtime composition", () => {
  it("creates S3 worker storage from validated runtime config", async () => {
    const requests: string[] = [];
    const storage = createS3GenerationWorkerStorageFromRuntimeConfig(makeConfig(true), {
      now: () => new Date("2026-06-24T12:00:00.000Z"),
      fetch: async (url) => {
        requests.push(url);

        return {
          status: 200,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
        };
      }
    });
    const result = await storage.readOriginalPhoto({
      photo: sourcePhoto,
      storageUri: "s3://tiny-pet-private/original/photo_runtime_001.png"
    });

    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(requests[0]).toBe("https://tiny-pet-private.s3.us-east-1.amazonaws.com/original/photo_runtime_001.png");
    expect(() => createS3GenerationWorkerStorageFromRuntimeConfig({ ...makeConfig(true), storage: null })).toThrow(
      "Worker private storage runtime config is missing."
    );
  });

  it("uses maxJobsPerRun and stops on the first failed production batch job by default", async () => {
    const { claimedJobIds, repositories } = makeRepositories([makeJob("gen_runtime_001"), makeJob("gen_runtime_002")]);
    const runtime = createGenerationWorkerBatchRuntime(makeConfig(true, 2), {
      repositories,
      provider: failingProvider,
      storage,
      now: () => "2026-06-24T12:05:00.000Z"
    });
    const result = await runtime.runOnce();

    expect(result.completedJobs).toBe(0);
    expect(result.failedJobs).toBe(1);
    expect(result.results.map((entry) => entry.status)).toEqual(["failed"]);
    expect(claimedJobIds).toEqual(["gen_runtime_001"]);
  });

  it("continues failed development batches unless stopOnFailure is requested", async () => {
    const { claimedJobIds, repositories } = makeRepositories([makeJob("gen_runtime_001"), makeJob("gen_runtime_002")]);
    const runtime = createGenerationWorkerBatchRuntime(makeConfig(false, 2), {
      repositories,
      provider: failingProvider,
      storage,
      now: () => "2026-06-24T12:06:00.000Z"
    });
    const result = await runtime.runOnce();

    expect(result.failedJobs).toBe(2);
    expect(result.results.map((entry) => entry.status)).toEqual(["failed", "failed"]);
    expect(claimedJobIds).toEqual(["gen_runtime_001", "gen_runtime_002"]);
  });

  it("passes runtime quality thresholds into the worker quality gate", async () => {
    const { repositories, statuses } = makeRepositories([makeJob("gen_runtime_quality_001")]);
    const runtime = createGenerationWorkerBatchRuntime(
      {
        ...makeConfig(false, 1),
        qualityGate: {
          minimumPetVisibilityConfidence: 0.9,
          minimumStyleMatchScore: 0.7,
          minimumProviderConfidence: 0.68
        }
      },
      {
        repositories,
        provider: lowVisibilityProvider,
        storage,
        now: () => "2026-06-24T12:07:00.000Z"
      }
    );
    const result = await runtime.runOnce();

    expect(result.completedJobs).toBe(0);
    expect(result.failedJobs).toBe(1);
    expect(result.results[0]).toMatchObject({
      status: "failed",
      failureCode: "quality_gate_failed"
    });
    expect(statuses).toEqual(["validating", "preprocessing", "safety_checking", "generating", "postprocessing", "quality_checking"]);
  });

  it("composes OpenAI image, source safety, and generation quality adapters from runtime config", async () => {
    const { repositories, statuses } = makeRepositories([makeJob("gen_runtime_openai_001")]);
    const responseRequests: Array<{ url: string; init: Parameters<OpenAiResponsesFetch>[1] }> = [];
    const imageRequests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }> = [];
    const responsesFetch = makeOpenAiResponsesFetch(responseRequests);
    const runtime = createOpenAiGenerationWorkerBatchRuntime(makeOpenAiConfig(), {
      repositories,
      storage,
      now: () => "2026-06-24T12:08:00.000Z",
      openAi: {
        image: {
          baseUrl: "https://api.example.test/v1/",
          fetch: makeOpenAiImageFetch(imageRequests)
        },
        sourcePhotoSafety: {
          baseUrl: "https://api.example.test/v1/",
          fetch: responsesFetch
        },
        quality: {
          baseUrl: "https://api.example.test/v1/",
          fetch: responsesFetch
        }
      }
    });
    const result = await runtime.runOnce();

    expect(result.completedJobs).toBe(1);
    expect(result.failedJobs).toBe(0);
    expect(result.results.map((entry) => entry.status)).toEqual(["completed"]);
    expect(statuses).toEqual([
      "validating",
      "preprocessing",
      "safety_checking",
      "generating",
      "postprocessing",
      "quality_checking",
      "uploading_assets"
    ]);
    // Runtime default packs 4 states per sheet, so 16 states = 4 sheet requests.
    expect(imageRequests).toHaveLength(Math.ceil(generatedAssetStates.length / 4));
    expect(imageRequests[0]?.url).toBe("https://api.example.test/v1/images/edits");
    expect(imageRequests.every((request) => request.init.body.get("model") === "runtime-image-model")).toBe(true);
    expect(responseRequests).toHaveLength(2);
    expect(responseRequests.map((request) => request.url)).toEqual([
      "https://api.example.test/v1/responses",
      "https://api.example.test/v1/responses"
    ]);
    expect(responseRequests.map((request) => JSON.parse(request.init.body) as { model?: unknown }).map((body) => body.model)).toEqual([
      "runtime-vision-model",
      "runtime-vision-model"
    ]);
  });
});
