import { useCallback, useEffect, useState } from "react";

import type { NotificationPreferences } from "./notificationContracts";
import {
  defaultNotificationPreferencesStorage,
  getActiveNotificationPreferences,
  NOTIFICATION_PREFERENCES_STORAGE_KEY,
  readStoredNotificationPreferences,
  setActiveNotificationPreferences,
  subscribeToNotificationPreferences,
  writeStoredNotificationPreferences,
  type NotificationPreferencesStorage
} from "./notificationPreferencesStore";

export {
  defaultNotificationPreferencesStorage,
  getActiveNotificationPreferences,
  NOTIFICATION_PREFERENCES_STORAGE_KEY,
  readStoredNotificationPreferences,
  setActiveNotificationPreferences,
  subscribeToNotificationPreferences,
  writeStoredNotificationPreferences
};
export type { NotificationPreferencesStorage };

/**
 * Reads the active notification preferences and re-renders the caller when
 * they change. On mount, hydrates preferences from storage once.
 *
 * Two grouped toggles are exposed in the UI (see SettingsScreen.tsx):
 * "Care reminders" sets gardenCare + returnReminders together, and "Walk
 * updates" sets walkReturns alone.
 */
export const useNotificationPreferences = (
  storage: NotificationPreferencesStorage = defaultNotificationPreferencesStorage
): [NotificationPreferences, (preferences: NotificationPreferences) => void] => {
  const [preferences, setPreferences] = useState(getActiveNotificationPreferences);

  useEffect(() => subscribeToNotificationPreferences(setPreferences), []);

  useEffect(() => {
    let cancelled = false;

    void readStoredNotificationPreferences(storage).then((stored) => {
      if (!cancelled) {
        setActiveNotificationPreferences(stored);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAndPersist = useCallback(
    (next: NotificationPreferences) => {
      setActiveNotificationPreferences(next);
      void writeStoredNotificationPreferences(next, storage);
    },
    [storage]
  );

  return [preferences, setAndPersist];
};
