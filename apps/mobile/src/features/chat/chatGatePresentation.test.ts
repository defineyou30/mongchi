import { describe, expect, it } from "vitest";

import { createInitialCareStats } from "@mongchi/shared";
import type { CareStats, MemoryEntry } from "@mongchi/shared";

import {
  getChatAllowanceChipPresentation,
  getChatConversationStarters,
  getChatDayPassOfferPresentation,
  getChatMoodPresentation,
  getChatTicketPipsPresentation,
  getPremiumChatAccessPresentation,
  getShortChatActionLabel,
  getShortChatReplyText,
  shouldShowChatAmbientBubble,
  shouldShowChatConversationStarters,
  shouldShowChatDisclosureBanner
} from "./chatGatePresentation";

/** Builds an ISO string whose *local* hour is `hour` -- getShortChatReplyText's night tier re-derives the hour via isNightTime -> `new Date(iso).getHours()`, so round-tripping through setHours keeps this independent of the test runner's timezone (mirrors packages/shared's dayNightCycle.test.ts/mobileContracts.test.ts isoAtLocalHour). */
const isoAtLocalHour = (hour: number): string => {
  const date = new Date("2026-06-24T00:00:00.000Z");
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

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

  it("shows an active day pass ahead of the ticket/credit summary", () => {
    expect(
      getChatAllowanceChipPresentation({ hasPremiumChatEntitlement: false, dayPassActive: true, freeChatTickets: 0, creditBalance: 0 })
    ).toEqual({
      label: "Day Pass active",
      accessibilityLabel: "Chat day pass is active — chat as much as you'd like today"
    });
  });

  it("localizes the active day pass chip for Korean", () => {
    expect(
      getChatAllowanceChipPresentation({
        hasPremiumChatEntitlement: false,
        dayPassActive: true,
        freeChatTickets: 0,
        creditBalance: 0,
        locale: "ko-KR"
      })
    ).toEqual({
      label: "데이 패스 이용 중",
      accessibilityLabel: "데이 패스가 활성화되어 있어요 — 오늘은 마음껏 이야기할 수 있어요"
    });
  });

  it("prefers Plus over an active day pass when both are somehow true", () => {
    expect(
      getChatAllowanceChipPresentation({ hasPremiumChatEntitlement: true, dayPassActive: true, freeChatTickets: 0, creditBalance: 0 })
    ).toEqual({
      label: "Plus · Included",
      accessibilityLabel: "Plus chat is included"
    });
  });
});

