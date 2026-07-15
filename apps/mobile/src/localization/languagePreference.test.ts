import { describe, expect, it, vi } from "vitest";

import {
  APP_LANGUAGE_PREFERENCE_STORAGE_KEY,
  deviceLanguagePreference,
  getActiveAppLanguagePreference,
  isAppLanguagePreference,
  readStoredAppLanguagePreference,
  resolveAppLanguagePreference,
  setActiveAppLanguagePreference,
  subscribeToAppLanguagePreference,
  writeStoredAppLanguagePreference
} from "./languagePreference";
import type { LanguagePreferenceStorage } from "./languagePreference";

const createMemoryStorage = (): LanguagePreferenceStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    }
  };
};

describe("app language preference", () => {
  it("uses the device locale when no override is stored", async () => {
    const storage = createMemoryStorage();

    expect(await readStoredAppLanguagePreference(storage)).toBe(deviceLanguagePreference);
    expect(resolveAppLanguagePreference(deviceLanguagePreference, "ko-KR")).toBe("ko-KR");
  });

  it("persists and resolves an explicit locale override", async () => {
    const storage = createMemoryStorage();

    await writeStoredAppLanguagePreference("ja-JP", storage);

    expect(storage.values.get(APP_LANGUAGE_PREFERENCE_STORAGE_KEY)).toBe("ja-JP");
    expect(await readStoredAppLanguagePreference(storage)).toBe("ja-JP");
    expect(resolveAppLanguagePreference("ja-JP", "ko-KR")).toBe("ja-JP");
  });

  it("falls back to device language for invalid or unreadable stored values", async () => {
    const invalidStorage = createMemoryStorage();
    invalidStorage.values.set(APP_LANGUAGE_PREFERENCE_STORAGE_KEY, "it-IT");
    const failingStorage: LanguagePreferenceStorage = {
      getItem: async () => {
        throw new Error("storage unavailable");
      },
      setItem: async () => undefined
    };

    expect(isAppLanguagePreference("zh-TW")).toBe(true);
    expect(isAppLanguagePreference("it-IT")).toBe(false);
    expect(await readStoredAppLanguagePreference(invalidStorage)).toBe(deviceLanguagePreference);
    expect(await readStoredAppLanguagePreference(failingStorage)).toBe(deviceLanguagePreference);
  });

  it("notifies mounted language controls when the active preference changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAppLanguagePreference(listener);

    setActiveAppLanguagePreference("fr-FR");
    setActiveAppLanguagePreference("fr-FR");
    unsubscribe();
    setActiveAppLanguagePreference(deviceLanguagePreference);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getActiveAppLanguagePreference()).toBe(deviceLanguagePreference);
  });
});
