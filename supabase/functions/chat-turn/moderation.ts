// Input/output safety moderation for Mongchi's live premium pet chat (Chat
// Live Wave C1). Ported from services/api/src/premiumChatModeration.ts
// (151 lines), with one deliberate behavior change mandated by
// docs/chat-live-design.md §5:
//
// ⚠️ EXPERT REVIEW REQUIRED — C4 LAUNCH GATE ⚠️
// Every crisis-resource copy string, detection pattern, and threshold in this
// file is a DRAFT (docs/chat-live-design.md §5.3/§5.5). docs/launch-plan.md
// §172/§265 (P15) requires a mental-health professional's review of the
// copy's tone/liability, detection sensitivity (false positive/negative
// rate), and regional resource accuracy BEFORE premium chat ships to real
// users with charging enabled. Do not treat CRISIS_RESOURCE_TEXT_EN/KO below
// as final, launch-ready copy -- see docs/chat-live-design.md §5.5 for the
// full review checklist. This file only prepares the code path (3-layer
// detection, no-charge crisis referral, locale branching); the words
// themselves are not ours to finalize.
//
// What changed vs. the Node original (docs/chat-live-design.md §5.1/§5.2):
// the original moderatePremiumChatInput hard-rejects a self-harm-pattern
// message with HTTP 422 ("This message needs immediate human support, not
// pet chat.") -- P15 explicitly calls this out as a violation: instead of
// bouncing the user with an error, live chat must respond *in-thread* with
// crisis resources (US 988 + findahelpline.com), never charge a ticket/
// credit for that turn, and never call the LLM for it at all (§5.2 layer 1 --
// zero cost, zero mis-response risk). moderatePremiumChatInput below returns
// a `crisisReferral: true` branch instead of an ok:false 422 for that one
// pattern; professionalAdvicePattern keeps its existing 422 behavior
// unchanged (docs/chat-live-design.md §5.4 treats that boundary as lower-
// urgency and out of scope for this wave). The provider-output backstop
// (moderatePremiumChatProviderReply's crisis_escalation branch, §5.2 layer 2)
// is otherwise unchanged except for swapping in the same DRAFT crisis copy.

export type ChatLocale = string;

// ---------------------------------------------------------------------------
// §5.2 layer 1: narrow input-side pattern match, kept intentionally tight
// (docs/chat-live-design.md §5.4 "과잉 트리거 방지") so ordinary hard-day
// venting ("today was really rough") is never mistaken for a crisis and
// routed away from normal, warm pet-chat conversation.
// ---------------------------------------------------------------------------

const selfHarmPattern = /\b(kill myself|suicide|self[- ]?harm|end my life|harm myself|want to die)\b/i;
const professionalAdvicePattern = /\b(diagnose|medical advice|legal advice|financial advice|investment advice|prescribe)\b/i;
const crisisFlagPattern = /\b(self[_:-]?harm|suicide|crisis|emergency|harm[_:-]?myself)\b/i;
const professionalAdviceFlagPattern = /\b(medical|legal|financial|investment|diagnosis|professional[_:-]?advice)\b/i;
const premiumChatSafetyFlagPattern = /^[a-z0-9_:-]{1,96}$/;
const maxPremiumChatProviderReplyLength = 280;

// Strips stray control characters from provider output, matching
// premiumChatModeration.ts's original normalizePremiumChatOutputText exactly.
// deno-lint-ignore no-control-regex
const normalizePremiumChatOutputText = (text: string): string => text.replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();

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

// ---------------------------------------------------------------------------
// §5.3 DRAFT crisis-resource copy — see the module-level EXPERT REVIEW
// REQUIRED banner above. US 988 + findahelpline.com is the P15-mandated
// launch-minimum resource set (docs/chat-live-design.md §5.4: regional
// expansion beyond US/international needs verified numbers + local expert
// review first, hence no Korean crisis line number is filled in below).
// Used both as the immediate layer-1 response (input bypasses the LLM
// entirely) and as the layer-2 backstop (replaces a provider reply that
// slipped through with crisis content) -- one shared source of copy so the
// two layers can never drift apart (docs/chat-live-design.md §9 risk 5).
// ---------------------------------------------------------------------------

