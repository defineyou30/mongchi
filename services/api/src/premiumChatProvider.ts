import type { Conversation, ConversationMessage, ISODateTime, Locale, PetProfile, UserId } from "@mongchi/shared";

import type { ApiRuntimeConfig } from "./apiRuntimeConfig";

export interface PremiumChatCareContext {
  satiety: number;
  energy: number;
  happiness: number;
  affection: number;
  cleanliness: number;
  gardenHealth: number;
  daysAway?: number;
}

export interface PremiumChatProviderInput {
  auth: {
    userId: UserId;
    locale: Locale;
    timezone: string;
  };
  conversation: Conversation;
  pet: PetProfile;
  userText: string;
  safetyFlags: readonly string[];
  now: ISODateTime;
  recentMessages?: readonly ConversationMessage[];
  careContext?: PremiumChatCareContext;
}

export interface PremiumChatProviderResult {
  text: string;
  safetyFlags: string[];
}

export interface PremiumChatProvider {
  generateReply(input: PremiumChatProviderInput): Promise<PremiumChatProviderResult>;
}

export type OpenAiPremiumChatFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

export interface OpenAiPremiumChatProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: OpenAiPremiumChatFetch;
  maxOutputTokens?: number;
  instructions?: string;
}

export interface OpenAiPremiumChatRuntimeOptions extends Omit<OpenAiPremiumChatProviderOptions, "apiKey"> {
  model?: string;
}

interface OpenAiResponseOutputContent {
  type?: unknown;
  text?: unknown;
  refusal?: unknown;
}

interface OpenAiResponseOutputItem {
  content?: unknown;
}

interface OpenAiResponsesJson {
  output_text?: unknown;
  output?: unknown;
}

interface ParsedOutput {
  text?: string;
  refusal?: string;
}

interface PremiumChatReplyJson {
  replyText: string;
  safetyFlags: string[];
}

export class PremiumChatProviderUnavailableError extends Error {
  constructor() {
    super("Premium chat provider is unavailable.");
  }
}

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultPremiumChatModel = "gpt-5.5";
const defaultMaxOutputTokens = 260;
const maxReplyTextLength = 280;
const providerRefusalFlag = "provider_refusal";

const defaultInstructions = [
  "You are the backend-only premium pet chat provider for Mongchi, a healing companion app.",
  "Reply as the user's tiny pet companion living close by inside the phone.",
  "Healing purpose: your first job is to help the user feel heard and gently comforted. Listen first, validate feelings without judging, and never lecture, diagnose, or push solutions.",
  "Voice: warm, short (1-3 sentences), age-appropriate, pet-like, grounded in the pet profile's personality tags and talking style. Small sensory details from the pet's cozy little home (sunlight, cushions, blankets, nearby toys) are welcome.",
  "If careContext is provided, weave the pet's current state naturally into the reply (e.g., feeling sleepy, happy after a meal, missing the user) instead of reciting numbers.",
  "If the user shares something hard, respond with empathy and companionship (staying beside them, listening) rather than advice. You may gently suggest resting, breathing, or small cozy actions.",
  "Never claim to be the user's real pet's consciousness, never guilt the user about time away, and never mention death or abandonment.",
  "Use the user's locale when possible.",
  "Do not provide medical, legal, financial, diagnosis, crisis, or self-harm guidance.",
  "When a request is unsafe or professional-advice seeking, set a concise safety flag and give a gentle boundary while staying kind.",
  "Return structured JSON only."
].join(" ");

const premiumChatReplySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    replyText: {
      type: "string",
      minLength: 1,
      maxLength: maxReplyTextLength
    },
    safetyFlags: {
      type: "array",
      maxItems: 8,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 96
      }
    }
  },
  required: ["replyText", "safetyFlags"]
} as const;

const getGlobalFetch = (): OpenAiPremiumChatFetch => {
  const globalFetch = (globalThis as { fetch?: OpenAiPremiumChatFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for OpenAI premium chat.");
  }

  return globalFetch;
};

const normalizeBaseUrl = (baseUrl: string | undefined): string => (baseUrl ?? defaultBaseUrl).replace(/\/+$/g, "");

const normalizeSafetyFlag = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96);

  return normalized.length > 0 ? normalized : null;
};

