export const supportedAppLocales = ["en-US", "ko-KR", "ja-JP", "zh-TW", "de-DE", "fr-FR", "pt-BR", "es-MX"] as const;
export type AppLocale = (typeof supportedAppLocales)[number];

export const defaultAppLocale: AppLocale = "en-US";

export const normalizeAppLocale = (languageTag: string | null | undefined): AppLocale => {
  const normalizedTag = languageTag?.replaceAll("_", "-").toLowerCase();
  const language = normalizedTag?.split("-")[0];

  switch (language) {
    case "ko":
      return "ko-KR";
    case "ja":
      return "ja-JP";
    case "de":
      return "de-DE";
    case "fr":
      return "fr-FR";
    case "pt":
      return "pt-BR";
    case "es":
      return "es-MX";
    case "zh":
      return normalizedTag?.includes("tw") || normalizedTag?.includes("hk") || normalizedTag?.includes("mo") || normalizedTag?.includes("hant")
        ? "zh-TW"
        : defaultAppLocale;
    default:
      return defaultAppLocale;
  }
};
