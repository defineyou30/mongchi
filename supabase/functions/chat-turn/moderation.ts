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
// users with charging enabled. Do not treat the localized crisis copy below
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

import { resolveChatLocale } from "./locale.ts";
import type { ChatLocale } from "./locale.ts";

// ---------------------------------------------------------------------------
// §5.2 layer 1: narrow input-side pattern match, kept intentionally tight
// (docs/chat-live-design.md §5.4 "과잉 트리거 방지") so ordinary hard-day
// venting ("today was really rough") is never mistaken for a crisis and
// routed away from normal, warm pet-chat conversation.
// ---------------------------------------------------------------------------

const selfHarmPatterns = [
  /\b(kill myself|suicide|self[- ]?harm|end my life|harm myself|want to die)\b/i,
  /(죽고 싶|자살|자해|목숨을 끊|스스로 해치)/i,
  /(死にたい|自殺|自傷|消えたい)/i,
  /(想死|自殺|自殘|傷害自己|不想活)/i,
  /(mich umbringen|selbstmord|selbstverletz|sterben will)/i,
  /(me suicider|suicide|automutil|envie de mourir)/i,
  /(me matar|suic[ií]dio|automutila|quero morrer)/i,
  /(matarme|suicidio|autolesi|quiero morir)/i
] as const;
const professionalAdvicePatterns = [
  /\b(diagnose|medical advice|legal advice|financial advice|investment advice|prescribe)\b/i,
  /(진단|의학적 조언|법률 조언|투자 조언|처방)/i,
  /(診断|医療相談|法律相談|投資助言|処方)/i,
  /(診斷|醫療建議|法律建議|投資建議|處方)/i,
  /(diagnose|medizinische beratung|rechtsberatung|anlageberatung|verschreiben)/i,
  /(diagnostic|conseil médical|conseil juridique|conseil financier|prescrire)/i,
  /(diagnosticar|conselho médico|aconselhamento jurídico|conselho financeiro|prescrever)/i,
  /(diagnosticar|consejo médico|asesoría legal|consejo financiero|recetar)/i
] as const;
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

interface ModerationLocaleCopy {
  readonly emptyMessage: string;
  readonly messageTooLong: string;
  readonly professionalAdviceInput: string;
  readonly outputUnavailable: string;
  readonly professionalAdviceFallback: string;
  readonly crisisResource: string;
}

