import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PetPushNotificationCandidate, PetPushNotificationInput } from "@mongchi/shared";

const {
  getPermissionsAsync,
  requestPermissionsAsync,
  cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  selectPetPushNotificationCandidates
} = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  selectPetPushNotificationCandidates: vi.fn()
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => getPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  cancelAllScheduledNotificationsAsync: (...args: unknown[]) => cancelAllScheduledNotificationsAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => cancelScheduledNotificationAsync(...args),
  getAllScheduledNotificationsAsync: (...args: unknown[]) => getAllScheduledNotificationsAsync(...args),
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

import { createNotificationPayload } from "./notificationContracts";
import {
  buildNotificationPlansFromCandidates,
  buildReturnReminderPlansFromCandidates,
  MAX_DAILY_NOTIFICATIONS,
  syncScheduledPetNotifications
} from "./notificationScheduler";

const makeNotification = (data: unknown) => ({ request: { content: { data } } });

// Captured immediately after import -- notificationScheduler.ts registers its
// handler once, as a module-load side effect, and beforeEach's
// vi.clearAllMocks() below would otherwise wipe that one recorded call before
// the "foreground notification handler" tests get a chance to read it.
const registeredHandleNotification = setNotificationHandler.mock.calls[0]?.[0]?.handleNotification as
  | ((notification: unknown) => Promise<{ shouldShowBanner: boolean; shouldShowList: boolean; shouldPlaySound: boolean; shouldSetBadge: boolean }>)
  | undefined;

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

const buildScheduledInventory = (identifiers?: string[]) =>
  scheduleNotificationAsync.mock.calls.map((call, index) => {
    const request = call[0] as { content: { data?: Record<string, unknown> }; trigger: unknown };

    return {
      identifier: identifiers?.[index] ?? `notification-id-${index + 1}`,
      content: request.content,
      trigger: request.trigger
    };
  });

beforeEach(() => {
  vi.clearAllMocks();
  let scheduledId = 0;
  scheduleNotificationAsync.mockImplementation(async () => {
    scheduledId += 1;
    return `notification-id-${scheduledId}`;
  });
  cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
  cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  getAllScheduledNotificationsAsync.mockImplementation(async () => buildScheduledInventory());
});

describe("buildNotificationPlansFromCandidates", () => {
  it("maps engine candidates to notification content and a time-interval trigger", () => {
    const plans = buildNotificationPlansFromCandidates([
      makeCandidate({ key: "meal_due", title: "Bowl thoughts", body: "A small meal would be nice." })
    ]);

    expect(plans).toEqual([
      {
        key: "meal_due",
        owner: "garden",
        action: "feed",
        content: {
          title: "Bowl thoughts",
          body: "A small meal would be nice.",
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "garden",
            mongchiNotificationKey: "meal_due",
            mongchiNotificationAction: "feed"
          }
        },
        trigger: { type: "timeInterval", seconds: 5 * 60, repeats: false }
      }
    ]);
  });

  it("caps the plan at MAX_DAILY_NOTIFICATIONS even when more candidates are available", () => {
    expect(MAX_DAILY_NOTIFICATIONS).toBe(1);

    const candidates = [
      makeCandidate({ key: "meal_urgent", priority: 5 }),
      makeCandidate({ key: "thirst_due", priority: 4 }),
      makeCandidate({ key: "bored_play", priority: 3 }),
      makeCandidate({ key: "attention_return", priority: 3 })
    ];

    const plans = buildNotificationPlansFromCandidates(candidates);

    expect(plans).toHaveLength(1);
    expect(plans.map((plan) => plan.key)).toEqual(["meal_urgent"]);
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
        owner: "return",
        action: "open_app",
        content: {
          title: "Mong found a sunny spot to nap in",
          body: "Come see.",
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "return",
            mongchiNotificationKey: "return_after_1_day",
            mongchiNotificationAction: "open_app"
          }
        },
        trigger: { type: "timeInterval", seconds: 1 * 24 * 60 * 60, repeats: false }
      },
      {
        key: "return_after_3_days",
        owner: "return",
        action: "open_app",
        content: {
          title: "The garden saved a spot for you",
          body: "No rush.",
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "return",
            mongchiNotificationKey: "return_after_3_days",
            mongchiNotificationAction: "open_app"
          }
        },
        trigger: { type: "timeInterval", seconds: 3 * 24 * 60 * 60, repeats: false }
      }
    ]);
  });
});

