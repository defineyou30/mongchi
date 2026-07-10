import * as Notifications from "expo-notifications";
import {
  createNotificationPayload,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences
} from "./notificationContracts";

/**
 * A single, one-off local "welcome home" notification for a walk in
 * progress -- separate from notificationScheduler.ts's daily reminder
 * ladder (which cancels *all* scheduled notifications on every sync, and
 * would happily wipe this one out at the wrong moment). This module owns
 * its own schedule/cancel pair keyed by the returned notification id, so a
 * walk that ends early ("Bring home now") can cancel exactly this
 * notification without touching anything else that might be scheduled.
 *
 * Never requests permission itself -- matches notificationPermission.ts's
 * ask-once-after-first-care-action gate. If permission was never granted,
 * scheduling silently no-ops rather than prompting or blocking the walk
 * from starting.
 */

export interface WalkReturnNotificationContent {
  title: string;
  body: string;
}

export const getWalkReturnNotificationContent = (petName: string): WalkReturnNotificationContent => {
  const trimmedName = petName.trim() || "Your pet";

  return {
    title: `${trimmedName} is back from the walk!`,
    body: `Come see what ${trimmedName} found out there.`
  };
};

export interface ScheduleWalkReturnNotificationInput {
  petName: string;
  /** Seconds from now until the walk is due to return. */
  returnInSeconds: number;
  preferences?: Pick<NotificationPreferences, "walkReturns">;
}

export interface ScheduleWalkReturnNotificationResult {
  /** The scheduled notification's id, or null when scheduling was skipped (no permission). */
  notificationId: string | null;
  skippedReason?: "permission_not_granted" | "disabled" | "notification_api_failed";
}

export const scheduleWalkReturnNotification = async ({
  petName,
  returnInSeconds,
  preferences = DEFAULT_NOTIFICATION_PREFERENCES
}: ScheduleWalkReturnNotificationInput): Promise<ScheduleWalkReturnNotificationResult> => {
  if (!preferences.walkReturns) {
    return { notificationId: null, skippedReason: "disabled" };
  }

  let permissions: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

  try {
    permissions = await Notifications.getPermissionsAsync();
  } catch {
    return { notificationId: null, skippedReason: "notification_api_failed" };
  }

  if (permissions.status !== "granted") {
    return { notificationId: null, skippedReason: "permission_not_granted" };
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        ...getWalkReturnNotificationContent(petName),
        data: createNotificationPayload({ owner: "walk", key: "walk_return", action: "walk" })
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(returnInSeconds)),
        repeats: false
      }
    });

    return { notificationId };
  } catch {
    return { notificationId: null, skippedReason: "notification_api_failed" };
  }
};

/**
 * Cancels a previously scheduled walk-return notification -- called when the
 * walk ends early (Bring home now) so the player never gets a "you're
 * home!" ping for a walk that already visibly ended. A null id (nothing was
 * ever scheduled, e.g. permission wasn't granted) is a silent no-op.
 */
export const cancelWalkReturnNotification = async (notificationId: string | null | undefined): Promise<void> => {
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
};
