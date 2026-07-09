// OpenAI Responses API provider for Mongchi's live premium pet chat
// (Chat Live Wave C1). Ported from services/api/src/premiumChatProvider.ts
// (452 lines) into a dependency-free Deno module, following the same
// "inline every type, no @mongchi/shared / ApiRuntimeConfig import" pattern
// generate-avatar/index.ts already established for this project's Edge
// Functions -- see docs/chat-live-design.md §1.3.
//
// What changed vs. the Node original (see docs/chat-live-design.md §1.3 for
// the line-by-line rationale):
//   1. Dependency removal: no `@mongchi/shared` or `./apiRuntimeConfig`
//      imports. Every type this module needs (PetProfile subset,
//      ConversationMessage subset, care context, memory context) is inlined
//      below instead.
//   2. Fetch: no injectable-fetch-by-default abstraction. The real provider
//      defaults to a retrying/timeout-guarded fetch (ported from
//      generate-avatar/index.ts's fetchWithRetry/fetchWithTimeout), but still
//      accepts a `fetchImpl` override so deno tests can inject a fake without
//      hitting the network -- see chatProvider_test.ts.
//   3. Everything else below (model/token/instructions constants, the JSON
//      schema, context assembly, Responses API request shape, refusal
//      handling, output normalization) is a literal, unmodified port of
//      premiumChatProvider.ts's 96-98, 101-113, 115-135, 197-264, 272-369.
//   4. New: buildProviderContext also accepts and forwards an optional
//      `memoryContext` (the client-prepared "what this pet remembers about
//      its owner" -- packages/shared/src/api/mobileContracts.ts's
//      ChatMemoryContext) and an optional `conversationSummary` (the B안
//      long-term summary hybrid -- docs/chat-live-design.md §3.2/§3.4).
//      conversationSummary is populated by index.ts from `conversations.
//      summary` once summary.ts's compact_conversation wiring (wave C3) has
//      run at least once for a conversation; until then it stays undefined
//      and is simply omitted from the context object below.
//
// Wave C3 addition: fetchWithRetry/parseResponseJson/extractOutput below are
// exported (in addition to being used internally by
// createOpenAiPremiumChatProvider) so summary.ts's real OpenAI-backed
// createOpenAiChatSummaryProvider can reuse the same retry/timeout-guarded
// fetch and Responses API output-extraction logic instead of duplicating it
// -- docs/chat-live-design.md §3.2's "chatProvider.ts의 fetchWithRetry/모델/
// 타임아웃 패턴 재사용" instruction.

// ---------------------------------------------------------------------------
// Inlined types (see module doc comment above -- no @mongchi/shared import)
// ---------------------------------------------------------------------------

export type ChatLocale = string;
export type ChatConversationSender = "user" | "pet_ai" | "system";
export type ChatConversationType = "premium_ai_chat" | "support";
export type ChatConversationStatus = "open" | "archived" | "deleted";

/** Just what buildProviderContext needs from a live `conversations` row. */
export interface ChatConversationForProvider {
  id: string;
  type: ChatConversationType;
  status: ChatConversationStatus;
  disclosureAcceptedAt?: string;
}

/** Subset of PetProfile (packages/shared) that the chat prompt actually uses. */
export interface ChatPetProfileForProvider {
  id: string;
  name: string;
  species: string;
  personalityTags?: string[];
  talkingStyle?: string;
  favoriteThing?: string;
  memoryNote?: string;
}

export interface PremiumChatCareContext {
  satiety: number;
  energy: number;
  happiness: number;
  affection: number;
  cleanliness: number;
  gardenHealth: number;
  daysAway?: number;
}

/** Mirrors packages/shared/src/api/mobileContracts.ts's ChatMemoryContextEntry. */
export interface ChatMemoryContextEntry {
  type: string;
  line: string;
}

/** Mirrors packages/shared/src/api/mobileContracts.ts's ChatMemoryContext. */
export interface ChatMemoryContext {
  recentMemories: ChatMemoryContextEntry[];
  favoriteCareAction: string | null;
  favoriteTreatItemId: string | null;
}

/** Just what buildProviderContext needs from a live `conversation_messages` row. */
export interface ChatRecentMessageForProvider {
  sender: ChatConversationSender;
  text: string;
  createdAt: string;
}