// DRAFT crisis copy in every locale; expert review remains required before launch.
const moderationCopyByLocale: Record<ChatLocale, ModerationLocaleCopy> = {
  "en-US": {
    emptyMessage: "Write a short message first.",
    messageTooLong: "Keep premium chat messages under 500 characters.",
    professionalAdviceInput: "Pet chat cannot provide professional advice.",
    outputUnavailable: "Premium chat is not available right now.",
    professionalAdviceFallback: "That needs a qualified professional. I can stay with you here and keep things gentle.",
    crisisResource: [
      "I'm really glad you told me, and I want you to be safe. I'm a little pet in a game, not a doctor or a crisis service, so I can't help with this the way you deserve.",
      "If you might be in danger right now, please reach a real person who can help:",
      "• US: call or text 988 (Suicide & Crisis Lifeline), or call 911 for an emergency.",
      "• Anywhere: find a local helpline at findahelpline.com.",
      "I'll still be right here beside you when you're ready."
    ].join("\n")
  },
  "ko-KR": {
    emptyMessage: "먼저 짧은 메시지를 적어 주세요.",
    messageTooLong: "프리미엄 채팅 메시지는 500자 이내로 적어 주세요.",
    professionalAdviceInput: "펫 채팅은 전문적인 조언을 제공할 수 없어요.",
    outputUnavailable: "지금은 프리미엄 채팅을 이용할 수 없어요.",
    professionalAdviceFallback: "그건 자격을 갖춘 전문가와 확인해야 해요. 나는 여기서 차분히 곁에 있어 줄게요.",
    crisisResource: [
      "말해줘서 정말 고마워. 무엇보다 네가 안전했으면 좋겠어. 나는 게임 속 작은 친구라 의사나 위기 상담 서비스가 아니어서, 네가 받아야 할 도움을 줄 수는 없어.",
      "지금 위험할 수 있다면 도와줄 수 있는 실제 사람에게 바로 연락해줘:",
      "• 미국: 자살·위기 상담전화 988로 전화하거나 문자를 보내고, 긴급 상황이면 911에 전화해줘.",
      "• 어디서든: findahelpline.com에서 가까운 상담처를 찾을 수 있어.",
      "준비되면 나는 여기서 계속 네 곁에 있을게."
    ].join("\n")
  },
  "ja-JP": {
    emptyMessage: "まず短いメッセージを書いてね。",
    messageTooLong: "プレミアムチャットのメッセージは500文字以内にしてね。",
    professionalAdviceInput: "ペットチャットでは専門的な助言はできません。",
    outputUnavailable: "現在、プレミアムチャットは利用できません。",
    professionalAdviceFallback: "それは資格を持つ専門家に確認してね。私はここで静かにそばにいるよ。",
    crisisResource: [
      "話してくれて本当にありがとう。あなたの安全が何より大切だよ。私はゲームの中の小さなペットで、医師や危機支援サービスではないから、必要な助けはできないんだ。",
      "今すぐ危険かもしれないなら、助けてくれる現実の人に連絡してね:",
      "• 米国: 自殺・危機ライフラインの988に電話またはSMSを送り、緊急時は911に電話してください。",
      "• どこからでも: findahelpline.comで地域の相談窓口を探せます。",
      "準備ができたら、私はここでずっとそばにいるよ。"
    ].join("\n")
  },
  "zh-TW": {
    emptyMessage: "請先寫一則簡短訊息。",
    messageTooLong: "進階聊天訊息請控制在500字以內。",
    professionalAdviceInput: "寵物聊天無法提供專業建議。",
    outputUnavailable: "目前無法使用進階聊天。",
    professionalAdviceFallback: "這件事需要向合格的專業人士確認。我可以安靜地留在這裡陪你。",
    crisisResource: [
      "謝謝你願意告訴我，我最希望你能安全。我只是遊戲裡的小寵物，不是醫師或危機支援服務，無法給你真正需要的幫助。",
      "如果你現在可能有危險，請立刻聯絡能幫助你的真人:",
      "• 美國: 撥打或傳簡訊至988自殺與危機生命線；緊急情況請撥911。",
      "• 任何地區: 可到findahelpline.com尋找當地支援專線。",
      "等你準備好時，我仍會在這裡陪著你。"
    ].join("\n")
  },
  "de-DE": {
    emptyMessage: "Schreib zuerst eine kurze Nachricht.",
    messageTooLong: "Premium-Chat-Nachrichten dürfen höchstens 500 Zeichen lang sein.",
    professionalAdviceInput: "Der Haustier-Chat kann keine professionelle Beratung geben.",
    outputUnavailable: "Der Premium-Chat ist gerade nicht verfügbar.",
    professionalAdviceFallback: "Das muss mit einer qualifizierten Fachperson geklärt werden. Ich kann ruhig hier bei dir bleiben.",
    crisisResource: [
      "Ich bin wirklich froh, dass du es mir gesagt hast, und möchte, dass du sicher bist. Ich bin nur ein kleines Haustier in einem Spiel, kein Arzt und kein Krisendienst, deshalb kann ich dir nicht die Hilfe geben, die du verdienst.",
      "Wenn du gerade in Gefahr sein könntest, wende dich bitte sofort an einen echten Menschen, der helfen kann:",
      "• USA: 988 anrufen oder eine SMS senden; im Notfall 911 anrufen.",
      "• Überall: Eine lokale Hilfsstelle findest du auf findahelpline.com.",
      "Wenn du bereit bist, bleibe ich hier an deiner Seite."
    ].join("\n")
  },
  "fr-FR": {
    emptyMessage: "Écris d'abord un court message.",
    messageTooLong: "Les messages du chat premium doivent contenir moins de 500 caractères.",
    professionalAdviceInput: "Le chat avec l'animal ne peut pas fournir de conseil professionnel.",
    outputUnavailable: "Le chat premium n'est pas disponible pour le moment.",
    professionalAdviceFallback: "Cela doit être vérifié avec un professionnel qualifié. Je peux rester calmement près de toi.",
    crisisResource: [
      "Merci de me l'avoir dit. Je veux avant tout que tu sois en sécurité. Je suis un petit animal dans un jeu, pas un médecin ni un service d'aide en situation de crise, et je ne peux donc pas t'apporter l'aide que tu mérites.",
      "Si tu risques d'être en danger maintenant, contacte tout de suite une vraie personne qui peut t'aider:",
      "• États-Unis: appelle ou écris au 988; en cas d'urgence, appelle le 911.",
      "• Partout: trouve une ligne d'aide locale sur findahelpline.com.",
      "Quand tu seras prêt, je resterai ici près de toi."
    ].join("\n")
  },
  "pt-BR": {
    emptyMessage: "Escreva primeiro uma mensagem curta.",
    messageTooLong: "Mantenha as mensagens do chat premium com até 500 caracteres.",
    professionalAdviceInput: "O chat com o pet não pode oferecer orientação profissional.",
    outputUnavailable: "O chat premium não está disponível agora.",
    professionalAdviceFallback: "Isso precisa ser confirmado com um profissional qualificado. Posso ficar aqui com você, com calma.",
    crisisResource: [
      "Fico muito feliz que você tenha me contado, e quero que você fique em segurança. Sou apenas um pet em um jogo, não um médico nem um serviço de crise, então não consigo oferecer a ajuda que você merece.",
      "Se você estiver em perigo agora, procure imediatamente uma pessoa real que possa ajudar:",
      "• EUA: ligue ou envie mensagem para 988; em uma emergência, ligue para 911.",
      "• Em qualquer lugar: encontre uma linha de apoio local em findahelpline.com.",
      "Quando você estiver pronto, continuarei aqui ao seu lado."
    ].join("\n")
  },
  "es-MX": {
    emptyMessage: "Escribe primero un mensaje breve.",
    messageTooLong: "Mantén los mensajes del chat premium por debajo de 500 caracteres.",
    professionalAdviceInput: "El chat con tu mascota no puede dar asesoría profesional.",
    outputUnavailable: "El chat premium no está disponible en este momento.",
    professionalAdviceFallback: "Eso debe consultarse con un profesional calificado. Puedo quedarme aquí contigo con calma.",
    crisisResource: [
      "Gracias por contármelo. Quiero que estés a salvo. Solo soy una pequeña mascota en un juego, no un médico ni un servicio de crisis, así que no puedo darte la ayuda que mereces.",
      "Si podrías estar en peligro ahora, comunícate de inmediato con una persona real que pueda ayudarte:",
      "• EE. UU.: llama o envía un mensaje al 988; en una emergencia, llama al 911.",
      "• En cualquier lugar: encuentra una línea de ayuda local en findahelpline.com.",
      "Cuando estés listo, seguiré aquí a tu lado."
    ].join("\n")
  }
};

