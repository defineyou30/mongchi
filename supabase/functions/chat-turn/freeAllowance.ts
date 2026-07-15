// Pure free-chat-turn allowance math -- extracted from index.ts's
// fetchFreeChatTurns so it's testable without a live SupabaseClient (mirrors
// purchase-chat-pass/purchasePlan.ts's split of pure logic from the HTTP
// handler, and delete-account/deletionPlan.ts's "never triggers index.ts's
// top-level Deno.serve(...)" testing pattern).
//
// Server truth for the "free chats remaining" count shown by the mobile
// chip/pip UI: chat_access has two independent free-allowance sources
// (0014_chat_turn_guardrails.sql) -- a lifetime `starter_free_remaining`
// counter, and a once-per-UTC-day `daily_free_on` marker. Before this module
// existed, fetchFreeChatTurns only read starter_free_remaining, so once the
// starter allowance ran low the chip undercounted by exactly the still-
// available daily turn.
//
// Mirrors packages/shared/src/domain/chatFreeAllowance.ts's
// computeFreeChatTurnsRemaining/isDailyFreeChatAvailable exactly. That npm
// workspace package cannot be imported into this Deno Edge Function (separate
// runtime, no bundler step), so this logic is intentionally duplicated rather
// than shared -- both copies must be kept in sync by hand. If you change one,
// change the other.
//
// Mirrors 0014_chat_turn_guardrails.sql's reserve_chat_turn day-boundary
// check: `v_access.daily_free_on IS DISTINCT FROM current_date`. Postgres's
// current_date evaluates in the database session's timezone, which Supabase
// leaves at its default of UTC (no timezone override anywhere in
// supabase/config.toml or these migrations) -- so this compares UTC calendar
// dates, not any local calendar date.

/** chat_access's column default (0014_chat_turn_guardrails.sql) for a user whose chat_access row hasn't been created yet -- created lazily by reserve_chat_turn on their very first chat turn. */
export const DEFAULT_STARTER_FREE_REMAINING = 3;

export interface ChatFreeAllowanceRow {
  /** chat_access.starter_free_remaining -- a lifetime allowance, not a daily one. */
  starterFreeRemaining: number;
  /** chat_access.daily_free_on, a DATE string (e.g. "2026-07-14"), or null if the daily free chat has never been used. */
  dailyFreeOn: string | null;
}

/** UTC calendar date (YYYY-MM-DD) for an ISO instant -- matches Postgres's current_date under Supabase's UTC session timezone. */
export const getUtcDateKey = (nowIso: string): string => nowIso.slice(0, 10);

/** Mirrors reserve_chat_turn's `daily_free_on IS DISTINCT FROM current_date` gate: true when today's daily free chat has not yet been used. */
export const isDailyFreeChatAvailable = (dailyFreeOn: string | null, nowIso: string): boolean =>
  dailyFreeOn !== getUtcDateKey(nowIso);

/** Combines chat_access's two free-allowance sources (lifetime starter + today's daily) into the single count chat-turn/index.ts returns as `freeTurnsRemaining`. */
export const computeFreeChatTurnsRemaining = (row: ChatFreeAllowanceRow, nowIso: string): number =>
  Math.max(0, row.starterFreeRemaining) + (isDailyFreeChatAvailable(row.dailyFreeOn, nowIso) ? 1 : 0);
