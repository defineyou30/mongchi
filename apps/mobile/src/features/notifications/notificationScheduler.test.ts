import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PetPushNotificationCandidate, PetPushNotificationInput } from "@mongchi/shared";

const {
  getPermissionsAsync,
  requestPermissionsAsync,
  cancelAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  selectPetPushNotificationCandidates
} = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  selectPetPushNotificationCandidates: vi.fn()
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => getPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  cancelAllScheduledNotificationsAsync: (...args: unknown[]) => cancelAllScheduledNotificationsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => scheduleNotificationAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) => setNotificationChannelAsync(...args),
  setNotificationHandler: (...args: unknown[]) => setNotificationHandler(...args),
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval"
  },
  AndroidImportance: {
    DEFAULT: 3
  }
}));

vi.mock("@mongchi/shared", async () => {
  const actual = await vi.importActual<typeof import("@mongchi/shared")>("@mongchi/shared");
  return {
    ...actual,
    selectPetPushNotificationCandidates: (...args: unknown[]) => selectPetPushNotificationCandidates(...args)
  };
});

import {
  buildNotificationPlansFromCandidates,
  buildReturnReminderPlansFromCandidates,
  MAX_DAILY_NOTIFICATIONS,
  syncScheduledPetNotifications
} from "./notificationScheduler";

const makeCandidate = (overrides: Partial<PetPushNotificationCandidate> = {}): PetPushNotificationCandidate => ({
  key: "meal_due",
  title: "A pet found something nice",
  body: "A gentle little update.",
  priority: 3,
  suggestedAction: "feed",
  throttleHours: 4,
  timeBucket: "morning",
  ...overrides
});

const baseInput: PetPushNotificationInput = {
  petName: "Miso",
  now: "2026-07-03T09:00:00.000Z",
  careState: {
    satiety: 50,
    happiness: 50,
    energy: 50,
    gardenHealth: 50,
    cleanliness: 50,
    affection: 50,
    lastFedAt: "2026-07-03T05:00:00.000Z",
    lastInteractionAt: "2026-07-03T05:00:00.000Z",
    updatedAt: "2026-07-03T05:00:00.000Z"
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  scheduleNotificationAsync.mockResolvedValue("notification-id");
  cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
});

describe("buildNotificationPlansFromCandidates", () => {
  it("maps engine candidates to notification content and a time-interval trigger", () => {
    const plans = buildNotificationPlansFromCandidates([
      makeCandidate({ key: "meal_due", title: "Bowl thoughts", body: "A small meal would be nice." })
    ]);

    expect(plans).toEqual([
      {
        key: "meal_due",
        content: { title: "Bowl thoughts", body: "A small meal would be nice." },
        trigger: { type: "timeInterval", seconds: 5 * 60, repeats: false }
      }
    ]);
  });

  it("caps the plan at MAX_DAILY_NOTIFICATIONS even when more candidates are available", () => {
    expect(MAX_DAILY_NOTIFICATIONS).toBe(2);

    const candidates = [
      makeCandidate({ key: "meal_urgent", priority: 5 }),
      makeCandidate({ key: "thirst_due", priority: 4 }),
      makeCandidate({ key: "bored_play", priority: 3 }),
      makeCandidate({ key: "attention_return", priority: 3 })
    ];

    const plans = buildNotificationPlansFromCandidates(candidates);

    expect(plans).toHaveLength(2);
    expect(plans.map((plan) => plan.key)).toEqual(["meal_urgent", "thirst_due"]);
  });

  it("returns an empty plan for an empty candidate list", () => {
    expect(buildNotificationPlansFromCandidates([])).toEqual([]);
  });
});

