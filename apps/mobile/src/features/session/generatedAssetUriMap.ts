import type { GeneratedAsset, GeneratedAssetId } from "@mongchi/shared";

import type { GeneratedAssetReadUrlCacheEntry } from "./generatedAssetReadUrl";

// Builds the id -> displayable uri map used by every screen that renders a
// generated pet asset (PetRevealScreen, TerrariumHomeScreen, ChatGateScreen).
//
// The API runtime keeps `readUrlCache` fresh via periodic signed-url refresh
// (see generatedAssetIdsToResolve / shouldRefreshGeneratedAssetReadUrl in
// TerrariumSessionProvider), but that refresh loop is a no-op outside
// apiRuntime.mode === "api". In the Supabase flow, the only place a signed
// uri ever lands is on state.acceptedAsset / state.acceptedAssets. Without
// merging those in, every consumer's id lookup misses and falls back to a
// bundled sample sprite even though a real asset was generated, saved, and
// accepted.
//
// Precedence: accepted assets seed the map first, then the read-url cache is
// layered on top (since the cache may hold a more recently re-signed uri for
// the same id), and finally `localUriByAssetId` overrides both -- a
// permanent on-device file (see localGeneratedAssetStore.ts's
// ensureLocalGeneratedAssets) never expires and is always preferred over a
// remote signed url when one has been downloaded. An id missing from
// `localUriByAssetId` (not yet downloaded, or download failed) simply falls
// back to whatever remote uri the earlier layers produced.
export const buildGeneratedAssetUriMap = (
  readUrlCache: Partial<Record<GeneratedAssetId, GeneratedAssetReadUrlCacheEntry>>,
  acceptedAsset: GeneratedAsset | null | undefined,
  acceptedAssets: GeneratedAsset[] | undefined,
  localUriByAssetId?: Partial<Record<GeneratedAssetId, string>>
): Partial<Record<GeneratedAssetId, string>> => {
  const uris: Partial<Record<GeneratedAssetId, string>> = {};

  const acceptedCandidates = [
    ...(acceptedAssets ?? []),
    ...(acceptedAsset ? [acceptedAsset] : [])
  ];

  for (const asset of acceptedCandidates) {
    if (asset?.id && asset.uri) {
      uris[asset.id] = asset.uri;
    }
  }

  for (const [assetId, entry] of Object.entries(readUrlCache) as Array<
    [GeneratedAssetId, GeneratedAssetReadUrlCacheEntry | undefined]
  >) {
    if (entry?.uri) {
      uris[assetId] = entry.uri;
    }
  }

  for (const [assetId, localUri] of Object.entries(localUriByAssetId ?? {}) as Array<
    [GeneratedAssetId, string | undefined]
  >) {
    if (localUri) {
      uris[assetId] = localUri;
    }
  }

  return uris;
};
