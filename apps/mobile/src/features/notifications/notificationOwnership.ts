import * as Notifications from "expo-notifications";

import {
  parseNotificationPayload,
  type MongchiNotificationKey,
  type MongchiNotificationOwner
} from "./notificationContracts";

export const MAX_NOTIFICATION_INVENTORY_QUERY_ATTEMPTS = 2;

export interface CancelOwnedNotificationsResult {
  cancelledIds: string[];
  failedCancellationIds: string[];
}

export const cancelOwnedScheduledNotifications = async (
  ownersToCancel: ReadonlySet<MongchiNotificationOwner>
): Promise<CancelOwnedNotificationsResult> => {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  const ownedIds = Array.from(
    new Set(
      requests.flatMap((request) => {
        const payload = parseNotificationPayload(request.content.data);

        return payload && ownersToCancel.has(payload.owner) ? [request.identifier] : [];
      })
    )
  );
  const cancelledIds: string[] = [];
  const failedCancellationIds: string[] = [];

  for (const notificationId of ownedIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      cancelledIds.push(notificationId);
    } catch {
      failedCancellationIds.push(notificationId);
    }
  }

  return { cancelledIds, failedCancellationIds };
};

export interface ScheduledNotificationReceipt {
  key: MongchiNotificationKey;
  notificationId: string;
}

export interface VerifyScheduledNotificationInventoryResult {
  confirmed: ScheduledNotificationReceipt[];
  unconfirmed: ScheduledNotificationReceipt[];
  failure?: "inventory_query_failed" | "missing_native_inventory";
}

export const verifyScheduledNotificationInventory = async (
  receipts: ScheduledNotificationReceipt[]
): Promise<VerifyScheduledNotificationInventoryResult> => {
  if (receipts.length === 0) {
    return { confirmed: [], unconfirmed: [] };
  }

  let requests: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>> | null = null;

  for (let attempt = 0; attempt < MAX_NOTIFICATION_INVENTORY_QUERY_ATTEMPTS; attempt += 1) {
    try {
      requests = await Notifications.getAllScheduledNotificationsAsync();
      break;
    } catch {
      requests = null;
    }
  }

  if (!requests) {
    return {
      confirmed: [],
      unconfirmed: receipts,
      failure: "inventory_query_failed"
    };
  }

  const inventoryById = new Map(
    requests.map((request) => [request.identifier, parseNotificationPayload(request.content.data)] as const)
  );
  const confirmed = receipts.filter(({ key, notificationId }) => inventoryById.get(notificationId)?.key === key);
  const confirmedIds = new Set(confirmed.map(({ notificationId }) => notificationId));
  const unconfirmed = receipts.filter(({ notificationId }) => !confirmedIds.has(notificationId));

  return {
    confirmed,
    unconfirmed,
    ...(unconfirmed.length > 0 ? { failure: "missing_native_inventory" as const } : {})
  };
};
