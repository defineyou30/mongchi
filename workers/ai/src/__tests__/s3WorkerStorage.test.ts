import { describe, expect, it } from "vitest";

import type { GenerationJob } from "@mongchi/shared";

import { createS3GenerationWorkerStorage } from "../s3WorkerStorage";

const job: GenerationJob = {
  id: "gen_worker_001",
  userId: "user_worker_001",
  petId: "pet_worker_001",
  sourcePhotoIds: ["photo_worker_001"],
  optionalPhotoIds: [],
  status: "claimed",
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

const storageOptions = {
  bucket: "tiny-pet-private",
  region: "us-east-1",
  accessKeyId: "AKIATESTACCESS",
  secretAccessKey: "test-secret-access-key",
  now: () => new Date("2026-06-24T09:00:00.000Z")
};

describe("S3 generation worker storage", () => {
  it("signs and reads original photo bytes from a private S3 URI", async () => {
    const requests: Array<{ url: string; headers: Record<string, string> }> = [];
    const storage = createS3GenerationWorkerStorage({
      ...storageOptions,
      fetch: async (url, init) => {
        requests.push({
          url,
          headers: init.headers
        });

        return {
          status: 200,
          arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer
        };
      }
    });
    const result = await storage.readOriginalPhoto({
      photo: {
        id: "photo_worker_001",
        userId: "user_worker_001",
        petId: "pet_worker_001",
        contentType: "image/png",
        byteSize: 4,
        status: "uploaded",
        storageUri: "s3://tiny-pet-private/original-photos/user_worker_001/pet_worker_001/photo_worker_001.png"
      },
      storageUri: "s3://tiny-pet-private/original-photos/user_worker_001/pet_worker_001/photo_worker_001.png"
    });

    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(result.declaredContentType).toBe("image/png");
    expect(requests).toHaveLength(1);

    const request = requests[0]!;
    const url = new URL(request.url);

    expect(url.host).toBe("tiny-pet-private.s3.us-east-1.amazonaws.com");
    expect(url.pathname).toBe("/original-photos/user_worker_001/pet_worker_001/photo_worker_001.png");
    expect(request.headers["x-amz-date"]).toBe("20260624T090000Z");
    expect(request.headers["x-amz-content-sha256"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(request.headers.Authorization).toContain("Credential=AKIATESTACCESS/20260624/us-east-1/s3/aws4_request");
    expect(request.headers.Authorization).toContain("SignedHeaders=host;x-amz-content-sha256;x-amz-date");
    expect(request.headers.Authorization).toMatch(/Signature=[a-f0-9]{64}$/);
    expect(request.headers.Authorization).not.toContain("test-secret-access-key");
  });

  it("signs and writes generated asset bytes to a private S3 URI", async () => {
    const requests: Array<{ url: string; headers: Record<string, string>; body: Uint8Array | undefined }> = [];
    const storage = createS3GenerationWorkerStorage({
      ...storageOptions,
      fetch: async (url, init) => {
        requests.push({
          url,
          headers: init.headers,
          body: init.body
        });

        return { status: 204 };
      }
    });
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const result = await storage.writeGeneratedAsset({
      job,
      asset: {
        state: "idle",
        bytes,
        width: 512,
        height: 512,
        contentHash: `sha256:${"a".repeat(64)}`,
        mimeType: "image/png",
        transparentBackground: true
      },
      contentType: "image/png"
    });

    expect(result.uri).toBe("s3://tiny-pet-private/generated-assets/user_worker_001/pet_worker_001/gen_worker_001/idle.png");
    expect(result.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(requests).toHaveLength(1);

    const request = requests[0]!;
    const url = new URL(request.url);

    expect(url.host).toBe("tiny-pet-private.s3.us-east-1.amazonaws.com");
    expect(url.pathname).toBe("/generated-assets/user_worker_001/pet_worker_001/gen_worker_001/idle.png");
    expect(request.body).toEqual(bytes);
    expect(request.headers["Content-Type"]).toBe("image/png");
    expect(request.headers["content-type"]).toBe("image/png");
    expect(request.headers["x-amz-content-sha256"]).toMatch(/^[a-f0-9]{64}$/);
    expect(request.headers.Authorization).toContain("SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date");
    expect(request.headers.Authorization).toMatch(/Signature=[a-f0-9]{64}$/);
    expect(request.headers.Authorization).not.toContain("test-secret-access-key");
  });

  it("rejects private storage reads outside the configured bucket before sending requests", async () => {
    const requests: string[] = [];
    const storage = createS3GenerationWorkerStorage({
      ...storageOptions,
      fetch: async (url) => {
        requests.push(url);

        return { status: 200 };
      }
    });

    await expect(
      storage.readOriginalPhoto({
        photo: {
          id: "photo_worker_001",
          userId: "user_worker_001",
          petId: "pet_worker_001",
          contentType: "image/png",
          byteSize: 4,
          status: "uploaded"
        },
        storageUri: "s3://other-bucket/original-photos/photo.png"
      })
    ).rejects.toThrow("Source photo storage metadata is invalid.");
    expect(requests).toEqual([]);
  });

  it("returns safe failures when S3 read or write requests fail", async () => {
    const storage = createS3GenerationWorkerStorage({
      ...storageOptions,
      fetch: async () => ({ status: 503 })
    });

    await expect(
      storage.readOriginalPhoto({
        photo: {
          id: "photo_worker_001",
          userId: "user_worker_001",
          petId: "pet_worker_001",
          contentType: "image/png",
          byteSize: 4,
          status: "uploaded"
        },
        storageUri: "s3://tiny-pet-private/original-photos/photo.png"
      })
    ).rejects.toThrow("Source photo could not be read from private storage.");

    await expect(
      storage.writeGeneratedAsset({
        job,
        asset: {
          state: "happy",
          bytes: new Uint8Array([1, 2, 3]),
          width: 512,
          height: 512,
          contentHash: `sha256:${"b".repeat(64)}`,
          mimeType: "image/webp",
          transparentBackground: true
        },
        contentType: "image/webp"
      })
    ).rejects.toThrow("Generated asset could not be written to private storage.");
  });
});
