import * as Notifications from "expo-notifications";
import {
  selectPetPushNotificationCandidates,
  selectReturnReminderCandidates,
  type PetPushNotificationCandidate,
  type PetPushNotificationInput,
  type PetReturnReminderCandidate
} from "@mongchi/shared";

/** Local reminders never exceed this many per sync, keeping the garden feeling calm. */
export const MAX_DAILY_NOTIFICATIONS = 2;

/** Candidates are already "due now" given care state, weather, and throttle windows, so they're
 * scheduled a short delay out rather than at a fixed clock time - this keeps things simple and
 * avoids drifting out of sync with the live care state by the time the day rolls over. */
const NOTIFICATION_DELAY_SECONDS = 5 * 60;

const SECONDS_PER_DAY = 24 * 60 * 60;

export interface ScheduledNotificationPlan {
  key: PetPushNotificationCandidate["key"];
  content: {
    title: string;
    body: string;
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
    content: {
      title: candidate.title,
      body: candidate.body
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: NOTIFICATION_DELAY_SECONDS,
      repeats: false
    }
  }));

/**
 * Maps the always-on win-back ladder (see selectReturnReminderCandidates) to notification
 * requests that land +1 day and +3 days out. These are scheduled once per sync alongside
 * the "due now" candidates above, but are never counted against MAX_DAILY_NOTIFICATIONS -
 * that cap governs reminders about *today's* care state, while these two land on future
 * days the player may never reopen the app to re-sync on. Cancel-all-then-reschedule (in
 * syncScheduledPetNotifications) still applies, so re-syncing while away simply pushes the
 * ladder's clock forward from the latest known session instead of stacking duplicates.
 */
export const buildReturnReminderPlansFromCandidates = (
  candidates: PetReturnReminderCandidate[]
): ScheduledNotificationPlan[] =>
  candidates.map((candidate) => ({
    key: candidate.key,
    content: {
      title: candidate.title,
      body: candidate.body
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: candidate.daysAfterLastSession * SECONDS_PER_DAY,
      repeats: false
    }
  }));

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

export interface SyncScheduledPetNotificationsResult {
  scheduledCount: number;
  scheduledKeys: PetPushNotificationCandidate["key"][];
  skippedReason?: "permission_not_granted";
}

/**
 * Cancels any previously scheduled garden reminders and reschedules the current top
 * candidates from the engine, capped at MAX_DAILY_NOTIFICATIONS, plus the +1 day / +3 day
 * win-back ladder. Cancel-before-schedule keeps stale or duplicate reminders from ever
 * piling up as session state changes - every sync re-anchors the win-back ladder to "now"
 * as the latest known session, so a player who returns and leaves again always gets a
 * fresh +1d/+3d pair instead of a stack of old ones.
 *
 * Never requests permission itself - if permission hasn't been granted yet, scheduling is
 * skipped entirely. Permission is only ever requested via the explicit gate in
 * notificationPermission.ts, triggered by real UI after the user's first care action.
 */
export const syncScheduledPetNotifications = async (
  input: PetPushNotificationInput
): Promise<SyncScheduledPetNotificationsResult> => {
  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.status !== "granted") {
    return { scheduledCount: 0, scheduledKeys: [], skippedReason: "permission_not_granted" };
  }

  const candidates = selectPetPushNotificationCandidates(input);
  const duePlans = buildNotificationPlansFromCandidates(candidates);

  const returnCandidates = selectReturnReminderCandidates({
    petName: input.petName,
    seed: input.now,
    careStreakCurrent: input.careStreakCurrent
  });
  const returnPlans = buildReturnReminderPlansFromCandidates(returnCandidates);

  const plans = [...duePlans, ...returnPlans];

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const plan of plans) {
    await Notifications.scheduleNotificationAsync({
      content: plan.content,
      trigger: plan.trigger
    });
  }

  return {
    scheduledCount: plans.length,
    scheduledKeys: plans.map((plan) => plan.key)
  };
};
