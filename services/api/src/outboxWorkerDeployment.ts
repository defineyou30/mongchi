import type { ApiRuntimeConfig, ApiRuntimeEnvironment } from "./apiRuntimeConfig";
import { requireApiRuntimeConfig } from "./apiRuntimeConfig";
import type { OperationalLogger } from "./operationalLogger";
import type { ApiOutboxEventSink } from "./outboxWorker";
import { createOperationalLoggerApiOutboxEventSink } from "./outboxWorker";
import type {
  ApiOutboxWorkerProcessMode,
  ApiOutboxWorkerProcessResult,
  RunApiOutboxWorkerProcessInput
} from "./outboxWorkerProcess";
import { runApiOutboxWorkerProcess } from "./outboxWorkerProcess";
import type { PostgresApiDatabaseClient } from "./postgresClient";
import { createPostgresApiDatabaseClient } from "./postgresClient";
import type { ApiOutboxRepository } from "./postgresOutboxRepository";
import { createPostgresRepositoryBundle } from "./postgresRepositoryBundle";

export interface CreatePostgresApiOutboxWorkerDeploymentOptions {
  databaseClient?: PostgresApiDatabaseClient;
  repository?: ApiOutboxRepository;
  sink?: ApiOutboxEventSink;
  operationalLogger?: OperationalLogger;
}

export interface PostgresApiOutboxWorkerDeployment {
  repository: ApiOutboxRepository;
  sink: ApiOutboxEventSink;
  run: (options?: Omit<RunApiOutboxWorkerProcessInput, "repository" | "sink">) => Promise<ApiOutboxWorkerProcessResult>;
  close: () => Promise<void>;
}

export type ApiOutboxWorkerProcessRuntimeOptions = Omit<
  RunApiOutboxWorkerProcessInput,
  "repository" | "sink" | "logger" | "signal" | "sleep" | "now"
>;

export type ApiOutboxWorkerProcessRuntimeOptionsResult =
  | {
      ok: true;
      options: ApiOutboxWorkerProcessRuntimeOptions;
    }
  | {
      ok: false;
      errors: string[];
    };

export interface CreatePostgresApiOutboxWorkerDeploymentFromRuntimeEnvOptions
  extends CreatePostgresApiOutboxWorkerDeploymentOptions {
  env?: ApiRuntimeEnvironment;
}

export interface RunPostgresApiOutboxWorkerDeploymentFromRuntimeEnvOptions
  extends CreatePostgresApiOutboxWorkerDeploymentFromRuntimeEnvOptions {
  processOptions?: Omit<RunApiOutboxWorkerProcessInput, "repository" | "sink">;
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

const readProcessMode = (value: string | undefined): ApiOutboxWorkerProcessMode | null | undefined => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return undefined;
  }

  return trimmed === "once" || trimmed === "poll" ? trimmed : null;
};

const assignBooleanOption = (
  options: ApiOutboxWorkerProcessRuntimeOptions,
  errors: string[],
  env: ApiRuntimeEnvironment,
  envKey: string,
  optionKey: "stopOnIdle" | "stopProcessOnFailure"
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

export const readApiOutboxWorkerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): ApiOutboxWorkerProcessRuntimeOptionsResult => {
  const errors: string[] = [];
  const options: ApiOutboxWorkerProcessRuntimeOptions = {};
  const mode = readProcessMode(env.TINY_PET_OUTBOX_WORKER_PROCESS_MODE);
  const pollIntervalMs = parsePositiveInteger(env.TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS);
  const maxRuns = parsePositiveInteger(env.TINY_PET_OUTBOX_WORKER_MAX_RUNS);

  if (mode === null) {
    errors.push("TINY_PET_OUTBOX_WORKER_PROCESS_MODE must be once or poll when set.");
  } else if (mode !== undefined) {
    options.mode = mode;
  }

  if (pollIntervalMs === null || (pollIntervalMs !== undefined && pollIntervalMs > 86_400_000)) {
    errors.push("TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  } else if (pollIntervalMs !== undefined) {
    options.pollIntervalMs = pollIntervalMs;
  }

  if (maxRuns === null || (maxRuns !== undefined && maxRuns > 10_000)) {
    errors.push("TINY_PET_OUTBOX_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  } else if (maxRuns !== undefined) {
    options.maxRuns = maxRuns;
  }

  assignBooleanOption(options, errors, env, "TINY_PET_OUTBOX_WORKER_STOP_ON_IDLE", "stopOnIdle");
  assignBooleanOption(
    options,
    errors,
    env,
    "TINY_PET_OUTBOX_WORKER_STOP_PROCESS_ON_FAILURE",
    "stopProcessOnFailure"
  );

  return errors.length > 0 ? { ok: false, errors } : { ok: true, options };
};

export const requireApiOutboxWorkerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): ApiOutboxWorkerProcessRuntimeOptions => {
  const result = readApiOutboxWorkerProcessRuntimeOptions(env);

  if (result.ok) {
    return result.options;
  }

  throw new Error(`Invalid API outbox worker process config:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
};

export const createPostgresApiOutboxWorkerDeployment = (
  config: ApiRuntimeConfig,
  options: CreatePostgresApiOutboxWorkerDeploymentOptions = {}
): PostgresApiOutboxWorkerDeployment => {
  const ownsDatabaseClient = !options.databaseClient && !options.repository;
  const databaseClient =
    options.databaseClient ?? (!options.repository ? (config.database ? createPostgresApiDatabaseClient(config.database) : null) : null);

  if (!databaseClient && !options.repository) {
    throw new Error("API database runtime config is missing for API outbox worker deployment.");
  }

  const repository = options.repository ?? (databaseClient ? createPostgresRepositoryBundle(databaseClient).outbox : null);

  if (!repository) {
    throw new Error("API outbox worker repository is missing.");
  }

  const sink = options.sink ?? (options.operationalLogger ? createOperationalLoggerApiOutboxEventSink(options.operationalLogger) : null);

  if (!sink) {
    throw new Error("API outbox event sink is missing.");
  }

  return {
    repository,
    sink,
    run: (processOptions = {}) =>
      runApiOutboxWorkerProcess({
        repository,
        sink,
        ...processOptions,
        ...(options.operationalLogger && !processOptions.logger ? { logger: options.operationalLogger } : {})
      }),
    close: () => (ownsDatabaseClient && databaseClient ? databaseClient.end() : Promise.resolve())
  };
};

export const createPostgresApiOutboxWorkerDeploymentFromRuntimeEnv = ({
  env,
  ...options
}: CreatePostgresApiOutboxWorkerDeploymentFromRuntimeEnvOptions = {}): PostgresApiOutboxWorkerDeployment =>
  createPostgresApiOutboxWorkerDeployment(requireApiRuntimeConfig(env), options);

export const runPostgresApiOutboxWorkerDeploymentFromRuntimeEnv = async ({
  env,
  processOptions,
  ...deploymentOptions
}: RunPostgresApiOutboxWorkerDeploymentFromRuntimeEnvOptions = {}): Promise<ApiOutboxWorkerProcessResult> => {
  const deployment = createPostgresApiOutboxWorkerDeploymentFromRuntimeEnv({
    ...deploymentOptions,
    ...(env ? { env } : {})
  });
  const runtimeProcessOptions = requireApiOutboxWorkerProcessRuntimeOptions(env);

  try {
    return await deployment.run({
      ...runtimeProcessOptions,
      ...processOptions
    });
  } finally {
    await deployment.close();
  }
};
