import { beforeEach, describe, expect, it } from "vitest";

import {
  AUDIO_SETTINGS_STORAGE_KEY,
  defaultAudioSettings,
  getActiveAudioSettings,
  readStoredAudioSettings,
  setActiveAudioSettings,
  writeStoredAudioSettings
} from "./useAudioSettings";
import type { AudioSettingsStorage } from "./useAudioSettings";

const createMemoryStorage = (): AudioSettingsStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    }
  };
};

describe("useAudioSettings", () => {
  beforeEach(() => {
    // Reset module-level active settings between tests since it's a shared singleton.
    setActiveAudioSettings(defaultAudioSettings);
  });

  describe("defaultAudioSettings", () => {
    it("defaults sounds to on", () => {
      expect(defaultAudioSettings.soundsEnabled).toBe(true);
    });

    it("defaults music & ambience to on, independent of sounds", () => {
      expect(defaultAudioSettings.musicEnabled).toBe(true);
    });
  });

  describe("readStoredAudioSettings / writeStoredAudioSettings", () => {
    it("round-trips stored settings", async () => {
      const storage = createMemoryStorage();

      await writeStoredAudioSettings({ soundsEnabled: false, musicEnabled: false }, storage);

      expect(storage.values.get(AUDIO_SETTINGS_STORAGE_KEY)).toBe(
        JSON.stringify({ soundsEnabled: false, musicEnabled: false })
      );
      await expect(readStoredAudioSettings(storage)).resolves.toEqual({
        soundsEnabled: false,
        musicEnabled: false
      });
    });

    it("round-trips soundsEnabled and musicEnabled independently", async () => {
      const storage = createMemoryStorage();

      await writeStoredAudioSettings({ soundsEnabled: false, musicEnabled: true }, storage);

      await expect(readStoredAudioSettings(storage)).resolves.toEqual({
        soundsEnabled: false,
        musicEnabled: true
      });
    });

    it("falls back to defaults when nothing is stored", async () => {
      const storage = createMemoryStorage();

      await expect(readStoredAudioSettings(storage)).resolves.toEqual(defaultAudioSettings);
    });

    it("falls back to defaults when the stored value is malformed JSON", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, "not-json{");

      await expect(readStoredAudioSettings(storage)).resolves.toEqual(defaultAudioSettings);
    });

    it("falls back to defaults when the stored value has the wrong shape", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({ somethingElse: true }));

      await expect(readStoredAudioSettings(storage)).resolves.toEqual(defaultAudioSettings);
    });

    it("falls back to defaults when storage throws", async () => {
      const storage: AudioSettingsStorage = {
        getItem: async () => {
          throw new Error("storage unavailable");
        },
        setItem: async () => {}
      };

      await expect(readStoredAudioSettings(storage)).resolves.toEqual(defaultAudioSettings);
    });

    it("defaults musicEnabled to on when reading settings persisted by a pre-Phase-2 app version", async () => {
      const storage = createMemoryStorage();
      // Simulates a stored object from before the musicEnabled field existed.
      await storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({ soundsEnabled: false }));

      await expect(readStoredAudioSettings(storage)).resolves.toEqual({
        soundsEnabled: false,
        musicEnabled: true
      });
    });
  });

  describe("getActiveAudioSettings / setActiveAudioSettings", () => {
    it("starts at the default settings", () => {
      expect(getActiveAudioSettings()).toEqual(defaultAudioSettings);
    });

    it("updates the active settings", () => {
      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: false });

      expect(getActiveAudioSettings()).toEqual({ soundsEnabled: false, musicEnabled: false });
    });

    it("updates musicEnabled independently of soundsEnabled", () => {
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false });

      expect(getActiveAudioSettings()).toEqual({ soundsEnabled: true, musicEnabled: false });
    });

    it("is idempotent when set to the same settings already active", () => {
      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: false });
      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: false });

      expect(getActiveAudioSettings()).toEqual({ soundsEnabled: false, musicEnabled: false });
    });
  });
});
