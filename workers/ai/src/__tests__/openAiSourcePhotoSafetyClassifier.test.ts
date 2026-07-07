import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { GenerationJob } from "@mongchi/shared";

import {
  createOpenAiSourcePhotoSafetyCheckerFromRuntimeConfig,
  createOpenAiSourcePhotoSafetyClassifier,
  createOpenAiSourcePhotoSafetyClassifierFromRuntimeConfig,
  type OpenAiResponsesFetch
} from "../openAiSourcePhotoSafetyClassifier";
import type { SourcePhotoSafetyInputPhoto } from "../sourcePhotoSafety";
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
  id: "gen_source_safety_openai_001",
  userId: "user_source_safety_openai_001",
  petId: "pet_source_safety_openai_001",
  sourcePhotoIds: ["photo_source_safety_openai_001"],
  optionalPhotoIds: [],
  status: "safety_checking",
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

const photoBytes = makePngBytes();

const sourcePhoto: SourcePhotoSafetyInputPhoto = {
  photoId: "photo_source_safety_openai_001",
  contentType: "image/png",
  byteSize: photoBytes.byteLength,
  width: 800,
  height: 600,
  providerSafeBytes: photoBytes,
  metadataRemoved: false,
  warnings: []
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

describe("OpenAI source photo safety classifier", () => {
  it("sends a source image through Responses vision and returns an approved classification", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiResponsesFetch>[1] }> = [];
    const classifier = createOpenAiSourcePhotoSafetyClassifier({
      apiKey: " sk-source-safety ",
      model: "gpt-5.5",
      baseUrl: "https://api.example.test/v1/",
      fetch: successfulFetch(requests, {
        safetyApproved: true,
        manualReviewRequired: false,
        confidence: 0.87,
        failedChecks: [],
        warnings: ["clear_pet_source_photo"]
      })
    });

    const result = await classifier.classifySourcePhoto({
      job,
      sourcePhoto
    });

    expect(result).toEqual({
      safetyApproved: true,
      manualReviewRequired: false,
      confidence: 0.87,
      failedChecks: [],
      warnings: ["clear_pet_source_photo"]
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.example.test/v1/responses");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.headers).toEqual({
      Authorization: "Bearer sk-source-safety",
      "Content-Type": "application/json"
    });

    const body = JSON.parse(requests[0]?.init.body ?? "{}") as {
      model?: unknown;
      store?: unknown;
      max_output_tokens?: unknown;
      input?: Array<{ content?: Array<Record<string, unknown>> }>;
      text?: { format?: Record<string, unknown> };
    };
    const content = body.input?.[0]?.content ?? [];
    const inputImage = content.find((part) => part.type === "input_image");

    expect(body.model).toBe("gpt-5.5");
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(300);
    expect(body.text?.format).toMatchObject({
      type: "json_schema",
      name: "source_photo_safety_classification",
      strict: true
    });
    expect(inputImage?.image_url).toEqual(expect.stringMatching(/^data:image\/png;base64,/));
    expect(inputImage?.detail).toBe("low");
  });

  it("normalizes unsafe check ids and clamps confidence", async () => {
    const classifier = createOpenAiSourcePhotoSafetyClassifier({
      apiKey: "sk-source-safety",
      fetch: successfulFetch([], {
        safetyApproved: false,
        manualReviewRequired: false,
        confidence: 1.4,
        failedChecks: [" Source photo PERSON visible!! "],
        warnings: [" Needs review "]
      })
    });

    await expect(
      classifier.classifySourcePhoto({
        job,
        sourcePhoto
      })
    ).resolves.toEqual({
      safetyApproved: false,
      manualReviewRequired: false,
      confidence: 1,
      failedChecks: ["source_photo_person_visible"],
      warnings: ["needs_review"]
    });
  });

  it("uses the runtime safety model before the generation model and composes a safety checker", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiResponsesFetch>[1] }> = [];
    const checker = createOpenAiSourcePhotoSafetyCheckerFromRuntimeConfig(
      makeRuntimeConfig({
        provider: "openai",
        apiKey: "runtime-source-safety-key",
        model: "avatar-generation-model",
        safetyModel: "source-safety-model"
      }),
      {
        fetch: successfulFetch(requests, {
          safetyApproved: false,
          manualReviewRequired: true,
          confidence: 0.42,
          failedChecks: ["source_photo_manual_review_required"],
          warnings: []
        })
      }
    );

    const result = await checker.checkSourcePhotos({
      job,
      sourcePhotos: [sourcePhoto]
    });
    const body = JSON.parse(requests[0]?.init.body ?? "{}") as { model?: unknown };

    expect(body.model).toBe("source-safety-model");
    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected manual review result.");
    }

    expect(result.failureCode).toBe("source_photo_manual_review_required");
    expect(result.quality.failedChecks).toEqual(["source_photo_manual_review_required"]);
  });

  it("fails safely when runtime config is not configured for OpenAI", () => {
    expect(() => createOpenAiSourcePhotoSafetyClassifierFromRuntimeConfig(makeRuntimeConfig(null))).toThrow(
      "Worker runtime config is missing OpenAI provider settings."
    );
  });

  it("handles model refusals as manual review classifications", async () => {
    const classifier = createOpenAiSourcePhotoSafetyClassifier({
      apiKey: "sk-source-safety",
      fetch: async () => ({
        status: 200,
        json: async () => ({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "refusal",
                  refusal: "Cannot classify this image."
                }
              ]
            }
          ]
        })
      })
    });

    await expect(
      classifier.classifySourcePhoto({
        job,
        sourcePhoto
      })
    ).resolves.toEqual({
      safetyApproved: false,
      manualReviewRequired: true,
      confidence: 0,
      failedChecks: ["source_photo_safety_model_refusal"],
      warnings: []
    });
  });

  it("maps provider and malformed payload failures to safe errors", async () => {
    const failingClassifier = createOpenAiSourcePhotoSafetyClassifier({
      apiKey: "sk-source-safety",
      fetch: async () => ({
        status: 500,
        json: async () => ({
          error: "raw provider details"
        })
      })
    });
    const malformedClassifier = createOpenAiSourcePhotoSafetyClassifier({
      apiKey: "sk-source-safety",
      fetch: async () => ({
        status: 200,
        json: async () => ({
          output: []
        })
      })
    });
    const invalidJsonClassifier = createOpenAiSourcePhotoSafetyClassifier({
      apiKey: "sk-source-safety",
      fetch: async () => responseWithOutputText("{not-json")
    });

    await expect(
      failingClassifier.classifySourcePhoto({
        job,
        sourcePhoto
      })
    ).rejects.toThrow("OpenAI source photo safety request failed.");
    await expect(
      malformedClassifier.classifySourcePhoto({
        job,
        sourcePhoto
      })
    ).rejects.toThrow("OpenAI source photo safety response did not include classification JSON.");
    await expect(
      invalidJsonClassifier.classifySourcePhoto({
        job,
        sourcePhoto
      })
    ).rejects.toThrow("OpenAI source photo safety classification was not valid.");
  });
});
