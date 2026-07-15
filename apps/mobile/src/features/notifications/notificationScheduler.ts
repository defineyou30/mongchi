import * as Notifications from "expo-notifications";
import {
  selectPetPushNotificationCandidates,
  selectReturnReminderCandidates,
  type PetPushNotificationCandidate,
  type PetPushNotificationInput,
  type PetReturnReminderCandidate
} from "@mongchi/shared";
import {
  createNotificationPayload,
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPayload,
  type MongchiNotificationAction,
  type MongchiNotificationKey,
  type MongchiNotificationOwner,
  type NotificationPreferences
} from "./notificationContracts";
import {
  cancelOwnedScheduledNotifications,
  verifyScheduledNotificationInventory,
  type CancelOwnedNotificationsResult
} from "./notificationOwnership";
import { getRuntimeResources, interpolatePetName } from "../../localization/runtimeResources";

export const MAX_DAILY_NOTIFICATIONS = 1;

/** Candidates are already "due now" given care state, weather, and throttle windows, so they're
 * scheduled a short delay out rather than at a fixed clock time - this keeps things simple and
 * avoids drifting out of sync with the live care state by the time the day rolls over. */
const NOTIFICATION_DELAY_SECONDS = 5 * 60;

const SECONDS_PER_DAY = 24 * 60 * 60;

const localizeNotificationCandidate = <Candidate extends PetPushNotificationCandidate | PetReturnReminderCandidate>(
  candidate: Candidate,
  petName: string,
  streakProtective = false
): Candidate => {
  const garden = getRuntimeResources().notifications.garden;
  const resources = candidate.key === "return_after_1_day" && streakProtective
    ? garden.return_after_1_day_streak
    : garden[candidate.key];

  return {
    ...candidate,
    title: interpolatePetName(resources.title, petName),
    body: interpolatePetName(resources.body, petName)
  };
};

export interface ScheduledNotificationPlan {
  key: MongchiNotificationKey;
  owner: MongchiNotificationOwner;
  action: MongchiNotificationAction;
  content: {
    title: string;
    body: string;
    data: ReturnType<typeof createNotificationPayload>;
  };
  trigger: Notifications.TimeIntervalTriggerInput;
}

/**
 * Pure mapping from engine candidates to notification requests. Does not touch the
 * expo-notifications API. The engine already sorts candidates by priority (highest first),
 * so capping to the top MAX_DAILY_NOTIFICATIONS keeps the day's reminders to a gentle handful.
 */
export const buildNotificationPlansFromCandidates = (
  candidates: PetPushNotificationCandidate[]
): ScheduledNotificationPlan[] =>
  candidates.slice(0, MAX_DAILY_NOTIFICATIONS).map((candidate) => ({
    key: candidate.key,
    owner: "garden",
    action: candidate.suggestedAction,
    content: {
      title: candidate.title,
      body: candidate.body,
      data: createNotificationPayload({
        owner: "garden",
        key: candidate.key,
        action: candidate.suggestedAction
      })
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: NOTIFICATION_DELAY_SECONDS,
      repeats: false
    }
  }));

export const buildReturnReminderPlansFromCandidates = (
  candidates: PetReturnReminderCandidate[]
): ScheduledNotificationPlan[] =>
  candidates.map((candidate) => ({
    key: candidate.key,
    owner: "return",
    action: "open_app",
    content: {
      title: candidate.title,
      body: candidate.body,
      data: createNotificationPayload({
        owner: "return",
        key: candidate.key,
        action: "open_app"
      })
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: candidate.daysAfterLastSession * SECONDS_PER_DAY,
      repeats: false
    }
  }));

/**
 * This handler only ever runs while the app is foregrounded -- Expo/the OS
 * present a backgrounded or killed app's notifications natively, without
 * calling back into JS. So suppressing the banner here specifically means
 * "never show a banner for these while the player already has the app open."
 *
 * Daily garden care reminders and the walk-return ping both already have
 * their own in-app moment when that happens while foregrounded (the garden
 * reaction engine reacts to care state directly; TerrariumHomeScreen's
 * speech bubble and walk-discovery toast reappear the instant a walk
 * resolves to "returned") -- a banner on top of that reads as a jarring,
 * redundant duplicate. Win-back (+1/+3 day) reminders and the monthly
 * letter ping are effectively never seen in foreground in practice --
 * opening the app resyncs and cancels/reschedules them almost immediately --
 * so they keep the default banner for the rare case one does fire while open.
 */
