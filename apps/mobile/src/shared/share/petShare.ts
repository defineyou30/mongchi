import { Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

// Share utility for the pet avatar "brag" moments (pet reveal, friend page).
//
// Constraint: no new native modules (expo-sharing / react-native-view-shot /
// expo-media-library would need a dev client rebuild). We use React Native's
// built-in Share API only. On iOS, Share.share({ url }) shares an image when
// given a local file:// path -- it does not work with remote http(s) URLs.
// Generated pet assets may be:
//   - a bundled local asset (no accessible uri -- require() returns an opaque
//     numeric module id, not a file path) -> text-only share
//   - a remote https URL (freshly generated / signed) -> download to the
//     cache dir first, then share the resulting file:// path
//   - already a local file:// / cache path -> share directly
//
// If the user cancels/dismisses the native share sheet, that is not an error
// -- we resolve quietly (see Share.dismissedAction handling below).

export interface PetShareMessageInput {
  petName: string;
  daysTogether?: number | null;
}

export interface PetShareResult {
  ok: boolean;
  sharedWithImage: boolean;
  dismissed: boolean;
}

const REVEAL_MESSAGE_TEMPLATES: Array<(petName: string) => string> = [
  (petName) => `Meet ${petName} — my dog just moved into a tiny pixel garden. 🐾 (via Mongchi)`,
  (petName) => `Say hi to ${petName}! Just settled into their pixel garden home. 🌿 (via Mongchi)`
];

/**
 * Builds the share message for the pet reveal moment (freshest, highest
 * excitement -- no day count yet since the pet just arrived).
 */
export const buildPetRevealShareMessage = (petName: string): string => {
  const template = REVEAL_MESSAGE_TEMPLATES[Math.floor(Math.random() * REVEAL_MESSAGE_TEMPLATES.length)]!;

  return template(petName);
};

/**
 * Builds the share message for the friend page (has shared history --
 * reference daysTogether when available for a warmer, specific line).
 */
export const buildFriendShareMessage = ({ petName, daysTogether }: PetShareMessageInput): string => {
  if (typeof daysTogether === "number" && daysTogether > 0) {
    return `${petName} has been living in my pocket garden for ${daysTogether} day${daysTogether === 1 ? "" : "s"}. 🐾 (via Mongchi)`;
  }

  return `${petName} lives in my pocket garden. 🐾 (via Mongchi)`;
};

const isRemoteUri = (uri: string): boolean => /^https?:\/\//i.test(uri);
const isLocalFileUri = (uri: string): boolean => uri.startsWith("file://");

/**
 * Downloads a remote asset uri into the cache directory so it can be handed
 * to Share.share as a local file:// path. Returns null if the download
 * fails or the cache directory isn't available, so callers can fall back to
 * a text-only share instead of throwing.
 */
const downloadToCache = async (remoteUri: string): Promise<string | null> => {
  const cacheDirectory = FileSystem.cacheDirectory;

  if (!cacheDirectory) {
    return null;
  }

  try {
    const extensionMatch = /\.(png|jpe?g|webp)(?:\?|$)/i.exec(remoteUri);
    const extension = extensionMatch ? extensionMatch[1]!.toLowerCase() : "png";
    const destination = `${cacheDirectory}pet-share-${Date.now()}.${extension}`;
    const result = await FileSystem.downloadAsync(remoteUri, destination);

    if (result.status < 200 || result.status >= 300) {
      return null;
    }

    return result.uri;
  } catch {
    return null;
  }
};

/**
 * Resolves a generated asset uri to a local file:// path suitable for
 * Share.share's `url` field. Returns null when no shareable image is
 * available (bundled-only fallback art, missing uri, or download failure) --
 * callers should fall back to a text-only share in that case.
 */
export const resolveShareableImageUri = async (assetUri?: string | null): Promise<string | null> => {
  if (!assetUri) {
    return null;
  }

  if (isLocalFileUri(assetUri)) {
    return assetUri;
  }

  if (isRemoteUri(assetUri)) {
    return downloadToCache(assetUri);
  }

  // Anything else (e.g. an opaque bundled asset reference) isn't a
  // shareable file path.
  return null;
};

export interface SharePetCardParams {
  petName: string;
  assetUri?: string | null;
  message: string;
}

/**
 * Shares a pet card: image (when resolvable) + message text, falling back to
 * a text-only share when no local image can be resolved. Cancels/dismissals
 * are treated as a normal (non-error) outcome.
 */
export const sharePetCard = async ({ assetUri, message }: SharePetCardParams): Promise<PetShareResult> => {
  const shareableImageUri = await resolveShareableImageUri(assetUri);

  try {
    const action = await Share.share(
      shareableImageUri ? { url: shareableImageUri, message } : { message }
    );

    const dismissed = action.action === Share.dismissedAction;

    return {
      ok: true,
      sharedWithImage: Boolean(shareableImageUri),
      dismissed
    };
  } catch {
    // The user cancelling mid-flow or the native module rejecting is not
    // something the caller needs to surface as an error -- there is no
    // destructive state to roll back from a share attempt.
    return {
      ok: false,
      sharedWithImage: false,
      dismissed: true
    };
  }
};
