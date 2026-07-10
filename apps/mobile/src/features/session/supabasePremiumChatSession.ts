import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatTurnRequest, ChatTurnResponse, ConversationMessage, PetId } from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";
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

const genericRetryMessage = "Could not reach chat right now. Try again.";
const historyRetryMessage = "Could not load this chat yet. Try again.";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

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
  const conversationQuery = await client
    .from("conversations")
    .select("id")
    .eq("pet_id", petId)
    .eq("type", "premium_ai_chat")
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  const messagesQuery = await client
    .from("conversation_messages")
    .select("id, conversation_id, sender, text, safety_flags, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

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
      messages: messages.filter((message): message is ConversationMessage => message !== null).reverse()
    }
  };
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

  const invoked = await client.functions.invoke("chat-turn", { body });

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
