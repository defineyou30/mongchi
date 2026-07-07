import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installGlobalErrorHooks, resetGlobalErrorHooksForTests } from "./globalErrorHooks";
import type { ErrorReporter } from "./reporter";

const createSpyReporter = () => {
  const captureError = vi.fn();
  const captureMessage = vi.fn();
  const reporter: ErrorReporter = { captureError, captureMessage };

  return { reporter, captureError, captureMessage };
};

describe("installGlobalErrorHooks", () => {
  const originalErrorUtils = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
  const originalAddEventListener = (globalThis as { addEventListener?: unknown }).addEventListener;
  const originalOnUnhandledRejection = (globalThis as { onunhandledrejection?: unknown }).onunhandledrejection;

  beforeEach(() => {
    resetGlobalErrorHooksForTests();
  });

  afterEach(() => {
    resetGlobalErrorHooksForTests();
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = originalErrorUtils;
    (globalThis as { addEventListener?: unknown }).addEventListener = originalAddEventListener;
    (globalThis as { onunhandledrejection?: unknown }).onunhandledrejection = originalOnUnhandledRejection;
  });

  it("chains the existing ErrorUtils global handler instead of replacing it", () => {
    const previousHandler = vi.fn();
    let currentHandler = previousHandler;

    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => currentHandler,
      setGlobalHandler: (handler: typeof previousHandler) => {
        currentHandler = handler;
      }
    };

    const { reporter, captureError } = createSpyReporter();
    installGlobalErrorHooks(reporter);

    const error = new Error("fatal");
    currentHandler(error, true);

    expect(captureError).toHaveBeenCalledWith(error, { source: "global_handler", isFatal: true });
    expect(previousHandler).toHaveBeenCalledWith(error, true);
  });

  it("does not throw when ErrorUtils is unavailable", () => {
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = undefined;

    const { reporter } = createSpyReporter();
    expect(() => installGlobalErrorHooks(reporter)).not.toThrow();
  });

  it("is idempotent -- a second call does not double-install", () => {
    const setGlobalHandler = vi.fn();
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => undefined,
      setGlobalHandler
    };

    const { reporter } = createSpyReporter();
    installGlobalErrorHooks(reporter);
    installGlobalErrorHooks(reporter);

    expect(setGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it("captures unhandled promise rejections via addEventListener when available", () => {
    let registeredListener: ((event: { reason?: unknown }) => void) | undefined;
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = undefined;
    (globalThis as { addEventListener?: unknown }).addEventListener = (type: string, listener: typeof registeredListener) => {
      if (type === "unhandledrejection") {
        registeredListener = listener;
      }
    };

    const { reporter, captureError } = createSpyReporter();
    installGlobalErrorHooks(reporter);

    const reason = new Error("unhandled");
    registeredListener?.({ reason });

    expect(captureError).toHaveBeenCalledWith(reason, { source: "unhandled_rejection" });
  });

  it("falls back to chaining onunhandledrejection when addEventListener is unavailable", () => {
    const previousOnUnhandledRejection = vi.fn();
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = undefined;
    (globalThis as { addEventListener?: unknown }).addEventListener = undefined;
    (globalThis as { onunhandledrejection?: unknown }).onunhandledrejection = previousOnUnhandledRejection;

    const { reporter, captureError } = createSpyReporter();
    installGlobalErrorHooks(reporter);

    const reason = new Error("unhandled");
    const handler = (globalThis as unknown as { onunhandledrejection?: (event: { reason?: unknown }) => void })
      .onunhandledrejection;
    handler?.({ reason });

    expect(captureError).toHaveBeenCalledWith(reason, { source: "unhandled_rejection" });
    expect(previousOnUnhandledRejection).toHaveBeenCalledWith({ reason });
  });
});
