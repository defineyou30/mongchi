import * as FileSystem from "expo-file-system/legacy";

interface SvgDataUrlSource {
  toDataURL: (
    callback: (base64: string) => void,
    options: { readonly width: number; readonly height: number }
  ) => void;
}

// Single source of truth for the exported PNG's pixel size (a 4:5 poster).
// MongchiShareCard's hidden capture host must be laid out at this exact
// size -- see its captureHostStyle -- because react-native-svg's toDataURL
// renders content scaled to the SvgView's own on-screen bounds and only
// resizes the output *canvas* to these width/height options (see
// RNSVGSvgView#drawRect: in the native module, which reads self.bounds
// rather than the size requested here).
export const shareCardExportWidth = 1080;
export const shareCardExportHeight = 1350;
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
      }, { width: shareCardExportWidth, height: shareCardExportHeight });
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
