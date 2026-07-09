// Mongchi chat-turn Edge Function (Chat Live Wave C1).
//
// The single write-path endpoint for live premium pet chat --
// docs/chat-live-design.md §1.1/§1.2 chose one function over a
// start-conversation/send-turn pair because find-or-create is a cheap,
// OpenAI-free INSERT and the free "remembers me" greeting
// (packages/shared/src/domain/chatGreeting.ts) never touches the server at
// all, so there is no meaningful "start" step to separate out. Read access to
// conversation history is handled by RLS select-own directly against
// `conversations`/`conversation_messages` (supabase/migrations/
// 0006_conversations.sql) -- no separate read function, mirroring how
// generate-avatar's polling reads `generation_jobs` straight through RLS.
//
// Flow per request (docs/chat-live-design.md §1.1):
//   1. Authenticate the caller (mirrors generate-avatar/delete-account's
//      authClient + admin split exactly).
//   2. Validate the request body. Note: docs/chat-live-design.md's own
//      sketch of the chat-turn body (§1.1/§6.2) lists only
//      {petId, conversationId?, text, disclosureAccepted, requestId,
//      memoryContext?, careContext?} plus charge (§4.2/§6.2) -- it omits a
//      pet profile and locale/timezone. Both are genuinely required here:
//      there is no `pets` table anywhere in this Supabase-only schema (see
//      0005_pet_namespace.sql's "클라 소유 문자열, pets 테이블 없음" --
//      pet_id is a client-owned string, not a foreign key), so the pet's
//      name/species/personality/etc. cannot be looked up server-side the way
//      services/api's Postgres findOwnedPetForAuth did. This function
//      resolves that gap the same way generate-avatar already does for the
//      identical problem: the client sends an inline `petProfile` snapshot
//      per request (mirrors generate-avatar's `inputSnapshot`), and an
//      optional `locale`/`timezone` (mirrors services/api's ApiAuthContext
//      fields, which arrived via request context there but have no
//      equivalent Supabase Auth JWT claim here). Flag for wave C2: reconcile
//      this with the exact `ChatTurnRequest` shared type once it's defined in
//      packages/shared/src/api/mobileContracts.ts.
//   3. Find-or-create the (user_id, pet_id, status='open', type=
//      'premium_ai_chat') conversation, or look up conversationId directly
//      when the client already has one. First-turn disclosure acceptance is
//      recorded here (docs/chat-live-design.md §6.3).
//   4. Fetch a recent-message window (bounded by RECENT_MESSAGE_FETCH_LIMIT)
//      once, reused for both the per-conversation rate-limit count (ported
//      from premiumChatPolicy.ts's checkPremiumChatRateLimit: 10 user
//      messages / 60s default) and the recent-8 short-term context slice
//      buildProviderContext needs (chatProvider.ts).
//   5. Input moderation (moderation.ts). A crisis-referral match short-
//      circuits here: no OpenAI call, no charge, the reply is saved as a
//      `sender: "system"` message -- see moderation.ts's module doc comment
//      and docs/chat-live-design.md §5.2 layer 1.
//   6. Otherwise: call the chat provider (chatProvider.ts; CHAT_DRY_RUN swaps
//      in a local mock, see below), moderate its reply (layer 2 backstop),
//      charge credits *after* provider success and *before* saving messages
//      when charge === "credit" (docs/chat-live-design.md §4.2 -- avoids a
//      refund round-trip on provider failure, since a failed provider call
//      never reaches the charge step at all), and persist both the user and
//      pet_ai messages.
//
// DRY_RUN (docs/chat-live-design.md §7.1): CHAT_DRY_RUN=true and no
// OPENAI_API_KEY configured together bypass the real OpenAI call with a
// deterministic local mock (chatProvider.ts's createLocalPremiumChatProvider)
// -- the same double-gated pattern as generate-avatar/index.ts's
// GENERATION_DRY_RUN, so a real OPENAI_API_KEY always wins and this can never
// silently activate in a properly configured production environment. Every
// other step (find-or-create, moderation, rate limit, charging, message
// persistence) runs through its real code path unchanged. Never invoke this
// function against real OpenAI credentials in a test -- see
// docs/chat-live-design.md §7.1's "실호출 금지" principle.
//
// CORS: none, matching generate-avatar/delete-account -- this is only ever
// called via the Supabase JS client's functions.invoke from React Native, not
// a browser, so no OPTIONS/preflight handling is needed
// (docs/chat-live-design.md §1.4).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type ChatMemoryContext,
  type ChatMemoryContextEntry,
  type PremiumChatCareContext,
  type PremiumChatProviderResult,
  createLocalPremiumChatProvider,
  createOpenAiPremiumChatProvider
} from "./chatProvider.ts";
import { moderatePremiumChatInput, moderatePremiumChatProviderReply } from "./moderation.ts";

