import type { ISODateTime, ItemId, Locale } from "./common";

export const DAILY_FREE_CHAT_TICKETS = 3;

/** Every 3rd streak day brings home a snack; every 7th brings a special one. */
export const STREAK_SNACK_ITEM_ID: ItemId = "item_apple_biscuit";
export const STREAK_SPECIAL_SNACK_ITEM_ID: ItemId = "item_milk_pup_cup";

export interface CareStreakState {
  current: number;
  best: number;
  lastCareDayKey: string | null;
  updatedAt: ISODateTime;
  /**
   * When the streak's one-day grace last kicked in (see updateCareStreakOnCare).
   * Optional so existing persisted saves without it default to "never used" on
   * migration. Gates re-use: grace is only available again once 7 days have
   * passed since this timestamp.
   */
  graceUsedAt?: ISODateTime | null;
}

/** Minimum spacing between two grace uses -- see updateCareStreakOnCare. */
const GRACE_COOLDOWN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day key (device timezone) so a "day" matches what the user sees. */
export const getLocalDayKey = (now: ISODateTime): string => {
  const date = new Date(now);

  if (!Number.isFinite(date.getTime())) {
    return "invalid";
  }

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

export const createInitialCareStreak = (now: ISODateTime): CareStreakState => ({
  current: 0,
  best: 0,
  lastCareDayKey: null,
  updatedAt: now,
  graceUsedAt: null
});

/** Whole local-calendar days between two day keys (both parsed at local midnight). */
const daysBetweenDayKeys = (earlierKey: string, laterKey: string): number => {
  const earlier = new Date(`${earlierKey}T00:00:00.000`).getTime();
  const later = new Date(`${laterKey}T00:00:00.000`).getTime();

  return Math.round((later - earlier) / DAY_MS);
};

/**
 * Call on every care action; counts at most one streak step per local day.
 *
 * Grace policy (one skipped day forgiven, at most once every 7 days): if
 * exactly one calendar day was skipped since the last care day, the streak
 * still advances (keeps counting up) instead of resetting to 1, *unless* the
 * grace was already used within the last GRACE_COOLDOWN_DAYS -- in that case
 * it resets as normal. Skipping two or more days always resets, regardless of
 * grace availability.
 */
export const updateCareStreakOnCare = (state: CareStreakState, now: ISODateTime): CareStreakState => {
  const todayKey = getLocalDayKey(now);

  if (state.lastCareDayKey === todayKey) {
    return { ...state, updatedAt: now };
  }

  const yesterdayKey = getLocalDayKey(new Date(new Date(now).getTime() - DAY_MS).toISOString());

  if (state.lastCareDayKey === yesterdayKey) {
    const current = state.current + 1;

    return {
      current,
      best: Math.max(state.best, current),
      lastCareDayKey: todayKey,
      updatedAt: now,
      graceUsedAt: state.graceUsedAt ?? null
    };
  }

  const skippedDays = state.lastCareDayKey ? daysBetweenDayKeys(state.lastCareDayKey, todayKey) : Infinity;
  const graceCooldownElapsed =
    !state.graceUsedAt || daysBetweenDayKeys(getLocalDayKey(state.graceUsedAt), todayKey) >= GRACE_COOLDOWN_DAYS;

  if (state.current > 0 && skippedDays === 2 && graceCooldownElapsed) {
    const current = state.current + 1;

    return {
      current,
      best: Math.max(state.best, current),
      lastCareDayKey: todayKey,
      updatedAt: now,
      graceUsedAt: now
    };
  }

  return {
    current: 1,
    best: Math.max(state.best, 1),
    lastCareDayKey: todayKey,
    updatedAt: now,
    graceUsedAt: state.graceUsedAt ?? null
  };
};

/** True when the most recent updateCareStreakOnCare call consumed the grace (for a "kept your streak warm" callout). */
export const didStreakJustUseGrace = (previous: CareStreakState, next: CareStreakState): boolean =>
  next.graceUsedAt !== null && next.graceUsedAt !== undefined && next.graceUsedAt !== previous.graceUsedAt;

export interface CareStreakSnackReward {
  itemId: ItemId;
  special: boolean;
}

/**
 * Pure lookup: does reaching `current` streak days earn a snack? Called only
 * at the moment a streak actually advances (via updateCareStreakOnCare), so
 * a day that merely repeats the same streak count never re-grants.
 * Every 7th day is its own milestone (special snack) independent of the
 * every-3rd-day plain snack -- the two cadences don't need to share a day to
 * both fire, but when they do coincide (day 21, 42, ...) the special snack
 * wins so only one item is granted that day.
 */
export const getCareStreakSnackReward = (current: number): CareStreakSnackReward | null => {
  if (current <= 0) {
    return null;
  }

  if (current % 7 === 0) {
    return { itemId: STREAK_SPECIAL_SNACK_ITEM_ID, special: true };
  }

  if (current % 3 === 0) {
    return { itemId: STREAK_SNACK_ITEM_ID, special: false };
  }

  return null;
};

/**
 * Display-time projection: a streak silently drops to 0 once a full local day
 * is skipped -- *unless* exactly one day was skipped and the one-day grace is
 * still available (not used within the last GRACE_COOLDOWN_DAYS), in which
 * case the streak stays displayed as-is. The grace itself is only actually
 * recorded (graceUsedAt stamped) the moment the user returns and cares again,
 * via updateCareStreakOnCare -- this projection never mutates graceUsedAt, it
 * only avoids showing a scary premature reset while grace is still on offer.
 */
export const projectCareStreakForNow = (state: CareStreakState, now: ISODateTime): CareStreakState => {
  if (!state.lastCareDayKey || state.current === 0) {
    return state;
  }

  const todayKey = getLocalDayKey(now);
  const yesterdayKey = getLocalDayKey(new Date(new Date(now).getTime() - DAY_MS).toISOString());

  if (state.lastCareDayKey === todayKey || state.lastCareDayKey === yesterdayKey) {
    return state;
  }

  const skippedDays = daysBetweenDayKeys(state.lastCareDayKey, todayKey);
  const graceCooldownElapsed =
    !state.graceUsedAt || daysBetweenDayKeys(getLocalDayKey(state.graceUsedAt), todayKey) >= GRACE_COOLDOWN_DAYS;

  if (skippedDays === 2 && graceCooldownElapsed) {
    return state;
  }

  return { ...state, current: 0 };
};

/** True when the streak already counted a care action today. */
export const hasCaredToday = (state: CareStreakState, now: ISODateTime): boolean =>
  state.lastCareDayKey === getLocalDayKey(now);

/**
 * Warm, guilt-free one-time callout for a return session where the one-day
 * grace just kicked in (see didStreakJustUseGrace). Pure presentation only --
 * no wiring to a toast/home surface here; callers decide when/where to show
 * it (kept separate so this stays testable without a UI harness).
 */
export const getStreakGraceReturnLine = (petName: string, locale: Locale = "en-US"): string => {
  const fallbackNameByLocale: Record<Locale, string> = {
    "en-US": "Your pet",
    "ko-KR": "친구",
    "ja-JP": "おともだち",
    "zh-TW": "你的小夥伴",
    "de-DE": "Dein Liebling",
    "fr-FR": "Votre compagnon",
    "pt-BR": "Seu companheiro",
    "es-MX": "Tu compañero"
  };
  const name = petName.trim() || fallbackNameByLocale[locale];
  const lineByLocale: Record<Locale, string> = {
    "en-US": `${name} kept your streak warm while you were away.`,
    "ko-KR": `${name}가 네가 없는 동안 연속 돌봄을 포근하게 지켜줬어.`,
    "ja-JP": `${name}が留守の間も連続記録をあたためてくれたよ。`,
    "zh-TW": `${name}在你不在時替你守住了溫暖的連續紀錄。`,
    "de-DE": `${name} hat deine Serie warmgehalten, während du weg warst.`,
    "fr-FR": `${name} a gardé votre série bien au chaud pendant votre absence.`,
    "pt-BR": `${name} manteve sua sequência aquecida enquanto você estava fora.`,
    "es-MX": `${name} mantuvo cálida tu racha mientras no estabas.`
  };

  return lineByLocale[locale];
};
