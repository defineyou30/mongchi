import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111")
}));

const { ensureSupabaseSessionMock, invokeSupabaseChatTurnMock } = vi.hoisted(() => ({
  ensureSupabaseSessionMock: vi.fn(),
  invokeSupabaseChatTurnMock: vi.fn()
}));

vi.mock("./supabaseGenerationSession", () => ({
  ensureSupabaseSession: ensureSupabaseSessionMock
}));

vi.mock("./supabasePremiumChatSession", () => ({
  invokeSupabaseChatTurn: invokeSupabaseChatTurnMock
}));

import type { ChatTurnRequest, ChatTurnResponse, CreditWallet, PetProfile } from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";
import {
  normalizePremiumChatDraft,
  sendApiPremiumChatTurn,
  startApiPremiumChatThread,
  type PremiumChatSessionContext,
  type PremiumChatThreadState
} from "./apiPremiumChatSession";

const petProfile: Pick<PetProfile, "name" | "species" | "personalityTags" | "talkingStyle"> = {
  name: "Nori",
  species: "dog",
  personalityTags: ["curious"],
  talkingStyle: "gentle"
};

const baseContext = (wallet: CreditWallet, hasPremiumChatEntitlement = false): PremiumChatSessionContext => ({
  petId: "pet_mobile_001",
  petProfile,
  wallet,
  hasPremiumChatEntitlement
});

const emptyThread: PremiumChatThreadState = { conversationId: null, messages: [] };

const conversation: ChatTurnResponse["conversation"] = {
  id: "conv_live_001",
  userId: "user_anon_001",
  petId: "pet_mobile_001",
  type: "premium_ai_chat",
  status: "open",
  disclosureAcceptedAt: "2026-07-08T09:00:00.000Z",
  createdAt: "2026-07-08T09:00:00.000Z",
  updatedAt: "2026-07-08T09:01:00.000Z"
};

const userMessage: ChatTurnResponse["userMessage"] = {
  id: "msg_user_001",
  conversationId: conversation.id,
  sender: "user",
  text: "Hello tiny friend",
  safetyFlags: [],
  createdAt: "2026-07-08T09:01:00.000Z"
};

const petMessage: ChatTurnResponse["petMessage"] = {
  id: "msg_pet_001",
  conversationId: conversation.id,
  sender: "pet_ai",
  text: "Nori taps a lantern and listens.",
  safetyFlags: [],
  createdAt: "2026-07-08T09:01:01.000Z"
};

const okOutcome = (overrides: Partial<ChatTurnResponse> = {}): { ok: true; data: ChatTurnResponse } => ({
  ok: true,
  data: {
    conversation,
    userMessage,
    petMessage,
    safetyFlags: [],
    serverBalance: 0,
    chargedCredit: 0,
    crisisReferral: false,
    ...overrides
  }
});

const failOutcome = (error: MobileApiError) => ({ ok: false as const, error });

const fakeClient = {} as never;

beforeEach(() => {
  ensureSupabaseSessionMock.mockClear();
  ensureSupabaseSessionMock.mockResolvedValue({ ok: true, userId: "user_anon_001" });
  invokeSupabaseChatTurnMock.mockReset();
});

describe("normalizePremiumChatDraft", () => {
  it("collapses whitespace and trims the draft", () => {
    expect(normalizePremiumChatDraft("  hello    tiny   friend  ")).toBe("hello tiny friend");
  });
});

describe("startApiPremiumChatThread", () => {
  it("ensures a Supabase session and returns an empty local thread without any network call", async () => {
    const result = await startApiPremiumChatThread(fakeClient);

    expect(result).toEqual({ ok: true, thread: { conversationId: null, messages: [] } });
    expect(ensureSupabaseSessionMock).toHaveBeenCalledTimes(1);
    expect(invokeSupabaseChatTurnMock).not.toHaveBeenCalled();
  });

  it("surfaces a session error instead of a fake-ready thread", async () => {
    const sessionError: MobileApiError = {
      status: 0,
      code: "supabase_anonymous_sign_in_failed",
      messageSafe: "Could not start your session. Try again.",
      retryable: true
    };
    ensureSupabaseSessionMock.mockResolvedValueOnce({ ok: false, error: sessionError });

    const result = await startApiPremiumChatThread(fakeClient);

    expect(result).toEqual({ ok: false, error: sessionError });
  });
});

