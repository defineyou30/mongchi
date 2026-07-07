import { beforeEach, describe, expect, it, vi } from "vitest";

const { setAudioModeAsync } = vi.hoisted(() => ({
  setAudioModeAsync: vi.fn()
}));

vi.mock("expo-audio", () => ({
  setAudioModeAsync: (...args: unknown[]) => setAudioModeAsync(...args)
}));

import { SOUND_MANAGER_AUDIO_MODE, initSoundManager, resetSoundManagerForTests } from "./soundManager";

describe("soundManager", () => {
  beforeEach(() => {
    resetSoundManagerForTests();
    setAudioModeAsync.mockReset();
    setAudioModeAsync.mockResolvedValue(undefined);
  });

  describe("SOUND_MANAGER_AUDIO_MODE", () => {
    it("mixes with other apps' audio so the user's own music/podcast is never interrupted", () => {
      expect(SOUND_MANAGER_AUDIO_MODE.interruptionMode).toBe("mixWithOthers");
    });

    it("plays in silent mode (this app's own 'Sounds' toggle is the mute control, not the ring switch)", () => {
      expect(SOUND_MANAGER_AUDIO_MODE.playsInSilentMode).toBe(true);
    });

    it("does not request background playback or recording in Phase 1", () => {
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
});
