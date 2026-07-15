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

import {
  deleteSupabaseChatHistory,
  invokeSupabaseChatTurn,
  loadSupabaseChatAllowance,
  loadSupabasePremiumChatThread,
  purchaseSupabaseChatDayPass,
  reportSupabaseChatMessage
} from "./supabasePremiumChatSession";

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
          data: options.invokeData ?? {
            conversation,
            userMessage,
            petMessage,
            safetyFlags: [],
            serverBalance: 4,
            chargedCredit: 0,
            chargeKind: "starter_free",
            freeTurnsRemaining: 2,
            crisisReferral: false
          },
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
        chargeKind: "starter_free",
        freeTurnsRemaining: 2,
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

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

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

  it("accepts the day_pass charge kind as-is instead of defaulting it away", async () => {
    const { client } = createFakeSupabaseClient({
      invokeData: {
        conversation,
        userMessage,
        petMessage,
        safetyFlags: [],
        serverBalance: 4,
        chargedCredit: 0,
        chargeKind: "day_pass",
        freeTurnsRemaining: 0,
        crisisReferral: false
      }
    });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toMatchObject({ ok: true, data: { chargeKind: "day_pass" } });
  });

  it("falls back to the credit charge kind for a value the server never sends", async () => {
    const { client } = createFakeSupabaseClient({
      invokeData: {
        conversation,
        userMessage,
        petMessage,
        safetyFlags: [],
        serverBalance: 4,
        chargedCredit: 0,
        chargeKind: "not_a_real_kind" as ChatTurnResponse["chargeKind"],
        freeTurnsRemaining: 0,
        crisisReferral: false
      }
    });

    const result = await invokeSupabaseChatTurn(client as never, chatTurnRequest);

    expect(result).toMatchObject({ ok: true, data: { chargeKind: "credit" } });
  });
});

