import type { RunGenerationWorkerBatchResult } from "./generationWorkerRunner";
import type { GenerationWorkerBatchRuntime } from "./generationWorkerRuntime";

export type GenerationWorkerProcessMode = "once" | "poll";
export type GenerationWorkerProcessStatus = "completed" | "stopped" | "failed";

export interface GenerationWorkerProcessLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

export interface RunGenerationWorkerProcessInput {
  runtime: GenerationWorkerBatchRuntime;
  mode?: GenerationWorkerProcessMode;
  pollIntervalMs?: number;
  maxRuns?: number;
  stopOnIdle?: boolean;
  stopOnFailure?: boolean;
  stopProcessOnFailure?: boolean;
  signal?: AbortSignal;
  sleep?: (durationMs: number) => Promise<void>;
  logger?: GenerationWorkerProcessLogger;
}

export interface GenerationWorkerProcessResult {
  status: GenerationWorkerProcessStatus;
  runs: number;
  completedJobs: number;
  failedJobs: number;
  idleRuns: number;
  lastBatch?: RunGenerationWorkerBatchResult;
  failureCode?: "generation_worker_process_failed";
  failureMessageSafe?: string;
}

const defaultPollIntervalMs = 30_000;
const defaultSleep = (durationMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, durationMs));

const normalizeMode = (mode: GenerationWorkerProcessMode | undefined): GenerationWorkerProcessMode => mode ?? "once";

const normalizePollIntervalMs = (value: number | undefined): number => {
  if (value === undefined) {
    return defaultPollIntervalMs;
  }

  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : defaultPollIntervalMs;
};

const normalizeMaxRuns = (value: number | undefined, mode: GenerationWorkerProcessMode): number => {
  if (value === undefined) {
    return mode === "once" ? 1 : Number.POSITIVE_INFINITY;
  }

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const summarizeBatch = (batch: RunGenerationWorkerBatchResult): Record<string, unknown> => ({
  completedJobs: batch.completedJobs,
  failedJobs: batch.failedJobs,
  idle: batch.idle,
  resultCount: batch.results.length
});

const makeProcessResult = (
  input: Omit<GenerationWorkerProcessResult, "lastBatch"> & {
    lastBatch?: RunGenerationWorkerBatchResult;
  }
): GenerationWorkerProcessResult => ({
  status: input.status,
  runs: input.runs,
  completedJobs: input.completedJobs,
  failedJobs: input.failedJobs,
  idleRuns: input.idleRuns,
  ...(input.lastBatch ? { lastBatch: input.lastBatch } : {}),
  ...(input.failureCode ? { failureCode: input.failureCode } : {}),
  ...(input.failureMessageSafe ? { failureMessageSafe: input.failureMessageSafe } : {})
});

export const runGenerationWorkerProcess = async ({
  runtime,
  mode: rawMode,
  pollIntervalMs,
  maxRuns: rawMaxRuns,
  stopOnIdle = true,
  stopOnFailure,
  stopProcessOnFailure = false,
  signal,
  sleep = defaultSleep,
  logger
}: RunGenerationWorkerProcessInput): Promise<GenerationWorkerProcessResult> => {
  const mode = normalizeMode(rawMode);
  const maxRuns = normalizeMaxRuns(rawMaxRuns, mode);
  const intervalMs = normalizePollIntervalMs(pollIntervalMs);
  let runs = 0;
  let completedJobs = 0;
  let failedJobs = 0;
  let idleRuns = 0;
  let lastBatch: RunGenerationWorkerBatchResult | undefined;

  while (runs < maxRuns) {
    if (signal?.aborted) {
      return makeProcessResult({
        status: "stopped",
        runs,
        completedJobs,
        failedJobs,
        idleRuns,
        ...(lastBatch ? { lastBatch } : {})
      });
    }

    let batch: RunGenerationWorkerBatchResult;

    try {
      batch = await runtime.runOnce(stopOnFailure === undefined ? undefined : { stopOnFailure });
    } catch {
      logger?.error?.("generation_worker_process_failed", {
        runs,
        failureCode: "generation_worker_process_failed"
      });

      return makeProcessResult({
        status: "failed",
        runs,
        completedJobs,
        failedJobs,
        idleRuns,
        ...(lastBatch ? { lastBatch } : {}),
        failureCode: "generation_worker_process_failed",
        failureMessageSafe: "Generation worker process could not run. Check worker deployment logs."
      });
    }

    runs += 1;
    completedJobs += batch.completedJobs;
    failedJobs += batch.failedJobs;
    idleRuns += batch.idle ? 1 : 0;
    lastBatch = batch;
    logger?.info?.("generation_worker_batch_finished", {
      run: runs,
      ...summarizeBatch(batch)
    });

    if (mode === "once" || (batch.idle && stopOnIdle) || (batch.failedJobs > 0 && stopProcessOnFailure) || runs >= maxRuns) {
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
    ...(lastBatch ? { lastBatch } : {})
  });
};
