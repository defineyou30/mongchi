import type { WeatherCondition } from "@mongchi/shared";

export type AmbienceTrackId = "amb_birds" | "amb_rain";

export const ambienceAssetSources: Record<AmbienceTrackId, number> = {
  amb_birds: require("../../../assets/audio/amb_birds.m4a"),
  amb_rain: require("../../../assets/audio/amb_rain.m4a")
};

export const ambienceTrackIds: AmbienceTrackId[] = Object.keys(ambienceAssetSources) as AmbienceTrackId[];

/**
 * Maps a weather condition to the ambience track that should be playing.
 * Phase 2 only distinguishes "rain-ish" (rain/storm) from everything else
 * (birds, the default garden ambience) -- see the plan doc's Phase 2 scope
 * ("맑음→새소리, 비→빗소리"). Phase 3 adds wind/night layers on top of this
 * (see the file doc comment above), not more branches in this function.
 */
export const weatherToAmbienceTrack = (condition: WeatherCondition): AmbienceTrackId => {
  if (condition === "rain" || condition === "storm") {
    return "amb_rain";
  }

  return "amb_birds";
};