describe("loadSupabasePremiumChatThread", () => {
  const createHistoryClient = (conversationData: unknown, messageData: unknown) => {
    const conversationBuilder = {
      eq: vi.fn(() => conversationBuilder),
      order: vi.fn(() => conversationBuilder),
      limit: vi.fn(() => conversationBuilder),
      maybeSingle: vi.fn(async () => ({ data: conversationData, error: null }))
    };
    const messageBuilder = {
      eq: vi.fn(() => messageBuilder),
      order: vi.fn(() => messageBuilder),
      limit: vi.fn(async () => ({ data: messageData, error: null }))
    };
    const client = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => (table === "conversations" ? conversationBuilder : messageBuilder))
      }))
    };

    return { client, conversationBuilder, messageBuilder };
  };

  it("restores every available raw message in chronological order", async () => {
    const rows = [
      {
        id: petMessage.id,
        conversation_id: conversation.id,
        sender: petMessage.sender,
        text: petMessage.text,
        safety_flags: petMessage.safetyFlags,
        created_at: petMessage.createdAt
      },
      {
        id: userMessage.id,
        conversation_id: conversation.id,
        sender: userMessage.sender,
        text: userMessage.text,
        safety_flags: userMessage.safetyFlags,
        created_at: userMessage.createdAt
      }
    ];
    const { client, messageBuilder } = createHistoryClient({ id: conversation.id }, rows);

    const result = await loadSupabasePremiumChatThread(client as never, "pet_mobile_001");

    expect(result).toEqual({ ok: true, thread: { conversationId: conversation.id, messages: [userMessage, petMessage] } });
    expect(messageBuilder.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(messageBuilder.order).toHaveBeenNthCalledWith(2, "sender", { ascending: true });
    expect(messageBuilder.order).toHaveBeenNthCalledWith(3, "id", { ascending: false });
    expect(messageBuilder.limit).toHaveBeenCalledWith(100);
  });

  it("breaks a same-second tie within one turn by putting the user's message before the pet's, regardless of raw row order", async () => {
    const sameSecond = "2026-07-08T09:01:00.000Z";
    const rows = [
      // Deliberately user-first in the raw rows -- a naive reverse() of a
      // desc-ordered query would flip this pair and put the pet's reply
      // first, which is exactly the real-device bug this guards against.
      {
        id: userMessage.id,
        conversation_id: conversation.id,
        sender: "user",
        text: userMessage.text,
        safety_flags: userMessage.safetyFlags,
        created_at: sameSecond
      },
      {
        id: petMessage.id,
        conversation_id: conversation.id,
        sender: "pet_ai",
        text: petMessage.text,
        safety_flags: petMessage.safetyFlags,
        created_at: sameSecond
      }
    ];
    const { client } = createHistoryClient({ id: conversation.id }, rows);

    const result = await loadSupabasePremiumChatThread(client as never, "pet_mobile_001");

    expect(result).toMatchObject({
      ok: true,
      thread: {
        messages: [
          { id: userMessage.id, sender: "user" },
          { id: petMessage.id, sender: "pet_ai" }
        ]
      }
    });
  });

  it("falls back to ascending id order when both created_at and sender tie", async () => {
    const sameSecond = "2026-07-08T09:01:00.000Z";
    const rows = [
      { id: "msg_system_002", conversation_id: conversation.id, sender: "system", text: "second", safety_flags: [], created_at: sameSecond },
      { id: "msg_system_001", conversation_id: conversation.id, sender: "system", text: "first", safety_flags: [], created_at: sameSecond }
    ];
    const { client } = createHistoryClient({ id: conversation.id }, rows);

    const result = await loadSupabasePremiumChatThread(client as never, "pet_mobile_001");

    expect(result).toMatchObject({
      ok: true,
      thread: { messages: [{ id: "msg_system_001" }, { id: "msg_system_002" }] }
    });
  });

  it("keeps the latest 100 messages and returns them in ascending UI order", async () => {
    const newestFirst = Array.from({ length: 105 }, (_, offset) => {
      const sequence = 104 - offset;

      return {
        id: `message-${sequence.toString().padStart(3, "0")}`,
        conversation_id: conversation.id,
        sender: sequence % 2 === 0 ? "user" : "pet_ai",
        text: `Message ${sequence}`,
        safety_flags: [],
        created_at: new Date(Date.UTC(2026, 6, 10, 10, sequence)).toISOString()
      };
    });
    const { client } = createHistoryClient({ id: conversation.id }, newestFirst);

    const result = await loadSupabasePremiumChatThread(client as never, "pet_mobile_001");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.thread.messages).toHaveLength(100);
    expect(result.thread.messages[0]?.id).toBe("message-005");
    expect(result.thread.messages.at(-1)?.id).toBe("message-104");
  });

  it("returns an empty thread when the pet has no open conversation", async () => {
    const { client } = createHistoryClient(null, []);

    await expect(loadSupabasePremiumChatThread(client as never, "pet_mobile_001")).resolves.toEqual({
      ok: true,
      thread: { conversationId: null, messages: [] }
    });
  });

  it("rejects malformed history instead of displaying unparsed server data", async () => {
    const { client } = createHistoryClient({ id: conversation.id }, [{ ...userMessage, sender: "unknown" }]);

    const result = await loadSupabasePremiumChatThread(client as never, "pet_mobile_001");

    expect(result).toMatchObject({ ok: false, error: { code: "chat_history_response_invalid", retryable: true } });
  });
});

describe("reportSupabaseChatMessage", () => {
  it("reports an AI response through the ownership-checking RPC", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      rpc: vi.fn(async () => ({ data: "report-001", error: null }))
    };

    const result = await reportSupabaseChatMessage(client as never, "msg_pet_001", "harmful");

    expect(result).toEqual({ ok: true, reportId: "report-001" });
    expect(client.rpc).toHaveBeenCalledWith("report_chat_message", {
      p_message_id: "msg_pet_001",
      p_reason: "harmful"
    });
  });

  it("returns safe retry copy when the report RPC fails", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      rpc: vi.fn(async () => ({ data: null, error: { message: "database unavailable" } }))
    };

    await expect(reportSupabaseChatMessage(client as never, "msg_pet_001", "other")).resolves.toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_report_failed",
        messageSafe: "Could not send this report. Try again.",
        retryable: true
      }
    });
  });
});

