import type { SupabaseClient } from "@supabase/supabase-js";

import { computeFreeChatTurnsRemaining, DEFAULT_STARTER_FREE_REMAINING } from "@mongchi/shared";
import type { ChatTurnRequest, ChatTurnResponse, ConversationMessage, PetId } from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";
import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { ensureSupabaseSession, readInvokeErrorBody, toMobileError } from "./supabaseGenerationSession";
import { reporter } from "../../shared/errors/reporter";

// ---------------------------------------------------------------------------
// Raw Supabase transport for the live chat-turn Edge Function (Chat Live
// wave C2, docs/chat-live-design.md §6.1). Mirrors
// supabaseGenerationSession.ts's invokeGenerateAvatarWithBody: ensure an
// anonymous/authenticated session -> client.functions.invoke -> map the
// invoke error's HTTP status to a warm, safe MobileApiError. The higher-level
// charge/wallet decision (§4) lives in apiPremiumChatSession.ts, which is the
// thin start/send adapter ChatGateScreen actually calls -- this module only
// owns "how do we talk to chat-turn", not "should this turn be free or
// credit".
// ---------------------------------------------------------------------------

export type SupabaseChatTurnOutcome =
  | {
      ok: true;
      data: ChatTurnResponse;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export type SupabasePremiumChatThreadOutcome =
  | {
      ok: true;
      thread: {
        conversationId: string | null;
        messages: ConversationMessage[];
      };
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export type ChatMessageReportReason = "harmful" | "inappropriate" | "inaccurate" | "other";

export type ChatMessageReportOutcome =
  | {
      ok: true;
      reportId: string;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

/**
 * `alreadyActive: true` covers both the 200 "purchased just now" replay path
 * (never actually reached, since a genuine retry of the request that just
 * activated the pass short-circuits server-side, see purchasePlan.ts's doc
 * comment) and the 409 "already_active" backstop -- either way there is now
 * a live pass, so the caller treats this as success, not an error (§ chat
 * day pass BM decision: "이미 활성" is a relationship-frame success, not a
 * transaction failure).
 */
export type SupabasePurchaseChatDayPassOutcome =
  | {
      ok: true;
      data: {
        alreadyActive: boolean;
        dayPassExpiresAt: string | null;
        serverBalance: number;
      };
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export type DeleteSupabaseChatHistoryOutcome =
  | {
      ok: true;
      deletedCount: number;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

const genericRetryMessage = "Could not reach chat right now. Try again.";
const historyRetryMessage = "Could not load this chat yet. Try again.";
const allowanceRetryMessage = "Could not load today's free chats. Try again.";
const reportRetryMessage = "Could not send this report. Try again.";
const purchaseChatPassRetryMessage = "Could not start your chat day pass. Try again.";
const deleteChatHistoryRetryMessage = "Could not delete your chat history. Try again.";
const chatQueryTimeoutMs = 30_000;
const chatTurnTimeoutMs = 180_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const validChargeKinds: ReadonlySet<ChatTurnResponse["chargeKind"]> = new Set([
  "plus",
  "day_pass",
  "starter_free",
  "daily_free",
  "credit",
  "crisis"
]);

/** Falls back to "credit" for anything the server didn't send as one of the known charge kinds, rather than letting an unrecognized value leak into wallet/gate logic. */
const parseChargeKind = (value: unknown): ChatTurnResponse["chargeKind"] =>
  typeof value === "string" && validChargeKinds.has(value as ChatTurnResponse["chargeKind"])
    ? (value as ChatTurnResponse["chargeKind"])
    : "credit";

/**
 * complete_chat_turn (the chat-turn Edge Function's write path) inserts one
 * turn's user + pet_ai (or user + system, for a crisis referral) row in the
 * same transaction, so their created_at timestamps can land in the very same
 * second -- real-device QA found the pet's reply rendering above the user
 * message it was replying to because the only tiebreak was `id`, which has
 * no relationship to conversational order. Ranks the user's row first so a
 * same-second tie still reads top-to-bottom as "user asked, pet replied".
 */
const conversationMessageSenderRank: Record<ConversationMessage["sender"], number> = {
  user: 0,
  system: 1,
  pet_ai: 2
};

/**
 * Explicit, testable client-side ordering applied regardless of what order
 * the rows arrived in from the server -- see conversationMessageSenderRank's
 * doc comment for the same-second tie this exists to fix. Primary key is
 * created_at ascending (oldest first, matching the chat UI); ties break on
 * sender (user before pet_ai/system); a remaining tie (identical created_at
 * *and* sender -- e.g. two system rows written in the same transaction)
 * falls back to `id` ascending purely for a stable, deterministic order.
 */
const compareConversationMessagesForDisplay = (a: ConversationMessage, b: ConversationMessage): number => {
  const createdAtDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const senderDiff = conversationMessageSenderRank[a.sender] - conversationMessageSenderRank[b.sender];

  if (senderDiff !== 0) {
    return senderDiff;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

const parseConversationMessage = (value: unknown): ConversationMessage | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, conversation_id: conversationId, sender, text, safety_flags: safetyFlags, created_at: createdAt } = value;

  if (
    typeof id !== "string" ||
    typeof conversationId !== "string" ||
    (sender !== "user" && sender !== "pet_ai" && sender !== "system") ||
    typeof text !== "string" ||
    !Array.isArray(safetyFlags) ||
    !safetyFlags.every((flag) => typeof flag === "string") ||
    typeof createdAt !== "string"
  ) {
    return null;
  }

  return { id, conversationId, sender, text, safetyFlags, createdAt };
};

export const loadSupabasePremiumChatThread = async (
  client: SupabaseClient,
  petId: PetId
): Promise<SupabasePremiumChatThreadOutcome> => {
  const conversationQuery = await withRequestTimeout(
    client
      .from("conversations")
      .select("id")
      .eq("pet_id", petId)
      .eq("type", "premium_ai_chat")
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    chatQueryTimeoutMs
  );

  if (conversationQuery.error) {
    return { ok: false, error: toMobileError(0, "chat_history_unavailable", historyRetryMessage, true) };
  }

  const conversationData: unknown = conversationQuery.data;

  if (conversationData === null) {
    return { ok: true, thread: { conversationId: null, messages: [] } };
  }

  if (!isRecord(conversationData) || typeof conversationData.id !== "string") {
    return { ok: false, error: toMobileError(0, "chat_history_response_invalid", historyRetryMessage, true) };
  }

  const conversationId = conversationData.id;
  const messagesQuery = await withRequestTimeout(
    client
      .from("conversation_messages")
      .select("id, conversation_id, sender, text, safety_flags, created_at")
      .eq("conversation_id", conversationId)
      // Mirrors compareConversationMessagesForDisplay's tiebreak chain
      // (reversed, since this leg fetches newest-first before the 100 cap)
      // so the query itself is already turn-order-correct at the boundary;
      // the client sort below is the actual source of truth for display,
      // independent of whatever order these rows arrive in.
      .order("created_at", { ascending: false })
      .order("sender", { ascending: true })
      .order("id", { ascending: false })
      .limit(100),
    chatQueryTimeoutMs
  );

  if (messagesQuery.error) {
    return { ok: false, error: toMobileError(0, "chat_history_unavailable", historyRetryMessage, true) };
  }

  const rawMessages: unknown = messagesQuery.data;

  if (!Array.isArray(rawMessages)) {
    return { ok: false, error: toMobileError(0, "chat_history_response_invalid", historyRetryMessage, true) };
  }

  const messages = rawMessages.slice(0, 100).map(parseConversationMessage);

  if (messages.some((message) => message === null)) {
    return { ok: false, error: toMobileError(0, "chat_history_response_invalid", historyRetryMessage, true) };
  }

  return {
    ok: true,
    thread: {
      conversationId,
      messages: messages
        .filter((message): message is ConversationMessage => message !== null)
        .sort(compareConversationMessagesForDisplay)
    }
  };
};

export interface SupabaseChatAllowance {
  starterFreeRemaining: number;
  /** chat_access.daily_free_on, a DATE string (e.g. "2026-07-14"), or null if the daily free chat has never been used. */
  dailyFreeOn: string | null;
  /** starterFreeRemaining + (1 if today's daily free turn hasn't been used yet) -- see computeFreeChatTurnsRemaining (@mongchi/shared). */
  freeChatTurnsRemaining: number;
  /** chat_access.day_pass_expires_at (0018_chat_day_pass.sql), or null if no pass has ever been purchased. Callers must still compare this against "now" -- a past timestamp means the pass has lapsed, not that it's active. */
  dayPassExpiresAt: string | null;
}

export type LoadSupabaseChatAllowanceOutcome =
  | {
      ok: true;
      allowance: SupabaseChatAllowance;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

const loadSupabaseChatAllowanceInner = async (client: SupabaseClient): Promise<LoadSupabaseChatAllowanceOutcome> => {
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  const { data, error } = await withRequestTimeout(
    client
      .from("chat_access")
      .select("starter_free_remaining, daily_free_on, day_pass_expires_at")
      .eq("user_id", session.userId)
      .maybeSingle(),
    chatQueryTimeoutMs
  );

  if (error) {
    return { ok: false, error: toMobileError(0, "chat_allowance_unavailable", allowanceRetryMessage, true) };
  }

  // No row yet means chat_access hasn't been created for this caller (it's
  // created lazily by reserve_chat_turn on their very first chat turn) --
  // mirror 0014_chat_turn_guardrails.sql's column defaults exactly:
  // starter_free_remaining=3, daily_free_on=NULL (today's daily turn is still
  // available), for the same 3 + 1 = 4 a first-time caller's very first
  // chat-turn response would report.
  const starterFreeRemaining =
    isRecord(data) && isFiniteNumber(data.starter_free_remaining) ? data.starter_free_remaining : DEFAULT_STARTER_FREE_REMAINING;
  const dailyFreeOn = isRecord(data) && typeof data.daily_free_on === "string" ? data.daily_free_on : null;
  const dayPassExpiresAt = isRecord(data) && typeof data.day_pass_expires_at === "string" ? data.day_pass_expires_at : null;
  const now = new Date().toISOString();

  return {
    ok: true,
    allowance: {
      starterFreeRemaining,
      dailyFreeOn,
      freeChatTurnsRemaining: computeFreeChatTurnsRemaining({ starterFreeRemaining, dailyFreeOn }, now),
      dayPassExpiresAt
    }
  };
};

/**
 * Reads the caller's own chat_access row (RLS select-own,
 * 0014_chat_turn_guardrails.sql's chat_access_select_own policy) to hydrate
 * the chat gate's free-chat chip/pip with server truth the moment the screen
 * mounts, instead of a fixed local wallet default that can disagree with what
 * the first real chat-turn response goes on to charge -- see
 * computeFreeChatTurnsRemaining's doc comment (@mongchi/shared) for the
 * starter + daily allowance math this mirrors. Also returns day_pass_expires_at
 * (0018_chat_day_pass.sql) so the same mount hydration can restore an active
 * day pass across app restarts -- ChatGateScreen previously only read this
 * from a fresh purchase or chat-turn response, so a returning user with an
 * already-active pass saw the credit-balance chip instead of "Day Pass
 * active" until their next turn.
 *
 * Design-audit invariant I4 shield, same as loadSupabasePremiumChatThread /
 * invokeSupabaseChatTurn: a raw throw from session sign-in or the query must
 * never escape as an unhandled promise rejection.
 */
export const loadSupabaseChatAllowance = async (client: SupabaseClient): Promise<LoadSupabaseChatAllowanceOutcome> => {
  try {
    return await loadSupabaseChatAllowanceInner(client);
  } catch (cause) {
    console.warn("[chat] allowance load threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("chat: allowance load threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, error: toMobileError(0, "chat_allowance_invoke_failed", allowanceRetryMessage, true) };
  }
};

/**
 * Maps a chat-turn HTTP failure to mobile copy. Every status chat-turn/
 * index.ts can return (see its jsonResponse calls) is covered; anything
 * unrecognized falls back to a generic retryable message rather than
 * surfacing a raw server code to the player.
 */
const mapChatTurnErrorStatus = (status: number, bodyMessage: string | undefined): MobileApiError => {
  switch (status) {
    case 402:
      return toMobileError(
        402,
        "insufficient_credits",
        "You're out of credits for this chat. Grab more credits and let's talk again soon."
      );
    case 429:
      return toMobileError(429, "rate_limited", "Let's take a little breather -- try again in a minute.", true);
    case 422:
      // moderatePremiumChatInput's own messageSafe copy (empty/too-long/
      // professional-advice) is already warm and specific -- prefer it over
      // a generic fallback when the body could be read.
      return toMobileError(422, "message_rejected", bodyMessage ?? genericRetryMessage, false);
    case 409:
      return toMobileError(409, "conversation_not_ready", bodyMessage ?? genericRetryMessage, true);
    case 503:
      return toMobileError(503, "chat_unavailable", bodyMessage ?? genericRetryMessage, true);
    case 401:
      return toMobileError(401, "unauthorized", "Could not verify your session. Try again.", true);
    case 404:
      return toMobileError(404, "conversation_not_found", genericRetryMessage, true);
    default:
      return toMobileError(status, "chat_turn_failed", genericRetryMessage, true);
  }
};

const invokeSupabaseChatTurnInner = async (
  client: SupabaseClient,
  body: ChatTurnRequest
): Promise<SupabaseChatTurnOutcome> => {
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  const invoked = await withRequestTimeout(client.functions.invoke("chat-turn", { body }), chatTurnTimeoutMs);

  if (invoked.error) {
    const context = (invoked.error as { context?: { status?: number } }).context;
    const status = context?.status ?? 0;
    const errorBody = await readInvokeErrorBody(context);

    return { ok: false, error: mapChatTurnErrorStatus(status, errorBody?.message) };
  }

  const data = invoked.data as Partial<ChatTurnResponse> | null;

  if (!data || !data.conversation || !data.userMessage || !data.petMessage) {
    return {
      ok: false,
      error: toMobileError(0, "chat_turn_response_invalid", genericRetryMessage, true)
    };
  }

  return {
    ok: true,
    data: {
      conversation: data.conversation,
      userMessage: data.userMessage,
      petMessage: data.petMessage,
      safetyFlags: data.safetyFlags ?? [],
      serverBalance: data.serverBalance ?? 0,
      chargedCredit: data.chargedCredit ?? 0,
      chargeKind: parseChargeKind(data.chargeKind),
      freeTurnsRemaining: data.freeTurnsRemaining ?? 0,
      crisisReferral: data.crisisReferral ?? false
    }
  };
};

/**
 * Design-audit invariant I4 (failures must never be silent), same shield as
 * supabaseGenerationSession.ts's start/poll flows: a raw throw from any await
 * above (session sign-in, functions.invoke, the error body read) must never
 * escape as an unhandled promise rejection -- it becomes a visible, retryable
 * chat_turn_invoke_failed result instead.
 */
export const invokeSupabaseChatTurn = async (
  client: SupabaseClient,
  body: ChatTurnRequest
): Promise<SupabaseChatTurnOutcome> => {
  try {
    return await invokeSupabaseChatTurnInner(client, body);
  } catch (cause) {
    console.warn("[chat] turn invoke threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("chat: turn invoke threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return {
      ok: false,
      error: toMobileError(0, "chat_turn_invoke_failed", genericRetryMessage, true)
    };
  }
};

export const reportSupabaseChatMessage = async (
  client: SupabaseClient,
  messageId: string,
  reason: ChatMessageReportReason
): Promise<ChatMessageReportOutcome> => {
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  try {
    const { data, error } = await withRequestTimeout(
      client.rpc("report_chat_message", {
        p_message_id: messageId,
        p_reason: reason
      }),
      chatQueryTimeoutMs
    );

    if (error || typeof data !== "string" || data.length === 0) {
      return {
        ok: false,
        error: toMobileError(0, "chat_report_failed", reportRetryMessage, true)
      };
    }

    return { ok: true, reportId: data };
  } catch (cause) {
    reporter.captureMessage("chat: report invoke threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return {
      ok: false,
      error: toMobileError(0, "chat_report_failed", reportRetryMessage, true)
    };
  }
};

/**
 * Maps a purchase-chat-pass HTTP failure to mobile copy -- mirrors
 * mapChatTurnErrorStatus above. 409 (already_active) is handled by the
 * caller before this ever runs (see purchaseSupabaseChatDayPassInner):
 * it is a success case, not a failure to map.
 */
const mapPurchaseChatPassErrorStatus = (status: number, bodyMessage: string | undefined): MobileApiError => {
  switch (status) {
    case 402:
      return toMobileError(
        402,
        "insufficient_credits",
        bodyMessage ?? "You need a few more credits to grab a chat day pass."
      );
    case 503:
      return toMobileError(503, "chat_unavailable", bodyMessage ?? purchaseChatPassRetryMessage, true);
    case 401:
      return toMobileError(401, "unauthorized", "Could not verify your session. Try again.", true);
    default:
      return toMobileError(status, "chat_day_pass_purchase_failed", purchaseChatPassRetryMessage, true);
  }
};

const purchaseSupabaseChatDayPassInner = async (
  client: SupabaseClient,
  requestId: string
): Promise<SupabasePurchaseChatDayPassOutcome> => {
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  const invoked = await withRequestTimeout(
    client.functions.invoke("purchase-chat-pass", { body: { request_id: requestId } }),
    chatQueryTimeoutMs
  );

  if (invoked.error) {
    const context = (invoked.error as { context?: { status?: number } }).context;
    const status = context?.status ?? 0;
    const errorBody = (await readInvokeErrorBody(context)) as
      | { error?: string; message?: string; dayPassExpiresAt?: string | null; serverBalance?: number }
      | null;

    // already_active is a server-side backstop, not a real failure -- the
    // mobile client is expected to hide the purchase entry point once a pass
    // is active, so a caller reaching this branch is just confirming what is
    // already true (see purchasePlan.ts's mapPurchaseChatDayPassOutcome doc
    // comment).
    if (status === 409) {
      return {
        ok: true,
        data: {
          alreadyActive: true,
          dayPassExpiresAt: typeof errorBody?.dayPassExpiresAt === "string" ? errorBody.dayPassExpiresAt : null,
          serverBalance: isFiniteNumber(errorBody?.serverBalance) ? errorBody.serverBalance : 0
        }
      };
    }

    return { ok: false, error: mapPurchaseChatPassErrorStatus(status, errorBody?.message) };
  }

  const data = invoked.data as { dayPassExpiresAt?: string | null; serverBalance?: number } | null;

  if (!data || typeof data.dayPassExpiresAt !== "string" || !isFiniteNumber(data.serverBalance)) {
    return {
      ok: false,
      error: toMobileError(0, "chat_day_pass_response_invalid", purchaseChatPassRetryMessage, true)
    };
  }

  return {
    ok: true,
    data: { alreadyActive: false, dayPassExpiresAt: data.dayPassExpiresAt, serverBalance: data.serverBalance }
  };
};

/**
 * Design-audit invariant I4 shield, same as invokeSupabaseChatTurn: a raw
 * throw from session sign-in / functions.invoke / the error body read must
 * never escape as an unhandled promise rejection.
 */
export const purchaseSupabaseChatDayPass = async (
  client: SupabaseClient,
  requestId: string
): Promise<SupabasePurchaseChatDayPassOutcome> => {
  try {
    return await purchaseSupabaseChatDayPassInner(client, requestId);
  } catch (cause) {
    console.warn("[chat] day pass purchase invoke threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("chat: day pass purchase invoke threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return {
      ok: false,
      error: toMobileError(0, "chat_day_pass_invoke_failed", purchaseChatPassRetryMessage, true)
    };
  }
};

/**
 * Hard-deletes the caller's own live conversation history via
 * delete_own_chat_history (0018_chat_day_pass.sql) -- authenticated-callable,
 * SECURITY DEFINER, auth.uid()-scoped, matching report_chat_message's
 * ownership pattern. The mobile "Delete chat history" action previously only
 * cleared a dead API/local cache and never reached these live Supabase
 * tables; this is the missing live-data half of that action.
 */
export const deleteSupabaseChatHistory = async (client: SupabaseClient): Promise<DeleteSupabaseChatHistoryOutcome> => {
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  try {
    const { data, error } = await withRequestTimeout(client.rpc("delete_own_chat_history"), chatQueryTimeoutMs);

    if (error || !isFiniteNumber(data)) {
      return { ok: false, error: toMobileError(0, "chat_history_delete_failed", deleteChatHistoryRetryMessage, true) };
    }

    return { ok: true, deletedCount: data };
  } catch (cause) {
    reporter.captureMessage("chat: delete history invoke threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, error: toMobileError(0, "chat_history_delete_failed", deleteChatHistoryRetryMessage, true) };
  }
};
