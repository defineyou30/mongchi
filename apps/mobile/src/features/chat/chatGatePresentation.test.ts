import { describe, expect, it } from "vitest";

import { createInitialCareStats } from "@mongchi/shared";
import type { CareStats, MemoryEntry } from "@mongchi/shared";

import {
  getChatAllowanceChipPresentation,
  getChatConversationStarters,
  getChatMoodPresentation,
  getChatTicketPipsPresentation,
  getPremiumChatAccessPresentation,
  getShortChatActionLabel,
  getShortChatReplyText
} from "./chatGatePresentation";

describe("chat allowance chip", () => {
  it("shows included chat without inventing a numeric limit for Plus", () => {
    expect(getChatAllowanceChipPresentation({ hasPremiumChatEntitlement: true, freeChatTickets: 0, creditBalance: 0 })).toEqual({
      label: "Plus · Included",
      accessibilityLabel: "Plus chat is included"
    });
  });

  it("localizes the allowance summary for Korean", () => {
    expect(
      getChatAllowanceChipPresentation({
        hasPremiumChatEntitlement: false,
        freeChatTickets: 2,
        creditBalance: 8,
        locale: "ko-KR"
      })
    ).toEqual({
      label: "무료 대화 2회 남음",
      accessibilityLabel: "오늘 무료 대화가 2회 남았어요"
    });
  });

  it("shows the exact authoritative free-ticket count before credits", () => {
    expect(getChatAllowanceChipPresentation({ hasPremiumChatEntitlement: false, freeChatTickets: 3, creditBalance: 8 })).toEqual({
      label: "3 chats left",
      accessibilityLabel: "3 free chats remaining"
    });
  });

  it("falls back to exact credits when no free ticket remains", () => {
    expect(getChatAllowanceChipPresentation({ hasPremiumChatEntitlement: false, freeChatTickets: 0, creditBalance: 2 })).toEqual({
      label: "2 credits",
      accessibilityLabel: "2 chat credits available"
    });
  });
});

