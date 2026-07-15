import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { PetPushNotificationInput, PetPushNotificationKey } from "@mongchi/shared";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { synchronizeMonthlyLetterNotification } from "./monthlyLetterNotification";
import { parseNotificationPayload } from "./notificationContracts";
import { configureGardenNotificationChannel } from "./notificationPermission";
import { getActiveNotificationPreferences, subscribeToNotificationPreferences } from "./notificationPreferencesStore";
import {
  syncScheduledPetNotifications,
  type SyncScheduledPetNotificationsResult
} from "./notificationScheduler";
import {
  createLatestNotificationSyncCoordinator,
  type LatestNotificationSyncCoordinator
} from "./notificationSyncCoordinator";
import {
  cancelPersistedWalkReturnNotification,
  synchronizeWalkReturnNotification
} from "./walkReturnNotification";

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
  const { i18n } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const { isHydrated, petProfile, careState, careStreak, satisfactionSummary, weatherState, activeWalk } = useTerrariumSession();
  const lastDeliveredAtByKeyRef = useRef<LastDeliveredAtByKey>({});
  const loadHistoryPromiseRef = useRef<Promise<void> | null>(null);
  const deliveryWriteChainRef = useRef(Promise.resolve());
  const coordinatorRef = useRef<LatestNotificationSyncCoordinator<PetPushNotificationInput, SyncScheduledPetNotificationsResult> | null>(null);
  // Latest "resync" closures from the two effects below, refreshed on every
  // run of those effects -- lets the preference-change subscription effect
  // further down trigger an immediate resync without needing useCallback
  // (this file's unit test mocks react down to just useEffect/useRef).
  const runLocalizedNativeStateSyncRef = useRef<(() => Promise<void>) | null>(null);
  const runScheduledNotificationSyncRef = useRef<(() => Promise<void>) | null>(null);

  if (!coordinatorRef.current) {
    // Reads preferences fresh at call time (not just at coordinator-creation
    // time) so a toggle flip is honored on the very next sync, whenever it runs.
    coordinatorRef.current = createLatestNotificationSyncCoordinator((input: PetPushNotificationInput) =>
      syncScheduledPetNotifications(input, getActiveNotificationPreferences())
    );
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

    const synchronizeLocalizedNativeState = async (): Promise<void> => {
      await configureGardenNotificationChannel();

      await synchronizeMonthlyLetterNotification({
        petName: petProfile.name,
        movedInAt: petProfile.createdAt,
        preferences: { gardenCare: getActiveNotificationPreferences().gardenCare }
      });

      if (activeWalk?.status === "walking") {
        await synchronizeWalkReturnNotification({
          petName: petProfile.name,
          returnAt: activeWalk.returnAt,
          preferences: { walkReturns: getActiveNotificationPreferences().walkReturns }
        });
        return;
      }

      await cancelPersistedWalkReturnNotification();
    };

    runLocalizedNativeStateSyncRef.current = synchronizeLocalizedNativeState;

    void synchronizeLocalizedNativeState().catch((error: unknown) => {
      console.warn("Failed to synchronize localized notification metadata.", error);
    });
  }, [activeWalk?.id, activeWalk?.returnAt, activeWalk?.status, isHydrated, locale, petProfile]);

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

    runScheduledNotificationSyncRef.current = sync;

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
    weatherState.context,
    locale
  ]);

  // Toggling a preference in SettingsScreen updates the module-level store
  // (see notificationPreferencesStore.ts) rather than this component's props,
  // so without this subscription the two effects above would only pick up
  // the change on their next naturally-triggered resync (e.g. the next care
  // action). Subscribing here re-runs both immediately, so turning a
  // reminder off cancels its existing schedule right away.
  useEffect(() => {
    const unsubscribe = subscribeToNotificationPreferences(() => {
      void runLocalizedNativeStateSyncRef.current?.().catch((error: unknown) => {
        console.warn("Failed to resynchronize localized notification metadata after a preference change.", error);
      });
      void runScheduledNotificationSyncRef.current?.().catch((error: unknown) => {
        console.warn("Failed to resynchronize scheduled notifications after a preference change.", error);
      });
    });

    return unsubscribe;
  }, []);
};
