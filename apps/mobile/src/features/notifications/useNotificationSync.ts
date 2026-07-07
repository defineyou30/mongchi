import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";
import type { PetPushNotificationInput, PetPushNotificationKey } from "@mongchi/shared";

import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { syncScheduledPetNotifications } from "./notificationScheduler";

/** Scoped to this feature only - deliberately separate from the session's own storage key. */
const LAST_SENT_STORAGE_KEY = "mongchi/notification-last-sent-v1";

type LastSentAtByKey = Partial<Record<PetPushNotificationKey, string>>;

const readLastSentAtByKey = async (): Promise<LastSentAtByKey> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_SENT_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return typeof parsed === "object" && parsed !== null ? (parsed as LastSentAtByKey) : {};
  } catch {
    return {};
  }
};

const writeLastSentAtByKey = async (value: LastSentAtByKey): Promise<void> => {
  await AsyncStorage.setItem(LAST_SENT_STORAGE_KEY, JSON.stringify(value));
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
  const lastSentAtByKeyRef = useRef<LastSentAtByKey>({});
  const hasLoadedLastSentRef = useRef(false);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || !petProfile) {
      return;
    }

    if (syncInFlightRef.current) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      syncInFlightRef.current = true;

      if (!hasLoadedLastSentRef.current) {
        lastSentAtByKeyRef.current = await readLastSentAtByKey();
        hasLoadedLastSentRef.current = true;
      }

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
        lastSentAtByKey: lastSentAtByKeyRef.current,
        careStreakCurrent: careStreak.current
      };

      const result = await syncScheduledPetNotifications(input);

      if (cancelled || result.scheduledKeys.length === 0) {
        return;
      }

      const sentAt = new Date().toISOString();
      const next = { ...lastSentAtByKeyRef.current };

      for (const key of result.scheduledKeys) {
        next[key] = sentAt;
      }

      lastSentAtByKeyRef.current = next;
      await writeLastSentAtByKey(next);
    };

    void sync().finally(() => {
      syncInFlightRef.current = false;
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
