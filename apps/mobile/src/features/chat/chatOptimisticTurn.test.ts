import { describe, expect, it } from "vitest";

import {
  beginOptimisticChatTurn,
  createChatSendGate,
  failOptimisticChatTurn,
  getChatTypingLabel,
  retryOptimisticChatTurn
} from "./chatOptimisticTurn";

describe("optimistic chat turn", () => {
  it("creates a visible sending bubble from normalized draft copy", () => {
    expect(
      beginOptimisticChatTurn({
        requestId: "request-1",
        draft: "  Hello   tiny friend  ",
        now: "2026-07-10T10:00:00.000Z"
      })
    ).toEqual({
      requestId: "request-1",
      text: "Hello tiny friend",
      createdAt: "2026-07-10T10:00:00.000Z",
      delivery: "sending"
    });
  });

  it("marks a failed bubble without losing its text or idempotency key", () => {
    const sending = beginOptimisticChatTurn({
      requestId: "request-1",
      draft: "Hello",
      now: "2026-07-10T10:00:00.000Z"
    });

    expect(failOptimisticChatTurn(sending)).toEqual({ ...sending, delivery: "failed" });
    expect(retryOptimisticChatTurn(failOptimisticChatTurn(sending))).toEqual(sending);
  });

  it("uses the pet name in the pending line", () => {
    expect(getChatTypingLabel("Miso")).toBe("Miso is typing with tiny paws…");
  });

  it("rejects a rapid duplicate send until the active request releases", () => {
    const gate = createChatSendGate();

    expect(gate.tryAcquire()).toBe(true);
    expect(gate.tryAcquire()).toBe(false);
    gate.release();
    expect(gate.tryAcquire()).toBe(true);
  });
});
