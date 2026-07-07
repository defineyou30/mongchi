import type { ConversationMessage, ISODateTime } from "@mongchi/shared";

export interface PremiumChatPolicy {
  maxUserMessagesPerWindow: number;
  rateLimitWindowMs: number;
  contextMessageLimit: number;
  retentionWindowMs: number;
}

export type PremiumChatPolicyOptions = Partial<PremiumChatPolicy>;

export interface PremiumChatRateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

export const defaultPremiumChatPolicy: PremiumChatPolicy = {
  maxUserMessagesPerWindow: 10,
  rateLimitWindowMs: 60_000,
  contextMessageLimit: 16,
  retentionWindowMs: 30 * 24 * 60 * 60 * 1000
};

const normalizePositiveInteger = (value: number | undefined, fallback: number, max: number): number => {
  if (value === undefined) {
    return fallback;
  }

  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
};

export const resolvePremiumChatPolicy = (options: PremiumChatPolicyOptions | undefined): PremiumChatPolicy => ({
  maxUserMessagesPerWindow: normalizePositiveInteger(
    options?.maxUserMessagesPerWindow,
    defaultPremiumChatPolicy.maxUserMessagesPerWindow,
    120
  ),
  rateLimitWindowMs: normalizePositiveInteger(options?.rateLimitWindowMs, defaultPremiumChatPolicy.rateLimitWindowMs, 86_400_000),
  contextMessageLimit: normalizePositiveInteger(options?.contextMessageLimit, defaultPremiumChatPolicy.contextMessageLimit, 80),
  retentionWindowMs: normalizePositiveInteger(options?.retentionWindowMs, defaultPremiumChatPolicy.retentionWindowMs, 31_536_000_000)
});

export const filterPremiumChatRetainedMessages = (
  messages: readonly ConversationMessage[],
  requestedAt: ISODateTime,
  policy: PremiumChatPolicy
): ConversationMessage[] => {
  const requestedAtMs = new Date(requestedAt).getTime();

  if (!Number.isFinite(requestedAtMs)) {
    return [];
  }

  const retentionStartMs = requestedAtMs - policy.retentionWindowMs;

  return messages.filter((message) => {
    const createdAtMs = new Date(message.createdAt).getTime();

    return Number.isFinite(createdAtMs) && createdAtMs >= retentionStartMs && createdAtMs <= requestedAtMs;
  });
};

export const selectPremiumChatContextMessages = (
  messages: readonly ConversationMessage[],
  policy: PremiumChatPolicy
): ConversationMessage[] => messages.slice(-policy.contextMessageLimit);

export const checkPremiumChatRateLimit = (
  messages: readonly ConversationMessage[],
  requestedAt: ISODateTime,
  policy: PremiumChatPolicy
): PremiumChatRateLimitResult => {
  const requestedAtMs = new Date(requestedAt).getTime();
  const windowStartMs = requestedAtMs - policy.rateLimitWindowMs;
  const recentUserMessageTimes = messages
    .filter((message) => message.sender === "user")
    .map((message) => new Date(message.createdAt).getTime())
    .filter((createdAtMs) => Number.isFinite(createdAtMs) && createdAtMs >= windowStartMs && createdAtMs <= requestedAtMs)
    .sort((a, b) => a - b);

  if (recentUserMessageTimes.length < policy.maxUserMessagesPerWindow) {
    return {
      limited: false
    };
  }

  const oldestCountedMessageMs = recentUserMessageTimes[0] ?? requestedAtMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((oldestCountedMessageMs + policy.rateLimitWindowMs - requestedAtMs) / 1000));

  return {
    limited: true,
    retryAfterSeconds
  };
};
