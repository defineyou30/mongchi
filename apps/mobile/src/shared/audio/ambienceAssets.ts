import type { WeatherCondition } from "@mongchi/shared";

/**
 * Ambience track id -> bundled asset manifest (Phase 2, see
 * docs/gamefeel-sound-plan.md §2). Sibling to bgmAssets.ts -- same
 * reasoning for keeping it out of the SFX manifest (audioAssets.ts).
 *
 * PLACEHOLDER: apps/mobile/assets/audio/amb_birds.m4a and amb_rain.m4a are
 * synthesized placeholder loops (sparse randomized chirps / filtered noise,
 * see /private/tmp .../scratchpad/synth_bgm.py), not curated field
 * recordings. Swap the `require(...)` targets below in place when curated
 * assets land -- no other code should need to change.
 *
 * Phase 3 will add wind/night layers here (see
 * docs/gamefeel-sound-plan.md §2 Phase 3: "바람/귀뚜라미, 테마별 앰비언스
 * 1레이어") -- leaving room in AmbienceTrackId/weatherToAmbienceTrack below
 * for those rather than restructuring this file later.
 */
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
