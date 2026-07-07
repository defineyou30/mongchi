import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAudioPlayer } = vi.hoisted(() => ({
  createAudioPlayer: vi.fn()
}));

vi.mock("expo-audio", () => ({
  createAudioPlayer: (...args: unknown[]) => createAudioPlayer(...args)
}));

vi.mock("./bgmAssets", () => ({
  bgmAssetSources: {
    bgm_garden_day: 1,
    bgm_garden_night: 2
  },
  bgmTrackForTimeOfDay: (isDaytime: boolean) => (isDaytime ? "bgm_garden_day" : "bgm_garden_night")
}));

import { setActiveAudioSettings } from "./useAudioSettings";
import {
  duckBgm,
  duckBgmForMs,
  getActiveBgmTrackIdForTests,
  pauseBgmForBackground,
  playBgm,
  playBgmForTimeOfDay,
  preloadBgm,
  resetBgmPlayerForTests,
  resumeBgmForForeground,
  stopBgm,
  syncBgmWithSettings
} from "./bgmPlayer";

interface FakePlayer {
  loop: boolean;
  volume: number;
  playing: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
}

const makeFakePlayer = (): FakePlayer => ({
  loop: false,
  volume: 0,
  playing: false,
  play: vi.fn(function (this: FakePlayer) {
    this.playing = true;
  }),
  pause: vi.fn(function (this: FakePlayer) {
    this.playing = false;
  }),
  seekTo: vi.fn()
});

