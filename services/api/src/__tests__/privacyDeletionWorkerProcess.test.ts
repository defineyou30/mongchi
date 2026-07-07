import { describe, expect, it } from "vitest";

import type { PrivacyDeletionJobRecord } from "../postgresPrivacyRepository";
import type { PrivacyDeletionProcessor, PrivacyDeletionWorkerRepository } from "../privacyDeletionWorker";
import { runPrivacyDeletionWorkerProcess } from "../privacyDeletionWorkerProcess";

const queuedJob: PrivacyDeletionJobRecord = {
  id: "privacy_original_photos_001",
  userId: "user_demo_001",
  scope: "original_photos",
  targetId: "pet_miso_001",
  status: "queued",
  requestedAt: "2026-06-24T09:00:00.000Z"
};

const createProcessor = (overrides: Partial<PrivacyDeletionProcessor> = {}): PrivacyDeletionProcessor => ({
  deleteOriginalPhotos: async () => ({ ok: true }),
  deleteChatHistory: async () => ({ ok: true }),
  deletePet: async () => ({ ok: true }),
  ...overrides
});

const createRepository = (
  jobs: Array<PrivacyDeletionJobRecord | null>,
  calls: string[] = []
): PrivacyDeletionWorkerRepository => {
  const queue = [...jobs];

  return {
    claimNextQueuedDeletionJob: async () => {
      calls.push("claim");

      const job = queue.shift() ?? null;

      return job ? { ...job, status: "processing" } : null;
    },
    markDeletionJobCompleted: async (jobId, completedAt) => {
      calls.push(`complete:${jobId}:${completedAt}`);

      return {
        ...queuedJob,
        id: jobId,
        status: "completed",
        completedAt
      };
    },
    markDeletionJobFailed: async (input) => {
      calls.push(`fail:${input.id}:${input.failureCode}`);

      return {
        ...queuedJob,
        id: input.id,
        status: "failed",
        failureCode: input.failureCode,
        failureMessageSafe: input.failureMessageSafe
      };
    }
  };
};

describe("privacy deletion worker process runner", () => {
  it("runs one deletion job by default", async () => {
    const calls: string[] = [];
    const result = await runPrivacyDeletionWorkerProcess({
      repository: createRepository([queuedJob], calls),
      processor: createProcessor(),
      now: () => "2026-06-24T09:05:00.000Z"
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      completedJobs: 1,
      failedJobs: 0,
      idleRuns: 0,
      lastRun: {
        status: "completed"
      }
    });
    expect(calls).toEqual(["claim", "complete:privacy_original_photos_001:2026-06-24T09:05:00.000Z"]);
  });

  it("polls until idle and waits between non-idle runs", async () => {
    const sleepDurations: number[] = [];
    const result = await runPrivacyDeletionWorkerProcess({
      repository: createRepository([queuedJob, null]),
      processor: createProcessor(),
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
      lastRun: {
        status: "idle"
      }
    });
    expect(sleepDurations).toEqual([250]);
  });

  it("can stop after a failed deletion job", async () => {
    const result = await runPrivacyDeletionWorkerProcess({
      repository: createRepository([queuedJob, queuedJob]),
      processor: createProcessor({
        deleteOriginalPhotos: async () => ({
          ok: false,
          failureCode: "storage_delete_failed",
          failureMessageSafe: "Privacy deletion is queued for retry."
        })
      }),
      mode: "poll",
      stopProcessOnFailure: true
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      completedJobs: 0,
      failedJobs: 1,
      idleRuns: 0,
      lastRun: {
        status: "failed"
      }
    });
  });

  it("returns a safe process failure when claiming throws", async () => {
    const errorEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const repository: PrivacyDeletionWorkerRepository = {
      claimNextQueuedDeletionJob: async () => {
        throw new Error("raw database password should not leak");
      },
      markDeletionJobCompleted: async () => null,
      markDeletionJobFailed: async () => null
    };
    const result = await runPrivacyDeletionWorkerProcess({
      repository,
      processor: createProcessor(),
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
      failureCode: "privacy_deletion_worker_process_failed",
      failureMessageSafe: "Privacy deletion worker process could not run. Check worker deployment logs."
    });
    expect(JSON.stringify(result)).not.toContain("database password");
    expect(errorEvents).toEqual([
      {
        event: "privacy_deletion_worker_process_failed",
        metadata: {
          runs: 0,
          failureCode: "privacy_deletion_worker_process_failed"
        }
      }
    ]);
  });
});
