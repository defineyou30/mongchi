import type {
  CareStats,
  CompanionHabitHint,
  ExpressionPack,
  GeneratedAsset,
  GeneratedAssetId,
  Item,
  MemoryEntry,
  MemoryType,
  RelationshipState,
  WalkCollectionState
} from "@mongchi/shared";
import {
  buildMonthlyLetter,
  expressionPacks,
  getBondLevelFromXp,
  getBondProgressValue,
  getFavoriteTreatItemId,
  getRecentPetMemories,
  getWalkCollectionProgress,
  MONTHLY_LETTER_THRESHOLD_DAYS,
  walkCollectibles
} from "@mongchi/shared";

/**
 * Bond progress toward the next level is currently expressed 0-99 (see
 * relationship.ts's BOND_XP_PER_LEVEL = 100, kept private to that module) --
 * this mirrors that constant only for display math so the friend page never
 * shows a raw XP number, only a bar fraction + "Lv N".
 */
const BOND_PROGRESS_MAX = 100;

export interface FriendBondPresentation {
  level: number;
  progressFraction: number;
  levelLabel: string;
}

export const getFriendBondPresentation = (relationship: RelationshipState): FriendBondPresentation => {
  const level = getBondLevelFromXp(relationship.bondXp);
  const progressFraction = Math.max(0, Math.min(1, getBondProgressValue(relationship) / BOND_PROGRESS_MAX));

  return {
    level,
    progressFraction,
    levelLabel: `Lv ${level}`
  };
};

export interface FriendStreakPresentation {
  current: number;
  best: number;
  headline: string;
  subline: string;
}

/** Warm, non-guilt-tripping streak copy -- silence (0) reads as an invite, not a scold. */
export const getFriendStreakPresentation = (current: number, best: number): FriendStreakPresentation => {
  if (current <= 0) {
    return {
      current,
      best,
      headline: "Say hi today to start a new streak",
      subline: best > 0 ? `Best so far: ${best} day${best === 1 ? "" : "s"}` : "Every streak starts with one hello."
    };
  }

  return {
    current,
    best,
    headline: `You've said hi ${current} day${current === 1 ? "" : "s"} in a row`,
    subline: `Best streak: ${best} day${best === 1 ? "" : "s"}`
  };
};

export interface FriendWalkFindCell {
  id: string;
  found: boolean;
  emoji: string;
  name: string;
  count: number;
}

export interface FriendWalkCollectionPresentation {
  cells: FriendWalkFindCell[];
  found: number;
  total: number;
  progressLabel: string;
}

