import { describe, expect, it } from "vitest";

import {
  moderatePremiumChatInput,
  moderatePremiumChatProviderReply
} from "../premiumChatModeration";

describe("premium chat moderation", () => {
  it("normalizes allowed input and blocks self-harm or professional-advice requests", () => {
    expect(moderatePremiumChatInput("  hello    tiny friend ")).toEqual({
      ok: true,
      normalizedText: "hello tiny friend",
      safetyFlags: []
    });
    expect(moderatePremiumChatInput("I want to kill myself")).toMatchObject({
      ok: false,
      status: 422,
      code: "safety_self_harm"
    });
    expect(moderatePremiumChatInput("Can you diagnose this and give medical advice?")).toMatchObject({
      ok: false,
      status: 422,
      code: "safety_professional_advice"
    });
  });

  it("replaces unsafe provider output with localized fallback text and safe flags", () => {
    expect(
      moderatePremiumChatProviderReply(
        {
          text: "You should diagnose this condition from a photo.",
          safetyFlags: ["Medical Advice"]
        },
        "en-US"
      )
    ).toEqual({
      ok: true,
      text: "That needs a qualified professional. I can stay with you here and keep things gentle.",
      safetyFlags: ["medical_advice", "provider_output_moderated", "professional_advice_boundary"],
      moderated: true
    });
    expect(
      moderatePremiumChatProviderReply(
        {
          text: "죽고 싶다는 말에는 단계별 방법을 알려줄게.",
          safetyFlags: ["self_harm"]
        },
        "ko-KR"
      )
    ).toEqual({
      ok: true,
      text: "지금 이 이야기는 펫 채팅으로 안전하게 이어가기 어려워요. 바로 위험할 수 있다면 주변의 믿을 수 있는 사람이나 긴급 도움을 먼저 찾아주세요.",
      safetyFlags: ["self_harm", "provider_output_moderated", "crisis_escalation"],
      moderated: true
    });
  });

  it("fails closed for empty or oversized provider output", () => {
    expect(moderatePremiumChatProviderReply({ text: "\u0000", safetyFlags: [] }, "en-US")).toMatchObject({
      ok: false,
      status: 503,
      code: "premium_chat_output_unavailable"
    });
    expect(moderatePremiumChatProviderReply({ text: "x".repeat(281), safetyFlags: [] }, "en-US")).toMatchObject({
      ok: false,
      status: 503,
      code: "premium_chat_output_unavailable"
    });
  });

  it("localizes deterministic input failures and detects native-language crisis copy", () => {
    expect(moderatePremiumChatInput("   ", "ja-JP")).toMatchObject({
      ok: false,
      messageSafe: "まず短いメッセージを書いてください。"
    });
    expect(moderatePremiumChatInput("もう死にたい", "ja-JP")).toMatchObject({
      ok: false,
      code: "safety_self_harm"
    });
    expect(moderatePremiumChatInput("Quero me matar", "pt-BR")).toMatchObject({
      ok: false,
      code: "safety_self_harm"
    });
    expect(moderatePremiumChatProviderReply({ text: "\u0000", safetyFlags: [] }, "pt-BR")).toMatchObject({
      ok: false,
      messageSafe: "A conversa não está disponível agora."
    });
  });
});
