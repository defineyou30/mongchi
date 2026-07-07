import type { ISODateTime } from "./common";
import type { CareActionType, CareState } from "./care";
import { getLocalDayKey } from "./careStreak";

/**
 * Raw counters behind "individuality" -- which care actions and treats a
 * given owner reaches for most. Pure accumulation only; deriving a
 * personality-flavored read (favorite action, habit hints) is done by the
 * getters below so future waves (dialogue branching, friend-page copy) can
 * add new derivations without touching how the counts are collected.
 */
export interface CareStats {
  actionCounts: Partial<Record<CareActionType, number>>;
  treatItemCounts: Record<string, number>;
  walkCount: number;
  totalCareActions: number;
  /**
   * Daily bond-XP farming guards for treat/talk (see mongchi "케어 체감 밸런스"
   * fix). Optional so existing persisted saves without them default to "no
   * XP granted yet today" on read -- no schema version bump needed. The stat
   * / mood effects of these actions are never gated, only the bond XP.
   */
  treatXpDayKey?: string;
  treatXpCountToday?: number;
  talkXpDayKey?: string;
  talkXpCountToday?: number;
  /**
   * Same guard for play: purchased toys (e.g. Buddy Plush) can bypass the
   * base play cooldown entirely (see terrariumHomeInteractionContract.ts), so
   * without a daily cap here a special toy would let bond XP be farmed at
   * button-mash speed. Stat/mood effects are never gated, only the bond XP.
   */
  playXpDayKey?: string;
  playXpCountToday?: number;
}

export const createInitialCareStats = (): CareStats => ({
  actionCounts: {},
  treatItemCounts: {},
  walkCount: 0,
  totalCareActions: 0
});

/** Daily bond-XP farming caps: after this many XP-earning uses in a local day, further uses still land (stats/mood) but stop granting bond XP. */
export const TREAT_BOND_XP_DAILY_CAP = 3;
export const TALK_BOND_XP_DAILY_CAP = 10;
/**
 * Play's cooldown can be bypassed entirely with a purchased toy (e.g. Buddy
 * Plush), so this cap is the only farming guard left for play -- set above
 * the base rhythm cadence (20-minute cooldown, ~3 uses in an active hour) to
 * still feel generous for normal play sessions.
 */
export const PLAY_BOND_XP_DAILY_CAP = 5;

type XpDailyCounterField = "treatXpDayKey" | "talkXpDayKey" | "playXpDayKey";
type XpDailyCountField = "treatXpCountToday" | "talkXpCountToday" | "playXpCountToday";

const getXpUsesToday = (stats: CareStats, dayKeyField: XpDailyCounterField, countField: XpDailyCountField, now: ISODateTime): number => {
  const todayKey = getLocalDayKey(now);

  return stats[dayKeyField] === todayKey ? stats[countField] ?? 0 : 0;
};

/** Whether a treat performed `now` should still grant bond XP under the daily cap. */
export const shouldGrantTreatBondXp = (stats: CareStats, now: ISODateTime): boolean =>
  getXpUsesToday(stats, "treatXpDayKey", "treatXpCountToday", now) < TREAT_BOND_XP_DAILY_CAP;

/** Whether a talk performed `now` should still grant bond XP under the daily cap. */
export const shouldGrantTalkBondXp = (stats: CareStats, now: ISODateTime): boolean =>
  getXpUsesToday(stats, "talkXpDayKey", "talkXpCountToday", now) < TALK_BOND_XP_DAILY_CAP;

/** Whether a play performed `now` should still grant bond XP under the daily cap. */
export const shouldGrantPlayBondXp = (stats: CareStats, now: ISODateTime): boolean =>
  getXpUsesToday(stats, "playXpDayKey", "playXpCountToday", now) < PLAY_BOND_XP_DAILY_CAP;

/**
 * Call once per treat given, after deciding (via shouldGrantTreatBondXp)
 * whether XP was actually granted this time -- the counter still advances
 * either way so a burst of treats past the cap doesn't quietly "unlock" more
 * XP once the day rolls over mid-burst.
 */
export const bumpTreatXpCounter = (stats: CareStats, now: ISODateTime): CareStats => {
  const todayKey = getLocalDayKey(now);
  const usesToday = getXpUsesToday(stats, "treatXpDayKey", "treatXpCountToday", now);

  return {
    ...stats,
    treatXpDayKey: todayKey,
    treatXpCountToday: usesToday + 1
  };
};

