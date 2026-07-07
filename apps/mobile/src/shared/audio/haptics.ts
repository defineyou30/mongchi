import * as Haptics from "expo-haptics";

import { getActiveAudioSettings } from "./useAudioSettings";

/**
 * Haptics share the single "Sounds" toggle with SFX (see
 * docs/gamefeel-sound-plan.md §2 -- "Sounds 토글 1개(SFX+햅틱, 기본 ON)").
 * There is no separate haptics setting in Phase 1.
 */

/** Light impact -- care action taps, chat send, general small confirmations. */
export const playLightImpactHaptic = (): void => {
  if (!getActiveAudioSettings().soundsEnabled) {
    return;
  }

  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Silent: a missed haptic should never break the interaction it's paired with.
  });
};

/** Success notification -- level-ups, letter opens, and other celebration moments. */
export const playSuccessHaptic = (): void => {
  if (!getActiveAudioSettings().soundsEnabled) {
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // Silent: see playLightImpactHaptic doc comment above.
  });
};
