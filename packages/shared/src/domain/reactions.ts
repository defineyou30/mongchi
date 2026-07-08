import type { CareActionType, CareState } from "./care";
import type { ISODateTime, Locale } from "./common";
import type { PersonalityTag, PetProfile, PetSpecies, TalkingStyle } from "./pet";
import type { WeatherCondition, WeatherContext, WeatherIntensity, WeatherSource } from "./weather";
import type { WalkStatus } from "./walk";

export type TimeBucket = "morning" | "afternoon" | "evening" | "night";

export type ReactionCategory =
  | "greeting_morning"
  | "greeting_afternoon"
  | "greeting_evening"
  | "greeting_night"
  | "hungry_low"
  | "fed_recent"
  | "energy_low"
  | "affection_high"
  | "affection_low"
  | "missed_one_day"
  | "missed_many_days"
  | "walk_start"
  | "walk_return_common"
  | "walk_return_rare"
  | "garden_needs_water"
  | "garden_watered"
  | "clean_done"
  | "rested"
  | "play_start"
  | "play_done"
  | "petting"
  | "treat_common"
  | "treat_special"
  | "weather_clear"
  | "weather_rain"
  | "weather_snow"
  | "weather_wind"
  | "weather_cozy"
  | "new_item"
  | "item_placed"
  | "generation_reveal"
  | "premium_chat_teaser"
  | "error_soft";

export type ReactionAnimation =
  | "idle"
  | "idle_happy"
  | "happy"
  | "sleepy"
  | "hungry"
  | "play"
  | "walk_out"
  | "walk_return"
  | "garden_help"
  | "treat"
  | "curious"
  | "celebrate"
  | "sad"
  | "sick"
  | "messy";

export type ReactionSafetyLevel = "safe" | "sensitive" | "blocked";

export interface ReactionConditions {
  timeBucket?: TimeBucket;
  personalityTagsAny?: PersonalityTag[];
  personalityTagsAll?: PersonalityTag[];
  talkingStylesAny?: TalkingStyle[];
  species?: PetSpecies[];
  satietyMin?: number;
  satietyMax?: number;
  energyMin?: number;
  energyMax?: number;
  happinessMin?: number;
  happinessMax?: number;
  affectionMin?: number;
  affectionMax?: number;
  gardenHealthMin?: number;
  gardenHealthMax?: number;
  cleanlinessMin?: number;
  cleanlinessMax?: number;
  recentActionAny?: CareActionType[];
  daysAwayMin?: number;
  daysAwayMax?: number;
  walkStatus?: WalkStatus[];
  weatherCondition?: WeatherCondition[];
  weatherIntensity?: WeatherIntensity[];
  weatherSource?: WeatherSource[];
  weatherIsDaytime?: boolean;
  eventContext?: string[];
  /** Relationship-depth gates -- lets a rule only fire once the bond/relationship has matured. */
  bondLevelMin?: number;
  daysTogetherMin?: number;
  streakMin?: number;
  /** When true, the rule only matches pets with a non-empty `favoriteThing` (so `{favoriteThing}` lines never fall back to "tiny things"). */
  requiresFavoriteThing?: boolean;
}

export interface ReactionRule {
  id: string;
  locale: Locale;
  category: ReactionCategory;
  conditions: ReactionConditions;
  lines: string[];
  animation: ReactionAnimation;
  priority: number;
  cooldownHours: number;
  safetyLevel: ReactionSafetyLevel;
}

export interface RecentReaction {
  ruleId: string;
  line: string;
  shownAt: ISODateTime;
}

export interface ReactionSelectionContext {
  locale: Locale;
  now: ISODateTime;
  pet: PetProfile;
  careState: CareState;
  recentAction?: CareActionType;
  daysAway?: number;
  walkStatus?: WalkStatus;
  weather?: WeatherContext | null;
  eventContext?: string;
  recentReactions?: RecentReaction[];
  /** Current relationship depth (RelationshipState.bondLevel) -- powers bondLevelMin-gated rules. */
  bondLevel?: number;
  /** Whole days since the pet moved in (RelationshipState.daysTogether) -- powers daysTogetherMin-gated rules. */
  daysTogether?: number;
  /** Current care-streak day count -- powers streakMin-gated rules. */
  streak?: number;
}

export interface SelectedReaction {
  ruleId: string;
  category: ReactionCategory;
  line: string;
  animation: ReactionAnimation;
  priority: number;
}
