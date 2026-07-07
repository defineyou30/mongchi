import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Phase 1 ships a single "Sounds" toggle covering SFX + haptics together
// (see docs/gamefeel-sound-plan.md §2 -- "3단 분리는 과함"). A separate
// "Music & ambience" toggle is Phase 2, once BGM/ambience players exist;
// add its own key here (e.g. `mongchi.audioSettings.music`) rather than
// overloading this one when that lands, so a user's existing SFX
// preference is never silently reinterpreted as a music preference.
export const AUDIO_SETTINGS_STORAGE_KEY = "mongchi.audioSettings";

export interface AudioSettings {
  /** SFX + haptics master toggle. Defaults to on for every player. */
  soundsEnabled: boolean;
}

export const defaultAudioSettings: AudioSettings = {
  soundsEnabled: true
};

export interface AudioSettingsStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export const defaultAudioSettingsStorage: AudioSettingsStorage = AsyncStorage;

const isAudioSettings = (value: unknown): value is AudioSettings =>
  typeof value === "object" && value !== null && typeof (value as AudioSettings).soundsEnabled === "boolean";

export const readStoredAudioSettings = async (
  storage: AudioSettingsStorage = defaultAudioSettingsStorage
): Promise<AudioSettings> => {
  try {
    const stored = await storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);

    if (!stored) {
      return defaultAudioSettings;
    }

    const parsed = JSON.parse(stored);
    return isAudioSettings(parsed) ? parsed : defaultAudioSettings;
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
    activeAudioSettings.soundsEnabled === settings.soundsEnabled
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
