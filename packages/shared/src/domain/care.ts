import type { ISODateTime, ItemId, MeterValue, PetId, WalkSessionId } from "./common";
import type { PlantBloomReward } from "./plants";

export type CareActionType =
  | "feed"
  | "talk"
  | "walk"
  | "play"
  | "rest"
  | "affection"
  | "water_garden"
  | "clean"
  | "treat";

export interface CareState {
  petId: PetId;
  satiety: MeterValue;
  energy: MeterValue;
  happiness: MeterValue;
  affection: MeterValue;
  gardenHealth: MeterValue;
  cleanliness: MeterValue;
  lastFedAt?: ISODateTime;
  lastInteractionAt?: ISODateTime;
  lastGardenWateredAt?: ISODateTime;
  activeWalkId?: WalkSessionId;
  updatedAt: ISODateTime;
}

export interface CareActionRequest {
  action: CareActionType;
  itemId?: ItemId;
  occurredAt: ISODateTime;
}

export interface CareActionResult {
  action: CareActionType;
  previousState: CareState;
  nextState: CareState;
  rewardItemId?: ItemId;
  reactionRuleId?: string;
}

export type CareActionReward = { type: "item"; itemId: ItemId; quantity: number } | PlantBloomReward;

export interface CareSatisfactionBreakdown {
  score: MeterValue;
  satiety: MeterValue;
  happiness: MeterValue;
  cleanliness: MeterValue;
  energy: MeterValue;
  gardenHealth: MeterValue;
  interactionFreshness: MeterValue;
}

export type CareSatisfactionTier = "needs_care" | "cozy" | "happy" | "glowing";

export type CareSatisfactionNeed = "food" | "play" | "clean" | "rest" | "thirst" | "attention";

export interface CareSatisfactionSummary {
  score: MeterValue;
  tier: CareSatisfactionTier;
  label: string;
  hint: string;
  primaryNeed?: CareSatisfactionNeed;
  recommendedAction?: CareActionType;
  recommendedActionLabel?: string;
  breakdown: CareSatisfactionBreakdown;
}

const clampMeter = (value: number): MeterValue => Math.max(0, Math.min(100, Math.round(value)));
const DAY_MS = 24 * 60 * 60 * 1000;

export const getCareDaysAway = (state: CareState, now: ISODateTime = state.updatedAt): number => {
  const lastSeenAt = state.lastInteractionAt ?? state.updatedAt;
  const lastSeenMs = new Date(lastSeenAt).getTime();
  const nowMs = new Date(now).getTime();

  if (!Number.isFinite(lastSeenMs) || !Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowMs - lastSeenMs) / DAY_MS));
};

export const getInteractionFreshnessScore = (lastInteractionAt: ISODateTime | undefined, now: ISODateTime): MeterValue => {
  if (!lastInteractionAt) {
    return 50;
  }

  const elapsedHours = Math.max(0, (new Date(now).getTime() - new Date(lastInteractionAt).getTime()) / (60 * 60 * 1000));

  if (elapsedHours <= 2) {
    return 100;
  }

  if (elapsedHours <= 12) {
    return clampMeter(100 - (elapsedHours - 2) * 3);
  }

  if (elapsedHours <= 72) {
    return clampMeter(70 - (elapsedHours - 12) * 0.8);
  }

  return 20;
};

export const getCareSatisfactionBreakdown = (state: CareState, now: ISODateTime = state.updatedAt): CareSatisfactionBreakdown => {
  const interactionFreshness = getInteractionFreshnessScore(state.lastInteractionAt, now);
  const score = clampMeter(
    state.satiety * 0.3 +
      state.happiness * 0.25 +
      state.cleanliness * 0.15 +
      state.energy * 0.1 +
      state.gardenHealth * 0.1 +
      interactionFreshness * 0.1
  );

  return {
    score,
    satiety: state.satiety,
    happiness: state.happiness,
    cleanliness: state.cleanliness,
    energy: state.energy,
    gardenHealth: state.gardenHealth,
    interactionFreshness
  };
};

export const getCareSatisfactionScore = (state: CareState, now: ISODateTime = state.updatedAt): MeterValue =>
  getCareSatisfactionBreakdown(state, now).score;

export const getCareSatisfactionTier = (score: MeterValue): CareSatisfactionTier => {
  if (score >= 85) {
    return "glowing";
  }

  if (score >= 70) {
    return "happy";
  }

  if (score >= 50) {
    return "cozy";
  }

  return "needs_care";
};

const satisfactionLabelByTier: Record<CareSatisfactionTier, string> = {
  needs_care: "Needs care",
  cozy: "Cozy",
  happy: "Happy",
  glowing: "Glowing"
};

const satisfactionNeedHints: Record<CareSatisfactionNeed, string> = {
  food: "A meal would help most.",
  play: "A little play would brighten the mood.",
  clean: "A quick clean would help.",
  rest: "Energy is running low.",
  thirst: "A little water would help.",
  attention: "Fresh attention would help."
};

const recommendedCareActionByNeed: Partial<Record<CareSatisfactionNeed, CareActionType>> = {
  food: "feed",
  play: "play",
  rest: "rest",
  clean: "clean",
  thirst: "water_garden",
  attention: "affection"
};

const recommendedCareActionLabels: Record<CareActionType, string> = {
  feed: "Feed",
  talk: "Talk",
  walk: "Walk",
  play: "Play",
  rest: "Rest",
  affection: "Pet",
  water_garden: "Water",
  clean: "Clean",
  treat: "Treat"
};

export const getCareSatisfactionSummary = (state: CareState, now: ISODateTime = state.updatedAt): CareSatisfactionSummary => {
  const breakdown = getCareSatisfactionBreakdown(state, now);
  const tier = getCareSatisfactionTier(breakdown.score);
  const needs: Array<{ need: CareSatisfactionNeed; value: MeterValue }> = [
    { need: "food", value: breakdown.satiety },
    { need: "play", value: breakdown.happiness },
    { need: "clean", value: breakdown.cleanliness },
    { need: "rest", value: breakdown.energy },
    { need: "thirst", value: breakdown.gardenHealth },
    { need: "attention", value: breakdown.interactionFreshness }
  ];
  const primaryNeed = [...needs].sort((a, b) => a.value - b.value)[0];
  const useNeedHint = tier === "needs_care" || (primaryNeed?.value ?? 100) < 55;
  const recommendedAction = useNeedHint && primaryNeed ? recommendedCareActionByNeed[primaryNeed.need] : undefined;

  return {
    score: breakdown.score,
    tier,
    label: satisfactionLabelByTier[tier],
    hint: useNeedHint && primaryNeed ? satisfactionNeedHints[primaryNeed.need] : "Care rhythm is good.",
    ...(useNeedHint && primaryNeed ? { primaryNeed: primaryNeed.need } : {}),
    ...(recommendedAction
      ? {
          recommendedAction,
          recommendedActionLabel: recommendedCareActionLabels[recommendedAction]
        }
      : {}),
    breakdown
  };
};
