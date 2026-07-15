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
//   4. Fetch a recent-message window for the recent-8 short-term context.
//   5. Input moderation (moderation.ts). A crisis-referral match short-
//      circuits here: no OpenAI call, no charge, the reply is saved as a
//      `sender: "system"` message -- see moderation.ts's module doc comment
//      and docs/chat-live-design.md §5.2 layer 1.
//   6. Otherwise: reserve the request through reserve_chat_turn. That RPC
//      owns the user-global rate limit, replay/idempotency state, entitlement
//      decision, starter/daily allowance, and credit debit atomically before
//      any provider call. Provider/save failures call fail_chat_turn to
//      restore the server-owned allowance or credit debit.
//   7. Call the provider, moderate its reply, save both messages, and mark the
//      request completed with the response payload used for future replays.
//   7. Long-term memory (summary.ts, B안 hybrid, §3.2, Chat Live Wave C3):
//      after either message-save above, evaluate shouldTriggerChatSummary
//      against the messages that have fallen out of the recent-8 window
//      without ever being folded into `conversations.summary`. When due,
//      summarize that batch (merging with any existing summary) and persist
//      it through the `compact_conversation` RPC, which atomically advances
//      the `summarized_through` watermark and deletes the now-summarized raw
//      rows (privacy-first, §3.5) -- see maybeCompactConversationSummary
//      below. This step is strictly best-effort: any failure (network,
//      OpenAI, RPC) is caught and logged, never surfaced to the caller, so a
//      summary hiccup can never fail an otherwise-successful chat turn; the
//      unsummarized backlog simply persists and re-triggers on a later turn.
//
// DRY_RUN (docs/chat-live-design.md §7.1): CHAT_DRY_RUN=true and no
// OPENAI_API_KEY configured together bypass the real OpenAI call with a
// deterministic local mock (chatProvider.ts's createLocalPremiumChatProvider)
// -- the same double-gated pattern as generate-avatar/index.ts's
// GENERATION_DRY_RUN, so a real OPENAI_API_KEY always wins and this can never
// silently activate in a properly configured production environment. The same
// gate selects summary.ts's createLocalChatSummaryProvider over
// createOpenAiChatSummaryProvider for step 7. Every other step (find-or-
// create, moderation, rate limit, charging, message persistence) runs through
// its real code path unchanged. Never invoke this function against real
// OpenAI credentials in a test -- see docs/chat-live-design.md §7.1's
// "실호출 금지" principle.
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
import { parseChatLocale } from "./locale.ts";
import type { ChatLocale } from "./locale.ts";
import { computeFreeChatTurnsRemaining, DEFAULT_STARTER_FREE_REMAINING } from "./freeAllowance.ts";
import {
  type ChatSummaryRecentMessage,
  createLocalChatSummaryProvider,
  createOpenAiChatSummaryProvider,
  planChatSummaryCompaction
} from "./summary.ts";

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

// User-global provider budget. reserve_chat_turn applies this independently
// of pet and conversation identifiers.
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_USER_MESSAGES = 10;

// How many of the most recent messages to fetch per turn. Covers both the
// rate-limit window count above (comfortably, since the window cap is 10) and
// buildProviderContext's own recent-8 slice (chatProvider.ts).
const RECENT_MESSAGE_FETCH_LIMIT = 24;

// Short-term context window size (summary.ts §3.2/§3.1) -- matches
// chatProvider.ts's buildProviderContext, which slices recentMessages to the
// last 8. Everything older than this window (and not yet folded into
// conversations.summary) is a candidate for the next summary compaction --
// see maybeCompactConversationSummary below. RECENT_MESSAGE_FETCH_LIMIT (24)
// comfortably covers this window plus SUMMARY_BATCH_THRESHOLD (12, summary.ts)
// worth of backlog, so the batch trigger always fires before backlog could
// silently exceed what a single fetch sees.
const CHAT_SUMMARY_KEEP_RECENT_COUNT = 8;

const PET_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_MESSAGE_TEXT_LENGTH = 500; // enforced again inside moderatePremiumChatInput; checked early to fail fast.

// ---------------------------------------------------------------------------
// DRY RUN mode -- see module doc comment. Double-gated exactly like
// generate-avatar/index.ts's GENERATION_DRY_RUN: CHAT_DRY_RUN=true is not
// enough by itself, a configured OPENAI_API_KEY always wins.
// ---------------------------------------------------------------------------

const DRY_RUN = Deno.env.get("CHAT_DRY_RUN") === "true" && !Deno.env.get("OPENAI_API_KEY");
const CHAT_LIVE_ENABLED = Deno.env.get("CHAT_LIVE_ENABLED") === "true" || DRY_RUN;

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
  chatDisabled: "Long chat is resting for now. Your tiny friend can still respond to care and quick talks.",
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
  locale: ChatLocale;
  timezone: string;
  petProfile: ValidatedPetProfile;
  memoryContext?: ChatMemoryContext;
  careContext?: PremiumChatCareContext;
}

