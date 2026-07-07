import { createHmac, createHash } from "node:crypto";

import type { ApiRuntimeConfig } from "./apiRuntimeConfig";
import type {
  GeneratedAssetReadSigningInput,
  GeneratedAssetReadSigningResult,
  OriginalPhotoUploadSigningInput,
  OriginalPhotoUploadSigningResult,
  PrivateStorageSigner,
  PrivateStorageSigningResult
} from "./storageSigner";

export interface S3PrivateStorageSignerOptions {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  originalPhotoPrefix?: string;
  maxPresignSeconds?: number;
  now?: () => Date;
}

type HttpMethod = "GET" | "PUT";

interface PresignInput {
  method: HttpMethod;
  key: string;
  expiresAt: string;
  headers?: Record<string, string>;
}

const awsAlgorithm = "AWS4-HMAC-SHA256";
const maxS3PresignSeconds = 7 * 24 * 60 * 60;
const unsignedPayload = "UNSIGNED-PAYLOAD";

const s3SafeSegment = (value: string): string => value.replace(/[^A-Za-z0-9_.-]/g, "_");

const hmac = (key: Buffer | string, value: string): Buffer => createHmac("sha256", key).update(value, "utf8").digest();
const sha256Hex = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const toDateStamp = (date: Date): string => date.toISOString().slice(0, 10).replace(/-/g, "");
const toAmzDate = (date: Date): string => `${toDateStamp(date)}T${date.toISOString().slice(11, 19).replace(/:/g, "")}Z`;

const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const normalizePrefix = (value: string | undefined): string => (value ?? "original-photos").replace(/^\/+|\/+$/g, "");

const extensionForContentType = (contentType: OriginalPhotoUploadSigningInput["contentType"]): string => {
  if (contentType === "image/jpeg") {
    return "jpg";
  }

  if (contentType === "image/png") {
    return "png";
  }

  return "webp";
};

const buildOriginalPhotoKey = (input: OriginalPhotoUploadSigningInput, prefix: string): string =>
  [
    prefix,
    s3SafeSegment(input.userId),
    s3SafeSegment(input.petId),
    `${s3SafeSegment(input.photoId)}.${extensionForContentType(input.contentType)}`
  ].join("/");

const parseS3Uri = (value: string): { bucket: string; key: string } | null => {
  if (!value.startsWith("s3://")) {
    return null;
  }

  const withoutScheme = value.slice("s3://".length);
  const separatorIndex = withoutScheme.indexOf("/");

  if (separatorIndex <= 0 || separatorIndex === withoutScheme.length - 1) {
    return null;
  }

  return {
    bucket: withoutScheme.slice(0, separatorIndex),
    key: withoutScheme.slice(separatorIndex + 1)
  };
};

const success = <T>(signed: T): PrivateStorageSigningResult<T> => ({
  ok: true,
  signed
});

const signingUnavailable = <T>(messageSafe = "Private storage signing is not available yet."): PrivateStorageSigningResult<T> => ({
  ok: false,
  error: {
    status: 503,
    code: "storage_signing_unavailable",
    messageSafe
  }
});

const signingInvalid = <T>(code: string, messageSafe: string): PrivateStorageSigningResult<T> => ({
  ok: false,
  error: {
    status: 422,
    code,
    messageSafe
  }
});

const normalizeEndpoint = (region: string, endpoint: string | undefined): URL => {
  if (endpoint) {
    return new URL(endpoint);
  }

  return new URL(`https://s3.${region}.amazonaws.com`);
};

const normalizeHeaderValue = (value: string): string => value.trim().replace(/\s+/g, " ");

const createSigningKey = (secretAccessKey: string, dateStamp: string, region: string): Buffer => {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, "s3");

  return hmac(dateRegionServiceKey, "aws4_request");
};

