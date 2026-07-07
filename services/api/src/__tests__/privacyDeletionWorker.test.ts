import { describe, expect, it } from "vitest";

import type { PrivacyDeletionJobRecord } from "../postgresPrivacyRepository";
import type { PrivacyDeletionProcessor, PrivacyDeletionWorkerRepository } from "../privacyDeletionWorker";
import { runNextPrivacyDeletionJob } from "../privacyDeletionWorker";

const queuedOriginalPhotoJob: PrivacyDeletionJobRecord = {
  id: "privacy_original_photos_001",
  userId: "user_demo_001",
  scope: "original_photos",
  targetId: "pet_miso_001",
  status: "queued",
  requestedAt: "2026-06-24T09:00:00.000Z"
};

const createProcessor = (
  overrides: Partial<PrivacyDeletionProcessor> = {}
): PrivacyDeletionProcessor => ({
  deleteOriginalPhotos: async () => ({ ok: true }),
  deleteChatHistory: async () => ({ ok: true }),
  deletePet: async () => ({ ok: true }),
  ...overrides
});

const createRepository = (
  job: PrivacyDeletionJobRecord | null,
  calls: string[] = []
): PrivacyDeletionWorkerRepository => ({
  claimNextQueuedDeletionJob: async () => {
    calls.push("claim");

    return job ? { ...job, status: "processing" } : null;
  },
  markDeletionJobCompleted: async (jobId, completedAt) => {
    calls.push(`complete:${jobId}:${completedAt}`);

    return job
      ? {
          ...job,
          status: "completed",
          completedAt
        }
      : null;
  },
  markDeletionJobFailed: async (input) => {
    calls.push(`fail:${input.id}:${input.failureCode}`);

    return job
      ? {
          ...job,
          status: "failed",
          failureCode: input.failureCode,
          failureMessageSafe: input.failureMessageSafe
        }
      : null;
  }
});

describe("privacy deletion worker runner", () => {
  it("returns idle when no queued job is available", async () => {
    const calls: string[] = [];

    await expect(
      runNextPrivacyDeletionJob({
        repository: createRepository(null, calls),
        processor: createProcessor()
      })
    ).resolves.toEqual({ status: "idle" });
    expect(calls).toEqual(["claim"]);
  });

  it("claims and completes an original-photo deletion job", async () => {
    const calls: string[] = [];
    const processorCalls: string[] = [];
    const result = await runNextPrivacyDeletionJob({
      repository: createRepository(queuedOriginalPhotoJob, calls),
      processor: createProcessor({
        deleteOriginalPhotos: async ({ job, petId }) => {
          processorCalls.push(`${job.id}:${petId}`);

          return { ok: true };
        }
      }),
      now: () => "2026-06-24T09:05:00.000Z"
    });

    expect(result).toEqual({
      status: "completed",
      job: {
        ...queuedOriginalPhotoJob,
        status: "completed",
        completedAt: "2026-06-24T09:05:00.000Z"
      }
    });
    expect(processorCalls).toEqual(["privacy_original_photos_001:pet_miso_001"]);
    expect(calls).toEqual(["claim", "complete:privacy_original_photos_001:2026-06-24T09:05:00.000Z"]);
  });

  it("fails jobs with missing required target ids before processing", async () => {
    const calls: string[] = [];
    const processorCalls: string[] = [];
    const { targetId: _targetId, ...jobWithoutTargetBase } = queuedOriginalPhotoJob;
    const jobWithoutTarget: PrivacyDeletionJobRecord = {
      ...jobWithoutTargetBase
    };
    const result = await runNextPrivacyDeletionJob({
      repository: createRepository(jobWithoutTarget, calls),
      processor: createProcessor({
        deleteOriginalPhotos: async () => {
          processorCalls.push("unexpected");

          return { ok: true };
        }
      })
    });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.job.failureCode : null).toBe("privacy_deletion_target_missing");
    expect(processorCalls).toEqual([]);
    expect(calls).toEqual(["claim", "fail:privacy_original_photos_001:privacy_deletion_target_missing"]);
  });

  it("marks processor exceptions failed with safe retry metadata", async () => {
    const calls: string[] = [];
    const result = await runNextPrivacyDeletionJob({
      repository: createRepository(
        {
          ...queuedOriginalPhotoJob,
          scope: "pet"
        },
        calls
      ),
      processor: createProcessor({
        deletePet: async () => {
          throw new Error("raw provider secret should not leak");
        }
      })
    });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.job.failureCode : null).toBe("privacy_deletion_worker_failed");
    expect(result.status === "failed" ? result.job.failureMessageSafe : null).toBe("Privacy deletion is queued for retry.");
    expect(calls).toEqual(["claim", "fail:privacy_original_photos_001:privacy_deletion_worker_failed"]);
  });

  it("records completion and failure audit events without blocking job state", async () => {
    const auditEvents: Array<{ jobId: string; status: "completed" | "failed"; recordedAt: string; failureCode?: string }> = [];
    const completedCalls: string[] = [];
    const completedResult = await runNextPrivacyDeletionJob({
      repository: createRepository(queuedOriginalPhotoJob, completedCalls),
      processor: createProcessor(),
      now: () => "2026-06-24T09:05:00.000Z",
      auditSink: {
        recordPrivacyDeletionAuditEvent: async ({ job, status, recordedAt }) => {
          auditEvents.push({
            jobId: job.id,
            status,
            recordedAt,
            ...(job.failureCode ? { failureCode: job.failureCode } : {})
          });
        }
      }
    });

    expect(completedResult.status).toBe("completed");
    expect(auditEvents).toEqual([
      {
        jobId: "privacy_original_photos_001",
        status: "completed",
        recordedAt: "2026-06-24T09:05:00.000Z"
      }
    ]);

    const failedCalls: string[] = [];
    const failedResult = await runNextPrivacyDeletionJob({
      repository: createRepository(queuedOriginalPhotoJob, failedCalls),
      processor: createProcessor({
        deleteOriginalPhotos: async () => ({
          ok: false,
          failureCode: "storage_deletion_request_failed",
          failureMessageSafe: "Private storage deletion is queued for retry."
        })
      }),
      now: () => "2026-06-24T09:06:00.000Z",
      auditSink: {
        recordPrivacyDeletionAuditEvent: async ({ job, status, recordedAt }) => {
          auditEvents.push({
            jobId: job.id,
            status,
            recordedAt,
            ...(job.failureCode ? { failureCode: job.failureCode } : {})
          });
        }
      }
    });

    expect(failedResult.status).toBe("failed");
    expect(auditEvents[1]).toEqual({
      jobId: "privacy_original_photos_001",
      status: "failed",
      recordedAt: "2026-06-24T09:06:00.000Z",
      failureCode: "storage_deletion_request_failed"
    });

    const auditFailureCalls: string[] = [];
    await expect(
      runNextPrivacyDeletionJob({
        repository: createRepository(queuedOriginalPhotoJob, auditFailureCalls),
        processor: createProcessor(),
        auditSink: {
          recordPrivacyDeletionAuditEvent: async () => {
            throw new Error("outbox unavailable");
          }
        }
      })
    ).resolves.toMatchObject({
      status: "completed"
    });
    expect(auditFailureCalls).toEqual(["claim", "complete:privacy_original_photos_001:2026-06-24T09:00:00.000Z"]);
  });
});
