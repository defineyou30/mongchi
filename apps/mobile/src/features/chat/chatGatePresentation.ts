import { buildChatGreetingLine, getCareStatBand, getTimeBucket, selectPetStatusLine } from "@mongchi/shared";
import type {
  CareState,
  CareSatisfactionSummary,
  CareStats,
  MemoryEntry,
  PremiumChatPaymentPreview,
  RecentReaction,
  WeatherContext
} from "@mongchi/shared";

interface ShortChatReplyInput {
  petName: string;
  quickTalkStartedAtMs: number | null;
  recentReactions: readonly RecentReaction[];
  satisfactionSummary?: Pick<CareSatisfactionSummary, "primaryNeed" | "hint"> | undefined;
  careState?: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection" | "lastInteractionAt" | "updatedAt"> | undefined;
  weather?: WeatherContext | null | undefined;
  now?: string | undefined;
  daysAway?: number | undefined;
  /** Recent remembered moments -- when present (and no quick-talk has started yet), the initial pet bubble greets with a "remembers me" line instead of the generic weather/care-status line. */
  memories?: readonly MemoryEntry[] | undefined;
  /** Accumulated care-pattern counters, paired with `memories` for the free memory-aware greeting. */
  careStats?: CareStats | undefined;
}

export interface PremiumChatAccessPresentationInput {
  petName: string;
  apiReady: boolean;
  payment: PremiumChatPaymentPreview;
  hasPremiumChatEntitlement: boolean;
  freeChatTickets: number;
  creditBalance: number;
}

export interface PremiumChatAccessPresentation {
  ready: boolean;
  /** True only when there is truly no way to start (no ticket, credit, or Plus) -- the sole state that should show any lock affordance. */
  isLocked: boolean;
  title: string;
  detail: string;
  balanceLabel: string;
  ctaLabel: string;
  inputPlaceholder: string;
  accessibilityLabel: string;
  chatPips: ChatTicketPipsPresentation;
}

export interface ChatTicketPipsPresentation {
  /** Soft label shown above/beside the pip row, e.g. "Today's little chats". */
  label: string;
  /** Filled pip count, capped at `total` for display. */
  filled: number;
  /** Total pip slots to render (dots), always >= filled. */
  total: number;
  /** Extra tickets beyond what pips can show, e.g. 2 for "+2" overflow. */
  overflow: number;
}

const chatPipDisplayCap = 5;

/**
 * Turns a raw free-chat-ticket count into a warm, bounded pip row instead of
 * a bare number — "Today's little chats: ●●○" reads softer than "1 ticket".
 * Plus members see an unlimited-feeling label instead of a ticket count.
 */
export const getChatTicketPipsPresentation = (
  freeChatTickets: number,
  hasPremiumChatEntitlement: boolean
): ChatTicketPipsPresentation => {
  if (hasPremiumChatEntitlement) {
    return {
      label: "Plus chats",
      filled: chatPipDisplayCap,
      total: chatPipDisplayCap,
      overflow: 0
    };
  }

  const safeTickets = Math.max(0, Math.round(freeChatTickets));
  const filled = Math.min(safeTickets, chatPipDisplayCap);
  const overflow = Math.max(0, safeTickets - chatPipDisplayCap);

  return {
    label: "Today's little chats",
    filled,
    total: chatPipDisplayCap,
    overflow
  };
};

export interface ChatMoodPresentationInput {
  petName: string;
  satisfactionScore: number;
  satisfactionSummary: Pick<CareSatisfactionSummary, "label" | "hint">;
}

export interface ChatMoodPresentation {
  value: number;
  label: string;
  accessibilityLabel: string;
}

export const getChatMoodPresentation = ({
  petName,
  satisfactionScore,
  satisfactionSummary
}: ChatMoodPresentationInput): ChatMoodPresentation => {
  const value = Math.max(0, Math.min(100, Math.round(satisfactionScore)));

  return {
    value,
    label: `Mood ${value}`,
    accessibilityLabel: `${petName} mood ${satisfactionSummary.label}, ${value} out of 100. ${satisfactionSummary.hint}`
  };
};

const getCareAwareShortReply = ({
  petName,
  satisfactionSummary,
  careState,
  weather,
  now = "2026-06-24T09:00:00.000Z",
  daysAway
}: Omit<ShortChatReplyInput, "quickTalkStartedAtMs" | "recentReactions">): string =>
  selectPetStatusLine({
    petName,
    satisfactionSummary,
    careState,
    weather,
    now,
    daysAway,
    surface: "chat"
  }).line;

