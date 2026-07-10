// Unit tests for chatProvider.ts.
//
// buildProviderContext is tested directly as a pure function; the OpenAI
// request/response cycle is tested through createOpenAiPremiumChatProvider
// with an injected fake `fetchImpl` (see chatProvider.ts's module doc
// comment point 2) so these tests never touch the network -- matching
// docs/chat-live-design.md §7.1's "실 OpenAI 호출 테스트 금지" principle and
// this project's chromakey_test.ts / deletionPlan_test.ts precedent of
// exercising pure/injectable logic without booting index.ts's Deno.serve.
// Run with: deno test chatProvider_test.ts

import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  buildProviderContext,
  createLocalPremiumChatProvider,
  createOpenAiPremiumChatProvider,
  normalizeReplyText,
  normalizeSafetyFlags,
  refusalTextForLocale,
  type PremiumChatProviderInput
} from "./chatProvider.ts";

const baseInput = (overrides: Partial<PremiumChatProviderInput> = {}): PremiumChatProviderInput => ({
  auth: { userId: "user-1", locale: "en", timezone: "UTC" },
  conversation: { id: "conv-1", type: "premium_ai_chat", status: "open" },
  pet: { id: "pet-1", name: "Mochi", species: "dog", personalityTags: ["gentle", "curious"], talkingStyle: "gentle" },
  userText: "Hi Mochi!",
  safetyFlags: [],
  now: "2026-07-08T00:00:00.000Z",
  ...overrides
});

// ---------------------------------------------------------------------------
// buildProviderContext
// ---------------------------------------------------------------------------

Deno.test("buildProviderContext: includes pet profile, locale, and the user message", () => {
  const context = buildProviderContext(baseInput());

  assertEquals((context.pet as Record<string, unknown>).name, "Mochi");
  assertEquals((context.pet as Record<string, unknown>).species, "dog");
  assertEquals(context.locale, "en");
  assertEquals(context.timezone, "UTC");
  assertEquals(context.userMessage, "Hi Mochi!");
  assertEquals(context.feature, "premium_chat");
});

Deno.test("buildProviderContext: care context values are bucketed into bands, not raw numbers", () => {
  const context = buildProviderContext(
    baseInput({
      careContext: { satiety: 10, energy: 40, happiness: 60, affection: 90, cleanliness: 100, gardenHealth: 0, daysAway: 3 }
    })
  );
  const careContext = context.careContext as Record<string, unknown>;

  assertEquals(careContext.satiety, "critical");
  assertEquals(careContext.energy, "low");
  assertEquals(careContext.happiness, "okay");
  assertEquals(careContext.affection, "great");
  assertEquals(careContext.gardenHealth, "critical");
  assertEquals(careContext.daysAway, 3);
});

Deno.test("buildProviderContext: omits careContext entirely when not provided", () => {
  const context = buildProviderContext(baseInput());
  assertEquals("careContext" in context, false);
});

Deno.test("buildProviderContext: recentMessages is capped to the last 8, in order", () => {
  const recentMessages = Array.from({ length: 12 }, (_, index) => ({
    sender: "user" as const,
    text: `message ${index}`,
    createdAt: `2026-07-08T00:0${index}:00.000Z`
  }));

  const context = buildProviderContext(baseInput({ recentMessages }));
  const recent = context.recentMessages as Array<{ text: string }>;

  assertEquals(recent.length, 8);
  assertEquals(recent[0]?.text, "message 4");
  assertEquals(recent[7]?.text, "message 11");
});

Deno.test("buildProviderContext: forwards memoryContext, capped and trimmed", () => {
  const context = buildProviderContext(
    baseInput({
      memoryContext: {
        recentMemories: [{ type: "milestone", line: "First walk together." }],
        favoriteCareAction: "feed",
        favoriteTreatItemId: "item_treat_plate_biscuit"
      }
    })
  );
  const memoryContext = context.memoryContext as Record<string, unknown>;

  assertEquals(memoryContext.favoriteCareAction, "feed");
  assertEquals(memoryContext.favoriteTreatItemId, "item_treat_plate_biscuit");
  assertEquals((memoryContext.recentMemories as unknown[]).length, 1);
});

Deno.test("buildProviderContext: forwards conversationSummary when present, omits when absent", () => {
  const withSummary = buildProviderContext(baseInput({ conversationSummary: "The user loves rainy days." }));
  assertEquals(withSummary.conversationSummary, "The user loves rainy days.");

  const withoutSummary = buildProviderContext(baseInput());
  assertEquals("conversationSummary" in withoutSummary, false);
});

// ---------------------------------------------------------------------------
// normalizeReplyText / normalizeSafetyFlags
// ---------------------------------------------------------------------------

Deno.test("normalizeReplyText: collapses whitespace/control characters and trims", () => {
  assertEquals(normalizeReplyText("  Hi\tthere \n friend  "), "Hi there friend");
});

