import { describe, expect, it, vi } from "vitest";

import { createAsyncActionGuard } from "./asyncActionGuard";

describe("createAsyncActionGuard", () => {
  it("only runs the underlying action once when called 3 times in rapid succession", async () => {
    // Mirrors the real regression: a user rapid-tapping "Try again" (or an
    // effect firing alongside a manual tap) called retrySupabaseGenerationFlow
    // three times within ~0.4s, creating 3 generate-avatar invocations for a
    // single tap. The guard must collapse concurrent calls into one.
    const guard = createAsyncActionGuard();
    const action = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "done";
    });

    guard.run(action);
    guard.run(action);
    guard.run(action);

    expect(action).toHaveBeenCalledTimes(1);
    expect(guard.isInFlight).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(action).toHaveBeenCalledTimes(1);
    expect(guard.isInFlight).toBe(false);
  });

  it("allows a new call once the previous action has settled", async () => {
    const guard = createAsyncActionGuard();
    const action = vi.fn(async () => "done");

    guard.run(action);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(guard.isInFlight).toBe(false);

    guard.run(action);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(action).toHaveBeenCalledTimes(2);
  });

  it("clears the in-flight flag even when the action rejects", async () => {
    const guard = createAsyncActionGuard();
    const action = vi.fn(async () => {
      throw new Error("network error");
    });

    guard.run(action);
    expect(guard.isInFlight).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(guard.isInFlight).toBe(false);

    guard.run(action);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("warns (rather than silently swallowing) when the action rejects", async () => {
    // Regression: an uncaught throw from a generation flow used to vanish
    // here with zero trace -- no log, no job, no error state -- so a retry
    // that failed before hitting the network looked like the button did
    // nothing at all. A console.warn is the minimum bar for "not silent".
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const guard = createAsyncActionGuard();
    const action = vi.fn(async () => {
      throw new Error("source photo unreadable");
    });

    guard.run(action);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warnSpy).toHaveBeenCalledWith(
      "[asyncActionGuard] action rejected:",
      "source photo unreadable"
    );

    warnSpy.mockRestore();
  });
});
