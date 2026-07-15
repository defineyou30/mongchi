import * as Haptics from "expo-haptics";

import { getActiveAudioSettings } from "./useAudioSettings";

// Settings copy for the "Sounds" toggle ("Little chimes and taps, paired with
// gentle vibrations" -- see settings.sound.effectsDetail) promises that
// turning Sounds off also stops the vibrations, but hapticsEnabled has always
// been its own independent flag with no UI of its own (defaults true). Rather
// than add a second toggle the copy doesn't ask for, both haptic helpers now
// require soundsEnabled too, so "Sounds off" actually means what it says.
const hapticsAllowed = (): boolean => {
  const settings = getActiveAudioSettings();
  return settings.soundsEnabled && settings.hapticsEnabled;
};

/** Light impact -- care action taps, chat send, general small confirmations. */
export const playLightImpactHaptic = (): void => {
  if (!hapticsAllowed()) {
    return;
  }

  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Silent: a missed haptic should never break the interaction it's paired with.
  });
};

/** Success notification -- level-ups, letter opens, and other celebration moments. */
export const playSuccessHaptic = (): void => {
  if (!hapticsAllowed()) {
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // Silent: see playLightImpactHaptic doc comment above.
  });
};
