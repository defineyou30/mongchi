import { describe, expect, it, vi } from "vitest";

// supabasePremiumChatSession.ts imports ensureSupabaseSession/readInvokeErrorBody/
// toMobileError from supabaseGenerationSession.ts, which in turn imports these
// native modules at the top level -- none of them are actually exercised by
// invokeSupabaseChatTurn itself, but the module graph still needs them
// resolvable, so this test mocks them the same way supabaseGenerationSession.test.ts does.
vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111")
}));

vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { PNG: "png", JPEG: "jpeg", WEBP: "webp" },
  manipulateAsync: vi.fn(async (uri: string) => ({ uri: `manipulated://${uri}`, width: 1024, height: 768 }))
}));

vi.mock("expo-file-system/legacy", () => ({
  uploadAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 }
}));

vi.mock("./supabaseClient", () => ({
  getConfiguredSupabaseUrl: vi.fn(() => "https://project.supabase.co"),
  getConfiguredSupabaseAnonKey: vi.fn(() => "anon-key-001")
}));

import type { ChatTurnRequest, ChatTurnResponse } from "@mongchi/shared";

import { invokeSupabaseChatTurn } from "./supabasePremiumChatSession";

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

const chatTurnRequest: ChatTurnRequest = {
  petId: "pet_mobile_001",
  text: "Hello tiny friend",
  disclosureAccepted: true,
  requestId: "11111111-1111-4111-8111-111111111111",
  charge: "free",
  locale: "en-US",
  petProfile: { name: "Nori", species: "dog" }
};

interface FakeSupabaseClientOptions {
  session?: { user: { id: string }; access_token?: string } | null;
  signInError?: { message: string } | null;
  invokeError?: { message: string; context?: { status?: number; json?: () => Promise<unknown> } } | null;
  invokeData?: Partial<ChatTurnResponse> | null;
}

const createFakeSupabaseClient = (options: FakeSupabaseClientOptions = {}) => {
  const invokeCalls: Array<{ name: string; body: unknown }> = [];
  let currentSession =
    options.session !== undefined ? options.session : { user: { id: "user_anon_001" }, access_token: "token_anon_001" };

  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: currentSession } })),
      signInAnonymously: vi.fn(async () => {
        if (options.signInError) {
          return { data: { session: null }, error: options.signInError };
        }

        currentSession = { user: { id: "user_anon_001" }, access_token: "token_anon_001" };

        return { data: { session: currentSession }, error: null };
      })
    },
    functions: {
      invoke: vi.fn(async (name: string, init: { body: unknown }) => {
        invokeCalls.push({ name, body: init.body });

        if (options.invokeError) {
          return { data: null, error: options.invokeError };
        }

        return {
          data: options.invokeData ?? { conversation, userMessage, petMessage, safetyFlags: [], serverBalance: 4, chargedCredit: 0, crisisReferral: false },
          error: null
        };
      })
    }
  };

  return { client, invokeCalls };
};

describe("invokeSupabaseChatTurn", () => {
  it("ensures a session, invokes chat-turn with the request body, and normalizes the response", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient();

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toEqual({
      ok: true,
      data: {
        conversation,
        userMessage,
        petMessage,
        safetyFlags: [],
        serverBalance: 4,
        chargedCredit: 0,
        crisisReferral: false
      }
    });
    expect(invokeCalls).toEqual([{ name: "chat-turn", body: chatTurnRequest }]);
  });

  it("signs in anonymously first when there is no existing session", async () => {
    const { client } = createFakeSupabaseClient({ session: null });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result.ok).toBe(true);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("surfaces a retryable error when anonymous sign-in fails", async () => {
    const { client } = createFakeSupabaseClient({ session: null, signInError: { message: "network down" } });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        status: 0,
        code: "supabase_anonymous_sign_in_failed",
        messageSafe: "Could not start your session. Try again.",
        retryable: true
      }
    });
  });

  it("maps a 402 invoke error to the insufficient-credits copy", async () => {
    const { client } = createFakeSupabaseClient({ invokeError: { message: "Edge Function returned a non-2xx status code", context: { status: 402 } } });

    const result = await invokeSupabaseChatTurn(client as never, { ...chatTurnRequest, charge: "credit" });

    expect(result).toEqual({
      ok: false,
      error: {
        status: 402,
        code: "insufficient_credits",
        messageSafe: "You're out of credits for this chat. Grab more credits and let's talk again soon.",
        retryable: false
      }
    });
  });

  it("maps a 429 invoke error to a retryable rate-limit message", async () => {
    const { client } = createFakeSupabaseClient({ invokeError: { message: "rate limited", context: { status: 429 } } });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        status: 429,
        code: "rate_limited",
        messageSafe: "Let's take a little breather -- try again in a minute.",
        retryable: true
      }
    });
  });

  it("prefers the server's own message copy for a 422 moderation rejection when the body can be read", async () => {
    const { client } = createFakeSupabaseClient({
      invokeError: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 422,
          json: async () => ({ error: "message_too_long", message: "Keep premium chat messages under 500 characters." })
        }
      }
    });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        status: 422,
        code: "message_rejected",
        messageSafe: "Keep premium chat messages under 500 characters.",
        retryable: false
      }
    });
  });

  it("falls back to a generic retryable message for an unrecognized status", async () => {
    const { client } = createFakeSupabaseClient({ invokeError: { message: "boom", context: { status: 500 } } });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        status: 500,
        code: "chat_turn_failed",
        messageSafe: "Could not reach chat right now. Try again.",
        retryable: true
      }
    });
  });

  it("treats a malformed success payload as a retryable invalid-response error", async () => {
    const { client } = createFakeSupabaseClient({ invokeData: { safetyFlags: [] } });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_turn_response_invalid",
        messageSafe: "Could not reach chat right now. Try again.",
        retryable: true
      }
    });
  });

  it("shields a thrown invoke call into a retryable error instead of propagating", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      functions: {
        invoke: vi.fn(async () => {
          throw new Error("network exploded");
        })
      }
    };

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_turn_invoke_failed",
        messageSafe: "Could not reach chat right now. Try again.",
        retryable: true
      }
    });
  });
});