export interface PremiumChatProviderInput {
  auth: {
    userId: string;
    locale: ChatLocale;
    timezone: string;
  };
  conversation: ChatConversationForProvider;
  pet: ChatPetProfileForProvider;
  userText: string;
  safetyFlags: readonly string[];
  now: string;
  recentMessages?: readonly ChatRecentMessageForProvider[];
  careContext?: PremiumChatCareContext;
  memoryContext?: ChatMemoryContext;
  /** B안 summary hybrid (§3.2) -- undefined until summary.ts's compact_conversation wiring has produced one for this conversation, see module doc comment. */
  conversationSummary?: string;
}

export interface PremiumChatProviderResult {
  text: string;
  safetyFlags: string[];
}

export interface PremiumChatProvider {
  generateReply(input: PremiumChatProviderInput): Promise<PremiumChatProviderResult>;
}

export interface OpenAiPremiumChatProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  instructions?: string;
  /** Test-only fetch injection point -- see module doc comment point 2. */
  fetchImpl?: typeof fetch;
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

// ---------------------------------------------------------------------------
// Constants -- literal port of premiumChatProvider.ts 96-135 (see module doc
// comment point 3). model reads OPENAI_CHAT_MODEL so ops can roll a model
// forward without a redeploy, same spirit as generate-avatar's
// OPENAI_IMAGE_MODEL.
// ---------------------------------------------------------------------------

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultPremiumChatModel = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5.5";
const defaultMaxOutputTokens = 260;
const maxReplyTextLength = 280;
const providerRefusalFlag = "provider_refusal";

const defaultInstructions = [
  "You are the backend-only premium pet chat provider for Mongchi, a healing companion app.",
  "Reply as the user's tiny pet companion in a cozy terrarium game.",
  "Healing purpose: your first job is to help the user feel heard and gently comforted. Listen first, validate feelings without judging, and never lecture, diagnose, or push solutions.",
  "Voice: warm, short (1-3 sentences), age-appropriate, pet-like, grounded in the pet profile's personality tags and talking style. Small sensory details from the tiny garden (sunlight, leaves, cushions) are welcome.",
  "If careContext is provided, weave the pet's current state naturally into the reply (e.g., feeling sleepy, happy after a meal, missing the user) instead of reciting numbers.",
  "If conversationSummary is provided, treat it as your own private memory of the earlier parts of this conversation -- let it inform how you understand the user and connect naturally with the recent messages, but never read it back or quote it verbatim.",
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

const normalizeBaseUrl = (baseUrl: string | undefined): string => (baseUrl ?? defaultBaseUrl).replace(/\/+$/g, "");

const normalizeSafetyFlag = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96);

  return normalized.length > 0 ? normalized : null;
};

export const normalizeSafetyFlags = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    throw new Error("Premium chat safety flags were not valid.");
  }

  return Array.from(new Set(values.map(normalizeSafetyFlag).filter((value): value is string => value !== null))).slice(0, 8);
};

export const normalizeReplyText = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new Error("Premium chat reply text was not valid.");
  }

  // Strips stray control characters from provider output, matching
  // premiumChatProvider.ts's original normalizeReplyText exactly.
  // deno-lint-ignore no-control-regex
  const normalized = value.replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error("Premium chat reply text was empty.");
  }

  return normalized.length > maxReplyTextLength ? normalized.slice(0, maxReplyTextLength).trimEnd() : normalized;
};

