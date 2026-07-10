import { describe, expect, it } from "vitest";

import { buildChatLatencySample, chatLatencyHypotheses, shouldReportChatLatency } from "./chatLatencyDiagnostics";

describe("chat latency diagnostics", () => {
  it("keeps optimistic UI time separate from the transport round trip", () => {
    expect(buildChatLatencySample({ pressedAtMs: 100, optimisticAtMs: 104, completedAtMs: 904 })).toEqual({
      optimisticUiMs: 4,
      transportRoundTripMs: 800,
      totalMs: 804,
      providerTimingAvailable: false
    });
  });

  it("records at least three distinct latency hypotheses", () => {
    expect(chatLatencyHypotheses.length).toBeGreaterThanOrEqual(3);
  });

  it("only records successful samples when the round trip is perceptibly slow", () => {
    expect(shouldReportChatLatency(buildChatLatencySample({ pressedAtMs: 0, optimisticAtMs: 5, completedAtMs: 1000 }))).toBe(false);
    expect(shouldReportChatLatency(buildChatLatencySample({ pressedAtMs: 0, optimisticAtMs: 5, completedAtMs: 1800 }))).toBe(true);
  });
});
