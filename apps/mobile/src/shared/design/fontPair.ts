import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Two installed font pairs for the W2 comparison. Pair A is the shipped
// default; Pair B is a dev-only comparison toggle (see SettingsScreen).
// Adding a third pair later only means: add its id here, add its family
// names to fontPairFamilies, and register its weights in the useFonts map
// in app/_layout.tsx.
export const fontPairIds = ["A", "B"] as const;
export type FontPairId = (typeof fontPairIds)[number];

export const defaultFontPairId: FontPairId = "A";

export const fontPairLabels: Record<FontPairId, string> = {
  A: "Pixelify Sans + Baloo 2",
  B: "Fredoka + Nunito"
};

export interface FontPairFamilies {
  /** Display/title/bubble faces. */
  display: string;
  /** Body/button/input faces. */
  body: string;
}

export const fontPairFamilies: Record<FontPairId, FontPairFamilies> = {
  A: {
    display: "PixelifySans_700Bold",
    body: "Baloo2_700Bold"
  },
  B: {
    display: "Fredoka_600SemiBold",
    body: "Nunito_700Bold"
  }
};

export const FONT_PAIR_STORAGE_KEY = "mongchi/dev-font-pair-v1";

export interface FontPairStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export const defaultFontPairStorage: FontPairStorage = AsyncStorage;

export const isFontPairId = (value: string | null | undefined): value is FontPairId =>
  value === "A" || value === "B";

export const readStoredFontPairId = async (
  storage: FontPairStorage = defaultFontPairStorage
): Promise<FontPairId> => {
  try {
    const stored = await storage.getItem(FONT_PAIR_STORAGE_KEY);
    return isFontPairId(stored) ? stored : defaultFontPairId;
  } catch {
    return defaultFontPairId;
  }
};

export const writeStoredFontPairId = async (
  pairId: FontPairId,
  storage: FontPairStorage = defaultFontPairStorage
): Promise<void> => {
  await storage.setItem(FONT_PAIR_STORAGE_KEY, pairId);
};

// Module-level active pair + subscriber list. This is the single place a
// pair switch happens: components that read typography via useFontPair()
// re-render when setActiveFontPairId runs, without needing a React context
// provider wrapping the whole tree (matches this app's existing pattern of
// a light module-level flag in app/_layout.tsx for the initial default font).
let activeFontPairId: FontPairId = defaultFontPairId;
const listeners = new Set<(pairId: FontPairId) => void>();

export const getActiveFontPairId = (): FontPairId => activeFontPairId;

export const setActiveFontPairId = (pairId: FontPairId): void => {
  if (activeFontPairId === pairId) {
    return;
  }

  activeFontPairId = pairId;
  listeners.forEach((listener) => listener(pairId));
};

const subscribeToFontPair = (listener: (pairId: FontPairId) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Reads the active font pair and re-renders the caller when it changes.
 * On mount, hydrates the pair from storage once (dev toggle persistence).
 */
export const useFontPair = (storage: FontPairStorage = defaultFontPairStorage): [FontPairId, (pairId: FontPairId) => void] => {
  const [pairId, setPairId] = useState(getActiveFontPairId);

  useEffect(() => subscribeToFontPair(setPairId), []);

  useEffect(() => {
    let cancelled = false;

    void readStoredFontPairId(storage).then((stored) => {
      if (!cancelled) {
        setActiveFontPairId(stored);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPair = useCallback(
    (nextPairId: FontPairId) => {
      setActiveFontPairId(nextPairId);
      void writeStoredFontPairId(nextPairId, storage);
    },
    [storage]
  );

  return [pairId, setPair];
};
