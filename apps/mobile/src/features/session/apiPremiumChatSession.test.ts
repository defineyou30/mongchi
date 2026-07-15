import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111")
}));

const {
  ensureSupabaseSessionMock,
  invokeSupabaseChatTurnMock,
  loadSupabasePremiumChatThreadMock,
  purchaseSupabaseChatDayPassMock
} = vi.hoisted(() => ({
  ensureSupabaseSessionMock: vi.fn(),
  invokeSupabaseChatTurnMock: vi.fn(),
  loadSupabasePremiumChatThreadMock: vi.fn(),
  purchaseSupabaseChatDayPassMock: vi.fn()
}));

vi.mock("./supabaseGenerationSession", () => ({
  ensureSupabaseSession: ensureSupabaseSessionMock
}));

vi.mock("./supabasePremiumChatSession", () => ({
  invokeSupabaseChatTurn: invokeSupabaseChatTurnMock,
  loadSupabasePremiumChatThread: loadSupabasePremiumChatThreadMock,
  purchaseSupabaseChatDayPass: purchaseSupabaseChatDayPassMock
}));

import type { ChatTurnRequest, ChatTurnResponse, CreditWallet, PetProfile } from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";
import {
  normalizePremiumChatDraft,
  purchaseApiChatDayPass,
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

const koreanContext = (wallet: CreditWallet): PremiumChatSessionContext => ({
  ...baseContext(wallet),
  locale: "ko-KR"
});

const brazilianPortugueseContext = (wallet: CreditWallet): PremiumChatSessionContext => ({
  ...baseContext(wallet),
  locale: "pt-BR"
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
    chargeKind: "starter_free",
    freeTurnsRemaining: 2,
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
  loadSupabasePremiumChatThreadMock.mockReset();
  loadSupabasePremiumChatThreadMock.mockResolvedValue({ ok: true, thread: emptyThread });
  purchaseSupabaseChatDayPassMock.mockReset();
});

describe("normalizePremiumChatDraft", () => {
  it("collapses whitespace and trims the draft", () => {
    expect(normalizePremiumChatDraft("  hello    tiny   friend  ")).toBe("hello tiny friend");
  });
});

describe("startApiPremiumChatThread", () => {
  it("ensures a Supabase session and restores the pet's available conversation history", async () => {
    const restoredThread: PremiumChatThreadState = { conversationId: conversation.id, messages: [userMessage, petMessage] };
    loadSupabasePremiumChatThreadMock.mockResolvedValueOnce({ ok: true, thread: restoredThread });

    const result = await startApiPremiumChatThread(fakeClient, "pet_mobile_001");

    expect(result).toEqual({ ok: true, thread: restoredThread });
    expect(ensureSupabaseSessionMock).toHaveBeenCalledTimes(1);
    expect(loadSupabasePremiumChatThreadMock).toHaveBeenCalledWith(fakeClient, "pet_mobile_001");
    expect(invokeSupabaseChatTurnMock).not.toHaveBeenCalled();
  });

  it("uses deterministic localized copy for a session error instead of a fake-ready thread", async () => {
    const sessionError: MobileApiError = {
      status: 0,
      code: "supabase_anonymous_sign_in_failed",
      messageSafe: "Could not start your session. Try again.",
      retryable: true
    };
    ensureSupabaseSessionMock.mockResolvedValueOnce({ ok: false, error: sessionError });

    const result = await startApiPremiumChatThread(fakeClient, "pet_mobile_001");

    expect(result).toEqual({
      ok: false,
      error: { ...sessionError, messageSafe: "Could not start your cozy chat session. Try again." }
    });
    expect(loadSupabasePremiumChatThreadMock).not.toHaveBeenCalled();
  });

  it("surfaces a history-load error instead of silently hiding earlier messages", async () => {
    const historyError: MobileApiError = {
      status: 0,
      code: "chat_history_unavailable",
      messageSafe: "Could not load this chat yet. Try again.",
      retryable: true
    };
    loadSupabasePremiumChatThreadMock.mockResolvedValueOnce({ ok: false, error: historyError });

    const result = await startApiPremiumChatThread(fakeClient, "pet_mobile_001");

    expect(result).toEqual({ ok: false, error: historyError });
  });
});

describe("sendApiPremiumChatTurn", () => {
  it("blocks an empty draft locally without invoking chat-turn", async () => {
    const context = baseContext({ userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 3, updatedAt: "2026-07-08T00:00:00.000Z" });

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "    " });

    expect(result).toEqual({
      ok: false,
      error: { status: 0, code: "empty_message", messageSafe: "Write a short message first.", retryable: false }
    });
    expect(invokeSupabaseChatTurnMock).not.toHaveBeenCalled();
  });

  it("lets the server decide whether a wallet with no local value has a free allowance", async () => {
    const context = baseContext({ userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" });
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome({ freeTurnsRemaining: 2 }));

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "hello" });

    expect(result).toMatchObject({ ok: true, wallet: { freeChatTickets: 2 } });
    expect(invokeSupabaseChatTurnMock).toHaveBeenCalledTimes(1);
  });

  it("returns Korean deterministic validation errors for a Korean chat", async () => {
    const wallet: CreditWallet = { userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    const emptyResult = await sendApiPremiumChatTurn(fakeClient, {
      context: koreanContext(wallet),
      currentThread: emptyThread,
      text: "  "
    });
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(
      failOutcome({ status: 402, code: "insufficient_credits", messageSafe: "server", retryable: false })
    );
    const unavailableResult = await sendApiPremiumChatTurn(fakeClient, {
      context: koreanContext(wallet),
      currentThread: emptyThread,
      text: "안녕"
    });

    expect(emptyResult).toMatchObject({ ok: false, error: { code: "empty_message", messageSafe: "먼저 짧은 메시지를 적어주세요." } });
    expect(unavailableResult).toMatchObject({ ok: false, error: { code: "insufficient_credits", messageSafe: "대화에 사용할 크레딧이 부족해요. 준비되면 다시 포근하게 이야기해요." } });
  });

  it("returns Brazilian Portuguese validation copy and sends the normalized locale", async () => {
    const lockedWallet: CreditWallet = { userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const availableWallet: CreditWallet = { ...lockedWallet, freeChatTickets: 1 };

    const emptyResult = await sendApiPremiumChatTurn(fakeClient, {
      context: brazilianPortugueseContext(lockedWallet),
      currentThread: emptyThread,
      text: "  "
    });
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(
      failOutcome({ status: 402, code: "insufficient_credits", messageSafe: "server", retryable: false })
    );
    const unavailableResult = await sendApiPremiumChatTurn(fakeClient, {
      context: brazilianPortugueseContext(lockedWallet),
      currentThread: emptyThread,
      text: "olá"
    });
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome());
    await sendApiPremiumChatTurn(fakeClient, {
      context: brazilianPortugueseContext(availableWallet),
      currentThread: emptyThread,
      text: "olá"
    });

    expect(emptyResult).toMatchObject({ ok: false, error: { code: "empty_message", messageSafe: "Escreva uma mensagem curtinha primeiro." } });
    expect(unavailableResult).toMatchObject({ ok: false, error: { code: "insufficient_credits" } });
    expect(invokeSupabaseChatTurnMock).toHaveBeenCalledWith(fakeClient, expect.objectContaining({ locale: "pt-BR" }));
  });

  it("omits a client charge claim and reconciles the server-owned free allowance", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome({ serverBalance: 2, freeTurnsRemaining: 2 }));
    const wallet: CreditWallet = { userId: "u1", credits: 2, bonusCredits: 0, freeChatTickets: 3, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "  Hello   tiny friend  " });

    expect(invokeSupabaseChatTurnMock).toHaveBeenCalledTimes(1);
    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody).toMatchObject({
      petId: "pet_mobile_001",
      text: "Hello tiny friend",
      disclosureAccepted: true,
      requestId: "11111111-1111-4111-8111-111111111111",
      petProfile: { name: "Nori", species: "dog", personalityTags: ["curious"], talkingStyle: "gentle" }
    });
    expect(sentBody.conversationId).toBeUndefined();

    expect(result).toEqual({
      ok: true,
      thread: { conversationId: conversation.id, messages: [userMessage, petMessage] },
      wallet: { ...wallet, freeChatTickets: 2, updatedAt: userMessage.createdAt },
      crisisReferral: false,
      chargeKind: "starter_free"
    });
  });

  it("includes the existing conversationId once a thread is already open", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome());
    const wallet: CreditWallet = { userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 3, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);
    const openThread: PremiumChatThreadState = { conversationId: conversation.id, messages: [petMessage] };

    await sendApiPremiumChatTurn(fakeClient, { context, currentThread: openThread, text: "second turn" });

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody.conversationId).toBe(conversation.id);
  });

  it("reuses a caller-provided request id for an idempotent retry", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome());
    const wallet: CreditWallet = { userId: "u1", credits: 4, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    await sendApiPremiumChatTurn(fakeClient, {
      context: baseContext(wallet),
      currentThread: emptyThread,
      text: "retry me",
      requestId: "stable-request-id"
    });

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody.requestId).toBe("stable-request-id");
  });

  it("reconciles a server-confirmed Plus turn without a client charge claim", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome({ chargeKind: "plus", freeTurnsRemaining: 0 }));
    const wallet: CreditWallet = { userId: "u1", credits: 0, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet, true);

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "hello" });

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody).not.toHaveProperty("charge");
    expect(result).toEqual({
      ok: true,
      thread: { conversationId: conversation.id, messages: [userMessage, petMessage] },
      wallet: { ...wallet, updatedAt: userMessage.createdAt },
      crisisReferral: false,
      chargeKind: "plus"
    });
  });

  it("reconciles a server-confirmed credit turn and preserves local bonus value", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(okOutcome({ serverBalance: 6, chargedCredit: 1, chargeKind: "credit", freeTurnsRemaining: 0 }));
    const wallet: CreditWallet = { userId: "u1", credits: 7, bonusCredits: 4, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "hello" });

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody).not.toHaveProperty("charge");
    expect(result).toEqual({
      ok: true,
      thread: { conversationId: conversation.id, messages: [userMessage, petMessage] },
      wallet: { ...wallet, credits: 6, updatedAt: userMessage.createdAt },
      crisisReferral: false,
      chargeKind: "credit"
    });
  });

  it("reconciles a server-confirmed day-pass turn without inventing a per-turn charge or a ticket decrement", async () => {
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(
      okOutcome({ serverBalance: 4, chargedCredit: 0, chargeKind: "day_pass", freeTurnsRemaining: 0 })
    );
    const wallet: CreditWallet = { userId: "u1", credits: 4, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "hello" });

    const sentBody = invokeSupabaseChatTurnMock.mock.calls[0]![1] as ChatTurnRequest;
    expect(sentBody).not.toHaveProperty("charge");
    expect(result).toEqual({
      ok: true,
      thread: { conversationId: conversation.id, messages: [userMessage, petMessage] },
      // Day-pass turns charge nothing: serverBalance reflects the untouched
      // balance and freeTurnsRemaining reflects the untouched ticket count --
      // reconciliation just mirrors whatever the server sent back, with no
      // client-invented decrement for either.
      wallet: { ...wallet, updatedAt: userMessage.createdAt },
      crisisReferral: false,
      chargeKind: "day_pass"
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

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "I want to end my life" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.wallet).toEqual(wallet);
    expect(result.crisisReferral).toBe(true);
    expect(result.thread.messages[1]?.sender).toBe("system");
  });

  it("leaves the wallet untouched and uses deterministic copy when chat-turn fails", async () => {
    const error: MobileApiError = {
      status: 402,
      code: "insufficient_credits",
      messageSafe: "You're out of credits for this chat. Grab more credits and let's talk again soon.",
      retryable: false
    };
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(failOutcome(error));
    const wallet: CreditWallet = { userId: "u1", credits: 3, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };
    const context = baseContext(wallet);

    const result = await sendApiPremiumChatTurn(fakeClient, { context, currentThread: emptyThread, text: "hello" });

    expect(result).toEqual({
      ok: false,
      error: { ...error, messageSafe: "You're out of credits for this chat. More cozy talks can wait until you're ready." }
    });
  });

  it("localizes deterministic server errors before a Korean screen renders them", async () => {
    const error: MobileApiError = {
      status: 429,
      code: "rate_limited",
      messageSafe: "Please wait before trying again.",
      retryable: true
    };
    invokeSupabaseChatTurnMock.mockResolvedValueOnce(failOutcome(error));
    const wallet: CreditWallet = { userId: "u1", credits: 1, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    const result = await sendApiPremiumChatTurn(fakeClient, {
      context: koreanContext(wallet),
      currentThread: emptyThread,
      text: "안녕"
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "rate_limited", messageSafe: "대화가 잠깐 쉬어갈 시간이 필요해요. 곧 다시 시도해 주세요." }
    });
  });
});

