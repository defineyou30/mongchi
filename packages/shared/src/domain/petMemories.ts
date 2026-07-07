import type { ISODateTime } from "./common";

/**
 * Kinds of moments worth remembering. Each type maps to a small set of warm,
 * first-person lines (see the callers in prototypeSession.ts) -- this file
 * only owns the storage/dedupe/selection rules, not the copy itself, so
 * future waves (album cards, home episodes, chat memory injection, monthly
 * letters) can render the same entries however they like.
 */
export type MemoryType =
  | "moved_in"
  | "first_walk"
  | "first_find"
  | "rare_find"
  | "collection_complete"
  | "bond_level"
  | "streak_milestone"
  | "days_milestone"
  | "first_treat"
  | "theme_applied"
  | "expression_pack";

export interface MemoryEntryRefs {
  itemId?: string;
  collectibleId?: string;
  weather?: string;
  streakCount?: number;
  bondLevel?: number;
  daysTogether?: number;
  /** Free-text carried over from a pre-existing note (e.g. the setup screen's "first tiny memory" input). */
  note?: string;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  occurredAt: ISODateTime;
  line: string;
  refs?: MemoryEntryRefs;
}

/** Hard cap on stored memories -- past this, the oldest non-milestone entries are trimmed first. */
export const MAX_STORED_MEMORIES = 200;

/**
 * Memory types that represent a one-time life event worth keeping forever
 * (or at least far longer than the 200-entry cap would otherwise allow).
 * These are protected from the cap-eviction in recordPetMemory.
 */
const PERMANENT_MEMORY_TYPES = new Set<MemoryType>(["moved_in"]);

/**
 * What makes two memory entries "the same" for dedupe purposes. Most types
 * are naturally one-shot per distinguishing ref (e.g. one "first_find" ever,
 * one "bond_level" per level, one "streak_milestone" per count, one
 * "theme_applied" per theme) -- recordPetMemory uses this to decide whether
 * an incoming entry is a duplicate of one already stored.
 */
const dedupeKeyFor = (entry: Pick<MemoryEntry, "type" | "refs">): string => {
  switch (entry.type) {
    case "moved_in":
    case "first_walk":
    case "first_find":
    case "first_treat":
    case "collection_complete":
      // One-time-ever milestones: the type alone is the key.
      return entry.type;
    case "bond_level":
      return `${entry.type}:${entry.refs?.bondLevel ?? ""}`;
    case "streak_milestone":
      return `${entry.type}:${entry.refs?.streakCount ?? ""}`;
    case "days_milestone":
      return `${entry.type}:${entry.refs?.daysTogether ?? ""}`;
    case "theme_applied":
    case "expression_pack":
      return `${entry.type}:${entry.refs?.itemId ?? ""}`;
    case "rare_find":
      // Rare finds can repeat (each one is a nice surprise), so every
      // occurrence is unique -- keyed by timestamp so it never collides.
      return `${entry.type}:${entry.refs?.collectibleId ?? ""}:${Math.random()}`;
    default:
      return entry.type;
  }
};

/**
 * Appends a new memory, skipping it if an equivalent entry (same type +
 * dedupe key, e.g. the same bond level or the same one-shot milestone) is
 * already recorded. Keeps at most MAX_STORED_MEMORIES entries, evicting the
 * oldest non-permanent entries first so one-shot life events (moved_in) are
 * never lost to the cap.
 */
export const recordPetMemory = (memories: MemoryEntry[], entry: MemoryEntry): MemoryEntry[] => {
  const incomingKey = dedupeKeyFor(entry);
  const alreadyRecorded = memories.some((existing) => dedupeKeyFor(existing) === incomingKey);

  if (alreadyRecorded) {
    return memories;
  }

  const next = [...memories, entry];

  if (next.length <= MAX_STORED_MEMORIES) {
    return next;
  }

  // Over the cap: drop the oldest evictable (non-permanent) entry. If every
  // entry happens to be permanent (shouldn't realistically happen), fall
  // back to dropping the oldest entry outright rather than growing forever.
  const evictIndex = next.findIndex((candidate) => !PERMANENT_MEMORY_TYPES.has(candidate.type));

  if (evictIndex === -1) {
    return next.slice(1);
  }

  return [...next.slice(0, evictIndex), ...next.slice(evictIndex + 1)];
};

/** Most recent `n` memories, newest first -- for a simple recap/timeline view. */
export const getRecentPetMemories = (memories: MemoryEntry[], n: number): MemoryEntry[] =>
  [...memories]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, Math.max(0, n));

// Milestone types worth leading with in a monthly letter, in priority order
// (rarest/most significant first).
const highlightPriorityByType: Record<MemoryType, number> = {
  moved_in: 0,
  collection_complete: 1,
  rare_find: 2,
  bond_level: 3,
  days_milestone: 4,
  streak_milestone: 5,
  first_walk: 6,
  first_find: 7,
  first_treat: 8,
  theme_applied: 9,
  expression_pack: 10
};

/**
 * Picks the memories most worth surfacing in a monthly letter: milestones
 * first (moved_in, collection completion, rare finds, bond levels, days/streak
 * milestones), then everything else, newest first within each tier.
 */
export const getPetMemoryHighlights = (memories: MemoryEntry[], limit = 5): MemoryEntry[] =>
  [...memories]
    .sort((a, b) => {
      const priorityDiff = highlightPriorityByType[a.type] - highlightPriorityByType[b.type];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    })
    .slice(0, Math.max(0, limit));
