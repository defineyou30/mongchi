import type { ISODateTime } from "./common";

// ---------------------------------------------------------------------------
// Server-truth free-chat-turn allowance math (Chat Live BM decision: starter
// lifetime allowance + a once-per-day free turn, chat_access table --
// supabase/migrations/0014_chat_turn_guardrails.sql).
//
// Mirrors supabase/functions/chat-turn/freeAllowance.ts (which itself mirrors
// 0014's reserve_chat_turn day-boundary check: `daily_free_on IS DISTINCT
// FROM current_date`). Postgres's current_date evaluates in the database
// session's timezone, which Supabase leaves at its default of UTC (no
// timezone override anywhere in supabase/config.toml or the chat-turn
// migrations) -- so this compares UTC calendar dates, not the device's local
// calendar date. Using the device's local day here instead (the way
// careStreak.ts's getLocalDayKey deliberately does for streak display) would
// let a client near a day boundary disagree with the server about whether
// "today's" daily free chat is still available, showing a chip count off by
// one from what the next chat-turn response actually charges.
//
// This npm workspace package cannot be imported into a Supabase Edge
// Function (it's a separate Deno runtime with no bundler step -- see that
// file's own module doc comment), so this logic is intentionally duplicated
// rather than shared. Both copies must be kept in sync by hand: if you change
// one, change the other.
// ---------------------------------------------------------------------------

/**
 * chat_access's column default (0014_chat_turn_guardrails.sql) for a user
 * whose chat_access row hasn't been created yet -- created lazily by
 * reserve_chat_turn on their very first chat turn.
 */
export const DEFAULT_STARTER_FREE_REMAINING = 3;

export interface ChatFreeAllowanceState {
  /** chat_access.starter_free_remaining -- a lifetime allowance, not a daily one. */
  starterFreeRemaining: number;
  /** chat_access.daily_free_on, a DATE string (e.g. "2026-07-14"), or null if the daily free chat has never been used. */
  dailyFreeOn: string | null;
}

/** UTC calendar date (YYYY-MM-DD) for an ISO instant -- matches Postgres's current_date under Supabase's UTC session timezone. */
export const getUtcDateKey = (nowIso: ISODateTime): string => nowIso.slice(0, 10);

/** Mirrors reserve_chat_turn's `daily_free_on IS DISTINCT FROM current_date` gate: true when today's daily free chat has not yet been used. */
export const isDailyFreeChatAvailable = (dailyFreeOn: string | null, nowIso: ISODateTime): boolean =>
  dailyFreeOn !== getUtcDateKey(nowIso);

/**
 * Combines chat_access's two free-allowance sources (lifetime starter +
 * today's daily) into the single "free chats remaining" count the mobile
 * chip/pip UI shows -- mirrors chat-turn/index.ts's fetchFreeChatTurns
 * (via supabase/functions/chat-turn/freeAllowance.ts).
 */
export const computeFreeChatTurnsRemaining = (state: ChatFreeAllowanceState, nowIso: ISODateTime): number =>
  Math.max(0, state.starterFreeRemaining) + (isDailyFreeChatAvailable(state.dailyFreeOn, nowIso) ? 1 : 0);
