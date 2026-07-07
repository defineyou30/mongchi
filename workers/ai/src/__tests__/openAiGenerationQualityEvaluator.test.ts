import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { GeneratedAssetState, GenerationJob } from "@mongchi/shared";

import type { PreparedSourcePhoto, ProviderGeneratedAsset } from "../generationWorker";
import {
  createOpenAiGenerationQualitySignalEvaluator,
  createOpenAiGenerationQualitySignalEvaluatorFromRuntimeConfig
} from "../openAiGenerationQualityEvaluator";
import type { OpenAiResponsesFetch } from "../openAiSourcePhotoSafetyClassifier";
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
  id: "gen_quality_openai_001",
  userId: "user_quality_openai_001",
  petId: "pet_quality_openai_001",
  sourcePhotoIds: ["photo_quality_openai_001"],
  optionalPhotoIds: [],
  status: "generating",
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

const sourcePhoto: PreparedSourcePhoto = {
  photoId: "photo_quality_openai_001",
  storageUri: "s3://tiny-pet-private/original/photo_quality_openai_001.png",
  contentType: "image/png",
  byteSize: sourcePng.byteLength,
  width: 800,
  height: 600,
  providerSafeBytes: sourcePng,
  metadataRemoved: false,
  warnings: []
};

const makeAsset = (state: GeneratedAssetState): ProviderGeneratedAsset => ({
  state,
  bytes: makePngBytes(512, 512),
  width: 512,
  height: 512,
  contentHash: `sha256:${state.padEnd(64, "a").slice(0, 64).replace(/[^a-f0-9]/g, "a")}`,
  mimeType: "image/png",
  transparentBackground: true,
  version: 1
});

const assets = [makeAsset("idle"), makeAsset("happy")];

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

const responseWithOutputText = (text: string) => ({
  status: 200,
  json: async () => ({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text
          }
        ]
      }
    ]
  })
});

const successfulFetch = (
  requests: Array<{ url: string; init: Parameters<OpenAiResponsesFetch>[1] }>,
  output: unknown
): OpenAiResponsesFetch => {
  const text = JSON.stringify(output);

  return async (url, init) => {
    requests.push({ url, init });

    return responseWithOutputText(text);
  };
};