describe("chat gate presentation", () => {
  it("uses the default short reply before a free talk action starts", () => {
    expect(
      getShortChatReplyText({
        petName: "Miso",
        quickTalkStartedAtMs: null,
        recentReactions: []
      })
    ).toBe("Sunlight is moving slowly across our little spot.");
    expect(getShortChatActionLabel(null)).toBe("Say hello");
    expect(getShortChatActionLabel(null, "ko-KR")).toBe("인사하기");
  });

  it("uses a Korean listening line while a quick reply is pending", () => {
    expect(
      getShortChatReplyText({
        petName: "몽치",
        quickTalkStartedAtMs: new Date("2026-06-27T08:00:00.000Z").getTime(),
        recentReactions: [],
        locale: "ko-KR"
      })
    ).toBe("몽치가 이야기를 듣고 있어요...");
  });

  it("keeps the Korean return greeting short enough for the thought bubble", () => {
    expect(
      getShortChatReplyText({
        petName: "Miso",
        quickTalkStartedAtMs: null,
        recentReactions: [],
        daysAway: 2,
        locale: "ko-KR"
      })
    ).toBe("Miso는 문 쪽을 바라보며 기다렸어요.");
  });

  it("uses the current care need before a free talk action starts", () => {
    expect(
      getShortChatReplyText({
        petName: "Miso",
        quickTalkStartedAtMs: null,
        recentReactions: [],
        satisfactionSummary: {
          primaryNeed: "thirst",
          hint: "A little water would help."
        }
      })
    ).toBe("Tiny water emergency. My bowl needs a refill.");
  });

  it("uses a soft return line before care needs after days away", () => {
    expect(
      getShortChatReplyText({
        petName: "Miso",
        quickTalkStartedAtMs: null,
        recentReactions: [],
        daysAway: 2,
        satisfactionSummary: {
          primaryNeed: "food",
          hint: "A meal would help most."
        }
      })
    ).toBe("Miso kept one ear pointed at the door the whole time.");
  });

  it("greets with a memory-aware line instead of the generic status line when memories and careStats are provided", () => {
    const careStats: CareStats = { ...createInitialCareStats(), actionCounts: { clean: 3 }, totalCareActions: 3 };
    const memories: MemoryEntry[] = [];

    const line = getShortChatReplyText({
      petName: "Miso",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      memories,
      careStats,
      careState: {
        satiety: 80,
        happiness: 80,
        energy: 80,
        gardenHealth: 80,
        cleanliness: 80,
        affection: 80,
        lastInteractionAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-24T09:00:00.000Z"
      },
      now: "2026-06-24T09:00:00.000Z"
    });

    expect(line).toBe("I always look forward to the good brushes with you.");
  });

  it("greets with a walk-aware line when isOnWalk is true, ahead of the memory-aware greeting", () => {
    const careStats: CareStats = { ...createInitialCareStats(), actionCounts: { clean: 3 }, totalCareActions: 3 };
    const memories: MemoryEntry[] = [];

    const line = getShortChatReplyText({
      petName: "Miso",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      memories,
      careStats,
      now: "2026-06-24T09:00:00.000Z",
      isOnWalk: true
    });

    expect(["On my walk! Smells amazing out here.", "Can't talk long -- I'm out and about right now."]).toContain(line);
  });

  it("greets with a walk-aware line when isOnWalk is true even with no memories/careStats passed", () => {
    const line = getShortChatReplyText({
      petName: "Miso",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      now: "2026-06-24T09:00:00.000Z",
      isOnWalk: true
    });

    expect(["On my walk! Smells amazing out here.", "Can't talk long -- I'm out and about right now."]).toContain(line);
  });

  it("does not use the walk greeting once a quick-talk reply is already in progress", () => {
    const line = getShortChatReplyText({
      petName: "Miso",
      quickTalkStartedAtMs: new Date("2026-06-27T08:00:00.000Z").getTime(),
      recentReactions: [
        {
          ruleId: "old_reaction",
          line: "Older line",
          shownAt: "2026-06-27T07:59:59.000Z"
        }
      ],
      isOnWalk: true
    });

    expect(line).toBe("Miso is listening...");
  });

  it("shows the latest reaction created by the short talk action", () => {
    expect(
      getShortChatReplyText({
        petName: "Miso",
        quickTalkStartedAtMs: new Date("2026-06-27T08:00:00.000Z").getTime(),
        recentReactions: [
          {
            ruleId: "ko_premium_teaser_001",
            line: "짧게 말해도 좋고, 오래 있어도 좋아.",
            shownAt: "2026-06-27T08:00:01.000Z"
          },
          {
            ruleId: "ko_generation_reveal_001",
            line: "여기가 우리 집이야?",
            shownAt: "2026-06-27T07:59:00.000Z"
          }
        ]
      })
    ).toBe("짧게 말해도 좋고, 오래 있어도 좋아.");
    expect(getShortChatActionLabel(new Date("2026-06-27T08:00:00.000Z").getTime())).toBe("Say again");
    expect(getShortChatActionLabel(new Date("2026-06-27T08:00:00.000Z").getTime(), "ko-KR")).toBe("다시 말하기");
  });

  it("uses a pending line while the API reaction has not synced yet", () => {
    expect(
      getShortChatReplyText({
        petName: "Miso",
        quickTalkStartedAtMs: new Date("2026-06-27T08:00:00.000Z").getTime(),
        recentReactions: [
          {
            ruleId: "old_reaction",
            line: "Older line",
            shownAt: "2026-06-27T07:59:59.000Z"
          }
        ]
      })
    ).toBe("Miso is listening...");
  });

  it("shows ready free-chat copy when the API path and payment method are available", () => {
    expect(
      getPremiumChatAccessPresentation({
        petName: "Miso",
        apiReady: true,
        payment: {
          mode: "free_ticket",
          canStart: true,
          label: "1 ticket",
          detail: "Next reply uses 1 ticket.",
          creditCost: 1
        },
        hasPremiumChatEntitlement: false,
        freeChatTickets: 1,
        creditBalance: 3
      })
    ).toMatchObject({
      ready: true,
      isLocked: false,
      title: "Chatting with Miso",
      detail: "Next reply uses 1 ticket.",
      balanceLabel: "1 ticket · 3 credits",
      ctaLabel: "Start chatting",
      inputPlaceholder: "Say something to Miso…",
      chatPips: {
        label: "Today's little chats",
        filled: 1,
        total: 5,
        overflow: 0
      }
    });
  });

  it("still reads as free-chat-available (not locked) when a ticket or credit exists but the long-chat API isn't ready yet", () => {
    expect(
      getPremiumChatAccessPresentation({
        petName: "Miso",
        apiReady: false,
        payment: {
          mode: "credit",
          canStart: true,
          label: "3 credits",
          detail: "Next reply uses 1 credit.",
          creditCost: 1
        },
        hasPremiumChatEntitlement: false,
        freeChatTickets: 0,
        creditBalance: 3
      })
    ).toMatchObject({
      ready: false,
      isLocked: false,
      title: "Miso is happy to chat",
      detail: "Next reply uses 1 credit.",
      balanceLabel: "0 tickets · 3 credits",
      ctaLabel: "Say hello",
      inputPlaceholder: "Say something to Miso…",
      chatPips: {
        label: "Today's little chats",
        filled: 0,
        total: 5,
        overflow: 0
      }
    });
  });

  it("softly explains tomorrow's reset when no ticket, credit, or Plus pass can start chat", () => {
    expect(
      getPremiumChatAccessPresentation({
        petName: "Miso",
        apiReady: true,
        payment: {
          mode: "locked",
          canStart: false,
          label: "No chat credit",
          detail: "Use a ticket, credit, or Plus pass.",
          creditCost: 1
        },
        hasPremiumChatEntitlement: false,
        freeChatTickets: 0,
        creditBalance: 0
      })
    ).toMatchObject({
      ready: false,
      isLocked: true,
      title: "Miso will have more to say tomorrow",
      balanceLabel: "0 tickets · 0 credits",
      inputPlaceholder: "Miso will have more to say tomorrow — or keep chatting with credits.",
      chatPips: {
        label: "Today's little chats",
        filled: 0,
        total: 5,
        overflow: 0
      }
    });
  });

  it("localizes the locked premium-chat state for Korean", () => {
    expect(
      getPremiumChatAccessPresentation({
        petName: "몽치",
        apiReady: true,
        payment: {
          mode: "locked",
          canStart: false,
          label: "No chat credit",
          detail: "Use a ticket, credit, or Plus pass.",
          creditCost: 1
        },
        hasPremiumChatEntitlement: false,
        freeChatTickets: 0,
        creditBalance: 0,
        locale: "ko-KR"
      })
    ).toMatchObject({
      title: "몽치는 내일 더 많은 이야기를 들려줄 거예요",
      detail: "크레딧으로 대화를 계속할 수도 있어요.",
      balanceLabel: "무료 대화 0회 · 크레딧 0개",
      ctaLabel: "크레딧 받기",
      inputPlaceholder: "몽치는 내일 더 많은 이야기를 들려줄 거예요"
    });
  });

  it("localizes conversation starters for Korean", () => {
    expect(
      getChatConversationStarters({
        petName: "몽치",
        now: "2026-06-24T14:00:00.000Z",
        locale: "ko-KR"
      })
    ).toEqual(["늦었네. 같이 쉬면서 이야기할까?", "오늘 하루가 길었어. 내 얘기 들어줄래?"]);
  });

  it("localizes dynamic chat copy for Japanese without English fallbacks", () => {
    expect(
      getChatAllowanceChipPresentation({
        hasPremiumChatEntitlement: false,
        freeChatTickets: 2,
        creditBalance: 8,
        locale: "ja-JP"
      })
    ).toEqual({
      label: "無料チャット残り2回",
      accessibilityLabel: "今日の無料チャットはあと2回です"
    });
    expect(
      getChatMoodPresentation({
        petName: "Momo",
        satisfactionScore: 72,
        satisfactionSummary: { label: "content", hint: "A little water would help." },
        locale: "ja-JP"
      })
    ).toEqual({
      value: 72,
      label: "気分 72",
      accessibilityLabel: "Momoの気分は100点満点中72点です。"
    });
    expect(
      getShortChatReplyText({
        petName: "Momo",
        quickTalkStartedAtMs: null,
        recentReactions: [],
        satisfactionSummary: { primaryNeed: "thirst", hint: "A little water would help." },
        locale: "ja-JP"
      })
    ).toBe("お水をひと口飲んだら、もっと元気になれそう。");
    expect(getShortChatActionLabel(null, "ja-JP")).toBe("ごあいさつ");
    expect(
      getChatConversationStarters({
        petName: "Momo",
        now: "2026-06-24T14:00:00.000Z",
        locale: "ja-JP"
      })
    ).toEqual(["もう遅いね。一緒にのんびりお話しする？", "今日は長い一日だったよ。お話を聞いてくれる？"]);
    expect(
      getPremiumChatAccessPresentation({
        petName: "Momo",
        apiReady: true,
        payment: {
          mode: "credit",
          canStart: true,
          label: "2 credits",
          detail: "Next reply uses 2 credits.",
          creditCost: 2
        },
        hasPremiumChatEntitlement: false,
        freeChatTickets: 0,
        creditBalance: 4,
        locale: "ja-JP"
      })
    ).toMatchObject({
      title: "Momoとおしゃべり",
      detail: "次の返信で2クレジット使います。",
      balanceLabel: "無料チャット0回 · 4クレジット",
      ctaLabel: "おしゃべりを始める",
      inputPlaceholder: "Momoに話しかける…",
      accessibilityLabel: "Momoとおしゃべりする準備ができました。次の返信で2クレジット使います。 残高は無料チャット0回 · 4クレジットです。"
    });
  });

  it("shows a warm bounded pip row for free chat tickets instead of a bare number", () => {
    expect(getChatTicketPipsPresentation(2, false)).toEqual({
      label: "Today's little chats",
      filled: 2,
      total: 5,
      overflow: 0
    });
  });

  it("caps the pip row at five dots and reports the rest as overflow", () => {
    expect(getChatTicketPipsPresentation(8, false)).toEqual({
      label: "Today's little chats",
      filled: 5,
      total: 5,
      overflow: 3
    });
  });

  it("never shows a negative pip count", () => {
    expect(getChatTicketPipsPresentation(-1, false)).toEqual({
      label: "Today's little chats",
      filled: 0,
      total: 5,
      overflow: 0
    });
  });

  it("shows a Plus label with a full pip row for Plus members regardless of ticket count", () => {
    expect(getChatTicketPipsPresentation(0, true)).toEqual({
      label: "Plus chats",
      filled: 5,
      total: 5,
      overflow: 0
    });
  });
});
