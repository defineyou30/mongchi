import { useCallback, useSyncExternalStore } from "react";

import { updateAppLanguagePreference } from "./config";
import {
  getActiveAppLanguagePreference,
  subscribeToAppLanguagePreference
} from "./languagePreference";
import type { AppLanguagePreference } from "./languagePreference";

export const useAppLanguagePreference = (): readonly [
  AppLanguagePreference,
  (preference: AppLanguagePreference) => Promise<boolean>
] => {
  const preference = useSyncExternalStore(
    subscribeToAppLanguagePreference,
    getActiveAppLanguagePreference,
    getActiveAppLanguagePreference
  );
  const updatePreference = useCallback(
    (nextPreference: AppLanguagePreference) => updateAppLanguagePreference(nextPreference),
    []
  );

  return [preference, updatePreference] as const;
};
