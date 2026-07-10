import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPermissionsAsync, scheduleNotificationAsync, cancelScheduledNotificationAsync } = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn()
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
  scheduleWalkReturnNotification
} from "./walkReturnNotification";

beforeEach(() => {
  vi.clearAllMocks();
  scheduleNotificationAsync.mockResolvedValue("walk-notification-id");
  cancelScheduledNotificationAsync.mockResolvedValue(undefined);
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
