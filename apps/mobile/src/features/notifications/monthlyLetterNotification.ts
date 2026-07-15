import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { MONTHLY_LETTER_THRESHOLD_DAYS } from "@mongchi/shared";

import {
  createNotificationPayload,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences
} from "./notificationContracts";
import { getRuntimeResources, interpolatePetName } from "../../localization/runtimeResources";

/**
 * A single, one-off "your 30-day letter is waiting" local notification --
 * separate from notificationScheduler.ts's daily reminder ladder (which
 * cancels *all* garden/return-owned scheduled notifications on every sync)
 * and from walkReturnNotification.ts's walk-return ping. Owns its own
 * schedule/cancel pair keyed by its own persisted notification id, following
 * the same module shape as walkReturnNotification.ts.
 *
 * The letter only "arrives" (becomes openable) once daysTogether reaches
 * MONTHLY_LETTER_THRESHOLD_DAYS -- mirroring notificationScheduler.ts's daily
 * candidates, this only schedules *after* that condition is already true
 * ("due now"), a short delay out, rather than pre-computing a trigger for a
 * moment weeks in the future. Before arrival there's nothing due yet, so
 * synchronizeMonthlyLetterNotification is a no-op until then.
 */

export const MONTHLY_LETTER_NOTIFICATION_ID_KEY = "mongchi.notifications.monthlyLetterNotificationId.v1";

/**
 * Must match FriendProfileScreen.tsx's MONTHLY_LETTER_OPENED_KEY -- this
 * module only ever reads it (to know whether to stop notifying), never
 * writes it. Kept as its own literal here (rather than imported from the
 * friend feature) so notifications doesn't take on a dependency on friend.
 */
export const MONTHLY_LETTER_OPENED_STORAGE_KEY = "mongchi.friend.monthlyLetter.openedAt.v1";

/** Mirrors notificationScheduler.ts's NOTIFICATION_DELAY_SECONDS -- the letter is already "due" by the time this fires, so a short delay avoids an instant-on-render notification. */
const LETTER_NOTIFICATION_DELAY_SECONDS = 5 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MonthlyLetterNotificationContent {
  title: string;
  body: string;
}

export const getMonthlyLetterNotificationContent = (petName: string): MonthlyLetterNotificationContent => {
  const copy = getRuntimeResources().notifications.monthlyLetter;
  const trimmedName = petName.trim() || copy.fallbackPetName;

  return {
    title: interpolatePetName(copy.title, trimmedName),
    body: interpolatePetName(copy.body, trimmedName)
  };
};

export type MonthlyLetterNotificationSkipReason =
  | "disabled"
  | "already_opened"
  | "not_arrived_yet"
  | "permission_not_granted"
  | "notification_api_failed";

export interface SynchronizeMonthlyLetterNotificationResult {
  notificationId: string | null;
  skippedReason?: MonthlyLetterNotificationSkipReason;
}

/**
 * Cancels any previously scheduled letter notification and clears the
 * persisted id -- a silent no-op if nothing was scheduled (e.g. permission
 * was never granted).
 */
export const cancelPersistedMonthlyLetterNotification = async (): Promise<void> => {
  const notificationId = await AsyncStorage.getItem(MONTHLY_LETTER_NOTIFICATION_ID_KEY);

  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Best-effort: a stale id (already fired or cleared natively) shouldn't block clearing our own record.
    }
  }

  await AsyncStorage.removeItem(MONTHLY_LETTER_NOTIFICATION_ID_KEY);
};

const scheduleMonthlyLetterNotification = async (petName: string): Promise<SynchronizeMonthlyLetterNotificationResult> => {
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
        ...getMonthlyLetterNotificationContent(petName),
        data: createNotificationPayload({ owner: "letter", key: "monthly_letter", action: "open_app" })
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: LETTER_NOTIFICATION_DELAY_SECONDS,
        repeats: false
      }
    });

    await AsyncStorage.setItem(MONTHLY_LETTER_NOTIFICATION_ID_KEY, notificationId);
    return { notificationId };
  } catch {
    return { notificationId: null, skippedReason: "notification_api_failed" };
  }
};

export interface SynchronizeMonthlyLetterNotificationInput {
  petName: string;
  /** The pet profile's move-in date (PetProfile.createdAt). */
  movedInAt: string;
  now?: string;
  preferences?: Pick<NotificationPreferences, "gardenCare">;
}

/**
 * Cancels any previously scheduled letter notification, then reschedules a
 * fresh one only if the letter has arrived, is still unopened, and "Care
 * reminders" is on. Cancel-first keeps repeat calls (app re-hydrating,
 * preferences toggled, locale changed) from ever accumulating more than one
 * pending notification for this feature.
 */
export const synchronizeMonthlyLetterNotification = async ({
  petName,
  movedInAt,
  now = new Date().toISOString(),
  preferences = DEFAULT_NOTIFICATION_PREFERENCES
}: SynchronizeMonthlyLetterNotificationInput): Promise<SynchronizeMonthlyLetterNotificationResult> => {
  await cancelPersistedMonthlyLetterNotification();

  if (!preferences.gardenCare) {
    return { notificationId: null, skippedReason: "disabled" };
  }

  const hasOpenedLetter = await AsyncStorage.getItem(MONTHLY_LETTER_OPENED_STORAGE_KEY);

  if (hasOpenedLetter) {
    return { notificationId: null, skippedReason: "already_opened" };
  }

  const movedInMs = new Date(movedInAt).getTime();
  const nowMs = new Date(now).getTime();
  const arrivedAtMs = movedInMs + MONTHLY_LETTER_THRESHOLD_DAYS * DAY_MS;

  if (!Number.isFinite(movedInMs) || !Number.isFinite(nowMs) || nowMs < arrivedAtMs) {
    return { notificationId: null, skippedReason: "not_arrived_yet" };
  }

  return scheduleMonthlyLetterNotification(petName);
};
