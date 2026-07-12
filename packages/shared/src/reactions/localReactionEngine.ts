import type {
  ReactionConditions,
  ReactionRule,
  ReactionSelectionContext,
  SelectedReaction,
  TimeBucket
} from "../domain/reactions";
import type { Locale } from "../domain/common";

export interface ReactionSelectionOptions {
  random?: () => number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export const getTimeBucket = (date: Date): TimeBucket => {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "morning";
  }

  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "evening";
  }

  return "night";
};

/**
 * Deterministic 0-1 pseudo-random generator seeded from a string. Lets callers
 * pass a stable `options.random` into `selectLocalReaction` so the picked
 * reaction/line stays put across re-renders that share the same seed (e.g. a
 * screen re-rendering every second on a clock tick) instead of reshuffling on
 * every call the way `Math.random` would.
 */
export const createSeededRandom = (seed: string): (() => number) => {
  let state = 0;

  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) | 0;
  }

  state = state === 0 ? 1 : state;

  return () => {
    // xorshift32 — fast, deterministic, good-enough distribution for UI copy rotation.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;

    return (state >>> 0) / 0xffffffff;
  };
};

const hasAny = <T>(needles: readonly T[] | undefined, haystack: readonly T[]): boolean => {
  if (!needles || needles.length === 0) {
    return true;
  }

  return needles.some((needle) => haystack.includes(needle));
};

const hasAll = <T>(needles: readonly T[] | undefined, haystack: readonly T[]): boolean => {
  if (!needles || needles.length === 0) {
    return true;
  }

  return needles.every((needle) => haystack.includes(needle));
};

const inRange = (value: number, min?: number, max?: number): boolean => {
  if (min !== undefined && value < min) {
    return false;
  }

  if (max !== undefined && value > max) {
    return false;
  }

  return true;
};

const matchesConditions = (conditions: ReactionConditions, context: ReactionSelectionContext): boolean => {
  const timeBucket = getTimeBucket(new Date(context.now));
  const { careState, pet } = context;

  if (conditions.timeBucket && conditions.timeBucket !== timeBucket) {
    return false;
  }

  if (!hasAny(conditions.personalityTagsAny, pet.personalityTags)) {
    return false;
  }

  if (!hasAll(conditions.personalityTagsAll, pet.personalityTags)) {
    return false;
  }

  if (conditions.talkingStylesAny && !conditions.talkingStylesAny.includes(pet.talkingStyle)) {
    return false;
  }

  if (conditions.species && !conditions.species.includes(pet.species)) {
    return false;
  }

  if (conditions.recentActionAny) {
    if (!context.recentAction || !conditions.recentActionAny.includes(context.recentAction)) {
      return false;
    }
  }

  if (conditions.daysAwayMin !== undefined || conditions.daysAwayMax !== undefined) {
    if (context.daysAway === undefined || !inRange(context.daysAway, conditions.daysAwayMin, conditions.daysAwayMax)) {
      return false;
    }
  }

  if (conditions.walkStatus) {
    if (!context.walkStatus || !conditions.walkStatus.includes(context.walkStatus)) {
      return false;
    }
  }

  if (conditions.weatherCondition) {
    if (!context.weather || !conditions.weatherCondition.includes(context.weather.condition)) {
      return false;
    }
  }

  if (conditions.weatherIntensity) {
    if (!context.weather || !conditions.weatherIntensity.includes(context.weather.intensity)) {
      return false;
    }
  }

  if (conditions.weatherSource) {
    if (!context.weather || !conditions.weatherSource.includes(context.weather.source)) {
      return false;
    }
  }

  if (conditions.weatherIsDaytime !== undefined) {
    if (!context.weather || context.weather.isDaytime !== conditions.weatherIsDaytime) {
      return false;
    }
  }

  if (conditions.eventContext) {
    if (!context.eventContext || !conditions.eventContext.includes(context.eventContext)) {
      return false;
    }
  }

  if (conditions.bondLevelMin !== undefined) {
    if (context.bondLevel === undefined || context.bondLevel < conditions.bondLevelMin) {
      return false;
    }
  }

  if (conditions.daysTogetherMin !== undefined) {
    if (context.daysTogether === undefined || context.daysTogether < conditions.daysTogetherMin) {
      return false;
    }
  }

  if (conditions.streakMin !== undefined) {
    if (context.streak === undefined || context.streak < conditions.streakMin) {
      return false;
    }
  }

  if (conditions.requiresFavoriteThing && !pet.favoriteThing) {
    return false;
  }

  return (
    inRange(careState.satiety, conditions.satietyMin, conditions.satietyMax) &&
    inRange(careState.energy, conditions.energyMin, conditions.energyMax) &&
    inRange(careState.happiness, conditions.happinessMin, conditions.happinessMax) &&
    inRange(careState.affection, conditions.affectionMin, conditions.affectionMax) &&
    inRange(careState.gardenHealth, conditions.gardenHealthMin, conditions.gardenHealthMax) &&
    inRange(careState.cleanliness, conditions.cleanlinessMin, conditions.cleanlinessMax)
  );
};

