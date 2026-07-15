import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from "./notificationContracts";

/**
 * Deliberately React-free (no hooks) so useNotificationSync.ts -- which
 * heavily relies on its unit test mocking "react" down to just
 * useEffect/useRef -- can read/subscribe to preferences without importing
 * anything that touches useState/useCallback. useNotificationPreferences.ts
 * wraps this in a hook for SettingsScreen.tsx.
 */

export const NOTIFICATION_PREFERENCES_STORAGE_KEY = "mongchi.notificationPreferences";

export interface NotificationPreferencesStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export const defaultNotificationPreferencesStorage: NotificationPreferencesStorage = AsyncStorage;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isPartialPreferences = (value: unknown): value is Partial<NotificationPreferences> =>
  typeof value === "object" && value !== null;

/**
 * Fills in any preference fields missing from an older or partially-shaped
 * stored payload with the opt-out defaults, so a fresh install (or an
 * install predating one of these toggles) keeps every reminder on until the
 * owner turns one off.
 */
const withPreferenceDefaults = (value: Partial<NotificationPreferences>): NotificationPreferences => ({
  gardenCare: isBoolean(value.gardenCare) ? value.gardenCare : DEFAULT_NOTIFICATION_PREFERENCES.gardenCare,
  returnReminders: isBoolean(value.returnReminders) ? value.returnReminders : DEFAULT_NOTIFICATION_PREFERENCES.returnReminders,
  walkReturns: isBoolean(value.walkReturns) ? value.walkReturns : DEFAULT_NOTIFICATION_PREFERENCES.walkReturns
});

export const readStoredNotificationPreferences = async (
  storage: NotificationPreferencesStorage = defaultNotificationPreferencesStorage
): Promise<NotificationPreferences> => {
  try {
    const stored = await storage.getItem(NOTIFICATION_PREFERENCES_STORAGE_KEY);

    if (!stored) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    const parsed = JSON.parse(stored);
    return isPartialPreferences(parsed) ? withPreferenceDefaults(parsed) : DEFAULT_NOTIFICATION_PREFERENCES;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

export const writeStoredNotificationPreferences = async (
  preferences: NotificationPreferences,
  storage: NotificationPreferencesStorage = defaultNotificationPreferencesStorage
): Promise<void> => {
  await storage.setItem(NOTIFICATION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
};

// Module-level active preferences + subscriber list, same pattern as
// useAudioSettings: useNotificationSync can read the current preferences
// synchronously via getActiveNotificationPreferences() (and react to changes
// via subscribeToNotificationPreferences()) without needing a React context
// provider, while SettingsScreen re-renders on change via the hook.
let activeNotificationPreferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
const listeners = new Set<(preferences: NotificationPreferences) => void>();

export const getActiveNotificationPreferences = (): NotificationPreferences => activeNotificationPreferences;

export const setActiveNotificationPreferences = (preferences: NotificationPreferences): void => {
  if (
    activeNotificationPreferences.gardenCare === preferences.gardenCare &&
    activeNotificationPreferences.returnReminders === preferences.returnReminders &&
    activeNotificationPreferences.walkReturns === preferences.walkReturns
  ) {
    return;
  }

  activeNotificationPreferences = preferences;
  listeners.forEach((listener) => listener(preferences));
};

/**
 * Subscribes to active-preference changes -- used by useNotificationSync.ts
 * to trigger an immediate resync (and by the useNotificationPreferences hook
 * to re-render SettingsScreen) when a toggle flips.
 */
export const subscribeToNotificationPreferences = (listener: (preferences: NotificationPreferences) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Test-only escape hatch: clears every subscriber. Without this, tests that
 * exercise useNotificationSync.ts's preference-subscription effect (which
 * subscribes on every simulated mount) would accumulate listeners across
 * test cases in the same file, since this module's state is a real
 * singleton shared across the whole test file. Mirrors the
 * resetSfxPlayersForTests-style helpers already used elsewhere in this app.
 */
export const resetNotificationPreferencesListenersForTests = (): void => {
  listeners.clear();
};
