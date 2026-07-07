import type { CareStats, CompanionHabitHint } from "../domain/careStats";
import { getCompanionHabitHints } from "../domain/careStats";
import type { MemoryEntry, MemoryType } from "../domain/petMemories";
import { getRecentPetMemories } from "../domain/petMemories";
import type { WeatherCondition, WeatherContext } from "../domain/weather";

/**
 * A single candidate "episode line" -- a short callback that references
 * something specific (a recent memory, a care habit, or today's weather
 * shift) instead of generic ambient copy. `key` is stable per underlying
 * fact (memory id, habit id, or weather-shift day) so callers can dedupe
 * against `recentShownKeys` without re-deriving the source data.
 */
export interface SelectedEpisodeLine {
  key: string;
  line: string;
  source: "memory" | "habit" | "weather_shift";
}

export interface SelectEpisodeLineInput {
  petName: string;
  memories: readonly MemoryEntry[];
  careStats: CareStats;
  streak: number;
  bondLevel: number;
  weather: Pick<WeatherContext, "condition"> | null | undefined;
  /** Yesterday's weather condition, if known -- powers the "weather changed" episode. Omit/undefined if unknown. */
  previousWeatherCondition?: WeatherCondition | null;
  now: string;
  /** Keys already shown recently (see `RecentShownEpisodeKey` callers) -- lines whose key is in this list are skipped. */
  recentShownKeys?: readonly string[];
}

const MEMORY_LOOKBACK_HOURS = 48;
const ONE_HOUR_MS = 60 * 60 * 1000;

const hashString = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

const pickVariant = (lines: readonly string[], seed: string): string => {
  if (lines.length === 0) {
    return "";
  }

  return lines[hashString(seed) % lines.length] ?? lines[0] ?? "";
};

const fill = (line: string, petName: string): string => line.replaceAll("{petName}", petName);

// Milestone-y memory types worth a callback line the next day or two -- other
// types (moved_in, theme_applied) are either permanent or already visually
// obvious, so they don't need a spoken recall.
const recallableMemoryTypes = new Set<MemoryType>([
  "first_walk",
  "first_find",
  "rare_find",
  "collection_complete",
  "bond_level",
  "streak_milestone",
  "days_milestone",
  "first_treat"
]);

const memoryRecallLines: Partial<Record<MemoryType, readonly string[]>> = {
  first_walk: [
    "I keep thinking about our very first walk together. That was a good one.",
    "Remember our first walk? I still think about it sometimes."
  ],
  first_find: [
    "I keep thinking about the little thing I found on our walk.",
    "That first little find is still my favorite kind of memory."
  ],
  rare_find: [
    "A rainbow piece! I still can't believe it.",
    "I keep replaying finding that rare little thing. Lucky day."
  ],
  collection_complete: [
    "Our whole walk journal, filled up. I still feel proud about that.",
    "I keep flipping back through our finished journal in my head."
  ],
  bond_level: [
    "We've gotten closer lately, haven't we?",
    "Something between us leveled up recently. I noticed."
  ],
  streak_milestone: [
    "Seven days of hellos. I counted.",
    "That whole streak of days together is still on my mind."
  ],
  days_milestone: [
    "I keep doing the math on how long we've been together. It's a good number.",
    "That little days-together milestone is still making me smile."
  ],
  first_treat: [
    "I still remember my very first treat from you. Big moment.",
    "That first treat you gave me lives rent-free in my head."
  ]
};

const habitLines: Record<CompanionHabitHint, readonly string[]> = {
  loves_playtime: ["Is it playtime yet? Just asking.", "I keep glancing at the toy. No pressure though."],
  cuddle_bug: ["I could use one of your gentle pats about now.", "A little affection would land perfectly right now."],
  trail_buddy: ["My paws are itching for another little walk.", "The path has been on my mind today."],
  foodie: ["I smelled something delicious. Probably.", "My tummy has been narrating snack ideas all day."],
  chatterbox: ["I saved up a few things to tell you.", "I have been quietly rehearsing what to say to you."],
  gentle_groomer: ["A little freshen-up sounds nice today.", "I have been feeling extra fond of clean fur days."],
  green_thumb: ["The garden and I have been keeping an eye on things together.", "I like when the garden looks cared for. Team effort."],
  night_owl_rester: ["A quiet rest sounds perfect right about now.", "I have been saving up some sleepy thoughts for later."]
};

