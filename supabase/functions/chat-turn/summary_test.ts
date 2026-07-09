// Unit tests for summary.ts's pure trigger-decision logic.
//
// summary.ts is an unwired C3 skeleton (see its module doc comment) --
// index.ts never calls shouldTriggerChatSummary yet. These tests exist so
// the one piece of real logic this file ships in wave C1 is verified ahead
// of that wiring work. Run with: deno test summary_test.ts

import { assert, assertFalse } from "jsr:@std/assert@1";
import { SUMMARY_BATCH_THRESHOLD, SUMMARY_STALE_MS, shouldTriggerChatSummary } from "./summary.ts";

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
