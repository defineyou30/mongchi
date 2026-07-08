import type { CareActionType, CareState } from "./care";
import type { CareStats } from "./careStats";
import { getFavoriteCareAction } from "./careStats";
import type { MemoryEntry } from "./petMemories";
import { getRecentPetMemories } from "./petMemories";

/** Milestone memory types worth greeting with -- the ones that read as a clear "I remember this" beat. */
const GREETING_WORTHY_MEMORY_TYPES = new Set<MemoryEntry["type"]>([
  "bond_level",
  "days_milestone",
  "streak_milestone",
  "collection_complete",
  "rare_find",
  "first_walk",
  "first_find",
  "first_treat",
  "theme_applied",
  "expression_pack"
]);

const MILESTONE_WINDOW_MS = 48 * 60 * 60 * 1000;

const careActionGreetingLabels: Record<CareActionType, string> = {
  feed: "the good meals",
  talk: "our little chats",
  walk: "our walks",
  play: "our playtime",
  rest: "quiet rests",
  affection: "the gentle pets",
  water_garden: "the fresh water",
  clean: "the good brushes",
  treat: "the treats"
};

const milestoneGreetingLinesByType: Record<string, readonly string[]> = {
  bond_level: [
    "I've been thinking about how close we've gotten lately.",
    "Our bond feels stronger than ever -- I noticed."
  ],
  days_milestone: [
    "I keep thinking about how long we've been together.",
    "It still feels special every day we've had so far."
  ],
  streak_milestone: [
    "You've been showing up for me every day. I noticed.",
    "I love our little daily rhythm together."
  ],
  collection_complete: [
    "I still think about finishing our walk journal together.",
    "That full collection makes me proud every time I remember it."
  ],
  rare_find: [
    "I'm still thinking about that rare little find from our walk.",
    "That rainbow-rare discovery is still my favorite memory."
  ],
  first_walk: [
    "I still remember our very first walk together.",
    "That first little adventure is still stuck in my head, happily."
  ],
  first_find: [
    "I still think about the first thing I ever brought back to you.",
    "That first walk discovery is still one of my favorites."
  ],
  first_treat: [
    "I still remember the first treat you ever gave me.",
    "That first little snack is still a happy memory."
  ],
  theme_applied: [
    "I still love how you changed up our little home.",
    "This new look on our place still makes me happy."
  ],
  expression_pack: [
    "I love that you get to see even more of my little expressions now.",
    "I still feel proud showing you my new looks."
  ]
};

const defaultGreetingLines: readonly string[] = [
  "Hi. I'm glad you're here.",
  "I was hoping you'd come by.",
  "There you are. I've been waiting."
];

/** Shown instead of any memory/care-based greeting while a walk is in progress -- see ChatGreetingLineInput.isOnWalk. */
const walkGreetingLines: readonly string[] = [
  "On my walk! Smells amazing out here.",
  "Can't talk long -- I'm out and about right now."
];

export interface ChatGreetingLineInput {
  petName: string;
  memories: readonly MemoryEntry[];
  careStats: CareStats;
  careState?: Pick<CareState, "lastInteractionAt" | "updatedAt"> | undefined;
  now: string;
  /** True while the pet is out on an active walk -- takes priority over every other greeting tier below. */
  isOnWalk?: boolean;
}

const hashString = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

const chooseLine = (lines: readonly string[], seed: string): string => {
  if (lines.length === 0) {
    return "";
  }

  return lines[hashString(seed) % lines.length] ?? lines[0] ?? "";
};

const isSameCalendarDay = (aIso: string, bIso: string): boolean => {
  const a = new Date(aIso);
  const b = new Date(bIso);

  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) {
    return false;
  }

  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const getMostRecentMilestoneWithinWindow = (memories: readonly MemoryEntry[], now: string): MemoryEntry | null => {
  const nowMs = new Date(now).getTime();

  if (!Number.isFinite(nowMs)) {
    return null;
  }

  const recent = getRecentPetMemories([...memories], memories.length);

  for (const memory of recent) {
    if (!GREETING_WORTHY_MEMORY_TYPES.has(memory.type)) {
      continue;
    }

    const occurredMs = new Date(memory.occurredAt).getTime();

    if (!Number.isFinite(occurredMs)) {
      continue;
    }

    if (nowMs - occurredMs <= MILESTONE_WINDOW_MS && occurredMs <= nowMs) {
      return memory;
    }
  }

  return null;
};

/**
 * Builds the pet's free, ticket-less first chat greeting -- the "this pet
 * remembers me" moment shown before any paywall interaction. Priority:
 * 0) currently out on a walk, 1) a milestone memory from the last 24-48h,
 * 2) today's most-performed care action, 3) the owner's all-time favorite
 * care action, 4) a default warm hello. Selection within each tier is
 * deterministic (seeded by petName + now + the chosen memory/action) so the
 * same state renders the same line across re-renders, while still varying
 * across days/situations.
 */
export const buildChatGreetingLine = ({ petName, memories, careStats, careState, now, isOnWalk }: ChatGreetingLineInput): string => {
  if (isOnWalk) {
    return chooseLine(walkGreetingLines, [petName, "walk", now.slice(0, 10)].join("|"));
  }

  const milestone = getMostRecentMilestoneWithinWindow(memories, now);

  if (milestone) {
    const lines = milestoneGreetingLinesByType[milestone.type] ?? defaultGreetingLines;

    return chooseLine(lines, [petName, milestone.id, milestone.type].join("|"));
  }

  const lastInteractionAt = careState?.lastInteractionAt;
  const hasCareToday = lastInteractionAt ? isSameCalendarDay(lastInteractionAt, now) : false;
  const favoriteAction = getFavoriteCareAction(careStats);

  if (hasCareToday && favoriteAction) {
    const label = careActionGreetingLabels[favoriteAction];

    return `You gave me ${label} today.`;
  }

  if (favoriteAction) {
    const label = careActionGreetingLabels[favoriteAction];

    return `I always look forward to ${label} with you.`;
  }

  // Seed by calendar day, not the full timestamp: callers recompute `now`
  // every render, and a per-millisecond seed made this line flip between
  // variants each render — resetting the typewriter to an empty bubble.
  return chooseLine(defaultGreetingLines, [petName, now.slice(0, 10)].join("|"));
};