export const createS3PrivateStorageSigner = (options: S3PrivateStorageSignerOptions): PrivateStorageSigner => {
  const bucket = options.bucket.trim();
  const region = options.region.trim();
  const accessKeyId = options.accessKeyId.trim();
  const secretAccessKey = options.secretAccessKey;
  const endpoint = normalizeEndpoint(region, options.endpoint);
  const forcePathStyle = options.forcePathStyle ?? !!options.endpoint;
  const originalPhotoPrefix = normalizePrefix(options.originalPhotoPrefix);
  const maxPresignSeconds = Math.max(1, Math.min(options.maxPresignSeconds ?? maxS3PresignSeconds, maxS3PresignSeconds));
  const now = options.now ?? (() => new Date());

  const presign = ({ method, key, expiresAt, headers = {} }: PresignInput): PrivateStorageSigningResult<string> => {
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      return signingUnavailable();
    }

    const nowDate = now();
    const expiresAtMs = new Date(expiresAt).getTime();

    if (!Number.isFinite(expiresAtMs)) {
      return signingInvalid("storage_signing_invalid_expiry", "Private storage signing expiry is invalid.");
    }

    const expiresSeconds = Math.min(maxPresignSeconds, Math.floor((expiresAtMs - nowDate.getTime()) / 1000));

    if (expiresSeconds < 1) {
      return signingInvalid("storage_signing_expired", "Private storage signing expiry is invalid.");
    }

    const dateStamp = toDateStamp(nowDate);
    const amzDate = toAmzDate(nowDate);
    const host = forcePathStyle ? endpoint.host : `${bucket}.${endpoint.host}`;
    const canonicalUri = `/${(forcePathStyle ? `${bucket}/${key}` : key).split("/").map(encodeRfc3986).join("/")}`;
    const normalizedHeaders = Object.entries({
      ...headers,
      host
    }).reduce<Record<string, string>>((accumulator, [name, value]) => {
      accumulator[name.toLowerCase()] = normalizeHeaderValue(value);

      return accumulator;
    }, {});
    const signedHeaders = Object.keys(normalizedHeaders).sort().join(";");
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const queryParams: Record<string, string> = {
      "X-Amz-Algorithm": awsAlgorithm,
      "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": expiresSeconds.toString(),
      "X-Amz-SignedHeaders": signedHeaders
    };

    if (options.sessionToken) {
      queryParams["X-Amz-Security-Token"] = options.sessionToken;
    }

    const canonicalQuery = Object.entries(queryParams)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
      .join("&");
    const canonicalHeaders = Object.entries(normalizedHeaders)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}:${value}\n`)
      .join("");
    const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, unsignedPayload].join("\n");
    const stringToSign = [awsAlgorithm, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
    const signature = createHmac("sha256", createSigningKey(secretAccessKey, dateStamp, region))
      .update(stringToSign, "utf8")
      .digest("hex");
    const signedUrl = new URL(endpoint.toString());

    signedUrl.host = host;
    signedUrl.pathname = canonicalUri;

    for (const [name, value] of Object.entries(queryParams)) {
      signedUrl.searchParams.set(name, value);
    }

    signedUrl.searchParams.set("X-Amz-Signature", signature);

    return success(signedUrl.toString());
  };

  return {
    createOriginalPhotoUpload: async (input): Promise<PrivateStorageSigningResult<OriginalPhotoUploadSigningResult>> => {
      const key = buildOriginalPhotoKey(input, originalPhotoPrefix);
      const signedUrl = presign({
        method: "PUT",
        key,
        expiresAt: input.expiresAt,
        headers: {
          "content-type": input.contentType
        }
      });

      if (!signedUrl.ok) {
        return signedUrl;
      }

      return success({
        uploadUrl: signedUrl.signed,
        uploadMethod: "PUT",
        uploadHeaders: {
          "Content-Type": input.contentType
        },
        storageUri: `s3://${bucket}/${key}`,
        expiresAt: input.expiresAt,
        maxByteSize: input.maxByteSize
      });
    },

    createGeneratedAssetRead: async (input): Promise<PrivateStorageSigningResult<GeneratedAssetReadSigningResult>> => {
      const parsed = parseS3Uri(input.assetUri);

      if (!parsed || parsed.bucket !== bucket) {
        return signingInvalid("storage_asset_uri_invalid", "Generated asset storage metadata is invalid.");
      }

      const signedUrl = presign({
        method: "GET",
        key: parsed.key,
        expiresAt: input.expiresAt
      });

      if (!signedUrl.ok) {
        return signedUrl;
      }

      return success({
        signedUrl: signedUrl.signed,
        expiresAt: input.expiresAt,
        contentType: input.contentType
      });
    }
  };
};

export const createS3PrivateStorageSignerFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: Pick<S3PrivateStorageSignerOptions, "now" | "maxPresignSeconds"> = {}
): PrivateStorageSigner => {
  if (!config.storage) {
    throw new Error("API storage runtime config is missing TINY_PET_STORAGE_BUCKET.");
  }

  return createS3PrivateStorageSigner({
    ...config.storage,
    ...options
  });
};
