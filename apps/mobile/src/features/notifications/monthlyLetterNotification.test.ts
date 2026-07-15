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
  cancelPersistedMonthlyLetterNotification,
  getMonthlyLetterNotificationContent,
  MONTHLY_LETTER_NOTIFICATION_ID_KEY,
  MONTHLY_LETTER_OPENED_STORAGE_KEY,
  synchronizeMonthlyLetterNotification
} from "./monthlyLetterNotification";

const MOVED_IN_AT = "2026-06-01T00:00:00.000Z";
const ARRIVED_AT = "2026-07-01T00:00:00.000Z"; // exactly +30 days
const BEFORE_ARRIVAL = "2026-06-20T00:00:00.000Z"; // day 19

beforeEach(() => {
  vi.clearAllMocks();
  runtimeLocale.current = "en-US";
  scheduleNotificationAsync.mockResolvedValue("letter-notification-id");
  cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
  removeItem.mockResolvedValue(undefined);
});

describe("getMonthlyLetterNotificationContent", () => {
  it("names the pet in both the title and body", () => {
    expect(getMonthlyLetterNotificationContent("Mong")).toEqual({
      title: "A letter is waiting",
      body: "A letter from Mong is waiting in the garden."
    });
  });

  it("never includes an emoji, matching the existing no-emoji notification copy convention", () => {
    const content = getMonthlyLetterNotificationContent("Mong");

    expect(`${content.title} ${content.body}`).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("never uses guilt-tripping or urgency framing", () => {
    const content = getMonthlyLetterNotificationContent("Mong");
    const combined = `${content.title} ${content.body}`.toLowerCase();

    expect(combined).not.toMatch(/hurry|don't miss|expire|last chance|waiting for you to/);
  });

  it("falls back to a neutral label for a blank pet name", () => {
    expect(getMonthlyLetterNotificationContent("   ").body).toBe("A letter from Your pet is waiting in the garden.");
  });

  it("uses the active Japanese resources after a locale transition", async () => {
    runtimeLocale.current = "ja-JP";

    expect(getMonthlyLetterNotificationContent("Mong")).toEqual({
      title: "お手紙が届きました",
      body: "Mongからのお手紙が庭で待っています。"
    });
  });
});

describe("synchronizeMonthlyLetterNotification", () => {
  it("cancels any previously persisted notification before doing anything else", async () => {
    getItem.mockResolvedValue("stale-letter-id");

    await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: MOVED_IN_AT,
      now: BEFORE_ARRIVAL,
      preferences: { gardenCare: false }
    });

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("stale-letter-id");
    expect(removeItem).toHaveBeenCalledWith(MONTHLY_LETTER_NOTIFICATION_ID_KEY);
  });

  it("does not schedule when Care reminders is off", async () => {
    const result = await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: MOVED_IN_AT,
      now: ARRIVED_AT,
      preferences: { gardenCare: false }
    });

    expect(result).toEqual({ notificationId: null, skippedReason: "disabled" });
    expect(getPermissionsAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("does not schedule before the letter has arrived (daysTogether under the threshold)", async () => {
    const result = await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: MOVED_IN_AT,
      now: BEFORE_ARRIVAL,
      preferences: { gardenCare: true }
    });

    expect(result).toEqual({ notificationId: null, skippedReason: "not_arrived_yet" });
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("does not schedule once the letter has already been opened", async () => {
    getItem.mockImplementation(async (key: string) =>
      key === MONTHLY_LETTER_OPENED_STORAGE_KEY ? "2026-07-02T00:00:00.000Z" : null
    );

    const result = await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: MOVED_IN_AT,
      now: ARRIVED_AT,
      preferences: { gardenCare: true }
    });

    expect(result).toEqual({ notificationId: null, skippedReason: "already_opened" });
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules a single time-interval notification once the letter has arrived, is unopened, and Care reminders is on", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });

    const result = await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: MOVED_IN_AT,
      now: ARRIVED_AT,
      preferences: { gardenCare: true }
    });

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "A letter is waiting",
        body: "A letter from Mong is waiting in the garden.",
        data: {
          mongchiNotificationVersion: 1,
          mongchiNotificationOwner: "letter",
          mongchiNotificationKey: "monthly_letter",
          mongchiNotificationAction: "open_app"
        }
      },
      trigger: { type: "timeInterval", seconds: 5 * 60, repeats: false }
    });
    expect(setItem).toHaveBeenCalledWith(MONTHLY_LETTER_NOTIFICATION_ID_KEY, "letter-notification-id");
    expect(result).toEqual({ notificationId: "letter-notification-id" });
  });

  it("schedules on an owner/identifier track independent of the daily garden and return-ladder reminders", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });

    await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: MOVED_IN_AT,
      now: ARRIVED_AT,
      preferences: { gardenCare: true }
    });

    const scheduledData = scheduleNotificationAsync.mock.calls[0]![0].content.data as { mongchiNotificationOwner: string };

    expect(scheduledData.mongchiNotificationOwner).toBe("letter");
    expect(scheduledData.mongchiNotificationOwner).not.toBe("garden");
  });

  it("skips scheduling when notification permission is not granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true });

    const result = await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: MOVED_IN_AT,
      now: ARRIVED_AT,
      preferences: { gardenCare: true }
    });

    expect(result).toEqual({ notificationId: null, skippedReason: "permission_not_granted" });
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("defaults preferences and now when omitted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });

    // now defaults to the real current time, which is long past 2026-06-01 + 30 days
    // in any plausible test-run clock, so the letter reads as arrived.
    const result = await synchronizeMonthlyLetterNotification({
      petName: "Mong",
      movedInAt: "2000-01-01T00:00:00.000Z"
    });

    expect(result).toEqual({ notificationId: "letter-notification-id" });
  });
});

describe("cancelPersistedMonthlyLetterNotification", () => {
  it("cancels the persisted notification id and clears the record", async () => {
    getItem.mockResolvedValue("letter-notification-id");

    await cancelPersistedMonthlyLetterNotification();

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("letter-notification-id");
    expect(removeItem).toHaveBeenCalledWith(MONTHLY_LETTER_NOTIFICATION_ID_KEY);
  });

  it("is a silent no-op when nothing was scheduled", async () => {
    getItem.mockResolvedValue(null);

    await cancelPersistedMonthlyLetterNotification();

    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith(MONTHLY_LETTER_NOTIFICATION_ID_KEY);
  });

  it("still clears the record even if the native cancel call fails", async () => {
    getItem.mockResolvedValue("stale-id");
    cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("already fired"));

    await expect(cancelPersistedMonthlyLetterNotification()).resolves.toBeUndefined();

    expect(removeItem).toHaveBeenCalledWith(MONTHLY_LETTER_NOTIFICATION_ID_KEY);
  });
});
