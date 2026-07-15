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
    bgm_garden_night: 2,
    bgm_theme_fairy_garden: 3
  },
  // Mirrors the real getBgmTrackForTheme's shape (night always plain,
  // unrecognized/undefined theme falls back to the plain day track) with one
  // representative theme mapped to its own track -- full coverage of the
  // real theme->track map lives in bgmAssets.test.ts.
  getBgmTrackForTheme: (themeId: string | undefined, isDaytime: boolean) => {
    if (!isDaytime) {
      return "bgm_garden_night";
    }
    return themeId === "theme-fairy-garden" ? "bgm_theme_fairy_garden" : "bgm_garden_day";
  }
}));

import { setActiveAudioSettings } from "./useAudioSettings";
import {
  duckBgm,
  duckBgmForMs,
  getActiveBgmThemeIdForTests,
  getActiveBgmTrackIdForTests,
  pauseBgmForBackground,
  playBgm,
  playBgmForThemeAndTimeOfDay,
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
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
    createAudioPlayer.mockReset();
    createAudioPlayer.mockImplementation(() => makeFakePlayer());
  });

  afterEach(() => {
    setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
    vi.useRealTimers();
  });

  describe("preloadBgm", () => {
    it("creates one looping player per BGM track", () => {
      preloadBgm();

      expect(createAudioPlayer).toHaveBeenCalledTimes(3);
      const players = createAudioPlayer.mock.results.map((r) => r.value as FakePlayer);
      expect(players.every((p) => p.loop)).toBe(true);
    });

    it("only creates players once even if called repeatedly", () => {
      preloadBgm();
      preloadBgm();

      expect(createAudioPlayer).toHaveBeenCalledTimes(3);
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
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });

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

    it("does not let a stale crossfade stop timer pause a track that has been reactivated", async () => {
      playBgm("bgm_garden_day");
      const dayPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();

      playBgm("bgm_garden_night");
      await vi.advanceTimersByTimeAsync(1000);

      playBgm("bgm_garden_day");
      await flushRamp();

      expect(dayPlayer.playing).toBe(true);
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

    it("resolves against whatever theme was last set by playBgmForThemeAndTimeOfDay", () => {
      // Mirrors TerrariumSessionProvider's theme-sync effect running before
      // TerrariumHomeScreen's own bare playBgmForTimeOfDay(isDaytimeNow())
      // mount effect -- the bare call must stay theme-aware without the
      // theme being passed through again.
      playBgmForThemeAndTimeOfDay("theme-fairy-garden", true);

      playBgmForTimeOfDay(true);

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_theme_fairy_garden");
    });
  });

  describe("playBgmForThemeAndTimeOfDay", () => {
    it("crossfades into the given theme's day track", () => {
      playBgmForThemeAndTimeOfDay("theme-fairy-garden", true);

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_theme_fairy_garden");
      expect(getActiveBgmThemeIdForTests()).toBe("theme-fairy-garden");
    });

    it("resolves to the shared night track regardless of theme", () => {
      playBgmForThemeAndTimeOfDay("theme-fairy-garden", false);

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_night");
    });

    it("falls back to the plain garden day track for an unrecognized/default theme", () => {
      playBgmForThemeAndTimeOfDay("theme-default-garden" as never, true);

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_day");
    });

    it("crossfades away from a previous theme track when the theme changes", async () => {
      playBgmForThemeAndTimeOfDay("theme-fairy-garden", true);
      const themePlayer = createAudioPlayer.mock.results[2]!.value as FakePlayer;
      await flushRamp();
      expect(themePlayer.volume).toBeGreaterThan(0);

      playBgmForThemeAndTimeOfDay(undefined, true);
      await flushRamp();

      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_day");
      expect(themePlayer.volume).toBe(0);
      expect(themePlayer.pause).toHaveBeenCalled();
    });
  });

  // Regression coverage for a real-device report: turning both "Sounds" and
  // "Music & ambience" off in Settings left BGM audibly playing. Root causes
  // (both fixed above, see playBgm/syncBgmWithSettings's doc comments):
  // (1) playBgm used to return early when Music was off *without* stopping
  // whatever the previous desiredTrackId's player was, orphaning it forever;
  // (2) getActiveAudioSettings() could still read the stale in-memory
  // default (both enabled) for a while after a real cold start, since it
  // only ever hydrated from storage once SettingsScreen mounted -- see
  // useAudioSettings.ts's ensureAudioSettingsHydrated.
  describe("regression: turning Music off always stops BGM, even mid-crossfade or via the theme-sync effect", () => {
    it("stops both the outgoing and incoming track when Music is turned off mid-crossfade", async () => {
      playBgm("bgm_garden_day");
      const dayPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();
      expect(dayPlayer.volume).toBeGreaterThan(0);

      // Start a crossfade to night and stop partway through it, so both
      // players are simultaneously non-silent (day fading out, night fading
      // in) -- the "이중 플레이어" state the regression was reported in.
      playBgm("bgm_garden_night");
      const nightPlayer = createAudioPlayer.mock.results[1]!.value as FakePlayer;
      await vi.advanceTimersByTimeAsync(500);
      expect(dayPlayer.volume).toBeGreaterThan(0);
      expect(nightPlayer.volume).toBeGreaterThan(0);

      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: false, hapticsEnabled: true });
      syncBgmWithSettings();

      // The non-desired (outgoing) player is hard-silenced synchronously.
      expect(dayPlayer.volume).toBe(0);
      expect(dayPlayer.pause).toHaveBeenCalled();

      await flushRamp();

      // The desired (incoming) player fades out on its own schedule and
      // ends silent too.
      expect(nightPlayer.volume).toBe(0);
      expect(nightPlayer.pause).toHaveBeenCalled();
    });

    it("never starts audible playback via playBgmForThemeAndTimeOfDay while Music is off, even across a theme change", async () => {
      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: false, hapticsEnabled: true });

      playBgmForThemeAndTimeOfDay("theme-fairy-garden", true);
      await flushRamp();
      const themePlayer = createAudioPlayer.mock.results[2]!.value as FakePlayer;
      expect(themePlayer.play).not.toHaveBeenCalled();

      // Simulates TerrariumSessionProvider's theme-sync effect firing again
      // (e.g. session hydration resolving to a different theme) while Music
      // is still off -- must stay silent, not just "not start the new
      // track" but also never leave anything else audible.
      playBgmForThemeAndTimeOfDay(undefined, true);
      await flushRamp();

      const dayPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      expect(dayPlayer.play).not.toHaveBeenCalled();
      expect(themePlayer.play).not.toHaveBeenCalled();
      expect(getActiveBgmTrackIdForTests()).toBe("bgm_garden_day");
    });

    it("resumes the currently active theme's track when Music is turned back on", async () => {
      playBgmForThemeAndTimeOfDay("theme-fairy-garden", true);
      const themePlayer = createAudioPlayer.mock.results[2]!.value as FakePlayer;
      await flushRamp();
      expect(themePlayer.volume).toBeGreaterThan(0);

      setActiveAudioSettings({ soundsEnabled: false, musicEnabled: false, hapticsEnabled: true });
      syncBgmWithSettings();
      await flushRamp();
      expect(themePlayer.volume).toBe(0);
      expect(themePlayer.pause).toHaveBeenCalled();

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
      syncBgmWithSettings();
      await flushRamp();

      expect(themePlayer.play).toHaveBeenCalled();
      expect(themePlayer.volume).toBeGreaterThan(0);
      expect(getActiveBgmTrackIdForTests()).toBe("bgm_theme_fairy_garden");
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

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });
      playBgm("bgm_garden_day"); // records desired track, but does not play (Music is off)
      expect(player.play).not.toHaveBeenCalled();

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: true, hapticsEnabled: true });
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

      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });
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
    it("pauses both tracks while a crossfade is in progress", async () => {
      playBgm("bgm_garden_day");
      const dayPlayer = createAudioPlayer.mock.results[0]!.value as FakePlayer;
      await flushRamp();

      playBgm("bgm_garden_night");
      const nightPlayer = createAudioPlayer.mock.results[1]!.value as FakePlayer;
      pauseBgmForBackground();

      expect(dayPlayer.pause).toHaveBeenCalled();
      expect(nightPlayer.pause).toHaveBeenCalled();
      expect(dayPlayer.playing).toBe(false);
      expect(nightPlayer.playing).toBe(false);

      dayPlayer.play.mockClear();
      nightPlayer.play.mockClear();
      resumeBgmForForeground();

      expect(dayPlayer.play).not.toHaveBeenCalled();
      expect(nightPlayer.play).toHaveBeenCalled();
    });

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
      setActiveAudioSettings({ soundsEnabled: true, musicEnabled: false, hapticsEnabled: true });

      resumeBgmForForeground();

      expect(player.play).not.toHaveBeenCalled();
    });

    it("is a safe no-op when nothing is active", () => {
      expect(() => pauseBgmForBackground()).not.toThrow();
      expect(() => resumeBgmForForeground()).not.toThrow();
    });
  });
});