// ---------------------------------------------------------------------------
// Config / constants
// ---------------------------------------------------------------------------

// Server-authoritative chat-turn cost in credit_wallets credits (see
// supabase/migrations/0004_credit_ledger.sql), matching
// docs/chat-live-design.md §4.2's consume_credits(p_cost=1) example. A server
// constant, never read from the request body, for the same reason
// generate-avatar's EXPRESSION_PACK_CREDIT_COST is server-side only: the
// client's charge mode is never trusted for pricing.
const CHAT_TURN_CREDIT_COST = 1;

// Rate limit: ported from services/api/src/premiumChatPolicy.ts's
// defaultPremiumChatPolicy (maxUserMessagesPerWindow=10, rateLimitWindowMs=
// 60_000), scoped per-conversation rather than the generation_rate_limits
// table's global-per-user bucket -- reusing that table/RPC would share one
// abuse budget between avatar generation and chat, which is a different
// resource with a different cost profile. checkPremiumChatRateLimit's exact
// "oldest counted message" Retry-After math is simplified to a flat window-
// length Retry-After here (matches generate-avatar's RATE_LIMIT_MAX_ATTEMPTS/
// RATE_LIMIT_WINDOW_SECONDS style) rather than being ported message-for-
// message.
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000;
const RATE_LIMIT_MAX_USER_MESSAGES = 10;

// How many of the most recent messages to fetch per turn. Covers both the
// rate-limit window count above (comfortably, since the window cap is 10) and
// buildProviderContext's own recent-8 slice (chatProvider.ts).
const RECENT_MESSAGE_FETCH_LIMIT = 24;

const PET_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_MESSAGE_TEXT_LENGTH = 500; // enforced again inside moderatePremiumChatInput; checked early to fail fast.

// ---------------------------------------------------------------------------
// DRY RUN mode -- see module doc comment. Double-gated exactly like
// generate-avatar/index.ts's GENERATION_DRY_RUN: CHAT_DRY_RUN=true is not
// enough by itself, a configured OPENAI_API_KEY always wins.
// ---------------------------------------------------------------------------

const DRY_RUN = Deno.env.get("CHAT_DRY_RUN") === "true" && !Deno.env.get("OPENAI_API_KEY");

if (DRY_RUN) {
  console.warn(
    "[chat-turn] DRY RUN ACTIVE — CHAT_DRY_RUN=true and no OPENAI_API_KEY configured. " +
      "The OpenAI chat call is bypassed with a deterministic local mock reply. Never enable this in production."
  );
}

// ---------------------------------------------------------------------------
// Safe failure messages (English, warm, no guilt-tripping -- matches
// generate-avatar/index.ts's failureMessages tone).
// ---------------------------------------------------------------------------

const failureMessages = {
  insufficientCredits: "You're out of credits for this chat. Grab more credits and let's talk again soon.",
  disclosureRequired: "Accept the chat disclosure first so we can start talking.",
  providerUnavailable: "Premium chat is not available right now.",
  messageHistoryUnavailable: "We couldn't load our recent chat history. Let's try again in a moment.",
} as const;

// ---------------------------------------------------------------------------
// Row / request shapes
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string;
  user_id: string;
  pet_id: string | null;
  type: "premium_ai_chat" | "support";
  status: "open" | "archived" | "deleted";
  disclosure_accepted_at: string | null;
  summary: string | null;
  summarized_through: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender: "user" | "pet_ai" | "system";
  text: string;
  safety_flags: unknown;
  created_at: string;
}