type ChatChargeKind = "plus" | "day_pass" | "starter_free" | "daily_free" | "credit";

interface ChatTurnReservation {
  outcome: "reserved" | "replay" | "in_progress" | "conflict" | "rate_limited" | "insufficient_credits";
  chargeKind: ChatChargeKind | null;
  balance: number;
  freeTurnsRemaining: number;
  retryAfterSeconds: number;
  responsePayload: Record<string, unknown> | null;
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

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

const parseChatChargeKind = (value: unknown): ChatChargeKind | null =>
  value === "plus" || value === "day_pass" || value === "starter_free" || value === "daily_free" || value === "credit"
    ? value
    : null;

const parseChatTurnReservation = (value: unknown): ChatTurnReservation | null => {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    return null;
  }

  const row = value[0];
  const outcome = row.outcome;

  if (
    outcome !== "reserved" &&
    outcome !== "replay" &&
    outcome !== "in_progress" &&
    outcome !== "conflict" &&
    outcome !== "rate_limited" &&
    outcome !== "insufficient_credits"
  ) {
    return null;
  }

  const responsePayload = isRecord(row.response_payload) ? row.response_payload : null;

  return {
    outcome,
    chargeKind: parseChatChargeKind(row.charge_kind),
    balance: isFiniteNumber(row.balance) ? row.balance : 0,
    freeTurnsRemaining: isFiniteNumber(row.free_turns_remaining) ? row.free_turns_remaining : 0,
    retryAfterSeconds: isFiniteNumber(row.retry_after_seconds) ? row.retry_after_seconds : 0,
    responsePayload
  };
};

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
    ...(isFiniteNumber(record.daysAway) ? { daysAway: record.daysAway } : {}),
    ...(record.localTimeOfDay === "day" || record.localTimeOfDay === "night" ? { localTimeOfDay: record.localTimeOfDay } : {})
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

  const petProfile = validatePetProfile(record.petProfile);
  const locale = parseChatLocale(record.locale);

  if (!petProfile || !locale) {
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
    locale,
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

// Server truth for the "free chats remaining" count the mobile chip/pip UI
// shows: chat_access carries two independent free-allowance sources
// (0014_chat_turn_guardrails.sql) -- a lifetime starter_free_remaining
// counter and a once-per-UTC-day daily_free_on marker. This used to select
// only starter_free_remaining, so once that lifetime allowance ran low the
// chip undercounted by exactly the still-available daily turn (e.g. showing
// "1 chat left" when a fresh daily turn made 2 actually available). The
// day-boundary math itself lives in freeAllowance.ts, which mirrors
// packages/shared/src/domain/chatFreeAllowance.ts and
// reserve_chat_turn's `daily_free_on IS DISTINCT FROM current_date` gate --
// see that file's module doc comment for the UTC-timezone rationale.
const fetchFreeChatTurns = async (admin: SupabaseClient, userId: string, now: string): Promise<number> => {
  const { data, error } = await admin
    .from("chat_access")
    .select("starter_free_remaining, daily_free_on")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !isRecord(data) || !isFiniteNumber(data.starter_free_remaining)) {
    return computeFreeChatTurnsRemaining({ starterFreeRemaining: DEFAULT_STARTER_FREE_REMAINING, dailyFreeOn: null }, now);
  }

  const dailyFreeOn = typeof data.daily_free_on === "string" ? data.daily_free_on : null;

  return computeFreeChatTurnsRemaining({ starterFreeRemaining: data.starter_free_remaining, dailyFreeOn }, now);
};

const failReservedChatTurn = async (
  admin: SupabaseClient,
  userId: string,
  requestId: string,
  failureCode: string
): Promise<boolean> => {
  const { error } = await admin.rpc("fail_chat_turn", {
    p_user: userId,
    p_request_id: requestId,
    p_failure_code: failureCode
  });

  return !error;
};

const toSummaryMessage = (row: MessageRow): ChatSummaryRecentMessage => ({
  sender: row.sender,
  text: row.text,
  createdAt: row.created_at
});

