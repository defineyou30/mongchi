import type { CareActionType } from "./care";
import type { CareStats } from "./careStats";
import { getFavoriteCareAction, getFavoriteTreatItemId } from "./careStats";
import type { MemoryEntry, MemoryType } from "./petMemories";
import { getPetMemoryHighlights } from "./petMemories";

/** Threshold at which a pet is considered to have "reached" its one-month letter. */
export const MONTHLY_LETTER_THRESHOLD_DAYS = 30;

/** How many memory highlights are considered before the days_milestone exclusion and retelling limit. */
const LETTER_HIGHLIGHT_LIMIT = 6;

/**
 * How many highlight sentences make it into the letter body, at most. Kept
 * to 2 (rather than the full 3 the requirements allow) so the letter still
 * fits its 5-8 sentence budget even when every optional line (favorite
 * activity, favorite treat, favoriteThing) also fires: greeting (1) +
 * highlights (2) + optional lines (up to 3) + closing (2) = 8.
 */
const LETTER_RETELL_LIMIT = 2;

export interface MonthlyLetterInput {
  petName: string;
  memories: readonly MemoryEntry[];
  careStats: CareStats;
  /** The onboarding "favorite thing" free-text note, if the owner set one. */
  favoriteThing?: string | null | undefined;
  /** Resolved display name of the most-gifted treat item, if any have been given. */
  favoriteTreatName?: string | null | undefined;
  daysTogether: number;
  now: string;
}

/** Warm, present-tense phrasing per care action -- mirrors chatGreeting.ts's labels for a consistent voice. */
const careActionLetterLabels: Record<CareActionType, string> = {
  feed: "sharing good meals",
  talk: "our little chats",
  walk: "our walks together",
  play: "our playtime",
  rest: "quiet rests side by side",
  affection: "the gentle pets",
  water_garden: "tending the garden together",
  clean: "the good brushes",
  treat: "treat time"
};

/**
 * Retrospective (looking-back) sentence templates per memory type -- unlike
 * the memory's stored `line` (written in the present tense, for the moment it
 * happened), a 30-day letter is told from a month later, so it needs its own
 * "remember when" voice. `days_milestone` is intentionally absent: the letter
 * itself is the 30-day retrospective, so a day-count memory inside it would
 * just repeat what the letter already says.
 *
 * Each type offers 1-2 deterministic variants; `toRetrospectiveSentence`
 * below picks one from the memory's own id so the same memory always
 * renders the same way.
 */
const retrospectiveTemplatesByType: Partial<Record<MemoryType, readonly string[]>> = {
  moved_in: ["I still remember my first day in the garden."],
  first_walk: [
    "Our first walk together -- I was so excited I forgot which way to sniff.",
    "I remember our very first walk, when everything outside was brand new."
  ],
  first_find: [
    "I remember bringing home my very first walk find, so proud of it.",
    "That first little treasure from our walks -- I still think about it."
  ],
  rare_find: [
    "And that rainbow-rare find! I'm still proud of that one.",
    "I still can't believe we found something so rare on a walk."
  ],
  collection_complete: [
    "We filled the whole walk journal, you and me.",
    "Every page of our walk journal is full now -- we did that together."
  ],
  bond_level: [
    "Somewhere along the way, we became a real team.",
    "I could feel us growing closer with every day that passed."
  ],
  streak_milestone: [
    "You kept coming back, day after day. I noticed every single one.",
    "All those days in a row together still mean the world to me."
  ],
  first_treat: [
    "I remember the very first treat you ever gave me.",
    "That first treat from you -- I still remember how happy it made me."
  ],
  theme_applied: [
    "And remember when the garden got its new look? I loved that.",
    "I still smile thinking about the day our garden changed for the better."
  ],
  expression_pack: [
    "And remember when I learned some new expressions to share with you?",
    "I still love showing you all the new little looks I picked up."
  ]
};

/** Simple, deterministic string hash (djb2) used only to pick a stable template variant. */
const stableHash = (value: string): number => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

