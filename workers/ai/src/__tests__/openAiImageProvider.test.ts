import { deflateSync } from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import { generatedAssetStates, type GeneratedAssetState, type GenerationJob } from "@mongchi/shared";

import type { PreparedSourcePhoto, ProviderGeneratedAsset } from "../generationWorker";
import {
  createOpenAiImageEditProvider,
  createOpenAiImageEditProviderFromRuntimeConfig,
  type OpenAiImageProviderFetch
} from "../openAiImageProvider";
import type { ProviderGenerationQualitySignals } from "../qualityGate";
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
  id: "gen_openai_provider_001",
  userId: "user_openai_provider_001",
  petId: "pet_openai_provider_001",
  sourcePhotoIds: ["photo_openai_provider_001"],
  optionalPhotoIds: [],
  status: "queued",
  inputSnapshot: {
    species: "dog",
    petName: "Bori",
    personalityTags: ["playful"],
    talkingStyle: "cute"
  },
  provider: "openai",
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

const sourcePng = makePngBytes();
const outputPng = makePngBytes(512, 512);

const sourcePhoto: PreparedSourcePhoto = {
  photoId: "photo_openai_provider_001",
  storageUri: "s3://tiny-pet-private/original/photo_openai_provider_001.png",
  contentType: "image/png",
  byteSize: sourcePng.byteLength,
  width: 800,
  height: 600,
  providerSafeBytes: sourcePng,
  metadataRemoved: false,
  warnings: []
};

const makeQualitySignals = (assets: readonly ProviderGeneratedAsset[]): ProviderGenerationQualitySignals => ({
  requestedSpecies: "dog",
  detectedSpecies: "dog",
  petVisibilityConfidence: 0.95,
  detectedPetCount: 1,
  safetyApproved: true,
  styleMatchScore: 0.93,
  providerConfidence: 0.91,
  assets: assets.map((asset) => ({
    state: asset.state,
    width: asset.width,
    height: asset.height,
    transparentBackground: asset.transparentBackground,
    contentHash: asset.contentHash
  }))
});

const readFormText = (body: FormData, key: string): string => {
  const value = body.get(key);

  if (typeof value !== "string") {
    throw new Error(`Expected ${key} form value to be text.`);
  }

  return value;
};

const readFormImage = (body: FormData): Blob => {
  const value = body.get("image");

  if (!(value instanceof Blob)) {
    throw new Error("Expected image form value to be a Blob.");
  }

  return value;
};

const successfulFetch = (
  requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }>,
  tokens = 7
): OpenAiImageProviderFetch => {
  const b64 = Buffer.from(outputPng).toString("base64");

  return async (url, init) => {
    requests.push({ url, init });

    return {
      status: 200,
      json: async () => ({
        data: [
          {
            b64_json: b64
          }
        ],
        usage: {
          total_tokens: tokens
        }
      })
    };
  };
};

const makeRuntimeConfig = (provider: WorkerRuntimeConfig["provider"]): WorkerRuntimeConfig => ({
  releaseProfile: "production",
  production: true,
  database: null,
  storage: null,
  provider,
  qualityGate: {
    minimumPetVisibilityConfidence: 0.72,
    minimumStyleMatchScore: 0.7,
    minimumProviderConfidence: 0.68
  },
  maxJobsPerRun: 1
});

