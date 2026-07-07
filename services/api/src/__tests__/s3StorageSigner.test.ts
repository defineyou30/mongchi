import { describe, expect, it } from "vitest";

import { createS3PrivateStorageSigner } from "../s3StorageSigner";

const signer = createS3PrivateStorageSigner({
  bucket: "tiny-pet-private",
  region: "us-east-1",
  accessKeyId: "AKIATESTACCESS",
  secretAccessKey: "test-secret-access-key",
  now: () => new Date("2026-06-24T09:00:00.000Z")
});

const getQuery = (url: string) => Object.fromEntries(new URL(url).searchParams.entries());

describe("S3 private storage signer", () => {
  it("creates S3-compatible signed upload URLs and internal storage URIs", async () => {
    const result = await signer.createOriginalPhotoUpload({
      userId: "user_demo_001",
      petId: "pet_miso_001",
      photoId: "photo_original_001",
      contentType: "image/png",
      byteSize: 4096,
      expiresAt: "2026-06-24T09:15:00.000Z",
      maxByteSize: 10_485_760
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.messageSafe);
    }

    const signedUrl = new URL(result.signed.uploadUrl);
    const query = getQuery(result.signed.uploadUrl);

    expect(result.signed.uploadMethod).toBe("PUT");
    expect(result.signed.uploadHeaders).toEqual({
      "Content-Type": "image/png"
    });
    expect(result.signed.storageUri).toBe("s3://tiny-pet-private/original-photos/user_demo_001/pet_miso_001/photo_original_001.png");
    expect(signedUrl.protocol).toBe("https:");
    expect(signedUrl.host).toBe("tiny-pet-private.s3.us-east-1.amazonaws.com");
    expect(signedUrl.pathname).toBe("/original-photos/user_demo_001/pet_miso_001/photo_original_001.png");
    expect(query["X-Amz-Algorithm"]).toBe("AWS4-HMAC-SHA256");
    expect(query["X-Amz-Credential"]).toBe("AKIATESTACCESS/20260624/us-east-1/s3/aws4_request");
    expect(query["X-Amz-Date"]).toBe("20260624T090000Z");
    expect(query["X-Amz-Expires"]).toBe("900");
    expect(query["X-Amz-SignedHeaders"]).toBe("content-type;host");
    expect(query["X-Amz-Signature"]).toMatch(/^[a-f0-9]{64}$/);
    expect(result.signed.uploadUrl).not.toContain("test-secret-access-key");
  });

  it("creates signed read URLs for private generated S3 asset URIs", async () => {
    const result = await signer.createGeneratedAssetRead({
      userId: "user_demo_001",
      petId: "pet_miso_001",
      assetId: "asset_idle_001",
      assetUri: "s3://tiny-pet-private/generated/pet_miso_001/gen_001/idle.png",
      contentHash: `sha256:${"a".repeat(64)}`,
      contentType: "image/png",
      storageClass: "private_app_asset",
      expiresAt: "2026-06-24T09:10:00.000Z"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.messageSafe);
    }

    const signedUrl = new URL(result.signed.signedUrl);
    const query = getQuery(result.signed.signedUrl);

    expect(result.signed.contentType).toBe("image/png");
    expect(signedUrl.host).toBe("tiny-pet-private.s3.us-east-1.amazonaws.com");
    expect(signedUrl.pathname).toBe("/generated/pet_miso_001/gen_001/idle.png");
    expect(query["X-Amz-SignedHeaders"]).toBe("host");
    expect(query["X-Amz-Expires"]).toBe("600");
    expect(query["X-Amz-Signature"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects asset URIs outside the configured bucket and expired signing windows", async () => {
    const wrongBucket = await signer.createGeneratedAssetRead({
      userId: "user_demo_001",
      petId: "pet_miso_001",
      assetId: "asset_idle_001",
      assetUri: "s3://other-bucket/generated/pet_miso_001/gen_001/idle.png",
      contentHash: `sha256:${"a".repeat(64)}`,
      contentType: "image/png",
      storageClass: "private_app_asset",
      expiresAt: "2026-06-24T09:10:00.000Z"
    });
    const expired = await signer.createOriginalPhotoUpload({
      userId: "user_demo_001",
      petId: "pet_miso_001",
      photoId: "photo_original_001",
      contentType: "image/jpeg",
      byteSize: 4096,
      expiresAt: "2026-06-24T08:59:59.000Z",
      maxByteSize: 10_485_760
    });

    expect(wrongBucket).toEqual({
      ok: false,
      error: {
        status: 422,
        code: "storage_asset_uri_invalid",
        messageSafe: "Generated asset storage metadata is invalid."
      }
    });
    expect(expired).toEqual({
      ok: false,
      error: {
        status: 422,
        code: "storage_signing_expired",
        messageSafe: "Private storage signing expiry is invalid."
      }
    });
  });
});
