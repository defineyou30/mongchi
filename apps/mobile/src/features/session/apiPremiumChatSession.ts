import type {
  ConversationMessage,
  ConversationThreadResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  CreditWallet,
  PetId,
  SendConversationMessageRequest,
  SendConversationMessageResponse
} from "@mongchi/shared";

import type { MobileApiError, MobileApiResult } from "../../shared/api";

export interface PremiumChatApiClient {
  createPremiumConversation: (body: CreateConversationRequest) => Promise<MobileApiResult<CreateConversationResponse>>;
  getConversationThread: (conversationId: string) => Promise<MobileApiResult<ConversationThreadResponse>>;
  sendPremiumConversationMessage: (body: SendConversationMessageRequest) => Promise<MobileApiResult<SendConversationMessageResponse>>;
}

export interface PremiumChatThreadState {
  conversationId: string;
  messages: ConversationMessage[];
}

export type StartPremiumChatThreadResult =
  | {
      ok: true;
      thread: PremiumChatThreadState;
      warning?: MobileApiError;
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

export const normalizePremiumChatDraft = (text: string): string => text.trim().replace(/\s+/g, " ");

export const startApiPremiumChatThread = async (
  client: PremiumChatApiClient,
  petId: PetId
): Promise<StartPremiumChatThreadResult> => {
  const started = await client.createPremiumConversation({
    petId,
    disclosureAccepted: true
  });

  if (!started.ok) {
    return {
      ok: false,
      error: started.error
    };
  }

  const thread = await client.getConversationThread(started.data.conversation.id);

  if (!thread.ok) {
    return {
      ok: true,
      thread: {
        conversationId: started.data.conversation.id,
        messages: []
      },
      warning: thread.error
    };
  }

  return {
    ok: true,
    thread: {
      conversationId: thread.data.conversation.id,
      messages: thread.data.messages
    }
  };
};

export const sendApiPremiumChatTurn = async (
  client: PremiumChatApiClient,
  currentThread: PremiumChatThreadState,
  text: string
): Promise<SendPremiumChatTurnResult> => {
  const normalizedText = normalizePremiumChatDraft(text);

  if (!normalizedText) {
    return {
      ok: false,
      error: localPremiumChatError("empty_message", "Write a short message first.")
    };
  }

  const sent = await client.sendPremiumConversationMessage({
    conversationId: currentThread.conversationId,
    text: normalizedText
  });

  if (!sent.ok) {
    return {
      ok: false,
      error: sent.error
    };
  }

  return {
    ok: true,
    thread: {
      conversationId: currentThread.conversationId,
      messages: [...currentThread.messages, sent.data.userMessage, sent.data.petMessage]
    },
    wallet: sent.data.wallet
  };
};
