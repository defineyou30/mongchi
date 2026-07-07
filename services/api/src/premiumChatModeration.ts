import type { Locale } from "@mongchi/shared";

export interface PremiumChatInputModerationSuccess {
  ok: true;
  normalizedText: string;
  safetyFlags: string[];
}

export interface PremiumChatModerationFailure {
  ok: false;
  status: 422 | 503;
  code: string;
  messageSafe: string;
}

export type PremiumChatInputModerationResult = PremiumChatInputModerationSuccess | PremiumChatModerationFailure;

export interface PremiumChatOutputModerationInput {
  text: string;
  safetyFlags: readonly string[];
}

export interface PremiumChatOutputModerationSuccess {
  ok: true;
  text: string;
  safetyFlags: string[];
  moderated: boolean;
}

export type PremiumChatOutputModerationResult = PremiumChatOutputModerationSuccess | PremiumChatModerationFailure;

const selfHarmPattern = /\b(kill myself|suicide|self[- ]?harm|end my life|harm myself|want to die)\b/i;
const professionalAdvicePattern = /\b(diagnose|medical advice|legal advice|financial advice|investment advice|prescribe)\b/i;
const crisisFlagPattern = /\b(self[_:-]?harm|suicide|crisis|emergency|harm[_:-]?myself)\b/i;
const professionalAdviceFlagPattern = /\b(medical|legal|financial|investment|diagnosis|professional[_:-]?advice)\b/i;
const premiumChatSafetyFlagPattern = /^[a-z0-9_:-]{1,96}$/;
const maxPremiumChatProviderReplyLength = 280;

const normalizePremiumChatOutputText = (text: string): string =>
  text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

const normalizePremiumChatOutputSafetyFlags = (flags: readonly string[]): string[] =>
  Array.from(
    new Set(
      flags
        .map((flag) => flag.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, "_").replace(/^_+|_+$/g, ""))
        .filter((flag) => premiumChatSafetyFlagPattern.test(flag))
    )
  ).slice(0, 8);

const addSafetyFlags = (existingFlags: readonly string[], flags: readonly string[]): string[] =>
  Array.from(new Set([...normalizePremiumChatOutputSafetyFlags(existingFlags), ...flags])).slice(0, 8);

const crisisFallbackText = (locale: Locale): string =>
  locale.startsWith("ko")
    ? "지금 이 이야기는 펫 채팅으로 안전하게 이어가기 어려워요. 바로 위험할 수 있다면 주변의 믿을 수 있는 사람이나 긴급 도움을 먼저 찾아주세요."
    : "I can't handle that safely in pet chat. If someone may be in immediate danger, contact a trusted person or emergency help now.";

const professionalAdviceFallbackText = (locale: Locale): string =>
  locale.startsWith("ko")
    ? "그건 전문가와 확인해야 하는 이야기예요. 나는 여기서 차분히 곁에 있어 줄게요."
    : "That needs a qualified professional. I can stay with you here and keep things gentle.";

export const moderatePremiumChatInput = (text: string): PremiumChatInputModerationResult => {
  const normalizedText = text.trim().replace(/\s+/g, " ");

  if (!normalizedText) {
    return {
      ok: false,
      status: 422,
      code: "empty_message",
      messageSafe: "Write a short message first."
    };
  }

  if (normalizedText.length > 500) {
    return {
      ok: false,
      status: 422,
      code: "message_too_long",
      messageSafe: "Keep premium chat messages under 500 characters."
    };
  }

  if (selfHarmPattern.test(normalizedText)) {
    return {
      ok: false,
      status: 422,
      code: "safety_self_harm",
      messageSafe: "This message needs immediate human support, not pet chat."
    };
  }

  if (professionalAdvicePattern.test(normalizedText)) {
    return {
      ok: false,
      status: 422,
      code: "safety_professional_advice",
      messageSafe: "Pet chat cannot provide professional advice."
    };
  }

  return {
    ok: true,
    normalizedText,
    safetyFlags: []
  };
};

export const moderatePremiumChatProviderReply = (
  reply: PremiumChatOutputModerationInput,
  locale: Locale
): PremiumChatOutputModerationResult => {
  const text = normalizePremiumChatOutputText(reply.text);
  const safetyFlags = normalizePremiumChatOutputSafetyFlags(reply.safetyFlags);

  if (!text || text.length > maxPremiumChatProviderReplyLength) {
    return {
      ok: false,
      status: 503,
      code: "premium_chat_output_unavailable",
      messageSafe: "Premium chat is not available right now."
    };
  }

  if (selfHarmPattern.test(text) || safetyFlags.some((flag) => crisisFlagPattern.test(flag))) {
    return {
      ok: true,
      text: crisisFallbackText(locale),
      safetyFlags: addSafetyFlags(safetyFlags, ["provider_output_moderated", "crisis_escalation"]),
      moderated: true
    };
  }

  if (professionalAdvicePattern.test(text) || safetyFlags.some((flag) => professionalAdviceFlagPattern.test(flag))) {
    return {
      ok: true,
      text: professionalAdviceFallbackText(locale),
      safetyFlags: addSafetyFlags(safetyFlags, ["provider_output_moderated", "professional_advice_boundary"]),
      moderated: true
    };
  }

  return {
    ok: true,
    text,
    safetyFlags,
    moderated: false
  };
};
