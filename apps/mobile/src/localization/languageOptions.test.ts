import { describe, expect, it } from "vitest";

import { appLanguageOptions, getNativeLanguageName } from "./languageOptions";
import { supportedAppLocales } from "./localeNormalization";

describe("app language options", () => {
  it("lists every supported locale once in its native language", () => {
    expect(appLanguageOptions.map((option) => option.locale)).toEqual(supportedAppLocales);
    expect(new Set(appLanguageOptions.map((option) => option.nativeLabel)).size).toBe(8);
  });

  it("returns the native name for the current device or override locale", () => {
    expect(getNativeLanguageName("ko-KR")).toBe("한국어");
    expect(getNativeLanguageName("zh-TW")).toBe("繁體中文");
  });
});