describe("buildReturnReminderPlansFromCandidates", () => {
  it("maps the +1 day and +3 day win-back candidates to day-scale time-interval triggers", () => {
    const plans = buildReturnReminderPlansFromCandidates([
      { key: "return_after_1_day", title: "Mong found a sunny spot to nap in", body: "Come see.", daysAfterLastSession: 1 },
      { key: "return_after_3_days", title: "The garden saved a spot for you", body: "No rush.", daysAfterLastSession: 3 }
    ]);

    expect(plans).toEqual([
      {
        key: "return_after_1_day",
        content: { title: "Mong found a sunny spot to nap in", body: "Come see." },
        trigger: { type: "timeInterval", seconds: 1 * 24 * 60 * 60, repeats: false }
      },
      {
        key: "return_after_3_days",
        content: { title: "The garden saved a spot for you", body: "No rush." },
        trigger: { type: "timeInterval", seconds: 3 * 24 * 60 * 60, repeats: false }
      }
    ]);
  });
});

describe("syncScheduledPetNotifications", () => {
  it("skips scheduling and does not request permission when permission is not granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true });

    const result = await syncScheduledPetNotifications(baseInput);

    expect(result).toEqual({ scheduledCount: 0, scheduledKeys: [], skippedReason: "permission_not_granted" });
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(selectPetPushNotificationCandidates).not.toHaveBeenCalled();
  });

  it("cancels existing scheduled notifications before scheduling new ones", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([makeCandidate({ key: "meal_due" })]);

    const callOrder: string[] = [];
    cancelAllScheduledNotificationsAsync.mockImplementation(async () => {
      callOrder.push("cancel");
    });
    scheduleNotificationAsync.mockImplementation(async () => {
      callOrder.push("schedule");
      return "notification-id";
    });

    const result = await syncScheduledPetNotifications(baseInput);

    expect(callOrder).toEqual(["cancel", "schedule", "schedule", "schedule"]);
    expect(result.scheduledCount).toBe(3);
    expect(result.scheduledKeys).toEqual(["meal_due", "return_after_1_day", "return_after_3_days"]);
  });

  it("never schedules more than MAX_DAILY_NOTIFICATIONS 'due now' reminders even if the engine returns more candidates", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([
      makeCandidate({ key: "meal_urgent", priority: 5 }),
      makeCandidate({ key: "thirst_due", priority: 4 }),
      makeCandidate({ key: "bored_play", priority: 3 }),
      makeCandidate({ key: "attention_return", priority: 3 }),
      makeCandidate({ key: "walk_window", priority: 2 })
    ]);

    const result = await syncScheduledPetNotifications(baseInput);

    // 2 "due now" reminders (capped) + the always-on +1d/+3d win-back ladder.
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(4);
    expect(result.scheduledCount).toBe(4);
    expect(result.scheduledKeys).toEqual(["meal_urgent", "thirst_due", "return_after_1_day", "return_after_3_days"]);
  });

  it("still schedules the +1 day / +3 day win-back ladder when the engine returns no 'due now' candidates", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);

    const result = await syncScheduledPetNotifications(baseInput);

    expect(cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      scheduledCount: 2,
      scheduledKeys: ["return_after_1_day", "return_after_3_days"]
    });
  });

  it("schedules the win-back ladder with day-scale (not 5-minute) triggers", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);

    await syncScheduledPetNotifications(baseInput);

    const triggers = scheduleNotificationAsync.mock.calls.map((call) => (call[0] as { trigger: { seconds: number } }).trigger.seconds);

    expect(triggers).toEqual([1 * 24 * 60 * 60, 3 * 24 * 60 * 60]);
  });

  it("forwards careStreakCurrent through to the +1 day reminder's copy variant", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);

    await syncScheduledPetNotifications(baseInput);
    const genericOneDayContent = scheduleNotificationAsync.mock.calls[0]![0] as { content: { title: string; body: string } };

    vi.clearAllMocks();
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);

    await syncScheduledPetNotifications({ ...baseInput, careStreakCurrent: 5 });
    const streakProtectiveContent = scheduleNotificationAsync.mock.calls[0]![0] as { content: { title: string; body: string } };

    expect(streakProtectiveContent.content).not.toEqual(genericOneDayContent.content);
    // Never a threat/loss framing, even in the streak-protective branch.
    const combined = `${streakProtectiveContent.content.title} ${streakProtectiveContent.content.body}`.toLowerCase();
    expect(combined).not.toMatch(/will be lost|will lose|expire|last chance/);
  });
});
