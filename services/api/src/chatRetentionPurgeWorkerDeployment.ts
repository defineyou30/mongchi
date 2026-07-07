import type { ApiRuntimeConfig, ApiRuntimeEnvironment } from "./apiRuntimeConfig";
import { requireApiRuntimeConfig } from "./apiRuntimeConfig";
import type { ChatRetentionPurgeRepository } from "./chatRetentionPurgeWorker";
import type { OperationalLogger } from "./operationalLogger";
import type { PostgresApiDatabaseClient } from "./postgresClient";
import { createPostgresApiDatabaseClient } from "./postgresClient";
import { createPostgresRepositoryBundle } from "./postgresRepositoryBundle";
import { resolvePremiumChatPolicy } from "./premiumChatPolicy";
import type {
  ChatRetentionPurgeWorkerProcessMode,
  ChatRetentionPurgeWorkerProcessResult,
  RunChatRetentionPurgeWorkerProcessInput
} from "./chatRetentionPurgeWorkerProcess";
import { runChatRetentionPurgeWorkerProcess } from "./chatRetentionPurgeWorkerProcess";

export interface CreatePostgresChatRetentionPurgeWorkerDeploymentOptions {
  databaseClient?: PostgresApiDatabaseClient;
  repository?: ChatRetentionPurgeRepository;
}

export interface PostgresChatRetentionPurgeWorkerDeployment {
  repository: ChatRetentionPurgeRepository;
  run: (options?: Omit<RunChatRetentionPurgeWorkerProcessInput, "repository">) => Promise<ChatRetentionPurgeWorkerProcessResult>;
  close: () => Promise<void>;
}

export type ChatRetentionPurgeWorkerProcessRuntimeOptions = Omit<
  RunChatRetentionPurgeWorkerProcessInput,
  "repository" | "logger" | "signal" | "sleep" | "now"
>;

export type ChatRetentionPurgeWorkerProcessRuntimeOptionsResult =
  | {
      ok: true;
      options: ChatRetentionPurgeWorkerProcessRuntimeOptions;
    }
  | {
      ok: false;
      errors: string[];
    };

export interface CreatePostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnvOptions
  extends CreatePostgresChatRetentionPurgeWorkerDeploymentOptions {
  env?: ApiRuntimeEnvironment;
}

export interface RunPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnvOptions
  extends CreatePostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnvOptions {
  operationalLogger?: OperationalLogger;
  processOptions?: Omit<RunChatRetentionPurgeWorkerProcessInput, "repository">;
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

const readProcessMode = (value: string | undefined): ChatRetentionPurgeWorkerProcessMode | null | undefined => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return undefined;
  }

  return trimmed === "once" || trimmed === "poll" ? trimmed : null;
};

export const readChatRetentionPurgeWorkerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): ChatRetentionPurgeWorkerProcessRuntimeOptionsResult => {
  const errors: string[] = [];
  const options: ChatRetentionPurgeWorkerProcessRuntimeOptions = {};
  const mode = readProcessMode(env.TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE);
  const pollIntervalMs = parsePositiveInteger(env.TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS);
  const maxRuns = parsePositiveInteger(env.TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS);
  const batchSize = parsePositiveInteger(env.TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE);
  const retentionWindowMs = parsePositiveInteger(env.TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS);
  const stopOnIdle = parseBoolean(env.TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE);

  if (mode === null) {
    errors.push("TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE must be once or poll when set.");
  } else if (mode !== undefined) {
    options.mode = mode;
  }

  if (pollIntervalMs === null || (pollIntervalMs !== undefined && pollIntervalMs > 86_400_000)) {
    errors.push("TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  } else if (pollIntervalMs !== undefined) {
    options.pollIntervalMs = pollIntervalMs;
  }

  if (maxRuns === null || (maxRuns !== undefined && maxRuns > 10_000)) {
    errors.push("TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  } else if (maxRuns !== undefined) {
    options.maxRuns = maxRuns;
  }

  if (batchSize === null || (batchSize !== undefined && batchSize > 10_000)) {
    errors.push("TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE must be a positive integer no greater than 10000 when set.");
  } else if (batchSize !== undefined) {
    options.batchSize = batchSize;
  }

  if (retentionWindowMs === null || (retentionWindowMs !== undefined && retentionWindowMs > 31_536_000_000)) {
    errors.push("TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS must be a positive integer no greater than 31536000000 when set.");
  } else if (retentionWindowMs !== undefined) {
    options.retentionWindowMs = retentionWindowMs;
  }

  if (stopOnIdle === null) {
    errors.push("TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE must be true or false when set.");
  } else if (stopOnIdle !== undefined) {
    options.stopOnIdle = stopOnIdle;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, options };
};

export const requireChatRetentionPurgeWorkerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): ChatRetentionPurgeWorkerProcessRuntimeOptions => {
  const result = readChatRetentionPurgeWorkerProcessRuntimeOptions(env);

  if (result.ok) {
    return result.options;
  }

  throw new Error(`Invalid chat retention purge worker process config:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
};

export const createPostgresChatRetentionPurgeWorkerDeployment = (
  config: ApiRuntimeConfig,
  options: CreatePostgresChatRetentionPurgeWorkerDeploymentOptions = {}
): PostgresChatRetentionPurgeWorkerDeployment => {
  const ownsDatabaseClient = !options.databaseClient && !options.repository;
  const databaseClient =
    options.databaseClient ?? (!options.repository ? (config.database ? createPostgresApiDatabaseClient(config.database) : null) : null);

  if (!databaseClient && !options.repository) {
    throw new Error("API database runtime config is missing for chat retention purge worker deployment.");
  }

  const repository = options.repository ?? (databaseClient ? createPostgresRepositoryBundle(databaseClient).chat : null);

  if (!repository) {
    throw new Error("Chat retention purge worker repository is missing.");
  }

  const defaultPolicy = resolvePremiumChatPolicy(config.premiumChat?.policy);

  return {
    repository,
    run: (processOptions = {}) =>
      runChatRetentionPurgeWorkerProcess({
        repository,
        retentionWindowMs: defaultPolicy.retentionWindowMs,
        ...processOptions
      }),
    close: () => (ownsDatabaseClient && databaseClient ? databaseClient.end() : Promise.resolve())
  };
};

export const createPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnv = ({
  env,
  ...options
}: CreatePostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnvOptions = {}): PostgresChatRetentionPurgeWorkerDeployment =>
  createPostgresChatRetentionPurgeWorkerDeployment(requireApiRuntimeConfig(env), options);

export const runPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnv = async ({
  env,
  operationalLogger,
  processOptions,
  ...deploymentOptions
}: RunPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnvOptions = {}): Promise<ChatRetentionPurgeWorkerProcessResult> => {
  const deployment = createPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnv({
    ...deploymentOptions,
    ...(env ? { env } : {})
  });
  const runtimeProcessOptions = requireChatRetentionPurgeWorkerProcessRuntimeOptions(env);

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
