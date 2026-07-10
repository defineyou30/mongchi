export type OptimisticChatDelivery = "sending" | "failed";

export interface OptimisticChatTurn {
  readonly requestId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly delivery: OptimisticChatDelivery;
}

interface BeginOptimisticChatTurnInput {
  readonly requestId: string;
  readonly draft: string;
  readonly now: string;
}

const normalizeOptimisticDraft = (draft: string): string => draft.trim().replace(/\s+/g, " ");

export const beginOptimisticChatTurn = ({ requestId, draft, now }: BeginOptimisticChatTurnInput): OptimisticChatTurn => ({
  requestId,
  text: normalizeOptimisticDraft(draft),
  createdAt: now,
  delivery: "sending"
});

export const failOptimisticChatTurn = (turn: OptimisticChatTurn): OptimisticChatTurn => ({
  ...turn,
  delivery: "failed"
});

export const retryOptimisticChatTurn = (turn: OptimisticChatTurn): OptimisticChatTurn => ({
  ...turn,
  delivery: "sending"
});

export const getChatTypingLabel = (petName: string): string => `${petName} is typing with tiny paws…`;

export interface ChatSendGate {
  readonly tryAcquire: () => boolean;
  readonly release: () => void;
}

export const createChatSendGate = (): ChatSendGate => {
  let locked = false;

  return {
    tryAcquire: () => {
      if (locked) {
        return false;
      }

      locked = true;
      return true;
    },
    release: () => {
      locked = false;
    }
  };
};
