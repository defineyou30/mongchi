import { describe, expect, it } from "vitest";

import {
  checkPremiumChatRateLimit,
  filterPremiumChatRetainedMessages,
  resolvePremiumChatPolicy,
  selectPremiumChatContextMessages
} from "../premiumChatPolicy";

const message = (id: string, sender: "user" | "pet_ai", createdAt: string) => ({
  id,
  conversationId: "conv_policy_001",
  sender,
  text: id,
  safetyFlags: [],
  createdAt
});

describe("premium chat policy", () => {
  it("normalizes invalid policy overrides to safe defaults", () => {
    const policy = resolvePremiumChatPolicy({
      maxUserMessagesPerWindow: -1,
      rateLimitWindowMs: 0,
      contextMessageLimit: 1_000,
      retentionWindowMs: 0
    });

    expect(policy.maxUserMessagesPerWindow).toBe(10);
    expect(policy.rateLimitWindowMs).toBe(60_000);
    expect(policy.contextMessageLimit).toBe(16);
    expect(policy.retentionWindowMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("limits repeated user messages inside the configured window", () => {
    const policy = resolvePremiumChatPolicy({
      maxUserMessagesPerWindow: 2,
      rateLimitWindowMs: 60_000
    });
    const allowed = checkPremiumChatRateLimit(
      [message("msg_old", "user", "2026-06-24T09:39:00.000Z"), message("msg_recent", "pet_ai", "2026-06-24T09:40:50.000Z")],
      "2026-06-24T09:41:00.000Z",
      policy
    );
    const limited = checkPremiumChatRateLimit(
      [
        message("msg_recent_1", "user", "2026-06-24T09:40:10.000Z"),
        message("msg_recent_2", "user", "2026-06-24T09:40:50.000Z")
      ],
      "2026-06-24T09:41:00.000Z",
      policy
    );

    expect(allowed).toEqual({ limited: false });
    expect(limited).toEqual({
      limited: true,
      retryAfterSeconds: 10
    });
  });

  it("keeps only the newest messages for provider context", () => {
    const policy = resolvePremiumChatPolicy({
      contextMessageLimit: 2
    });

    expect(
      selectPremiumChatContextMessages(
        [
          message("msg_1", "user", "2026-06-24T09:40:00.000Z"),
          message("msg_2", "pet_ai", "2026-06-24T09:40:10.000Z"),
          message("msg_3", "user", "2026-06-24T09:40:20.000Z")
        ],
        policy
      ).map((candidate) => candidate.id)
    ).toEqual(["msg_2", "msg_3"]);
  });

  it("filters messages outside the retention window", () => {
    const policy = resolvePremiumChatPolicy({
      retentionWindowMs: 60_000
    });

    expect(
      filterPremiumChatRetainedMessages(
        [
          message("msg_old", "user", "2026-06-24T09:39:59.000Z"),
          message("msg_recent", "pet_ai", "2026-06-24T09:40:30.000Z"),
          message("msg_future", "pet_ai", "2026-06-24T09:41:01.000Z")
        ],
        "2026-06-24T09:41:00.000Z",
        policy
      ).map((candidate) => candidate.id)
    ).toEqual(["msg_recent"]);
  });
});