const shouldSuppressForegroundBanner = (owner: MongchiNotificationOwner | undefined): boolean =>
  owner === "garden" || owner === "walk";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const payload = parseNotificationPayload(notification.request.content.data);

    return {
      shouldShowBanner: !shouldSuppressForegroundBanner(payload?.owner),
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    };
  }
});

export interface SyncScheduledPetNotificationsResult {
  scheduledCount: number;
  scheduledKeys: MongchiNotificationKey[];
  scheduled: Array<{ key: MongchiNotificationKey; notificationId: string }>;
  failedKeys: MongchiNotificationKey[];
  cancelledIds: string[];
  failedCancellationIds: string[];
  verificationFailure?: "inventory_query_failed" | "missing_native_inventory";
  skippedReason?: "permission_not_granted" | "notification_api_failed" | "owned_cancellation_failed";
}

const emptySyncResult = (
  skippedReason: SyncScheduledPetNotificationsResult["skippedReason"]
): SyncScheduledPetNotificationsResult => ({
  scheduledCount: 0,
  scheduledKeys: [],
  scheduled: [],
  failedKeys: [],
  cancelledIds: [],
  failedCancellationIds: [],
  ...(skippedReason ? { skippedReason } : {})
});

export const syncScheduledPetNotifications = async (
  input: PetPushNotificationInput,
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
): Promise<SyncScheduledPetNotificationsResult> => {
  let permissions: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

  try {
    permissions = await Notifications.getPermissionsAsync();
  } catch {
    return emptySyncResult("notification_api_failed");
  }

  if (permissions.status !== "granted") {
    return emptySyncResult("permission_not_granted");
  }

  const candidates = preferences.gardenCare
    ? selectPetPushNotificationCandidates(input).map((candidate) => localizeNotificationCandidate(candidate, input.petName))
    : [];
  const duePlans = buildNotificationPlansFromCandidates(candidates);

  const returnCandidates = preferences.returnReminders
    ? selectReturnReminderCandidates({
        petName: input.petName,
        seed: input.now,
        careStreakCurrent: input.careStreakCurrent
      })
    : [];
  const returnPlans = buildReturnReminderPlansFromCandidates(
    returnCandidates.map((candidate) =>
      localizeNotificationCandidate(candidate, input.petName, (input.careStreakCurrent ?? 0) >= 3)
    )
  );

  const plans = [...duePlans, ...returnPlans];
  let cancellation: CancelOwnedNotificationsResult;

  try {
    cancellation = await cancelOwnedScheduledNotifications(new Set(["garden", "return"]));
  } catch {
    return emptySyncResult("notification_api_failed");
  }

  if (cancellation.failedCancellationIds.length > 0) {
    return {
      ...emptySyncResult("owned_cancellation_failed"),
      cancelledIds: cancellation.cancelledIds,
      failedCancellationIds: cancellation.failedCancellationIds
    };
  }

  const scheduled: SyncScheduledPetNotificationsResult["scheduled"] = [];
  const failedKeys: MongchiNotificationKey[] = [];
  const seenIds = new Set<string>();

  for (const plan of plans) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: plan.content,
        trigger: plan.trigger
      });

      if (seenIds.has(notificationId)) {
        failedKeys.push(plan.key);
        continue;
      }

      seenIds.add(notificationId);
      scheduled.push({ key: plan.key, notificationId });
    } catch {
      failedKeys.push(plan.key);
    }
  }

  const verification = await verifyScheduledNotificationInventory(scheduled);
  const verifiedFailedKeys = Array.from(
    new Set([...failedKeys, ...verification.unconfirmed.map(({ key }) => key)])
  );

  return {
    scheduledCount: verification.confirmed.length,
    scheduledKeys: verification.confirmed.map(({ key }) => key),
    scheduled: verification.confirmed,
    failedKeys: verifiedFailedKeys,
    cancelledIds: cancellation.cancelledIds,
    failedCancellationIds: [],
    ...(verification.failure ? { verificationFailure: verification.failure } : {})
  };
};
