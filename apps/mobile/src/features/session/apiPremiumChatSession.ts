import * as Crypto from "expo-crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildChatTurnPetProfile, getPremiumChatPaymentPreview, spendPremiumChatTurn } from "@mongchi/shared";
import type { ChatCareContext, ChatMemoryContext, ConversationMessage, CreditWallet, PetId, PetProfile } from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";
import { normalizeAppLocale } from "../../localization/localeNormalization";
import type { AppLocale } from "../../localization/localeNormalization";
import { getResourcesForLocale } from "../../localization/resourceCatalog";
import { ensureSupabaseSession } from "./supabaseGenerationSession";
import { invokeSupabaseChatTurn, loadSupabasePremiumChatThread } from "./supabasePremiumChatSession";

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
 * Sends one premium chat turn through chat-turn, deciding *before* the call
 * whether it is a free (ticket/Plus) or credit turn (docs/chat-live-design.md
 * §4.1 -- ticket count is local-only truth, credit_wallets.balance is
 * server-only truth) and only mutating the local wallet *after* a successful,
 * non-crisis response (§4.2's "never optimistic" + §5.2's "crisis turns are
 * never charged"). A failed or offline call leaves the wallet completely
 * untouched -- the caller just shows a retry message.
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

  const payment = getPremiumChatPaymentPreview(context.wallet, context.hasPremiumChatEntitlement);

  if (!payment.canStart) {
    return {
      ok: false,
      error: localPremiumChatError("chat_locked", getResourcesForLocale(normalizedLocale).chat.deterministicErrors.locked)
    };
  }

  const charge: "free" | "credit" = payment.mode === "credit" ? "credit" : "free";

  const outcome = await invokeSupabaseChatTurn(client, {
    petId: context.petId,
    ...(currentThread.conversationId ? { conversationId: currentThread.conversationId } : {}),
    text: normalizedText,
    disclosureAccepted: true,
    requestId,
    charge,
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
  let wallet = context.wallet;

  // Crisis-referral turns never charge (§5.2 layer 1: no OpenAI call, no
  // ticket/credit spend). Ticket accounting has no server counterpart, so
  // only the client can honor that for the free-ticket path; the credit path
  // is naturally safe since chargedCredit stays 0 and serverBalance is
  // unchanged when the server itself didn't charge.
  if (!data.crisisReferral) {
    if (payment.mode === "free_ticket") {
      const spend = spendPremiumChatTurn(wallet, spentAt);

      if (spend.ok) {
        wallet = spend.wallet;
      }
    } else if (payment.mode === "credit") {
      // credit_wallets.balance is server-authoritative for wallet.credits
      // (see hydrateServerCreditBalance's doc comment in
      // supabaseGenerationSession.ts) -- bonusCredits and freeChatTickets
      // are separate local-only buckets, untouched here.
      wallet = { ...wallet, credits: data.serverBalance, updatedAt: spentAt };
    }
    // plus_pass: unlimited: nothing to spend locally.
  }

  return {
    ok: true,
    thread: {
      conversationId: data.conversation.id,
      messages: [...currentThread.messages, data.userMessage, data.petMessage]
    },
    wallet,
    crisisReferral: data.crisisReferral
  };
};
