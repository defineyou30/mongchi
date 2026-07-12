import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({
  getCalendars: () => [],
  getLocales: () => []
}));

import {
  getLocalizedText,
  getResourcesForLocale,
  normalizeAppLocale,
  supportedAppLocales
} from "./locale";
import { deDE } from "./resources/de-DE";
import { enUS } from "./resources/en-US";
import { esMX } from "./resources/es-MX";
import { frFR } from "./resources/fr-FR";
import { jaJP } from "./resources/ja-JP";
import { koKR } from "./resources/ko-KR";
import { ptBR } from "./resources/pt-BR";
import { zhTW } from "./resources/zh-TW";

const getLeafPaths = (value: object, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return typeof child === "string" ? [path] : getLeafPaths(child, path);
  });

const getLeafEntries = (value: object, prefix = ""): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      return typeof child === "string" ? [[path, child]] : Object.entries(getLeafEntries(child, path));
    })
  );

const getInterpolationTokens = (value: string): readonly string[] =>
  Array.from(value.matchAll(/\{\{([^}]+)\}\}/g), (match) => match[1] ?? "").sort();

describe("normalizeAppLocale", () => {
  it("returns ko-KR when a Korean region is provided", () => {
    expect(normalizeAppLocale("ko-KP")).toBe("ko-KR");
  });

  it("returns en-US when an English region is provided", () => {
    expect(normalizeAppLocale("en-GB")).toBe("en-US");
  });

  it("normalizes every launch-market language", () => {
    expect(normalizeAppLocale("en_AU")).toBe("en-US");
    expect(normalizeAppLocale("ko_KP")).toBe("ko-KR");
    expect(normalizeAppLocale("ja")).toBe("ja-JP");
    expect(normalizeAppLocale("zh-Hant-TW")).toBe("zh-TW");
    expect(normalizeAppLocale("de-AT")).toBe("de-DE");
    expect(normalizeAppLocale("fr-CA")).toBe("fr-FR");
    expect(normalizeAppLocale("pt-PT")).toBe("pt-BR");
    expect(normalizeAppLocale("es-ES")).toBe("es-MX");
  });

  it("falls back to en-US when the language is unsupported or simplified Chinese", () => {
    expect(normalizeAppLocale("zh-CN")).toBe("en-US");
    expect(normalizeAppLocale("it-IT")).toBe("en-US");
    expect(normalizeAppLocale(null)).toBe("en-US");
  });
});

describe("locale helpers", () => {
  it("exposes resources for all eight supported locales", () => {
    expect(supportedAppLocales).toHaveLength(8);

    for (const locale of supportedAppLocales) {
      expect(getResourcesForLocale(locale).settings.title).toBeTruthy();
    }
  });

  it("selects non-English localized text without collapsing to Korean or English", () => {
    const copy = {
      "en-US": "English",
      "ko-KR": "한국어",
      "ja-JP": "日本語",
      "zh-TW": "繁體中文",
      "de-DE": "Deutsch",
      "fr-FR": "Français",
      "pt-BR": "Português (Brasil)",
      "es-MX": "Español (México)"
    } as const;

    expect(getLocalizedText("ja-JP", copy)).toBe("日本語");
    expect(getLocalizedText("fr-FR", copy)).toBe("Français");
    expect(getLocalizedText("zh-TW", copy)).toBe("繁體中文");
  });
});

describe("mobile translation resources", () => {
  it("keeps all launch-market resource keys in exact parity with the English fallback", () => {
    for (const resource of [koKR, jaJP, zhTW, deDE, frFR, ptBR, esMX]) {
      expect(getLeafPaths(resource).sort()).toEqual(getLeafPaths(enUS).sort());
    }
  });

  it("keeps interpolation tokens in parity with the English fallback", () => {
    const englishEntries = getLeafEntries(enUS);

    for (const resource of [koKR, jaJP, zhTW, deDE, frFR, ptBR, esMX]) {
      const localizedEntries = getLeafEntries(resource);

      for (const [path, englishValue] of Object.entries(englishEntries)) {
        expect(getInterpolationTokens(localizedEntries[path] ?? ""), path).toEqual(getInterpolationTokens(englishValue));
      }
    }
  });

  it("includes the release-critical localized surfaces", () => {
    expect(koKR.home.hud.labels.fullness).toBe("배부름");
    expect(koKR.friend.sections.walkFinds).toBe("산책 발견물");
    expect(koKR.shop.expressionPacks.poseCount).toBe("포즈 3개");
    expect(koKR.inventory.title).toBe("보관함");
    expect(koKR.settings.title).toBe("설정");
    expect(koKR.legal.privacy.title).toBe("사진과 대화의 안전");
  });
});
