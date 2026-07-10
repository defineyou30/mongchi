import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import type { PetPushNotificationInput, PetPushNotificationKey } from "@mongchi/shared";

import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { parseNotificationPayload } from "./notificationContracts";
import {
  syncScheduledPetNotifications,
  type SyncScheduledPetNotificationsResult
} from "./notificationScheduler";
import {
  createLatestNotificationSyncCoordinator,
  type LatestNotificationSyncCoordinator
} from "./notificationSyncCoordinator";

/** Scoped to this feature only - deliberately separate from the session's own storage key. */
const LAST_DELIVERED_STORAGE_KEY = "mongchi/notification-last-delivered-v2";

type LastDeliveredAtByKey = Partial<Record<PetPushNotificationKey, string>>;

const readLastDeliveredAtByKey = async (): Promise<LastDeliveredAtByKey> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_DELIVERED_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return typeof parsed === "object" && parsed !== null ? (parsed as LastDeliveredAtByKey) : {};
  } catch {
    return {};
  }
};

const writeLastDeliveredAtByKey = async (value: LastDeliveredAtByKey): Promise<void> => {
  await AsyncStorage.setItem(LAST_DELIVERED_STORAGE_KEY, JSON.stringify(value));
};

/**
 * Subscribes to the existing session context and keeps locally scheduled garden reminders in
 * sync with current care state and weather. Read-only with respect to session state - this
 * hook only consumes useTerrariumSession(), it never mutates session/provider internals.
 *
 * Intended to be mounted once near the app root, inside TerrariumSessionProvider.
 */
export const useNotificationSync = (): void => {
  const { isHydrated, petProfile, careState, careStreak, satisfactionSummary, weatherState } = useTerrariumSession();
  const lastDeliveredAtByKeyRef = useRef<LastDeliveredAtByKey>({});
  const loadHistoryPromiseRef = useRef<Promise<void> | null>(null);
  const deliveryWriteChainRef = useRef(Promise.resolve());
  const coordinatorRef = useRef<LatestNotificationSyncCoordinator<PetPushNotificationInput, SyncScheduledPetNotificationsResult> | null>(null);

  if (!coordinatorRef.current) {
    coordinatorRef.current = createLatestNotificationSyncCoordinator(syncScheduledPetNotifications);
  }

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const payload = parseNotificationPayload(notification.request.content.data);

      if (!payload || payload.key === "walk_return") {
        return;
      }

      const deliveredAt = Number.isFinite(notification.date)
        ? new Date(notification.date).toISOString()
        : new Date().toISOString();
      const next = {
        ...lastDeliveredAtByKeyRef.current,
        [payload.key]: deliveredAt
      };
      lastDeliveredAtByKeyRef.current = next;
      deliveryWriteChainRef.current = deliveryWriteChainRef.current
        .then(() => writeLastDeliveredAtByKey(next))
        .catch((error: unknown) => {
          console.warn("Failed to persist notification delivery history.", error);
        });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || !petProfile) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      if (!loadHistoryPromiseRef.current) {
        loadHistoryPromiseRef.current = readLastDeliveredAtByKey().then((value) => {
          lastDeliveredAtByKeyRef.current = { ...value, ...lastDeliveredAtByKeyRef.current };
        });
      }

      await loadHistoryPromiseRef.current;

      if (cancelled) {
        return;
      }

      const input: PetPushNotificationInput = {
        petName: petProfile.name,
        now: new Date().toISOString(),
        careState: {
          satiety: careState.satiety,
          happiness: careState.happiness,
          energy: careState.energy,
          gardenHealth: careState.gardenHealth,
          cleanliness: careState.cleanliness,
          affection: careState.affection,
          ...(careState.lastFedAt ? { lastFedAt: careState.lastFedAt } : {}),
          ...(careState.lastInteractionAt ? { lastInteractionAt: careState.lastInteractionAt } : {}),
          updatedAt: careState.updatedAt
        },
        satisfactionSummary: satisfactionSummary
          ? {
              ...(satisfactionSummary.primaryNeed ? { primaryNeed: satisfactionSummary.primaryNeed } : {}),
              ...(satisfactionSummary.recommendedAction ? { recommendedAction: satisfactionSummary.recommendedAction } : {})
            }
          : null,
        weather: weatherState.context,
        lastSentAtByKey: lastDeliveredAtByKeyRef.current,
        careStreakCurrent: careStreak.current
      };

      await coordinatorRef.current?.request(input);
    };

    void sync().catch((error: unknown) => {
      console.warn("Failed to synchronize scheduled notifications.", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    petProfile,
    careState.satiety,
    careState.happiness,
    careState.energy,
    careState.gardenHealth,
    careState.cleanliness,
    careState.affection,
    careState.lastFedAt,
    careState.lastInteractionAt,
    careState.updatedAt,
    careStreak.current,
    satisfactionSummary,
    weatherState.context
  ]);
};
