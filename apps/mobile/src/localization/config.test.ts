import { beforeEach, describe, expect, it, vi } from "vitest";

const storageState = vi.hoisted(() => ({
  failWrites: false,
  values: new Map<string, string>()
}));

vi.mock("expo-localization", () => ({
  getCalendars: () => [],
  getLocales: () => [{ languageTag: "ko-KR" }]
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageState.values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      if (storageState.failWrites) {
        throw new Error("storage unavailable");
      }

      storageState.values.set(key, value);
    })
  }
}));

import {
  getActiveAppLocale,
  hydrateAppLanguagePreference,
  i18n,
  syncAppLocale,
  updateAppLanguagePreference
} from "./config";
import {
  APP_LANGUAGE_PREFERENCE_STORAGE_KEY,
  deviceLanguagePreference,
  getActiveAppLanguagePreference,
  setActiveAppLanguagePreference
} from "./languagePreference";

describe("app language configuration", () => {
  beforeEach(async () => {
    storageState.failWrites = false;
    storageState.values.clear();
    setActiveAppLanguagePreference(deviceLanguagePreference);
    await i18n.changeLanguage("ko-KR");
  });

  it("hydrates an explicit locale override before the app renders", async () => {
    storageState.values.set(APP_LANGUAGE_PREFERENCE_STORAGE_KEY, "ja-JP");

    await hydrateAppLanguagePreference();

    expect(getActiveAppLanguagePreference()).toBe("ja-JP");
    expect(getActiveAppLocale()).toBe("ja-JP");
  });

  it("keeps the previous locale when persistence fails", async () => {
    expect(await updateAppLanguagePreference("ja-JP")).toBe(true);
    storageState.failWrites = true;

    expect(await updateAppLanguagePreference("fr-FR")).toBe(false);
    expect(storageState.values.get(APP_LANGUAGE_PREFERENCE_STORAGE_KEY)).toBe("ja-JP");
    expect(getActiveAppLanguagePreference()).toBe("ja-JP");
    expect(getActiveAppLocale()).toBe("ja-JP");
  });

  it("rolls persisted state back when applying the locale fails", async () => {
    expect(await updateAppLanguagePreference("ja-JP")).toBe(true);
    const changeLanguage = vi.spyOn(i18n, "changeLanguage")
      .mockRejectedValueOnce(new Error("language unavailable"));

    expect(await updateAppLanguagePreference("fr-FR")).toBe(false);
    expect(storageState.values.get(APP_LANGUAGE_PREFERENCE_STORAGE_KEY)).toBe("ja-JP");
    expect(getActiveAppLanguagePreference()).toBe("ja-JP");
    expect(getActiveAppLocale()).toBe("ja-JP");

    changeLanguage.mockRestore();
  });

  it("does not let foreground device sync overwrite an explicit override", async () => {
    expect(await updateAppLanguagePreference("zh-TW")).toBe(true);
    await i18n.changeLanguage("ko-KR");

    await syncAppLocale();

    expect(getActiveAppLanguagePreference()).toBe("zh-TW");
    expect(getActiveAppLocale()).toBe("zh-TW");
  });

  it("uses the device locale when no override is stored", async () => {
    await i18n.changeLanguage("en-US");

    await hydrateAppLanguagePreference();

    expect(getActiveAppLanguagePreference()).toBe(deviceLanguagePreference);
    expect(getActiveAppLocale()).toBe("ko-KR");
  });
});
