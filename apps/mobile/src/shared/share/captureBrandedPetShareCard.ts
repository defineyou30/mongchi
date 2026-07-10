import * as FileSystem from "expo-file-system/legacy";

interface SvgDataUrlSource {
  toDataURL: (
    callback: (base64: string) => void,
    options: { readonly width: number; readonly height: number }
  ) => void;
}

const exportWidth = 1080;
const exportHeight = 1350;
const exportTimeoutMs = 2500;

export const captureBrandedPetShareCard = async (source: SvgDataUrlSource | null): Promise<string | null> => {
  if (!source || !FileSystem.cacheDirectory) {
    return null;
  }

  try {
    const base64 = await new Promise<string | null>((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), exportTimeoutMs);

      source.toDataURL((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      }, { width: exportWidth, height: exportHeight });
    });

    if (!base64) {
      return null;
    }

    const destination = `${FileSystem.cacheDirectory}mongchi-share-card-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(destination, base64, {
      encoding: FileSystem.EncodingType.Base64
    });

    return destination;
  } catch {
    return null;
  }
};

export type { SvgDataUrlSource };
