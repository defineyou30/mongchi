import * as Haptics from "expo-haptics";

import { getActiveAudioSettings } from "./useAudioSettings";

/** Light impact -- care action taps, chat send, general small confirmations. */
export const playLightImpactHaptic = (): void => {
  if (!getActiveAudioSettings().hapticsEnabled) {
    return;
  }

  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Silent: a missed haptic should never break the interaction it's paired with.
  });
};

/** Success notification -- level-ups, letter opens, and other celebration moments. */
export const playSuccessHaptic = (): void => {
  if (!getActiveAudioSettings().hapticsEnabled) {
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // Silent: see playLightImpactHaptic doc comment above.
  });
};
