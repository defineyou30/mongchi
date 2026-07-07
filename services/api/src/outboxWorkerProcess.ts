import type { ApiOutboxWorkerRunResult, RunNextApiOutboxEventOptions } from "./outboxWorker";
import { runNextApiOutboxEvent } from "./outboxWorker";

export type ApiOutboxWorkerProcessMode = "once" | "poll";
export type ApiOutboxWorkerProcessStatus = "completed" | "stopped" | "failed";

export interface ApiOutboxWorkerProcessLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

export interface RunApiOutboxWorkerProcessInput extends RunNextApiOutboxEventOptions {
  mode?: ApiOutboxWorkerProcessMode;
  pollIntervalMs?: number;
  maxRuns?: number;
  stopOnIdle?: boolean;
  stopProcessOnFailure?: boolean;
  signal?: AbortSignal;
  sleep?: (durationMs: number) => Promise<void>;
  logger?: ApiOutboxWorkerProcessLogger;
}

export interface ApiOutboxWorkerProcessResult {
  status: ApiOutboxWorkerProcessStatus;
  runs: number;
  deliveredEvents: number;
  failedEvents: number;
  idleRuns: number;
  lastRun?: ApiOutboxWorkerRunResult;
  failureCode?: "api_outbox_worker_process_failed";
  failureMessageSafe?: string;
}

const defaultPollIntervalMs = 30_000;
const defaultSleep = (durationMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, durationMs));

const normalizeMode = (mode: ApiOutboxWorkerProcessMode | undefined): ApiOutboxWorkerProcessMode => mode ?? "once";

const normalizePollIntervalMs = (value: number | undefined): number => {
  if (value === undefined) {
    return defaultPollIntervalMs;
  }

  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : defaultPollIntervalMs;
};

const normalizeMaxRuns = (value: number | undefined, mode: ApiOutboxWorkerProcessMode): number => {
  if (value === undefined) {
    return mode === "once" ? 1 : Number.POSITIVE_INFINITY;
  }

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const makeProcessResult = (
  input: Omit<ApiOutboxWorkerProcessResult, "lastRun"> & {
    lastRun?: ApiOutboxWorkerRunResult;
  }
): ApiOutboxWorkerProcessResult => ({
  status: input.status,
  runs: input.runs,
  deliveredEvents: input.deliveredEvents,
  failedEvents: input.failedEvents,
  idleRuns: input.idleRuns,
  ...(input.lastRun ? { lastRun: input.lastRun } : {}),
  ...(input.failureCode ? { failureCode: input.failureCode } : {}),
  ...(input.failureMessageSafe ? { failureMessageSafe: input.failureMessageSafe } : {})
});

const getRunEventId = (runResult: ApiOutboxWorkerRunResult): string | undefined =>
  runResult.status === "idle" ? undefined : runResult.event.id;

export const runApiOutboxWorkerProcess = async ({
  repository,
  sink,
  now,
  mode: rawMode,
  pollIntervalMs,
  maxRuns: rawMaxRuns,
  stopOnIdle = true,
  stopProcessOnFailure = false,
  signal,
  sleep = defaultSleep,
  logger
}: RunApiOutboxWorkerProcessInput): Promise<ApiOutboxWorkerProcessResult> => {
  const mode = normalizeMode(rawMode);
  const maxRuns = normalizeMaxRuns(rawMaxRuns, mode);
  const intervalMs = normalizePollIntervalMs(pollIntervalMs);
  let runs = 0;
  let deliveredEvents = 0;
  let failedEvents = 0;
  let idleRuns = 0;
  let lastRun: ApiOutboxWorkerRunResult | undefined;

  while (runs < maxRuns) {
    if (signal?.aborted) {
      return makeProcessResult({
        status: "stopped",
        runs,
        deliveredEvents,
        failedEvents,
        idleRuns,
        ...(lastRun ? { lastRun } : {})
      });
    }

    let runResult: ApiOutboxWorkerRunResult;

    try {
      runResult = await runNextApiOutboxEvent({
        repository,
        sink,
        ...(now ? { now } : {})
      });
    } catch {
      logger?.error?.("api_outbox_worker_process_failed", {
        runs,
        failureCode: "api_outbox_worker_process_failed"
      });

      return makeProcessResult({
        status: "failed",
        runs,
        deliveredEvents,
        failedEvents,
        idleRuns,
        ...(lastRun ? { lastRun } : {}),
        failureCode: "api_outbox_worker_process_failed",
        failureMessageSafe: "API outbox worker process could not run. Check worker deployment logs."
      });
    }

    runs += 1;
    deliveredEvents += runResult.status === "delivered" ? 1 : 0;
    failedEvents += runResult.status === "failed" ? 1 : 0;
    idleRuns += runResult.status === "idle" ? 1 : 0;
    lastRun = runResult;
    logger?.info?.("api_outbox_worker_run_finished", {
      run: runs,
      status: runResult.status,
      ...(getRunEventId(runResult) ? { eventId: getRunEventId(runResult) } : {})
    });

    if (
      mode === "once" ||
      (runResult.status === "idle" && stopOnIdle) ||
      (runResult.status === "failed" && stopProcessOnFailure) ||
      runs >= maxRuns
    ) {
      break;
    }

    await sleep(intervalMs);
  }

  return makeProcessResult({
    status: signal?.aborted ? "stopped" : "completed",
    runs,
    deliveredEvents,
    failedEvents,
    idleRuns,
    ...(lastRun ? { lastRun } : {})
  });
};