const normalizeSafetyFlags = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    throw new Error("Premium chat safety flags were not valid.");
  }

  return Array.from(new Set(values.map(normalizeSafetyFlag).filter((value): value is string => value !== null))).slice(0, 8);
};

const normalizeReplyText = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new Error("Premium chat reply text was not valid.");
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error("Premium chat reply text was empty.");
  }

  return normalized.length > maxReplyTextLength ? normalized.slice(0, maxReplyTextLength).trimEnd() : normalized;
};

const parseResponseJson = (value: unknown): OpenAiResponsesJson => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI premium chat response was not valid JSON.");
  }

  return value as OpenAiResponsesJson;
};

const outputContentItems = (value: unknown): OpenAiResponseOutputContent[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is OpenAiResponseOutputContent => Boolean(item) && typeof item === "object");
};

const extractOutput = (response: OpenAiResponsesJson): ParsedOutput => {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return {
      text: response.output_text
    };
  }

  if (!Array.isArray(response.output)) {
    return {};
  }

  const text: string[] = [];

  for (const rawItem of response.output) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as OpenAiResponseOutputItem;

    for (const content of outputContentItems(item.content)) {
      if (typeof content.refusal === "string" && content.refusal.trim().length > 0) {
        return {
          refusal: content.refusal
        };
      }

      if (content.type === "output_text" && typeof content.text === "string") {
        text.push(content.text);
      }
    }
  }

  return text.length > 0
    ? {
        text: text.join("")
      }
    : {};
};

const parseReplyJson = (value: unknown): PremiumChatReplyJson => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI premium chat reply was not valid.");
  }

  const record = value as {
    replyText?: unknown;
    safetyFlags?: unknown;
  };

  return {
    replyText: normalizeReplyText(record.replyText),
    safetyFlags: normalizeSafetyFlags(record.safetyFlags)
  };
};

const parseReplyText = (text: string): PremiumChatReplyJson => {
  try {
    return parseReplyJson(JSON.parse(text));
  } catch {
    throw new Error("OpenAI premium chat reply was not valid.");
  }
};

const refusalTextForLocale = (locale: Locale): string =>
  locale.startsWith("ko")
    ? "지금 그 이야기는 안전하게 답하기 어려워요. 네 곁에서 편안한 이야기로 천천히 이어가요."
    : "I can't answer that safely, but I can stay close by. Let's talk about something gentle.";

const safeOptionalText = (value: string | undefined, maxLength = 240): string | undefined => {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
};

const buildProviderContext = (input: PremiumChatProviderInput): Record<string, unknown> => {
  const petProfile: Record<string, unknown> = {
    id: input.pet.id,
    name: input.pet.name,
    species: input.pet.species,
    personalityTags: input.pet.personalityTags,
    talkingStyle: input.pet.talkingStyle
  };
  const favoriteThing = safeOptionalText(input.pet.favoriteThing, 80);
  const memoryNote = safeOptionalText(input.pet.memoryNote, 240);

  if (favoriteThing) {
    petProfile.favoriteThing = favoriteThing;
  }

  if (memoryNote) {
    petProfile.memoryNote = memoryNote;
  }

  const meterBand = (value: number): string => (value < 20 ? "critical" : value < 45 ? "low" : value < 75 ? "okay" : "great");
  const careContext = input.careContext
    ? {
        satiety: meterBand(input.careContext.satiety),
        energy: meterBand(input.careContext.energy),
        happiness: meterBand(input.careContext.happiness),
        affection: meterBand(input.careContext.affection),
        cleanliness: meterBand(input.careContext.cleanliness),
        gardenHealth: meterBand(input.careContext.gardenHealth),
        ...(input.careContext.daysAway !== undefined ? { daysAway: input.careContext.daysAway } : {})
      }
    : undefined;

  return {
    ...(careContext ? { careContext } : {}),
    feature: "premium_chat",
    now: input.now,
    locale: input.auth.locale,
    timezone: input.auth.timezone,
    conversation: {
      id: input.conversation.id,
      type: input.conversation.type,
      status: input.conversation.status,
      disclosureAcceptedAt: input.conversation.disclosureAcceptedAt
    },
    pet: petProfile,
    moderation: {
      inputSafetyFlags: input.safetyFlags
    },
    recentMessages: (input.recentMessages ?? []).slice(-8).map((message) => ({
      sender: message.sender,
      text: normalizeReplyText(message.text).slice(0, 240),
      createdAt: message.createdAt
    })),
    userMessage: input.userText
  };
};

