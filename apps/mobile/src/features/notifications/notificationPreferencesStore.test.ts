import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notificationContracts";
import {
  getActiveNotificationPreferences,
  NOTIFICATION_PREFERENCES_STORAGE_KEY,
  readStoredNotificationPreferences,
  setActiveNotificationPreferences,
  subscribeToNotificationPreferences,
  writeStoredNotificationPreferences
} from "./notificationPreferencesStore";
import type { NotificationPreferencesStorage } from "./notificationPreferencesStore";

const createMemoryStorage = (): NotificationPreferencesStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    }
  };
};

describe("notificationPreferencesStore", () => {
  beforeEach(() => {
    // Reset the module-level active preferences between tests since it's a shared singleton.
    setActiveNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  describe("DEFAULT_NOTIFICATION_PREFERENCES", () => {
    it("defaults every reminder category to on (opt-out model)", () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
        gardenCare: true,
        returnReminders: true,
        walkReturns: true
      });
    });
  });

  describe("readStoredNotificationPreferences / writeStoredNotificationPreferences", () => {
    it("round-trips stored preferences", async () => {
      const storage = createMemoryStorage();

      await writeStoredNotificationPreferences({ gardenCare: false, returnReminders: false, walkReturns: true }, storage);

      expect(storage.values.get(NOTIFICATION_PREFERENCES_STORAGE_KEY)).toBe(
        JSON.stringify({ gardenCare: false, returnReminders: false, walkReturns: true })
      );
      await expect(readStoredNotificationPreferences(storage)).resolves.toEqual({
        gardenCare: false,
        returnReminders: false,
        walkReturns: true
      });
    });

    it("falls back to defaults when nothing is stored", async () => {
      const storage = createMemoryStorage();

      await expect(readStoredNotificationPreferences(storage)).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    });

    it("falls back to defaults when the stored value is malformed JSON", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(NOTIFICATION_PREFERENCES_STORAGE_KEY, "not-json{");

      await expect(readStoredNotificationPreferences(storage)).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    });

    it("falls back to defaults when the stored value has the wrong shape", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(NOTIFICATION_PREFERENCES_STORAGE_KEY, JSON.stringify(null));

      await expect(readStoredNotificationPreferences(storage)).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    });

    it("falls back to defaults when storage throws", async () => {
      const storage: NotificationPreferencesStorage = {
        getItem: async () => {
          throw new Error("storage unavailable");
        },
        setItem: async () => {}
      };

      await expect(readStoredNotificationPreferences(storage)).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    });

    it("fills in a field missing from an older or partially-shaped stored payload with its opt-out default", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(NOTIFICATION_PREFERENCES_STORAGE_KEY, JSON.stringify({ gardenCare: false }));

      await expect(readStoredNotificationPreferences(storage)).resolves.toEqual({
        gardenCare: false,
        returnReminders: true,
        walkReturns: true
      });
    });
  });

  describe("getActiveNotificationPreferences / setActiveNotificationPreferences", () => {
    it("starts at the default preferences", () => {
      expect(getActiveNotificationPreferences()).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    });

    it("updates the active preferences", () => {
      setActiveNotificationPreferences({ gardenCare: false, returnReminders: false, walkReturns: false });

      expect(getActiveNotificationPreferences()).toEqual({ gardenCare: false, returnReminders: false, walkReturns: false });
    });

    it("updates walkReturns independently of gardenCare/returnReminders", () => {
      setActiveNotificationPreferences({ gardenCare: true, returnReminders: true, walkReturns: false });

      expect(getActiveNotificationPreferences()).toEqual({ gardenCare: true, returnReminders: true, walkReturns: false });
    });

    it("is idempotent when set to the same preferences already active", () => {
      setActiveNotificationPreferences({ gardenCare: false, returnReminders: false, walkReturns: false });
      setActiveNotificationPreferences({ gardenCare: false, returnReminders: false, walkReturns: false });

      expect(getActiveNotificationPreferences()).toEqual({ gardenCare: false, returnReminders: false, walkReturns: false });
    });
  });

  describe("subscribeToNotificationPreferences", () => {
    it("notifies subscribers with the new preferences when they change", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToNotificationPreferences(listener);

      setActiveNotificationPreferences({ gardenCare: false, returnReminders: true, walkReturns: true });

      expect(listener).toHaveBeenCalledWith({ gardenCare: false, returnReminders: true, walkReturns: true });

      unsubscribe();
    });

    it("does not notify a subscriber that has unsubscribed", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToNotificationPreferences(listener);
      unsubscribe();

      setActiveNotificationPreferences({ gardenCare: false, returnReminders: true, walkReturns: true });

      expect(listener).not.toHaveBeenCalled();
    });

    it("does not notify subscribers when the preferences are unchanged", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToNotificationPreferences(listener);

      setActiveNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);

      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });
  });
});
