import type { WeatherCondition } from "@mongchi/shared";

export type AmbienceTrackId = "amb_birds" | "amb_rain" | "amb_wind" | "amb_snow";

export const ambienceAssetSources: Record<AmbienceTrackId, number> = {
  amb_birds: require("../../../assets/audio/amb_birds.m4a"),
  amb_rain: require("../../../assets/audio/amb_rain.m4a"),
  amb_wind: require("../../../assets/audio/amb_wind.m4a"),
  amb_snow: require("../../../assets/audio/amb_snow.m4a")
};

export const ambienceTrackIds: AmbienceTrackId[] = Object.keys(ambienceAssetSources) as AmbienceTrackId[];

/**
 * Maps a weather condition to the ambience track that should be playing.
 * Phase 2 only distinguished "rain-ish" (rain/storm) from everything else
 * (birds, the default garden ambience) -- see the plan doc's Phase 2 scope
 * ("맑음→새소리, 비→빗소리"). wind/snow now each get their own single-track
 * ambience too (amb_wind/amb_snow), which is still this same swap-chooser
 * shape, just with two more branches -- not yet the Phase 3 "weather/theme
 * matrix + mix pass" scope (docs/gamefeel-sound-plan.md), where wind is
 * meant to become an additional *simultaneous* layer mixed under whatever
 * else is playing rather than a track this function swaps to. That mix-pass
 * work (a second "layer" player set alongside this one, see
 * ambiencePlayer.ts's Phase 3 note) is still open; this only extends the
 * existing single-track chooser.
 */
export const weatherToAmbienceTrack = (condition: WeatherCondition): AmbienceTrackId => {
  if (condition === "rain" || condition === "storm") {
    return "amb_rain";
  }

  if (condition === "wind") {
    return "amb_wind";
  }

  if (condition === "snow") {
    return "amb_snow";
  }

  return "amb_birds";
};
