import { describe, expect, it } from "vitest";

import { mockCreditWallet } from "@mongchi/shared";
import type {
  Conversation,
  ConversationMessage,
  ConversationThreadResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse
} from "@mongchi/shared";

import type { MobileApiError, MobileApiResult } from "../../shared/api";
import {
  normalizePremiumChatDraft,
  sendApiPremiumChatTurn,
  startApiPremiumChatThread,
  type PremiumChatApiClient
} from "./apiPremiumChatSession";

const conversation: Conversation = {
  id: "conv_mobile_chat_001",
  userId: "user_mobile_001",
  petId: "pet_mobile_001",
  type: "premium_ai_chat",
  status: "open",
  disclosureAcceptedAt: "2026-06-24T09:00:00.000Z",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const userMessage: ConversationMessage = {
  id: "msg_user_001",
  conversationId: conversation.id,
  sender: "user",
  text: "Hello tiny friend",
  safetyFlags: [],
  createdAt: "2026-06-24T09:01:00.000Z"
};

const petMessage: ConversationMessage = {
  id: "msg_pet_001",
  conversationId: conversation.id,
  sender: "pet_ai",
  text: "Nori taps a lantern and listens.",
  safetyFlags: [],
  createdAt: "2026-06-24T09:01:00.000Z"
};

const apiError: MobileApiError = {
  status: 503,
  code: "premium_chat_provider_unavailable",
  messageSafe: "Premium chat is not available right now.",
  retryable: true
};

const ok = <T,>(data: T, status = 200): MobileApiResult<T> => ({
  ok: true,
  status,
  data
});

const fail = <T,>(error: MobileApiError): MobileApiResult<T> => ({
  ok: false,
  error
});

interface FakePremiumChatClient extends PremiumChatApiClient {
  calls: {
    create: CreateConversationRequest[];
    thread: string[];
    send: SendConversationMessageRequest[];
  };
}

const createFakeClient = (overrides: Partial<PremiumChatApiClient> = {}): FakePremiumChatClient => {
  const calls: FakePremiumChatClient["calls"] = {
    create: [],
    thread: [],
    send: []
  };

  return {
    calls,
    createPremiumConversation: async (body) => {
      calls.create.push(body);

      return ok<CreateConversationResponse>(
        {
          conversation,
          disclosureText: "AI-generated conversation"
        },
        201
      );
    },
    getConversationThread: async (conversationId) => {
      calls.thread.push(conversationId);

      return ok<ConversationThreadResponse>({
        conversation,
        messages: [petMessage]
      });
    },
    sendPremiumConversationMessage: async (body) => {
      calls.send.push(body);

      return ok<SendConversationMessageResponse>({
        userMessage,
        petMessage,
        safetyFlags: [],
        wallet: {
          ...mockCreditWallet,
          freeChatTickets: 2,
          updatedAt: "2026-06-24T09:01:00.000Z"
        },
        walletSpend: {
          freeChatTicketsSpent: 1,
          bonusCreditsSpent: 0,
          creditsSpent: 0
        }
      });
    },
    ...overrides
  };
};

describe("API premium chat session helpers", () => {
  it("normalizes draft text before sending", () => {
    expect(normalizePremiumChatDraft("  hello    tiny   friend  ")).toBe("hello tiny friend");
  });

  it("starts a premium chat with accepted disclosure and reads the thread", async () => {
    const client = createFakeClient();

    const result = await startApiPremiumChatThread(client, "pet_mobile_001");

    expect(result).toEqual({
      ok: true,
      thread: {
        conversationId: "conv_mobile_chat_001",
        messages: [petMessage]
      }
    });
    expect(client.calls.create).toEqual([
      {
        petId: "pet_mobile_001",
        disclosureAccepted: true
      }
    ]);
    expect(client.calls.thread).toEqual(["conv_mobile_chat_001"]);
  });

  it("keeps the opened conversation usable when the follow-up thread read fails", async () => {
    const client = createFakeClient({
      getConversationThread: async () => fail<ConversationThreadResponse>(apiError)
    });

    const result = await startApiPremiumChatThread(client, "pet_mobile_001");

    expect(result).toEqual({
      ok: true,
      thread: {
        conversationId: "conv_mobile_chat_001",
        messages: []
      },
      warning: apiError
    });
  });

  it("sends a normalized premium chat turn and appends the server messages", async () => {
    const client = createFakeClient();

    const result = await sendApiPremiumChatTurn(
      client,
      {
        conversationId: conversation.id,
        messages: []
      },
      "  Hello    tiny friend  "
    );

    expect(result).toEqual({
      ok: true,
      thread: {
        conversationId: conversation.id,
        messages: [userMessage, petMessage]
      },
      wallet: {
        ...mockCreditWallet,
        freeChatTickets: 2,
        updatedAt: "2026-06-24T09:01:00.000Z"
      }
    });
    expect(client.calls.send).toEqual([
      {
        conversationId: conversation.id,
        text: "Hello tiny friend"
      }
    ]);
  });

  it("blocks empty local drafts before calling the API", async () => {
    const client = createFakeClient();

    const result = await sendApiPremiumChatTurn(
      client,
      {
        conversationId: conversation.id,
        messages: []
      },
      "    "
    );

    expect(result).toEqual({
      ok: false,
      error: {
        status: 0,
        code: "empty_message",
        messageSafe: "Write a short message first.",
        retryable: false
      }
    });
    expect(client.calls.send).toEqual([]);
  });
});
