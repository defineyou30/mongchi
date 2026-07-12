import type { AppLocale } from "./localeNormalization";

export type LocalizedText = Readonly<Record<AppLocale, string>>;

export const getLocalizedText = (locale: AppLocale, copy: LocalizedText): string => copy[locale];