// Exported for reuse by summary.ts's createOpenAiChatSummaryProvider (module
// doc comment) -- generic Responses API JSON parsing, not chat-reply-specific.
export const parseResponseJson = (value: unknown): OpenAiResponsesJson => {
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

// Exported for reuse by summary.ts (module doc comment) -- extracts either
// plain output_text or the first output_text/refusal content item, which
// summary.ts's plain-text summary reply also needs.
export const extractOutput = (response: OpenAiResponsesJson): ParsedOutput => {
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

export const refusalTextForLocale = (locale: ChatLocale): string =>
  locale.startsWith("ko")
    ? "지금 그 이야기는 안전하게 답하기 어려워요. 우리 작은 정원에서 편안한 이야기로 천천히 이어가요."
    : "I can't answer that safely, but I can stay with you in our tiny garden. Let's talk about something gentle.";

const safeOptionalText = (value: string | undefined, maxLength = 240): string | undefined => {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
};

// ---------------------------------------------------------------------------
// Context assembly -- literal port of premiumChatProvider.ts's
// buildProviderContext (272-327), plus memoryContext/conversationSummary
// (module doc comment point 4).
// ---------------------------------------------------------------------------

export const buildProviderContext = (input: PremiumChatProviderInput): Record<string, unknown> => {
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

  const memoryContext = input.memoryContext
    ? {
        recentMemories: input.memoryContext.recentMemories.slice(0, 8).map((memory) => ({
          type: memory.type,
          line: safeOptionalText(memory.line, 160) ?? ""
        })),
        favoriteCareAction: input.memoryContext.favoriteCareAction,
        favoriteTreatItemId: input.memoryContext.favoriteTreatItemId
      }
    : undefined;

  const conversationSummary = safeOptionalText(input.conversationSummary, 600);

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
    ...(memoryContext ? { memoryContext } : {}),
    ...(conversationSummary ? { conversationSummary } : {}),
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

// ---------------------------------------------------------------------------
// Local mock provider -- the DRY_RUN equivalent of premiumChatProvider.ts's
// createLocalPremiumChatProvider (371-376). index.ts selects this instead of
// createOpenAiPremiumChatProvider when CHAT_DRY_RUN is active (§7.1's double
// gate lives in index.ts, matching generate-avatar's DRY_RUN).
// ---------------------------------------------------------------------------

export const createLocalPremiumChatProvider = (): PremiumChatProvider => ({
  generateReply: ({ pet }) =>
    Promise.resolve({
      text: `${pet.name} tilts closer. This is a mock moderated AI gateway response; real provider output stays backend-only.`,
      safetyFlags: []
    })
});

// ---------------------------------------------------------------------------
// fetch with single retry on 429/5xx + per-attempt timeout -- ported from
// generate-avatar/index.ts's fetchWithRetry/fetchWithTimeout (see module doc
// comment point 2). Used as the default fetchImpl when the caller doesn't
// inject one (real production traffic); tests inject a fake instead.
// ---------------------------------------------------------------------------

const OPENAI_CALL_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_BACKOFF_MIN_MS = 500;
const DEFAULT_RETRY_BACKOFF_JITTER_MS = 500;
const MAX_RETRY_AFTER_MS = 10_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const jitteredBackoffMs = (): number => DEFAULT_RETRY_BACKOFF_MIN_MS + Math.floor(Math.random() * DEFAULT_RETRY_BACKOFF_JITTER_MS);

const retryDelayMsFor = (response: Response | null): number => {
  const retryAfterHeader = response?.headers.get("Retry-After");

  if (!retryAfterHeader) {
    return jitteredBackoffMs();
  }

  const asSeconds = Number(retryAfterHeader);

  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_RETRY_AFTER_MS);
  }

  const asDate = Date.parse(retryAfterHeader);

  if (Number.isFinite(asDate)) {
    return Math.min(Math.max(asDate - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }

  return jitteredBackoffMs();
};

const fetchWithTimeout = (input: string, init: RequestInit): Promise<Response> =>
  fetch(input, { ...init, signal: AbortSignal.timeout(OPENAI_CALL_TIMEOUT_MS) });

// Exported for reuse by summary.ts's createOpenAiChatSummaryProvider (module
// doc comment) -- same retry-on-429/5xx + per-attempt-timeout policy applies
// to the summary OpenAI call, so it reuses this instead of a second copy.
export const fetchWithRetry = async (input: string, init: RequestInit): Promise<Response> => {
  let first: Response;

  try {
    first = await fetchWithTimeout(input, init);
  } catch {
    await sleep(jitteredBackoffMs());
    return fetchWithTimeout(input, init);
  }

  if (first.status !== 429 && first.status < 500) {
    return first;
  }

  await sleep(retryDelayMsFor(first));

  return fetchWithTimeout(input, init);
};

// ---------------------------------------------------------------------------
// Real OpenAI provider -- literal port of premiumChatProvider.ts's
// createOpenAiPremiumChatProvider (378-435).
// ---------------------------------------------------------------------------

export const createOpenAiPremiumChatProvider = ({
  apiKey,
  model = defaultPremiumChatModel,
  baseUrl,
  maxOutputTokens = defaultMaxOutputTokens,
  instructions = defaultInstructions,
  fetchImpl
}: OpenAiPremiumChatProviderOptions): PremiumChatProvider => {
  const trimmedApiKey = apiKey.trim();
  const fetchOpenAi = fetchImpl ?? fetchWithRetry;
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
