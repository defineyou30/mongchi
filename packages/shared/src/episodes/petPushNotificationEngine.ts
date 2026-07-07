import type { CareActionType, CareSatisfactionSummary, CareState, TimeBucket, WeatherContext } from "../domain";
import { defaultWeatherContext } from "../domain/weather";
import { getTimeBucket } from "../reactions/localReactionEngine";

export type PetPushNotificationKey =
  | "meal_due"
  | "meal_urgent"
  | "thirst_due"
  | "thirst_hot_weather"
  | "bored_play"
  | "attention_return"
  | "walk_window"
  | "rest_needed"
  | "rainy_cozy_check"
  | "return_after_1_day"
  | "return_after_3_days";

export interface PetPushNotificationCandidate {
  key: PetPushNotificationKey;
  title: string;
  body: string;
  priority: 1 | 2 | 3 | 4 | 5;
  suggestedAction: CareActionType | "open_app";
  throttleHours: number;
  timeBucket: TimeBucket;
}

export interface PetPushNotificationInput {
  petName: string;
  now: string;
  careState: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection" | "lastFedAt" | "lastInteractionAt" | "updatedAt">;
  satisfactionSummary?: Pick<CareSatisfactionSummary, "primaryNeed" | "recommendedAction"> | null | undefined;
  weather?: WeatherContext | null | undefined;
  lastSentAtByKey?: Partial<Record<PetPushNotificationKey, string>> | undefined;
  /** Forwarded to selectReturnReminderCandidates to pick the +1 day reminder's copy variant. */
  careStreakCurrent?: number | undefined;
}

const stableNow = "2026-06-24T09:00:00.000Z";

const getDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
};

const getNow = (value: string): Date => getDate(value) ?? new Date(stableNow);

const hoursSince = (now: Date, value: string | null | undefined): number => {
  const date = getDate(value);

  if (!date) {
    return Infinity;
  }

  return Math.max(0, (now.getTime() - date.getTime()) / 3_600_000);
};

const isThrottled = (
  now: Date,
  candidate: Pick<PetPushNotificationCandidate, "key" | "throttleHours">,
  lastSentAtByKey: PetPushNotificationInput["lastSentAtByKey"]
): boolean => hoursSince(now, lastSentAtByKey?.[candidate.key]) < candidate.throttleHours;

const makeCandidate = (
  candidate: Omit<PetPushNotificationCandidate, "timeBucket">,
  timeBucket: TimeBucket
): PetPushNotificationCandidate => ({
  ...candidate,
  timeBucket
});

export const selectPetPushNotificationCandidates = (input: PetPushNotificationInput): PetPushNotificationCandidate[] => {
  const now = getNow(input.now);
  const timeBucket = getTimeBucket(now);
  const weather = input.weather ?? defaultWeatherContext;
  const mealHours = hoursSince(now, input.careState.lastFedAt);
  const interactionHours = hoursSince(now, input.careState.lastInteractionAt ?? input.careState.updatedAt);
  const quietHours = timeBucket === "night";
  const candidates: PetPushNotificationCandidate[] = [];
  const petName = input.petName.trim() || "Your pet";

  if (input.careState.satiety <= 25 && mealHours >= 5) {
    candidates.push(
      makeCandidate(
        {
          key: "meal_urgent",
          title: `${petName}'s bowl has some room today`,
          body: `A basic meal would be a nice treat for ${petName} right about now.`,
          priority: 5,
          suggestedAction: "feed",
          throttleHours: 4
        },
        timeBucket
      )
    );
  } else if (input.careState.satiety <= 45 && mealHours >= 4) {
    candidates.push(
      makeCandidate(
        {
          key: "meal_due",
          title: `${petName} is thinking bowl thoughts`,
          body: "A small meal would bring fullness back into the cozy range.",
          priority: 4,
          suggestedAction: "feed",
          throttleHours: 4
        },
        timeBucket
      )
    );
  }

  if (weather.condition === "hot" && input.careState.gardenHealth <= 65) {
    candidates.push(
      makeCandidate(
        {
          key: "thirst_hot_weather",
          title: `${petName} could use a cool sip`,
          body: "The air feels warm today. A fresh water bowl is the best first care action.",
          priority: 4,
          suggestedAction: "water_garden",
          throttleHours: 3
        },
        timeBucket
      )
    );
  } else if (input.careState.gardenHealth <= 42) {
    candidates.push(
      makeCandidate(
        {
          key: "thirst_due",
          title: `${petName}'s water bowl could use a top-up`,
          body: "A quick water action would brighten the little mood a touch.",
          priority: 4,
          suggestedAction: "water_garden",
          throttleHours: 3
        },
        timeBucket
      )
    );
  }

  if (input.careState.happiness <= 45 || input.satisfactionSummary?.recommendedAction === "play") {
    candidates.push(
      makeCandidate(
        {
          key: "bored_play",
          title: `${petName} found the toy again`,
          body: "A short play moment sounds fun right about now.",
          priority: 3,
          suggestedAction: "play",
          throttleHours: 5
        },
        timeBucket
      )
    );
  }

  if (interactionHours >= 10 || input.careState.affection <= 42) {
    candidates.push(
      makeCandidate(
        {
          key: "attention_return",
          title: `${petName} has a small hello ready`,
          body: "Open the garden for a quick pet, talk, or check-in.",
          priority: 3,
          suggestedAction: "affection",
          throttleHours: 8
        },
        timeBucket
      )
    );
  }

  if ((timeBucket === "morning" || timeBucket === "evening") && input.careState.happiness < 70) {
    candidates.push(
      makeCandidate(
        {
          key: "walk_window",
          title: "Tiny path time",
          body: `${petName} might enjoy one calm walk window today.`,
          priority: 2,
          suggestedAction: "walk",
          throttleHours: 20
        },
        timeBucket
      )
    );
  }

  if ((timeBucket === "evening" || timeBucket === "night") && input.careState.energy <= 40) {
    candidates.push(
      makeCandidate(
        {
          key: "rest_needed",
          title: `${petName} is in sleepy mode`,
          body: "A rest action keeps the rhythm gentle for tonight.",
          priority: 2,
          suggestedAction: "rest",
          throttleHours: 10
        },
        timeBucket
      )
    );
  }

  if (weather.condition === "rain" && input.careState.happiness < 72) {
    candidates.push(
      makeCandidate(
        {
          key: "rainy_cozy_check",
          title: "Rainy little check-in",
          body: `${petName} is staying cozy. A hello would fit the weather.`,
          priority: 2,
          suggestedAction: "talk",
          throttleHours: 8
        },
        timeBucket
      )
    );
  }

  return candidates
    .filter((candidate) => !quietHours || candidate.priority >= 4 || candidate.key === "rest_needed")
    .filter((candidate) => !isThrottled(now, candidate, input.lastSentAtByKey))
    .sort((left, right) => right.priority - left.priority || left.throttleHours - right.throttleHours);
};

