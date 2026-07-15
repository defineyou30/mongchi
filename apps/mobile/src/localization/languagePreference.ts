import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppLocale } from "./localeNormalization";
import { supportedAppLocales } from "./localeNormalization";

export const APP_LANGUAGE_PREFERENCE_STORAGE_KEY = "mongchi/app-language-preference-v1";
export const deviceLanguagePreference = "device" as const;

export type AppLanguagePreference = AppLocale | typeof deviceLanguagePreference;

export interface LanguagePreferenceStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export const defaultLanguagePreferenceStorage: LanguagePreferenceStorage = AsyncStorage;

let activeAppLanguagePreference: AppLanguagePreference = deviceLanguagePreference;
const preferenceListeners = new Set<() => void>();

export const getActiveAppLanguagePreference = (): AppLanguagePreference => activeAppLanguagePreference;

export const setActiveAppLanguagePreference = (preference: AppLanguagePreference): void => {
  if (activeAppLanguagePreference === preference) {
    return;
  }

  activeAppLanguagePreference = preference;
  preferenceListeners.forEach((listener) => listener());
};

export const subscribeToAppLanguagePreference = (listener: () => void): (() => void) => {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
};

export const isAppLanguagePreference = (value: string | null | undefined): value is AppLanguagePreference =>
  value === deviceLanguagePreference || supportedAppLocales.some((locale) => locale === value);

export const resolveAppLanguagePreference = (
  preference: AppLanguagePreference,
  deviceLocale: AppLocale
): AppLocale => preference === deviceLanguagePreference ? deviceLocale : preference;

export const readStoredAppLanguagePreference = async (
  storage: LanguagePreferenceStorage = defaultLanguagePreferenceStorage
): Promise<AppLanguagePreference> => {
  try {
    const stored = await storage.getItem(APP_LANGUAGE_PREFERENCE_STORAGE_KEY);
    return isAppLanguagePreference(stored) ? stored : deviceLanguagePreference;
  } catch {
    return deviceLanguagePreference;
  }
};

export const writeStoredAppLanguagePreference = async (
  preference: AppLanguagePreference,
  storage: LanguagePreferenceStorage = defaultLanguagePreferenceStorage
): Promise<void> => {
  await storage.setItem(APP_LANGUAGE_PREFERENCE_STORAGE_KEY, preference);
};
