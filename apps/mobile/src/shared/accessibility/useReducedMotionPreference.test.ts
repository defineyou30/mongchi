import { beforeEach, describe, expect, it, vi } from "vitest";

import { useReducedMotionPreference } from "./useReducedMotionPreference";

const harness = vi.hoisted<{
  effect: (() => void | (() => void)) | undefined;
  initialState: boolean | undefined;
  initialPromise: Promise<boolean>;
  listener: ((enabled: boolean) => void) | undefined;
  remove: ReturnType<typeof vi.fn>;
  resolveInitial: ((enabled: boolean) => void) | undefined;
  setState: ReturnType<typeof vi.fn>;
}>(() => ({
  effect: undefined,
  initialState: undefined,
  initialPromise: Promise.resolve(false),
  listener: undefined,
  remove: vi.fn(),
  resolveInitial: undefined,
  setState: vi.fn()
}));

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => {
    harness.effect = effect;
  },
  useState: (initialState: boolean) => {
    harness.initialState = initialState;
    return [initialState, harness.setState];
  }
}));

vi.mock("react-native", () => ({
  AccessibilityInfo: {
    addEventListener: (_event: string, listener: (enabled: boolean) => void) => {
      harness.listener = listener;
      return { remove: harness.remove };
    },
    isReduceMotionEnabled: () => harness.initialPromise
  }
}));

beforeEach(() => {
  harness.effect = undefined;
  harness.initialState = undefined;
  harness.listener = undefined;
  harness.remove.mockReset();
  harness.setState.mockReset();
  harness.initialPromise = new Promise((resolve) => {
    harness.resolveInitial = resolve;
  });
});

describe("useReducedMotionPreference", () => {
  it("starts motion-safe until the native preference resolves", () => {
    useReducedMotionPreference();
    const cleanup = harness.effect?.();

    expect(harness.initialState).toBe(true);
    cleanup?.();
  });

  it("does not let a stale initial read overwrite a newer native toggle", async () => {
    useReducedMotionPreference();
    const cleanup = harness.effect?.();

    harness.listener?.(true);
    harness.resolveInitial?.(false);
    await harness.initialPromise;

    expect(harness.setState.mock.calls).toEqual([[true]]);
    cleanup?.();
    expect(harness.remove).toHaveBeenCalledOnce();
  });

  it("forwards repeated native toggles in order", () => {
    useReducedMotionPreference();
    const cleanup = harness.effect?.();

    harness.listener?.(true);
    harness.listener?.(false);
    harness.listener?.(true);

    expect(harness.setState.mock.calls).toEqual([[true], [false], [true]]);
    cleanup?.();
  });

  it("ignores a native change already queued when the listener is removed", () => {
    useReducedMotionPreference();
    const cleanup = harness.effect?.();

    cleanup?.();
    harness.listener?.(true);

    expect(harness.setState).not.toHaveBeenCalled();
  });
});
