import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getRuntimeResources } from "../../localization/runtimeResources";

export type NotificationPermissionGateStatus = "granted" | "denied" | "undetermined" | "skipped";

export interface NotificationPermissionGateResult {
  status: NotificationPermissionGateStatus;
}

const GARDEN_CHANNEL_ID = "garden-updates";

/**
 * Configures the Android notification channel used for gentle garden updates.
 * Safe to call multiple times - Android no-ops on repeat calls with the same id.
 */
export const configureGardenNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }

  const channel = getRuntimeResources().notifications.channel;

  await Notifications.setNotificationChannelAsync(GARDEN_CHANNEL_ID, {
    name: channel.name,
    description: channel.description,
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null
  });
};

/**
 * Requests the native OS notification permission, but only in a way that never nags
 * the user.
 *
 * Intended to be called from UI code once the player has already said yes to the
 * app's own warm, in-app pre-permission card (see TerrariumHomeScreen's home-entry
 * notification prompt) - never as a cold OS prompt during onboarding, and never a
 * second time. If the user already granted or already denied permission in the past,
 * this is a no-op: we never re-prompt someone who made a choice.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermissionGateResult> => {
  const current = await Notifications.getPermissionsAsync();

  if (current.status === "granted") {
    return { status: "granted" };
  }

  if (current.status === "denied" && !current.canAskAgain) {
    return { status: "denied" };
  }

  if (current.status === "denied" && current.canAskAgain !== true) {
    return { status: "denied" };
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: false
    }
  });

  if (requested.status === "granted") {
    await configureGardenNotificationChannel();
    return { status: "granted" };
  }

  if (requested.status === "denied") {
    return { status: "denied" };
  }

  return { status: "undetermined" };
};
