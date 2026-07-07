import type { ErrorReporter } from "./reporter";
import { reporter as defaultReporter } from "./reporter";

// Wires JS-global error capture (uncaught exceptions + unhandled promise
// rejections) into the reporter. Call once from app/_layout.tsx.
//
// - ErrorUtils.setGlobalHandler: React Native's global handler for uncaught
//   JS exceptions. We preserve any existing handler (RN/Expo installs one
//   for the red-box dev overlay) and chain ours before it, so dev tooling
//   keeps working and we still capture every fatal.
// - global.onunhandledrejection / process.on("unhandledRejection"): promise
//   rejections that nobody .catch()'d. Hermes exposes the former.

type GlobalErrorUtils = {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

let installed = false;

/** Idempotent: calling more than once is a no-op after the first call. */
export const installGlobalErrorHooks = (reporter: ErrorReporter = defaultReporter): void => {
  if (installed) {
    return;
  }

  installed = true;

  const errorUtils = (globalThis as unknown as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;

  if (errorUtils?.setGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler?.();

    errorUtils.setGlobalHandler((error, isFatal) => {
      reporter.captureError(error, { source: "global_handler", isFatal: Boolean(isFatal) });
      previousHandler?.(error, isFatal);
    });
  }

  const globalWithRejection = globalThis as unknown as {
    onunhandledrejection?: ((event: { reason?: unknown }) => void) | null;
    addEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void;
  };

  const handleUnhandledRejection = (event: { reason?: unknown }) => {
    reporter.captureError(event?.reason, { source: "unhandled_rejection" });
  };

  if (typeof globalWithRejection.addEventListener === "function") {
    globalWithRejection.addEventListener("unhandledrejection", handleUnhandledRejection);
  } else {
    const previousOnUnhandledRejection = globalWithRejection.onunhandledrejection ?? null;

    globalWithRejection.onunhandledrejection = (event) => {
      handleUnhandledRejection(event);
      previousOnUnhandledRejection?.(event);
    };
  }
};

/** Test-only: resets the idempotency guard so hooks can be reinstalled in a fresh test. */
export const resetGlobalErrorHooksForTests = (): void => {
  installed = false;
};