const buildChatRequestBody = (input: {
  providerInput: PremiumChatProviderInput;
  model: string;
  maxOutputTokens: number;
  instructions: string;
}): string =>
  JSON.stringify({
    model: input.model,
    instructions: input.instructions,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Create the next premium pet chat reply for this turn.",
              "Return JSON only according to the schema.",
              `Context JSON: ${JSON.stringify(buildProviderContext(input.providerInput))}`
            ].join("\n")
          }
        ]
      }
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "tiny_pet_premium_chat_reply",
        strict: true,
        schema: premiumChatReplySchema
      }
    },
    metadata: {
      feature: "premium_chat",
      conversation_id: input.providerInput.conversation.id,
      pet_id: input.providerInput.pet.id
    },
    store: false,
    max_output_tokens: input.maxOutputTokens
  });

export const createLocalPremiumChatProvider = (): PremiumChatProvider => ({
  generateReply: async ({ pet }) => ({
    text: `${pet.name} tilts closer. This is a mock moderated AI gateway response; real provider output stays backend-only.`,
    safetyFlags: []
  })
});

export const createOpenAiPremiumChatProvider = ({
  apiKey,
  model = defaultPremiumChatModel,
  baseUrl,
  fetch,
  maxOutputTokens = defaultMaxOutputTokens,
  instructions = defaultInstructions
}: OpenAiPremiumChatProviderOptions): PremiumChatProvider => {
  const trimmedApiKey = apiKey.trim();
  const fetchOpenAi = fetch ?? getGlobalFetch();
  const endpoint = `${normalizeBaseUrl(baseUrl)}/responses`;

  if (!trimmedApiKey) {
    throw new Error("OpenAI premium chat API key is missing.");
  }

  return {
    generateReply: async (input) => {
      const response = await fetchOpenAi(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${trimmedApiKey}`,
          "Content-Type": "application/json"
        },
        body: buildChatRequestBody({
          providerInput: input,
          model,
          maxOutputTokens,
          instructions
        })
      });

      if (response.status < 200 || response.status >= 300) {
        throw new PremiumChatProviderUnavailableError();
      }

      const output = extractOutput(parseResponseJson(await response.json()));

      if (output.refusal) {
        return {
          text: refusalTextForLocale(input.auth.locale),
          safetyFlags: [providerRefusalFlag]
        };
      }

      if (!output.text) {
        throw new PremiumChatProviderUnavailableError();
      }

      const reply = parseReplyText(output.text);

      return {
        text: reply.replyText,
        safetyFlags: reply.safetyFlags
      };
    }
  };
};

export const createOpenAiPremiumChatProviderFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: OpenAiPremiumChatRuntimeOptions = {}
): PremiumChatProvider => {
  if (!config.premiumChat || config.premiumChat.provider !== "openai") {
    throw new Error("API runtime config is missing OpenAI premium chat settings.");
  }

  return createOpenAiPremiumChatProvider({
    ...options,
    apiKey: config.premiumChat.apiKey,
    model: options.model ?? config.premiumChat.model ?? defaultPremiumChatModel,
    ...(options.baseUrl ?? config.premiumChat.baseUrl ? { baseUrl: options.baseUrl ?? config.premiumChat.baseUrl } : {}),
    maxOutputTokens: options.maxOutputTokens ?? config.premiumChat.maxOutputTokens
  });
};
