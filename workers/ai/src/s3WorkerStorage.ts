import type { GeneratedAsset, GeneratedAssetState, GenerationJob } from "@mongchi/shared";

import type {
  GeneratedAssetStorageWriter,
  OriginalPhotoReader,
  OriginalPhotoReadResult,
  ProviderGeneratedAsset,
  WorkerOriginalPhotoRecord
} from "./generationWorker";

export interface S3GenerationWorkerStorageOptions {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  generatedAssetPrefix?: string;
  now?: () => Date;
  fetch?: S3WorkerStorageFetch;
}

export type S3WorkerStorageFetch = (
  url: string,
  init: {
    method: "GET" | "PUT";
    headers: Record<string, string>;
    body?: Uint8Array;
  }
) => Promise<{
  status: number;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}>;

export type S3GenerationWorkerStorage = OriginalPhotoReader & GeneratedAssetStorageWriter;

type ParsedS3Uri = {
  bucket: string;
  key: string;
};

type SignedRequest = {
  url: string;
  headers: Record<string, string>;
};

const awsAlgorithm = "AWS4-HMAC-SHA256";
const emptyPayloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return copy.buffer;
};

const sha256Hex = async (value: string | Uint8Array): Promise<string> => {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));

  return toHex(new Uint8Array(digest));
};

const hmacSha256 = async (key: string | Uint8Array, value: string): Promise<Uint8Array> => {
  const rawKey = typeof key === "string" ? textEncoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(rawKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(value));

  return new Uint8Array(signature);
};

const toDateStamp = (date: Date): string => date.toISOString().slice(0, 10).replace(/-/g, "");
const toAmzDate = (date: Date): string => `${toDateStamp(date)}T${date.toISOString().slice(11, 19).replace(/:/g, "")}Z`;

const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const normalizeHeaderValue = (value: string): string => value.trim().replace(/\s+/g, " ");
const normalizePrefix = (value: string | undefined): string => (value ?? "generated-assets").replace(/^\/+|\/+$/g, "");
const s3SafeSegment = (value: string): string => value.replace(/[^A-Za-z0-9_.-]/g, "_");

const extensionForMimeType = (mimeType: GeneratedAsset["mimeType"]): string => (mimeType === "image/png" ? "png" : "webp");

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

const normalizeEndpoint = (region: string, endpoint: string | undefined): URL =>
  endpoint ? new URL(endpoint) : new URL(`https://s3.${region}.amazonaws.com`);

const createSigningKey = async (secretAccessKey: string, dateStamp: string, region: string): Promise<Uint8Array> => {
  const dateKey = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = await hmacSha256(dateKey, region);
  const dateRegionServiceKey = await hmacSha256(dateRegionKey, "s3");

  return hmacSha256(dateRegionServiceKey, "aws4_request");
};

const buildGeneratedAssetKey = (
  job: GenerationJob,
  asset: Pick<ProviderGeneratedAsset, "state" | "mimeType">,
  prefix: string
): string =>
  [
    prefix,
    s3SafeSegment(job.userId),
    s3SafeSegment(job.petId),
    s3SafeSegment(job.id),
    `${s3SafeSegment(asset.state)}.${extensionForMimeType(asset.mimeType)}`
  ].join("/");

const getGlobalFetch = (): S3WorkerStorageFetch => {
  const globalFetch = (globalThis as { fetch?: S3WorkerStorageFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for worker private storage.");
  }

  return globalFetch;
};

export const createS3GenerationWorkerStorage = (options: S3GenerationWorkerStorageOptions): S3GenerationWorkerStorage => {
  const bucket = options.bucket.trim();
  const region = options.region.trim();
  const accessKeyId = options.accessKeyId.trim();
  const secretAccessKey = options.secretAccessKey;
  const endpoint = normalizeEndpoint(region, options.endpoint);
  const forcePathStyle = options.forcePathStyle ?? !!options.endpoint;
  const generatedAssetPrefix = normalizePrefix(options.generatedAssetPrefix);
  const now = options.now ?? (() => new Date());
  const fetchStorage = options.fetch ?? getGlobalFetch();

  const ensureConfigured = (): void => {
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error("Worker private storage is not configured.");
    }
  };

  const buildRequest = async ({
    method,
    key,
    payloadHash,
    headers = {}
  }: {
    method: "GET" | "PUT";
    key: string;
    payloadHash: string;
    headers?: Record<string, string>;
  }): Promise<SignedRequest> => {
    ensureConfigured();

    const nowDate = now();
    const dateStamp = toDateStamp(nowDate);
    const amzDate = toAmzDate(nowDate);
    const host = forcePathStyle ? endpoint.host : `${bucket}.${endpoint.host}`;
    const canonicalUri = `/${(forcePathStyle ? `${bucket}/${key}` : key).split("/").map(encodeRfc3986).join("/")}`;
    const signedHeaderValues = Object.entries({
      ...headers,
      host,
      "x-amz-content-sha256": payloadHash,
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
    const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const stringToSign = [awsAlgorithm, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
    const signature = toHex(await hmacSha256(await createSigningKey(secretAccessKey, dateStamp, region), stringToSign));
    const requestUrl = new URL(endpoint.toString());
    const requestHeaders: Record<string, string> = {
      Authorization: `${awsAlgorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...headers
    };

    requestUrl.host = host;
    requestUrl.pathname = canonicalUri;

    if (options.sessionToken) {
      requestHeaders["x-amz-security-token"] = options.sessionToken;
    }

    return {
      url: requestUrl.toString(),
      headers: requestHeaders
    };
  };

  const assertS3UriInBucket = (uri: string, message: string): ParsedS3Uri => {
    const parsed = parseS3Uri(uri);

    if (!parsed || parsed.bucket !== bucket) {
      throw new Error(message);
    }

    return parsed;
  };

  return {
    readOriginalPhoto: async ({ photo, storageUri }: { photo: WorkerOriginalPhotoRecord; storageUri: string }): Promise<OriginalPhotoReadResult> => {
      const parsed = assertS3UriInBucket(storageUri, "Source photo storage metadata is invalid.");
      const request = await buildRequest({
        method: "GET",
        key: parsed.key,
        payloadHash: emptyPayloadHash
      });
      const response = await fetchStorage(request.url, {
        method: "GET",
        headers: request.headers
      });

      if (response.status !== 200 || !response.arrayBuffer) {
        throw new Error("Source photo could not be read from private storage.");
      }

      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        declaredContentType: photo.contentType
      };
    },

    writeGeneratedAsset: async ({ job, asset, contentType }) => {
      const key = buildGeneratedAssetKey(job, asset, generatedAssetPrefix);
      const payloadHash = await sha256Hex(asset.bytes);
      const request = await buildRequest({
        method: "PUT",
        key,
        payloadHash,
        headers: {
          "content-type": contentType
        }
      });
      const response = await fetchStorage(request.url, {
        method: "PUT",
        headers: {
          ...request.headers,
          "Content-Type": contentType
        },
        body: asset.bytes
      });

      if (![200, 201, 204].includes(response.status)) {
        throw new Error("Generated asset could not be written to private storage.");
      }

      return {
        uri: `s3://${bucket}/${key}`,
        contentHash: `sha256:${payloadHash}`
      };
    }
  };
};
