// Unit tests for summary.ts: the pure trigger-decision logic
// (shouldTriggerChatSummary) and the real OpenAI-backed provider
// (createOpenAiChatSummaryProvider), exercised the same way
// chatProvider_test.ts tests createOpenAiPremiumChatProvider -- an injected
// fake `fetchImpl` so these tests never touch the network (docs/chat-live-
// design.md §7.1's "실 OpenAI 호출 테스트 금지"). Run with: deno test summary_test.ts

import { assert, assertEquals, assertFalse, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  ChatSummaryProviderUnavailableError,
  SUMMARY_BATCH_THRESHOLD,
  SUMMARY_STALE_MS,
  createLocalChatSummaryProvider,
  createOpenAiChatSummaryProvider,
  normalizeSummaryText,
  planChatSummaryCompaction,
  shouldTriggerChatSummary,
  type ChatSummaryRecentMessage
} from "./summary.ts";

const NOW = "2026-07-08T12:00:00.000Z";

Deno.test("shouldTriggerChatSummary: no unsummarized messages never triggers", () => {
  assertFalse(
    shouldTriggerChatSummary({ unsummarizedOldMessageCount: 0, lastMessageCreatedAt: NOW, now: NOW })
  );
});

Deno.test("shouldTriggerChatSummary: reaching the batch threshold triggers regardless of recency", () => {
  assert(
    shouldTriggerChatSummary({
      unsummarizedOldMessageCount: SUMMARY_BATCH_THRESHOLD,
      lastMessageCreatedAt: NOW,
      now: NOW
    })
  );
});

Deno.test("shouldTriggerChatSummary: below the batch threshold and freshly active does not trigger", () => {
  assertFalse(
    shouldTriggerChatSummary({
      unsummarizedOldMessageCount: SUMMARY_BATCH_THRESHOLD - 1,
      lastMessageCreatedAt: NOW,
      now: NOW
    })
  );
});

Deno.test("shouldTriggerChatSummary: a stale thread with some unsummarized messages triggers on resume", () => {
  const lastMessageCreatedAt = new Date(new Date(NOW).getTime() - SUMMARY_STALE_MS - 1).toISOString();

  assert(
    shouldTriggerChatSummary({
      unsummarizedOldMessageCount: 1,
      lastMessageCreatedAt,
      now: NOW
    })
  );
});

Deno.test("shouldTriggerChatSummary: a thread just under the stale window does not trigger yet", () => {
  const lastMessageCreatedAt = new Date(new Date(NOW).getTime() - SUMMARY_STALE_MS + 60_000).toISOString();

  assertFalse(
    shouldTriggerChatSummary({
      unsummarizedOldMessageCount: 1,
      lastMessageCreatedAt,
      now: NOW
    })
  );
});

Deno.test("shouldTriggerChatSummary: missing lastMessageCreatedAt with unsummarized messages does not trigger (defensive)", () => {
  assertFalse(
    shouldTriggerChatSummary({ unsummarizedOldMessageCount: 3, lastMessageCreatedAt: null, now: NOW })
  );
});

// ---------------------------------------------------------------------------
// planChatSummaryCompaction -- the pure batch/watermark selection index.ts's
// maybeCompactConversationSummary delegates to (see summary.ts's doc comment
// on this function for why the watermark math is the highest-stakes part).
// ---------------------------------------------------------------------------

const messagesAsc = (count: number, startMinute = 0): ChatSummaryRecentMessage[] =>
  Array.from({ length: count }, (_, index) => ({
    sender: "user" as const,
    text: `message ${index}`,
    createdAt: new Date(new Date(NOW).getTime() - (count - index) * 60_000 + startMinute).toISOString()
  }));

Deno.test("planChatSummaryCompaction: returns null when the backlog is at or below the keep-recent window", () => {
  assertEquals(
    planChatSummaryCompaction({
      combinedMessagesAsc: messagesAsc(8),
      previousLastMessageCreatedAt: NOW,
      now: NOW,
      keepRecentCount: 8
    }),
    null
  );
});

