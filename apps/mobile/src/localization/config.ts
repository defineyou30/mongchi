import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getDeviceAppLocale, getDeviceTimeZone } from "./locale";
import {
  getActiveAppLanguagePreference,
  readStoredAppLanguagePreference,
  resolveAppLanguagePreference,
  setActiveAppLanguagePreference,
  writeStoredAppLanguagePreference
} from "./languagePreference";
import type { AppLanguagePreference } from "./languagePreference";
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

const applyAppLanguagePreference = async (preference: AppLanguagePreference): Promise<void> => {
  const resolvedLocale = resolveAppLanguagePreference(preference, getDeviceAppLocale());

  if (getActiveAppLocale() !== resolvedLocale) {
    await i18n.changeLanguage(resolvedLocale);
  }
};

export const hydrateAppLanguagePreference = async (): Promise<void> => {
  const preference = await readStoredAppLanguagePreference();

  try {
    await applyAppLanguagePreference(preference);
    setActiveAppLanguagePreference(preference);
  } catch {
    setActiveAppLanguagePreference("device");
    await applyAppLanguagePreference("device").catch(() => undefined);
  }
};

export const updateAppLanguagePreference = async (
  preference: AppLanguagePreference
): Promise<boolean> => {
  const previousPreference = getActiveAppLanguagePreference();
  let persisted = false;

  try {
    await writeStoredAppLanguagePreference(preference);
    persisted = true;
    await applyAppLanguagePreference(preference);
  } catch {
    if (persisted) {
      await writeStoredAppLanguagePreference(previousPreference).catch(() => undefined);
      await applyAppLanguagePreference(previousPreference).catch(() => undefined);
    }

    return false;
  }

  setActiveAppLanguagePreference(preference);
  return true;
};

export const syncAppLocale = async (): Promise<void> => {
  await applyAppLanguagePreference(getActiveAppLanguagePreference());
};

export const getActiveTimeZone = (): string => getDeviceTimeZone();

export { i18n };
