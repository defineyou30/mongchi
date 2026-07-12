import { getCalendars, getLocales } from "expo-localization";

import { normalizeAppLocale } from "./localeNormalization";
import type { AppLocale } from "./localeNormalization";
export { defaultAppLocale, normalizeAppLocale, supportedAppLocales } from "./localeNormalization";
export type { AppLocale } from "./localeNormalization";
export { getLocalizedText } from "./localizedText";
export type { LocalizedText } from "./localizedText";
export { getResourcesForLocale } from "./resourceCatalog";
export type { AppTranslationResource } from "./resourceCatalog";

export const getDeviceAppLocale = (): AppLocale => normalizeAppLocale(getLocales()[0]?.languageTag);

export const getDeviceTimeZone = (): string => getCalendars()[0]?.timeZone ?? "UTC";