const isCoolingDown = (rule: ReactionRule, context: ReactionSelectionContext): boolean => {
  if (!context.recentReactions || rule.cooldownHours <= 0) {
    return false;
  }

  const nowMs = new Date(context.now).getTime();
  const cooldownMs = rule.cooldownHours * ONE_HOUR_MS;

  return context.recentReactions.some((recent) => {
    if (recent.ruleId !== rule.id) {
      return false;
    }

    return nowMs - new Date(recent.shownAt).getTime() < cooldownMs;
  });
};

const scoreRule = (rule: ReactionRule, context: ReactionSelectionContext): number => {
  let score = rule.priority;

  if (rule.conditions.satietyMax !== undefined && context.careState.satiety <= rule.conditions.satietyMax) {
    score += 20;
  }

  if (rule.conditions.gardenHealthMax !== undefined && context.careState.gardenHealth <= rule.conditions.gardenHealthMax) {
    score += 12;
  }

  if (
    context.daysAway !== undefined &&
    (rule.conditions.daysAwayMin !== undefined || rule.conditions.daysAwayMax !== undefined) &&
    inRange(context.daysAway, rule.conditions.daysAwayMin, rule.conditions.daysAwayMax)
  ) {
    score += 28;
  }

  if (context.recentAction && rule.conditions.recentActionAny?.includes(context.recentAction)) {
    score += 16;
  }

  if (context.walkStatus && rule.conditions.walkStatus?.includes(context.walkStatus)) {
    score += 8;
  }

  if (context.eventContext && rule.conditions.eventContext?.includes(context.eventContext)) {
    score += 24;
  }

  if (context.weather && rule.conditions.weatherCondition?.includes(context.weather.condition)) {
    score += 10;
  }

  if (context.weather && rule.conditions.weatherIntensity?.includes(context.weather.intensity)) {
    score += 4;
  }

  if (rule.conditions.personalityTagsAny && hasAny(rule.conditions.personalityTagsAny, context.pet.personalityTags)) {
    score += 4;
  }

  if (
    rule.conditions.bondLevelMin !== undefined &&
    context.bondLevel !== undefined &&
    context.bondLevel >= rule.conditions.bondLevelMin
  ) {
    score += 6;
  }

  if (
    rule.conditions.daysTogetherMin !== undefined &&
    context.daysTogether !== undefined &&
    context.daysTogether >= rule.conditions.daysTogetherMin
  ) {
    score += 6;
  }

  if (rule.conditions.streakMin !== undefined && context.streak !== undefined && context.streak >= rule.conditions.streakMin) {
    score += 6;
  }

  return score;
};

const favoriteThingFallbackByLocale: Record<Locale, string> = {
  "en-US": "tiny things",
  "ko-KR": "작은 것들",
  "ja-JP": "小さなもの",
  "zh-TW": "小東西",
  "de-DE": "kleine Dinge",
  "fr-FR": "les petites choses",
  "pt-BR": "coisinhas",
  "es-MX": "cositas"
};

const fallbackLineByLocale: Record<Locale, (petName: string) => string> = {
  "en-US": (petName) => `${petName} is quietly here with you.`,
  "ko-KR": (petName) => `${petName}이 조용히 곁에 있어.`,
  "ja-JP": (petName) => `${petName}は静かにそばにいるよ。`,
  "zh-TW": (petName) => `${petName}正安靜地陪在你身邊。`,
  "de-DE": (petName) => `${petName} ist ganz still bei dir.`,
  "fr-FR": (petName) => `${petName} reste tranquillement près de toi.`,
  "pt-BR": (petName) => `${petName} está quietinho aqui com você.`,
  "es-MX": (petName) => `${petName} está tranquilamente aquí contigo.`
};

const fillPlaceholders = (line: string, context: ReactionSelectionContext): string =>
  line
    .replaceAll("{petName}", context.pet.name)
    .replaceAll("{favoriteThing}", context.pet.favoriteThing ?? favoriteThingFallbackByLocale[context.locale]);

const fallbackReaction = (context: ReactionSelectionContext): SelectedReaction => ({
  ruleId: "fallback_local_safe",
  category: "error_soft",
  line: fallbackLineByLocale[context.locale](context.pet.name),
  animation: "idle",
  priority: 0
});

export const selectLocalReaction = (
  rules: readonly ReactionRule[],
  context: ReactionSelectionContext,
  options: ReactionSelectionOptions = {}
): SelectedReaction => {
  const random = options.random ?? Math.random;
  const localeRules = rules.filter((rule) => rule.locale === context.locale && rule.safetyLevel === "safe");

  const candidates = localeRules
    .filter((rule) => rule.lines.length > 0)
    .filter((rule) => matchesConditions(rule.conditions, context))
    .filter((rule) => !isCoolingDown(rule, context))
    .map((rule) => ({
      rule,
      score: scoreRule(rule, context)
    }))
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    return fallbackReaction(context);
  }

  const topScore = candidates[0]?.score ?? 0;
  const topCandidates = candidates.filter((candidate) => candidate.score >= topScore - 8);
  const selected = topCandidates[Math.floor(random() * topCandidates.length)] ?? candidates[0];

  if (!selected) {
    return fallbackReaction(context);
  }

  const line = selected.rule.lines[Math.floor(random() * selected.rule.lines.length)] ?? selected.rule.lines[0];

  if (!line) {
    return fallbackReaction(context);
  }

  return {
    ruleId: selected.rule.id,
    category: selected.rule.category,
    line: fillPlaceholders(line, context),
    animation: selected.rule.animation,
    priority: selected.rule.priority
  };
};
