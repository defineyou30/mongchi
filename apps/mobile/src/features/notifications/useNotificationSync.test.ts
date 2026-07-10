import { beforeEach, describe, expect, it, vi } from "vitest";

const { effects, getItem, setItem, syncScheduledPetNotifications, addNotificationReceivedListener } = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  getItem: vi.fn(),
  setItem: vi.fn(),
  syncScheduledPetNotifications: vi.fn(),
  addNotificationReceivedListener: vi.fn()
}));

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => {
    effects.push(effect);
  },
  useRef: <T>(initial: T) => ({ current: initial })
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (...args: unknown[]) => getItem(...args),
    setItem: (...args: unknown[]) => setItem(...args)
  }
}));

vi.mock("expo-notifications", () => ({
  addNotificationReceivedListener: (...args: unknown[]) => addNotificationReceivedListener(...args)
}));

vi.mock("../session/TerrariumSessionProvider", () => ({
  useTerrariumSession: () => ({
    isHydrated: true,
    petProfile: { name: "Miso" },
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
    weatherState: { context: null }
  })
}));

vi.mock("./notificationScheduler", () => ({
  syncScheduledPetNotifications: (...args: unknown[]) => syncScheduledPetNotifications(...args)
}));

import { useNotificationSync } from "./useNotificationSync";

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  effects.length = 0;
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
  addNotificationReceivedListener.mockReturnValue({ remove: vi.fn() });
  syncScheduledPetNotifications.mockResolvedValue({
    scheduledCount: 1,
    scheduledKeys: ["meal_due"],
    scheduled: [{ key: "meal_due", notificationId: "garden-id" }],
    failedKeys: []
  });
});

describe("useNotificationSync delivery history", () => {
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
