import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUDIO_SETTINGS_STORAGE_KEY = "mongchi.audioSettings";

export interface AudioSettings {
  soundsEnabled: boolean;
  /** BGM + ambience master toggle. Defaults to on, independent of soundsEnabled. */
  musicEnabled: boolean;
  hapticsEnabled: boolean;
}

export const defaultAudioSettings: AudioSettings = {
  soundsEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true
};

export interface AudioSettingsStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export const defaultAudioSettingsStorage: AudioSettingsStorage = AsyncStorage;

type StoredAudioSettings = Pick<AudioSettings, "soundsEnabled"> & Partial<AudioSettings>;

const isAudioSettings = (value: unknown): value is StoredAudioSettings =>
  typeof value === "object" && value !== null && typeof Reflect.get(value, "soundsEnabled") === "boolean";

/**
 * Fills in the independently introduced music and haptic fields for older
 * installs. Migration is intentionally opt-out: existing users retain their
 * SFX preference while receiving the same enabled defaults as a fresh install.
 */
const withAudioDefaults = (value: StoredAudioSettings): AudioSettings => ({
  soundsEnabled: value.soundsEnabled,
  musicEnabled: typeof value.musicEnabled === "boolean" ? value.musicEnabled : defaultAudioSettings.musicEnabled,
  hapticsEnabled: typeof value.hapticsEnabled === "boolean" ? value.hapticsEnabled : defaultAudioSettings.hapticsEnabled
});

export const readStoredAudioSettings = async (
  storage: AudioSettingsStorage = defaultAudioSettingsStorage
): Promise<AudioSettings> => {
  try {
    const stored = await storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);

    if (!stored) {
      return defaultAudioSettings;
    }

    const parsed = JSON.parse(stored);
    return isAudioSettings(parsed) ? withAudioDefaults(parsed) : defaultAudioSettings;
  } catch {
    return defaultAudioSettings;
  }
};

export const writeStoredAudioSettings = async (
  settings: AudioSettings,
  storage: AudioSettingsStorage = defaultAudioSettingsStorage
): Promise<void> => {
  await storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

// Module-level active settings + subscriber list, same pattern as
// useFontPair: sfxPlayer/haptics can read the current toggle synchronously
// via getActiveAudioSettings() without needing a React context provider,
// while components that render the toggle re-render on change via the hook.
let activeAudioSettings: AudioSettings = defaultAudioSettings;
const listeners = new Set<(settings: AudioSettings) => void>();

export const getActiveAudioSettings = (): AudioSettings => activeAudioSettings;

export const setActiveAudioSettings = (settings: AudioSettings): void => {
  if (
    activeAudioSettings.soundsEnabled === settings.soundsEnabled &&
    activeAudioSettings.musicEnabled === settings.musicEnabled &&
    activeAudioSettings.hapticsEnabled === settings.hapticsEnabled
  ) {
    return;
  }

  activeAudioSettings = settings;
  listeners.forEach((listener) => listener(settings));
};

const subscribeToAudioSettings = (listener: (settings: AudioSettings) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Bugfix (see the real-device report this fixed): getActiveAudioSettings()
// used to only ever reflect the real persisted settings once SettingsScreen
// happened to mount its useAudioSettings() hook -- until then (e.g. the
// whole rest of a session that never opens Settings, or the first several
// seconds of a fresh app launch), it silently returned the in-memory
// defaultAudioSettings (soundsEnabled/musicEnabled both true) regardless of
// what the user had actually turned off last time. That let BGM ignore a
// persisted "off" toggle whenever it was triggered early -- notably
// app/_layout.tsx's onboarding-start BGM call and
// TerrariumSessionProvider's theme-sync effect, both of which can fire
// before the user ever visits Settings.
//
// ensureAudioSettingsHydrated lets those two call sites explicitly await the
// real persisted value before deciding whether to start playback, without
// making every importer of this module (including plain unit tests that
// never touch AsyncStorage) inherit an automatic background read -- it only
// runs when a caller opts in, and only performs the actual read once
// (single-flight; concurrent/later callers get the same in-flight promise).
let hydrationPromise: Promise<AudioSettings> | null = null;

export const ensureAudioSettingsHydrated = (storage: AudioSettingsStorage = defaultAudioSettingsStorage): Promise<AudioSettings> => {
  if (!hydrationPromise) {
    hydrationPromise = readStoredAudioSettings(storage)
      .then((stored) => {
        setActiveAudioSettings(stored);
        return stored;
      })
      .catch(() => getActiveAudioSettings());
  }

  return hydrationPromise;
};

/** Test-only: lets a fresh test re-trigger ensureAudioSettingsHydrated's read instead of reusing a previous test's cached promise. */
export const resetAudioSettingsHydrationForTests = (): void => {
  hydrationPromise = null;
};

/**
 * Reads the active audio settings and re-renders the caller when they
 * change. On mount, hydrates settings from storage once.
 */
export const useAudioSettings = (
  storage: AudioSettingsStorage = defaultAudioSettingsStorage
): [AudioSettings, (settings: AudioSettings) => void] => {
  const [settings, setSettings] = useState(getActiveAudioSettings);

  useEffect(() => subscribeToAudioSettings(setSettings), []);

  useEffect(() => {
    let cancelled = false;

    void readStoredAudioSettings(storage).then((stored) => {
      if (!cancelled) {
        setActiveAudioSettings(stored);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAndPersist = useCallback(
    (nextSettings: AudioSettings) => {
      setActiveAudioSettings(nextSettings);
      void writeStoredAudioSettings(nextSettings, storage);
    },
    [storage]
  );

  return [settings, setAndPersist];
};