const weatherShiftLines: Partial<Record<WeatherCondition, readonly string[]>> = {
  rain: ["Rain today — I watched the drops race down the fence.", "It switched to rain today. I found a dry little spot to watch from."],
  snow: ["Snow came out of nowhere today. I stared at it for a while.", "It turned snowy today. Everything went quiet and soft."],
  storm: ["A storm rolled in today. I kept close to something sturdy.", "Today got loud outside. I am telling you so it's not a secret."],
  clear: ["The clouds finally cleared up today. Everything looks new.", "Blue sky showed up today after all that gray. Nice surprise."],
  wind: ["It got windy today, out of nowhere. Kept me alert.", "Today's wind carried a lot of little smells. Busy day for my nose."],
  fog: ["Fog rolled in today. Our little spot felt extra secret.", "Everything went misty today. I liked how quiet it made things."],
  cloudy: ["The sky went gray today after being so bright. I noticed.", "Today turned cloudy out of nowhere. Cozy kind of change."],
  partly_cloudy: ["The sky kept changing its mind today.", "Clouds kept drifting past today. Never boring to watch."],
  hot: ["It got warm fast today. I found the shade early.", "Today heated up more than yesterday. I noticed right away."],
  cold: ["It got chilly today, more than before. Staying close feels warmer.", "Today turned cold out of nowhere. Good day for cozy mode."]
};

const isWithinLookback = (occurredAt: string, now: string, hours: number): boolean => {
  const occurredMs = new Date(occurredAt).getTime();
  const nowMs = new Date(now).getTime();

  if (!Number.isFinite(occurredMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  return nowMs - occurredMs >= 0 && nowMs - occurredMs <= hours * ONE_HOUR_MS;
};

const notRecentlyShown = (key: string, recentShownKeys: readonly string[] | undefined): boolean =>
  !recentShownKeys || !recentShownKeys.includes(key);

const selectMemoryRecallLine = (input: SelectEpisodeLineInput): SelectedEpisodeLine | null => {
  const candidateMemories = getRecentPetMemories([...input.memories], 10).filter(
    (memory) => recallableMemoryTypes.has(memory.type) && isWithinLookback(memory.occurredAt, input.now, MEMORY_LOOKBACK_HOURS)
  );

  for (const memory of candidateMemories) {
    const key = `memory:${memory.id}`;

    if (!notRecentlyShown(key, input.recentShownKeys)) {
      continue;
    }

    const variants = memoryRecallLines[memory.type];

    if (!variants || variants.length === 0) {
      continue;
    }

    return {
      key,
      line: fill(pickVariant(variants, `${key}|${memory.occurredAt}`), input.petName),
      source: "memory"
    };
  }

  return null;
};

const selectHabitLine = (input: SelectEpisodeLineInput): SelectedEpisodeLine | null => {
  const hints = getCompanionHabitHints(input.careStats);

  for (const hint of hints) {
    const key = `habit:${hint}`;

    if (!notRecentlyShown(key, input.recentShownKeys)) {
      continue;
    }

    const variants = habitLines[hint];

    return {
      key,
      line: fill(pickVariant(variants, `${key}|${input.now}`), input.petName),
      source: "habit"
    };
  }

  return null;
};

const selectWeatherShiftLine = (input: SelectEpisodeLineInput): SelectedEpisodeLine | null => {
  const condition = input.weather?.condition;
  const previous = input.previousWeatherCondition;

  if (!condition || !previous || previous === condition) {
    return null;
  }

  const dayKey = new Date(input.now).toISOString().slice(0, 10);
  const key = `weather_shift:${condition}:${dayKey}`;

  if (!notRecentlyShown(key, input.recentShownKeys)) {
    return null;
  }

  const variants = weatherShiftLines[condition];

  if (!variants || variants.length === 0) {
    return null;
  }

  return {
    key,
    line: fill(pickVariant(variants, `${key}`), input.petName),
    source: "weather_shift"
  };
};

/**
 * Picks one "episode line" -- a callback to a recent memory, an accumulated
 * care habit, or a same-day weather shift -- so the home speech bubble can
 * say something specific to *this* pet's history instead of generic ambient
 * copy. Returns null when nothing new applies (e.g. every candidate line was
 * already shown recently per `recentShownKeys`), so callers should fall back
 * to their existing ambient/ urgent-need copy in that case.
 *
 * Priority: a recent milestone memory (most emotionally specific) beats a
 * standing care habit, which beats a same-day weather shift (the most
 * ambient of the three).
 */
export const selectEpisodeLine = (input: SelectEpisodeLineInput): SelectedEpisodeLine | null =>
  selectMemoryRecallLine(input) ?? selectHabitLine(input) ?? selectWeatherShiftLine(input);
