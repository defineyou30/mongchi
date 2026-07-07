import AsyncStorage from "@react-native-async-storage/async-storage";

// Minimal local observability layer (see docs/readiness-diagnosis.md item 5).
// This intentionally does NOT pull in a native crash SDK (e.g.
// @sentry/react-native) -- that requires a dev client rebuild, which is out
// of scope here. Instead: console (dev only) + an AsyncStorage ring buffer
// of the most recent errors, readable from Settings for support purposes.
// `reporter` is the seam a real Sentry adapter can slot into later without
// touching any call site -- swap `localReporter` for a Sentry-backed
// implementation of the same `ErrorReporter` interface.

export const ERROR_LOG_STORAGE_KEY = "mongchi.errorLog.v1";
const MAX_ENTRIES = 20;

export type ErrorReportContext = Record<string, unknown> | undefined;

export interface ErrorLogEntry {
  timestamp: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  /** "error" for captureError, "message" for captureMessage. */
  level: "error" | "message";
}

export interface ErrorReporter {
  captureError: (error: unknown, context?: ErrorReportContext) => void;
  captureMessage: (message: string, context?: ErrorReportContext) => void;
}

export interface ErrorLogStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

const defaultErrorLogStorage: ErrorLogStorage = AsyncStorage;

// __DEV__ is injected as a global by the Metro/RN runtime and isn't
// declared in this repo's TS types, nor defined under vitest (no RN
// transform in this repo's test environment -- see errorBoundaryLogic.ts's
// comment on the same constraint). Read it off globalThis with a safe cast
// so this module can be unit tested directly instead of only indirectly
// through RN component tests.
const isDevEnvironment = (): boolean => Boolean((globalThis as { __DEV__?: boolean }).__DEV__);

const toErrorDetails = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) {
    return error.stack !== undefined ? { message: error.message, stack: error.stack } : { message: error.message };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
};

const isErrorLogEntry = (value: unknown): value is ErrorLogEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ErrorLogEntry).timestamp === "string" &&
  typeof (value as ErrorLogEntry).message === "string";

/** Reads the ring buffer, newest entry first. Never throws -- returns [] on any storage/parse failure. */
export const readErrorLog = async (storage: ErrorLogStorage = defaultErrorLogStorage): Promise<ErrorLogEntry[]> => {
  try {
    const stored = await storage.getItem(ERROR_LOG_STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isErrorLogEntry) : [];
  } catch {
    return [];
  }
};

const appendToErrorLog = async (entry: ErrorLogEntry, storage: ErrorLogStorage): Promise<void> => {
  try {
    const current = await readErrorLog(storage);
    const next = [entry, ...current].slice(0, MAX_ENTRIES);
    await storage.setItem(ERROR_LOG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ring buffer write failed (e.g. storage unavailable) -- reporting must
    // never throw or block the caller's own error handling.
  }
};

/**
 * Builds a reporter backed by the given storage. Exported (rather than only
 * the singleton below) so tests can inject an in-memory storage instead of
 * mocking the AsyncStorage module.
 */
export const createLocalReporter = (storage: ErrorLogStorage = defaultErrorLogStorage): ErrorReporter => ({
  captureError: (error, context) => {
    const { message, stack } = toErrorDetails(error);

    if (isDevEnvironment()) {
      console.error("[reporter] captureError:", message, context ?? "", stack ?? "");
    }

    void appendToErrorLog(
      {
        timestamp: new Date().toISOString(),
        message,
        level: "error",
        ...(stack !== undefined ? { stack } : {}),
        ...(context !== undefined ? { context } : {})
      },
      storage
    );
  },
  captureMessage: (message, context) => {
    if (isDevEnvironment()) {
      console.warn("[reporter] captureMessage:", message, context ?? "");
    }

    void appendToErrorLog(
      {
        timestamp: new Date().toISOString(),
        message,
        level: "message",
        ...(context !== undefined ? { context } : {})
      },
      storage
    );
  }
});

/** Default app-wide reporter singleton. Call sites should import this. */
export const reporter: ErrorReporter = createLocalReporter();

/** Clears the ring buffer. Used by the Settings diagnostics row. */
export const clearErrorLog = async (storage: ErrorLogStorage = defaultErrorLogStorage): Promise<void> => {
  try {
    await storage.setItem(ERROR_LOG_STORAGE_KEY, JSON.stringify([]));
  } catch {
    // Best-effort clear; nothing else to do if storage is unavailable.
  }
};
