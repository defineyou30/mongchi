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
  });

  describe("readStoredAudioSettings / writeStoredAudioSettings", () => {
    it("round-trips stored settings", async () => {
      const storage = createMemoryStorage();

      await writeStoredAudioSettings({ soundsEnabled: false }, storage);

      expect(storage.values.get(AUDIO_SETTINGS_STORAGE_KEY)).toBe(JSON.stringify({ soundsEnabled: false }));
      await expect(readStoredAudioSettings(storage)).resolves.toEqual({ soundsEnabled: false });
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
  });

  describe("getActiveAudioSettings / setActiveAudioSettings", () => {
    it("starts at the default settings", () => {
      expect(getActiveAudioSettings()).toEqual(defaultAudioSettings);
    });

    it("updates the active settings", () => {
      setActiveAudioSettings({ soundsEnabled: false });

      expect(getActiveAudioSettings()).toEqual({ soundsEnabled: false });
    });

    it("is idempotent when set to the same settings already active", () => {
      setActiveAudioSettings({ soundsEnabled: false });
      setActiveAudioSettings({ soundsEnabled: false });

      expect(getActiveAudioSettings()).toEqual({ soundsEnabled: false });
    });
  });
});
