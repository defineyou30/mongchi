import { createHash, createHmac } from "node:crypto";

import type { ApiRuntimeConfig } from "./apiRuntimeConfig";
import type { PrivateStorageObjectDeleter, PrivateStorageObjectDeletionResult } from "./privateStorageDeletion";

export interface S3PrivateStorageObjectDeleterOptions {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  now?: () => Date;
  fetch?: S3DeleteFetch;
}

export type S3DeleteFetch = (
  url: string,
  init: {
    method: "DELETE";
    headers: Record<string, string>;
  }
) => Promise<{ status: number }>;

type ParsedS3Uri = {
  bucket: string;
  key: string;
};

const awsAlgorithm = "AWS4-HMAC-SHA256";
const emptyPayloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const hmac = (key: Buffer | string, value: string): Buffer => createHmac("sha256", key).update(value, "utf8").digest();
const sha256Hex = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const toDateStamp = (date: Date): string => date.toISOString().slice(0, 10).replace(/-/g, "");
const toAmzDate = (date: Date): string => `${toDateStamp(date)}T${date.toISOString().slice(11, 19).replace(/:/g, "")}Z`;

const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const parseS3Uri = (value: string): ParsedS3Uri | null => {
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

const fail = (failureCode: string, failureMessageSafe = "Private storage deletion is queued for retry."): PrivateStorageObjectDeletionResult => ({
  ok: false,
  failureCode,
  failureMessageSafe
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

const getGlobalFetch = (): S3DeleteFetch => {
  const globalFetch = (globalThis as { fetch?: S3DeleteFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for private storage deletion.");
  }

  return globalFetch;
};

export const createS3PrivateStorageObjectDeleter = (
  options: S3PrivateStorageObjectDeleterOptions
): PrivateStorageObjectDeleter => {
  const bucket = options.bucket.trim();
  const region = options.region.trim();
  const accessKeyId = options.accessKeyId.trim();
  const secretAccessKey = options.secretAccessKey;
  const endpoint = normalizeEndpoint(region, options.endpoint);
  const forcePathStyle = options.forcePathStyle ?? !!options.endpoint;
  const now = options.now ?? (() => new Date());
  const fetchDelete = options.fetch ?? getGlobalFetch();

  const buildDeleteRequest = (key: string): { url: string; headers: Record<string, string> } => {
    const nowDate = now();
    const dateStamp = toDateStamp(nowDate);
    const amzDate = toAmzDate(nowDate);
    const host = forcePathStyle ? endpoint.host : `${bucket}.${endpoint.host}`;
    const canonicalUri = `/${(forcePathStyle ? `${bucket}/${key}` : key).split("/").map(encodeRfc3986).join("/")}`;
    const signedHeaderValues = Object.entries({
      host,
      "x-amz-content-sha256": emptyPayloadHash,
      "x-amz-date": amzDate,
      ...(options.sessionToken ? { "x-amz-security-token": options.sessionToken } : {})
    }).reduce<Record<string, string>>((accumulator, [name, value]) => {
      accumulator[name.toLowerCase()] = normalizeHeaderValue(value);

      return accumulator;
    }, {});
    const signedHeaders = Object.keys(signedHeaderValues).sort().join(";");
    const canonicalHeaders = Object.entries(signedHeaderValues)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}:${value}\n`)
      .join("");
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const canonicalRequest = ["DELETE", canonicalUri, "", canonicalHeaders, signedHeaders, emptyPayloadHash].join("\n");
    const stringToSign = [awsAlgorithm, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
    const signature = createHmac("sha256", createSigningKey(secretAccessKey, dateStamp, region))
      .update(stringToSign, "utf8")
      .digest("hex");
    const requestUrl = new URL(endpoint.toString());
    const headers: Record<string, string> = {
      Authorization: `${awsAlgorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": emptyPayloadHash,
      "x-amz-date": amzDate
    };

    requestUrl.host = host;
    requestUrl.pathname = canonicalUri;

    if (options.sessionToken) {
      headers["x-amz-security-token"] = options.sessionToken;
    }

    return {
      url: requestUrl.toString(),
      headers
    };
  };

  return {
    deleteObjects: async ({ uris }): Promise<PrivateStorageObjectDeletionResult> => {
      if (!bucket || !region || !accessKeyId || !secretAccessKey) {
        return fail("storage_deletion_unavailable");
      }

      const parsedObjects = Array.from(new Set(uris.map((uri) => uri.trim()).filter(Boolean))).map((uri) => ({
        uri,
        parsed: parseS3Uri(uri)
      }));

      for (const object of parsedObjects) {
        if (!object.parsed || object.parsed.bucket !== bucket) {
          return fail("storage_deletion_invalid_uri", "Private storage metadata is invalid.");
        }
      }

      for (const object of parsedObjects) {
        const parsed = object.parsed!;
        const request = buildDeleteRequest(parsed.key);
        let responseStatus: number;

        try {
          responseStatus = (await fetchDelete(request.url, { method: "DELETE", headers: request.headers })).status;
        } catch {
          return fail("storage_deletion_request_failed");
        }

        if (![200, 202, 204, 404].includes(responseStatus)) {
          return fail("storage_deletion_request_failed");
        }
      }

      return {
        ok: true,
        deletedUriCount: parsedObjects.length
      };
    }
  };
};

export const createS3PrivateStorageObjectDeleterFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: Pick<S3PrivateStorageObjectDeleterOptions, "now" | "fetch"> = {}
): PrivateStorageObjectDeleter => {
  if (!config.storage) {
    throw new Error("API storage runtime config is missing TINY_PET_STORAGE_BUCKET.");
  }

  return createS3PrivateStorageObjectDeleter({
    ...config.storage,
    ...options
  });
};
