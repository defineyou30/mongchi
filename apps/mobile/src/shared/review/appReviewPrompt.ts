import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

import { getCalendarDaysBetween } from "@mongchi/shared";

/**
 * SKStoreReviewController etiquette, run through our own more conservative
 * budget than the OS itself enforces (Apple/Google throttle silently, and
 * neither tells us whether a dialog actually rendered): ask at most
 * MAX_APP_REVIEW_PROMPTS_TOTAL times ever, at least MIN_DAYS_BETWEEN_APP_REVIEW_PROMPTS
 * days apart (roughly a 365/3 split, kept a little wider on purpose), never
 * before the pet has been around MIN_DAYS_TOGETHER_FOR_APP_REVIEW days, and
 * only from a positive moment in the app (see AppReviewTrigger) -- never
 * after a failure, an error state, or anything that could read as
 * guilt-tripping.
 *
 * shouldRequestAppReview is the pure gate (now/history injected, fully
 * testable). maybeRequestAppReview wraps it with the real AsyncStorage
 * history and the actual expo-store-review call -- call that one from a
 * screen; call the pure one from tests.
 */

/** Every positive in-app moment this prompt is allowed to piggyback on. Deliberately never includes anything negative (a claim failure, an error toast, a churny screen). */
export type AppReviewTrigger = "streak_reward_claimed" | "monthly_letter_opened";

/** Persisted, cross-session record of every past prompt attempt (oldest first). */
export interface AppReviewPromptHistory {
  readonly promptedAt: readonly string[];
}

export const emptyAppReviewPromptHistory: AppReviewPromptHistory = { promptedAt: [] };

/** A brand-new pet hasn't earned an opinion of the app yet. */
export const MIN_DAYS_TOGETHER_FOR_APP_REVIEW = 3;
/** Roughly a 365/3 split, kept conservatively wider than the bare minimum. */
export const MIN_DAYS_BETWEEN_APP_REVIEW_PROMPTS = 122;
/** Never ask more than this many times across the app's whole lifetime on a device, regardless of how long it's been used. */
export const MAX_APP_REVIEW_PROMPTS_TOTAL = 3;

export interface ShouldRequestAppReviewInput {
  /** ISO timestamp for "now" -- injected so tests never depend on the real clock. */
  readonly now: string;
  /** Days since the active pet moved in (see friendProfilePresentation.ts's getDaysTogether). */
  readonly daysTogether: number;
  readonly history: AppReviewPromptHistory;
}

/** Pure gate: true if every condition is met and a prompt should be shown right now. */
export const shouldRequestAppReview = (input: ShouldRequestAppReviewInput): boolean => {
  const { now, daysTogether, history } = input;

  if (daysTogether < MIN_DAYS_TOGETHER_FOR_APP_REVIEW) {
    return false;
  }

  if (history.promptedAt.length >= MAX_APP_REVIEW_PROMPTS_TOTAL) {
    return false;
  }

  const lastPromptedAt = history.promptedAt[history.promptedAt.length - 1];

  if (lastPromptedAt && getCalendarDaysBetween(lastPromptedAt, now) < MIN_DAYS_BETWEEN_APP_REVIEW_PROMPTS) {
    return false;
  }

  return true;
};

/** Appends a new prompt timestamp to history -- pure, never mutates the input. */
export const recordAppReviewPrompt = (history: AppReviewPromptHistory, promptedAtIso: string): AppReviewPromptHistory => ({
  promptedAt: [...history.promptedAt, promptedAtIso]
});

const APP_REVIEW_PROMPT_HISTORY_STORAGE_KEY = "mongchi.review.promptHistory.v1";

const readPromptHistory = async (): Promise<AppReviewPromptHistory> => {
  try {
    const raw = await AsyncStorage.getItem(APP_REVIEW_PROMPT_HISTORY_STORAGE_KEY);

    if (!raw) {
      return emptyAppReviewPromptHistory;
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed?.promptedAt)
      ? { promptedAt: parsed.promptedAt.filter((value: unknown): value is string => typeof value === "string") }
      : emptyAppReviewPromptHistory;
  } catch {
    // Silent: worst case the gate forgets older history and offers a prompt again sooner than intended.
    return emptyAppReviewPromptHistory;
  }
};

const writePromptHistory = async (history: AppReviewPromptHistory): Promise<void> => {
  try {
    await AsyncStorage.setItem(APP_REVIEW_PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Silent: worst case this prompt isn't remembered and the gate offers one again sooner than intended.
  }
};

export interface MaybeRequestAppReviewOptions {
  /** Days since the active pet moved in -- callers that don't have this handy should gate it themselves before ever calling this function (see RewardClaimOverlay). */
  readonly daysTogether: number;
  /** Injectable for tests; defaults to the real current time. */
  readonly now?: string;
}

/**
 * Runs the full gate + persistence + native-prompt flow for one positive
 * moment. Safe to call from any positive moment in the app -- resolves
 * without doing anything when the gate says no (too soon, budget exhausted,
 * pet too new) or when the platform has nothing to show
 * (isAvailableAsync false, e.g. TestFlight/simulator/web). History is
 * recorded as soon as the gate passes and we decide to ask, not only once
 * the OS confirms a dialog rendered -- nobody, including Apple/Google's own
 * API, can observe whether the native sheet actually appeared or was
 * silently throttled, so "we asked" is the most honest thing this module can
 * track.
 */
export const maybeRequestAppReview = async (
  // Not read below -- its whole job is restricting call sites to positive
  // moments at the type level (see AppReviewTrigger's doc comment). Kept as
  // a required argument (rather than dropped) so every call site reads as
  // self-documenting about *why* it's asking.
  trigger: AppReviewTrigger,
  options: MaybeRequestAppReviewOptions
): Promise<void> => {
  void trigger;
  const now = options.now ?? new Date().toISOString();
  const history = await readPromptHistory();

  if (!shouldRequestAppReview({ now, daysTogether: options.daysTogether, history })) {
    return;
  }

  await writePromptHistory(recordAppReviewPrompt(history, now));

  try {
    const isAvailable = await StoreReview.isAvailableAsync();

    if (isAvailable) {
      await StoreReview.requestReview();
    }
  } catch {
    // Silent: a review-prompt failure should never surface to the user.
  }
};
