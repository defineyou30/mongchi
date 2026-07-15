import * as FileSystem from "expo-file-system/legacy";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GeneratedAsset, GeneratedAssetId } from "@mongchi/shared";

import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { reporter } from "../../shared/errors/reporter";
import { petMediaBucket } from "./supabaseGenerationSession";

// ---------------------------------------------------------------------------
// Local permanent storage for generated pet sprites.
//
// Generated sprites live in a private Supabase Storage bucket and are only
// ever reachable through short-lived signed URLs (see
// supabaseGenerationSession.ts's signedUrlExpirySeconds). A pet's sprite is
// the only asset the player has left of their pet -- the original source
// photo is deleted for privacy -- so rendering can never be allowed to
// depend on a signed URL staying valid. This module downloads each accepted
// generated asset to a permanent on-device file exactly once; after that,
// rendering reads the local file (see generatedAssetUriMap.ts's local-uri
// precedence) and the server/signed-URL path only matters for disaster
// recovery -- re-downloading after an app reinstall, a cleared local store,
// or a device that never finished the first download.
//
// Every asset is handled independently: one asset failing to download (a
// network hiccup, an already-expired signed URL that also fails to
// re-sign, no writable directory) never blocks the others, and simply
// leaves that asset to retry on a later call -- see
// TerrariumSessionProvider's local-asset-hydration effect, which re-runs
// whenever the accepted asset list changes and skips ids that already
// resolved to a local uri.
// ---------------------------------------------------------------------------

const localAssetDirectoryName = "pet-assets";
const downloadTimeoutMs = 20_000;
const resignTimeoutMs = 20_000;
// Only needs to survive a single download attempt, unlike
// supabaseGenerationSession.ts's signedUrlExpirySeconds (a long-lived
// display url) -- this one is used once and thrown away.
const resignExpirySeconds = 10 * 60;

const getLocalAssetDirectoryUri = (): string | null => {
  const documentDirectory = FileSystem.documentDirectory;

  return documentDirectory ? `${documentDirectory}${localAssetDirectoryName}/` : null;
};

const sanitizeForFileName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "_");

/**
 * Despite its name, `contentHash` on a real (non-mock) GeneratedAsset is
 * currently the bucket-relative Supabase Storage path stamped by
 * toGeneratedAssetPlaceholder in supabaseGenerationSession.ts (e.g.
 * `avatars/<user>/<job>/idle.png`), not a sha256 digest -- see that
 * function's `contentHash: row.storage_path`. It is still a stable,
 * unique-per-asset identity key, so it doubles as the local filename here,
 * falling back to the asset id (always present, e.g. for mock assets) when
 * contentHash is empty.
 */
const localFileNameForAsset = (asset: GeneratedAsset): string => {
  const key = asset.contentHash && asset.contentHash.length > 0 ? asset.contentHash : asset.id;

  return `${sanitizeForFileName(key)}.png`;
};

const ensureLocalAssetDirectoryExists = async (directoryUri: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(directoryUri);

    if (info.exists) {
      return true;
    }

    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
    return true;
  } catch (cause) {
    reporter.captureMessage("localGeneratedAssetStore: directory create failed", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return false;
  }
};

/**
 * Mirrors supabaseGenerationSession.ts's
 * extractPetMediaStoragePathFromSignedUrl -- a defensive fallback for an
 * asset whose contentHash didn't survive a restore (an older persisted
 * session shape), used only to re-sign a fresh download url when the
 * asset's original signed uri has already expired.
 */
const extractStoragePathFromSignedUri = (signedUri: string): string | null => {
  const marker = `/${petMediaBucket}/`;
  const markerIndex = signedUri.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const afterMarker = signedUri.slice(markerIndex + marker.length);
  const withoutQuery = afterMarker.split("?")[0];

  return withoutQuery && withoutQuery.length > 0 ? withoutQuery : null;
};

