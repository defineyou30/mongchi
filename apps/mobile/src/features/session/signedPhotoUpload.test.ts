import { describe, expect, it } from "vitest";

import { sha256Hex, uploadSourcePhotoToSignedUrl } from "./signedPhotoUpload";
import type { SignedPhotoUploadFetch } from "./signedPhotoUpload";

const toArrayBuffer = (bytes: number[]): ArrayBuffer => {
  const array = new Uint8Array(bytes);
  return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
};

describe("signed photo upload transport", () => {
  it("computes SHA-256 hashes for uploaded bytes", () => {
    expect(sha256Hex(new Uint8Array([97, 98, 99]))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("skips network upload for sample photos and mock signed URLs", async () => {
    const result = await uploadSourcePhotoToSignedUrl({
      sourceUri: "sample://mongchi/pet-photo.png",
      contentType: "image/png",
      expectedByteSize: 4096,
      signedUpload: {
        photoId: "photo_001",
        uploadUrl: "mock-signed-upload://private/user_demo_001/pet_001/photo_001",
        uploadMethod: "PUT",
        uploadHeaders: {
          "Content-Type": "image/png"
        },
        expiresAt: "2026-06-24T09:15:00.000Z",
        maxByteSize: 10 * 1024 * 1024
      }
    });

    expect(result).toEqual({
      ok: true,
      contentHash: `sha256:${"c".repeat(64)}`,
      byteSize: 4096,
      uploaded: false
    });
  });

  it("uploads source bytes to HTTPS signed URLs with declared headers", async () => {
    const calls: Array<{ url: string; init: { method?: string; headers?: Record<string, string>; body?: ArrayBuffer } | undefined }> =
      [];
    const sourceBytes = toArrayBuffer([97, 98, 99]);
    const fetchImpl: SignedPhotoUploadFetch = async (url, init) => {
      calls.push({ url, init });

      if (url === "file://pet.png") {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => sourceBytes
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () => ""
      };
    };

    const result = await uploadSourcePhotoToSignedUrl(
      {
        sourceUri: "file://pet.png",
        contentType: "image/png",
        expectedByteSize: 3,
        signedUpload: {
          photoId: "photo_001",
          uploadUrl: "https://storage.example.com/upload/photo_001",
          uploadMethod: "PUT",
          uploadHeaders: {
            "Content-Type": "image/png",
            "x-upload-token": "signed"
          },
          expiresAt: "2026-06-24T09:15:00.000Z",
          maxByteSize: 10
        }
      },
      fetchImpl
    );

    expect(result).toEqual({
      ok: true,
      contentHash: "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      byteSize: 3,
      uploaded: true
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      url: "https://storage.example.com/upload/photo_001",
      init: {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
          "x-upload-token": "signed"
        }
      }
    });
    expect(calls[1]?.init?.body?.byteLength).toBe(3);
  });

  it("rejects invalid signed URLs and changed local photo metadata", async () => {
    const invalidUrl = await uploadSourcePhotoToSignedUrl({
      sourceUri: "file://pet.png",
      contentType: "image/png",
      expectedByteSize: 3,
      signedUpload: {
        photoId: "photo_001",
        uploadUrl: "ftp://storage.example.com/upload/photo_001",
        uploadMethod: "PUT",
        uploadHeaders: {},
        expiresAt: "2026-06-24T09:15:00.000Z",
        maxByteSize: 10
      }
    });
    const sizeMismatch = await uploadSourcePhotoToSignedUrl(
      {
        sourceUri: "file://pet.png",
        contentType: "image/png",
        expectedByteSize: 99,
        signedUpload: {
          photoId: "photo_001",
          uploadUrl: "https://storage.example.com/upload/photo_001",
          uploadMethod: "PUT",
          uploadHeaders: {},
          expiresAt: "2026-06-24T09:15:00.000Z",
          maxByteSize: 10
        }
      },
      async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer([97, 98, 99])
      })
    );

    expect(invalidUrl).toMatchObject({
      ok: false,
      error: {
        code: "signed_upload_url_invalid"
      }
    });
    expect(sizeMismatch).toMatchObject({
      ok: false,
      error: {
        code: "source_photo_size_mismatch"
      }
    });
  });
});
