import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAudioPlayer } = vi.hoisted(() => ({
  createAudioPlayer: vi.fn()
}));

vi.mock("expo-audio", () => ({
  createAudioPlayer: (...args: unknown[]) => createAudioPlayer(...args)
}));

vi.mock("./audioAssets", () => ({
  sfxAssetSources: {
    sfx_tap: 1,
    sfx_toast: 2
  },
  sfxIds: ["sfx_tap", "sfx_toast"]
}));

import { setActiveAudioSettings } from "./useAudioSettings";
import { playSfx, preloadSfx, resetSfxPlayersForTests } from "./sfxPlayer";

interface FakePlayer {
  volume: number;
  seekTo: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
}

const makeFakePlayer = (): FakePlayer => ({
  volume: 1,
  seekTo: vi.fn(),
  play: vi.fn()
});

describe("sfxPlayer", () => {
  beforeEach(() => {
    resetSfxPlayersForTests();
    setActiveAudioSettings({ soundsEnabled: true });
    createAudioPlayer.mockReset();
    createAudioPlayer.mockImplementation(() => makeFakePlayer());
  });

  afterEach(() => {
    setActiveAudioSettings({ soundsEnabled: true });
  });

  describe("preloadSfx", () => {
    it("creates one player per known SFX id", () => {
      preloadSfx();

      expect(createAudioPlayer).toHaveBeenCalledTimes(2);
    });

    it("only creates players once even if called repeatedly", () => {
      preloadSfx();
      preloadSfx();

      expect(createAudioPlayer).toHaveBeenCalledTimes(2);
    });

    it("skips a source that fails to load without blocking the others", () => {
      createAudioPlayer.mockImplementationOnce(() => {
        throw new Error("bad asset");
      });

      expect(() => preloadSfx()).not.toThrow();
      expect(createAudioPlayer).toHaveBeenCalledTimes(2);
    });
  });

  describe("playSfx", () => {
    it("replays a preloaded sound from the start", () => {
      preloadSfx();
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;

      playSfx("sfx_tap");

      expect(player.seekTo).toHaveBeenCalledWith(0);
      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("lazily creates players on first play if preloadSfx was never called", () => {
      playSfx("sfx_tap");

      expect(createAudioPlayer).toHaveBeenCalled();
    });

    it("does not play when the Sounds setting is off", () => {
      setActiveAudioSettings({ soundsEnabled: false });
      preloadSfx();
      const player = createAudioPlayer.mock.results[0]!.value as FakePlayer;

      playSfx("sfx_tap");

      expect(player.play).not.toHaveBeenCalled();
    });

    it("safely no-ops for an id with no preloaded player", () => {
      preloadSfx();

      // @ts-expect-error -- intentionally testing an unknown id at runtime
      expect(() => playSfx("sfx_does_not_exist")).not.toThrow();
    });

    it("does not throw when the underlying player throws on play", () => {
      createAudioPlayer.mockImplementation(() => ({
        volume: 1,
        seekTo: vi.fn(),
        play: vi.fn(() => {
          throw new Error("native play failure");
        })
      }));
      preloadSfx();

      expect(() => playSfx("sfx_tap")).not.toThrow();
    });
  });
});
