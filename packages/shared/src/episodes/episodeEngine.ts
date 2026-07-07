import type { ReactionRule, ReactionSelectionContext, SelectedReaction } from "../domain/reactions";
import type { WeatherScenePresentation, WeatherSurface } from "../domain/weather";
import { defaultWeatherContext, getWeatherScenePresentation } from "../domain/weather";
import { selectLocalReaction } from "../reactions/localReactionEngine";
import type { ReactionSelectionOptions } from "../reactions/localReactionEngine";

export type EpisodeTrigger =
  | "app_open"
  | "feed"
  | "play"
  | "walk_start"
  | "walk_return"
  | "pet"
  | "water_garden"
  | "sleep_state"
  | "plant_bloom"
  | "chat_open";

export interface EpisodeSelectionContext extends ReactionSelectionContext {
  trigger: EpisodeTrigger;
}

export interface SelectedEpisode {
  trigger: EpisodeTrigger;
  reaction: SelectedReaction;
  weatherScene: WeatherScenePresentation;
}

export const selectEpisode = (
  rules: readonly ReactionRule[],
  context: EpisodeSelectionContext,
  surface: WeatherSurface,
  options: ReactionSelectionOptions = {}
): SelectedEpisode => {
  const weather = context.weather ?? defaultWeatherContext;
  const reaction = selectLocalReaction(
    rules,
    {
      ...context,
      weather
    },
    options
  );

  return {
    trigger: context.trigger,
    reaction,
    weatherScene: getWeatherScenePresentation(surface, weather, context.locale)
  };
};
