export const chatLatencyHypotheses = [
  "The composer waits for the full request before revealing the user's bubble.",
  "Session hydration or anonymous sign-in adds work before the Edge Function call.",
  "Network, Edge Function, moderation, and provider generation dominate the remaining round trip."
] as const;

export interface ChatLatencySample {
  readonly optimisticUiMs: number;
  readonly transportRoundTripMs: number;
  readonly totalMs: number;
  readonly providerTimingAvailable: false;
}

interface ChatLatencyMarks {
  readonly pressedAtMs: number;
  readonly optimisticAtMs: number;
  readonly completedAtMs: number;
}

export const buildChatLatencySample = ({
  pressedAtMs,
  optimisticAtMs,
  completedAtMs
}: ChatLatencyMarks): ChatLatencySample => ({
  optimisticUiMs: Math.max(0, optimisticAtMs - pressedAtMs),
  transportRoundTripMs: Math.max(0, completedAtMs - optimisticAtMs),
  totalMs: Math.max(0, completedAtMs - pressedAtMs),
  providerTimingAvailable: false
});

export const shouldReportChatLatency = (sample: ChatLatencySample): boolean => sample.totalMs >= 1500;
