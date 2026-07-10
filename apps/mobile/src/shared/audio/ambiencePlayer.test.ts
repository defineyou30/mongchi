import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAudioPlayer } = vi.hoisted(() => ({
  createAudioPlayer: vi.fn()
}));

vi.mock("expo-audio", () => ({
  createAudioPlayer: (...args: unknown[]) => createAudioPlayer(...args)
}));

vi.mock("./ambienceAssets", () => ({
  ambienceAssetSources: {
    amb_birds: 1,
    amb_rain: 2
  },
  weatherToAmbienceTrack: (condition: string) => (condition === "rain" || condition === "storm" ? "amb_rain" : "amb_birds")
}));

import { setActiveAudioSettings } from "./useAudioSettings";
import {
  getActiveAmbienceTrackIdForTests,
  pauseAmbienceForBackground,
  playAmbienceForWeather,
  playAmbienceTrack,
  preloadAmbience,
  resetAmbiencePlayerForTests,
  resumeAmbienceForForeground,
  stopAmbience,
  syncAmbienceWithSettings
} from "./ambiencePlayer";

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

describe("ambiencePlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAmbiencePlayerForTests();
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
    createAudioPlayer.mockReset();
    createAudioPlayer.mockImplementation(() => makeFakePlayer());
  });

  afterEach(() => {
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
    vi.useRealTimers();
  });

  describe("preloadAmbience", () => {
    it("creates one looping player per ambience track", () => {
      preloadAmbience();

      expect(createAudioPlayer).toHaveBeenCalledTimes(2);
      const players = createAudioPlayer.mock.results.map((r) => r.value as FakePlayer);
      expect(players.every((p) => p.loop)).toBe(true);
    });

    it("only creates players once even if called repeatedly", () => {
      preloadAmbience();
      preloadAmbience();

      expect(createAudioPlayer).toHaveBeenCalledTimes(2);
    });
  });

  describe("playAmbienceForWeather", () => {
    it("plays birds ambience for clear weather", () => {
      playAmbienceForWeather("clear");

      expect(getActiveAmbienceTrackIdForTests()).toBe("amb_birds");
    });

    it("plays rain ambience for rain", () => {
      playAmbienceForWeather("rain");

      expect(getActiveAmbienceTrackIdForTests()).toBe("amb_rain");
    });

    it("plays rain ambience for storm", () => {
      playAmbienceForWeather("storm");

      expect(getActiveAmbienceTrackIdForTests()).toBe("amb_rain");
    });

    it("swaps (crossfades) when the weather-mapped track changes", async () => {
      playAmbienceForWeather("clear");
      const birdsPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      expect(birdsPlayer.volume).toBeGreaterThan(0);

      playAmbienceForWeather("rain");
      const rainPlayer = createAudioPlayer.mock.results[1]!.value as FakePlayer;
      await flushRamp();

      expect(rainPlayer.volume).toBeGreaterThan(0);
      expect(birdsPlayer.volume).toBe(0);
      expect(birdsPlayer.pause).toHaveBeenCalled();
    });

    it("does not let a stale crossfade stop timer pause a track that has been reactivated", async () => {
      playAmbienceTrack("amb_birds");
      const birdsPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();

      playAmbienceTrack("amb_rain");
      await vi.advanceTimersByTimeAsync(1000);

      playAmbienceTrack("amb_birds");
      await flushRamp();

      expect(birdsPlayer.playing).toBe(true);
    });

    it("does not restart when the mapped track is unchanged (e.g. clear -> partly_cloudy)", () => {
      playAmbienceForWeather("clear");
      const callsAfterFirst = createAudioPlayer.mock.calls.length;

      playAmbienceForWeather("partly_cloudy");

      expect(createAudioPlayer.mock.calls.length).toBe(callsAfterFirst);
    });

    it("does not play when the Music setting is off", async () => {
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });

      playAmbienceForWeather("clear");
      preloadAmbience();
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;

      await flushRamp();
      expect(player.play).not.toHaveBeenCalled();
    });
  });

  describe("playAmbienceTrack", () => {
    it("is a no-op when the requested track is already active", () => {
      playAmbienceTrack("amb_birds");
      const callsAfterFirst = createAudioPlayer.mock.calls.length;

      playAmbienceTrack("amb_birds");

      expect(createAudioPlayer.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  describe("stopAmbience", () => {
    it("fades out and pauses the active track, clearing the desired track", async () => {
      playAmbienceTrack("amb_birds");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();

      stopAmbience();
      await flushRamp();

      expect(player.volume).toBe(0);
      expect(player.pause).toHaveBeenCalled();
      expect(getActiveAmbienceTrackIdForTests()).toBeNull();
    });

    it("is a safe no-op when nothing is playing", () => {
      expect(() => stopAmbience()).not.toThrow();
    });
  });

  describe("syncAmbienceWithSettings", () => {
    it("brings in the desired track when Music is turned on after being off", async () => {
      // Mirrors real app startup order: preloadAmbience() always runs from
      // app/_layout.tsx regardless of the Music setting. amb_rain is the
      // second key in the mocked ambienceAssetSources (index 1).
      preloadAmbience();
      const player = createAudioPlayer.mock.results[1]!.value as FakePlayer;

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });
      playAmbienceTrack("amb_rain");
      expect(player.play).not.toHaveBeenCalled();

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
      syncAmbienceWithSettings();
      await flushRamp();

      expect(player.play).toHaveBeenCalled();
      expect(player.volume).toBeGreaterThan(0);
    });

    it("fades out the active track when Music is turned off", async () => {
      playAmbienceTrack("amb_birds");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });
      syncAmbienceWithSettings();
      await flushRamp();

      expect(player.volume).toBe(0);
      expect(getActiveAmbienceTrackIdForTests()).toBe("amb_birds");
    });
  });

  describe("pauseAmbienceForBackground / resumeAmbienceForForeground", () => {
    it("pauses both tracks while a crossfade is in progress", async () => {
      playAmbienceTrack("amb_birds");
      const birdsPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();

      playAmbienceTrack("amb_rain");
      const rainPlayer = createAudioPlayer.mock.results[1]!.value as FakePlayer;
      pauseAmbienceForBackground();

      expect(birdsPlayer.pause).toHaveBeenCalled();
      expect(rainPlayer.pause).toHaveBeenCalled();
      expect(birdsPlayer.playing).toBe(false);
      expect(rainPlayer.playing).toBe(false);

      birdsPlayer.play.mockClear();
      rainPlayer.play.mockClear();
      resumeAmbienceForForeground();

      expect(birdsPlayer.play).not.toHaveBeenCalled();
      expect(rainPlayer.play).toHaveBeenCalled();
    });

    it("pauses without resetting position, and resumes on foreground", () => {
      playAmbienceTrack("amb_birds");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;

      pauseAmbienceForBackground();
      expect(player.pause).toHaveBeenCalled();
      expect(player.seekTo).not.toHaveBeenCalled();

      player.play.mockClear();
      resumeAmbienceForForeground();
      expect(player.play).toHaveBeenCalled();
    });

    it("does not resume if Music was turned off while backgrounded", () => {
      playAmbienceTrack("amb_birds");
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      pauseAmbienceForBackground();
      player.play.mockClear();
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });

      resumeAmbienceForForeground();

      expect(player.play).not.toHaveBeenCalled();
    });

    it("is a safe no-op when nothing is active", () => {
      expect(() => pauseAmbienceForBackground()).not.toThrow();
      expect(() => resumeAmbienceForForeground()).not.toThrow();
    });
  });
});