Deno.test("planChatSummaryCompaction: returns null when below both triggers even with some backlog", () => {
  // 8 keep-window + 3 backlog = 11 total, backlog (3) is under SUMMARY_BATCH_THRESHOLD (12) and not stale.
  assertEquals(
    planChatSummaryCompaction({
      combinedMessagesAsc: messagesAsc(11),
      previousLastMessageCreatedAt: NOW,
      now: NOW,
      keepRecentCount: 8
    }),
    null
  );
});

Deno.test("planChatSummaryCompaction: batch threshold trigger returns exactly the backlog, oldest first, watermarked to the batch's last message", () => {
  // 8 keep-window + 12 backlog (== SUMMARY_BATCH_THRESHOLD) = 20 total.
  const all = messagesAsc(20);
  const plan = planChatSummaryCompaction({
    combinedMessagesAsc: all,
    previousLastMessageCreatedAt: NOW,
    now: NOW,
    keepRecentCount: 8
  });

  assert(plan !== null);
  assertEquals(plan.batch.length, 12);
  assertEquals(plan.batch[0]?.text, "message 0");
  assertEquals(plan.batch.at(-1)?.text, "message 11");
  // The watermark must be the batch's own last message, never anything from
  // the kept recent-8 window -- otherwise compact_conversation would delete
  // messages the summary never actually covered.
  assertEquals(plan.through, all[11]?.createdAt);
  assert(plan.through !== all[12]?.createdAt);
});

Deno.test("planChatSummaryCompaction: stale-resume trigger fires on a small backlog after a long quiet gap", () => {
  const staleLastMessage = new Date(new Date(NOW).getTime() - SUMMARY_STALE_MS - 1).toISOString();
  // 8 keep-window + 1 backlog message -- below the batch threshold on its own.
  const all = messagesAsc(9);

  const plan = planChatSummaryCompaction({
    combinedMessagesAsc: all,
    previousLastMessageCreatedAt: staleLastMessage,
    now: NOW,
    keepRecentCount: 8
  });

  assert(plan !== null);
  assertEquals(plan.batch.length, 1);
  assertEquals(plan.through, all[0]?.createdAt);
});

Deno.test("planChatSummaryCompaction: a brand-new conversation (no prior message, small backlog) never triggers", () => {
  assertEquals(
    planChatSummaryCompaction({
      combinedMessagesAsc: messagesAsc(9),
      previousLastMessageCreatedAt: null,
      now: NOW,
      keepRecentCount: 8
    }),
    null
  );
});

// ---------------------------------------------------------------------------
// createLocalChatSummaryProvider (DRY_RUN mock)
// ---------------------------------------------------------------------------

Deno.test("createLocalChatSummaryProvider: falls back to a default summary when there is none yet", async () => {
  const provider = createLocalChatSummaryProvider();
  const result = await provider.summarize({ existingSummary: null, messages: [], locale: "en" });

  assert(result.summary.length > 0);
});

Deno.test("createLocalChatSummaryProvider: echoes the existing summary unchanged (deterministic mock, no OpenAI call)", async () => {
  const provider = createLocalChatSummaryProvider();
  const result = await provider.summarize({
    existingSummary: "The user loves rainy days.",
    messages: [{ sender: "user", text: "Anything at all", createdAt: NOW }],
    locale: "en"
  });

  assertEquals(result.summary, "The user loves rainy days.");
});

// ---------------------------------------------------------------------------
// normalizeSummaryText
// ---------------------------------------------------------------------------

Deno.test("normalizeSummaryText: collapses whitespace/control characters and trims", () => {
  assertEquals(normalizeSummaryText("  The user\tloves rainy \n days.  "), "The user loves rainy days.");
});

Deno.test("normalizeSummaryText: truncates to the defensive max length", () => {
  const long = "a".repeat(2000);
  const normalized = normalizeSummaryText(long);
  assert(normalized.length <= 1000);
});

Deno.test("normalizeSummaryText: throws on a non-string value", () => {
  assertThrows(() => normalizeSummaryText(42));
});