describe("sendApiPremiumChatTurn", () => {
  it("blocks an empty draft locally without invoking chat-turn", async () => {
    const context = baseContext({ userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 3, updatedAt: "2026-07-08T00:00:00.000Z" });

    const result = await sendApiPremiumChatTurn(fakeClient, context, emptyThread, "    ");

    expect(result).toEqual({
      ok: false,
      error: { status: 0, code: "empty_message", messageSafe: "Write a short message first.", retryable: false }
    });
    expect(invokeSupabaseChatTurnMock).not.toHaveBeenCalled();
  });

  it("blocks locally when the wallet has no ticket, credit, or Plus pass", async () => {
    const context = baseContext({ userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" });

    const result = await sendApiPremiumChatTurn(fakeClient, context, emptyThread, "hello");

    expect(result).toEqual({
      ok: false,
      error: { status: 0, code: "chat_locked", messageSafe: "Use a ticket, credit, or Plus pass to keep chatting.", retryable: false }
    });
    expect(invokeSupabaseChatTurnMock).not.toHaveBeenCalled();
  });

  it("sends charge:free and spends one local ticket on a successful free-ticket turn", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome());
    const wallet: CreditWallet = { userId: "u1", credits: 2, bonusCredits: 0, freeChatTickets: 3, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, context, emptyThread, "  Hello   tiny friend  ");

    expect(invokeSupabaseChatTurnMock).toHaveBeenCalledTimes(1);
    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody).toMatchObject({
      petId: "pet_mobile_001",
      text: "Hello tiny friend",
      disclosureAccepted: true,
      requestId: "11111111-1111-4111-8111-111111111111",
      charge: "free",
      petProfile: { name: "Nori", species: "dog", personalityTags: ["curious"], talkingStyle: "gentle" }
    });
    expect(sentBody.conversationId).toBeUndefined();

    expect(result).toEqual({
      ok: true,
      thread: { conversationId: conversation.id, messages: [userMessage, petMessage] },
      wallet: { ...wallet, freeChatTickets: 2, updatedAt: userMessage.createdAt },
      crisisReferral: false
    });
  });

  it("includes the existing conversationId once a thread is already open", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome());
    const wallet: CreditWallet = { userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 3, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);
    const openThread: PremiumChatThreadState = { conversationId: conversation.id, messages: [petMessage] };

    await sendApiPremiumChatTurn(fakeClient, context, openThread, "second turn");

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody.conversationId).toBe(conversation.id);
  });

  it("sends charge:free and never mutates the wallet for a Plus-pass turn", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome());
    const wallet: CreditWallet = { userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet, true);

    const result = await sendApiPremiumChatTurn(fakeClient, context, emptyThread, "hello");

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody.charge).toBe("free");
    expect(result).toEqual({
      ok: true,
      thread: { conversationId: conversation.id, messages: [userMessage, petMessage] },
      wallet,
      crisisReferral: false
    });
  });

  it("sends charge:credit and reconciles wallet.credits from the server balance, leaving bonusCredits/tickets untouched", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome({ serverBalance: 6, chargedCredit: 1 }));
    const wallet: CreditWallet = { userId: "u1", credits: 7, bonusCredits: 4, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, context, emptyThread, "hello");

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody.charge).toBe("credit");
    expect(result).toEqual({
      ok: true,
      thread: { conversationId: conversation.id, messages: [userMessage, petMessage] },
      wallet: { ...wallet, credits: 6, updatedAt: userMessage.createdAt },
      crisisReferral: false
    });
  });

  it("never spends a ticket or touches the wallet on a crisis-referral response", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(
      okOutcome({
        petMessage: { ...petMessage, sender: "system", text: "988...", safetyFlags: ["crisis_referral"] },
        safetyFlags: ["crisis_referral"],
        crisisReferral: true
      })
    );
    const wallet: CreditWallet = { userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 3, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, context, emptyThread, "I want to end my life");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.wallet).toEqual(wallet);
    expect(result.crisisReferral).toBe(true);
    expect(result.thread.messages[1]?.sender).toBe("system");
  });

  it("leaves the wallet untouched and surfaces the error when chat-turn fails", async () => {
    const error: MobileApiError = {
      status: 402,
      code: "insufficient_credits",
      messageSafe: "You're out of credits for this chat. Grab more credits and let's talk again soon.",
      retryable: false
    };
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(failOutcome(error));
    const wallet: CreditWallet = { userId: "u1", credits: 3, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, context, emptyThread, "hello");

    expect(result).toEqual({ ok: false, error });
  });
});
