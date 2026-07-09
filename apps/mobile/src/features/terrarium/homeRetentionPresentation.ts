export type HomeRetentionMilestoneId = "day1" | "day3" | "day7" | "day14" | "day30";
export type HomeRetentionPromptTone = "daily" | "reward" | "memory" | "letter";
export type HomeRetentionPromptAction = "care" | "friend";

export interface HomeRetentionPromptPresentation {
  readonly milestoneId: HomeRetentionMilestoneId;
  readonly eyebrow: string;
  readonly title: string;
  readonly line: string;
  readonly ctaLabel: string;
  readonly action: HomeRetentionPromptAction;
  readonly progressLabel: string;
  readonly tone: HomeRetentionPromptTone;
  readonly accessibilityLabel: string;
}

const retentionTargetDays: Record<HomeRetentionMilestoneId, number> = {
  day1: 1,
  day3: 3,
  day7: 7,
  day14: 14,
  day30: 30
};

const retentionTitleByMilestone: Record<HomeRetentionMilestoneId, string> = {
  day1: "First daily hello",
  day3: "Snack rhythm",
  day7: "One-week memory",
  day14: "Two-week rhythm",
  day30: "One-month letter"
};

const retentionToneByMilestone: Record<HomeRetentionMilestoneId, HomeRetentionPromptTone> = {
  day1: "daily",
  day3: "reward",
  day7: "memory",
  day14: "memory",
  day30: "letter"
};

const getHomeRetentionMilestoneId = (daysTogether: number): HomeRetentionMilestoneId => {
  if (daysTogether >= 15) {
    return "day30";
  }

  if (daysTogether >= 8) {
    return "day14";
  }

  if (daysTogether >= 4) {
    return "day7";
  }

  if (daysTogether >= 2) {
    return "day3";
  }

  return "day1";
};

const getRetentionProgressLabel = (milestoneId: HomeRetentionMilestoneId, daysTogether: number): string => {
  const targetDay = retentionTargetDays[milestoneId];
  const displayDay = Math.max(1, Math.min(targetDay, daysTogether));

  return `D${displayDay} / D${targetDay}`;
};

interface HomeRetentionCopyInput {
  readonly milestoneId: HomeRetentionMilestoneId;
  readonly petName: string;
  readonly daysTogether: number;
  readonly hasCaredToday: boolean;
  readonly hasOpenedMonthlyLetter: boolean;
}

const getHomeRetentionCopy = ({
  milestoneId,
  petName,
  daysTogether,
  hasCaredToday,
  hasOpenedMonthlyLetter
}: HomeRetentionCopyInput): Pick<HomeRetentionPromptPresentation, "title" | "line" | "ctaLabel" | "action"> => {
  const careCta = milestoneId === "day1" ? "Care now" : "Care today";
  const letterIsWaiting = milestoneId === "day30" && daysTogether >= 30 && !hasOpenedMonthlyLetter;

  if (!hasCaredToday && !letterIsWaiting) {
    const lineByMilestone: Record<HomeRetentionMilestoneId, string> = {
      day1: `Give ${petName} one tiny care action to start today's bond.`,
      day3: "Day 3 starts the snack rhythm. A little care can bring treats home.",
      day7: "Keep today cozy so the one-week memory has something to hold.",
      day14: `${petName} is learning your rhythm. One care moment keeps it warm.`,
      day30: "The one-month letter is ahead. Today can become part of it."
    };

    return {
      title: retentionTitleByMilestone[milestoneId],
      line: lineByMilestone[milestoneId],
      ctaLabel: careCta,
      action: "care"
    };
  }

  if (letterIsWaiting) {
    return {
      title: "One-month letter",
      line: `${petName} left a letter from your first month together.`,
      ctaLabel: "Open letter",
      action: "friend"
    };
  }

  const lineByMilestone: Record<HomeRetentionMilestoneId, string> = {
    day1: `${petName} felt today's first hello. Tomorrow keeps the rhythm warm.`,
    day3: "The snack rhythm is waking up. Your next tiny care keeps it alive.",
    day7: "Your one-week memory is close. The scrapbook is starting to feel yours.",
    day14: "Two weeks turns care into a habit your pet can recognize.",
    day30: "The one-month letter is ahead. Your profile is collecting the story."
  };

  return {
    title: retentionTitleByMilestone[milestoneId],
    line: lineByMilestone[milestoneId],
    ctaLabel: "See profile",
    action: "friend"
  };
};

export const getHomeRetentionPromptPresentation = ({
  petName,
  daysTogether,
  hasCaredToday,
  hasOpenedMonthlyLetter,
  isOnWalk
}: {
  readonly petName: string;
  readonly daysTogether: number;
  readonly hasCaredToday: boolean;
  readonly hasOpenedMonthlyLetter: boolean;
  readonly isOnWalk: boolean;
}): HomeRetentionPromptPresentation | null => {
  if (isOnWalk) {
    return null;
  }

  const normalizedDaysTogether = Math.max(0, Math.floor(daysTogether));
  const milestoneId = getHomeRetentionMilestoneId(normalizedDaysTogether);
  const copy = getHomeRetentionCopy({
    milestoneId,
    petName,
    daysTogether: normalizedDaysTogether,
    hasCaredToday,
    hasOpenedMonthlyLetter
  });
  const progressLabel = getRetentionProgressLabel(milestoneId, normalizedDaysTogether);

  return {
    milestoneId,
    eyebrow: `D${retentionTargetDays[milestoneId]}`,
    title: copy.title,
    line: copy.line,
    ctaLabel: copy.ctaLabel,
    action: copy.action,
    progressLabel,
    tone: retentionToneByMilestone[milestoneId],
    accessibilityLabel: `${copy.title}. ${copy.line} ${copy.ctaLabel}. ${progressLabel}.`
  };
};
