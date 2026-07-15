import { describe, expect, it } from "vitest";

import { buildLocalizedExternalUrl } from "./localizedExternalUrl";

describe("buildLocalizedExternalUrl", () => {
  it("leaves the default locale (en-US) URL untouched", () => {
    expect(buildLocalizedExternalUrl("https://www.mongchi.app/privacy.html", "en-US")).toBe(
      "https://www.mongchi.app/privacy.html"
    );
  });

  it("appends a lang query parameter for non-default locales", () => {
    expect(buildLocalizedExternalUrl("https://www.mongchi.app/privacy.html", "ko-KR")).toBe(
      "https://www.mongchi.app/privacy.html?lang=ko-KR"
    );
  });

  it("preserves existing query parameters when adding lang", () => {
    expect(buildLocalizedExternalUrl("https://www.mongchi.app/terms.html?utm_source=app", "ja-JP")).toBe(
      "https://www.mongchi.app/terms.html?utm_source=app&lang=ja-JP"
    );
  });

  it("overwrites a stale lang query parameter instead of duplicating it", () => {
    expect(buildLocalizedExternalUrl("https://www.mongchi.app/terms.html?lang=fr-FR", "de-DE")).toBe(
      "https://www.mongchi.app/terms.html?lang=de-DE"
    );
  });

  it("returns the original string when the URL cannot be parsed", () => {
    expect(buildLocalizedExternalUrl("not-a-url", "zh-TW")).toBe("not-a-url");
  });
});