Deno.test("normalizeSummaryText: throws on an empty/whitespace-only value", () => {
  assertThrows(() => normalizeSummaryText("   "));
});

// ---------------------------------------------------------------------------
// createOpenAiChatSummaryProvider (fetch injected -- no network)
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

const baseSummaryInput = (overrides: { existingSummary?: string | null; messages?: ChatSummaryRecentMessage[] } = {}) => ({
  existingSummary: overrides.existingSummary ?? null,
  messages: overrides.messages ?? [{ sender: "user" as const, text: "I love rainy days.", createdAt: NOW }],
  locale: "en"
});

Deno.test("createOpenAiChatSummaryProvider: parses a successful output_text reply", async () => {
  const provider = createOpenAiChatSummaryProvider({
    apiKey: "sk-test",
    fetchImpl: fakeFetch(200, { output_text: "The user enjoys rainy days and gentle walks." })
  });

  const result = await provider.summarize(baseSummaryInput());

  assertEquals(result.summary, "The user enjoys rainy days and gentle walks.");
});

Deno.test("createOpenAiChatSummaryProvider: sends the model/store/verbosity and embeds both the prior summary and new messages as data", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const provider = createOpenAiChatSummaryProvider({
    apiKey: "sk-test",
    model: "gpt-5.5-mini-test",
    fetchImpl: fakeFetch(200, { output_text: "Updated summary." }, captured)
  });

  await provider.summarize(
    baseSummaryInput({
      existingSummary: "The user loves rainy days.",
      messages: [{ sender: "user", text: "My favorite treat is a biscuit.", createdAt: NOW }]
    })
  );

  assert(captured.url?.endsWith("/responses"));
  const requestBody = JSON.parse(captured.init?.body as string);
  assertEquals(requestBody.model, "gpt-5.5-mini-test");
  assertEquals(requestBody.store, false);
  assertEquals(requestBody.text.verbosity, "low");
  const inputText = requestBody.input[0].content[0].text as string;
  assert(inputText.includes("The user loves rainy days."));
  assert(inputText.includes("My favorite treat is a biscuit."));
  // Raw messages/prior summary travel as DATA inside input_text, never as
  // part of `instructions` -- §9 risk 1's prompt-injection separation.
  assert(!(requestBody.instructions as string).includes("My favorite treat is a biscuit."));
});

Deno.test("createOpenAiChatSummaryProvider: merges an existing summary with new messages into one updated summary field", async () => {
  const provider = createOpenAiChatSummaryProvider({
    apiKey: "sk-test",
    fetchImpl: fakeFetch(200, { output_text: "The user loves rainy days and just adopted a habit of morning walks." })
  });

  const result = await provider.summarize(
    baseSummaryInput({
      existingSummary: "The user loves rainy days.",
      messages: [{ sender: "user", text: "I started taking morning walks.", createdAt: NOW }]
    })
  );

  assertEquals(result.summary, "The user loves rainy days and just adopted a habit of morning walks.");
});

Deno.test("createOpenAiChatSummaryProvider: a non-2xx HTTP status throws ChatSummaryProviderUnavailableError", async () => {
  const provider = createOpenAiChatSummaryProvider({
    apiKey: "sk-test",
    fetchImpl: fakeFetch(500, { error: "boom" })
  });

  await assertRejects(() => provider.summarize(baseSummaryInput()), ChatSummaryProviderUnavailableError);
});

Deno.test("createOpenAiChatSummaryProvider: a refusal throws ChatSummaryProviderUnavailableError instead of returning refusal text as a summary", async () => {
  const provider = createOpenAiChatSummaryProvider({
    apiKey: "sk-test",
    fetchImpl: fakeFetch(200, { output: [{ content: [{ refusal: "cannot comply" }] }] })
  });

  await assertRejects(() => provider.summarize(baseSummaryInput()), ChatSummaryProviderUnavailableError);
});

Deno.test("createOpenAiChatSummaryProvider: throws when apiKey is empty", () => {
  assertThrows(() => createOpenAiChatSummaryProvider({ apiKey: "   ", fetchImpl: fakeFetch(200, {}) }));
});
