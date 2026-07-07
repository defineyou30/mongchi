import type { PhotoUploadUrlResponse, SourcePhotoContentType } from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";

export interface SignedPhotoUploadRequest {
  sourceUri: string;
  contentType: SourcePhotoContentType;
  expectedByteSize: number | null;
  signedUpload: PhotoUploadUrlResponse;
}

export interface SignedPhotoUploadResponse {
  ok: boolean;
  status: number;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  blob?: () => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>;
  text?: () => Promise<string>;
}

export type SignedPhotoUploadFetch = (
  url: string,
  init?: {
    method?: "GET" | "PUT" | "POST";
    headers?: Record<string, string>;
    body?: ArrayBuffer;
  }
) => Promise<SignedPhotoUploadResponse>;

export type SignedPhotoUploadResult =
  | {
      ok: true;
      contentHash: string;
      byteSize: number;
      uploaded: boolean;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

const mockUploadedPhotoHash = `sha256:${"c".repeat(64)}`;

const sha256K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
] as const;

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

export const sha256Hex = (bytes: Uint8Array): string => {
  const bitLengthHigh = Math.floor(bytes.length / 0x20000000);
  const bitLengthLow = (bytes.length << 3) >>> 0;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;

  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, bitLengthHigh);
  view.setUint32(paddedLength - 4, bitLengthLow);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Array<number>(64).fill(0);

  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const base = offset + i * 4;
      words[i] =
        ((data[base]! << 24) | (data[base + 1]! << 16) | (data[base + 2]! << 8) | data[base + 3]!) >>> 0;
    }

    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(words[i - 15]!, 7) ^ rotr(words[i - 15]!, 18) ^ (words[i - 15]! >>> 3)) >>> 0;
      const s1 = (rotr(words[i - 2]!, 17) ^ rotr(words[i - 2]!, 19) ^ (words[i - 2]! >>> 10)) >>> 0;
      words[i] = (((words[i - 16]! + s0) >>> 0) + ((words[i - 7]! + s1) >>> 0)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (((((h + s1) >>> 0) + ch) >>> 0) + sha256K[i]! + words[i]!) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((value) => value.toString(16).padStart(8, "0")).join("");
};

const toMobileUploadError = (status: number, code: string, messageSafe: string, retryable = false): MobileApiError => ({
  status,
  code,
  messageSafe,
  retryable
});

const readResponseBytes = async (response: SignedPhotoUploadResponse): Promise<ArrayBuffer> => {
  if (response.arrayBuffer) {
    return response.arrayBuffer();
  }

  if (response.blob) {
    return (await response.blob()).arrayBuffer();
  }

  throw new Error("response_bytes_unavailable");
};

const isMockUpload = (sourceUri: string, uploadUrl: string): boolean =>
  sourceUri.startsWith("sample://") || uploadUrl.startsWith("mock-signed-upload://");

export const uploadSourcePhotoToSignedUrl = async (
  request: SignedPhotoUploadRequest,
  fetchImpl: SignedPhotoUploadFetch = fetch as SignedPhotoUploadFetch
): Promise<SignedPhotoUploadResult> => {
  const uploadUrl = request.signedUpload.uploadUrl.trim();

  if (isMockUpload(request.sourceUri, uploadUrl)) {
    return {
      ok: true,
      contentHash: mockUploadedPhotoHash,
      byteSize: request.expectedByteSize ?? 0,
      uploaded: false
    };
  }

  if (!/^https:\/\//i.test(uploadUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(uploadUrl)) {
    return {
      ok: false,
      error: toMobileUploadError(0, "signed_upload_url_invalid", "Photo upload link is invalid.")
    };
  }

  try {
    const source = await fetchImpl(request.sourceUri, { method: "GET" });

    if (!source.ok) {
      return {
        ok: false,
        error: toMobileUploadError(source.status, "source_photo_unreadable", "Photo could not be read from this device.", true)
      };
    }

    const bytes = await readResponseBytes(source);
    const byteSize = bytes.byteLength;

    if (byteSize <= 0) {
      return {
        ok: false,
        error: toMobileUploadError(0, "source_photo_empty", "Photo could not be read from this device.")
      };
    }

    if (byteSize > request.signedUpload.maxByteSize) {
      return {
        ok: false,
        error: toMobileUploadError(0, "photo_too_large", "Choose an image under 10 MB with your pet clearly visible.")
      };
    }

    if (request.expectedByteSize !== null && request.expectedByteSize > 0 && request.expectedByteSize !== byteSize) {
      return {
        ok: false,
        error: toMobileUploadError(0, "source_photo_size_mismatch", "Photo metadata changed. Choose the photo again.")
      };
    }

    const uploaded = await fetchImpl(uploadUrl, {
      method: request.signedUpload.uploadMethod,
      headers: {
        "Content-Type": request.contentType,
        ...request.signedUpload.uploadHeaders
      },
      body: bytes
    });

    if (!uploaded.ok) {
      return {
        ok: false,
        error: toMobileUploadError(uploaded.status, "signed_upload_failed", "Photo upload failed. Try again.", true)
      };
    }

    return {
      ok: true,
      contentHash: `sha256:${sha256Hex(new Uint8Array(bytes))}`,
      byteSize,
      uploaded: true
    };
  } catch {
    return {
      ok: false,
      error: toMobileUploadError(0, "signed_upload_network_error", "Photo upload failed. Check your connection and try again.", true)
    };
  }
};