// ---------------------------------------------------------------------------
// Long-term memory: summary compaction (summary.ts, §3.2, Chat Live Wave C3
// -- see module doc comment step 7). Called after every message save (both
// the crisis-referral branch and the normal turn branch) with:
//   - combinedMessagesAsc: every currently-known message for this
//     conversation in ascending order -- the pre-turn recent window plus the
//     two messages just saved this turn. Every raw row still in the table is
//     by definition newer than `summarized_through` (compact_conversation
//     deletes anything at or before it), so this list *is* the unsummarized
//     backlog; no separate DB query is needed to compute it.
//   - previousLastMessageCreatedAt: created_at of the most recent message
//     that existed *before* this turn (null for a brand-new conversation) --
//     used only for the stale-resume trigger (shouldTriggerChatSummary's
//     second condition), which measures the gap between that prior message
//     and `now`. Using `now` for both sides of that comparison would zero the
//     gap and silently disable the stale-resume trigger.
//
// Best-effort (module doc comment step 7): this function never throws --
// every failure (OpenAI, RPC) is caught and logged so a summary hiccup can
// never fail an otherwise-successful chat turn. summarized_through is only
// advanced by a successful compact_conversation call, so a failed attempt
// leaves the backlog exactly where it was and the same batch re-triggers on
// the next turn (or the next stale-resume).
// ---------------------------------------------------------------------------

