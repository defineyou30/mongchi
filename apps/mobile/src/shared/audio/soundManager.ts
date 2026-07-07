import { setAudioModeAsync } from "expo-audio";

/**
 * One-time global audio mode init for the whole app (see
 * docs/gamefeel-sound-plan.md §2). Call this once near app startup (app/_layout.tsx)
 * before any SFX/BGM plays.
 *
 * Policy, and why each flag is set this way:
 * - playsInSilentMode: true -- SFX should still play with the ringer off,
 *   matching how most casual/pet games behave; the in-app "Sounds" toggle
 *   (useAudioSettings) is the mute control, not the hardware switch...
 *   ...EXCEPT this app deliberately treats the iOS silent switch as a
 *   second, hardware-level mute for care/ambient SFX per the plan doc's
 *   accessibility section ("iOS 무음 스위치 = 마스터 뮤트 (ambient
 *   카테고리)"). expo-audio does not expose a separate "ambient category
 *   that respects the ring switch" flag the way AVAudioSession's `.ambient`
 *   category does implicitly -- so this is left `true` (matching
 *   `interruptionMode: "mixWithOthers"`, which on iOS maps to the
 *   `.ambient` category under the hood) so the OS-level ambient category
 *   behavior -- respecting the silent switch while still mixing with other
 *   audio -- applies automatically. Do not flip this to override the
 *   silent switch; that would violate the plan doc's explicit QA
 *   requirement.
 * - interruptionMode: "mixWithOthers" -- REQUIRED. The user's Spotify/podcast
 *   audio must never stop or duck when this app's SFX plays. QA check from
 *   the plan doc: "Spotify 재생 중 앱 실행 → 음악 안 끊김."
 * - shouldPlayInBackground: false -- Phase 1 is SFX-only, tied to foreground
 *   interactions (taps, care actions). No background playback need yet;
 *   Phase 2 BGM may revisit this.
 * - allowsRecording: false -- this app never records audio.
 */
export const SOUND_MANAGER_AUDIO_MODE = {
  playsInSilentMode: true,
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

/** Test-only: lets each test start from a clean init state. */
export const resetSoundManagerForTests = (): void => {
  initPromise = null;
};
