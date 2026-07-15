import { getLocalDayKey } from "@mongchi/shared";
import type { CareActionType, ItemId } from "@mongchi/shared";

/** The three "today's care" actions that together earn the daily snack -- feed, play, and a gentle hello (affection). Walk/talk/rest/water_garden/clean/treat don't count toward this one. */
export type CoreCareAction = Extract<CareActionType, "feed" | "play" | "affection">;

const CORE_CARE_ACTIONS: readonly CoreCareAction[] = ["feed", "play", "affection"];

const isCoreCareAction = (action: CareActionType): action is CoreCareAction =>
  (CORE_CARE_ACTIONS as readonly CareActionType[]).includes(action);

export interface DailyCareProgress {
  readonly dayKey: string;
  readonly completedActions: readonly CoreCareAction[];
}

export const createEmptyDailyCareProgress = (dayKey: string): DailyCareProgress => ({ dayKey, completedActions: [] });

/**
 * Records that `action` happened at `now`, rolling over to a fresh day's
 * progress first if the local day changed since `progress` was last touched
 * (so a snack from yesterday can never carry over and no new-day reset needs
 * its own separate call site). `justCompletedAllToday` is true exactly once
 * per day -- the transition where the third distinct core action lands --
 * never true again that same day even if the owner keeps feeding/playing.
 */
export const recordCoreCareAction = (
  progress: DailyCareProgress,
  action: CareActionType,
  now: string
): { progress: DailyCareProgress; justCompletedAllToday: boolean } => {
  const todayKey = getLocalDayKey(now);
  const current = progress.dayKey === todayKey ? progress : createEmptyDailyCareProgress(todayKey);

  if (!isCoreCareAction(action) || current.completedActions.includes(action)) {
    return { progress: current, justCompletedAllToday: false };
  }

  const nextCompleted = [...current.completedActions, action];
  const nextProgress: DailyCareProgress = { dayKey: todayKey, completedActions: nextCompleted };
  const justCompletedAllToday = nextCompleted.length === CORE_CARE_ACTIONS.length;

  return { progress: nextProgress, justCompletedAllToday };
};

/** Local-only dedupe key for the daily treat reward (no server RPC -- see rewards budget's "데일리=간식, 크레딧=기념일" principle). Distinct per local day, so a claim already granted today never re-queues. */
export const getDailyTreatRewardKey = (dayKey: string): string => `daily_treat_${dayKey}`;

/**
 * Common snack pool the daily treat is drawn from -- ids already used
 * elsewhere as warm, everyday reward items (bondRewards.ts/careStreak.ts),
 * kept deliberately "common" tier rather than anything premium/rare.
 */
const COMMON_DAILY_TREAT_POOL: readonly ItemId[] = [
  "item_apple_biscuit",
  "item_bone_biscuit",
  "item_salmon_bites",
  "item_duck_biscuit",
  "item_berry_yogurt",
  "item_cheese_puff"
];

/** Small, deterministic string hash (djb2) -- good enough for picking a stable-per-day index, not for anything security-sensitive. */
const hashString = (value: string): number => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return hash >>> 0;
};

/** Picks today's common treat deterministically from `dayKey` -- same day always yields the same item, so a re-render or app restart before claiming never changes what's offered. */
export const pickDailyTreatItemId = (dayKey: string): ItemId => {
  const index = hashString(dayKey) % COMMON_DAILY_TREAT_POOL.length;

  return COMMON_DAILY_TREAT_POOL[index]!;
};
