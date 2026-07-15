import * as Crypto from "expo-crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildChatTurnPetProfile } from "@mongchi/shared";
import type { ChatCareContext, ChatMemoryContext, ChatTurnResponse, ConversationMessage, CreditWallet, PetId, PetProfile } from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";
import { normalizeAppLocale } from "../../localization/localeNormalization";
import type { AppLocale } from "../../localization/localeNormalization";
import { getResourcesForLocale } from "../../localization/resourceCatalog";
import { ensureSupabaseSession } from "./supabaseGenerationSession";
import {
  invokeSupabaseChatTurn,
  loadSupabasePremiumChatThread,
  purchaseSupabaseChatDayPass
} from "./supabasePremiumChatSession";

// ---------------------------------------------------------------------------
// Chat Live wave C2 (docs/chat-live-design.md §6.1): thin start/send adapter
// over the single-call `chat-turn` Edge Function. Kept as two exports
// (startApiPremiumChatThread / sendApiPremiumChatTurn) with roughly their
// original services/api-era shape so ChatGateScreen's call sites barely
// change, even though the transport underneath is now entirely Supabase --
// see supabasePremiumChatSession.ts for the raw invoke plumbing this module
// layers charge/wallet decisions on top of.
// ---------------------------------------------------------------------------

export interface PremiumChatThreadState {
  /** null until the first real chat-turn response -- see startApiPremiumChatThread's doc comment. */
  conversationId: string | null;
  messages: ConversationMessage[];
}

/** Everything sendApiPremiumChatTurn needs beyond the raw draft text -- assembled by ChatGateScreen from useTerrariumSession() state each send. */
export interface PremiumChatSessionContext {
  petId: PetId;
  petProfile: Pick<PetProfile, "name" | "species" | "personalityTags" | "talkingStyle" | "favoriteThing" | "memoryNote">;
  wallet: CreditWallet;
  hasPremiumChatEntitlement: boolean;
  locale?: AppLocale;
  memoryContext?: ChatMemoryContext;
  careContext?: ChatCareContext;
}

export interface PremiumChatSendInput {
  context: PremiumChatSessionContext;
  currentThread: PremiumChatThreadState;
  text: string;
  requestId?: string;
}