describe("chat day pass offer", () => {
  it("stays hidden while a free ticket can still start a chat", () => {
    expect(
      getChatDayPassOfferPresentation({
        petName: "Miso",
        hasPremiumChatEntitlement: false,
        dayPassActive: false,
        freeChatTickets: 1,
        creditBalance: 0
      })
    ).toEqual({ state: "hidden" });
  });

  it("stays hidden once a day pass is already active", () => {
    expect(
      getChatDayPassOfferPresentation({
        petName: "Miso",
        hasPremiumChatEntitlement: false,
        dayPassActive: true,
        freeChatTickets: 0,
        creditBalance: 0
      })
    ).toEqual({ state: "hidden" });
  });

  it("stays hidden for a Plus member even with free tickets exhausted", () => {
    expect(
      getChatDayPassOfferPresentation({
        petName: "Miso",
        hasPremiumChatEntitlement: true,
        dayPassActive: false,
        freeChatTickets: 0,
        creditBalance: 0
      })
    ).toEqual({ state: "hidden" });
  });

  it("offers the day pass once free turns are gone and the wallet can afford it", () => {
    expect(
      getChatDayPassOfferPresentation({
        petName: "Miso",
        hasPremiumChatEntitlement: false,
        dayPassActive: false,
        freeChatTickets: 0,
        creditBalance: 5
      })
    ).toEqual({
      state: "offer",
      title: "Your free chat with Miso returns tomorrow",
      detail: "Or keep chatting together all day today.",
      ctaLabel: "Day Pass · 5 credits",
      accessibilityLabel:
        "Your free chat with Miso returns tomorrow Or keep chatting together all day today. Buy a day pass for 5 credits to keep chatting together all day today."
    });
  });

  it("localizes the day pass offer for Korean", () => {
    expect(
      getChatDayPassOfferPresentation({
        petName: "몽치",
        hasPremiumChatEntitlement: false,
        dayPassActive: false,
        freeChatTickets: 0,
        creditBalance: 5,
        locale: "ko-KR"
      })
    ).toEqual({
      state: "offer",
      title: "몽치와의 무료 대화는 내일 다시 열려요",
      detail: "데이 패스로 오늘 하루 종일 함께 이야기할 수도 있어요.",
      ctaLabel: "데이 패스 · 크레딧 5개",
      accessibilityLabel: "몽치와의 무료 대화는 내일 다시 열려요. 크레딧 5개로 데이 패스를 구매하면 오늘 하루 종일 함께 이야기할 수 있어요."
    });
  });

  it("falls back to the existing get-more-credits copy pattern when even the day pass is unaffordable", () => {
    expect(
      getChatDayPassOfferPresentation({
        petName: "Miso",
        hasPremiumChatEntitlement: false,
        dayPassActive: false,
        freeChatTickets: 0,
        creditBalance: 4
      })
    ).toEqual({
      state: "insufficient_credits",
      title: "Miso will have more to say tomorrow",
      detail: "...or keep chatting with credits.",
      ctaLabel: "Get more credits",
      accessibilityLabel: "Miso will have more to say tomorrow ...or keep chatting with credits."
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
      now: isoAtLocalHour(9)
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

  it("greets with a drowsy night line during the pet's local sleep window", () => {
    const careStats: CareStats = { ...createInitialCareStats(), actionCounts: { clean: 3 }, totalCareActions: 3 };
    const memories: MemoryEntry[] = [];

    const line = getShortChatReplyText({
      petName: "Miso",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      memories,
      careStats,
      now: isoAtLocalHour(23)
    });

    expect([
      "Mmh... you're here? Come sit with me.",
      "*yawns softly* I was just dozing off. Stay a little while?",
      "Mm, hi... still sleepy, but happy you came."
    ]).toContain(line);
  });

  it("lets an active walk still outrank the night greeting", () => {
    const careStats: CareStats = { ...createInitialCareStats(), actionCounts: { clean: 3 }, totalCareActions: 3 };
    const memories: MemoryEntry[] = [];

    const line = getShortChatReplyText({
      petName: "Miso",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      memories,
      careStats,
      now: isoAtLocalHour(23),
      isOnWalk: true
    });

    expect(["On my walk! Smells amazing out here.", "Can't talk long -- I'm out and about right now."]).toContain(line);
  });

  it("greets with a localized drowsy night line for Korean, ahead of the generic memory line", () => {
    const careStats: CareStats = { ...createInitialCareStats(), actionCounts: { clean: 3 }, totalCareActions: 3 };
    const memories: MemoryEntry[] = [];

    const line = getShortChatReplyText({
      petName: "몽치",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      memories,
      careStats,
      now: isoAtLocalHour(2),
      locale: "ko-KR"
    });

    expect(line).toBe("음냐... 왔어? 내 옆에 앉아.");
  });

  it("lets a fresh days-away return still outrank the night greeting for Korean", () => {
    const line = getShortChatReplyText({
      petName: "몽치",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      daysAway: 2,
      now: isoAtLocalHour(23),
      locale: "ko-KR"
    });

    expect(line).toBe("몽치는 문 쪽을 바라보며 기다렸어요.");
  });

  it("does not show the night line during the day for Korean, falling back to the generic memory line", () => {
    const careStats: CareStats = { ...createInitialCareStats(), actionCounts: { clean: 3 }, totalCareActions: 3 };
    const memories: MemoryEntry[] = [];

    const line = getShortChatReplyText({
      petName: "몽치",
      quickTalkStartedAtMs: null,
      recentReactions: [],
      memories,
      careStats,
      now: isoAtLocalHour(14),
      locale: "ko-KR"
    });

    expect(line).toBe("우리의 작은 순간들을 다 기억하고 있어.");
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

describe("chat conversation starters visibility", () => {
  const baseInput = {
    premiumChatReady: true,
    chatStarted: true,
    messageCount: 0,
    hasOptimisticTurn: false,
    hasDraftText: false,
    isSending: false
  };

  it("shows starters for a freshly started, empty thread", () => {
    expect(shouldShowChatConversationStarters(baseInput)).toBe(true);
  });

  it("hides starters once the thread has any persisted message, even with an empty draft", () => {
    expect(shouldShowChatConversationStarters({ ...baseInput, messageCount: 1 })).toBe(false);
  });

  it("hides starters while an optimistic turn (in-flight or failed-retry) exists, even with no persisted messages yet", () => {
    expect(shouldShowChatConversationStarters({ ...baseInput, hasOptimisticTurn: true })).toBe(false);
  });

  it("hides starters while the user is actively typing a draft", () => {
    expect(shouldShowChatConversationStarters({ ...baseInput, hasDraftText: true })).toBe(false);
  });

  it("hides starters while a turn is sending", () => {
    expect(shouldShowChatConversationStarters({ ...baseInput, isSending: true })).toBe(false);
  });

  it("hides starters before chat has started, or before premium chat is ready, regardless of thread state", () => {
    expect(shouldShowChatConversationStarters({ ...baseInput, chatStarted: false })).toBe(false);
    expect(shouldShowChatConversationStarters({ ...baseInput, premiumChatReady: false })).toBe(false);
  });
});

describe("chat ambient bubble visibility", () => {
  it("shows the ambient greeting bubble before chat has started at all", () => {
    expect(shouldShowChatAmbientBubble({ chatStarted: false, messageCount: 0, hasOptimisticTurn: false })).toBe(true);
  });

  it("shows the ambient greeting bubble for a freshly started, still-empty thread", () => {
    expect(shouldShowChatAmbientBubble({ chatStarted: true, messageCount: 0, hasOptimisticTurn: false })).toBe(true);
  });

  it("hides the ambient greeting bubble once the thread has any persisted message", () => {
    expect(shouldShowChatAmbientBubble({ chatStarted: true, messageCount: 1, hasOptimisticTurn: false })).toBe(false);
  });

  it("hides the ambient greeting bubble while an optimistic turn is in flight, even with no persisted messages yet", () => {
    expect(shouldShowChatAmbientBubble({ chatStarted: true, messageCount: 0, hasOptimisticTurn: true })).toBe(false);
  });
});

describe("chat disclosure banner visibility", () => {
  it("stays hidden until the persisted seen-flag has hydrated, even if it will turn out unseen", () => {
    expect(shouldShowChatDisclosureBanner({ hasHydratedSeenFlag: false, hasSeenDisclosureBanner: false })).toBe(false);
  });

  it("shows once hydration confirms the banner has never been seen on this device", () => {
    expect(shouldShowChatDisclosureBanner({ hasHydratedSeenFlag: true, hasSeenDisclosureBanner: false })).toBe(true);
  });

  it("stays hidden once hydration confirms the banner was already seen and dismissed", () => {
    expect(shouldShowChatDisclosureBanner({ hasHydratedSeenFlag: true, hasSeenDisclosureBanner: true })).toBe(false);
  });
});
