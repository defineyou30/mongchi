import type {
  GenerationWorkerBatchRuntime,
  GenerationWorkerProcessMode,
  GenerationWorkerProcessResult,
  GenerationWorkerRepositories,
  RunGenerationWorkerProcessInput,
  WorkerRuntimeEnvironment,
  WorkerRuntimeConfig
} from "@mongchi/ai-worker";
import {
  createOpenAiGenerationWorkerBatchRuntime,
  requireWorkerRuntimeConfig,
  runGenerationWorkerProcess
} from "@mongchi/ai-worker";

import type { PostgresApiDatabaseClient } from "./postgresClient";
import type { OperationalLogger } from "./operationalLogger";
import { createPostgresApiDatabaseClient } from "./postgresClient";
import { createPostgresRepositoryBundle } from "./postgresRepositoryBundle";

export interface CreateOpenAiPostgresGenerationWorkerDeploymentOptions {
  databaseClient?: PostgresApiDatabaseClient;
  repositories?: GenerationWorkerRepositories;
  runtime?: GenerationWorkerBatchRuntime;
}

export interface OpenAiPostgresGenerationWorkerDeployment {
  runtime: GenerationWorkerBatchRuntime;
  run: (options?: Omit<RunGenerationWorkerProcessInput, "runtime">) => Promise<GenerationWorkerProcessResult>;
  close: () => Promise<void>;
}

export type GenerationWorkerProcessRuntimeOptions = Omit<
  RunGenerationWorkerProcessInput,
  "runtime" | "logger" | "signal" | "sleep"
>;

export type GenerationWorkerProcessRuntimeOptionsResult =
  | {
      ok: true;
      options: GenerationWorkerProcessRuntimeOptions;
    }
  | {
      ok: false;
      errors: string[];
    };

export interface CreateOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnvOptions
  extends CreateOpenAiPostgresGenerationWorkerDeploymentOptions {
  env?: WorkerRuntimeEnvironment;
}

export interface RunOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnvOptions
  extends CreateOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnvOptions {
  operationalLogger?: OperationalLogger;
  processOptions?: Omit<RunGenerationWorkerProcessInput, "runtime">;
}

const parseBoolean = (value: string | undefined): boolean | null | undefined => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") {
    return true;
  }

  if (trimmed === "false" || trimmed === "0" || trimmed === "no") {
    return false;
  }

  return null;
};

const parsePositiveInteger = (value: string | undefined): number | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const readProcessMode = (value: string | undefined): GenerationWorkerProcessMode | null | undefined => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return undefined;
  }

  return trimmed === "once" || trimmed === "poll" ? trimmed : null;
};

const assignBooleanOption = (
  options: GenerationWorkerProcessRuntimeOptions,
  errors: string[],
  env: WorkerRuntimeEnvironment,
  envKey: string,
  optionKey: "stopOnIdle" | "stopOnFailure" | "stopProcessOnFailure"
) => {
  const value = parseBoolean(env[envKey]);

  if (value === null) {
    errors.push(`${envKey} must be true or false when set.`);
    return;
  }

  if (value !== undefined) {
    options[optionKey] = value;
  }
};

export const readGenerationWorkerProcessRuntimeOptions = (
  env: WorkerRuntimeEnvironment = {}
): GenerationWorkerProcessRuntimeOptionsResult => {
  const errors: string[] = [];
  const options: GenerationWorkerProcessRuntimeOptions = {};
  const mode = readProcessMode(env.TINY_PET_WORKER_PROCESS_MODE);
  const pollIntervalMs = parsePositiveInteger(env.TINY_PET_WORKER_POLL_INTERVAL_MS);
  const maxRuns = parsePositiveInteger(env.TINY_PET_WORKER_MAX_RUNS);

  if (mode === null) {
    errors.push("TINY_PET_WORKER_PROCESS_MODE must be once or poll when set.");
  } else if (mode !== undefined) {
    options.mode = mode;
  }

  if (pollIntervalMs === null || (pollIntervalMs !== undefined && pollIntervalMs > 86_400_000)) {
    errors.push("TINY_PET_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  } else if (pollIntervalMs !== undefined) {
    options.pollIntervalMs = pollIntervalMs;
  }

  if (maxRuns === null || (maxRuns !== undefined && maxRuns > 10_000)) {
    errors.push("TINY_PET_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  } else if (maxRuns !== undefined) {
    options.maxRuns = maxRuns;
  }

  assignBooleanOption(options, errors, env, "TINY_PET_WORKER_STOP_ON_IDLE", "stopOnIdle");
  assignBooleanOption(options, errors, env, "TINY_PET_WORKER_STOP_ON_FAILURE", "stopOnFailure");
  assignBooleanOption(options, errors, env, "TINY_PET_WORKER_STOP_PROCESS_ON_FAILURE", "stopProcessOnFailure");

  return errors.length > 0 ? { ok: false, errors } : { ok: true, options };
};

export const requireGenerationWorkerProcessRuntimeOptions = (
  env: WorkerRuntimeEnvironment = {}
): GenerationWorkerProcessRuntimeOptions => {
  const result = readGenerationWorkerProcessRuntimeOptions(env);

  if (result.ok) {
    return result.options;
  }

  throw new Error(`Invalid generation worker process config:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
};

export const createOpenAiPostgresGenerationWorkerDeployment = (
  config: WorkerRuntimeConfig,
  options: CreateOpenAiPostgresGenerationWorkerDeploymentOptions = {}
): OpenAiPostgresGenerationWorkerDeployment => {
  const ownsDatabaseClient = !options.databaseClient && !options.repositories;
  const databaseClient =
    options.databaseClient ??
    (options.repositories
      ? null
      : config.database
        ? createPostgresApiDatabaseClient(config.database)
        : null);

  if (!databaseClient && !options.repositories) {
    throw new Error("Worker database runtime config is missing.");
  }

  const repositories =
    options.repositories ??
    (databaseClient
      ? {
          generation: createPostgresRepositoryBundle(databaseClient).generation
        }
      : null);

  if (!repositories) {
    throw new Error("Worker generation repositories are missing.");
  }

  const runtime =
    options.runtime ??
    createOpenAiGenerationWorkerBatchRuntime(config, {
      repositories
    });

  return {
    runtime,
    run: (processOptions = {}) =>
      runGenerationWorkerProcess({
        runtime,
        ...processOptions
      }),
    close: () => (ownsDatabaseClient && databaseClient ? databaseClient.end() : Promise.resolve())
  };
};

export const createOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnv = ({
  env,
  ...options
}: CreateOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnvOptions = {}): OpenAiPostgresGenerationWorkerDeployment =>
  createOpenAiPostgresGenerationWorkerDeployment(requireWorkerRuntimeConfig(env), options);

export const runOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnv = async ({
  env,
  operationalLogger,
  processOptions,
  ...deploymentOptions
}: RunOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnvOptions = {}): Promise<GenerationWorkerProcessResult> => {
  const deployment = createOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnv({
    ...deploymentOptions,
    ...(env ? { env } : {})
  });
  const runtimeProcessOptions = requireGenerationWorkerProcessRuntimeOptions(env);

  try {
    return await deployment.run({
      ...runtimeProcessOptions,
      ...processOptions,
      ...(operationalLogger && !processOptions?.logger ? { logger: operationalLogger } : {})
    });
  } finally {
    await deployment.close();
  }
};
