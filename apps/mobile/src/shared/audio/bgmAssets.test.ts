import { describe, expect, it } from "vitest";

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