export const getFriendWalkCollectionPresentation = (collection: WalkCollectionState): FriendWalkCollectionPresentation => {
  const progress = getWalkCollectionProgress(collection);
  const cells = walkCollectibles.map((collectible) => {
    const entry = collection[collectible.id];
    const found = (entry?.count ?? 0) > 0;

    return {
      id: collectible.id,
      found,
      emoji: found ? collectible.emoji : "?",
      name: found ? collectible.nameEn : "???",
      count: entry?.count ?? 0
    };
  });

  return {
    cells,
    found: progress.found,
    total: progress.total,
    progressLabel: `${progress.found} of ${progress.total} found`
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days elapsed between `sinceIso` (the pet's profile createdAt -- the
 * "moved in" moment) and `nowIso`, floored and never negative so a
 * clock-skewed or same-day read still shows "Moved in today" instead of a
 * negative number.
 */
export const getDaysTogether = (sinceIso: string, nowIso: string): number => {
  const since = new Date(sinceIso).getTime();
  const now = new Date(nowIso).getTime();

  if (!Number.isFinite(since) || !Number.isFinite(now)) {
    return 0;
  }

  return Math.max(0, Math.floor((now - since) / DAY_MS));
};

export const getMovedInLine = (daysTogether: number): string => {
  if (daysTogether <= 0) {
    return "Moved in today";
  }

  return `Moved in ${daysTogether} day${daysTogether === 1 ? "" : "s"} ago`;
};

// --- Our little moments (memory album) --------------------------------

/** Max timeline rows rendered before the "and more moments together..." footline kicks in. */
export const MEMORY_TIMELINE_DISPLAY_LIMIT = 8;

/**
 * Small pixel-glyph badge per memory type -- deliberately plain unicode
 * (never emoji) so the album reads as part of the same pixel-UI language as
 * the rest of the friend page rather than borrowing platform emoji art.
 */
const memoryGlyphByType: Record<MemoryType, string> = {
  moved_in: "✦", // ✦
  first_walk: "▲", // ▲
  first_find: "◆", // ◆
  rare_find: "★", // ★
  collection_complete: "❈", // ❈
  bond_level: "♥", // ♥
  streak_milestone: "●", // ●
  days_milestone: "■", // ■
  first_treat: "✦", // ✦
  theme_applied: "❖", // ❖
  expression_pack: "☺" // ☺
};

export const getMemoryGlyph = (type: MemoryType): string => memoryGlyphByType[type];

/**
 * Relative day label for a memory timeline row -- "Today"/"Yesterday" read
 * warmer than a raw date, "N days ago" covers everything else. Pure function
 * of two ISO timestamps so it's trivially testable without faking the clock.
 */
export const getRelativeDayLabel = (occurredAtIso: string, nowIso: string): string => {
  const occurredMs = new Date(occurredAtIso).getTime();
  const nowMs = new Date(nowIso).getTime();

  if (!Number.isFinite(occurredMs) || !Number.isFinite(nowMs)) {
    return "Just now";
  }

  const occurredDay = Math.floor(occurredMs / DAY_MS);
  const nowDay = Math.floor(nowMs / DAY_MS);
  const daysAgo = Math.max(0, nowDay - occurredDay);

  if (daysAgo === 0) {
    return "Today";
  }

  if (daysAgo === 1) {
    return "Yesterday";
  }

  return `${daysAgo} days ago`;
};

export interface MemoryTimelineRow {
  id: string;
  type: MemoryType;
  glyph: string;
  line: string;
  dayLabel: string;
}

export interface FriendMemoryAlbumPresentation {
  rows: MemoryTimelineRow[];
  hasMore: boolean;
  /** True when there's only the single "moved_in" row (or nothing at all) -- the album would otherwise look bare. */
  isSparse: boolean;
  sparseLine: string;
}

const MEMORY_ALBUM_SPARSE_LINE = "More moments will find their way here.";

/**
 * Newest-first timeline for the "Our little moments" card, capped at
 * MEMORY_TIMELINE_DISPLAY_LIMIT rows. A brand-new owner only has the
 * "moved_in" entry -- that still renders as one real row (never a blank
 * card), plus a forward-looking "more moments will find their way here"
 * line so the card doesn't read as empty/broken.
 */
export const getFriendMemoryAlbumPresentation = (memories: MemoryEntry[], nowIso: string): FriendMemoryAlbumPresentation => {
  const recent = getRecentPetMemories(memories, MEMORY_TIMELINE_DISPLAY_LIMIT);
  const rows = recent.map((memory) => ({
    id: memory.id,
    type: memory.type,
    glyph: getMemoryGlyph(memory.type),
    line: memory.line,
    dayLabel: getRelativeDayLabel(memory.occurredAt, nowIso)
  }));

  return {
    rows,
    hasMore: memories.length > MEMORY_TIMELINE_DISPLAY_LIMIT,
    isSparse: rows.length <= 1,
    sparseLine: MEMORY_ALBUM_SPARSE_LINE
  };
};

export const MEMORY_ALBUM_FOOTLINE = "...and more moments together";

// --- Lately, {name}... (companion habit summary) -----------------------

/** One warm, present-tense line per habit hint -- never guilt-tripping, always reads as an observation. */
const habitHintLineByHint: Record<CompanionHabitHint, string> = {
  loves_playtime: "has been all about playtime lately",
  cuddle_bug: "has been extra snuggly lately",
  trail_buddy: "loves a good walk together",
  foodie: "never says no to a snack",
  chatterbox: "has so much to chat about lately",
  gentle_groomer: "always enjoys a good grooming session",
  green_thumb: "loves tending the garden",
  night_owl_rester: "has been savoring cozy rest lately"
};

const SETTLING_IN_LINE = "is still settling in and finding favorite things.";

/**
 * Habit line(s) for the "Lately, {name}..." card. Up to two hints are shown
 * (a favorite-action hint plus the volume-based trail_buddy hint can both
 * apply at once) -- with no hints yet (brand-new companion), a single
 * forward-looking "still settling in" line is shown instead.
 */
export const getCompanionHabitLines = (hints: CompanionHabitHint[]): string[] => {
  if (hints.length === 0) {
    return [SETTLING_IN_LINE];
  }

  return hints.slice(0, 2).map((hint) => habitHintLineByHint[hint]);
};

export interface FriendHabitSummaryPresentation {
  habitLines: string[];
  favoriteThingLine: string | null;
  favoriteTreatLine: string | null;
}

/**
 * Assembles the full "Lately, {name}..." card content: the habit line(s),
 * an optional "Always up for {favoriteThing}" line carried over from
 * onboarding, and an optional "Current favorite: {treat name}" line resolved
 * from the catalog. Any of the optional lines can be null (new owner with no
 * signal yet) -- callers render only what's present.
 */
export const getFriendHabitSummaryPresentation = (
  hints: CompanionHabitHint[],
  favoriteThing: string | undefined,
  favoriteTreatItemId: string | null,
  catalogItems: Item[]
): FriendHabitSummaryPresentation => {
  const trimmedFavoriteThing = favoriteThing?.trim();
  const favoriteTreatItem = favoriteTreatItemId ? catalogItems.find((item) => item.id === favoriteTreatItemId) ?? null : null;

  return {
    habitLines: getCompanionHabitLines(hints),
    favoriteThingLine: trimmedFavoriteThing ? `Always up for ${trimmedFavoriteThing}` : null,
    favoriteTreatLine: favoriteTreatItem ? `Current favorite: ${favoriteTreatItem.name}` : null
  };
};

// --- Monthly letter (30-day milestone) ----------------------------------

export type FriendMonthlyLetterStatus = "locked" | "arrived" | "opened";

export interface FriendMonthlyLetterPresentation {
  status: FriendMonthlyLetterStatus;
  /** Full letter text -- only present once daysTogether has reached the threshold. */
  letterText: string | null;
  /** Locked-preview copy shown before day 30 ("Day {n} of 30" progress read, no countdown framing). */
  previewLine: string;
  progressLabel: string;
}

const MONTHLY_LETTER_LOCKED_PREVIEW_LINE = "A letter is on its way -- arriving on day 30.";
const MONTHLY_LETTER_ARRIVED_LINE = "A letter has arrived. Open it whenever you're ready.";

/**
 * Assembles the friend page's monthly-letter card. Three states:
 * - "locked": before day 30, a sealed-envelope preview with a "Day n of 30"
 *   progress read (no countdown/number-heavy framing beyond that one line).
 * - "arrived": day 30 reached but `hasOpened` is still false -- the letter
 *   text already exists (so the card can offer to open it) but isn't shown
 *   until the owner taps "Open".
 * - "opened": `hasOpened` is true -- the letter is always shown in full and
 *   stays readable on every future visit (letterText is never cleared).
 */
export const getFriendMonthlyLetterPresentation = (
  input: {
    petName: string;
    memories: readonly MemoryEntry[];
    careStats: CareStats;
    favoriteThing?: string | null | undefined;
    catalogItems: Item[];
    daysTogether: number;
    now: string;
  },
  hasOpened: boolean
): FriendMonthlyLetterPresentation => {
  const favoriteTreatItemId = getFavoriteTreatItemId(input.careStats);
  const favoriteTreatItem = favoriteTreatItemId ? input.catalogItems.find((item) => item.id === favoriteTreatItemId) ?? null : null;

  const letterText = buildMonthlyLetter({
    petName: input.petName,
    memories: input.memories,
    careStats: input.careStats,
    favoriteThing: input.favoriteThing,
    favoriteTreatName: favoriteTreatItem?.name ?? null,
    daysTogether: input.daysTogether,
    now: input.now
  });

  const progressLabel = `Day ${Math.min(input.daysTogether, MONTHLY_LETTER_THRESHOLD_DAYS)} of ${MONTHLY_LETTER_THRESHOLD_DAYS}`;

  if (!letterText) {
    return {
      status: "locked",
      letterText: null,
      previewLine: MONTHLY_LETTER_LOCKED_PREVIEW_LINE,
      progressLabel
    };
  }

  return {
    status: hasOpened ? "opened" : "arrived",
    letterText,
    previewLine: MONTHLY_LETTER_ARRIVED_LINE,
    progressLabel
  };
};

// --- Poses gallery (expression pack sales surface) ----------------------

export type FriendPoseCellStatus = "owned" | "locked";

export interface FriendPoseCell {
  state: GeneratedAssetState;
  status: FriendPoseCellStatus;
  /** Present only for an owned pose -- id/uri to render via GeneratedPetAssetImage. */
  assetId: GeneratedAssetId | null;
}

export type FriendPoseCardStatus = "available" | "purchasing" | "failed";

export interface FriendPoseCard {
  packId: string;
  nameEn: string;
  creditCost: number;
  status: FriendPoseCardStatus;
  /** "See more of {name} -- Everyday Moments · 12cr" style label for the Unlock card. */
  label: string;
  /** Soft-progress line shown while a purchase is mid-flight (e.g. "New moments are on their way..."). */
  progressLine: string | null;
  /** Warm retry line shown after a failed purchase attempt. */
  failureLine: string | null;
}

export interface FriendPoseGalleryPresentation {
  cells: FriendPoseCell[];
  /** One card per not-yet-fully-owned pack -- absent once every state in a pack has a matching asset. */
  cards: FriendPoseCard[];
}

type GeneratedAssetState = GeneratedAsset["state"];

/**
 * Builds the friend page's "Poses" gallery: every generated-asset state the
 * pet could ever have renders as one cell, either the real thumbnail (owned)
 * or a "?" silhouette (locked). Below the grid, one card per expression pack
 * that isn't fully unlocked yet offers the purchase -- a pack already fully
 * represented in acceptedAssets (its states all have matching cells) simply
 * has no card, since there's nothing left to sell. purchaseStatusByPackId
 * only needs entries for packs actively purchasing/failed; a pack absent
 * from it (or an id with no owned states yet) reads as "available".
 */
export const getFriendPoseGalleryPresentation = (
  acceptedAssets: readonly GeneratedAsset[],
  petName: string,
  purchaseStatusByPackId: Partial<Record<string, { status: "pending" | "failed"; failureMessageSafe?: string }>> = {}
): FriendPoseGalleryPresentation => {
  const assetByState = new Map(acceptedAssets.map((asset) => [asset.state, asset]));

  const cells: FriendPoseCell[] = Array.from(assetByState.values()).map((asset) => ({
    state: asset.state,
    status: "owned" as const,
    assetId: asset.id
  }));

  // Every pack state not already owned gets a locked silhouette cell too, so
  // the grid always previews the full breadth of expressions on offer.
  const lockedStates = new Set<GeneratedAssetState>();

  for (const pack of expressionPacks as readonly ExpressionPack[]) {
    for (const state of pack.states) {
      if (!assetByState.has(state)) {
        lockedStates.add(state);
      }
    }
  }

  for (const state of lockedStates) {
    cells.push({ state, status: "locked", assetId: null });
  }

  const cards: FriendPoseCard[] = [];

  for (const pack of expressionPacks as readonly ExpressionPack[]) {
    const alreadyUnlocked = pack.states.every((state) => assetByState.has(state));

    if (alreadyUnlocked) {
      continue;
    }

    const purchaseStatus = purchaseStatusByPackId[pack.id];
    const status: FriendPoseCardStatus =
      purchaseStatus?.status === "pending" ? "purchasing" : purchaseStatus?.status === "failed" ? "failed" : "available";

    cards.push({
      packId: pack.id,
      nameEn: pack.nameEn,
      creditCost: pack.creditCost,
      status,
      label: `See more of ${petName} — ${pack.nameEn} · ${pack.creditCost}cr`,
      progressLine: status === "purchasing" ? "New moments are on their way..." : null,
      failureLine:
        status === "failed"
          ? (purchaseStatus?.failureMessageSafe ?? "That didn't quite work. Let's try again.")
          : null
    });
  }

  return { cells, cards };
};

/** One-shot HomeEventToast line for a completed expression pack purchase. */
export const getExpressionPackUnlockedToastLine = (petName: string): string => `${petName} learned some new expressions!`;

// --- Pose gallery reveal showcase (post-unlock stagger + one-shot banner) ---

/**
 * States newly present in `currentOwnedStates` that were absent from
 * `previousOwnedStates` -- drives the friend page's stagger-reveal
 * showcase so only the cells that just unlocked play the fade+scale-in,
 * never the whole grid. Order follows `currentOwnedStates` (which itself
 * follows acceptedAssets insertion order) so the stagger reads left-to-right
 * the same way the grid renders.
 */
export const getNewlyRevealedPoseStates = (
  previousOwnedStates: readonly GeneratedAssetState[],
  currentOwnedStates: readonly GeneratedAssetState[]
): GeneratedAssetState[] => {
  const previousSet = new Set(previousOwnedStates);

  return currentOwnedStates.filter((state) => !previousSet.has(state));
};

const SMALL_COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Spells out small counts ("Three new sides...") to match the app's existing milestone-copy voice; falls back to digits past ten. */
const spellOutCount = (count: number): string => SMALL_COUNT_WORDS[count] ?? String(count);

/**
 * One-shot banner line shown above the poses gallery the first time a batch
 * of new expressions reveals itself -- warm and specific ("Three new sides
 * of Momo.") rather than a generic "unlocked!" toast. Callers gate actual
 * one-shot-ness via getPoseRevealPersistedKey + AsyncStorage, matching the
 * house pattern used for the monthly letter / event toast dedup keys.
 */
export const getPoseRevealBannerLine = (petName: string, revealedCount: number): string | null => {
  if (revealedCount <= 0) {
    return null;
  }

  const countWord = spellOutCount(revealedCount);
  const capitalizedCountWord = countWord.charAt(0).toUpperCase() + countWord.slice(1);
  const noun = revealedCount === 1 ? "side" : "sides";

  return `${capitalizedCountWord} new ${noun} of ${petName}.`;
};

/** AsyncStorage key suffix for "has this pack's reveal showcase already played once" -- mirrors getExpressionPackToastPersistedKey's shape. */
export const getPoseRevealPersistedKey = (packId: string): string => `pose-reveal:${packId}`;
