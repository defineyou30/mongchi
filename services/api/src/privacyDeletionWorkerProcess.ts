import type { PrivacyDeletionWorkerRunResult, RunPrivacyDeletionWorkerOptions } from "./privacyDeletionWorker";
import { runNextPrivacyDeletionJob } from "./privacyDeletionWorker";

export type PrivacyDeletionWorkerProcessMode = "once" | "poll";
export type PrivacyDeletionWorkerProcessStatus = "completed" | "stopped" | "failed";

export interface PrivacyDeletionWorkerProcessLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

export interface RunPrivacyDeletionWorkerProcessInput extends RunPrivacyDeletionWorkerOptions {
  mode?: PrivacyDeletionWorkerProcessMode;
  pollIntervalMs?: number;
  maxRuns?: number;
  stopOnIdle?: boolean;
  stopProcessOnFailure?: boolean;
  signal?: AbortSignal;
  sleep?: (durationMs: number) => Promise<void>;
  logger?: PrivacyDeletionWorkerProcessLogger;
}

export interface PrivacyDeletionWorkerProcessResult {
  status: PrivacyDeletionWorkerProcessStatus;
  runs: number;
  completedJobs: number;
  failedJobs: number;
  idleRuns: number;
  lastRun?: PrivacyDeletionWorkerRunResult;
  failureCode?: "privacy_deletion_worker_process_failed";
  failureMessageSafe?: string;
}

const defaultPollIntervalMs = 30_000;
const defaultSleep = (durationMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, durationMs));

const normalizeMode = (mode: PrivacyDeletionWorkerProcessMode | undefined): PrivacyDeletionWorkerProcessMode => mode ?? "once";

const normalizePollIntervalMs = (value: number | undefined): number => {
  if (value === undefined) {
    return defaultPollIntervalMs;
  }

  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : defaultPollIntervalMs;
};

const normalizeMaxRuns = (value: number | undefined, mode: PrivacyDeletionWorkerProcessMode): number => {
  if (value === undefined) {
    return mode === "once" ? 1 : Number.POSITIVE_INFINITY;
  }

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const makeProcessResult = (
  input: Omit<PrivacyDeletionWorkerProcessResult, "lastRun"> & {
    lastRun?: PrivacyDeletionWorkerRunResult;
  }
): PrivacyDeletionWorkerProcessResult => ({
  status: input.status,
  runs: input.runs,
  completedJobs: input.completedJobs,
  failedJobs: input.failedJobs,
  idleRuns: input.idleRuns,
  ...(input.lastRun ? { lastRun: input.lastRun } : {}),
  ...(input.failureCode ? { failureCode: input.failureCode } : {}),
  ...(input.failureMessageSafe ? { failureMessageSafe: input.failureMessageSafe } : {})
});

export const runPrivacyDeletionWorkerProcess = async ({
  repository,
  processor,
  auditSink,
  now,
  mode: rawMode,
  pollIntervalMs,
  maxRuns: rawMaxRuns,
  stopOnIdle = true,
  stopProcessOnFailure = false,
  signal,
  sleep = defaultSleep,
  logger
}: RunPrivacyDeletionWorkerProcessInput): Promise<PrivacyDeletionWorkerProcessResult> => {
  const mode = normalizeMode(rawMode);
  const maxRuns = normalizeMaxRuns(rawMaxRuns, mode);
  const intervalMs = normalizePollIntervalMs(pollIntervalMs);
  let runs = 0;
  let completedJobs = 0;
  let failedJobs = 0;
  let idleRuns = 0;
  let lastRun: PrivacyDeletionWorkerRunResult | undefined;

  while (runs < maxRuns) {
    if (signal?.aborted) {
      return makeProcessResult({
        status: "stopped",
        runs,
        completedJobs,
        failedJobs,
        idleRuns,
        ...(lastRun ? { lastRun } : {})
      });
    }

    let runResult: PrivacyDeletionWorkerRunResult;

    try {
      runResult = await runNextPrivacyDeletionJob({
        repository,
        processor,
        ...(auditSink ? { auditSink } : {}),
        ...(now ? { now } : {})
      });
    } catch {
      logger?.error?.("privacy_deletion_worker_process_failed", {
        runs,
        failureCode: "privacy_deletion_worker_process_failed"
      });

      return makeProcessResult({
        status: "failed",
        runs,
        completedJobs,
        failedJobs,
        idleRuns,
        ...(lastRun ? { lastRun } : {}),
        failureCode: "privacy_deletion_worker_process_failed",
        failureMessageSafe: "Privacy deletion worker process could not run. Check worker deployment logs."
      });
    }

    runs += 1;
    completedJobs += runResult.status === "completed" ? 1 : 0;
    failedJobs += runResult.status === "failed" ? 1 : 0;
    idleRuns += runResult.status === "idle" ? 1 : 0;
    lastRun = runResult;
    logger?.info?.("privacy_deletion_worker_run_finished", {
      run: runs,
      status: runResult.status
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
    completedJobs,
    failedJobs,
    idleRuns,
    ...(lastRun ? { lastRun } : {})
  });
};
