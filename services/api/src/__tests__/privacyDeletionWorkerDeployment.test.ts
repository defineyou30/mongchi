import { describe, expect, it } from "vitest";

import type { ApiRuntimeConfig } from "../apiRuntimeConfig";
import type { PrivacyDeletionJobRecord } from "../postgresPrivacyRepository";
import type { PrivacyDeletionProcessor, PrivacyDeletionWorkerRepository } from "../privacyDeletionWorker";
import {
  createPostgresPrivacyDeletionWorkerDeployment,
  readPrivacyDeletionWorkerProcessRuntimeOptions,
  runPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnv
} from "../privacyDeletionWorkerDeployment";

const queuedJob: PrivacyDeletionJobRecord = {
  id: "privacy_worker_deploy_001",
  userId: "user_demo_001",
  scope: "chat_history",
  status: "queued",
  requestedAt: "2026-06-24T09:00:00.000Z"
};

const makeApiConfig = (database: ApiRuntimeConfig["database"] = null): ApiRuntimeConfig => ({
  releaseProfile: "development",
  production: false,
  allowMockGenerationPolling: true,
  auth: null,
  database,
  storage: {
    bucket: "tiny-pet-private",
    region: "us-east-1",
    accessKeyId: "AKIAAPIKEY",
    secretAccessKey: "api-storage-secret",
    endpoint: "https://s3.us-east-1.amazonaws.com",
    forcePathStyle: false,
    originalPhotoPrefix: "original-photos"
  },
  commerceWebhookSecret: null,
  storeVerifier: null,
  premiumChat: null
});

const createProcessor = (calls: string[] = []): PrivacyDeletionProcessor => ({
  deleteOriginalPhotos: async () => {
    calls.push("delete-original-photos");

    return { ok: true };
  },
  deleteChatHistory: async () => {
    calls.push("delete-chat-history");

    return { ok: true };
  },
  deletePet: async () => {
    calls.push("delete-pet");

    return { ok: true };
  }
});

const createRepository = (jobs: Array<PrivacyDeletionJobRecord | null>, calls: string[] = []): PrivacyDeletionWorkerRepository => {
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

describe("Postgres privacy deletion worker deployment", () => {
  it("composes the process runner around injected repository and processor", async () => {
    const calls: string[] = [];
    const auditEvents: Array<{ jobId: string; status: "completed" | "failed" }> = [];
    const deployment = createPostgresPrivacyDeletionWorkerDeployment(makeApiConfig(), {
      repository: createRepository([queuedJob], calls),
      processor: createProcessor(calls),
      auditSink: {
        recordPrivacyDeletionAuditEvent: async ({ job, status }) => {
          auditEvents.push({ jobId: job.id, status });
        }
      }
    });
    const result = await deployment.run({
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
    expect(calls).toEqual([
      "claim",
      "delete-chat-history",
      "complete:privacy_worker_deploy_001:2026-06-24T09:05:00.000Z"
    ]);
    expect(auditEvents).toEqual([
      {
        jobId: "privacy_worker_deploy_001",
        status: "completed"
      }
    ]);
    await expect(deployment.close()).resolves.toBeUndefined();
  });

  it("requires database config when repository or processor dependencies are not injected", () => {
    expect(() => createPostgresPrivacyDeletionWorkerDeployment(makeApiConfig(null))).toThrow(
      "API database runtime config is missing for privacy deletion worker deployment."
    );
    expect(() =>
      createPostgresPrivacyDeletionWorkerDeployment(makeApiConfig(null), {
        repository: createRepository([])
      })
    ).toThrow("API database runtime config is missing for privacy deletion worker deployment.");
  });

  it("does not close an injected database client it does not own", async () => {
    const closeCalls: string[] = [];
    const deployment = createPostgresPrivacyDeletionWorkerDeployment(
      makeApiConfig({
        databaseUrl: "postgres://tiny-pet.example/prod",
        sslMode: "require",
        maxPoolSize: 2,
        connectTimeoutMs: 5_000
      }),
      {
        databaseClient: {
          query: async () => ({ rows: [] }),
          end: async () => {
            closeCalls.push("end");
          }
        }
      }
    );

    await deployment.close();
    expect(closeCalls).toEqual([]);
  });

  it("reads scheduler-friendly process options from environment variables", () => {
    expect(
      readPrivacyDeletionWorkerProcessRuntimeOptions({
        TINY_PET_PRIVACY_WORKER_PROCESS_MODE: "poll",
        TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS: "250",
        TINY_PET_PRIVACY_WORKER_MAX_RUNS: "3",
        TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE: "false",
        TINY_PET_PRIVACY_WORKER_STOP_PROCESS_ON_FAILURE: "yes"
      })
    ).toEqual({
      ok: true,
      options: {
        mode: "poll",
        pollIntervalMs: 250,
        maxRuns: 3,
        stopOnIdle: false,
        stopProcessOnFailure: true
      }
    });

    expect(
      readPrivacyDeletionWorkerProcessRuntimeOptions({
        TINY_PET_PRIVACY_WORKER_PROCESS_MODE: "forever",
        TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS: "0",
        TINY_PET_PRIVACY_WORKER_MAX_RUNS: "many",
        TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE: "maybe"
      })
    ).toMatchObject({
      ok: false,
      errors: [
        "TINY_PET_PRIVACY_WORKER_PROCESS_MODE must be once or poll when set.",
        "TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.",
        "TINY_PET_PRIVACY_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.",
        "TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE must be true or false when set."
      ]
    });
  });

  it("runs a runtime-env deployment with injected dependencies and process env", async () => {
    const calls: string[] = [];
    const result = await runPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnv({
      env: {
        TINY_PET_RELEASE_PROFILE: "development",
        TINY_PET_PRIVACY_WORKER_PROCESS_MODE: "poll",
        TINY_PET_PRIVACY_WORKER_MAX_RUNS: "2",
        TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE: "false",
        TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS: "1"
      },
      repository: createRepository([null, null], calls),
      processor: createProcessor(calls),
      processOptions: {
        sleep: async () => {
          calls.push("sleep");
        }
      }
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 2,
      completedJobs: 0,
      failedJobs: 0,
      idleRuns: 2
    });
    expect(calls).toEqual(["claim", "sleep", "claim"]);
  });
});