describe("purchaseApiChatDayPass", () => {
  it("reconciles the wallet from the server-owned balance after a fresh purchase", async () => {
    purchaseSupabaseChatDayPassMock.mockResolvedValueOnce({
      ok: true,
      data: { alreadyActive: false, dayPassExpiresAt: "2026-07-09T09:00:00.000Z", serverBalance: 4 }
    });
    const wallet: CreditWallet = { userId: "u1", credits: 7, bonusCredits: 2, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    const result = await purchaseApiChatDayPass(fakeClient, { wallet }, "stable-purchase-id");

    expect(purchaseSupabaseChatDayPassMock).toHaveBeenCalledWith(fakeClient, "stable-purchase-id");
    expect(result).toEqual({
      ok: true,
      alreadyActive: false,
      dayPassExpiresAt: "2026-07-09T09:00:00.000Z",
      // bonusCredits untouched -- same convention as sendApiPremiumChatTurn's
      // wallet reconciliation (credits mirrors serverBalance only).
      wallet: { ...wallet, credits: 4 }
    });
  });

  it("reuses a caller-provided request id so a retry stays idempotent", async () => {
    purchaseSupabaseChatDayPassMock.mockResolvedValueOnce({
      ok: true,
      data: { alreadyActive: false, dayPassExpiresAt: "2026-07-09T09:00:00.000Z", serverBalance: 1 }
    });
    const wallet: CreditWallet = { userId: "u1", credits: 4, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    await purchaseApiChatDayPass(fakeClient, { wallet }, "retry-request-id");

    expect(purchaseSupabaseChatDayPassMock).toHaveBeenCalledWith(fakeClient, "retry-request-id");
  });

  it("generates a request id when the caller doesn't supply one", async () => {
    purchaseSupabaseChatDayPassMock.mockResolvedValueOnce({
      ok: true,
      data: { alreadyActive: false, dayPassExpiresAt: "2026-07-09T09:00:00.000Z", serverBalance: 1 }
    });
    const wallet: CreditWallet = { userId: "u1", credits: 4, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    await purchaseApiChatDayPass(fakeClient, { wallet });

    expect(purchaseSupabaseChatDayPassMock).toHaveBeenCalledWith(fakeClient, "11111111-1111-4111-8111-111111111111");
  });

  it("treats an already-active pass as a relationship-frame success, not a transaction failure", async () => {
    purchaseSupabaseChatDayPassMock.mockResolvedValueOnce({
      ok: true,
      data: { alreadyActive: true, dayPassExpiresAt: "2026-07-09T09:00:00.000Z", serverBalance: 4 }
    });
    const wallet: CreditWallet = { userId: "u1", credits: 4, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    const result = await purchaseApiChatDayPass(fakeClient, { wallet }, "already-active-request-id");

    expect(result).toEqual({
      ok: true,
      alreadyActive: true,
      dayPassExpiresAt: "2026-07-09T09:00:00.000Z",
      wallet: { ...wallet, credits: 4 }
    });
  });

  it("localizes an insufficient-credits purchase failure for a Korean screen", async () => {
    purchaseSupabaseChatDayPassMock.mockResolvedValueOnce({
      ok: false,
      error: { status: 402, code: "insufficient_credits", messageSafe: "server copy", retryable: false }
    });
    const wallet: CreditWallet = { userId: "u1", credits: 1, bonusCredits: 0, freeChatTickets: 0, updatedAt: "2026-07-08T00:00:00.000Z" };

    const result = await purchaseApiChatDayPass(fakeClient, { wallet, locale: "ko-KR" }, "req-id");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "insufficient_credits", messageSafe: "대화에 사용할 크레딧이 부족해요. 준비되면 다시 포근하게 이야기해요." }
    });
  });
});