export type StartPremiumChatThreadResult =
  | {
      ok: true;
      thread: PremiumChatThreadState;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export type SendPremiumChatTurnResult =
  | {
      ok: true;
      thread: PremiumChatThreadState;
      wallet: CreditWallet;
      /** True when this turn matched the crisis-referral pattern -- petMessage is already a warm resource message (sender "system"); nothing was charged. */
      crisisReferral: boolean;
      /** Server-decided settlement for this turn (§ chat day pass BM decision) -- lets the gate UI notice a "day_pass" turn and keep its "pass is active" state in sync even when the pass was already active before this screen mounted. */
      chargeKind: ChatTurnResponse["chargeKind"];
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export interface PurchaseChatDayPassContext {
  wallet: CreditWallet;
  locale?: AppLocale;
}

export type PurchaseChatDayPassResult =
  | {
      ok: true;
      /** True when the caller already held an active pass -- a relationship-frame success, not a fresh charge (see purchaseSupabaseChatDayPass's doc comment). */
      alreadyActive: boolean;
      dayPassExpiresAt: string | null;
      wallet: CreditWallet;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

const localPremiumChatError = (code: string, messageSafe: string): MobileApiError => ({
  status: 0,
  code,
  messageSafe,
  retryable: false
});

const localizePremiumChatError = (error: MobileApiError, locale: AppLocale): MobileApiError => {
  const messages = getResourcesForLocale(normalizeAppLocale(locale)).chat.deterministicErrors;
  const messageSafe =
    error.code === "supabase_anonymous_sign_in_failed" ? messages.session
    : error.code === "chat_history_unavailable" || error.code === "chat_history_response_invalid" ? messages.history
    : error.code === "insufficient_credits" ? messages.credits
    : error.code === "rate_limited" ? messages.rateLimited
    : error.code === "message_rejected" ? messages.rejected
    : messages.unavailable;

  return { ...error, messageSafe };
};

export const normalizePremiumChatDraft = (text: string): string => text.trim().replace(/\s+/g, " ");

export const startApiPremiumChatThread = async (
  client: SupabaseClient,
  petId: PetId,
  locale: AppLocale = "en-US"
): Promise<StartPremiumChatThreadResult> => {
  const normalizedLocale = normalizeAppLocale(locale);
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return { ok: false, error: localizePremiumChatError(session.error, normalizedLocale) };
  }

  const result = await loadSupabasePremiumChatThread(client, petId);

  return result.ok ? result : { ok: false, error: localizePremiumChatError(result.error, normalizedLocale) };
};

/**
 * Sends one premium chat turn through chat-turn. Billing, free allowances,
 * Plus access, rate limiting, and request idempotency are all server-owned;
 * the client only reconciles the returned wallet snapshot after success.
 */
export const sendApiPremiumChatTurn = async (
  client: SupabaseClient,
  { context, currentThread, text, requestId = Crypto.randomUUID() }: PremiumChatSendInput
): Promise<SendPremiumChatTurnResult> => {
  const normalizedLocale = normalizeAppLocale(context.locale);
  const normalizedText = normalizePremiumChatDraft(text);

  if (!normalizedText) {
    return {
      ok: false,
      error: localPremiumChatError("empty_message", getResourcesForLocale(normalizedLocale).chat.deterministicErrors.emptyMessage)
    };
  }

  const outcome = await invokeSupabaseChatTurn(client, {
    petId: context.petId,
    ...(currentThread.conversationId ? { conversationId: currentThread.conversationId } : {}),
    text: normalizedText,
    disclosureAccepted: true,
    requestId,
    locale: normalizedLocale,
    petProfile: buildChatTurnPetProfile(context.petProfile),
    ...(context.memoryContext ? { memoryContext: context.memoryContext } : {}),
    ...(context.careContext ? { careContext: context.careContext } : {})
  });

  if (!outcome.ok) {
    return { ok: false, error: localizePremiumChatError(outcome.error, normalizedLocale) };
  }

  const { data } = outcome;
  const spentAt = data.userMessage.createdAt;
  const wallet = data.crisisReferral
    ? context.wallet
    : {
        ...context.wallet,
        credits: data.serverBalance,
        freeChatTickets: data.freeTurnsRemaining,
        updatedAt: spentAt
      };

  return {
    ok: true,
    thread: {
      conversationId: data.conversation.id,
      messages: [...currentThread.messages, data.userMessage, data.petMessage]
    },
    wallet,
    crisisReferral: data.crisisReferral,
    chargeKind: data.chargeKind
  };
};

/**
 * Spends the server-constant credit price for 24 rolling hours of
 * day-pass-covered premium chat turns (chatDayPassCreditCost,
 * @mongchi/shared's wallet.ts). requestId is caller-owned so a retry after a
 * network failure reuses the same id and stays idempotent server-side (same
 * principle as sendApiPremiumChatTurn/supabaseGenerationSession's
 * request_id) -- the default only exists for callers that don't need retry
 * idempotency (e.g. a one-shot test).
 */
export const purchaseApiChatDayPass = async (
  client: SupabaseClient,
  context: PurchaseChatDayPassContext,
  requestId: string = Crypto.randomUUID()
): Promise<PurchaseChatDayPassResult> => {
  const normalizedLocale = normalizeAppLocale(context.locale);
  const outcome = await purchaseSupabaseChatDayPass(client, requestId);

  if (!outcome.ok) {
    return { ok: false, error: localizePremiumChatError(outcome.error, normalizedLocale) };
  }

  const { data } = outcome;

  return {
    ok: true,
    alreadyActive: data.alreadyActive,
    dayPassExpiresAt: data.dayPassExpiresAt,
    wallet: {
      ...context.wallet,
      // Server-owned balance after the debit (or, on an already-active
      // replay, simply the current balance) -- bonusCredits is untouched,
      // same convention as sendApiPremiumChatTurn's wallet reconciliation
      // above.
      credits: data.serverBalance
    }
  };
};
