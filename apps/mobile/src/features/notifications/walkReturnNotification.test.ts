import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPermissionsAsync, scheduleNotificationAsync, cancelScheduledNotificationAsync, getItem, setItem, removeItem, runtimeLocale } = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  runtimeLocale: { current: "en-US" }
}));

vi.mock("../../localization/runtimeResources", async () => {
  const { getResourcesForLocale } = await import("../../localization/resourceCatalog");
  return {
    getRuntimeResources: () => getResourcesForLocale(runtimeLocale.current === "ja-JP" ? "ja-JP" : "en-US"),
    interpolatePetName: (value: string, petName: string) => value.replaceAll("{{petName}}", petName)
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (...args: unknown[]) => getItem(...args),
    setItem: (...args: unknown[]) => setItem(...args),
    removeItem: (...args: unknown[]) => removeItem(...args)
  }
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => getPermissionsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => scheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => cancelScheduledNotificationAsync(...args),
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval"
  }
}));

import {
  cancelWalkReturnNotification,
  getWalkReturnNotificationContent,
  scheduleWalkReturnNotification,
  synchronizeWalkReturnNotification
} from "./walkReturnNotification";

beforeEach(() => {
  vi.clearAllMocks();
  runtimeLocale.current = "en-US";
  scheduleNotificationAsync.mockResolvedValue("walk-notification-id");
  cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
  removeItem.mockResolvedValue(undefined);
});

describe("getWalkReturnNotificationContent", () => {
  it("names the pet in both the title and body", () => {
    expect(getWalkReturnNotificationContent("Mong")).toEqual({
      title: "Mong is back from the walk!",
      body: "Come see what Mong found out there."
    });
  });

  it("never includes an emoji, matching the existing no-emoji notification copy convention", () => {
    const content = getWalkReturnNotificationContent("Mong");

    expect(`${content.title} ${content.body}`).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("falls back to a neutral label for a blank pet name", () => {
    expect(getWalkReturnNotificationContent("   ").title).toBe("Your pet is back from the walk!");
  });

  it("uses the active Japanese resources after a locale transition", async () => {
    runtimeLocale.current = "ja-JP";

    expect(getWalkReturnNotificationContent("Mong")).toEqual({
      title: "Mongがお散歩から帰ってきました！",
      body: "Mongが何を見つけたか、見にきてね。"
    });
  });
});

describe("scheduleWalkReturnNotification", () => {
  it("skips scheduling when notification permission is not granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true });

    const result = await scheduleWalkReturnNotification({ petName: "Mong", returnInSeconds: 180 });

    expect(result).toEqual({ notificationId: null, skippedReason: "permission_not_granted" });
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules a single time-interval notification when permission is granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });

    const result = await scheduleWalkReturnNotification({ petName: "Mong", returnInSeconds: 180 });

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Mong is back from the walk!",
        body: "Come see what Mong found out there.",
        data: {
          mongchiNotificationVersion: 1,
          mongchiNotificationOwner: "walk",
          mongchiNotificationKey: "walk_return",
          mongchiNotificationAction: "walk"
        }
      },
      trigger: { type: "timeInterval", seconds: 180, repeats: false }
    });
    expect(result).toEqual({ notificationId: "walk-notification-id" });
  });

  it("rounds a fractional returnInSeconds and never schedules below 1 second", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });

    await scheduleWalkReturnNotification({ petName: "Mong", returnInSeconds: 0.2 });

    const trigger = scheduleNotificationAsync.mock.calls[0]![0].trigger as { seconds: number };

    expect(trigger.seconds).toBe(1);
  });

  it("does not query permission or schedule when walk reminders are disabled", async () => {
    const result = await scheduleWalkReturnNotification({
      petName: "Mong",
      returnInSeconds: 180,
      preferences: { walkReturns: false }
    });

    expect(result).toEqual({ notificationId: null, skippedReason: "disabled" });
    expect(getPermissionsAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("synchronizeWalkReturnNotification", () => {
  it("replaces an existing walk reminder with localized content and the remaining duration", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    getItem.mockResolvedValue("old-walk-id");
    scheduleNotificationAsync.mockResolvedValue("new-walk-id");

    const result = await synchronizeWalkReturnNotification({
      petName: "Mong",
      returnAt: "2026-07-12T03:02:00.000Z",
      now: "2026-07-12T03:00:00.000Z"
    });

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("old-walk-id");
    expect(scheduleNotificationAsync.mock.calls[0]?.[0].trigger).toMatchObject({ seconds: 120 });
    expect(setItem).toHaveBeenCalledWith("mongchi.walk.returnNotificationId.v1", "new-walk-id");
    expect(result.notificationId).toBe("new-walk-id");
  });

  it("passes preferences through so a disabled walkReturns skips scheduling but still clears any stale reminder", async () => {
    getItem.mockResolvedValue("old-walk-id");

    const result = await synchronizeWalkReturnNotification({
      petName: "Mong",
      returnAt: "2026-07-12T03:02:00.000Z",
      now: "2026-07-12T03:00:00.000Z",
      preferences: { walkReturns: false }
    });

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("old-walk-id");
    expect(getPermissionsAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ notificationId: null, skippedReason: "disabled" });
  });

  it("serializes overlapping refreshes so only the newest reminder remains scheduled", async () => {
    let storedId: string | null = null;
    let sequence = 0;
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    getItem.mockImplementation(async () => storedId);
    setItem.mockImplementation(async (_key: string, value: string) => {
      storedId = value;
    });
    removeItem.mockImplementation(async () => {
      storedId = null;
    });
    scheduleNotificationAsync.mockImplementation(async () => {
      sequence += 1;
      return `walk-id-${sequence}`;
    });

    await Promise.all([
      synchronizeWalkReturnNotification({ petName: "Mong", returnAt: "2026-07-12T03:02:00.000Z", now: "2026-07-12T03:00:00.000Z" }),
      synchronizeWalkReturnNotification({ petName: "Mong", returnAt: "2026-07-12T03:02:00.000Z", now: "2026-07-12T03:00:00.000Z" })
    ]);

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("walk-id-1");
    expect(storedId).toBe("walk-id-2");
  });
});

describe("cancelWalkReturnNotification", () => {
  it("cancels the given notification id", async () => {
    await cancelWalkReturnNotification("walk-notification-id");

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("walk-notification-id");
  });

  it("is a silent no-op for a null id", async () => {
    await cancelWalkReturnNotification(null);

    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it("is a silent no-op for an undefined id", async () => {
    await cancelWalkReturnNotification(undefined);

    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
