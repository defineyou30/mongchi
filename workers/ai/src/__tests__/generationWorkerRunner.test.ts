import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { GeneratedAsset, GeneratedAssetState, GenerationJob, GenerationJobStatus } from "@mongchi/shared";

import type { GenerationWorkerRepositories, WorkerOriginalPhotoRecord } from "../generationWorker";
import { runGenerationWorkerBatch } from "../generationWorkerRunner";
import { firstPassAssetStates } from "../pipeline";

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

const sourcePhoto: WorkerOriginalPhotoRecord = {
  id: "photo_batch_001",
  userId: "user_batch_001",
  petId: "pet_batch_001",
  contentType: "image/png",
  byteSize: makePngBytes().byteLength,
  status: "uploaded",
  storageUri: "s3://tiny-pet-private/original/photo_batch_001.png"
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
  createdAt: "2026-06-24T11:00:00.000Z",
  updatedAt: "2026-06-24T11:00:00.000Z"
});

const makeProviderAssets = (states: readonly GeneratedAssetState[]) =>
  states.map((state) => ({
    state,
    bytes: makePngBytes(),
    width: 512,
    height: 512,
    contentHash: `sha256:${state.padEnd(64, "a").slice(0, 64).replace(/[^a-f0-9]/g, "a")}`,
    mimeType: "image/png" as const,
    transparentBackground: true
  }));

const makeRepositories = (queuedJobs: GenerationJob[]) => {
  const jobs = [...queuedJobs];
  const claimedJobIds: string[] = [];
  const statuses: GenerationJobStatus[] = [];
  const assets: GeneratedAsset[] = [];
  const repositories: GenerationWorkerRepositories = {
    generation: {
      claimNextGenerationJob: async (input) => {
        const nextJob = jobs.shift() ?? null;

        if (!nextJob) {
          return null;
        }

        claimedJobIds.push(nextJob.id);

        return {
          ...nextJob,
          status: "claimed",
          provider: input.provider ?? nextJob.provider,
          updatedAt: input.claimedAt
        };
      },
      updateGenerationJobStatus: async (input) => {
        statuses.push(input.status);

        return null;
      },
      findOwnedOriginalPhoto: async () => sourcePhoto,
      upsertGeneratedAsset: async ({ asset }) => {
        assets.push(asset);

        return asset;
      },
      upsertGenerationJob: async ({ job }) => job
    }
  };

  return {
    assets,
    claimedJobIds,
    repositories,
    statuses
  };
};

const makeBatchInput = (repositories: GenerationWorkerRepositories) => ({
  repositories,
  now: () => "2026-06-24T11:05:00.000Z",
  sourcePhotoReader: {
    readOriginalPhoto: async () => ({ bytes: makePngBytes() })
  },
  provider: {
    provider: "openai" as const,
    generate: async () => ({
      provider: "openai" as const,
      costUnits: 2,
      assets: makeProviderAssets(firstPassAssetStates),
      qualitySignals: {
        requestedSpecies: "dog" as const,
        detectedSpecies: "dog" as const,
        petVisibilityConfidence: 0.94,
        detectedPetCount: 1,
        safetyApproved: true,
        styleMatchScore: 0.91,
        providerConfidence: 0.9,
        assets: firstPassAssetStates.map((state) => ({
          state,
          width: 512,
          height: 512,
          transparentBackground: true,
          contentHash: `sha256:${state}`
        }))
      }
    })
  },
  generatedAssetStorage: {
    writeGeneratedAsset: async ({ job, asset }: { job: GenerationJob; asset: { state: GeneratedAssetState } }) => ({
      uri: `s3://tiny-pet-private/generated/${job.id}/${asset.state}.png`
    })
  }
});

describe("generation worker batch runner", () => {
  it("returns an idle batch result when no job can be claimed", async () => {
    const { repositories } = makeRepositories([]);
    const result = await runGenerationWorkerBatch({
      ...makeBatchInput(repositories),
      maxJobs: 4
    });

    expect(result).toMatchObject({
      completedJobs: 0,
      failedJobs: 0,
      idle: true
    });
    expect(result.results.map((entry) => entry.status)).toEqual(["idle"]);
  });

  it("processes at most maxJobs in one batch run", async () => {
    const { assets, claimedJobIds, repositories } = makeRepositories([makeJob("gen_batch_001"), makeJob("gen_batch_002"), makeJob("gen_batch_003")]);
    const result = await runGenerationWorkerBatch({
      ...makeBatchInput(repositories),
      maxJobs: 2
    });

    expect(result.completedJobs).toBe(2);
    expect(result.failedJobs).toBe(0);
    expect(result.idle).toBe(false);
    expect(result.results.map((entry) => entry.status)).toEqual(["completed", "completed"]);
    expect(claimedJobIds).toEqual(["gen_batch_001", "gen_batch_002"]);
    expect(assets).toHaveLength(firstPassAssetStates.length * 2);
  });

  it("stops after idle when the queue drains before maxJobs", async () => {
    const { repositories } = makeRepositories([makeJob("gen_batch_001")]);
    const result = await runGenerationWorkerBatch({
      ...makeBatchInput(repositories),
      maxJobs: 3
    });

    expect(result.completedJobs).toBe(1);
    expect(result.idle).toBe(true);
    expect(result.results.map((entry) => entry.status)).toEqual(["completed", "idle"]);
  });

  it("can stop the batch after the first failed generation job", async () => {
    const { claimedJobIds, repositories } = makeRepositories([makeJob("gen_batch_001"), makeJob("gen_batch_002")]);
    const result = await runGenerationWorkerBatch({
      ...makeBatchInput(repositories),
      maxJobs: 2,
      stopOnFailure: true,
      provider: {
        provider: "openai",
        generate: async () => {
          throw new Error("provider unavailable");
        }
      }
    });

    expect(result.completedJobs).toBe(0);
    expect(result.failedJobs).toBe(1);
    expect(result.idle).toBe(false);
    expect(result.results.map((entry) => entry.status)).toEqual(["failed"]);
    expect(claimedJobIds).toEqual(["gen_batch_001"]);
  });
});