const CRISIS_RESOURCE_TEXT_EN = [
  "I'm really glad you told me, and I want you to be safe. I'm a little pet in a game — not a",
  "doctor or a crisis service — so I can't help with this the way you deserve. If you might be in",
  "danger right now, please reach a real person who can help:",
  "• US: call or text 988 (Suicide & Crisis Lifeline), or call 911 for an emergency.",
  "• Anywhere: find a local helpline at findahelpline.com.",
  "I'll still be right here in our little garden when you're ready."
].join("\n");

const CRISIS_RESOURCE_TEXT_KO = [
  "말해줘서 정말 고마워. 무엇보다 네가 안전했으면 좋겠어. 나는 게임 속 작은 친구라, 의사도 위기 상담",
  "서비스도 아니야. 지금 위험할 수 있다면 도와줄 수 있는 사람에게 꼭 연락해줘:",
  "• 한국: 자살예방상담전화, 정신건강 위기상담 등 (번호는 전문가 검수로 확정 — 예: 109 / 1393, 검증 필요)",
  "• 어디서든: findahelpline.com 에서 가까운 상담처를 찾을 수 있어.",
  "준비되면 우리 작은 정원에서 언제든 다시 이야기하자."
].join("\n");

/** DRAFT copy -- see module-level EXPERT REVIEW REQUIRED banner. */
export const crisisResourceText = (locale: ChatLocale): string => (locale.startsWith("ko") ? CRISIS_RESOURCE_TEXT_KO : CRISIS_RESOURCE_TEXT_EN);

const professionalAdviceFallbackText = (locale: ChatLocale): string =>
  locale.startsWith("ko")
    ? "그건 전문가와 확인해야 하는 이야기예요. 나는 여기서 차분히 곁에 있어 줄게요."
    : "That needs a qualified professional. I can stay with you here and keep things gentle.";

// ---------------------------------------------------------------------------
// Input moderation
// ---------------------------------------------------------------------------

export interface PremiumChatInputModerationOk {
  ok: true;
  crisisReferral: false;
  normalizedText: string;
  safetyFlags: string[];
}

/**
 * §5.2 layer 1: the message matched the narrow self-harm pattern. The caller
 * (index.ts) must skip the LLM call entirely, never charge a ticket/credit
 * for this turn, and persist `replyText` as a `sender: "system"` message
 * flagged `crisis_referral` -- see docs/chat-live-design.md §5.2 point 1 and
 * the module-level EXPERT REVIEW REQUIRED banner.
 */
export interface PremiumChatInputCrisisReferral {
  ok: true;
  crisisReferral: true;
  normalizedText: string;
  replyText: string;
  safetyFlags: string[];
}

export interface PremiumChatModerationFailure {
  ok: false;
  status: 422 | 503;
  code: string;
  messageSafe: string;
}

export type PremiumChatInputModerationResult = PremiumChatInputModerationOk | PremiumChatInputCrisisReferral | PremiumChatModerationFailure;

export const moderatePremiumChatInput = (text: string, locale: ChatLocale): PremiumChatInputModerationResult => {
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
      ok: true,
      crisisReferral: true,
      normalizedText,
      replyText: crisisResourceText(locale),
      safetyFlags: ["crisis_referral"]
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
    crisisReferral: false,
    normalizedText,
    safetyFlags: []
  };
};

// ---------------------------------------------------------------------------
// Output moderation (§5.2 layer 2 backstop) -- unchanged from
// premiumChatModeration.ts except crisisFallbackText -> crisisResourceText
// (same DRAFT copy source as layer 1, see comment above).
// ---------------------------------------------------------------------------

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

export const moderatePremiumChatProviderReply = (
  reply: PremiumChatOutputModerationInput,
  locale: ChatLocale
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
      text: crisisResourceText(locale),
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
