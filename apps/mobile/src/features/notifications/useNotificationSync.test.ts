import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  effects,
  effectDependencies,
  getItem,
  setItem,
  removeItem,
  syncScheduledPetNotifications,
  addNotificationReceivedListener,
  configureGardenNotificationChannel,
  cancelPersistedWalkReturnNotification,
  synchronizeWalkReturnNotification,
  synchronizeMonthlyLetterNotification,
  walk,
  language
} = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  effectDependencies: [] as Array<readonly unknown[] | undefined>,
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  syncScheduledPetNotifications: vi.fn(),
  addNotificationReceivedListener: vi.fn(),
  configureGardenNotificationChannel: vi.fn(),
  cancelPersistedWalkReturnNotification: vi.fn(),
  synchronizeWalkReturnNotification: vi.fn(),
  synchronizeMonthlyLetterNotification: vi.fn(),
  walk: { current: null as null | { id: string; status: string; returnAt: string } },
  language: { current: "en-US" }
}));

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]) => {
    effects.push(effect);
    effectDependencies.push(dependencies);
  },
  useRef: <T>(initial: T) => ({ current: initial })
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: language.current }
  })
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (...args: unknown[]) => getItem(...args),
    setItem: (...args: unknown[]) => setItem(...args),
    removeItem: (...args: unknown[]) => removeItem(...args)
  }
}));

vi.mock("expo-notifications", () => ({
  addNotificationReceivedListener: (...args: unknown[]) => addNotificationReceivedListener(...args)
}));

vi.mock("../session/TerrariumSessionProvider", () => ({
  useTerrariumSession: () => ({
    isHydrated: true,
    petProfile: { name: "Miso", createdAt: "2026-06-01T00:00:00.000Z" },
    careState: {
      satiety: 50,
      happiness: 50,
      energy: 50,
      gardenHealth: 50,
      cleanliness: 50,
      affection: 50,
      lastFedAt: "2026-07-10T00:00:00.000Z",
      lastInteractionAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z"
    },
    careStreak: { current: 2 },
    satisfactionSummary: null,
    weatherState: { context: null },
    activeWalk: walk.current
  })
}));

vi.mock("./notificationScheduler", () => ({
  syncScheduledPetNotifications: (...args: unknown[]) => syncScheduledPetNotifications(...args)
}));

vi.mock("./notificationPermission", () => ({
  configureGardenNotificationChannel: (...args: unknown[]) => configureGardenNotificationChannel(...args)
}));

vi.mock("./walkReturnNotification", () => ({
  cancelPersistedWalkReturnNotification: (...args: unknown[]) => cancelPersistedWalkReturnNotification(...args),
  synchronizeWalkReturnNotification: (...args: unknown[]) => synchronizeWalkReturnNotification(...args)
}));

vi.mock("./monthlyLetterNotification", () => ({
  synchronizeMonthlyLetterNotification: (...args: unknown[]) => synchronizeMonthlyLetterNotification(...args)
}));

import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notificationContracts";
import { resetNotificationPreferencesListenersForTests, setActiveNotificationPreferences } from "./notificationPreferencesStore";
import { useNotificationSync } from "./useNotificationSync";

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  effects.length = 0;
  effectDependencies.length = 0;
  language.current = "en-US";
  walk.current = null;
  // The preferences store is a real, unmocked module-level singleton -- reset
  // it to the opt-out defaults, and drop any subscribers a previous test
  // left behind (e.g. via the "run every effect" loop below, which also
  // invokes the preference-subscription effect), before every test.
  resetNotificationPreferencesListenersForTests();
  setActiveNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
  removeItem.mockResolvedValue(undefined);
  addNotificationReceivedListener.mockReturnValue({ remove: vi.fn() });
  configureGardenNotificationChannel.mockResolvedValue(undefined);
  cancelPersistedWalkReturnNotification.mockResolvedValue(undefined);
  synchronizeWalkReturnNotification.mockResolvedValue({ notificationId: "walk-id" });
  synchronizeMonthlyLetterNotification.mockResolvedValue({ notificationId: null, skippedReason: "not_arrived_yet" });
  syncScheduledPetNotifications.mockResolvedValue({
    scheduledCount: 1,
    scheduledKeys: ["meal_due"],
    scheduled: [{ key: "meal_due", notificationId: "garden-id" }],
    failedKeys: []
  });
});