interface ValidatedPetProfile {
  name: string;
  species: string;
  personalityTags?: string[];
  talkingStyle?: string;
  favoriteThing?: string;
  memoryNote?: string;
}

interface ValidatedChatTurnRequest {
  petId: string;
  conversationId?: string;
  text: string;
  disclosureAccepted: boolean;
  requestId: string;
  charge: "free" | "credit";
  locale: string;
  timezone: string;
  petProfile: ValidatedPetProfile;
  memoryContext?: ChatMemoryContext;
  careContext?: PremiumChatCareContext;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonResponse = (body: unknown, status: number, extraHeaders?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const validatePetProfile = (value: unknown): ValidatedPetProfile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.name) || !isNonEmptyString(record.species)) {
    return null;
  }

  const personalityTags =
    Array.isArray(record.personalityTags) && record.personalityTags.every((tag) => typeof tag === "string")
      ? (record.personalityTags as string[])
      : undefined;
  const talkingStyle = typeof record.talkingStyle === "string" ? record.talkingStyle : undefined;
  const favoriteThing = typeof record.favoriteThing === "string" ? record.favoriteThing : undefined;
  const memoryNote = typeof record.memoryNote === "string" ? record.memoryNote : undefined;

  return {
    name: record.name.trim().slice(0, 60),
    species: record.species.trim().slice(0, 40),
    ...(personalityTags ? { personalityTags: personalityTags.slice(0, 8) } : {}),
    ...(talkingStyle ? { talkingStyle } : {}),
    ...(favoriteThing ? { favoriteThing } : {}),
    ...(memoryNote ? { memoryNote } : {})
  };
};

// Best-effort enrichment (mirrors postgresApiService.ts:2290-2292's "Care
// context is a best-effort enrichment; chat proceeds without it.") -- a
// malformed careContext is dropped rather than failing the whole turn.
const validateCareContext = (value: unknown): PremiumChatCareContext | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const required = [record.satiety, record.energy, record.happiness, record.affection, record.cleanliness, record.gardenHealth];

  if (!required.every(isFiniteNumber)) {
    return undefined;
  }

  return {
    satiety: record.satiety as number,
    energy: record.energy as number,
    happiness: record.happiness as number,
    affection: record.affection as number,
    cleanliness: record.cleanliness as number,
    gardenHealth: record.gardenHealth as number,
    ...(isFiniteNumber(record.daysAway) ? { daysAway: record.daysAway } : {})
  };
};

// Best-effort enrichment, same "drop malformed pieces, never fail the turn"
// principle as validateCareContext above -- this is a client-prepared prompt
// aid (packages/shared/src/api/mobileContracts.ts's ChatMemoryContext), not
// billing- or safety-critical data.
const validateMemoryContext = (value: unknown): ChatMemoryContext | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const rawEntries = Array.isArray(record.recentMemories) ? record.recentMemories : [];
  const recentMemories: ChatMemoryContextEntry[] = rawEntries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .filter((entry) => typeof entry.type === "string" && typeof entry.line === "string")
    .slice(0, 8)
    .map((entry) => ({ type: entry.type as string, line: (entry.line as string).slice(0, 160) }));

  return {
    recentMemories,
    favoriteCareAction: typeof record.favoriteCareAction === "string" ? record.favoriteCareAction : null,
    favoriteTreatItemId: typeof record.favoriteTreatItemId === "string" ? record.favoriteTreatItemId : null
  };
};

const validateChatTurnRequestBody = (value: unknown): ValidatedChatTurnRequest | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.petId) || !PET_ID_PATTERN.test(record.petId)) {
    return null;
  }

  if (!isNonEmptyString(record.text) || record.text.length > MAX_MESSAGE_TEXT_LENGTH) {
    return null;
  }

  if (typeof record.disclosureAccepted !== "boolean") {
    return null;
  }

  if (!isNonEmptyString(record.requestId)) {
    return null;
  }

  if (record.charge !== "free" && record.charge !== "credit") {
    return null;
  }

  const petProfile = validatePetProfile(record.petProfile);

  if (!petProfile) {
    return null;
  }

  if (record.conversationId !== undefined && !isNonEmptyString(record.conversationId)) {
    return null;
  }

  return {
    petId: record.petId,
    ...(isNonEmptyString(record.conversationId) ? { conversationId: record.conversationId } : {}),
    text: record.text,
    disclosureAccepted: record.disclosureAccepted,
    requestId: record.requestId.trim(),
    charge: record.charge,
    locale: isNonEmptyString(record.locale) ? record.locale : "en",
    timezone: isNonEmptyString(record.timezone) ? record.timezone : "UTC",
    petProfile,
    ...((): { memoryContext?: ChatMemoryContext } => {
      const memoryContext = validateMemoryContext(record.memoryContext);
      return memoryContext ? { memoryContext } : {};
    })(),
    ...((): { careContext?: PremiumChatCareContext } => {
      const careContext = validateCareContext(record.careContext);
      return careContext ? { careContext } : {};
    })()
  };
};