const maybeCompactConversationSummary = async (
  admin: SupabaseClient,
  conversation: ConversationRow,
  combinedMessagesAsc: readonly ChatSummaryRecentMessage[],
  previousLastMessageCreatedAt: string | null,
  now: string,
  locale: string,
  openAiApiKey: string | undefined
): Promise<void> => {
  // Trigger decision + batch/watermark selection is pure and lives in
  // summary.ts's planChatSummaryCompaction (unit tested there) -- this
  // function only owns the side-effecting provider call + RPC persistence.
  const plan = planChatSummaryCompaction({
    combinedMessagesAsc,
    previousLastMessageCreatedAt,
    now,
    keepRecentCount: CHAT_SUMMARY_KEEP_RECENT_COUNT
  });

  if (!plan) {
    return;
  }

  try {
    const provider = DRY_RUN
      ? createLocalChatSummaryProvider()
      : createOpenAiChatSummaryProvider({ apiKey: openAiApiKey ?? "" });

    const { summary } = await provider.summarize({
      existingSummary: conversation.summary,
      messages: plan.batch,
      locale
    });

    // Atomic: advances summarized_through to plan.through and deletes every
    // raw message at or before it in the same transaction (supabase/
    // migrations/0006_conversations.sql's compact_conversation) -- summary is
    // only ever persisted together with the delete of the raw text it was
    // built from, never the raw text kept around after a successful summary
    // (§3.5 privacy-first option A).
    const { error } = await admin.rpc("compact_conversation", {
      p_conversation_id: conversation.id,
      p_summary: summary,
      p_through: plan.through
    });

    if (error) {
      console.error("[chat-turn] compact_conversation RPC failed (best-effort, will retry later)", error);
    }
  } catch (error) {
    console.error("[chat-turn] summary compaction failed (best-effort, will retry later)", error);
  }
};

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!CHAT_LIVE_ENABLED) {
    return jsonResponse({ error: "chat_disabled", message: failureMessages.chatDisabled }, 503);
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
  const recentAsc = [...recentDesc].reverse();

  // Most recent message that existed *before* this turn, if any -- used only
  // by maybeCompactConversationSummary's stale-resume trigger (see its doc
  // comment). Captured here, before this turn's own messages are saved below,
  // so the gap it measures is "how long was this thread quiet before this
  // message arrived", not zero.
  const previousLastMessageCreatedAt = recentAsc.length > 0 ? (recentAsc.at(-1)?.created_at ?? null) : null;

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

    // 7. Long-term memory (module doc comment step 7) -- best-effort, never
    // fails this response (see maybeCompactConversationSummary's doc comment).
    await maybeCompactConversationSummary(
      admin,
      conversation,
      [...recentAsc.map(toSummaryMessage), ...(savedMessages as MessageRow[]).map(toSummaryMessage)],
      previousLastMessageCreatedAt,
      now,
      body.locale,
      openAiApiKey
    );

    return jsonResponse(
      {
        conversation: mapConversationRow(conversation),
        userMessage: mapMessageRow(savedMessages[0] as MessageRow),
        petMessage: mapMessageRow(savedMessages[1] as MessageRow),
        safetyFlags: moderation.safetyFlags,
        serverBalance: await fetchCreditBalance(admin, userId),
        chargedCredit: 0,
        chargeKind: "crisis",
        freeTurnsRemaining: await fetchFreeChatTurns(admin, userId, now),
        crisisReferral: true
      },
      200
    );
  }

  const { data: reservationData, error: reservationError } = await admin.rpc("reserve_chat_turn", {
    p_user: userId,
    p_request_id: body.requestId,
    p_conversation_id: conversation.id,
    p_pet_id: body.petId,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max_requests: RATE_LIMIT_MAX_USER_MESSAGES,
    p_credit_cost: CHAT_TURN_CREDIT_COST
  });
  const reservation = parseChatTurnReservation(reservationData);

  if (reservationError || !reservation) {
    return jsonResponse({ error: "chat_reservation_failed", message: failureMessages.providerUnavailable }, 503);
  }

  if (reservation.outcome === "replay" && reservation.responsePayload) {
    return jsonResponse(reservation.responsePayload, 200);
  }

  if (reservation.outcome === "rate_limited") {
    return jsonResponse(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(Math.max(1, reservation.retryAfterSeconds)) }
    );
  }

  if (reservation.outcome === "insufficient_credits") {
    return jsonResponse({ error: "insufficient_credits", message: failureMessages.insufficientCredits }, 402);
  }

  if (reservation.outcome === "in_progress") {
    return jsonResponse(
      { error: "request_in_progress", message: failureMessages.providerUnavailable },
      409,
      { "Retry-After": String(Math.max(1, reservation.retryAfterSeconds)) }
    );
  }

  if (reservation.outcome !== "reserved" || !reservation.chargeKind) {
    return jsonResponse({ error: "request_conflict", message: failureMessages.providerUnavailable }, 409);
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
      // conversationSummary is undefined until maybeCompactConversationSummary
      // (module doc comment step 7, summary.ts) has run at least once for this
      // conversation. Once it has, conversations.summary holds the merged B안
      // long-term summary and is injected here on every subsequent turn.
      ...(conversation.summary ? { conversationSummary: conversation.summary } : {})
    });
  } catch {
    const restored = await failReservedChatTurn(admin, userId, body.requestId, "provider_unavailable");

    if (!restored) {
      return jsonResponse({ error: "chat_reconciliation_required" }, 500);
    }

    return jsonResponse({ error: "premium_chat_provider_unavailable", message: failureMessages.providerUnavailable }, 503);
  }

  // 8. Output moderation (§5.2 layer 2 backstop).
  const providerOutput = moderatePremiumChatProviderReply(providerReply, body.locale);

  if (!providerOutput.ok) {
    const restored = await failReservedChatTurn(admin, userId, body.requestId, providerOutput.code);

    if (!restored) {
      return jsonResponse({ error: "chat_reconciliation_required" }, 500);
    }

    return jsonResponse({ error: providerOutput.code, message: providerOutput.messageSafe }, providerOutput.status);
  }

  // 9. Persist both messages and the replay payload in one database
  // transaction. A partial "messages saved, request still reserved" state
  // would otherwise strand the request after a network/RPC failure.
  //
  // freeTurnsRemaining is read fresh via fetchFreeChatTurns rather than taken
  // from reservation.freeTurnsRemaining: reserve_chat_turn's own return value
  // only ever reflects starter_free_remaining (see its RPC body in
  // 0014_chat_turn_guardrails.sql/0018_chat_day_pass.sql, unchanged here per
  // the "don't touch the RPC" constraint), which is exactly the bug this
  // fetchFreeChatTurns update fixes. reserve_chat_turn already committed its
  // transaction before returning, so this fresh SELECT sees the authoritative
  // post-charge chat_access row (including any starter decrement or
  // daily_free_on stamp this very turn just made).
  const responseBase = {
    conversation: mapConversationRow(conversation),
    safetyFlags: providerOutput.safetyFlags,
    serverBalance: reservation.balance,
    chargedCredit: reservation.chargeKind === "credit" ? CHAT_TURN_CREDIT_COST : 0,
    chargeKind: reservation.chargeKind,
    freeTurnsRemaining: await fetchFreeChatTurns(admin, userId, now),
    crisisReferral: false
  };
  const { data: responsePayload, error: completionError } = await admin.rpc("complete_chat_turn", {
    p_user: userId,
    p_request_id: body.requestId,
    p_conversation_id: conversation.id,
    p_user_text: moderation.normalizedText,
    p_user_safety_flags: moderation.safetyFlags,
    p_pet_text: providerOutput.text,
    p_pet_safety_flags: providerOutput.safetyFlags,
    p_response_base: responseBase
  });

  if (completionError || !isRecord(responsePayload)) {
    const restored = await failReservedChatTurn(admin, userId, body.requestId, "completion_failed");

    if (!restored) {
      return jsonResponse({ error: "chat_reconciliation_required" }, 500);
    }

    return jsonResponse({ error: "chat_completion_failed", message: failureMessages.providerUnavailable }, 500);
  }

  // 11. Long-term memory (module doc comment step 7) -- best-effort, never
  // fails this response (see maybeCompactConversationSummary's doc comment).
  await maybeCompactConversationSummary(
    admin,
    conversation,
    [
      ...recentAsc.map(toSummaryMessage),
      { sender: "user", text: moderation.normalizedText, createdAt: now },
      { sender: "pet_ai", text: providerOutput.text, createdAt: now }
    ],
    previousLastMessageCreatedAt,
    now,
    body.locale,
    openAiApiKey
  );

  return jsonResponse(responsePayload, 200);
});