const resolveStoragePathForResign = (asset: GeneratedAsset): string | null => {
  if (asset.contentHash && asset.contentHash.includes("/")) {
    return asset.contentHash;
  }

  return extractStoragePathFromSignedUri(asset.uri);
};

const resignAssetUrl = async (client: SupabaseClient, storagePath: string): Promise<string | null> => {
  try {
    const result = await withRequestTimeout(
      client.storage.from(petMediaBucket).createSignedUrl(storagePath, resignExpirySeconds),
      resignTimeoutMs
    );

    return result.error || !result.data?.signedUrl ? null : result.data.signedUrl;
  } catch {
    return null;
  }
};

const downloadToLocalFile = async (remoteUri: string, localFileUri: string): Promise<boolean> => {
  try {
    const result = await withRequestTimeout(FileSystem.downloadAsync(remoteUri, localFileUri), downloadTimeoutMs);
    return result.status === 200;
  } catch {
    return false;
  }
};

const deleteLocalFileQuietly = async (localFileUri: string): Promise<void> => {
  try {
    await FileSystem.deleteAsync(localFileUri, { idempotent: true });
  } catch {
    // Best-effort cleanup only -- a stray partial file just gets retried
    // (and overwritten) on the next call.
  }
};

/**
 * Ensures a permanent local file exists for each of `assets`, downloading it
 * via its current signed `uri` when there is no local copy yet (assets that
 * already have one are skipped via a cheap getInfoAsync check, so callers
 * can safely pass the same asset list on every call rather than tracking
 * "already downloaded" state themselves).
 *
 * If the initial download fails -- most commonly because the asset's
 * signed uri has since expired (see supabaseGenerationSession.ts's
 * signedUrlExpirySeconds) -- a fresh signed url is requested for the same
 * storage path and the download is retried once. Pass `client: null` to
 * skip the re-sign retry entirely (e.g. from a context that never holds a
 * live Supabase session); the initial download attempt still runs.
 *
 * Returns only the ids that now have a local file. A missing id means that
 * asset's download failed and should be retried on a later call (transient
 * network issue, directory unavailable, both the original and re-signed
 * download failing, etc) -- this function never throws.
 */
export const ensureLocalGeneratedAssets = async (
  client: SupabaseClient | null,
  assets: readonly GeneratedAsset[]
): Promise<Partial<Record<GeneratedAssetId, string>>> => {
  const localUriByAssetId: Partial<Record<GeneratedAssetId, string>> = {};

  if (assets.length === 0) {
    return localUriByAssetId;
  }

  const directoryUri = getLocalAssetDirectoryUri();

  if (!directoryUri || !(await ensureLocalAssetDirectoryExists(directoryUri))) {
    return localUriByAssetId;
  }

  for (const asset of assets) {
    if (!asset.id || !asset.uri) {
      continue;
    }

    try {
      const localFileUri = `${directoryUri}${localFileNameForAsset(asset)}`;
      const existing = await FileSystem.getInfoAsync(localFileUri);

      if (existing.exists) {
        localUriByAssetId[asset.id] = localFileUri;
        continue;
      }

      let downloaded = await downloadToLocalFile(asset.uri, localFileUri);

      if (!downloaded && client) {
        const storagePath = resolveStoragePathForResign(asset);
        const freshUrl = storagePath ? await resignAssetUrl(client, storagePath) : null;

        if (freshUrl) {
          downloaded = await downloadToLocalFile(freshUrl, localFileUri);
        }
      }

      if (downloaded) {
        localUriByAssetId[asset.id] = localFileUri;
      } else {
        await deleteLocalFileQuietly(localFileUri);
      }
    } catch (cause) {
      reporter.captureMessage("localGeneratedAssetStore: asset download threw", {
        assetId: asset.id,
        cause: cause instanceof Error ? cause.message : String(cause)
      });
    }
  }

  return localUriByAssetId;
};