/**
 * Turns a highlighted memory into a standalone retrospective sentence. Falls
 * back to a gentle generic line for any type without a dedicated template
 * (there shouldn't be one left uncovered, but this keeps the letter safe if
 * a new MemoryType is ever added without updating this file first).
 */
const toRetrospectiveSentence = (memory: MemoryEntry): string => {
  const templates = retrospectiveTemplatesByType[memory.type];

  if (!templates || templates.length === 0) {
    return "I remember that one, too.";
  }

  const variantIndex = stableHash(memory.id) % templates.length;

  return templates[variantIndex]!;
};

/**
 * Builds the deterministic "one month since I moved in" letter body for the
 * friend page. Only produces a letter once `daysTogether` has reached
 * MONTHLY_LETTER_THRESHOLD_DAYS -- returns null before that so callers can
 * show a locked-preview state instead.
 *
 * Structure (5-8 sentences, all warm/first-person, never guilt-tripping):
 * 1) A greeting marking the month.
 * 2) Up to 2 memory highlights (getPetMemoryHighlights, days_milestone excluded
 *    since the letter itself is the 30-day retrospective), each rendered as
 *    its own complete retrospective sentence -- never comma-spliced. Owners
 *    with 0 or 1 eligible highlights (e.g. only "moved in") get a gentle
 *    "quiet, good days" fallback sentence added alongside it so the recap
 *    still reads as a full paragraph.
 * 3) An optional favorite-activity line from care stats, and an optional
 *    favorite-treat or favorite-thing line.
 * 4) A closing thank-you signed with a paw-print flourish.
 *
 * Deterministic: the same memories/careStats/favoriteThing/daysTogether/now
 * always produce the same letter text (no randomness, no Date.now() calls).
 */
export const buildMonthlyLetter = ({
  petName,
  memories,
  careStats,
  favoriteThing,
  favoriteTreatName,
  daysTogether,
  now
}: MonthlyLetterInput): string | null => {
  if (daysTogether < MONTHLY_LETTER_THRESHOLD_DAYS) {
    return null;
  }

  const sentences: string[] = [];

  sentences.push("It's been a whole month since I moved in.");

  const eligibleHighlights = getPetMemoryHighlights([...memories], LETTER_HIGHLIGHT_LIMIT).filter(
    (memory) => memory.type !== "days_milestone" && new Date(memory.occurredAt).getTime() <= new Date(now).getTime()
  );
  const retellHighlights = eligibleHighlights.slice(0, LETTER_RETELL_LIMIT);

  if (retellHighlights.length > 0) {
    retellHighlights.forEach((memory) => {
      sentences.push(toRetrospectiveSentence(memory));
    });
  }

  // Owners with sparse highlights (a single memory, or none at all) still
  // get a full-feeling recap: round the retrospective out to two sentences
  // with a gentle, generic line rather than leaving the letter feeling thin.
  if (retellHighlights.length <= 1) {
    sentences.push("Mostly, I remember the quiet, good days.");
  }

  const favoriteAction = getFavoriteCareAction(careStats);

  if (favoriteAction) {
    sentences.push(`I still look forward to ${careActionLetterLabels[favoriteAction]} more than anything.`);
  }

  const resolvedFavoriteTreatName = favoriteTreatName ?? null;
  const favoriteTreatItemId = getFavoriteTreatItemId(careStats);

  if (resolvedFavoriteTreatName && favoriteTreatItemId) {
    sentences.push(`And I will never say no to ${resolvedFavoriteTreatName}.`);
  }

  const trimmedFavoriteThing = favoriteThing?.trim();

  if (trimmedFavoriteThing) {
    sentences.push(`You already knew I'd always be up for ${trimmedFavoriteThing}.`);
  }

  sentences.push(`Thank you for every small hello this month, and all the ones still coming.`);
  sentences.push(`-- ${petName}, with a little paw print left right here.`);

  return sentences.join(" ");
};
