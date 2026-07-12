import type { AppLocale } from "./localeNormalization";
import { deDE } from "./resources/de-DE";
import { enUS } from "./resources/en-US";
import { esMX } from "./resources/es-MX";
import { frFR } from "./resources/fr-FR";
import { jaJP } from "./resources/ja-JP";
import { koKR } from "./resources/ko-KR";
import { ptBR } from "./resources/pt-BR";
import { zhTW } from "./resources/zh-TW";

type StringResource<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : StringResource<T[Key]>;
};

export type AppTranslationResource = StringResource<typeof enUS>;

export const appResourcesByLocale = {
  "en-US": enUS,
  "ko-KR": koKR,
  "ja-JP": jaJP,
  "zh-TW": zhTW,
  "de-DE": deDE,
  "fr-FR": frFR,
  "pt-BR": ptBR,
  "es-MX": esMX
} as const satisfies Record<AppLocale, AppTranslationResource>;

export const getResourcesForLocale = (locale: AppLocale): AppTranslationResource => appResourcesByLocale[locale];
