import { describe, expect, it } from "vitest";

import type { RunGenerationWorkerBatchResult } from "../generationWorkerRunner";
import type { GenerationWorkerBatchRuntime } from "../generationWorkerRuntime";
import { runGenerationWorkerProcess } from "../generationWorkerProcess";

const makeBatch = (input: Partial<RunGenerationWorkerBatchResult> = {}): RunGenerationWorkerBatchResult => ({
  completedJobs: input.completedJobs ?? 0,
  failedJobs: input.failedJobs ?? 0,
  idle: input.idle ?? false,
  results: input.results ?? []
});

const makeRuntime = (batches: RunGenerationWorkerBatchResult[]): GenerationWorkerBatchRuntime => {
  const queue = [...batches];

  return {
    runOnce: async () => queue.shift() ?? makeBatch({ idle: true })
  };
};

describe("generation worker process runner", () => {
  it("runs one batch by default", async () => {
    const batch = makeBatch({ completedJobs: 2 });
    const result = await runGenerationWorkerProcess({
      runtime: makeRuntime([batch])
    });

    expect(result).toEqual({
      status: "completed",
      runs: 1,
      completedJobs: 2,
      failedJobs: 0,
      idleRuns: 0,
      lastBatch: batch
    });
  });

  it("polls until the queue is idle and waits between non-idle runs", async () => {
    const sleepDurations: number[] = [];
    const firstBatch = makeBatch({ completedJobs: 1 });
    const idleBatch = makeBatch({ idle: true });
    const result = await runGenerationWorkerProcess({
      runtime: makeRuntime([firstBatch, idleBatch]),
      mode: "poll",
      pollIntervalMs: 250,
      sleep: async (durationMs) => {
        sleepDurations.push(durationMs);
      }
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 2,
      completedJobs: 1,
      failedJobs: 0,
      idleRuns: 1,
      lastBatch: idleBatch
    });
    expect(sleepDurations).toEqual([250]);
  });

  it("can keep polling across idle runs for long-running deployments", async () => {
    const sleepDurations: number[] = [];
    const result = await runGenerationWorkerProcess({
      runtime: makeRuntime([makeBatch({ idle: true }), makeBatch({ idle: true })]),
      mode: "poll",
      maxRuns: 2,
      stopOnIdle: false,
      pollIntervalMs: 100,
      sleep: async (durationMs) => {
        sleepDurations.push(durationMs);
      }
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 2,
      completedJobs: 0,
      failedJobs: 0,
      idleRuns: 2
    });
    expect(sleepDurations).toEqual([100]);
  });

  it("can stop the process after a failed batch", async () => {
    const failedBatch = makeBatch({ failedJobs: 1 });
    const result = await runGenerationWorkerProcess({
      runtime: makeRuntime([failedBatch, makeBatch({ completedJobs: 1 })]),
      mode: "poll",
      stopProcessOnFailure: true
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      completedJobs: 0,
      failedJobs: 1,
      idleRuns: 0,
      lastBatch: failedBatch
    });
  });

  it("returns a safe process failure when the runtime throws", async () => {
    const errorEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const runtime: GenerationWorkerBatchRuntime = {
      runOnce: async () => {
        throw new Error("raw database password should not leak");
      }
    };
    const result = await runGenerationWorkerProcess({
      runtime,
      logger: {
        error: (event, metadata) => {
          errorEvents.push({ event, metadata });
        }
      }
    });

    expect(result).toEqual({
      status: "failed",
      runs: 0,
      completedJobs: 0,
      failedJobs: 0,
      idleRuns: 0,
      failureCode: "generation_worker_process_failed",
      failureMessageSafe: "Generation worker process could not run. Check worker deployment logs."
    });
    expect(JSON.stringify(result)).not.toContain("database password");
    expect(errorEvents).toEqual([
      {
        event: "generation_worker_process_failed",
        metadata: {
          runs: 0,
          failureCode: "generation_worker_process_failed"
        }
      }
    ]);
  });
});