const flushRamp = async (ms = 3000) => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe("bgmPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBgmPlayerForTests();
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true });
    createAudioPlayer.mockReset();
    createAudioPlayer.mockImplementation(() => makeFakePlayer());
  });

  afterEach(() => {
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true });
    vi.useRealTimers();
  });

  describe("preloadBgm", () => {
    it("creates one looping player per BGM track", () => {
      preloadBgm();

      expect(createAudioPlayer).toHaveBeenCalledTimes(2);
      const players = createAudioPlayer.mock.results.map((r) => r.value as FakePlayer);
      expect(players.every((p) => p.loop)).toBe(true);
    });

    it("only creates players once even if called repeatedly", () => {
      preloadBgm();
      preloadBgm();

      expect(createAudioPlayer).toHaveBeenCalledTimes(2);
    });
  });

  describe("playBgm", () => {
    it("starts the requested track and ramps its volume up", async () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;

      expect(player.play).toHaveBeenCalled();
      await flushRamp();
      expect(player.volume).toBeGreaterThan(0);
    });

    it("does not play when the Music setting is off", async () => {
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false });

      playBgm("bgm_garden_day");
      preloadBgm();
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;

      await flushRamp();
      expect(player.play).not.toHaveBeenCalled();
    });

    it("is a no-op when the requested track is already active", () => {
      playBgm("bgm_garden_day");
      const callsAfterFirst = createAudioPlayer.mock.calls.length;

      playBgm("bgm_garden_day");

      expect(createAudioPlayer.mock.calls.length).toBe(callsAfterFirst);
    });

    it("crossfades: fades out the previous track when switching tracks", async () => {
      playBgm("bgm_garden_day");
      const dayPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      expect(dayPlayer.volume).toBeGreaterThan(0);

      playBgm("bgm_garden_night");
      const nightPlayer = createAudioPlayer.mock.results[1]!.value as FakePlayer;

      await flushRamp();

      expect(nightPlayer.volume).toBeGreaterThan(0);
      expect(dayPlayer.volume).toBe(0);
      expect(dayPlayer.pause).toHaveBeenCalled();
    });

    it("tracks the active track id", () => {
      expect(getActiveBgmTrackIdForTests()).toBeNull();

      playBgm("bgm_garden_night");

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_night");
    });
  });

  describe("playBgmForTimeOfDay", () => {
    it("plays the day track when isDaytime is true", () => {
      playBgmForTimeOfDay(true);

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_day");
    });

    it("plays the night track when isDaytime is false", () => {
      playBgmForTimeOfDay(false);

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_night");
    });
  });

  describe("stopBgm", () => {
    it("fades out and pauses the active track, clearing the desired track", async () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();

      stopBgm();
      await flushRamp();

      expect(player.volume).toBe(0);
      expect(player.pause).toHaveBeenCalled();
      expect(getActiveBgmTrackIdForTests()).toBeNull();
    });

    it("is a safe no-op when nothing is playing", () => {
      expect(() => stopBgm()).not.toThrow();
    });
  });

  describe("syncBgmWithSettings", () => {
    it("brings in the desired track when Music is turned on after being off", async () => {
      // Mirrors real app startup order: preloadBgm() always runs from
      // app/_layout.tsx regardless of the Music setting.
      preloadBgm();
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false });
      playBgm("bgm_garden_day"); // records desired track, but does not play (Music is off)
      expect(player.play).not.toHaveBeenCalled();

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true });
      syncBgmWithSettings();
      await flushRamp();

      expect(player.play).toHaveBeenCalled();
      expect(player.volume).toBeGreaterThan(0);
    });

    it("fades out the active track when Music is turned off", async () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      expect(player.volume).toBeGreaterThan(0);

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false });
      syncBgmWithSettings();
      await flushRamp();

      expect(player.volume).toBe(0);
      expect(player.pause).toHaveBeenCalled();
      // Desired track is preserved even though Music is off, so a future
      // syncBgmWithSettings() (Music turned back on) can resume it.
      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_day");
    });

    it("is a safe no-op when nothing is desired", () => {
      expect(() => syncBgmWithSettings()).not.toThrow();
    });
  });

  describe("duckBgm / duckBgmForMs", () => {
    it("lowers volume while ducked and restores it when released", async () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      const fullVolume = player.volume;

      const unduck = duckBgm();
      await flushRamp();
      expect(player.volume).toBeLessThan(fullVolume);

      unduck();
      await flushRamp();
      expect(player.volume).toBeCloseTo(fullVolume, 5);
    });

    it("only restores full volume once every overlapping duck is released", async () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      const fullVolume = player.volume;

      const unduckA = duckBgm();
      const unduckB = duckBgm();
      await flushRamp();
      const duckedVolume = player.volume;
      expect(duckedVolume).toBeLessThan(fullVolume);

      unduckA();
      await flushRamp();
      // Still ducked -- unduckB has not been released yet.
      expect(player.volume).toBeCloseTo(duckedVolume, 5);

      unduckB();
      await flushRamp();
      expect(player.volume).toBeCloseTo(fullVolume, 5);
    });

    it("duckBgmForMs restores automatically after the given duration", async () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      const fullVolume = player.volume;

      duckBgmForMs(500);
      await vi.advanceTimersByTimeAsync(300);
      expect(player.volume).toBeLessThan(fullVolume);

      await vi.advanceTimersByTimeAsync(1000);
      expect(player.volume).toBeCloseTo(fullVolume, 5);
    });
  });

  describe("pauseBgmForBackground / resumeBgmForForeground", () => {
    it("pauses the active track without resetting its volume/position", async () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      const volumeBeforePause = player.volume;

      pauseBgmForBackground();

      expect(player.pause).toHaveBeenCalled();
      expect(player.seekTo).not.toHaveBeenCalled();
      expect(player.volume).toBe(volumeBeforePause);
    });

    it("resumes playback on foreground if a track was active", () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      pauseBgmForBackground();
      player.play.mockClear();

      resumeBgmForForeground();

      expect(player.play).toHaveBeenCalled();
    });

    it("does not resume if Music was turned off while backgrounded", () => {
      playBgm("bgm_garden_day");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      pauseBgmForBackground();
      player.play.mockClear();
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false });

      resumeBgmForForeground();

      expect(player.play).not.toHaveBeenCalled();
    });

    it("is a safe no-op when nothing is active", () => {
      expect(() => pauseBgmForBackground()).not.toThrow();
      expect(() => resumeBgmForForeground()).not.toThrow();
    });
  });
});