const moderationCopyFor = (locale: string): ModerationLocaleCopy => moderationCopyByLocale[resolveChatLocale(locale)];
const matchesAny = (text: string, patterns: readonly RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

/** DRAFT copy -- see module-level EXPERT REVIEW REQUIRED banner. */
export const crisisResourceText = (locale: string): string => moderationCopyFor(locale).crisisResource;

const professionalAdviceFallbackText = (locale: string): string => moderationCopyFor(locale).professionalAdviceFallback;

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

export const moderatePremiumChatInput = (text: string, locale: string): PremiumChatInputModerationResult => {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  const copy = moderationCopyFor(locale);

  if (!normalizedText) {
    return {
      ok: false,
      status: 422,
      code: "empty_message",
      messageSafe: copy.emptyMessage
    };
  }

  if (normalizedText.length > 500) {
    return {
      ok: false,
      status: 422,
      code: "message_too_long",
      messageSafe: copy.messageTooLong
    };
  }

  if (matchesAny(normalizedText, selfHarmPatterns)) {
    return {
      ok: true,
      crisisReferral: true,
      normalizedText,
      replyText: crisisResourceText(locale),
      safetyFlags: ["crisis_referral"]
    };
  }

  if (matchesAny(normalizedText, professionalAdvicePatterns)) {
    return {
      ok: false,
      status: 422,
      code: "safety_professional_advice",
      messageSafe: copy.professionalAdviceInput
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
  locale: string
): PremiumChatOutputModerationResult => {
  const text = normalizePremiumChatOutputText(reply.text);
  const safetyFlags = normalizePremiumChatOutputSafetyFlags(reply.safetyFlags);
  const copy = moderationCopyFor(locale);

  if (!text || text.length > maxPremiumChatProviderReplyLength) {
    return {
      ok: false,
      status: 503,
      code: "premium_chat_output_unavailable",
      messageSafe: copy.outputUnavailable
    };
  }

  if (matchesAny(text, selfHarmPatterns) || safetyFlags.some((flag) => crisisFlagPattern.test(flag))) {
    return {
      ok: true,
      text: crisisResourceText(locale),
      safetyFlags: addSafetyFlags(safetyFlags, ["provider_output_moderated", "crisis_escalation"]),
      moderated: true
    };
  }

  if (matchesAny(text, professionalAdvicePatterns) || safetyFlags.some((flag) => professionalAdviceFlagPattern.test(flag))) {
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
