export type BgmTrackId = "bgm_garden_day" | "bgm_garden_night";

export const bgmAssetSources: Record<BgmTrackId, number> = {
  bgm_garden_day: require("../../../assets/audio/bgm_garden_day.m4a"),
  bgm_garden_night: require("../../../assets/audio/bgm_garden_night.m4a")
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
 * BGM day/night split by local hour: night from 22:00 up to (not
 * including) 06:00, matching the plan doc's sleep-hour window (see
 * docs/gamefeel-sound-plan.md §1 Tier 3, "22~6시 수면") so a future sleep
 * visual/overlay feature lines up with the same boundary BGM already uses.
 */
export const isDaytimeHour = (hour: number): boolean => hour >= 6 && hour < 22;

/** Convenience wrapper: reads the given Date's (defaults to now) local hour. */
export const isDaytimeNow = (date: Date = new Date()): boolean => isDaytimeHour(date.getHours());
