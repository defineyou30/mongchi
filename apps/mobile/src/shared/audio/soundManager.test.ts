import { beforeEach, describe, expect, it, vi } from "vitest";

const { setAudioModeAsync, addEventListener, removeMock } = vi.hoisted(() => ({
  setAudioModeAsync: vi.fn(),
  addEventListener: vi.fn(),
  removeMock: vi.fn()
}));

const { pauseAmbienceForBackground, resumeAmbienceForForeground } = vi.hoisted(() => ({
  pauseAmbienceForBackground: vi.fn(),
  resumeAmbienceForForeground: vi.fn()
}));

const { pauseBgmForBackground, resumeBgmForForeground } = vi.hoisted(() => ({
  pauseBgmForBackground: vi.fn(),
  resumeBgmForForeground: vi.fn()
}));

vi.mock("expo-audio", () => ({
  setAudioModeAsync: (...args: unknown[]) => setAudioModeAsync(...args)
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (...args: unknown[]) => {
      addEventListener(...args);
      return { remove: removeMock };
    }
  }
}));

vi.mock("./ambiencePlayer", () => ({
  pauseAmbienceForBackground: (...args: unknown[]) => pauseAmbienceForBackground(...args),
  resumeAmbienceForForeground: (...args: unknown[]) => resumeAmbienceForForeground(...args)
}));

vi.mock("./bgmPlayer", () => ({
  pauseBgmForBackground: (...args: unknown[]) => pauseBgmForBackground(...args),
  resumeBgmForForeground: (...args: unknown[]) => resumeBgmForForeground(...args)
}));

import {
  SOUND_MANAGER_AUDIO_MODE,
  initSoundManager,
  registerBackgroundAudioHandling,
  resetSoundManagerForTests
} from "./soundManager";

describe("soundManager", () => {
  beforeEach(() => {
    resetSoundManagerForTests();
    setAudioModeAsync.mockReset();
    setAudioModeAsync.mockResolvedValue(undefined);
    addEventListener.mockReset();
    removeMock.mockReset();
    pauseAmbienceForBackground.mockReset();
    resumeAmbienceForForeground.mockReset();
    pauseBgmForBackground.mockReset();
    resumeBgmForForeground.mockReset();
  });

  describe("SOUND_MANAGER_AUDIO_MODE", () => {
    it("mixes with other apps' audio so the user's own music/podcast is never interrupted", () => {
      expect(SOUND_MANAGER_AUDIO_MODE.interruptionMode).toBe("mixWithOthers");
    });

    it("respects the iOS silent switch, matching the app's ambient game-audio policy", () => {
      expect(SOUND_MANAGER_AUDIO_MODE.playsInSilentMode).toBe(false);
    });

    it("does not request background playback or recording", () => {
      expect(SOUND_MANAGER_AUDIO_MODE.shouldPlayInBackground).toBe(false);
      expect(SOUND_MANAGER_AUDIO_MODE.allowsRecording).toBe(false);
    });
  });

  describe("initSoundManager", () => {
    it("applies the audio mode", async () => {
      await initSoundManager();

      expect(setAudioModeAsync).toHaveBeenCalledWith(SOUND_MANAGER_AUDIO_MODE);
    });

    it("only applies the audio mode once across repeated calls", async () => {
      await initSoundManager();
      await initSoundManager();

      expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    });

    it("never rejects even if the native call fails", async () => {
      setAudioModeAsync.mockRejectedValueOnce(new Error("native failure"));

      await expect(initSoundManager()).resolves.toBeUndefined();
    });
  });

  describe("registerBackgroundAudioHandling", () => {
    it("subscribes to AppState changes", () => {
      registerBackgroundAudioHandling();

      expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("only subscribes once across repeated calls", () => {
      registerBackgroundAudioHandling();
      registerBackgroundAudioHandling();

      expect(addEventListener).toHaveBeenCalledTimes(1);
    });

    it("pauses BGM and ambience when the app goes to background", () => {
      registerBackgroundAudioHandling();
      const handler = addEventListener.mock.calls[0]![1] as (state: string) => void;

      handler("background");

      expect(pauseBgmForBackground).toHaveBeenCalled();
      expect(pauseAmbienceForBackground).toHaveBeenCalled();
      expect(resumeBgmForForeground).not.toHaveBeenCalled();
      expect(resumeAmbienceForForeground).not.toHaveBeenCalled();
    });

    it("pauses BGM and ambience when the app becomes inactive (e.g. app switcher, call sheet)", () => {
      registerBackgroundAudioHandling();
      const handler = addEventListener.mock.calls[0]![1] as (state: string) => void;

      handler("inactive");

      expect(pauseBgmForBackground).toHaveBeenCalled();
      expect(pauseAmbienceForBackground).toHaveBeenCalled();
    });

    it("resumes BGM and ambience when the app becomes active", () => {
      registerBackgroundAudioHandling();
      const handler = addEventListener.mock.calls[0]![1] as (state: string) => void;

      handler("active");

      expect(resumeBgmForForeground).toHaveBeenCalled();
      expect(resumeAmbienceForForeground).toHaveBeenCalled();
      expect(pauseBgmForBackground).not.toHaveBeenCalled();
      expect(pauseAmbienceForBackground).not.toHaveBeenCalled();
    });
  });

  describe("resetSoundManagerForTests", () => {
    it("removes the AppState subscription so a fresh registerBackgroundAudioHandling call re-subscribes", () => {
      registerBackgroundAudioHandling();

      resetSoundManagerForTests();
      registerBackgroundAudioHandling();

      expect(removeMock).toHaveBeenCalledTimes(1);
      expect(addEventListener).toHaveBeenCalledTimes(2);
    });
  });
});