describe("purchaseSupabaseChatDayPass", () => {
  const createFakePurchaseClient = (options: {
    session?: { user: { id: string }; access_token?: string } | null;
    invokeError?: { message: string; context?: { status?: number; json?: () => Promise<unknown> } } | null;
    invokeData?: { dayPassExpiresAt?: string | null; serverBalance?: number } | null;
  } = {}) => {
    const invokeCalls: Array<{ name: string; body: unknown }> = [];
    let currentSession =
      options.session !== undefined ? options.session : { user: { id: "user_anon_001" }, access_token: "token_anon_001" };

    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: currentSession } })),
        signInAnonymously: vi.fn(async () => {
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
            data: options.invokeData ?? { dayPassExpiresAt: "2026-07-14T09:00:00.000Z", serverBalance: 1 },
            error: null
          };
        })
      }
    };

    return { client, invokeCalls };
  };

  it("ensures a session and invokes purchase-chat-pass with the snake_case request body", async () => {
    const { client, invokeCalls } = createFakePurchaseClient();

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result).toEqual({
      ok: true,
      data: { alreadyActive: false, dayPassExpiresAt: "2026-07-14T09:00:00.000Z", serverBalance: 1 }
    });
    expect(invokeCalls).toEqual([{ name: "purchase-chat-pass", body: { request_id: "purchase_req_001" } }]);
  });

  it("signs in anonymously first when there is no existing session", async () => {
    const { client } = createFakePurchaseClient({ session: null });

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result.ok).toBe(true);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("treats a 409 already-active response as a success, not a purchase failure", async () => {
    const { client } = createFakePurchaseClient({
      invokeError: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 409,
          json: async () => ({
            error: "already_active",
            message: "Your chat day pass is already active -- no need to buy another one just yet.",
            dayPassExpiresAt: "2026-07-14T09:00:00.000Z",
            serverBalance: 4
          })
        }
      }
    });

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result).toEqual({
      ok: true,
      data: { alreadyActive: true, dayPassExpiresAt: "2026-07-14T09:00:00.000Z", serverBalance: 4 }
    });
  });

  it("maps a 402 invoke error to the insufficient-credits copy", async () => {
    const { client } = createFakePurchaseClient({
      invokeError: { message: "Edge Function returned a non-2xx status code", context: { status: 402 } }
    });

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result).toEqual({
      ok: false,
      error: {
        status: 402,
        code: "insufficient_credits",
        messageSafe: "You need a few more credits to grab a chat day pass.",
        retryable: false
      }
    });
  });

  it("maps a 503 invoke error to a retryable chat-unavailable message", async () => {
    const { client } = createFakePurchaseClient({
      invokeError: { message: "chat disabled", context: { status: 503 } }
    });

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result).toEqual({
      ok: false,
      error: {
        status: 503,
        code: "chat_unavailable",
        messageSafe: "Could not start your chat day pass. Try again.",
        retryable: true
      }
    });
  });

  it("falls back to a generic retryable message for an unrecognized status", async () => {
    const { client } = createFakePurchaseClient({
      invokeError: { message: "boom", context: { status: 500 } }
    });

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result).toEqual({
      ok: false,
      error: {
        status: 500,
        code: "chat_day_pass_purchase_failed",
        messageSafe: "Could not start your chat day pass. Try again.",
        retryable: true
      }
    });
  });

  it("treats a malformed success payload as a retryable invalid-response error", async () => {
    const { client } = createFakePurchaseClient({ invokeData: { serverBalance: 1 } });

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result).toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_day_pass_response_invalid",
        messageSafe: "Could not start your chat day pass. Try again.",
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

    const result = await purchaseSupabaseChatDayPass(client as never, "purchase_req_001");

    expect(result).toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_day_pass_invoke_failed",
        messageSafe: "Could not start your chat day pass. Try again.",
        retryable: true
      }
    });
  });
});

