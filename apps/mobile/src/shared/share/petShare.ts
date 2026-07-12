import { Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";
import type { AppLocale } from "../../localization/localeNormalization";
import { getResourcesForLocale } from "../../localization/resourceCatalog";

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
  locale?: AppLocale;
}

export interface PetShareResult {
  ok: boolean;
  sharedWithImage: boolean;
  dismissed: boolean;
}

const revealMessageTemplates = [
  { "en-US": "Meet {{petName}}, my new tiny garden friend. Made with Mongchi.", "ko-KR": "새로운 작은 정원 친구 {{petName}}를 만나보세요. Mongchi에서 만들었어요.", "ja-JP": "新しい小さな庭のお友だち、{{petName}}です。Mongchiで作りました。", "zh-TW": "來認識新的迷你花園朋友 {{petName}}。由 Mongchi 創造。", "de-DE": "Lerne {{petName}} kennen, meinen neuen kleinen Gartenfreund. Erstellt mit Mongchi.", "fr-FR": "Découvrez {{petName}}, mon nouveau petit ami du jardin. Créé avec Mongchi.", "pt-BR": "Conheça {{petName}}, meu novo amiguinho do jardim. Feito com Mongchi.", "es-MX": "Conoce a {{petName}}, mi nuevo amiguito del jardín. Creado con Mongchi." },
  { "en-US": "{{petName}} just moved into a tiny pixel garden. Made with Mongchi.", "ko-KR": "{{petName}}가 작은 픽셀 정원에 입주했어요. Mongchi에서 만들었어요.", "ja-JP": "{{petName}}が小さなピクセルの庭にお引っ越ししました。Mongchiで作りました。", "zh-TW": "{{petName}} 剛搬進了迷你像素花園。由 Mongchi 創造。", "de-DE": "{{petName}} ist gerade in einen kleinen Pixelgarten eingezogen. Erstellt mit Mongchi.", "fr-FR": "{{petName}} vient de s’installer dans un petit jardin pixelisé. Créé avec Mongchi.", "pt-BR": "{{petName}} acabou de chegar a um pequeno jardim de pixels. Feito com Mongchi.", "es-MX": "{{petName}} acaba de mudarse a un pequeño jardín de píxeles. Creado con Mongchi." }
] as const satisfies readonly [LocalizedText, LocalizedText];

const interpolateShareText = (text: string, values: Readonly<Record<string, string | number>>): string =>
  Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)), text);

/**
 * Builds the share message for the pet reveal moment (freshest, highest
 * excitement -- no day count yet since the pet just arrived).
 */
export const buildPetRevealShareMessage = (petName: string, locale: AppLocale = "en-US"): string => {
  const template = revealMessageTemplates[Math.floor(Math.random() * revealMessageTemplates.length)] ?? revealMessageTemplates[0];

  return interpolateShareText(getLocalizedText(locale, template), { petName });
};

/**
 * Builds the share message for the friend page (has shared history --
 * reference daysTogether when available for a warmer, specific line).
 */
export const buildFriendShareMessage = ({ petName, daysTogether, locale = "en-US" }: PetShareMessageInput): string => {
  const shareMessages = getResourcesForLocale(locale).friend.shareMessages;

  if (typeof daysTogether === "number" && daysTogether > 0) {
    if (locale === "en-US" && daysTogether === 1) {
      return `${petName} has been my tiny garden friend for 1 day. Made with Mongchi.`;
    }

    return interpolateShareText(shareMessages.days, { petName, count: daysTogether });
  }

  return interpolateShareText(shareMessages.fallback, { petName });
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
  brandedCardUri?: string | null;
  message: string;
}

/**
 * Shares a pet card: image (when resolvable) + message text, falling back to
 * a text-only share when no local image can be resolved. Cancels/dismissals
 * are treated as a normal (non-error) outcome.
 */
export const sharePetCard = async ({ brandedCardUri, message }: SharePetCardParams): Promise<PetShareResult> => {
  const shareableImageUri = await resolveShareableImageUri(brandedCardUri);

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