export const getShortChatReplyText = ({
  petName,
  quickTalkStartedAtMs,
  recentReactions,
  satisfactionSummary,
  careState,
  weather,
  now,
  daysAway,
  memories,
  careStats
}: ShortChatReplyInput): string => {
  if (!quickTalkStartedAtMs) {
    if (memories && careStats) {
      return buildChatGreetingLine({
        petName,
        memories,
        careStats,
        careState,
        now: now ?? "2026-06-24T09:00:00.000Z"
      });
    }

    return getCareAwareShortReply({
      petName,
      satisfactionSummary,
      careState,
      weather,
      now,
      daysAway
    });
  }

  const reaction = recentReactions.find((entry) => new Date(entry.shownAt).getTime() >= quickTalkStartedAtMs);

  return reaction?.line ?? `${petName} is listening...`;
};

export const getShortChatActionLabel = (quickTalkStartedAtMs: number | null): string =>
  quickTalkStartedAtMs ? "Say again" : "Say hello";

export interface ChatConversationStarterInput {
  petName: string;
  careState?: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection"> | undefined;
  weather?: WeatherContext | null | undefined;
  now?: string | undefined;
  daysAway?: number | undefined;
}

/**
 * State-aware conversation starters so the healing chat opens with something the
 * pet plausibly "wants to talk about" instead of an empty input box.
 */
export const getChatConversationStarters = ({
  petName,
  careState,
  weather,
  now = "2026-06-24T09:00:00.000Z",
  daysAway
}: ChatConversationStarterInput): string[] => {
  const starters: string[] = [];
  const timeBucket = getTimeBucket(new Date(now));

  if ((daysAway ?? 0) >= 1) {
    starters.push(`I missed you, ${petName}. How were things here?`);
  }

  if (careState) {
    if (getCareStatBand(careState.happiness) === "low" || getCareStatBand(careState.happiness) === "critical") {
      starters.push("You look a little down today. Want to talk?");
    } else if (getCareStatBand(careState.energy) === "low" || getCareStatBand(careState.energy) === "critical") {
      starters.push("Feeling sleepy? Tell me about your dreams.");
    }
  }

  if (weather && weather.condition !== "clear") {
    starters.push(`How do you like this ${weather.condition === "partly_cloudy" ? "cloudy" : weather.condition} weather?`);
  }

  if (timeBucket === "morning") {
    starters.push("Good morning! How did you sleep?");
  } else if (timeBucket === "night") {
    starters.push("It's getting late. Shall we wind down together?");
  } else {
    starters.push("How has your day been so far?");
  }

  starters.push("I had a long day. Can I tell you about it?");

  return Array.from(new Set(starters)).slice(0, 3);
};

export const getPremiumChatAccessPresentation = ({
  petName,
  apiReady,
  payment,
  hasPremiumChatEntitlement,
  freeChatTickets,
  creditBalance
}: PremiumChatAccessPresentationInput): PremiumChatAccessPresentation => {
  const balanceLabel = hasPremiumChatEntitlement ? "Plus active" : `${freeChatTickets} ticket${freeChatTickets === 1 ? "" : "s"} · ${creditBalance} credit${creditBalance === 1 ? "" : "s"}`;
  const chatPips = getChatTicketPipsPresentation(freeChatTickets, hasPremiumChatEntitlement);
  const readyPlaceholder = `Say something to ${petName}…`;

  if (apiReady && payment.canStart) {
    return {
      ready: true,
      isLocked: false,
      title: `Chatting with ${petName}`,
      detail: payment.detail,
      balanceLabel,
      ctaLabel: "Start chatting",
      inputPlaceholder: readyPlaceholder,
      accessibilityLabel: `Chat with ${petName} is ready. ${payment.detail} Balance ${balanceLabel}.`,
      chatPips
    };
  }

  if (payment.canStart) {
    // Ticket/credit/Plus is available, but the long-chat API isn't wired up yet
    // (e.g. local/offline mode) -- still a "free chat is available" moment,
    // not a locked one, so the copy stays invitational rather than paywall-first.
    return {
      ready: false,
      isLocked: false,
      title: `${petName} is happy to chat`,
      detail: payment.detail,
      balanceLabel,
      ctaLabel: "Say hello",
      inputPlaceholder: readyPlaceholder,
      accessibilityLabel: `${petName} is ready for a quick chat. ${payment.detail} Balance ${balanceLabel}.`,
      chatPips
    };
  }

  return {
    ready: false,
    isLocked: true,
    title: `${petName} will have more to say tomorrow`,
    detail: "...or keep chatting with credits.",
    balanceLabel,
    ctaLabel: "Get more credits",
    inputPlaceholder: `${petName} will have more to say tomorrow — or keep chatting with credits.`,
    accessibilityLabel: `Out of free chats for today. ${petName} will have more to say tomorrow, or you can keep chatting with credits. Balance ${balanceLabel}.`,
    chatPips
  };
};