describe("loadSupabaseChatAllowance", () => {
  const createAllowanceClient = (
    data: unknown,
    error: { message: string } | null = null,
    session: { user: { id: string } } | null = { user: { id: "user_anon_001" } }
  ) => {
    const builder = {
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data, error }))
    };
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session } })),
        signInAnonymously: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } }, error: null }))
      },
      from: vi.fn((table: string) => {
        expect(table).toBe("chat_access");

        return { select: vi.fn(() => builder) };
      })
    };

    return { client, builder };
  };

  it("combines starter_free_remaining and an unused daily turn into the free-turns count", async () => {
    const { client } = createAllowanceClient({ starter_free_remaining: 2, daily_free_on: null });

    const result = await loadSupabaseChatAllowance(client as never);

    expect(result).toEqual({
      ok: true,
      allowance: { starterFreeRemaining: 2, dailyFreeOn: null, freeChatTurnsRemaining: 3, dayPassExpiresAt: null }
    });
  });

  it("excludes today's daily turn once it has already been used today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { client } = createAllowanceClient({ starter_free_remaining: 0, daily_free_on: today });

    const result = await loadSupabaseChatAllowance(client as never);

    expect(result).toEqual({
      ok: true,
      allowance: { starterFreeRemaining: 0, dailyFreeOn: today, freeChatTurnsRemaining: 0, dayPassExpiresAt: null }
    });
  });

  it("defaults to the 0014 migration's row defaults (starter 3 + daily 1 = 4) when no chat_access row exists yet", async () => {
    const { client } = createAllowanceClient(null);

    const result = await loadSupabaseChatAllowance(client as never);

    expect(result).toEqual({
      ok: true,
      allowance: { starterFreeRemaining: 3, dailyFreeOn: null, freeChatTurnsRemaining: 4, dayPassExpiresAt: null }
    });
  });

  it("returns day_pass_expires_at as-is so the caller can decide whether the pass is still active", async () => {
    const { client } = createAllowanceClient({
      starter_free_remaining: 0,
      daily_free_on: null,
      day_pass_expires_at: "2026-07-14T09:00:00.000Z"
    });

    const result = await loadSupabaseChatAllowance(client as never);

    expect(result).toMatchObject({ ok: true, allowance: { dayPassExpiresAt: "2026-07-14T09:00:00.000Z" } });
  });

  it("ignores a malformed day_pass_expires_at value instead of surfacing it as a real expiry", async () => {
    const { client } = createAllowanceClient({
      starter_free_remaining: 0,
      daily_free_on: null,
      day_pass_expires_at: 12345
    });

    const result = await loadSupabaseChatAllowance(client as never);

    expect(result).toMatchObject({ ok: true, allowance: { dayPassExpiresAt: null } });
  });

  it("signs in anonymously first when there is no existing session", async () => {
    const { client } = createAllowanceClient({ starter_free_remaining: 3, daily_free_on: null }, null, null);

    const result = await loadSupabaseChatAllowance(client as never);

    expect(result.ok).toBe(true);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("returns a retryable error when the chat_access query fails", async () => {
    const { client } = createAllowanceClient(null, { message: "database unavailable" });

    await expect(loadSupabaseChatAllowance(client as never)).resolves.toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_allowance_unavailable",
        messageSafe: "Could not load today's free chats. Try again.",
        retryable: true
      }
    });
  });

  it("shields a thrown query call into a retryable error instead of propagating", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      from: vi.fn(() => {
        throw new Error("network exploded");
      })
    };

    await expect(loadSupabaseChatAllowance(client as never)).resolves.toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_allowance_invoke_failed",
        messageSafe: "Could not load today's free chats. Try again.",
        retryable: true
      }
    });
  });
});

describe("deleteSupabaseChatHistory", () => {
  it("deletes the caller's own live chat history through the ownership-scoped RPC", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      rpc: vi.fn(async () => ({ data: 12, error: null }))
    };

    const result = await deleteSupabaseChatHistory(client as never);

    expect(result).toEqual({ ok: true, deletedCount: 12 });
    expect(client.rpc).toHaveBeenCalledWith("delete_own_chat_history");
  });

  it("returns safe retry copy instead of a fake success when the RPC fails", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      rpc: vi.fn(async () => ({ data: null, error: { message: "database unavailable" } }))
    };

    await expect(deleteSupabaseChatHistory(client as never)).resolves.toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_history_delete_failed",
        messageSafe: "Could not delete your chat history. Try again.",
        retryable: true
      }
    });
  });

  it("shields a thrown RPC call into a retryable error instead of propagating", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      rpc: vi.fn(async () => {
        throw new Error("network exploded");
      })
    };

    await expect(deleteSupabaseChatHistory(client as never)).resolves.toEqual({
      ok: false,
      error: {
        status: 0,
        code: "chat_history_delete_failed",
        messageSafe: "Could not delete your chat history. Try again.",
        retryable: true
      }
    });
  });
});
