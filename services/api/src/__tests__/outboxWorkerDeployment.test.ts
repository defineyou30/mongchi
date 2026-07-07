import { describe, expect, it } from "vitest";

import type { ApiRuntimeConfig } from "../apiRuntimeConfig";
import type { ApiOutboxEventSink } from "../outboxWorker";
import {
  createPostgresApiOutboxWorkerDeployment,
  readApiOutboxWorkerProcessRuntimeOptions,
  runPostgresApiOutboxWorkerDeploymentFromRuntimeEnv
} from "../outboxWorkerDeployment";
import type { ApiOutboxEventRecord, ApiOutboxRepository, EnqueueApiOutboxEventInput } from "../postgresOutboxRepository";

const makeApiConfig = (database: ApiRuntimeConfig["database"] = null): ApiRuntimeConfig => ({
  releaseProfile: "development",
  production: false,
  allowMockGenerationPolling: true,
  auth: null,
  database,
  storage: null,
  commerceWebhookSecret: null,
  storeVerifier: null,
  premiumChat: null
});

const createEvent = (overrides: Partial<ApiOutboxEventRecord> = {}): ApiOutboxEventRecord => ({
  id: "outbox_deploy_001",
  aggregateType: "privacy_deletion_job",
  aggregateId: "privacy_job_001",
  eventType: "privacy_deletion.completed",
  payload: {
    jobId: "privacy_job_001"
  },
  status: "processing",
  createdAt: "2026-06-24T09:00:00.000Z",
  ...overrides
});

const createRepository = (
  events: Array<ApiOutboxEventRecord | null>,
  calls: string[] = []
): ApiOutboxRepository => {
  const queue = [...events];

  return {
    enqueueEvent: async (input: EnqueueApiOutboxEventInput) => ({
      id: "outbox_event_enqueued",
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      status: "pending",
      createdAt: "2026-06-24T09:00:00.000Z"
    }),
    claimNextPendingEvent: async () => {
      calls.push("claim");

      return queue.shift() ?? null;
    },
    markEventProcessed: async (id, processedAt) => {
      calls.push(`processed:${id}:${processedAt}`);

      return {
        ...createEvent({ id }),
        status: "processed",
        processedAt
      };
    },
    markEventFailed: async (id, failureCode, processedAt) => {
      calls.push(`failed:${id}:${failureCode}:${processedAt}`);

      return {
        ...createEvent({ id }),
        status: "failed",
        processedAt,
        failureCode
      };
    }
  };
};

const createSink = (calls: string[] = []): ApiOutboxEventSink => ({
  deliverApiOutboxEvent: async ({ event }) => {
    calls.push(`deliver:${event.id}`);

    return { ok: true };
  }
});

describe("Postgres API outbox worker deployment", () => {
  it("composes the process runner around injected repository and sink", async () => {
    const calls: string[] = [];
    const deployment = createPostgresApiOutboxWorkerDeployment(makeApiConfig(), {
      repository: createRepository([createEvent()], calls),
      sink: createSink(calls)
    });
    const result = await deployment.run({
      now: () => "2026-06-24T09:05:00.000Z"
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      deliveredEvents: 1,
      failedEvents: 0,
      idleRuns: 0
    });
    expect(calls).toEqual([
      "claim",
      "deliver:outbox_deploy_001",
      "processed:outbox_deploy_001:2026-06-24T09:05:00.000Z"
    ]);
    await expect(deployment.close()).resolves.toBeUndefined();
  });

  it("requires database config and an event sink when dependencies are missing", () => {
    expect(() =>
      createPostgresApiOutboxWorkerDeployment(makeApiConfig(null), {
        sink: createSink()
      })
    ).toThrow("API database runtime config is missing for API outbox worker deployment.");
    expect(() =>
      createPostgresApiOutboxWorkerDeployment(makeApiConfig(null), {
        repository: createRepository([])
      })
    ).toThrow("API outbox event sink is missing.");
  });

  it("does not close an injected database client it does not own", async () => {
    const closeCalls: string[] = [];
    const deployment = createPostgresApiOutboxWorkerDeployment(
      makeApiConfig({
        databaseUrl: "postgres://tiny-pet.example/prod",
        sslMode: "require",
        maxPoolSize: 2,
        connectTimeoutMs: 5_000
      }),
      {
        sink: createSink(),
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
      readApiOutboxWorkerProcessRuntimeOptions({
        TINY_PET_OUTBOX_WORKER_PROCESS_MODE: "poll",
        TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS: "250",
        TINY_PET_OUTBOX_WORKER_MAX_RUNS: "3",
        TINY_PET_OUTBOX_WORKER_STOP_ON_IDLE: "false",
        TINY_PET_OUTBOX_WORKER_STOP_PROCESS_ON_FAILURE: "yes"
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
      readApiOutboxWorkerProcessRuntimeOptions({
        TINY_PET_OUTBOX_WORKER_PROCESS_MODE: "forever",
        TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS: "0",
        TINY_PET_OUTBOX_WORKER_MAX_RUNS: "many",
        TINY_PET_OUTBOX_WORKER_STOP_ON_IDLE: "maybe"
      })
    ).toMatchObject({
      ok: false,
      errors: [
        "TINY_PET_OUTBOX_WORKER_PROCESS_MODE must be once or poll when set.",
        "TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.",
        "TINY_PET_OUTBOX_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.",
        "TINY_PET_OUTBOX_WORKER_STOP_ON_IDLE must be true or false when set."
      ]
    });
  });

  it("runs a runtime-env deployment through the operational logger sink", async () => {
    const calls: string[] = [];
    const logEvents: Array<{ level: "info" | "error"; event: string; metadata: Record<string, unknown> }> = [];
    const result = await runPostgresApiOutboxWorkerDeploymentFromRuntimeEnv({
      env: {
        TINY_PET_RELEASE_PROFILE: "development",
        TINY_PET_OUTBOX_WORKER_PROCESS_MODE: "once",
        TINY_PET_OUTBOX_WORKER_MAX_RUNS: "1"
      },
      repository: createRepository(
        [
          createEvent({
            eventType: "privacy_deletion.failed",
            payload: {
              jobId: "privacy_job_001",
              failureCode: "storage_deletion_request_failed",
              signedUrl: "https://storage.example.test/private?X-Amz-Signature=raw"
            }
          })
        ],
        calls
      ),
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ level: "info", event, metadata });
        },
        error: (event, metadata) => {
          logEvents.push({ level: "error", event, metadata });
        }
      },
      processOptions: {
        now: () => "2026-06-24T09:06:00.000Z"
      }
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      deliveredEvents: 1,
      failedEvents: 0
    });
    expect(calls).toEqual(["claim", "processed:outbox_deploy_001:2026-06-24T09:06:00.000Z"]);
    expect(logEvents).toEqual([
      {
        level: "error",
        event: "api_outbox_domain_event_failed",
        metadata: {
          eventId: "outbox_deploy_001",
          aggregateType: "privacy_deletion_job",
          aggregateId: "privacy_job_001",
          eventType: "privacy_deletion.failed",
          payload: {
            jobId: "privacy_job_001",
            failureCode: "storage_deletion_request_failed",
            signedUrl: "[redacted]"
          }
        }
      },
      {
        level: "info",
        event: "api_outbox_worker_run_finished",
        metadata: {
          run: 1,
          status: "delivered",
          eventId: "outbox_deploy_001"
        }
      }
    ]);
    expect(JSON.stringify(logEvents)).not.toContain("X-Amz-Signature");
  });
});