describe("syncScheduledPetNotifications", () => {
  it("characterizes the baseline: a sync with no care candidate still schedules the return ladder", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);

    await syncScheduledPetNotifications(baseInput);

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it("skips scheduling and does not request permission when permission is not granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true });

    const result = await syncScheduledPetNotifications(baseInput);

    expect(result).toEqual({
      scheduledCount: 0,
      scheduledKeys: [],
      scheduled: [],
      failedKeys: [],
      cancelledIds: [],
      failedCancellationIds: [],
      skippedReason: "permission_not_granted"
    });
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(selectPetPushNotificationCandidates).not.toHaveBeenCalled();
  });

  it("preserves a walk-owned id and cancels only garden and return ids", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);
    const existingInventory = [
      {
        identifier: "walk-id",
        content: {
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "walk",
            mongchiNotificationKey: "walk_return",
            mongchiNotificationAction: "walk"
          }
        },
        trigger: null
      },
      {
        identifier: "garden-id",
        content: {
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "garden",
            mongchiNotificationKey: "meal_due",
            mongchiNotificationAction: "feed"
          }
        },
        trigger: null
      },
      {
        identifier: "return-id",
        content: {
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "return",
            mongchiNotificationKey: "return_after_1_day",
            mongchiNotificationAction: "open_app"
          }
        },
        trigger: null
      },
      { identifier: "foreign-id", content: { data: { source: "other-feature" } }, trigger: null }
    ];
    getAllScheduledNotificationsAsync.mockImplementation(async () =>
      scheduleNotificationAsync.mock.calls.length === 0 ? existingInventory : buildScheduledInventory()
    );

    await syncScheduledPetNotifications(baseInput);

    expect(cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(cancelScheduledNotificationAsync.mock.calls.map(([id]) => id)).toEqual(["garden-id", "return-id"]);
  });

  it("cancels owned scheduled notifications before scheduling new ones", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([makeCandidate({ key: "meal_due" })]);
    const existingInventory = [
      {
        identifier: "garden-id",
        content: {
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "garden",
            mongchiNotificationKey: "meal_due",
            mongchiNotificationAction: "feed"
          }
        },
        trigger: null
      }
    ];
    getAllScheduledNotificationsAsync.mockImplementation(async () =>
      scheduleNotificationAsync.mock.calls.length === 0 ? existingInventory : buildScheduledInventory()
    );

    const callOrder: string[] = [];
    cancelScheduledNotificationAsync.mockImplementation(async () => {
      callOrder.push("cancel");
    });
    let callCount = 0;
    scheduleNotificationAsync.mockImplementation(async () => {
      callOrder.push("schedule");
      callCount += 1;
      return `notification-id-${callCount}`;
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

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(result.scheduledCount).toBe(3);
    expect(result.scheduledKeys).toEqual(["meal_urgent", "return_after_1_day", "return_after_3_days"]);
  });

  it("still schedules the +1 day / +3 day win-back ladder when the engine returns no 'due now' candidates", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);

    const result = await syncScheduledPetNotifications(baseInput);

    expect(getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      scheduledCount: 2,
      scheduledKeys: ["return_after_1_day", "return_after_3_days"],
      failedKeys: []
    });
  });

  it("reports partial schedule failures using actual successful ids", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([makeCandidate({ key: "meal_due" })]);
    scheduleNotificationAsync
      .mockResolvedValueOnce("garden-id")
      .mockRejectedValueOnce(new Error("native schedule failed"))
      .mockResolvedValueOnce("return-3-id");
    getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([])
      .mockImplementation(async () => {
        const inventory = buildScheduledInventory(["garden-id", "unused-failed-id", "return-3-id"]);

        return inventory.filter(({ identifier }) => identifier !== "unused-failed-id");
      });

    const result = await syncScheduledPetNotifications(baseInput);

    expect(result).toMatchObject({
      scheduledCount: 2,
      scheduledKeys: ["meal_due", "return_after_3_days"],
      failedKeys: ["return_after_1_day"]
    });
  });

  it("does not count a duplicate native id as a second successful schedule", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);
    scheduleNotificationAsync.mockResolvedValue("duplicate-id");
    getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([])
      .mockImplementation(async () => [buildScheduledInventory(["duplicate-id"])[0]]);

    const result = await syncScheduledPetNotifications(baseInput);

    expect(result).toMatchObject({
      scheduledCount: 1,
      scheduledKeys: ["return_after_1_day"],
      failedKeys: ["return_after_3_days"]
    });
  });

  it("does not claim scheduled success when returned native ids are absent from the post-schedule inventory", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);
    getAllScheduledNotificationsAsync.mockResolvedValue([]);
    scheduleNotificationAsync
      .mockResolvedValueOnce("return-one")
      .mockResolvedValueOnce("return-three");

    const result = await syncScheduledPetNotifications(baseInput);

    expect(getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      scheduledCount: 0,
      scheduledKeys: [],
      failedKeys: ["return_after_1_day", "return_after_3_days"],
      verificationFailure: "missing_native_inventory"
    });
  });

  it("retries one transient post-schedule inventory query failure and confirms the second read", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);
    getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("transient inventory failure"))
      .mockImplementation(async () => buildScheduledInventory());

    const result = await syncScheduledPetNotifications(baseInput);

    expect(getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      scheduledCount: 2,
      scheduledKeys: ["return_after_1_day", "return_after_3_days"],
      failedKeys: []
    });
    expect(result).not.toHaveProperty("verificationFailure");
  });

  it("reports typed non-success when both post-schedule inventory attempts fail", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);
    getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("first inventory failure"))
      .mockRejectedValueOnce(new Error("second inventory failure"));

    const result = await syncScheduledPetNotifications(baseInput);

    expect(getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      scheduledCount: 0,
      scheduledKeys: [],
      failedKeys: ["return_after_1_day", "return_after_3_days"],
      verificationFailure: "inventory_query_failed"
    });
  });

  it("fails closed when an owned id cannot be cancelled and succeeds on the next retry", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    selectPetPushNotificationCandidates.mockReturnValue([]);
    const existingInventory = [
      {
        identifier: "stale-return-id",
        content: {
          data: {
            mongchiNotificationVersion: 1,
            mongchiNotificationOwner: "return",
            mongchiNotificationKey: "return_after_1_day",
            mongchiNotificationAction: "open_app"
          }
        },
        trigger: null
      }
    ];
    getAllScheduledNotificationsAsync.mockImplementation(async () =>
      scheduleNotificationAsync.mock.calls.length === 0 ? existingInventory : buildScheduledInventory()
    );
    cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("cancel failed"));

    const failed = await syncScheduledPetNotifications(baseInput);
    const retried = await syncScheduledPetNotifications(baseInput);

    expect(failed).toMatchObject({
      scheduledCount: 0,
      skippedReason: "owned_cancellation_failed",
      failedCancellationIds: ["stale-return-id"]
    });
    expect(retried).toMatchObject({ scheduledCount: 2, failedCancellationIds: [] });
  });

  it("clears prior owned ids but schedules nothing when both garden and return preferences are disabled", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });
    getAllScheduledNotificationsAsync.mockResolvedValue([]);

    const result = await syncScheduledPetNotifications(baseInput, {
      gardenCare: false,
      returnReminders: false,
      walkReturns: true
    });

    expect(selectPetPushNotificationCandidates).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(result).toMatchObject({ scheduledCount: 0, scheduledKeys: [], failedKeys: [] });
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

