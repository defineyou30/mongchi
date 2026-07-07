import { describe, expect, it } from "vitest";

import type { GenerationWorkerBatchRuntime, GenerationWorkerRepositories, WorkerRuntimeConfig } from "@mongchi/ai-worker";

import {
  createOpenAiPostgresGenerationWorkerDeployment,
  readGenerationWorkerProcessRuntimeOptions,
  runOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnv
} from "../generationWorkerDeployment";

const makeWorkerConfig = (database: WorkerRuntimeConfig["database"] = null): WorkerRuntimeConfig => ({
  releaseProfile: "development",
  production: false,
  database,
  storage: {
    bucket: "tiny-pet-private",
    region: "us-east-1",
    accessKeyId: "AKIAWORKERKEY",
    secretAccessKey: "worker-secret-key",
    endpoint: "https://s3.us-east-1.amazonaws.com",
    forcePathStyle: false,
    generatedAssetPrefix: "generated/prod"
  },
  provider: {
    provider: "openai",
    apiKey: "provider-secret-key",
    model: "runtime-image-model",
    safetyModel: "runtime-vision-model"
  },
  qualityGate: {
    minimumPetVisibilityConfidence: 0.72,
    minimumStyleMatchScore: 0.7,
    minimumProviderConfidence: 0.68
  },
  maxJobsPerRun: 1
});

const makeIdleRepositories = (calls: string[] = []): GenerationWorkerRepositories => ({
  generation: {
    claimNextGenerationJob: async () => {
      calls.push("claim");

      return null;
    },
    updateGenerationJobStatus: async () => {
      throw new Error("Should not update status while idle.");
    },
    findOwnedOriginalPhoto: async () => {
      throw new Error("Should not read photos while idle.");
    },
    upsertGeneratedAsset: async ({ asset }) => asset,
    upsertGenerationJob: async ({ job }) => job
  }
});

describe("OpenAI Postgres generation worker deployment", () => {
  it("composes the worker runtime and process runner around injected repositories", async () => {
    const calls: string[] = [];
    const deployment = createOpenAiPostgresGenerationWorkerDeployment(makeWorkerConfig(), {
      repositories: makeIdleRepositories(calls)
    });
    const result = await deployment.run();

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      completedJobs: 0,
      failedJobs: 0,
      idleRuns: 1
    });
    expect(result.lastBatch).toMatchObject({
      idle: true,
      completedJobs: 0,
      failedJobs: 0
    });
    expect(calls).toEqual(["claim"]);
    await expect(deployment.close()).resolves.toBeUndefined();
  });

  it("requires database config when repositories are not injected", () => {
    expect(() => createOpenAiPostgresGenerationWorkerDeployment(makeWorkerConfig(null))).toThrow(
      "Worker database runtime config is missing."
    );
  });

  it("closes an injected database client only when the deployment owns it", async () => {
    const closeCalls: string[] = [];
    const deployment = createOpenAiPostgresGenerationWorkerDeployment(makeWorkerConfig(), {
      repositories: makeIdleRepositories(),
      databaseClient: {
        query: async () => ({ rows: [] }),
        end: async () => {
          closeCalls.push("end");
        }
      }
    });

    await deployment.close();
    expect(closeCalls).toEqual([]);
  });

  it("reads scheduler-friendly process options from environment variables", () => {
    expect(
      readGenerationWorkerProcessRuntimeOptions({
        TINY_PET_WORKER_PROCESS_MODE: "poll",
        TINY_PET_WORKER_POLL_INTERVAL_MS: "250",
        TINY_PET_WORKER_MAX_RUNS: "3",
        TINY_PET_WORKER_STOP_ON_IDLE: "false",
        TINY_PET_WORKER_STOP_ON_FAILURE: "true",
        TINY_PET_WORKER_STOP_PROCESS_ON_FAILURE: "yes"
      })
    ).toEqual({
      ok: true,
      options: {
        mode: "poll",
        pollIntervalMs: 250,
        maxRuns: 3,
        stopOnIdle: false,
        stopOnFailure: true,
        stopProcessOnFailure: true
      }
    });

    expect(
      readGenerationWorkerProcessRuntimeOptions({
        TINY_PET_WORKER_PROCESS_MODE: "forever",
        TINY_PET_WORKER_POLL_INTERVAL_MS: "0",
        TINY_PET_WORKER_MAX_RUNS: "many",
        TINY_PET_WORKER_STOP_ON_IDLE: "maybe"
      })
    ).toMatchObject({
      ok: false,
      errors: [
        "TINY_PET_WORKER_PROCESS_MODE must be once or poll when set.",
        "TINY_PET_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.",
        "TINY_PET_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.",
        "TINY_PET_WORKER_STOP_ON_IDLE must be true or false when set."
      ]
    });
  });

  it("runs a runtime-env deployment and closes owned resources after the process finishes", async () => {
    const calls: string[] = [];
    const logEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const runtime: GenerationWorkerBatchRuntime = {
      runOnce: async () => ({
        completedJobs: 0,
        failedJobs: 0,
        idle: true,
        results: []
      })
    };
    const result = await runOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnv({
      env: {
        TINY_PET_RELEASE_PROFILE: "development",
        TINY_PET_WORKER_PROCESS_MODE: "poll",
        TINY_PET_WORKER_MAX_RUNS: "2",
        TINY_PET_WORKER_STOP_ON_IDLE: "false",
        TINY_PET_WORKER_POLL_INTERVAL_MS: "1"
      },
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ event, metadata });
        }
      },
      repositories: makeIdleRepositories(calls),
      runtime,
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
    expect(calls).toEqual(["sleep"]);
    expect(logEvents).toEqual([
      {
        event: "generation_worker_batch_finished",
        metadata: {
          run: 1,
          completedJobs: 0,
          failedJobs: 0,
          idle: true,
          resultCount: 0
        }
      },
      {
        event: "generation_worker_batch_finished",
        metadata: {
          run: 2,
          completedJobs: 0,
          failedJobs: 0,
          idle: true,
          resultCount: 0
        }
      }
    ]);
  });
});
