import { describe, expect, it } from "vitest";

import { createS3PrivateStorageObjectDeleter } from "../s3StorageDeleter";

describe("S3 private storage object deleter", () => {
  it("signs and sends idempotent S3 delete object requests", async () => {
    const requests: Array<{ url: string; headers: Record<string, string> }> = [];
    const deleter = createS3PrivateStorageObjectDeleter({
      bucket: "tiny-pet-private",
      region: "us-east-1",
      accessKeyId: "AKIATESTACCESS",
      secretAccessKey: "test-secret-access-key",
      now: () => new Date("2026-06-24T09:00:00.000Z"),
      fetch: async (url, init) => {
        requests.push({
          url,
          headers: init.headers
        });

        return { status: 204 };
      }
    });

    await expect(
      deleter.deleteObjects({
        uris: [
          "s3://tiny-pet-private/original-photos/user_demo_001/pet_miso_001/photo_original_001.png",
          "s3://tiny-pet-private/original-photos/user_demo_001/pet_miso_001/photo_original_001.png"
        ]
      })
    ).resolves.toEqual({
      ok: true,
      deletedUriCount: 1
    });

    expect(requests).toHaveLength(1);

    const request = requests[0]!;
    const url = new URL(request.url);

    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("tiny-pet-private.s3.us-east-1.amazonaws.com");
    expect(url.pathname).toBe("/original-photos/user_demo_001/pet_miso_001/photo_original_001.png");
    expect(request.headers["x-amz-date"]).toBe("20260624T090000Z");
    expect(request.headers["x-amz-content-sha256"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(request.headers.Authorization).toContain("Credential=AKIATESTACCESS/20260624/us-east-1/s3/aws4_request");
    expect(request.headers.Authorization).toContain("SignedHeaders=host;x-amz-content-sha256;x-amz-date");
    expect(request.headers.Authorization).toMatch(/Signature=[a-f0-9]{64}$/);
    expect(request.headers.Authorization).not.toContain("test-secret-access-key");
  });

  it("rejects invalid storage metadata before sending delete requests", async () => {
    const requests: string[] = [];
    const deleter = createS3PrivateStorageObjectDeleter({
      bucket: "tiny-pet-private",
      region: "us-east-1",
      accessKeyId: "AKIATESTACCESS",
      secretAccessKey: "test-secret-access-key",
      fetch: async (url) => {
        requests.push(url);

        return { status: 204 };
      }
    });

    await expect(
      deleter.deleteObjects({
        uris: ["s3://other-bucket/generated/pet_miso_001/idle.png"]
      })
    ).resolves.toEqual({
      ok: false,
      failureCode: "storage_deletion_invalid_uri",
      failureMessageSafe: "Private storage metadata is invalid."
    });
    expect(requests).toEqual([]);
  });

  it("returns safe retry metadata when S3 delete fails", async () => {
    const deleter = createS3PrivateStorageObjectDeleter({
      bucket: "tiny-pet-private",
      region: "us-east-1",
      accessKeyId: "AKIATESTACCESS",
      secretAccessKey: "test-secret-access-key",
      fetch: async () => ({ status: 503 })
    });

    await expect(
      deleter.deleteObjects({
        uris: ["s3://tiny-pet-private/generated/pet_miso_001/idle.png"]
      })
    ).resolves.toEqual({
      ok: false,
      failureCode: "storage_deletion_request_failed",
      failureMessageSafe: "Private storage deletion is queued for retry."
    });
  });
});
