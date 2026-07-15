import { describe, expect, it } from "vitest";

import type { GeneratedAsset } from "@mongchi/shared";

import { buildGeneratedAssetUriMap } from "./generatedAssetUriMap";
import type { GeneratedAssetReadUrlCacheEntry } from "./generatedAssetReadUrl";

const makeGeneratedAsset = (overrides: Partial<GeneratedAsset> & { id: string; uri: string }): GeneratedAsset => ({
  petId: "pet_001",
  generationJobId: "job_001",
  state: "happy",
  width: 512,
  height: 512,
  contentHash: "hash_001",
  mimeType: "image/png",
  storageClass: "private_app_asset",
  version: 1,
  qualityStatus: "passed",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z",
  ...overrides
});

describe("buildGeneratedAssetUriMap", () => {
  it("maps ids to uris from the signed read-url cache alone (API runtime)", () => {
    const readUrlCache: Partial<Record<string, GeneratedAssetReadUrlCacheEntry>> = {
      asset_001: {
        assetId: "asset_001",
        uri: "https://storage.example.com/asset_001.png",
        expiresAt: "2026-06-24T09:15:00.000Z"
      }
    };

    expect(buildGeneratedAssetUriMap(readUrlCache, null, [])).toEqual({
      asset_001: "https://storage.example.com/asset_001.png"
    });
  });

  it("maps ids to uris from accepted assets alone (Supabase runtime, no read-url cache)", () => {
    const acceptedAsset = makeGeneratedAsset({
      id: "asset_002",
      uri: "https://supabase.example.com/asset_002.png"
    });

    expect(buildGeneratedAssetUriMap({}, acceptedAsset, [acceptedAsset])).toEqual({
      asset_002: "https://supabase.example.com/asset_002.png"
    });
  });

  it("merges accepted-asset uris in without a matching read-url cache entry", () => {
    const acceptedAssets = [
      makeGeneratedAsset({ id: "asset_002", uri: "https://supabase.example.com/asset_002.png" }),
      makeGeneratedAsset({ id: "asset_003", uri: "https://supabase.example.com/asset_003.png" })
    ];
    const readUrlCache: Partial<Record<string, GeneratedAssetReadUrlCacheEntry>> = {
      asset_001: {
        assetId: "asset_001",
        uri: "https://storage.example.com/asset_001.png",
        expiresAt: "2026-06-24T09:15:00.000Z"
      }
    };

    expect(buildGeneratedAssetUriMap(readUrlCache, acceptedAssets[0]!, acceptedAssets)).toEqual({
      asset_001: "https://storage.example.com/asset_001.png",
      asset_002: "https://supabase.example.com/asset_002.png",
      asset_003: "https://supabase.example.com/asset_003.png"
    });
  });

  it("prefers the read-url cache entry over an accepted-asset uri for the same id, since the cache may be a fresher re-sign", () => {
    const acceptedAsset = makeGeneratedAsset({
      id: "asset_001",
      uri: "https://supabase.example.com/stale-asset_001.png"
    });
    const readUrlCache: Partial<Record<string, GeneratedAssetReadUrlCacheEntry>> = {
      asset_001: {
        assetId: "asset_001",
        uri: "https://storage.example.com/fresh-asset_001.png",
        expiresAt: "2026-06-24T09:15:00.000Z"
      }
    };

    expect(buildGeneratedAssetUriMap(readUrlCache, acceptedAsset, [acceptedAsset])).toEqual({
      asset_001: "https://storage.example.com/fresh-asset_001.png"
    });
  });

  it("ignores accepted assets missing an id or uri and tolerates undefined inputs", () => {
    const incomplete = makeGeneratedAsset({ id: "asset_004", uri: "" });

    expect(buildGeneratedAssetUriMap({}, undefined, [incomplete])).toEqual({});
    expect(buildGeneratedAssetUriMap({}, null, undefined)).toEqual({});
  });

  it("prefers a local file uri over both the read-url cache and the accepted-asset uri for the same id", () => {
    const acceptedAsset = makeGeneratedAsset({
      id: "asset_001",
      uri: "https://supabase.example.com/stale-asset_001.png"
    });
    const readUrlCache: Partial<Record<string, GeneratedAssetReadUrlCacheEntry>> = {
      asset_001: {
        assetId: "asset_001",
        uri: "https://storage.example.com/fresh-asset_001.png",
        expiresAt: "2026-06-24T09:15:00.000Z"
      }
    };

    expect(
      buildGeneratedAssetUriMap(readUrlCache, acceptedAsset, [acceptedAsset], {
        asset_001: "file:///pet-assets/asset_001.png"
      })
    ).toEqual({
      asset_001: "file:///pet-assets/asset_001.png"
    });
  });

  it("falls back to the remote uri for an id missing from the local uri map", () => {
    const acceptedAssets = [
      makeGeneratedAsset({ id: "asset_001", uri: "https://supabase.example.com/asset_001.png" }),
      makeGeneratedAsset({ id: "asset_002", uri: "https://supabase.example.com/asset_002.png" })
    ];

    expect(
      buildGeneratedAssetUriMap({}, null, acceptedAssets, {
        asset_001: "file:///pet-assets/asset_001.png"
      })
    ).toEqual({
      asset_001: "file:///pet-assets/asset_001.png",
      asset_002: "https://supabase.example.com/asset_002.png"
    });
  });

  it("tolerates an omitted or empty local uri map", () => {
    const acceptedAsset = makeGeneratedAsset({
      id: "asset_001",
      uri: "https://supabase.example.com/asset_001.png"
    });

    expect(buildGeneratedAssetUriMap({}, acceptedAsset, [acceptedAsset], {})).toEqual({
      asset_001: "https://supabase.example.com/asset_001.png"
    });
    expect(buildGeneratedAssetUriMap({}, acceptedAsset, [acceptedAsset])).toEqual({
      asset_001: "https://supabase.example.com/asset_001.png"
    });
  });
});
