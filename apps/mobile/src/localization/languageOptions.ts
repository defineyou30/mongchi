import type { AppLocale } from "./localeNormalization";

interface LanguageOption {
  code: string;
  locale: AppLocale;
  nativeLabel: string;
}

export const appLanguageOptions = [
  { code: "EN", locale: "en-US", nativeLabel: "English" },
  { code: "KO", locale: "ko-KR", nativeLabel: "한국어" },
  { code: "JA", locale: "ja-JP", nativeLabel: "日本語" },
  { code: "繁", locale: "zh-TW", nativeLabel: "繁體中文" },
  { code: "DE", locale: "de-DE", nativeLabel: "Deutsch" },
  { code: "FR", locale: "fr-FR", nativeLabel: "Français" },
  { code: "PT", locale: "pt-BR", nativeLabel: "Português (Brasil)" },
  { code: "ES", locale: "es-MX", nativeLabel: "Español (México)" }
] as const satisfies readonly LanguageOption[];

export const getNativeLanguageName = (locale: AppLocale): string =>
  appLanguageOptions.find((option) => option.locale === locale)?.nativeLabel ?? "English";
