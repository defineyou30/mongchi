import type { ItemId } from "@mongchi/shared";

export type BgmTrackId =
  | "bgm_garden_day"
  | "bgm_garden_night"
  | "bgm_theme_fairy_garden"
  | "bgm_theme_seaside_cove"
  | "bgm_theme_autumn_woods"
  | "bgm_theme_winter_lights";

export const bgmAssetSources: Record<BgmTrackId, number> = {
  bgm_garden_day: require("../../../assets/audio/bgm_garden_day.m4a"),
  bgm_garden_night: require("../../../assets/audio/bgm_garden_night.m4a"),
  bgm_theme_fairy_garden: require("../../../assets/audio/bgm_theme_fairy_garden.m4a"),
  bgm_theme_seaside_cove: require("../../../assets/audio/bgm_theme_seaside_cove.m4a"),
  bgm_theme_autumn_woods: require("../../../assets/audio/bgm_theme_autumn_woods.m4a"),
  bgm_theme_winter_lights: require("../../../assets/audio/bgm_theme_winter_lights.m4a")
};

export const bgmTrackIds: BgmTrackId[] = Object.keys(bgmAssetSources) as BgmTrackId[];

/**
 * Picks the BGM track for a given "is it currently daytime" signal. Takes a
 * plain boolean (not a Date) so callers can feed it from either a real
 * clock (see isDaytimeHour below) or a test/preview override, and
 * independent from WeatherContext.isDaytime -- that field is a coarser
 * 6am-8pm window baked into weather-condition selection at fetch time (see
 * packages/shared/src/domain/weather.ts) and can go stale between weather
 * refreshes, whereas BGM day/night should always reflect the device's
 * current local clock.
 */
export const bgmTrackForTimeOfDay = (isDaytime: boolean): BgmTrackId =>
  isDaytime ? "bgm_garden_day" : "bgm_garden_night";

/**
 * Daytime-only BGM track per paid garden theme (see themeBundles.ts) --
 * night always falls back to the shared bgm_garden_night loop regardless of
 * theme (no per-theme night variant exists yet), and the always-free
 * "theme-default-garden" isn't in this map at all so it falls through to the
 * plain bgm_garden_day track below, same as an unrecognized/undefined theme.
 */
const dayBgmTrackByThemeId: Partial<Record<ItemId, BgmTrackId>> = {
  "theme-fairy-garden": "bgm_theme_fairy_garden",
  "theme-seaside-cove": "bgm_theme_seaside_cove",
  "theme-autumn-woods": "bgm_theme_autumn_woods",
  "theme-winter-lights": "bgm_theme_winter_lights"
};

/**
 * Picks the BGM track for a given garden theme + day/night signal. Night
 * always resolves to bgm_garden_night, independent of theme (see
 * dayBgmTrackByThemeId above); a missing/default/unrecognized themeId
 * resolves to the plain bgm_garden_day track during the day. Used by
 * bgmPlayer.ts's playBgmForThemeAndTimeOfDay (crossfades in when the
 * selected theme changes) and, from then on, by playBgmForTimeOfDay itself
 * (so callers that only know day/night, like TerrariumHomeScreen's mount
 * effect, still resolve to the currently active theme's track).
 */
export const getBgmTrackForTheme = (themeId: ItemId | undefined, isDaytime: boolean): BgmTrackId => {
  if (!isDaytime) {
    return "bgm_garden_night";
  }

  return (themeId && dayBgmTrackByThemeId[themeId]) || "bgm_garden_day";
};

/**
 * BGM day/night split by local hour: night from 22:00 up to (not
 * including) 06:00, matching the plan doc's sleep-hour window (see
 * docs/gamefeel-sound-plan.md §1 Tier 3, "22~6시 수면") so a future sleep
 * visual/overlay feature lines up with the same boundary BGM already uses.
 */
export const isDaytimeHour = (hour: number): boolean => hour >= 6 && hour < 22;

/** Convenience wrapper: reads the given Date's (defaults to now) local hour. */
export const isDaytimeNow = (date: Date = new Date()): boolean => isDaytimeHour(date.getHours());