describe("foreground notification handler", () => {
  const getHandler = (): ((notification: unknown) => Promise<{
    shouldShowBanner: boolean;
    shouldShowList: boolean;
    shouldPlaySound: boolean;
    shouldSetBadge: boolean;
  }>) => {
    if (!registeredHandleNotification) {
      throw new Error("setNotificationHandler was never called");
    }

    return registeredHandleNotification;
  };

  it("suppresses the banner for a garden due-now reminder (daily care reminders already have an in-app reaction)", async () => {
    const handleNotification = getHandler();
    const data = createNotificationPayload({ owner: "garden", key: "meal_due", action: "feed" });

    const result = await handleNotification(makeNotification(data));

    expect(result).toEqual({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    });
  });

  it("suppresses the banner for the walk-return ping (the home screen already shows an in-app return moment)", async () => {
    const handleNotification = getHandler();
    const data = createNotificationPayload({ owner: "walk", key: "walk_return", action: "walk" });

    const result = await handleNotification(makeNotification(data));

    expect(result.shouldShowBanner).toBe(false);
  });

  it("keeps the banner for a +1/+3 day win-back reminder", async () => {
    const handleNotification = getHandler();
    const data = createNotificationPayload({ owner: "return", key: "return_after_1_day", action: "open_app" });

    const result = await handleNotification(makeNotification(data));

    expect(result.shouldShowBanner).toBe(true);
  });

  it("keeps the banner for the monthly letter ping", async () => {
    const handleNotification = getHandler();
    const data = createNotificationPayload({ owner: "letter", key: "monthly_letter", action: "open_app" });

    const result = await handleNotification(makeNotification(data));

    expect(result.shouldShowBanner).toBe(true);
  });

  it("fails open (keeps the banner) for an unparseable or legacy payload", async () => {
    const handleNotification = getHandler();

    const result = await handleNotification(makeNotification({ source: "legacy" }));

    expect(result.shouldShowBanner).toBe(true);
  });

  it("never plays a sound or sets a badge, and always lists the notification, regardless of owner", async () => {
    const handleNotification = getHandler();
    const data = createNotificationPayload({ owner: "garden", key: "meal_due", action: "feed" });

    const result = await handleNotification(makeNotification(data));

    expect(result.shouldShowList).toBe(true);
    expect(result.shouldPlaySound).toBe(false);
    expect(result.shouldSetBadge).toBe(false);
  });
});
