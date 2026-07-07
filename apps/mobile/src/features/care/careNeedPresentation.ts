import type { CareActionType, CareSatisfactionNeed, CareSatisfactionSummary } from "@mongchi/shared";

export interface CareNeedCtaPresentation {
  action?: CareActionType;
  label: string;
  title: string;
  line: string;
  accessibilityLabel: string;
}

const ctaByNeed = (petName: string): Record<CareSatisfactionNeed, CareNeedCtaPresentation> => ({
  food: {
    action: "feed",
    label: "Feed",
    title: "Bowl time",
    line: `${petName} would feel better after a meal.`,
    accessibilityLabel: `Feed ${petName}. A meal would help most.`
  },
  play: {
    action: "play",
    label: "Play",
    title: "Tiny play",
    line: `${petName} wants a little play moment.`,
    accessibilityLabel: `Play with ${petName}. A little play would brighten the mood.`
  },
  clean: {
    action: "clean",
    label: "Clean",
    title: "Freshen up",
    line: `${petName} could use a quick clean.`,
    accessibilityLabel: `Clean ${petName}. A quick clean would help.`
  },
  rest: {
    action: "rest",
    label: "Rest",
    title: "Rest mode",
    line: `${petName} is low on energy. Keep things calm for now.`,
    accessibilityLabel: `Rest with ${petName}. Energy is running low.`
  },
  thirst: {
    action: "water_garden",
    label: "Water",
    title: "Water bowl",
    line: `${petName} could use a tiny sip.`,
    accessibilityLabel: `Give ${petName} water. A little water would help.`
  },
  attention: {
    action: "affection",
    label: "Pet",
    title: "Gentle hello",
    line: `${petName} wants a little attention.`,
    accessibilityLabel: `Pet ${petName}. Fresh attention would help.`
  }
});

export const getCareNeedCtaPresentation = (
  satisfactionSummary: Pick<CareSatisfactionSummary, "primaryNeed" | "recommendedAction" | "recommendedActionLabel" | "hint">,
  petName: string
): CareNeedCtaPresentation | null => {
  if (!satisfactionSummary.primaryNeed) {
    return null;
  }

  const base = ctaByNeed(petName)[satisfactionSummary.primaryNeed];

  if (!satisfactionSummary.recommendedAction) {
    return base;
  }

  return {
    ...base,
    action: satisfactionSummary.recommendedAction,
    label: satisfactionSummary.recommendedActionLabel ?? base.label,
    accessibilityLabel: `${satisfactionSummary.recommendedActionLabel ?? base.label} ${petName}. ${satisfactionSummary.hint}`
  };
};
