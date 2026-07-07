import type { ApiRuntimeConfig, ApiRuntimeEnvironment } from "./apiRuntimeConfig";
import { requireApiRuntimeConfig } from "./apiRuntimeConfig";
import type { PostgresApiDatabaseClient } from "./postgresClient";
import type { OperationalLogger } from "./operationalLogger";
import { createPostgresApiDatabaseClient } from "./postgresClient";
import type { PrivacyDeletionProcessorLogger } from "./postgresPrivacyDeletionProcessor";
import { createPostgresPrivacyDeletionProcessor } from "./postgresPrivacyDeletionProcessor";
import type { PrivacyDeletionAuditSink } from "./privacyDeletionWorker";
import { createPrivacyDeletionOutboxAuditSink } from "./postgresOutboxRepository";
import { createPostgresRepositoryBundle } from "./postgresRepositoryBundle";
import type { PrivateStorageObjectDeleter } from "./privateStorageDeletion";
import type { PrivacyDeletionProcessor, PrivacyDeletionWorkerRepository } from "./privacyDeletionWorker";
import type {
  PrivacyDeletionWorkerProcessMode,
  PrivacyDeletionWorkerProcessResult,
  RunPrivacyDeletionWorkerProcessInput
} from "./privacyDeletionWorkerProcess";
import { runPrivacyDeletionWorkerProcess } from "./privacyDeletionWorkerProcess";
import { createS3PrivateStorageObjectDeleterFromRuntimeConfig } from "./s3StorageDeleter";

export interface CreatePostgresPrivacyDeletionWorkerDeploymentOptions {
  databaseClient?: PostgresApiDatabaseClient;
  repository?: PrivacyDeletionWorkerRepository;
  processor?: PrivacyDeletionProcessor;
  auditSink?: PrivacyDeletionAuditSink;
  privateStorageDeleter?: PrivateStorageObjectDeleter;
  processorLogger?: PrivacyDeletionProcessorLogger;
}

export interface PostgresPrivacyDeletionWorkerDeployment {
  repository: PrivacyDeletionWorkerRepository;
  processor: PrivacyDeletionProcessor;
  auditSink?: PrivacyDeletionAuditSink;
  run: (options?: Omit<RunPrivacyDeletionWorkerProcessInput, "repository" | "processor">) => Promise<PrivacyDeletionWorkerProcessResult>;
  close: () => Promise<void>;
}

export type PrivacyDeletionWorkerProcessRuntimeOptions = Omit<
  RunPrivacyDeletionWorkerProcessInput,
  "repository" | "processor" | "logger" | "signal" | "sleep" | "now"
>;

export type PrivacyDeletionWorkerProcessRuntimeOptionsResult =
  | {
      ok: true;
      options: PrivacyDeletionWorkerProcessRuntimeOptions;
    }
  | {
      ok: false;
      errors: string[];
    };

export interface CreatePostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnvOptions
  extends CreatePostgresPrivacyDeletionWorkerDeploymentOptions {
  env?: ApiRuntimeEnvironment;
}

export interface RunPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnvOptions
  extends CreatePostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnvOptions {
  operationalLogger?: OperationalLogger;
  processOptions?: Omit<RunPrivacyDeletionWorkerProcessInput, "repository" | "processor">;
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

const readProcessMode = (value: string | undefined): PrivacyDeletionWorkerProcessMode | null | undefined => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return undefined;
  }

  return trimmed === "once" || trimmed === "poll" ? trimmed : null;
};

