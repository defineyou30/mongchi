import { describe, expect, it } from "vitest";

import {
  isRenderableGeneratedAssetUri,
  resolveGeneratedAssetReadUrl,
  shouldRefreshGeneratedAssetReadUrl,
  toGeneratedAssetReadUrlCacheEntry
} from "./generatedAssetReadUrl";
import type { GeneratedAssetReadUrlClient } from "./generatedAssetReadUrl";

describe("generated asset signed read URL resolver", () => {
  it("allows only HTTP(S) image URIs that React Native can render", () => {
    expect(isRenderableGeneratedAssetUri("https://storage.example.com/pet.png")).toBe(true);
    expect(isRenderableGeneratedAssetUri("http://localhost:8787/pet.png")).toBe(true);
    expect(isRenderableGeneratedAssetUri("http://api.example.com/pet.png")).toBe(false);
    expect(isRenderableGeneratedAssetUri("mock-signed-read://private/pet.png")).toBe(false);
  });

  it("converts signed URL responses into cache entries only when renderable", () => {
    expect(
      toGeneratedAssetReadUrlCacheEntry({
        assetId: "asset_001",
        petId: "pet_001",
        signedUrl: "https://storage.example.com/pet.png",
        expiresAt: "2026-06-24T09:15:00.000Z",
        contentType: "image/png",
        storageClass: "private_app_asset"
      })
    ).toEqual({
      assetId: "asset_001",
      uri: "https://storage.example.com/pet.png",
      expiresAt: "2026-06-24T09:15:00.000Z"
    });
    expect(
      toGeneratedAssetReadUrlCacheEntry({
        assetId: "asset_001",
        petId: "pet_001",
        signedUrl: "mock-signed-read://private/pet.png",
        expiresAt: "2026-06-24T09:15:00.000Z",
        contentType: "image/png",
        storageClass: "private_app_asset"
      })
    ).toBeNull();
  });

  it("refreshes missing, invalid, and nearly expired cache entries", () => {
    expect(shouldRefreshGeneratedAssetReadUrl(undefined, Date.parse("2026-06-24T09:00:00.000Z"))).toBe(true);
    expect(
      shouldRefreshGeneratedAssetReadUrl(
        {
          assetId: "asset_001",
          uri: "https://storage.example.com/pet.png",
          expiresAt: "2026-06-24T09:00:30.000Z"
        },
        Date.parse("2026-06-24T09:00:00.000Z")
      )
    ).toBe(true);
    expect(
      shouldRefreshGeneratedAssetReadUrl(
        {
          assetId: "asset_001",
          uri: "https://storage.example.com/pet.png",
          expiresAt: "2026-06-24T09:03:00.000Z"
        },
        Date.parse("2026-06-24T09:00:00.000Z")
      )
    ).toBe(false);
  });

  it("resolves cache entries through the API client without surfacing unrenderable mock URLs", async () => {
    const client: GeneratedAssetReadUrlClient = {
      getGeneratedAssetSignedUrl: async () => ({
        ok: true,
        status: 200,
        data: {
          assetId: "asset_001",
          petId: "pet_001",
          signedUrl: "mock-signed-read://private/pet.png",
          expiresAt: "2026-06-24T09:15:00.000Z",
          contentType: "image/png",
          storageClass: "private_app_asset"
        }
      })
    };

    await expect(resolveGeneratedAssetReadUrl(client, "asset_001")).resolves.toEqual({
      ok: true,
      entry: null
    });
  });
});