const conversationSelectColumns = `
  id,
  user_id,
  pet_id,
  type,
  status,
  disclosure_accepted_at,
  summary,
  summarized_through,
  deleted_at,
  created_at,
  updated_at
`;

const messageSelectColumns = `
  id,
  conversation_id,
  sender,
  text,
  safety_flags,
  created_at
`;

const mapConversationRow = (row: ConversationRow): Record<string, unknown> => ({
  id: row.id,
  userId: row.user_id,
  petId: row.pet_id,
  type: row.type,
  status: row.status,
  ...(row.disclosure_accepted_at ? { disclosureAcceptedAt: row.disclosure_accepted_at } : {}),
  ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapMessageRow = (row: MessageRow): Record<string, unknown> => ({
  id: row.id,
  conversationId: row.conversation_id,
  sender: row.sender,
  text: row.text,
  safetyFlags: Array.isArray(row.safety_flags) ? row.safety_flags : [],
  createdAt: row.created_at
});

const fetchCreditBalance = async (admin: SupabaseClient, userId: string): Promise<number> => {
  const { data, error } = await admin.rpc("get_credit_balance", { p_user: userId });

  if (error || typeof data !== "number") {
    return 0;
  }

  return data;
};

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  // OPENAI_API_KEY is only required outside DRY_RUN -- DRY_RUN itself already
  // requires OPENAI_API_KEY to be absent (see the DRY_RUN definition above),
  // so this can never mask a genuinely misconfigured production deployment.
  if (!supabaseUrl || !serviceRoleKey || (!openAiApiKey && !DRY_RUN)) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  // 1. Identify the caller (including anonymous auth users) from their JWT.
  // Mirrors generate-avatar/delete-account's HTTP handler exactly.
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userId = userData.user.id;

  // 2. Parse and validate the request body.
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const body = validateChatTurnRequestBody(rawBody);

  if (!body) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const now = new Date().toISOString();

  // 3. Find-or-create the conversation (docs/chat-live-design.md §1.1/§2.1).
  let conversation: ConversationRow;

  if (body.conversationId) {
    const { data, error } = await admin
      .from("conversations")
      .select(conversationSelectColumns)
      .eq("id", body.conversationId)
      .eq("user_id", userId)
      .neq("status", "deleted")
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: "conversation_lookup_failed" }, 500);
    }

    if (!data) {
      return jsonResponse({ error: "conversation_not_found" }, 404);
    }

    conversation = data as ConversationRow;
  } else {
    const { data: existing, error: findError } = await admin
      .from("conversations")
      .select(conversationSelectColumns)
      .eq("user_id", userId)
      .eq("pet_id", body.petId)
      .eq("type", "premium_ai_chat")
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      return jsonResponse({ error: "conversation_lookup_failed" }, 500);
    }

    if (existing) {
      conversation = existing as ConversationRow;
    } else {
      const { data: created, error: createError } = await admin
        .from("conversations")
        .insert({
          user_id: userId,
          pet_id: body.petId,
          type: "premium_ai_chat",
          status: "open",
          disclosure_accepted_at: body.disclosureAccepted ? now : null
        })
        .select(conversationSelectColumns)
        .single();

      if (createError || !created) {
        return jsonResponse({ error: "conversation_create_failed" }, 500);
      }

      conversation = created as ConversationRow;
    }
  }

  // 4. Disclosure gate (docs/chat-live-design.md §6.3) -- first turn must
  // carry disclosureAccepted: true; once accepted it's recorded permanently.
  if (!conversation.disclosure_accepted_at) {
    if (!body.disclosureAccepted) {
      return jsonResponse({ error: "conversation_not_ready", message: failureMessages.disclosureRequired }, 409);
    }

    const { data: updated, error: updateError } = await admin
      .from("conversations")
      .update({ disclosure_accepted_at: now, updated_at: now })
      .eq("id", conversation.id)
      .select(conversationSelectColumns)
      .single();

    if (updateError || !updated) {
      return jsonResponse({ error: "conversation_update_failed" }, 500);
    }

    conversation = updated as ConversationRow;
  }

  // 5. Recent messages -- one query, reused for the rate-limit count and the
  // recent-8 context slice (see RECENT_MESSAGE_FETCH_LIMIT's doc comment).
  const { data: recentRows, error: recentError } = await admin
    .from("conversation_messages")
    .select(messageSelectColumns)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(RECENT_MESSAGE_FETCH_LIMIT);

  if (recentError) {
    return jsonResponse({ error: "message_history_unavailable", message: failureMessages.messageHistoryUnavailable }, 503);
  }

  const recentDesc = (recentRows ?? []) as MessageRow[];
  const nowMs = new Date(now).getTime();
  const windowStartMs = nowMs - RATE_LIMIT_WINDOW_MS;
  const recentUserMessagesInWindow = recentDesc.filter((row) => {
    const createdAtMs = new Date(row.created_at).getTime();
    return row.sender === "user" && Number.isFinite(createdAtMs) && createdAtMs >= windowStartMs;
  }).length;

  if (recentUserMessagesInWindow >= RATE_LIMIT_MAX_USER_MESSAGES) {
    return jsonResponse({ error: "rate_limited" }, 429, { "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) });
  }

  const recentAsc = [...recentDesc].reverse();

  // 6. Input moderation (moderation.ts, §5.2 layer 1).
  const moderation = moderatePremiumChatInput(body.text, body.locale);

  if (!moderation.ok) {
    return jsonResponse({ error: moderation.code, message: moderation.messageSafe }, moderation.status);
  }

  if (moderation.crisisReferral) {
    // Crisis referral: skip the OpenAI call entirely, never charge, store
    // the reply as a `sender: "system"` message flagged crisis_referral --
    // see moderation.ts's module doc comment and
    // docs/chat-live-design.md §5.2 point 1.
    const { data: savedMessages, error: saveError } = await admin
      .from("conversation_messages")
      .insert([
        {
          conversation_id: conversation.id,
          user_id: userId,
          sender: "user",
          text: moderation.normalizedText,
          safety_flags: []
        },
        {
          conversation_id: conversation.id,
          user_id: userId,
          sender: "system",
          text: moderation.replyText,
          safety_flags: moderation.safetyFlags
        }
      ])
      .select(messageSelectColumns);

    if (saveError || !savedMessages || savedMessages.length !== 2) {
      return jsonResponse({ error: "message_save_failed" }, 500);
    }

    await admin.from("conversations").update({ updated_at: now }).eq("id", conversation.id);

    return jsonResponse(
      {
        conversation: mapConversationRow(conversation),
        userMessage: mapMessageRow(savedMessages[0] as MessageRow),
        petMessage: mapMessageRow(savedMessages[1] as MessageRow),
        safetyFlags: moderation.safetyFlags,
        serverBalance: await fetchCreditBalance(admin, userId),
        chargedCredit: 0,
        crisisReferral: true
      },
      200
    );
  }

  // 7. Provider call. CHAT_DRY_RUN swaps in the local mock (module doc
  // comment) -- never call real OpenAI with a fake/test API key.
  const provider = DRY_RUN
    ? createLocalPremiumChatProvider()
    : createOpenAiPremiumChatProvider({ apiKey: openAiApiKey ?? "" });

  let providerReply: PremiumChatProviderResult;

  try {
    providerReply = await provider.generateReply({
      auth: { userId, locale: body.locale, timezone: body.timezone },
      conversation: {
        id: conversation.id,
        type: conversation.type,
        status: conversation.status,
        ...(conversation.disclosure_accepted_at ? { disclosureAcceptedAt: conversation.disclosure_accepted_at } : {})
      },
      pet: {
        id: body.petId,
        name: body.petProfile.name,
        species: body.petProfile.species,
        ...(body.petProfile.personalityTags ? { personalityTags: body.petProfile.personalityTags } : {}),
        ...(body.petProfile.talkingStyle ? { talkingStyle: body.petProfile.talkingStyle } : {}),
        ...(body.petProfile.favoriteThing ? { favoriteThing: body.petProfile.favoriteThing } : {}),
        ...(body.petProfile.memoryNote ? { memoryNote: body.petProfile.memoryNote } : {})
      },
      userText: moderation.normalizedText,
      safetyFlags: moderation.safetyFlags,
      now,
      recentMessages: recentAsc.map((row) => ({ sender: row.sender, text: row.text, createdAt: row.created_at })),
      ...(body.careContext ? { careContext: body.careContext } : {}),
      ...(body.memoryContext ? { memoryContext: body.memoryContext } : {}),
      // conversationSummary is always undefined in wave C1 -- nothing writes
      // conversations.summary yet (chat-turn/summary.ts is an unwired
      // skeleton, see its module doc comment). Passed through as-is so wave
      // C3 only has to start populating the column, not touch this call site.
      ...(conversation.summary ? { conversationSummary: conversation.summary } : {})
    });
  } catch {
    return jsonResponse({ error: "premium_chat_provider_unavailable", message: failureMessages.providerUnavailable }, 503);
  }

  // 8. Output moderation (§5.2 layer 2 backstop).
  const providerOutput = moderatePremiumChatProviderReply(providerReply, body.locale);

  if (!providerOutput.ok) {
    return jsonResponse({ error: providerOutput.code, message: providerOutput.messageSafe }, providerOutput.status);
  }

  // 9. Charge -- after provider success, before message save
  // (docs/chat-live-design.md §4.2). charge === "free" means the client
  // already spent a local ticket/Plus entitlement (§4.1's truth-source
  // split); the server touches nothing in that case beyond reading the
  // balance back for the client to reconcile.
  let chargedCredit = 0;
  let serverBalance = 0;

  if (body.charge === "credit") {
    const { data: newBalance, error: consumeError } = await admin.rpc("consume_credits", {
      p_user: userId,
      p_cost: CHAT_TURN_CREDIT_COST,
      p_reason: "consume_premium_chat",
      p_ref_type: "credit_request",
      p_ref_id: body.requestId
    });

    if (consumeError) {
      return jsonResponse({ error: "credit_check_failed" }, 500);
    }

    if (newBalance === -1) {
      // Insufficient credits: the provider call already happened (sunk cost,
      // see docs/chat-live-design.md §4.2's accepted tradeoff for avoiding a
      // refund round-trip), but nothing is persisted and nothing is charged.
      return jsonResponse({ error: "insufficient_credits", message: failureMessages.insufficientCredits }, 402);
    }

    chargedCredit = CHAT_TURN_CREDIT_COST;
    serverBalance = newBalance as number;
  } else {
    serverBalance = await fetchCreditBalance(admin, userId);
  }

  // 10. Save both turn messages.
  const { data: savedMessages, error: saveError } = await admin
    .from("conversation_messages")
    .insert([
      {
        conversation_id: conversation.id,
        user_id: userId,
        sender: "user",
        text: moderation.normalizedText,
        safety_flags: moderation.safetyFlags
      },
      {
        conversation_id: conversation.id,
        user_id: userId,
        sender: "pet_ai",
        text: providerOutput.text,
        safety_flags: providerOutput.safetyFlags
      }
    ])
    .select(messageSelectColumns);

  if (saveError || !savedMessages || savedMessages.length !== 2) {
    return jsonResponse({ error: "message_save_failed" }, 500);
  }

  await admin.from("conversations").update({ updated_at: now }).eq("id", conversation.id);

  return jsonResponse(
    {
      conversation: mapConversationRow(conversation),
      userMessage: mapMessageRow(savedMessages[0] as MessageRow),
      petMessage: mapMessageRow(savedMessages[1] as MessageRow),
      safetyFlags: providerOutput.safetyFlags,
      serverBalance,
      chargedCredit,
      crisisReferral: false
    },
    200
  );
});
