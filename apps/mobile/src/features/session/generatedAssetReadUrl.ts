import type {
  GeneratedAssetId,
  GeneratedAssetSignedUrlResponse
} from "@mongchi/shared";

import type { MobileApiError, MobileApiResult } from "../../shared/api";

export interface GeneratedAssetReadUrlClient {
  getGeneratedAssetSignedUrl: (
    assetId: GeneratedAssetId
  ) => Promise<MobileApiResult<GeneratedAssetSignedUrlResponse>>;
}

export interface GeneratedAssetReadUrlCacheEntry {
  assetId: GeneratedAssetId;
  uri: string;
  expiresAt: string;
}

export type GeneratedAssetReadUrlResult =
  | {
      ok: true;
      entry: GeneratedAssetReadUrlCacheEntry | null;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export const isRenderableGeneratedAssetUri = (uri: string): boolean => /^https:\/\//i.test(uri) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(uri);

export const toGeneratedAssetReadUrlCacheEntry = (
  response: GeneratedAssetSignedUrlResponse
): GeneratedAssetReadUrlCacheEntry | null => {
  if (!isRenderableGeneratedAssetUri(response.signedUrl)) {
    return null;
  }

  return {
    assetId: response.assetId,
    uri: response.signedUrl,
    expiresAt: response.expiresAt
  };
};

export const shouldRefreshGeneratedAssetReadUrl = (
  entry: GeneratedAssetReadUrlCacheEntry | undefined,
  nowMs: number = Date.now()
): boolean => {
  if (!entry) {
    return true;
  }

  const expiresAtMs = new Date(entry.expiresAt).getTime();

  return !Number.isFinite(expiresAtMs) || expiresAtMs - nowMs < 60_000;
};

export const resolveGeneratedAssetReadUrl = async (
  client: GeneratedAssetReadUrlClient,
  assetId: GeneratedAssetId
): Promise<GeneratedAssetReadUrlResult> => {
  const result = await client.getGeneratedAssetSignedUrl(assetId);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error
    };
  }

  return {
    ok: true,
    entry: toGeneratedAssetReadUrlCacheEntry(result.data)
  };
};
