import { describe, expect, it } from "vitest";

import type { ApiRuntimeConfig } from "../apiRuntimeConfig";
import type { ChatRetentionPurgeRepository } from "../chatRetentionPurgeWorker";
import {
  createPostgresChatRetentionPurgeWorkerDeployment,
  readChatRetentionPurgeWorkerProcessRuntimeOptions,
  runPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnv
} from "../chatRetentionPurgeWorkerDeployment";

const makeApiConfig = (database: ApiRuntimeConfig["database"] = null): ApiRuntimeConfig => ({
  releaseProfile: "development",
  production: false,
  allowMockGenerationPolling: true,
  auth: null,
  database,
  storage: null,
  commerceWebhookSecret: null,
  storeVerifier: null,
  premiumChat: {
    provider: "openai",
    apiKey: "sk-premium-chat",
    maxOutputTokens: 320,
    policy: {
      retentionWindowMs: 60_000
    }
  }
});

const createRepository = (batches: string[][], calls: string[] = []): ChatRetentionPurgeRepository => {
  const queue = [...batches];

  return {
    purgeExpiredMessages: async (deletedBefore, batchSize) => {
      calls.push(`purge:${deletedBefore}:${batchSize}`);

      return {
        deletedBefore,
        deletedMessageIds: queue.shift() ?? []
      };
    }
  };
};

describe("Postgres chat retention purge worker deployment", () => {
  it("composes the process runner around an injected repository", async () => {
    const calls: string[] = [];
    const deployment = createPostgresChatRetentionPurgeWorkerDeployment(makeApiConfig(), {
      repository: createRepository([["msg_old_001"]], calls)
    });
    const result = await deployment.run({
      batchSize: 1,
      now: () => "2026-06-24T09:41:00.000Z"
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      purgedRuns: 1,
      deletedMessages: 1
    });
    expect(calls).toEqual(["purge:2026-06-24T09:40:00.000Z:1"]);
    await expect(deployment.close()).resolves.toBeUndefined();
  });

  it("requires database config when no repository is injected", () => {
    expect(() => createPostgresChatRetentionPurgeWorkerDeployment(makeApiConfig(null))).toThrow(
      "API database runtime config is missing for chat retention purge worker deployment."
    );
  });

  it("does not close an injected database client it does not own", async () => {
    const closeCalls: string[] = [];
    const deployment = createPostgresChatRetentionPurgeWorkerDeployment(
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
      readChatRetentionPurgeWorkerProcessRuntimeOptions({
        TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE: "poll",
        TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS: "250",
        TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS: "3",
        TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE: "125",
        TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS: "120000",
        TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE: "false"
      })
    ).toEqual({
      ok: true,
      options: {
        mode: "poll",
        pollIntervalMs: 250,
        maxRuns: 3,
        batchSize: 125,
        retentionWindowMs: 120000,
        stopOnIdle: false
      }
    });

    expect(
      readChatRetentionPurgeWorkerProcessRuntimeOptions({
        TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE: "forever",
        TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS: "0",
        TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS: "many",
        TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE: "10001",
        TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS: "0",
        TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE: "maybe"
      })
    ).toMatchObject({
      ok: false,
      errors: [
        "TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE must be once or poll when set.",
        "TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.",
        "TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.",
        "TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE must be a positive integer no greater than 10000 when set.",
        "TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS must be a positive integer no greater than 31536000000 when set.",
        "TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE must be true or false when set."
      ]
    });
  });

  it("runs a runtime-env deployment with injected dependencies and process env", async () => {
    const calls: string[] = [];
    const logEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const result = await runPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnv({
      env: {
        TINY_PET_RELEASE_PROFILE: "development",
        TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE: "poll",
        TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS: "2",
        TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE: "false",
        TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS: "1",
        TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE: "2",
        TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS: "60000"
      },
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ event, metadata });
        }
      },
      repository: createRepository([[], []], calls),
      processOptions: {
        sleep: async () => {
          calls.push("sleep");
        },
        now: () => "2026-06-24T09:41:00.000Z"
      }
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 2,
      purgedRuns: 0,
      deletedMessages: 0,
      idleRuns: 2
    });
    expect(calls).toEqual(["purge:2026-06-24T09:40:00.000Z:2", "sleep", "purge:2026-06-24T09:40:00.000Z:2"]);
    expect(logEvents).toEqual([
      {
        event: "chat_retention_purge_worker_run_finished",
        metadata: {
          run: 1,
          status: "idle",
          deletedMessages: 0
        }
      },
      {
        event: "chat_retention_purge_worker_run_finished",
        metadata: {
          run: 2,
          status: "idle",
          deletedMessages: 0
        }
      }
    ]);
  });
});
