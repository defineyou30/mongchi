import type { CareActionType, PetPushNotificationKey } from "@mongchi/shared";
import {
  NOTIFICATION_PAYLOAD_VERSION,
  parseBoundedNotificationPayloadFields
} from "./notificationPayloadBoundary";

export const MONGCHI_NOTIFICATION_VERSION = NOTIFICATION_PAYLOAD_VERSION;
export {
  MAX_NOTIFICATION_ACTION_LENGTH,
  MAX_NOTIFICATION_KEY_LENGTH,
  MAX_NOTIFICATION_OWNER_LENGTH,
  MAX_NOTIFICATION_PAYLOAD_BYTES
} from "./notificationPayloadBoundary";

export type MongchiNotificationOwner = "garden" | "return" | "walk" | "letter";
export type MongchiNotificationKey = PetPushNotificationKey | "walk_return" | "monthly_letter";
export type MongchiNotificationAction = CareActionType | "open_app";

export interface NotificationPreferences {
  gardenCare: boolean;
  returnReminders: boolean;
  walkReturns: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Readonly<NotificationPreferences> = {
  gardenCare: true,
  returnReminders: true,
  walkReturns: true
};

export interface MongchiNotificationPayload {
  owner: MongchiNotificationOwner;
  key: MongchiNotificationKey;
  action: MongchiNotificationAction;
}

export interface MongchiNotificationPayloadRecord extends Record<string, unknown> {
  mongchiNotificationVersion: typeof MONGCHI_NOTIFICATION_VERSION;
  mongchiNotificationOwner: MongchiNotificationOwner;
  mongchiNotificationKey: MongchiNotificationKey;
  mongchiNotificationAction: MongchiNotificationAction;
}

export type NotificationHomeTray = "feed" | "play" | "walk" | "rest" | "care";
export type NotificationRouteResult =
  | { destination: "home" }
  | { destination: "home"; tray: NotificationHomeTray };

const owners = new Set<MongchiNotificationOwner>(["garden", "return", "walk", "letter"]);
const keys = new Set<MongchiNotificationKey>([
  "meal_due",
  "meal_urgent",
  "thirst_due",
  "thirst_hot_weather",
  "bored_play",
  "attention_return",
  "walk_window",
  "rest_needed",
  "rainy_cozy_check",
  "return_after_1_day",
  "return_after_3_days",
  "walk_return",
  "monthly_letter"
]);
const actions = new Set<MongchiNotificationAction>([
  "feed",
  "talk",
  "walk",
  "play",
  "rest",
  "affection",
  "water_garden",
  "clean",
  "treat",
  "open_app"
]);
const expectedActionByKey: Record<MongchiNotificationKey, MongchiNotificationAction> = {
  meal_due: "feed",
  meal_urgent: "feed",
  thirst_due: "water_garden",
  thirst_hot_weather: "water_garden",
  bored_play: "play",
  attention_return: "affection",
  walk_window: "walk",
  rest_needed: "rest",
  rainy_cozy_check: "talk",
  return_after_1_day: "open_app",
  return_after_3_days: "open_app",
  walk_return: "walk",
  monthly_letter: "open_app"
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const createNotificationPayload = ({
  owner,
  key,
  action
}: MongchiNotificationPayload): MongchiNotificationPayloadRecord => ({
  mongchiNotificationVersion: MONGCHI_NOTIFICATION_VERSION,
  mongchiNotificationOwner: owner,
  mongchiNotificationKey: key,
  mongchiNotificationAction: action
});

export const parseNotificationPayload = (value: unknown): MongchiNotificationPayload | null => {
  const bounded = parseBoundedNotificationPayloadFields(value);

  if (!bounded) {
    return null;
  }

  const { owner, key, action } = bounded;

  if (
    !owners.has(owner as MongchiNotificationOwner) ||
    !keys.has(key as MongchiNotificationKey) ||
    !actions.has(action as MongchiNotificationAction)
  ) {
    return null;
  }

  const isGardenPayload = owner === "garden" && !key.startsWith("return_after_") && key !== "walk_return" && key !== "monthly_letter" && action !== "open_app";
  const isReturnPayload = owner === "return" && key.startsWith("return_after_") && action === "open_app";
  const isWalkPayload = owner === "walk" && key === "walk_return" && action === "walk";
  const isLetterPayload = owner === "letter" && key === "monthly_letter" && action === "open_app";
  const hasExpectedAction = expectedActionByKey[key as MongchiNotificationKey] === action;

  if ((!isGardenPayload && !isReturnPayload && !isWalkPayload && !isLetterPayload) || !hasExpectedAction) {
    return null;
  }

  return {
    owner: owner as MongchiNotificationOwner,
    key: key as MongchiNotificationKey,
    action: action as MongchiNotificationAction
  };
};

const getResponseData = (value: unknown): unknown => {
  try {
    if (!isRecord(value)) {
      return null;
    }

    const notificationDescriptor = Object.getOwnPropertyDescriptor(value, "notification");

    if (!notificationDescriptor || !("value" in notificationDescriptor) || !isRecord(notificationDescriptor.value)) {
      return null;
    }

    const requestDescriptor = Object.getOwnPropertyDescriptor(notificationDescriptor.value, "request");

    if (!requestDescriptor || !("value" in requestDescriptor) || !isRecord(requestDescriptor.value)) {
      return null;
    }

    const contentDescriptor = Object.getOwnPropertyDescriptor(requestDescriptor.value, "content");

    if (!contentDescriptor || !("value" in contentDescriptor) || !isRecord(contentDescriptor.value)) {
      return null;
    }

    const dataDescriptor = Object.getOwnPropertyDescriptor(contentDescriptor.value, "data");

    return dataDescriptor && "value" in dataDescriptor ? dataDescriptor.value : null;
  } catch {
    return null;
  }
};

export const getNotificationRoute = (payload: MongchiNotificationPayload): NotificationRouteResult => {
  switch (payload.action) {
    case "feed":
    case "treat":
      return { destination: "home", tray: "feed" };
    case "play":
      return { destination: "home", tray: "play" };
    case "walk":
      return { destination: "home", tray: "walk" };
    case "rest":
      return { destination: "home", tray: "rest" };
    case "clean":
    case "water_garden":
      return { destination: "home", tray: "care" };
    case "affection":
    case "open_app":
    case "talk":
      return { destination: "home" };
  }
};

export const parseNotificationResponseRoute = (value: unknown): NotificationRouteResult | null => {
  const payload = parseNotificationPayload(getResponseData(value));

  return payload ? getNotificationRoute(payload) : null;
};
