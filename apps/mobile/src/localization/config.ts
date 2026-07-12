import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getDeviceAppLocale, getDeviceTimeZone } from "./locale";
import type { AppLocale } from "./localeNormalization";
import { normalizeAppLocale, supportedAppLocales } from "./localeNormalization";
import { appResourcesByLocale } from "./resourceCatalog";

const resources = Object.fromEntries(
  supportedAppLocales.map((locale) => [locale, { translation: appResourcesByLocale[locale] }])
);

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    fallbackLng: "en-US",
    initAsync: false,
    interpolation: { escapeValue: false },
    lng: getDeviceAppLocale(),
    resources,
    supportedLngs: supportedAppLocales
  });
}

export const getActiveAppLocale = (): AppLocale => normalizeAppLocale(i18n.resolvedLanguage);

export const syncAppLocale = async (): Promise<void> => {
  const deviceLocale = getDeviceAppLocale();

  if (getActiveAppLocale() !== deviceLocale) {
    await i18n.changeLanguage(deviceLocale);
  }
};

export const getActiveTimeZone = (): string => getDeviceTimeZone();

export { i18n };
