import type {
  ChatRetentionPurgeRunResult,
  RunNextChatRetentionPurgeOptions
} from "./chatRetentionPurgeWorker";
import { runNextChatRetentionPurge } from "./chatRetentionPurgeWorker";

export type ChatRetentionPurgeWorkerProcessMode = "once" | "poll";
export type ChatRetentionPurgeWorkerProcessStatus = "completed" | "stopped" | "failed";

export interface ChatRetentionPurgeWorkerProcessLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

export interface RunChatRetentionPurgeWorkerProcessInput extends RunNextChatRetentionPurgeOptions {
  mode?: ChatRetentionPurgeWorkerProcessMode;
  pollIntervalMs?: number;
  maxRuns?: number;
  stopOnIdle?: boolean;
  signal?: AbortSignal;
  sleep?: (durationMs: number) => Promise<void>;
  logger?: ChatRetentionPurgeWorkerProcessLogger;
}

export interface ChatRetentionPurgeWorkerProcessResult {
  status: ChatRetentionPurgeWorkerProcessStatus;
  runs: number;
  purgedRuns: number;
  deletedMessages: number;
  idleRuns: number;
  lastRun?: ChatRetentionPurgeRunResult;
  failureCode?: "chat_retention_purge_worker_process_failed";
  failureMessageSafe?: string;
}

const defaultPollIntervalMs = 30_000;
const defaultSleep = (durationMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, durationMs));

const normalizeMode = (mode: ChatRetentionPurgeWorkerProcessMode | undefined): ChatRetentionPurgeWorkerProcessMode =>
  mode ?? "once";

const normalizePollIntervalMs = (value: number | undefined): number => {
  if (value === undefined) {
    return defaultPollIntervalMs;
  }

  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : defaultPollIntervalMs;
};

const normalizeMaxRuns = (value: number | undefined, mode: ChatRetentionPurgeWorkerProcessMode): number => {
  if (value === undefined) {
    return mode === "once" ? 1 : Number.POSITIVE_INFINITY;
  }

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const makeProcessResult = (
  input: Omit<ChatRetentionPurgeWorkerProcessResult, "lastRun"> & {
    lastRun?: ChatRetentionPurgeRunResult;
  }
): ChatRetentionPurgeWorkerProcessResult => ({
  status: input.status,
  runs: input.runs,
  purgedRuns: input.purgedRuns,
  deletedMessages: input.deletedMessages,
  idleRuns: input.idleRuns,
  ...(input.lastRun ? { lastRun: input.lastRun } : {}),
  ...(input.failureCode ? { failureCode: input.failureCode } : {}),
  ...(input.failureMessageSafe ? { failureMessageSafe: input.failureMessageSafe } : {})
});

export const runChatRetentionPurgeWorkerProcess = async ({
  repository,
  retentionWindowMs,
  batchSize,
  now,
  mode: rawMode,
  pollIntervalMs,
  maxRuns: rawMaxRuns,
  stopOnIdle = true,
  signal,
  sleep = defaultSleep,
  logger
}: RunChatRetentionPurgeWorkerProcessInput): Promise<ChatRetentionPurgeWorkerProcessResult> => {
  const mode = normalizeMode(rawMode);
  const maxRuns = normalizeMaxRuns(rawMaxRuns, mode);
  const intervalMs = normalizePollIntervalMs(pollIntervalMs);
  let runs = 0;
  let purgedRuns = 0;
  let deletedMessages = 0;
  let idleRuns = 0;
  let lastRun: ChatRetentionPurgeRunResult | undefined;

  while (runs < maxRuns) {
    if (signal?.aborted) {
      return makeProcessResult({
        status: "stopped",
        runs,
        purgedRuns,
        deletedMessages,
        idleRuns,
        ...(lastRun ? { lastRun } : {})
      });
    }

    let runResult: ChatRetentionPurgeRunResult;

    try {
      runResult = await runNextChatRetentionPurge({
        repository,
        ...(retentionWindowMs !== undefined ? { retentionWindowMs } : {}),
        ...(batchSize !== undefined ? { batchSize } : {}),
        ...(now ? { now } : {})
      });
    } catch {
      logger?.error?.("chat_retention_purge_worker_process_failed", {
        runs,
        failureCode: "chat_retention_purge_worker_process_failed"
      });

      return makeProcessResult({
        status: "failed",
        runs,
        purgedRuns,
        deletedMessages,
        idleRuns,
        ...(lastRun ? { lastRun } : {}),
        failureCode: "chat_retention_purge_worker_process_failed",
        failureMessageSafe: "Chat retention purge worker process could not run. Check worker deployment logs."
      });
    }

    runs += 1;
    purgedRuns += runResult.status === "purged" ? 1 : 0;
    deletedMessages += runResult.deletedCount;
    idleRuns += runResult.status === "idle" ? 1 : 0;
    lastRun = runResult;
    logger?.info?.("chat_retention_purge_worker_run_finished", {
      run: runs,
      status: runResult.status,
      deletedMessages: runResult.deletedCount
    });

    if (mode === "once" || (runResult.status === "idle" && stopOnIdle) || runs >= maxRuns) {
      break;
    }

    await sleep(intervalMs);
  }

  return makeProcessResult({
    status: signal?.aborted ? "stopped" : "completed",
    runs,
    purgedRuns,
    deletedMessages,
    idleRuns,
    ...(lastRun ? { lastRun } : {})
  });
};
