import { describe, expect, it } from "vitest";

import type { Conversation, PetProfile } from "@mongchi/shared";

import type { ApiRuntimeConfig } from "../apiRuntimeConfig";
import {
  PremiumChatProviderUnavailableError,
  createLocalPremiumChatProvider,
  createOpenAiPremiumChatProvider,
  createOpenAiPremiumChatProviderFromRuntimeConfig,
  type OpenAiPremiumChatFetch,
  type PremiumChatProviderInput
} from "../premiumChatProvider";

const pet: PetProfile = {
  id: "pet_chat_001",
  userId: "user_chat_001",
  name: "Nori",
  species: "dog",
  personalityTags: ["curious", "affectionate"],
  talkingStyle: "gentle",
  favoriteThing: "moss pillows",
  memoryNote: "Likes tiny lanterns.",
  lifecycleStatus: "active",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const conversation: Conversation = {
  id: "conv_chat_001",
  userId: "user_chat_001",
  petId: "pet_chat_001",
  type: "premium_ai_chat",
  status: "open",
  disclosureAcceptedAt: "2026-06-24T09:00:00.000Z",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const providerInput: PremiumChatProviderInput = {
  auth: {
    userId: "user_chat_001",
    locale: "en-US",
    timezone: "America/New_York"
  },
  conversation,
  pet,
  userText: "Hello tiny friend",
  safetyFlags: [],
  now: "2026-06-24T09:05:00.000Z"
};

const responseWithOutputText = (text: string) => ({
  status: 200,
  json: async () => ({
    output: [
      {
        content: [
          {
            type: "output_text",
            text
          }
        ]
      }
    ]
  })
});

const responseWithRefusal = () => ({
  status: 200,
  json: async () => ({
    output: [
      {
        content: [
          {
            refusal: "I cannot comply."
          }
        ]
      }
    ]
  })
});

const successfulFetch = (
  requests: Array<{ url: string; init: Parameters<OpenAiPremiumChatFetch>[1] }>,
  output: unknown
): OpenAiPremiumChatFetch => {
  const text = JSON.stringify(output);

  return async (url, init) => {
    requests.push({ url, init });

    return responseWithOutputText(text);
  };
};

describe("premium chat providers", () => {
  it("keeps the local provider as a backend-only mock fallback", async () => {
    const provider = createLocalPremiumChatProvider();

    await expect(provider.generateReply(providerInput)).resolves.toEqual({
      text: "Nori tilts closer. This is a mock moderated AI gateway response; real provider output stays backend-only.",
      safetyFlags: []
    });
  });

  it("calls OpenAI Responses with structured output and parses the pet reply", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiPremiumChatFetch>[1] }> = [];
    const provider = createOpenAiPremiumChatProvider({
      apiKey: " sk-premium-chat ",
      model: "gpt-5.5",
      baseUrl: "https://api.example.test/v1/",
      maxOutputTokens: 320,
      fetch: successfulFetch(requests, {
        replyText: "Nori taps the glass with a tiny paw. I am listening from the moss.",
        safetyFlags: [" Warm Reply "]
      })
    });

    const result = await provider.generateReply({
      ...providerInput,
      recentMessages: [
        {
          id: "msg_recent_001",
          conversationId: conversation.id,
          sender: "pet_ai",
          text: "I saved a warm spot by the moss.",
          safetyFlags: [],
          createdAt: "2026-06-24T09:04:00.000Z"
        }
      ]
    });

    expect(result).toEqual({
      text: "Nori taps the glass with a tiny paw. I am listening from the moss.",
      safetyFlags: ["warm_reply"]
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.example.test/v1/responses");
    expect(requests[0]?.init.headers).toEqual({
      Authorization: "Bearer sk-premium-chat",
      "Content-Type": "application/json"
    });

    const body = JSON.parse(requests[0]?.init.body ?? "{}") as {
      model?: unknown;
      store?: unknown;
      max_output_tokens?: unknown;
      instructions?: unknown;
      input?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
      text?: { verbosity?: unknown; format?: Record<string, unknown> };
      metadata?: Record<string, unknown>;
    };
    const inputText = body.input?.[0]?.content?.find((part) => part.type === "input_text")?.text ?? "";
    const instructions = typeof body.instructions === "string" ? body.instructions : "";

    expect(body.model).toBe("gpt-5.5");
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(320);
    expect(body.text).toMatchObject({
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "tiny_pet_premium_chat_reply",
        strict: true
      }
    });
    expect(body.metadata).toMatchObject({
      feature: "premium_chat",
      conversation_id: "conv_chat_001",
      pet_id: "pet_chat_001"
    });
    expect(instructions).toContain("inside the phone");
    expect(instructions).not.toContain("terrarium");
    expect(instructions).not.toContain("tiny garden");
    expect(inputText).toContain("Hello tiny friend");
    expect(inputText).toContain("Nori");
    expect(inputText).toContain("I saved a warm spot by the moss.");
  });

  it("maps OpenAI refusals to a safe localized pet reply", async () => {
    const provider = createOpenAiPremiumChatProvider({
      apiKey: "sk-premium-chat",
      fetch: async () => responseWithRefusal()
    });

    await expect(
      provider.generateReply({
        ...providerInput,
        auth: {
          ...providerInput.auth,
          locale: "ko-KR",
          timezone: "Asia/Seoul"
        }
      })
    ).resolves.toEqual({
      text: "지금 그 이야기는 안전하게 답하기 어려워요. 네 곁에서 편안한 이야기로 천천히 이어가요.",
      safetyFlags: ["provider_refusal"]
    });
  });

  it("fails closed for provider HTTP failures and missing runtime config", async () => {
    const provider = createOpenAiPremiumChatProvider({
      apiKey: "sk-premium-chat",
      fetch: async () => ({
        status: 503,
        json: async () => ({
          error: "raw provider failure"
        })
      })
    });

    await expect(provider.generateReply(providerInput)).rejects.toThrow(PremiumChatProviderUnavailableError);
    expect(() =>
      createOpenAiPremiumChatProviderFromRuntimeConfig({
        releaseProfile: "development",
        production: false,
        allowMockGenerationPolling: true,
        auth: null,
        database: null,
        storage: null,
        commerceWebhookSecret: null,
        storeVerifier: null,
        premiumChat: null
      })
    ).toThrow("API runtime config is missing OpenAI premium chat settings.");
  });

  it("builds the OpenAI provider from API runtime config", async () => {
    const requests: Array<{ url: string; init: Parameters<OpenAiPremiumChatFetch>[1] }> = [];
    const config: ApiRuntimeConfig = {
      releaseProfile: "production",
      production: true,
      allowMockGenerationPolling: false,
      auth: null,
      database: null,
      storage: null,
      commerceWebhookSecret: "commerce-webhook-secret",
      storeVerifier: null,
      premiumChat: {
        provider: "openai",
        apiKey: "sk-runtime-chat",
        model: "gpt-5.5-mini",
        baseUrl: "https://api.example.test/v1",
        maxOutputTokens: 180
      }
    };
    const provider = createOpenAiPremiumChatProviderFromRuntimeConfig(config, {
      fetch: successfulFetch(requests, {
        replyText: "Runtime Nori waves from a leaf.",
        safetyFlags: []
      })
    });

    await expect(provider.generateReply(providerInput)).resolves.toEqual({
      text: "Runtime Nori waves from a leaf.",
      safetyFlags: []
    });

    const body = JSON.parse(requests[0]?.init.body ?? "{}") as { model?: unknown; max_output_tokens?: unknown };

    expect(requests[0]?.url).toBe("https://api.example.test/v1/responses");
    expect(requests[0]?.init.headers.Authorization).toBe("Bearer sk-runtime-chat");
    expect(body.model).toBe("gpt-5.5-mini");
    expect(body.max_output_tokens).toBe(180);
  });
});
