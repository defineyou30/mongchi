import { describe, expect, it } from "vitest";

import { createInitialCareStats } from "@mongchi/shared";
import type { CareStats, MemoryEntry } from "@mongchi/shared";

import {
  getChatTicketPipsPresentation,
  getPremiumChatAccessPresentation,
  getShortChatActionLabel,
  getShortChatReplyText
} from "./chatGatePresentation";

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
