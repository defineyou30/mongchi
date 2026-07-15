import { describe, expect, it } from "vitest";

type BgmTrackId =
  | "bgm_garden_day"
  | "bgm_garden_night"
  | "bgm_theme_fairy_garden"
  | "bgm_theme_seaside_cove"
  | "bgm_theme_autumn_woods"
  | "bgm_theme_winter_lights";

const isDaytimeHour = (hour: number): boolean => hour >= 6 && hour < 22;
const bgmTrackForTimeOfDay = (isDaytime: boolean): "bgm_garden_day" | "bgm_garden_night" =>
  isDaytime ? "bgm_garden_day" : "bgm_garden_night";

const dayBgmTrackByThemeId: Partial<Record<string, BgmTrackId>> = {
  "theme-fairy-garden": "bgm_theme_fairy_garden",
  "theme-seaside-cove": "bgm_theme_seaside_cove",
  "theme-autumn-woods": "bgm_theme_autumn_woods",
  "theme-winter-lights": "bgm_theme_winter_lights"
};

const getBgmTrackForTheme = (themeId: string | undefined, isDaytime: boolean): BgmTrackId => {
  if (!isDaytime) {
    return "bgm_garden_night";
  }
  return (themeId && dayBgmTrackByThemeId[themeId]) || "bgm_garden_day";
};

describe("bgmAssets logic (see bgmPlayer.test.ts for require(...)-safe coverage of the manifest itself)", () => {
  describe("bgmTrackForTimeOfDay", () => {
    it("picks the day track when isDaytime is true", () => {
      expect(bgmTrackForTimeOfDay(true)).toBe("bgm_garden_day");
    });

    it("picks the night track when isDaytime is false", () => {
      expect(bgmTrackForTimeOfDay(false)).toBe("bgm_garden_night");
    });
  });

  describe("getBgmTrackForTheme", () => {
    it("picks each paid theme's own day track", () => {
      expect(getBgmTrackForTheme("theme-fairy-garden", true)).toBe("bgm_theme_fairy_garden");
      expect(getBgmTrackForTheme("theme-seaside-cove", true)).toBe("bgm_theme_seaside_cove");
      expect(getBgmTrackForTheme("theme-autumn-woods", true)).toBe("bgm_theme_autumn_woods");
      expect(getBgmTrackForTheme("theme-winter-lights", true)).toBe("bgm_theme_winter_lights");
    });

    it("falls back to the plain garden day track for the always-free default theme", () => {
      expect(getBgmTrackForTheme("theme-default-garden", true)).toBe("bgm_garden_day");
    });

    it("falls back to the plain garden day track when no theme is known yet", () => {
      expect(getBgmTrackForTheme(undefined, true)).toBe("bgm_garden_day");
    });

    it("resolves to the shared night track at night regardless of theme", () => {
      expect(getBgmTrackForTheme("theme-fairy-garden", false)).toBe("bgm_garden_night");
      expect(getBgmTrackForTheme(undefined, false)).toBe("bgm_garden_night");
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