describe("useNotificationSync delivery history", () => {
  it("tracks the active locale so a language change reschedules localized notifications", () => {
    language.current = "ja-JP";

    useNotificationSync();

    expect(effectDependencies[1]).toContain("ja-JP");
  });

  it("refreshes the Android channel and replaces an active walk reminder when locale changes", async () => {
    language.current = "ja-JP";
    walk.current = {
      id: "walk-1",
      status: "walking",
      returnAt: "2026-07-12T04:03:00.000Z"
    };

    useNotificationSync();
    effects[1]?.();
    await flush();

    expect(configureGardenNotificationChannel).toHaveBeenCalledTimes(1);
    expect(synchronizeWalkReturnNotification).toHaveBeenCalledWith({
      petName: "Miso",
      returnAt: "2026-07-12T04:03:00.000Z",
      preferences: { walkReturns: true }
    });
  });

  it("does not mark a notification as sent merely because scheduling succeeded", async () => {
    useNotificationSync();

    for (const effect of effects) {
      effect();
    }
    await flush();

    expect(syncScheduledPetNotifications).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("records a garden key only after Expo reports that notification as delivered", async () => {
    useNotificationSync();

    for (const effect of effects) {
      effect();
    }
    await flush();

    const listener = addNotificationReceivedListener.mock.calls[0]?.[0] as ((notification: unknown) => void) | undefined;
    listener?.({
      date: Date.parse("2026-07-10T01:00:00.000Z"),
      request: {
        content: {
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "garden",
            mongchiNotificationKey: "meal_due",
            mongchiNotificationAction: "feed"
          }
        }
      }
    });
    await flush();

    expect(setItem).toHaveBeenCalledWith(
      "mongchi/notification-last-delivered-v2",
      JSON.stringify({ meal_due: "2026-07-10T01:00:00.000Z" })
    );
  });

  it("ignores malformed and walk-owned delivery payloads for garden throttle history", async () => {
    useNotificationSync();

    for (const effect of effects) {
      effect();
    }
    const listener = addNotificationReceivedListener.mock.calls[0]?.[0] as ((notification: unknown) => void) | undefined;
    listener?.({ date: Date.now(), request: { content: { data: { source: "legacy" } } } });
    listener?.({
      date: Date.now(),
      request: {
        content: {
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "walk",
            mongchiNotificationKey: "walk_return",
            mongchiNotificationAction: "walk"
          }
        }
      }
    });
    await flush();

    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("useNotificationSync notification preferences", () => {
  it("synchronizes the monthly letter notification with the pet's move-in date and the gardenCare preference", async () => {
    useNotificationSync();
    effects[1]?.();
    await flush();

    expect(synchronizeMonthlyLetterNotification).toHaveBeenCalledWith({
      petName: "Miso",
      movedInAt: "2026-06-01T00:00:00.000Z",
      preferences: { gardenCare: true }
    });
  });

  it("passes the active notification preferences through to the daily/return-ladder scheduler", async () => {
    useNotificationSync();

    for (const effect of effects) {
      effect();
    }
    await flush();

    expect(syncScheduledPetNotifications).toHaveBeenCalledWith(expect.any(Object), DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("does not schedule a walk reminder or honor gardenCare once those preferences are turned off", async () => {
    setActiveNotificationPreferences({ gardenCare: false, returnReminders: true, walkReturns: false });
    walk.current = { id: "walk-1", status: "walking", returnAt: "2026-07-12T04:03:00.000Z" };

    useNotificationSync();
    effects[1]?.();
    await flush();

    expect(synchronizeMonthlyLetterNotification).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: { gardenCare: false } })
    );
    expect(synchronizeWalkReturnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: { walkReturns: false } })
    );
  });

  it("resyncs the walk/letter and daily/return schedules immediately when a preference toggles, without waiting for a care-state change", async () => {
    useNotificationSync();
    // Simulate the app having already hydrated once, populating the "latest sync" refs.
    effects[1]?.();
    effects[2]?.();
    await flush();
    vi.clearAllMocks();

    effects[3]?.();
    setActiveNotificationPreferences({ gardenCare: false, returnReminders: true, walkReturns: true });
    await flush();

    expect(synchronizeMonthlyLetterNotification).toHaveBeenCalledTimes(1);
    expect(syncScheduledPetNotifications).toHaveBeenCalledTimes(1);
  });

  it("stops resyncing after the preference-subscription effect's cleanup runs", async () => {
    useNotificationSync();
    effects[1]?.();
    effects[2]?.();
    await flush();

    const cleanup = effects[3]?.();
    cleanup?.();
    vi.clearAllMocks();

    setActiveNotificationPreferences({ gardenCare: false, returnReminders: true, walkReturns: true });
    await flush();

    expect(synchronizeMonthlyLetterNotification).not.toHaveBeenCalled();
    expect(syncScheduledPetNotifications).not.toHaveBeenCalled();
  });
});