export type PetReturnReminderKey = Extract<PetPushNotificationKey, "return_after_1_day" | "return_after_3_days">;

export interface PetReturnReminderCandidate {
  key: PetReturnReminderKey;
  title: string;
  body: string;
  /** Days after the last session this reminder is meant to land. */
  daysAfterLastSession: 1 | 3;
}

export interface PetReturnReminderInput {
  petName: string;
  /** Used only to deterministically pick among a few copy variants, so the same
   * pet/day pairing always renders the same line instead of feeling random. */
  seed?: string | undefined;
  /**
   * The care streak count as of the last known session. When 3 or more, the
   * +1 day reminder (which lands right at the streak's real risk moment --
   * one more skipped day loses it) swaps to a streak-protective copy variant
   * instead of the generic "come back" line. Never phrased as a threat or
   * loss warning (e.g. no "your streak will be lost") -- just a warm nudge.
   */
  careStreakCurrent?: number | undefined;
}

/** Minimum streak length before the +1 day reminder switches to streak-protective copy. */
const STREAK_PROTECTIVE_REMINDER_THRESHOLD = 3;

/**
 * A small "did they leave the garden" win-back ladder. Unlike
 * selectPetPushNotificationCandidates (which reacts to *current* care state),
 * these two reminders are meant to be scheduled proactively the moment a
 * session goes idle, landing +1 day and +3 days after the last visit even if
 * the app never reopens to re-run the engine in between. Both candidates are
 * always returned - the caller (buildReturnReminderPlansFromCandidates) is
 * responsible for actually scheduling them relative to "now".
 */
const returnAfter1DayLines: Array<{ title: string; body: string }> = [
  {
    title: "Mong found a sunny spot to nap in",
    body: "The garden's been quiet today. Come see what Mong's been up to."
  },
  {
    title: "A little paw print showed up by the door",
    body: "Someone's been wondering when you'll wander back in."
  }
];

/**
 * Streak-protective variant of the +1 day reminder, shown only once the
 * streak is 3+ days deep (see STREAK_PROTECTIVE_REMINDER_THRESHOLD). This is
 * the reminder's real job at that point -- one more skipped day is the streak's
 * actual risk moment -- but the copy stays warm and reassuring, never a
 * countdown or loss threat.
 */
const returnAfter1DayStreakProtectiveLines: Array<{ title: string; body: string }> = [
  {
    title: "Mong is keeping your little routine cozy for you",
    body: "Your streak is still warm. A quick visit today keeps it glowing."
  },
  {
    title: "Your little streak is curled up, waiting",
    body: "Mong's been keeping it warm. Come say hello whenever you're ready."
  }
];

const returnAfter3DaysLines: Array<{ title: string; body: string }> = [
  {
    title: "The garden saved a spot for you",
    body: "It's been a few days. Mong would love a quick hello whenever you're ready."
  },
  {
    title: "A tiny leaf drifted by, just checking in",
    body: "No rush at all - the garden's still here, exactly as cozy as you left it."
  }
];

const pickLine = (
  lines: Array<{ title: string; body: string }>,
  petName: string,
  seed: string | undefined,
  salt: string
): { title: string; body: string } => {
  const index = hashString(`${petName}:${seed ?? ""}:${salt}`) % lines.length;

  return lines[index] ?? lines[0]!;
};

const hashString = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

export const selectReturnReminderCandidates = (input: PetReturnReminderInput): PetReturnReminderCandidate[] => {
  const petName = input.petName.trim() || "Your pet";
  const isStreakAtRisk = (input.careStreakCurrent ?? 0) >= STREAK_PROTECTIVE_REMINDER_THRESHOLD;
  const oneDayLine = pickLine(isStreakAtRisk ? returnAfter1DayStreakProtectiveLines : returnAfter1DayLines, petName, input.seed, "1d");
  const threeDayLine = pickLine(returnAfter3DaysLines, petName, input.seed, "3d");

  return [
    {
      key: "return_after_1_day",
      title: oneDayLine.title,
      body: oneDayLine.body,
      daysAfterLastSession: 1
    },
    {
      key: "return_after_3_days",
      title: threeDayLine.title,
      body: threeDayLine.body,
      daysAfterLastSession: 3
    }
  ];
};
