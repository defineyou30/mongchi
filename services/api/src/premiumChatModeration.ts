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

type ModerationCopy = {
  readonly crisis: string;
  readonly empty: string;
  readonly outputUnavailable: string;
  readonly professional: string;
  readonly selfHarmInput: string;
  readonly tooLong: string;
};

const moderationCopyByLocale: Record<Locale, ModerationCopy> = {
  "en-US": { empty: "Write a short message first.", tooLong: "Keep premium chat messages under 500 characters.", selfHarmInput: "This message needs immediate human support, not pet chat.", professional: "That needs a qualified professional. I can stay with you here and keep things gentle.", crisis: "I can't handle that safely in pet chat. If someone may be in immediate danger, contact a trusted person or emergency help now.", outputUnavailable: "Premium chat is not available right now." },
  "ko-KR": { empty: "먼저 짧은 메시지를 적어 주세요.", tooLong: "프리미엄 채팅 메시지는 500자 이내로 적어 주세요.", selfHarmInput: "이 메시지는 펫 채팅이 아니라 즉각적인 사람의 도움이 필요해요.", professional: "그건 전문가와 확인해야 하는 이야기예요. 나는 여기서 차분히 곁에 있어 줄게요.", crisis: "지금 이 이야기는 펫 채팅으로 안전하게 이어가기 어려워요. 바로 위험할 수 있다면 주변의 믿을 수 있는 사람이나 긴급 도움을 먼저 찾아주세요.", outputUnavailable: "지금은 프리미엄 채팅을 사용할 수 없어요." },
  "ja-JP": { empty: "まず短いメッセージを書いてください。", tooLong: "プレミアムチャットは500文字以内で入力してください。", selfHarmInput: "このメッセージには、ペットチャットではなく人からのすぐの支援が必要です。", professional: "それは専門家に確認する必要があります。ここでは穏やかに寄り添えます。", crisis: "ペットチャットでは安全に対応できません。今すぐ危険がある場合は、信頼できる人や緊急窓口に連絡してください。", outputUnavailable: "現在プレミアムチャットを利用できません。" },
  "zh-TW": { empty: "請先寫一則簡短訊息。", tooLong: "進階聊天訊息請控制在500字以內。", selfHarmInput: "這則訊息需要真人立即提供協助，而不是寵物聊天。", professional: "這需要合格的專業人士協助。我可以在這裡溫柔陪著你。", crisis: "寵物聊天無法安全處理這件事。如果有人可能正處於立即危險，請立刻聯絡信任的人或緊急服務。", outputUnavailable: "目前無法使用進階聊天。" },
  "de-DE": { empty: "Schreibe zuerst eine kurze Nachricht.", tooLong: "Premium-Chat-Nachrichten müssen unter 500 Zeichen bleiben.", selfHarmInput: "Diese Nachricht braucht sofort menschliche Unterstützung statt eines Haustier-Chats.", professional: "Das gehört zu einer qualifizierten Fachperson. Ich kann ruhig bei dir bleiben.", crisis: "Das kann ich im Haustier-Chat nicht sicher begleiten. Bei unmittelbarer Gefahr kontaktiere bitte eine vertraute Person oder den Notruf.", outputUnavailable: "Der Premium-Chat ist gerade nicht verfügbar." },
  "fr-FR": { empty: "Écrivez d'abord un court message.", tooLong: "Les messages du chat premium doivent rester sous 500 caractères.", selfHarmInput: "Ce message nécessite une aide humaine immédiate, pas un chat avec un animal.", professional: "Cela demande l'avis d'un professionnel qualifié. Je peux rester doucement près de vous.", crisis: "Je ne peux pas gérer cela en toute sécurité ici. En cas de danger immédiat, contactez une personne de confiance ou les secours.", outputUnavailable: "Le chat premium n'est pas disponible pour le moment." },
  "pt-BR": { empty: "Escreva uma mensagem curta primeiro.", tooLong: "Mantenha as mensagens do chat premium com menos de 500 caracteres.", selfHarmInput: "Esta mensagem precisa de apoio humano imediato, não de conversa com o pet.", professional: "Isso precisa de um profissional qualificado. Posso ficar aqui com você com calma.", crisis: "Não consigo lidar com isso com segurança no chat do pet. Se houver perigo imediato, procure uma pessoa de confiança ou ajuda de emergência agora.", outputUnavailable: "A conversa não está disponível agora." },
  "es-MX": { empty: "Escribe primero un mensaje corto.", tooLong: "Mantén los mensajes del chat premium por debajo de 500 caracteres.", selfHarmInput: "Este mensaje necesita apoyo humano inmediato, no un chat con la mascota.", professional: "Eso necesita atención de un profesional calificado. Puedo quedarme aquí contigo con calma.", crisis: "No puedo manejar eso de forma segura en el chat de la mascota. Si hay peligro inmediato, contacta ahora a alguien de confianza o a emergencias.", outputUnavailable: "El chat premium no está disponible en este momento." }
};

const matchesAny = (text: string, patterns: readonly RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

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

export const moderatePremiumChatInput = (text: string, locale: Locale = "en-US"): PremiumChatInputModerationResult => {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  const copy = moderationCopyByLocale[locale];

  if (!normalizedText) {
    return {
      ok: false,
      status: 422,
      code: "empty_message",
      messageSafe: copy.empty
    };
  }

  if (normalizedText.length > 500) {
    return {
      ok: false,
      status: 422,
      code: "message_too_long",
      messageSafe: copy.tooLong
    };
  }

  if (matchesAny(normalizedText, selfHarmPatterns)) {
    return {
      ok: false,
      status: 422,
      code: "safety_self_harm",
      messageSafe: copy.selfHarmInput
    };
  }

  if (matchesAny(normalizedText, professionalAdvicePatterns)) {
    return {
      ok: false,
      status: 422,
      code: "safety_professional_advice",
      messageSafe: copy.professional
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
      messageSafe: moderationCopyByLocale[locale].outputUnavailable
    };
  }

  if (matchesAny(text, selfHarmPatterns) || safetyFlags.some((flag) => crisisFlagPattern.test(flag))) {
    return {
      ok: true,
      text: moderationCopyByLocale[locale].crisis,
      safetyFlags: addSafetyFlags(safetyFlags, ["provider_output_moderated", "crisis_escalation"]),
      moderated: true
    };
  }

  if (matchesAny(text, professionalAdvicePatterns) || safetyFlags.some((flag) => professionalAdviceFlagPattern.test(flag))) {
    return {
      ok: true,
      text: moderationCopyByLocale[locale].professional,
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
