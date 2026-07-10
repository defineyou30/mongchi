import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { impactAsync, notificationAsync } = vi.hoisted(() => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn()
}));

vi.mock("expo-haptics", () => ({
  impactAsync: (...args: unknown[]) => impactAsync(...args),
  notificationAsync: (...args: unknown[]) => notificationAsync(...args),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy", Soft: "soft", Rigid: "rigid" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" }
}));

import { setActiveAudioSettings } from "./useAudioSettings";
import { playLightImpactHaptic, playSuccessHaptic } from "./haptics";

describe("haptics", () => {
  beforeEach(() => {
    impactAsync.mockReset();
    notificationAsync.mockReset();
    impactAsync.mockResolvedValue(undefined);
    notificationAsync.mockResolvedValue(undefined);
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
  });

  afterEach(() => {
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
  });

  describe("playLightImpactHaptic", () => {
    it("triggers a light impact when Sounds is on", () => {
      playLightImpactHaptic();

      expect(impactAsync).toHaveBeenCalledWith("light");
    });

    it("still triggers when Sounds is off but Haptics remains on", () => {
      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: true, hapticsEnabled: true });

      playLightImpactHaptic();

      expect(impactAsync).toHaveBeenCalledWith("light");
    });

    it("does not trigger when Haptics is off", () => {
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: false });

      playLightImpactHaptic();

      expect(impactAsync).not.toHaveBeenCalled();
    });

    it("does not throw when the native call rejects", async () => {
      impactAsync.mockRejectedValueOnce(new Error("native failure"));

      expect(() => playLightImpactHaptic()).not.toThrow();
      await Promise.resolve();
    });
  });

  describe("playSuccessHaptic", () => {
    it("triggers a success notification when Sounds is on", () => {
      playSuccessHaptic();

      expect(notificationAsync).toHaveBeenCalledWith("success");
    });

    it("still triggers when Sounds is off but Haptics remains on", () => {
      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: true, hapticsEnabled: true });

      playSuccessHaptic();

      expect(notificationAsync).toHaveBeenCalledWith("success");
    });

    it("does not trigger when Haptics is off", () => {
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: false });

      playSuccessHaptic();

      expect(notificationAsync).not.toHaveBeenCalled();
    });

    it("does not throw when the native call rejects", async () => {
      notificationAsync.mockRejectedValueOnce(new Error("native failure"));

      expect(() => playSuccessHaptic()).not.toThrow();
      await Promise.resolve();
    });
  });
});