describe("OpenAI generation quality evaluator", () => {
  it("evaluates generated assets through Responses vision and maps trusted asset metadata", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiResponsesFetch>[1] }> = [];
    const evaluator = createOpenAiGenerationQualitySignalEvaluator({
      apiKey: " sk-quality ",
      model: "gpt-5.5",
      baseUrl: "https://api.example.test/v1/",
      fetch: successfulFetch(requests, {
        detectedSpecies: "dog",
        petVisibilityConfidence: 0.92,
        detectedPetCount: 1,
        safetyApproved: true,
        styleMatchScore: 0.89,
        providerConfidence: 0.91,
        manualReviewRequired: false
      })
    });

    const result = await evaluator({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: ["idle", "happy"],
      assets
    });

    expect(result).toEqual({
      requestedSpecies: "dog",
      detectedSpecies: "dog",
      petVisibilityConfidence: 0.92,
      detectedPetCount: 1,
      safetyApproved: true,
      styleMatchScore: 0.89,
      providerConfidence: 0.91,
      manualReviewRequired: false,
      assets: [
        {
          state: "idle",
          width: 512,
          height: 512,
          transparentBackground: true,
          contentHash: assets[0]?.contentHash
        },
        {
          state: "happy",
          width: 512,
          height: 512,
          transparentBackground: true,
          contentHash: assets[1]?.contentHash
        }
      ]
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.example.test/v1/responses");
    expect(requests[0]?.init.headers).toEqual({
      Authorization: "Bearer sk-quality",
      "Content-Type": "application/json"
    });

    const body = JSON.parse(requests[0]?.init.body ?? "{}") as {
      model?: unknown;
      instructions?: unknown;
      store?: unknown;
      max_output_tokens?: unknown;
      input?: Array<{ content?: Array<Record<string, unknown>> }>;
      text?: { format?: Record<string, unknown> };
    };
    const content = body.input?.[0]?.content ?? [];
    const imageParts = content.filter((part) => part.type === "input_image");
    const textParts = content.filter((part) => part.type === "input_text").map((part) => String(part.text ?? ""));

    expect(body.model).toBe("gpt-5.5");
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(400);
    expect(body.instructions).toEqual(expect.stringContaining("high-resolution cozy pixel-art pet sprite style"));
    expect(body.instructions).toEqual(expect.stringContaining("source photo identity as higher priority than generic cuteness"));
    expect(body.instructions).toEqual(expect.stringContaining("look like idle/base art with only tiny color or mouth changes"));
    expect(body.instructions).toEqual(expect.stringContaining("intentional visible pixel clusters"));
    expect(body.instructions).toEqual(expect.stringContaining("floating feet"));
    expect(body.instructions).not.toEqual(expect.stringContaining("Pikibit"));
    expect(body.text?.format).toMatchObject({
      type: "json_schema",
      name: "generated_pet_quality_classification",
      strict: true
    });
    expect(textParts.join(" ")).toContain("not low-resolution 8-bit art");
    expect(textParts.join(" ")).toContain("not visually pasted onto the home scene");
    expect(imageParts).toHaveLength(3);
    expect(imageParts.every((part) => typeof part.image_url === "string" && part.image_url.startsWith("data:image/png;base64,"))).toBe(
      true
    );
    expect(imageParts.every((part) => part.detail === "low")).toBe(true);
  });

  it("uses the runtime safety model before the generation model", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiResponsesFetch>[1] }> = [];
    const evaluator = createOpenAiGenerationQualitySignalEvaluatorFromRuntimeConfig(
      makeRuntimeConfig({
        provider: "openai",
        apiKey: "runtime-quality-key",
        model: "avatar-generation-model",
        safetyModel: "vision-quality-model"
      }),
      {
        fetch: successfulFetch(requests, {
          detectedSpecies: "unknown",
          petVisibilityConfidence: 1.3,
          detectedPetCount: 1.9,
          safetyApproved: true,
          styleMatchScore: -1,
          providerConfidence: 0.75,
          manualReviewRequired: true
        })
      }
    );

    const result = await evaluator({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: ["idle"],
      assets: [assets[0] ?? makeAsset("idle")]
    });
    const body = JSON.parse(requests[0]?.init.body ?? "{}") as { model?: unknown };

    expect(body.model).toBe("vision-quality-model");
    expect(result.detectedSpecies).toBeUndefined();
    expect(result.petVisibilityConfidence).toBe(1);
    expect(result.detectedPetCount).toBe(1);
    expect(result.styleMatchScore).toBe(0);
    expect(result.manualReviewRequired).toBe(true);
  });

  it("fails safely when runtime config is not configured for OpenAI", () => {
    expect(() => createOpenAiGenerationQualitySignalEvaluatorFromRuntimeConfig(makeRuntimeConfig(null))).toThrow(
      "Worker runtime config is missing OpenAI provider settings."
    );
  });

  it("handles model refusals as manual-review quality signals", async () => {
    const evaluator = createOpenAiGenerationQualitySignalEvaluator({
      apiKey: "sk-quality",
      fetch: async () => ({
        status: 200,
        json: async () => ({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "refusal",
                  refusal: "Cannot evaluate this image."
                }
              ]
            }
          ]
        })
      })
    });

    const result = await evaluator({
      job,
      sourcePhotos: [sourcePhoto],
      requiredAssetStates: ["idle"],
      assets: [assets[0] ?? makeAsset("idle")]
    });

    expect(result).toMatchObject({
      requestedSpecies: "dog",
      petVisibilityConfidence: 0,
      detectedPetCount: 0,
      safetyApproved: false,
      styleMatchScore: 0,
      providerConfidence: 0,
      manualReviewRequired: true
    });
    expect(result.assets).toHaveLength(1);
  });

  it("rejects empty asset sets before provider fetch", async () => {
    let called = false;
    const evaluator = createOpenAiGenerationQualitySignalEvaluator({
      apiKey: "sk-quality",
      fetch: async () => {
        called = true;

        return responseWithOutputText("{}");
      }
    });

    await expect(
      evaluator({
        job,
        sourcePhotos: [sourcePhoto],
        requiredAssetStates: ["idle"],
        assets: []
      })
    ).rejects.toThrow("OpenAI generation quality evaluator requires at least one generated asset.");
    expect(called).toBe(false);
  });

  it("maps provider and malformed payload failures to safe errors", async () => {
    const failingEvaluator = createOpenAiGenerationQualitySignalEvaluator({
      apiKey: "sk-quality",
      fetch: async () => ({
        status: 500,
        json: async () => ({
          error: "raw provider details"
        })
      })
    });
    const malformedEvaluator = createOpenAiGenerationQualitySignalEvaluator({
      apiKey: "sk-quality",
      fetch: async () => ({
        status: 200,
        json: async () => ({
          output: []
        })
      })
    });
    const invalidJsonEvaluator = createOpenAiGenerationQualitySignalEvaluator({
      apiKey: "sk-quality",
      fetch: async () => responseWithOutputText("{not-json")
    });

    await expect(
      failingEvaluator({
        job,
        sourcePhotos: [sourcePhoto],
        requiredAssetStates: ["idle"],
        assets: [assets[0] ?? makeAsset("idle")]
      })
    ).rejects.toThrow("OpenAI generation quality request failed.");
    await expect(
      malformedEvaluator({
        job,
        sourcePhotos: [sourcePhoto],
        requiredAssetStates: ["idle"],
        assets: [assets[0] ?? makeAsset("idle")]
      })
    ).rejects.toThrow("OpenAI generation quality response did not include classification JSON.");
    await expect(
      invalidJsonEvaluator({
        job,
        sourcePhotos: [sourcePhoto],
        requiredAssetStates: ["idle"],
        assets: [assets[0] ?? makeAsset("idle")]
      })
    ).rejects.toThrow("OpenAI generation quality classification was not valid.");
  });
});