Deno.test("normalizeReplyText: truncates to the max reply length", () => {
  const long = "a".repeat(400);
  const normalized = normalizeReplyText(long);
  assertEquals(normalized.length, 280);
});

Deno.test("normalizeReplyText: throws on a non-string value", () => {
  assertThrows(() => normalizeReplyText(42));
});

Deno.test("normalizeSafetyFlags: normalizes case, dedupes, and caps at 8", () => {
  const flags = normalizeSafetyFlags(["Cozy Flag", "cozy_flag", "a", "b", "c", "d", "e", "f", "g", "h"]);
  assert(flags.length <= 8);
  assert(flags.includes("cozy_flag"));
});

// ---------------------------------------------------------------------------
// refusalTextForLocale
// ---------------------------------------------------------------------------

Deno.test("refusalTextForLocale: branches on locale prefix", () => {
  assert(refusalTextForLocale("en-US").startsWith("I can't answer"));
  assert(refusalTextForLocale("ko-KR").startsWith("지금 그 이야기는"));
});

// ---------------------------------------------------------------------------
// createLocalPremiumChatProvider (DRY_RUN mock)
// ---------------------------------------------------------------------------

Deno.test("createLocalPremiumChatProvider: returns a deterministic mock reply referencing the pet's name", async () => {
  const provider = createLocalPremiumChatProvider();
  const result = await provider.generateReply(baseInput());

  assert(result.text.includes("Mochi"));
  assertEquals(result.safetyFlags, []);
});

// ---------------------------------------------------------------------------
// createOpenAiPremiumChatProvider (fetch injected -- no network)
// ---------------------------------------------------------------------------

const fakeFetch =
  (status: number, jsonBody: unknown, captured?: { url?: string; init?: RequestInit }): typeof fetch =>
  ((url: string, init: RequestInit) => {
    if (captured) {
      captured.url = url;
      captured.init = init;
    }
    return Promise.resolve(
      new Response(JSON.stringify(jsonBody), { status, headers: { "Content-Type": "application/json" } })
    );
  }) as typeof fetch;

Deno.test("createOpenAiPremiumChatProvider: parses a successful output_text reply", async () => {
  const provider = createOpenAiPremiumChatProvider({
    apiKey: "sk-test",
    fetchImpl: fakeFetch(200, { output_text: JSON.stringify({ replyText: "Hello friend!", safetyFlags: [] }) })
  });

  const result = await provider.generateReply(baseInput());

  assertEquals(result.text, "Hello friend!");
  assertEquals(result.safetyFlags, []);
});

Deno.test("createOpenAiPremiumChatProvider: sends the model/instructions/schema and embeds the context JSON", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const provider = createOpenAiPremiumChatProvider({
    apiKey: "sk-test",
    model: "gpt-5.5-test",
    fetchImpl: fakeFetch(200, { output_text: JSON.stringify({ replyText: "Hi!", safetyFlags: [] }) }, captured)
  });

  await provider.generateReply(baseInput());

  assert(captured.url?.endsWith("/responses"));
  const requestBody = JSON.parse(captured.init?.body as string);
  assertEquals(requestBody.model, "gpt-5.5-test");
  assertEquals(requestBody.store, false);
  assertEquals(requestBody.text.format.type, "json_schema");
  assertEquals(requestBody.text.format.strict, true);
  const instructions: unknown = requestBody.instructions;
  assert(typeof instructions === "string");
  assert(instructions.includes("inside the phone"));
  assert(!instructions.includes("terrarium"));
  assert(!instructions.includes("tiny garden"));
  const inputText: unknown = requestBody.input?.[0]?.content?.[0]?.text;
  assert(typeof inputText === "string");
  assert(inputText.includes("Hi Mochi!"));
});

Deno.test("createOpenAiPremiumChatProvider: a refusal maps to the locale refusal text and a provider_refusal flag", async () => {
  const provider = createOpenAiPremiumChatProvider({
    apiKey: "sk-test",
    fetchImpl: fakeFetch(200, { output: [{ content: [{ refusal: "cannot comply" }] }] })
  });

  const result = await provider.generateReply(baseInput({ auth: { userId: "u", locale: "ko-KR", timezone: "UTC" } }));

  assertEquals(result.text, refusalTextForLocale("ko-KR"));
  assertEquals(result.safetyFlags, ["provider_refusal"]);
});

Deno.test("createOpenAiPremiumChatProvider: a non-2xx HTTP status throws PremiumChatProviderUnavailableError", async () => {
  const provider = createOpenAiPremiumChatProvider({
    apiKey: "sk-test",
    fetchImpl: fakeFetch(500, { error: "boom" })
  });

  await assertRejects(() => provider.generateReply(baseInput()));
});

Deno.test("createOpenAiPremiumChatProvider: throws when apiKey is empty", () => {
  assertThrows(() => createOpenAiPremiumChatProvider({ apiKey: "   ", fetchImpl: fakeFetch(200, {}) }));
});