const assignBooleanOption = (
  options: PrivacyDeletionWorkerProcessRuntimeOptions,
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

export const readPrivacyDeletionWorkerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): PrivacyDeletionWorkerProcessRuntimeOptionsResult => {
  const errors: string[] = [];
  const options: PrivacyDeletionWorkerProcessRuntimeOptions = {};
  const mode = readProcessMode(env.TINY_PET_PRIVACY_WORKER_PROCESS_MODE);
  const pollIntervalMs = parsePositiveInteger(env.TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS);
  const maxRuns = parsePositiveInteger(env.TINY_PET_PRIVACY_WORKER_MAX_RUNS);

  if (mode === null) {
    errors.push("TINY_PET_PRIVACY_WORKER_PROCESS_MODE must be once or poll when set.");
  } else if (mode !== undefined) {
    options.mode = mode;
  }

  if (pollIntervalMs === null || (pollIntervalMs !== undefined && pollIntervalMs > 86_400_000)) {
    errors.push("TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  } else if (pollIntervalMs !== undefined) {
    options.pollIntervalMs = pollIntervalMs;
  }

  if (maxRuns === null || (maxRuns !== undefined && maxRuns > 10_000)) {
    errors.push("TINY_PET_PRIVACY_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  } else if (maxRuns !== undefined) {
    options.maxRuns = maxRuns;
  }

  assignBooleanOption(options, errors, env, "TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE", "stopOnIdle");
  assignBooleanOption(
    options,
    errors,
    env,
    "TINY_PET_PRIVACY_WORKER_STOP_PROCESS_ON_FAILURE",
    "stopProcessOnFailure"
  );

  return errors.length > 0 ? { ok: false, errors } : { ok: true, options };
};

export const requirePrivacyDeletionWorkerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): PrivacyDeletionWorkerProcessRuntimeOptions => {
  const result = readPrivacyDeletionWorkerProcessRuntimeOptions(env);

  if (result.ok) {
    return result.options;
  }

  throw new Error(`Invalid privacy deletion worker process config:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
};

export const createPostgresPrivacyDeletionWorkerDeployment = (
  config: ApiRuntimeConfig,
  options: CreatePostgresPrivacyDeletionWorkerDeploymentOptions = {}
): PostgresPrivacyDeletionWorkerDeployment => {
  const needsDatabaseClient = !options.repository || !options.processor;
  const ownsDatabaseClient = !options.databaseClient && needsDatabaseClient;
  const databaseClient =
    options.databaseClient ?? (needsDatabaseClient ? (config.database ? createPostgresApiDatabaseClient(config.database) : null) : null);

  if (!databaseClient && needsDatabaseClient) {
    throw new Error("API database runtime config is missing for privacy deletion worker deployment.");
  }

  const repositories = databaseClient ? createPostgresRepositoryBundle(databaseClient) : null;
  const repository = options.repository ?? repositories?.privacy ?? null;

  if (!repository) {
    throw new Error("Privacy deletion worker repository is missing.");
  }

  const privateStorageDeleter =
    options.privateStorageDeleter ?? (config.storage ? createS3PrivateStorageObjectDeleterFromRuntimeConfig(config) : undefined);
  const processor =
    options.processor ??
    (databaseClient
      ? createPostgresPrivacyDeletionProcessor({
          client: databaseClient,
          ...(privateStorageDeleter ? { privateStorageDeleter } : {}),
          ...(options.processorLogger ? { logger: options.processorLogger } : {})
        })
      : null);

  if (!processor) {
    throw new Error("Privacy deletion worker processor is missing.");
  }
  const auditSink = options.auditSink ?? (repositories ? createPrivacyDeletionOutboxAuditSink(repositories.outbox) : undefined);

  return {
    repository,
    processor,
    ...(auditSink ? { auditSink } : {}),
    run: (processOptions = {}) =>
      runPrivacyDeletionWorkerProcess({
        repository,
        processor,
        ...(auditSink ? { auditSink } : {}),
        ...processOptions
      }),
    close: () => (ownsDatabaseClient && databaseClient ? databaseClient.end() : Promise.resolve())
  };
};

export const createPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnv = ({
  env,
  ...options
}: CreatePostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnvOptions = {}): PostgresPrivacyDeletionWorkerDeployment =>
  createPostgresPrivacyDeletionWorkerDeployment(requireApiRuntimeConfig(env), options);

export const runPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnv = async ({
  env,
  operationalLogger,
  processOptions,
  ...deploymentOptions
}: RunPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnvOptions = {}): Promise<PrivacyDeletionWorkerProcessResult> => {
  const deployment = createPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnv({
    ...deploymentOptions,
    ...(env ? { env } : {})
  });
  const runtimeProcessOptions = requirePrivacyDeletionWorkerProcessRuntimeOptions(env);

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
