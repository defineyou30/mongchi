import { describe, expect, it, vi } from "vitest";

import { createLatestNotificationSyncCoordinator } from "./notificationSyncCoordinator";

describe("latest notification sync coordinator", () => {
  it("replays the final input after an in-flight request instead of dropping it", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const seen: string[] = [];
    const runner = vi.fn(async (input: string) => {
      seen.push(input);

      if (input === "A") {
        await firstGate;
      }

      return input;
    });
    const coordinator = createLatestNotificationSyncCoordinator(runner);

    const first = coordinator.request("A");
    const second = coordinator.request("stale-B");
    const final = coordinator.request("final-C");
    releaseFirst?.();

    await expect(Promise.all([first, second, final])).resolves.toEqual(["final-C", "final-C", "final-C"]);
    expect(seen).toEqual(["A", "final-C"]);
  });

  it("replays a queued final input after the in-flight runner rejects", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const seen: string[] = [];
    const runner = vi.fn(async (input: string) => {
      seen.push(input);

      if (input === "A") {
        await firstGate;
        throw new Error("partial notification API failure");
      }

      return input;
    });
    const coordinator = createLatestNotificationSyncCoordinator(runner);

    const first = coordinator.request("A");
    const final = coordinator.request("final-B");
    releaseFirst?.();

    await expect(Promise.all([first, final])).resolves.toEqual(["final-B", "final-B"]);
    expect(seen).toEqual(["A", "final-B"]);
  });
});
