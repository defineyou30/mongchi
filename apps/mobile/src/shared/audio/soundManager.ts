import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { setAudioModeAsync } from "expo-audio";

import { pauseAmbienceForBackground, resumeAmbienceForForeground } from "./ambiencePlayer";
import { pauseBgmForBackground, resumeBgmForForeground } from "./bgmPlayer";

/**
 * One-time global audio mode init for the whole app (see
 * docs/gamefeel-sound-plan.md §2). Call this once near app startup (app/_layout.tsx)
 * before any SFX/BGM plays.
 *
 * Policy, and why each flag is set this way:
 * - playsInSilentMode: false -- Expo Audio documents this flag as the iOS
 *   control for whether app audio may play while the device is silent. MongChi
 *   chooses an ambient game-audio policy: the hardware silent switch mutes
 *   audio, while the in-app SFX/music preferences remain independent.
 * - interruptionMode: "mixWithOthers" -- REQUIRED. The user's Spotify/podcast
 *   audio must never stop or duck when this app's SFX plays. QA check from
 *   the plan doc: "Spotify 재생 중 앱 실행 → 음악 안 끊김."
 * - shouldPlayInBackground: false -- BGM/ambience (Phase 2) are still
 *   foreground-only: the app has no `UIBackgroundModes: ["audio"]`
 *   entitlement declared in app.json, so requesting background playback
 *   here would not actually work without also adding that entitlement and
 *   rebuilding the dev client. Instead, BGM/ambience are explicitly paused
 *   on backgrounding and resumed on foregrounding via the AppState listener
 *   below (registerBackgroundAudioHandling) -- "stop cleanly" rather than
 *   "continue in background", which also matches most casual/pet games'
 *   behavior and avoids surprising battery drain.
 * - allowsRecording: false -- this app never records audio.
 */
export const SOUND_MANAGER_AUDIO_MODE = {
  playsInSilentMode: false,
  interruptionMode: "mixWithOthers" as const,
  shouldPlayInBackground: false,
  allowsRecording: false
};

let initPromise: Promise<void> | null = null;

/**
 * Idempotent: safe to call multiple times (e.g. from both app/_layout.tsx
 * and a test) -- only the first call actually applies the audio mode.
 */
export const initSoundManager = (): Promise<void> => {
  if (!initPromise) {
    initPromise = setAudioModeAsync(SOUND_MANAGER_AUDIO_MODE).catch(() => {
      // Silent: worst case SFX plays with default audio mode behavior
      // (still audible, just not guaranteed to mix with other apps'
      // audio) rather than crashing app startup over a sound nicety.
    });
  }

  return initPromise;
};

let backgroundHandlingSubscription: { remove: () => void } | null = null;

const handleAppStateChange = (nextState: AppStateStatus): void => {
  if (nextState === "active") {
    resumeBgmForForeground();
    resumeAmbienceForForeground();
  } else {
    // "background" or "inactive" -- pause on either rather than only on
    // "background", since "inactive" (e.g. the iOS app switcher, an
    // incoming call sheet) can linger and BGM playing under a system UI
    // overlay reads as a bug, not a feature.
    pauseBgmForBackground();
    pauseAmbienceForBackground();
  }
};

/**
 * Registers the BGM/ambience pause-on-background / resume-on-foreground
 * behavior (see the shouldPlayInBackground doc comment above). Call once
 * near app startup, alongside initSoundManager -- idempotent, safe to call
 * multiple times (only the first call actually subscribes).
 */
export const registerBackgroundAudioHandling = (): void => {
  if (backgroundHandlingSubscription) {
    return;
  }

  backgroundHandlingSubscription = AppState.addEventListener("change", handleAppStateChange);
};

/** Test-only: lets each test start from a clean init state. */
export const resetSoundManagerForTests = (): void => {
  initPromise = null;

  if (backgroundHandlingSubscription) {
    backgroundHandlingSubscription.remove();
    backgroundHandlingSubscription = null;
  }
};
