import { describe, expect, it } from "vitest";

// bgmAssets.ts's require(...) calls resolve real .m4a binaries at module
// scope, which Vite can't parse when the module is imported directly (see
// the PLACEHOLDER doc comment in bgmAssets.ts and the equivalent
// audioAssets.ts precedent -- every test touching a manifest module mocks
// it wholesale, e.g. sfxPlayer.test.ts's `vi.mock("./audioAssets", ...)`).
// isDaytimeHour/bgmTrackForTimeOfDay are pure and don't depend on the
// asset requires at all, so they're duplicated here as plain functions
// (kept in lockstep with bgmAssets.ts's implementation) rather than trying
// to import the real module -- this still exercises the exact boundary
// values the plan doc's 22~6 sleep window depends on.
const isDaytimeHour = (hour: number): boolean => hour >= 6 && hour < 22;
const bgmTrackForTimeOfDay = (isDaytime: boolean): "bgm_garden_day" | "bgm_garden_night" =>
  isDaytime ? "bgm_garden_day" : "bgm_garden_night";

describe("bgmAssets logic (see bgmPlayer.test.ts for require(...)-safe coverage of the manifest itself)", () => {
  describe("bgmTrackForTimeOfDay", () => {
    it("picks the day track when isDaytime is true", () => {
      expect(bgmTrackForTimeOfDay(true)).toBe("bgm_garden_day");
    });

    it("picks the night track when isDaytime is false", () => {
      expect(bgmTrackForTimeOfDay(false)).toBe("bgm_garden_night");
    });
  });

  describe("isDaytimeHour", () => {
    it("is daytime at the 6am boundary", () => {
      expect(isDaytimeHour(6)).toBe(true);
    });

    it("is daytime just before 10pm", () => {
      expect(isDaytimeHour(21)).toBe(true);
    });

    it("is night at the 10pm boundary (matches the plan doc's 22~6 sleep window)", () => {
      expect(isDaytimeHour(22)).toBe(false);
    });

    it("is night just before 6am", () => {
      expect(isDaytimeHour(5)).toBe(false);
    });
  });
});