describe("OpenAI image edit provider", () => {
  it("sends source photos to image edits and converts base64 outputs into generated assets", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }> = [];
    const qualitySignalEvaluator = vi.fn(({ assets }: { assets: readonly ProviderGeneratedAsset[] }) => makeQualitySignals(assets));
    const provider = createOpenAiImageEditProvider({
      apiKey: " sk-test-openai ",
      model: "gpt-image-1.5",
      baseUrl: "https://api.example.test/v1/",
      fetch: successfulFetch(requests),
      promptBuilder: ({ state }) => `tiny pet sprite for ${state}`,
      qualitySignalEvaluator
    });
    const requiredAssetStates: readonly GeneratedAssetState[] = ["idle", "happy"];

    const result = await provider.generate({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates
    });

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.url)).toEqual([
      "https://api.example.test/v1/images/edits",
      "https://api.example.test/v1/images/edits"
    ]);

    requests.forEach((request, index) => {
      const body = request.init.body;

      expect(request.init.method).toBe("POST");
      expect(request.init.headers).toEqual({
        Authorization: "Bearer sk-test-openai"
      });
      expect(readFormText(body, "model")).toBe("gpt-image-1.5");
      expect(readFormText(body, "prompt")).toBe(`tiny pet sprite for ${requiredAssetStates[index]}`);
      expect(readFormText(body, "n")).toBe("1");
      expect(readFormText(body, "size")).toBe("1024x1024");
      expect(readFormText(body, "quality")).toBe("low");
      expect(readFormText(body, "background")).toBe("transparent");
      expect(readFormText(body, "output_format")).toBe("png");
      expect(body.getAll("image")).toHaveLength(1);
      expect(readFormImage(body).type).toBe("image/png");
    });

    expect(result.provider).toBe("openai");
    expect(result.costUnits).toBe(14);
    expect(result.assets).toHaveLength(2);
    expect(result.assets.map((asset) => asset.state)).toEqual(["idle", "happy"]);
    expect(result.assets.every((asset) => asset.width === 512 && asset.height === 512)).toBe(true);
    expect(result.assets.every((asset) => asset.mimeType === "image/png" && asset.transparentBackground)).toBe(true);
    expect(result.assets.every((asset) => /^sha256:[a-f0-9]{64}$/.test(asset.contentHash))).toBe(true);
    expect(result.qualitySignals.assets.map((asset) => asset.state)).toEqual(["idle", "happy"]);
    expect(qualitySignalEvaluator).toHaveBeenCalledTimes(1);
    expect(qualitySignalEvaluator.mock.calls[0]?.[0]).toMatchObject({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates
    });
  });

  it("creates a provider from worker runtime config without exposing API settings to callers", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }> = [];
    const provider = createOpenAiImageEditProviderFromRuntimeConfig(
      makeRuntimeConfig({
        provider: "openai",
        apiKey: "runtime-openai-key",
        model: "runtime-image-model"
      }),
      {
        fetch: successfulFetch(requests, 3),
        qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets)
      }
    );

    const result = await provider.generate({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: ["idle"]
    });

    expect(result.costUnits).toBe(3);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.init.headers).toEqual({
      Authorization: "Bearer runtime-openai-key"
    });
    expect(readFormText(requests[0]?.init.body ?? new FormData(), "model")).toBe("runtime-image-model");
  });

  it("uses the default art-direction prompt when no custom prompt builder is provided", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }> = [];
    const provider = createOpenAiImageEditProvider({
      apiKey: "sk-test-openai",
      fetch: successfulFetch(requests),
      qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets)
    });

    await provider.generate({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: ["garden_help"]
    });

    const prompt = readFormText(requests[0]?.init.body ?? new FormData(), "prompt");

    expect(prompt).toContain("Use the provided dog or cat photo as the identity reference");
    expect(prompt).toContain("Reference photo count: 1");
    expect(prompt).toContain("Requested state: garden_help");
    expect(prompt).toContain("do not replace the pet with a generic cute dog/cat");
    expect(prompt).toContain("State uniqueness contract");
    expect(prompt).toContain("lush full-screen miniature garden home");
    expect(prompt).toContain("high-resolution cozy pixel-art pet sprite");
    expect(prompt).toContain("polished modern pixel pet sprite");
    expect(prompt).toContain("intentional visible pixel clusters");
    expect(prompt).toContain("floating feet");
    expect(prompt).not.toContain("Pikibit");
  });

  it("builds the default art-direction prompt for every required pet state", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }> = [];
    const provider = createOpenAiImageEditProvider({
      apiKey: "sk-test-openai",
      fetch: successfulFetch(requests),
      qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets)
    });

    await provider.generate({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: generatedAssetStates
    });

    expect(requests).toHaveLength(generatedAssetStates.length);

    for (const [index, state] of generatedAssetStates.entries()) {
      const prompt = readFormText(requests[index]?.init.body ?? new FormData(), "prompt");

      expect(prompt).toContain(`Requested state: ${state}`);
      expect(prompt).toContain("Source-photo markings and proportions win over generic cuteness.");
      expect(prompt).toContain("do not output idle/base art with only tiny color changes.");
      expect(prompt).toContain("same species, proportions, face identity, markings, scale, and bottom-center paw/contact anchor");
      expect(prompt).toContain("transparent background");
      expect(prompt).toContain("high-resolution cozy pixel-art pet sprite");
      expect(prompt).toContain("intentional visible pixel clusters");
      expect(prompt).toContain("photo cutout");
    }
  });

  it("fails safely when runtime config is not configured for OpenAI", () => {
    expect(() =>
      createOpenAiImageEditProviderFromRuntimeConfig(makeRuntimeConfig(null), {
        fetch: async () => ({
          status: 200,
          json: async () => ({})
        }),
        qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets)
      })
    ).toThrow("Worker runtime config is missing OpenAI provider settings.");
  });

  it("rejects requests without source photos before provider fetch", async () => {
    const fetch = vi.fn<OpenAiImageProviderFetch>();
    const provider = createOpenAiImageEditProvider({
      apiKey: "sk-test-openai",
      fetch,
      qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets)
    });

    await expect(
      provider.generate({
        job,
        sourcePhotos: [],
        requiredAssetStates: ["idle"]
      })
    ).rejects.toThrow("OpenAI image provider requires at least one source photo.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps provider failures and malformed payloads to safe worker errors", async () => {
    const failingProvider = createOpenAiImageEditProvider({
      apiKey: "sk-test-openai",
      fetch: async () => ({
        status: 429,
        json: async () => ({
          error: "raw provider quota details"
        })
      }),
      qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets)
    });
    const malformedProvider = createOpenAiImageEditProvider({
      apiKey: "sk-test-openai",
      fetch: async () => ({
        status: 200,
        json: async () => ({
          data: [{}]
        })
      }),
      qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets)
    });

    await expect(
      failingProvider.generate({
        job,
        sourcePhotos: [sourcePhoto],
        requiredAssetStates: ["idle"]
      })
    ).rejects.toThrow("OpenAI image provider request failed.");
    await expect(
      malformedProvider.generate({
        job,
        sourcePhotos: [sourcePhoto],
        requiredAssetStates: ["idle"]
      })
    ).rejects.toThrow("OpenAI image response did not include base64 image data.");
  });

  it("packs 4 states into a 2x2 sheet and slices per-state assets when statesPerSheet is set", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }> = [];
    const sheetPng = makePngBytes(1024, 1024);
    const sheetFetch: OpenAiImageProviderFetch = async (url, init) => {
      requests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          data: [{ b64_json: Buffer.from(sheetPng).toString("base64") }],
          usage: { total_tokens: 11 }
        })
      };
    };
    const provider = createOpenAiImageEditProvider({
      apiKey: "sk-test-openai",
      fetch: sheetFetch,
      qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets),
      statesPerSheet: 4
    });
    const states: readonly GeneratedAssetState[] = ["idle", "happy", "sleep", "hungry", "sad"];

    const result = await provider.generate({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: states
    });

    // 5 states with statesPerSheet=4 -> one 2x2 sheet call + one single-state call.
    expect(requests).toHaveLength(2);

    const sheetBody = requests[0]?.init.body ?? new FormData();
    const sheetPrompt = readFormText(sheetBody, "prompt");

    expect(readFormText(sheetBody, "size")).toBe("1024x1024");
    expect(sheetPrompt).toContain("2x2 character state sheet");
    expect(sheetPrompt).toContain("Cell 1 (idle)");
    expect(sheetPrompt).toContain("Cell 4 (hungry)");
    expect(sheetPrompt).toContain("No grid lines");
    expect(readFormText(requests[1]?.init.body ?? new FormData(), "prompt")).toContain("Requested state: sad");

    expect(result.assets.map((asset) => asset.state)).toEqual([...states]);
    expect(result.assets.slice(0, 4).every((asset) => asset.width === 512 && asset.height === 512)).toBe(true);
    expect(result.assets.every((asset) => /^sha256:[a-f0-9]{64}$/.test(asset.contentHash))).toBe(true);
    expect(result.costUnits).toBe(22);
  });

  it("uses a 3x2 sheet layout with wide output size for 6 states per sheet", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiImageProviderFetch>[1] }> = [];
    const sheetPng = makePngBytes(1536, 1024);
    const sheetFetch: OpenAiImageProviderFetch = async (url, init) => {
      requests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          data: [{ b64_json: Buffer.from(sheetPng).toString("base64") }]
        })
      };
    };
    const provider = createOpenAiImageEditProvider({
      apiKey: "sk-test-openai",
      fetch: sheetFetch,
      qualitySignalEvaluator: ({ assets }) => makeQualitySignals(assets),
      statesPerSheet: 6
    });
    const states: readonly GeneratedAssetState[] = ["idle", "happy", "sleep", "hungry", "sad", "messy"];

    const result = await provider.generate({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: states
    });

    expect(requests).toHaveLength(1);
    expect(readFormText(requests[0]?.init.body ?? new FormData(), "size")).toBe("1536x1024");
    expect(result.assets).toHaveLength(6);
    expect(result.assets.every((asset) => asset.width === 512 && asset.height === 512)).toBe(true);
  });
});
