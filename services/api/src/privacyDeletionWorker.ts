import type { ISODateTime } from "@mongchi/shared";

import type { PrivacyDeletionJobRecord } from "./postgresPrivacyRepository";

export interface PrivacyDeletionWorkerRepository {
  claimNextQueuedDeletionJob: () => Promise<PrivacyDeletionJobRecord | null>;
  markDeletionJobCompleted: (jobId: string, completedAt: ISODateTime) => Promise<PrivacyDeletionJobRecord | null>;
  markDeletionJobFailed: (input: {
    id: string;
    failureCode: string;
    failureMessageSafe: string;
  }) => Promise<PrivacyDeletionJobRecord | null>;
}

export interface PrivacyDeletionProcessorInput {
  job: PrivacyDeletionJobRecord;
}

export type PrivacyDeletionProcessorResult =
  | { ok: true }
  | {
      ok: false;
      failureCode: string;
      failureMessageSafe: string;
    };

export interface PrivacyDeletionProcessor {
  deleteOriginalPhotos: (input: PrivacyDeletionProcessorInput & { petId: string }) => Promise<PrivacyDeletionProcessorResult>;
  deleteChatHistory: (input: PrivacyDeletionProcessorInput) => Promise<PrivacyDeletionProcessorResult>;
  deletePet: (input: PrivacyDeletionProcessorInput & { petId: string }) => Promise<PrivacyDeletionProcessorResult>;
}

export type PrivacyDeletionWorkerRunResult =
  | { status: "idle" }
  | { status: "completed"; job: PrivacyDeletionJobRecord }
  | { status: "failed"; job: PrivacyDeletionJobRecord };

export interface RunPrivacyDeletionWorkerOptions {
  repository: PrivacyDeletionWorkerRepository;
  processor: PrivacyDeletionProcessor;
  auditSink?: PrivacyDeletionAuditSink;
  now?: () => ISODateTime;
}

export interface PrivacyDeletionAuditSink {
  recordPrivacyDeletionAuditEvent: (input: {
    job: PrivacyDeletionJobRecord;
    status: "completed" | "failed";
    recordedAt: ISODateTime;
  }) => Promise<void>;
}

const DEFAULT_NOW = "2026-06-24T09:00:00.000Z";
const failureCodePattern = /^[a-z][a-z0-9_]{2,63}$/;

const safeFailure = (failureCode: string, failureMessageSafe: string) => ({
  failureCode: failureCodePattern.test(failureCode) ? failureCode : "privacy_deletion_failed",
  failureMessageSafe:
    typeof failureMessageSafe === "string" && failureMessageSafe.trim().length > 0
      ? failureMessageSafe.trim().slice(0, 240)
      : "Privacy deletion is queued for retry."
});

const workerExceptionFailure = () =>
  safeFailure("privacy_deletion_worker_failed", "Privacy deletion is queued for retry.");

export const runNextPrivacyDeletionJob = async ({
  repository,
  processor,
  auditSink,
  now = () => DEFAULT_NOW
}: RunPrivacyDeletionWorkerOptions): Promise<PrivacyDeletionWorkerRunResult> => {
  const job = await repository.claimNextQueuedDeletionJob();

  if (!job) {
    return { status: "idle" };
  }

  const failJob = async (failureCode: string, failureMessageSafe: string): Promise<PrivacyDeletionWorkerRunResult> => {
    const failure = safeFailure(failureCode, failureMessageSafe);
    const failedJob =
      (await repository.markDeletionJobFailed({
        id: job.id,
        failureCode: failure.failureCode,
        failureMessageSafe: failure.failureMessageSafe
      })) ?? {
        ...job,
        status: "failed",
        failureCode: failure.failureCode,
        failureMessageSafe: failure.failureMessageSafe
      };
    const recordedAt = now();

    try {
      await auditSink?.recordPrivacyDeletionAuditEvent({
        job: failedJob,
        status: "failed",
        recordedAt
      });
    } catch {
      // Persistent audit delivery must not block privacy deletion retry state.
    }

    return {
      status: "failed",
      job: failedJob
    };
  };

  const runProcessor = async (): Promise<PrivacyDeletionProcessorResult> => {
    if (job.scope === "chat_history") {
      return processor.deleteChatHistory({ job });
    }

    if (!job.targetId) {
      return {
        ok: false,
        failureCode: "privacy_deletion_target_missing",
        failureMessageSafe: "Privacy deletion is queued for retry."
      };
    }

    if (job.scope === "original_photos") {
      return processor.deleteOriginalPhotos({ job, petId: job.targetId });
    }

    return processor.deletePet({ job, petId: job.targetId });
  };

  let result: PrivacyDeletionProcessorResult;

  try {
    result = await runProcessor();
  } catch {
    return failJob(workerExceptionFailure().failureCode, workerExceptionFailure().failureMessageSafe);
  }

  if (!result.ok) {
    return failJob(result.failureCode, result.failureMessageSafe);
  }

  const completedAt = now();
  const completedJob =
    (await repository.markDeletionJobCompleted(job.id, completedAt)) ?? {
      ...job,
      status: "completed",
      completedAt
    };

  try {
    await auditSink?.recordPrivacyDeletionAuditEvent({
      job: completedJob,
      status: "completed",
      recordedAt: completedAt
    });
  } catch {
    // Persistent audit delivery must not block privacy deletion completion.
  }

  return {
    status: "completed",
    job: completedJob
  };
};