/** Call once per talk performed, mirroring bumpTreatXpCounter. */
export const bumpTalkXpCounter = (stats: CareStats, now: ISODateTime): CareStats => {
  const todayKey = getLocalDayKey(now);
  const usesToday = getXpUsesToday(stats, "talkXpDayKey", "talkXpCountToday", now);

  return {
    ...stats,
    talkXpDayKey: todayKey,
    talkXpCountToday: usesToday + 1
  };
};

/** Call once per play performed, mirroring bumpTreatXpCounter. */
export const bumpPlayXpCounter = (stats: CareStats, now: ISODateTime): CareStats => {
  const todayKey = getLocalDayKey(now);
  const usesToday = getXpUsesToday(stats, "playXpDayKey", "playXpCountToday", now);

  return {
    ...stats,
    playXpDayKey: todayKey,
    playXpCountToday: usesToday + 1
  };
};

/** Call once per care action performed. Pass `treatItemId` when `action` is "treat". */
export const bumpCareStats = (stats: CareStats, action: CareActionType, treatItemId?: string): CareStats => {
  const nextActionCounts = {
    ...stats.actionCounts,
    [action]: (stats.actionCounts[action] ?? 0) + 1
  };
  const nextTreatItemCounts =
    action === "treat" && treatItemId
      ? {
          ...stats.treatItemCounts,
          [treatItemId]: (stats.treatItemCounts[treatItemId] ?? 0) + 1
        }
      : stats.treatItemCounts;

  return {
    // Preserve the optional daily XP-cap counters (treatXpDayKey/
    // treatXpCountToday/talkXpDayKey/talkXpCountToday/playXpDayKey/
    // playXpCountToday) -- this used to be a plain object literal that
    // silently dropped any field not listed below.
    ...stats,
    actionCounts: nextActionCounts,
    treatItemCounts: nextTreatItemCounts,
    walkCount: action === "walk" ? stats.walkCount + 1 : stats.walkCount,
    totalCareActions: stats.totalCareActions + 1
  };
};

/** The most-performed care action, or null if there's no clear favorite (no actions yet, or a tie). */
export const getFavoriteCareAction = (stats: CareStats): CareActionType | null => {
  const entries = Object.entries(stats.actionCounts) as Array<[CareActionType, number]>;

  if (entries.length === 0) {
    return null;
  }

  const maxCount = Math.max(...entries.map(([, count]) => count));
  const topEntries = entries.filter(([, count]) => count === maxCount);

  if (topEntries.length !== 1 || maxCount === 0) {
    return null;
  }

  return topEntries[0]![0];
};

/** The most-gifted treat item id, or null if none have been given yet (ties resolve to the first counted). */
export const getFavoriteTreatItemId = (stats: CareStats): string | null => {
  const entries = Object.entries(stats.treatItemCounts);

  if (entries.length === 0) {
    return null;
  }

  const maxCount = Math.max(...entries.map(([, count]) => count));
  const top = entries.find(([, count]) => count === maxCount);

  return top ? top[0] : null;
};

/**
 * Derived "habit" identifiers from accumulated care patterns -- the raw
 * material later waves use to branch dialogue/copy per-owner. Multiple hints
 * can apply at once (e.g. a favorite action hint plus a volume-based one).
 */
export type CompanionHabitHint =
  | "loves_playtime"
  | "cuddle_bug"
  | "trail_buddy"
  | "foodie"
  | "chatterbox"
  | "gentle_groomer"
  | "green_thumb"
  | "night_owl_rester";

const habitHintByFavoriteAction: Partial<Record<CareActionType, CompanionHabitHint>> = {
  play: "loves_playtime",
  affection: "cuddle_bug",
  feed: "foodie",
  talk: "chatterbox",
  clean: "gentle_groomer",
  water_garden: "green_thumb",
  rest: "night_owl_rester"
};

const TRAIL_BUDDY_WALK_THRESHOLD = 10;

export const getCompanionHabitHints = (stats: CareStats, _careState?: CareState): CompanionHabitHint[] => {
  const hints: CompanionHabitHint[] = [];
  const favoriteAction = getFavoriteCareAction(stats);
  const favoriteHint = favoriteAction ? habitHintByFavoriteAction[favoriteAction] : undefined;

  if (favoriteHint) {
    hints.push(favoriteHint);
  }

  if (stats.walkCount >= TRAIL_BUDDY_WALK_THRESHOLD && !hints.includes("trail_buddy")) {
    hints.push("trail_buddy");
  }

  return hints;
};
