import { fileURLToPath } from "node:url";

import type {
  GenerationWorkerProcessResult,
  WorkerRuntimeEnvironment
} from "@mongchi/ai-worker";

import type { ApiRuntimeEnvironment } from "./apiRuntimeConfig";
import { requireApiRuntimeConfig } from "./apiRuntimeConfig";
import {
  startPostgresApiNodeServerFromRuntimeEnv,
  type StartPostgresApiNodeServerFromRuntimeEnvOptions,
  type StartedPostgresApiNodeServer
} from "./apiServerProcess";
import {
  runPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnv,
  type RunPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnvOptions
} from "./chatRetentionPurgeWorkerDeployment";
import type { ChatRetentionPurgeWorkerProcessResult } from "./chatRetentionPurgeWorkerProcess";
import { loadApiDatabaseMigrations, runApiDatabaseMigrations, type ApiDatabaseMigrationResult } from "./dbMigrations";
import {
  runOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnv,
  type RunOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnvOptions
} from "./generationWorkerDeployment";
import {
  createAlertingOperationalLogger,
  createHttpOperationalAlertSink,
  createJsonLineOperationalLogger,
  type JsonLineOperationalLoggerOptions,
  type OperationalAlertSink,
  type OperationalLogger
} from "./operationalLogger";
import {
  runPostgresApiOutboxWorkerDeploymentFromRuntimeEnv,
  type RunPostgresApiOutboxWorkerDeploymentFromRuntimeEnvOptions
} from "./outboxWorkerDeployment";
import type { ApiOutboxWorkerProcessResult } from "./outboxWorkerProcess";
import { createPostgresApiDatabaseClientFromRuntimeConfig } from "./postgresClient";
import {
  runPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnv,
  type RunPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnvOptions
} from "./privacyDeletionWorkerDeployment";
import type { PrivacyDeletionWorkerProcessResult } from "./privacyDeletionWorkerProcess";

export type ApiRuntimeCommand =
  | "api-server"
  | "generation-worker"
  | "privacy-deletion-worker"
  | "outbox-worker"
  | "chat-retention-worker"
  | "migrate";

export type ApiRuntimeWorkerCommand = Exclude<ApiRuntimeCommand, "api-server" | "migrate">;

export type ApiRuntimeCommandEnvironment = ApiRuntimeEnvironment & WorkerRuntimeEnvironment;

export type ApiRuntimeWorkerProcessResult =
  | GenerationWorkerProcessResult
  | PrivacyDeletionWorkerProcessResult
  | ApiOutboxWorkerProcessResult
  | ChatRetentionPurgeWorkerProcessResult;

export interface ApiRuntimeCommandDependencies {
  createOperationalLogger?: (options?: JsonLineOperationalLoggerOptions) => OperationalLogger;
  createOperationalAlertSink?: (env: ApiRuntimeCommandEnvironment | undefined) => OperationalAlertSink | undefined;
  startApiServer?: (options?: StartPostgresApiNodeServerFromRuntimeEnvOptions) => Promise<StartedPostgresApiNodeServer>;
  runGenerationWorker?: (
    options?: RunOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnvOptions
  ) => Promise<GenerationWorkerProcessResult>;
  runPrivacyDeletionWorker?: (
    options?: RunPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnvOptions
  ) => Promise<PrivacyDeletionWorkerProcessResult>;
  runOutboxWorker?: (
    options?: RunPostgresApiOutboxWorkerDeploymentFromRuntimeEnvOptions
  ) => Promise<ApiOutboxWorkerProcessResult>;
  runChatRetentionWorker?: (
    options?: RunPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnvOptions
  ) => Promise<ChatRetentionPurgeWorkerProcessResult>;
  runMigrate?: (options?: RunApiDatabaseMigrateFromRuntimeEnvOptions) => Promise<ApiDatabaseMigrationResult>;
}

export interface RunApiRuntimeCommandOptions {
  env?: ApiRuntimeCommandEnvironment;
  signal?: AbortSignal;
  operationalLogger?: OperationalLogger;
  dependencies?: ApiRuntimeCommandDependencies;
}

export interface RunApiDatabaseMigrateFromRuntimeEnvOptions {
  env?: ApiRuntimeCommandEnvironment;
  migrationsDir?: string;
}

export type ApiRuntimeCommandResult =
  | {
      command: "api-server";
      status: "started";
      server: StartedPostgresApiNodeServer;
    }
  | {
      command: ApiRuntimeWorkerCommand;
      status: ApiRuntimeWorkerProcessResult["status"];
      result: ApiRuntimeWorkerProcessResult;
    }
  | {
      command: "migrate";
      status: "applied" | "failed";
      result: ApiDatabaseMigrationResult;
    };

export interface RunApiRuntimeCommandFromArgvOptions extends RunApiRuntimeCommandOptions {
  argv?: readonly string[];
}

export interface RunApiRuntimeCommandCliOptions
  extends Omit<RunApiRuntimeCommandFromArgvOptions, "signal"> {
  writeError?: (message: string) => void;
  setExitCode?: (code: number) => void;
  processSignals?: RuntimeSignalTarget;
}

interface RuntimeSignalTarget {
  once: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown;
  off: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown;
}

const commandAliases: Record<string, ApiRuntimeCommand> = {
  api: "api-server",
  "api-server": "api-server",
  server: "api-server",
  generation: "generation-worker",
  "generation-worker": "generation-worker",
  worker: "generation-worker",
  "privacy-worker": "privacy-deletion-worker",
  "privacy-deletion": "privacy-deletion-worker",
  "privacy-deletion-worker": "privacy-deletion-worker",
  outbox: "outbox-worker",
  "outbox-worker": "outbox-worker",
  "chat-retention": "chat-retention-worker",
  "chat-retention-worker": "chat-retention-worker",
  migrate: "migrate"
};

const serviceNameByCommand: Record<ApiRuntimeCommand, string> = {
  "api-server": "mongchi-api",
  "generation-worker": "mongchi-generation-worker",
  "privacy-deletion-worker": "mongchi-privacy-worker",
  "outbox-worker": "mongchi-outbox-worker",
  "chat-retention-worker": "mongchi-chat-retention-worker",
  migrate: "mongchi-api-migrate"
};

const workerSummaryKeys = [
  "runs",
  "completedJobs",
  "failedJobs",
  "deliveredEvents",
  "failedEvents",
  "purgedRuns",
  "deletedMessages",
  "idleRuns",
  "failureCode",
  "failureMessageSafe"
] as const;

const parseOptionalRuntimeInteger = (value: string | undefined): number | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const parseApiRuntimeCommand = (value: string | undefined): ApiRuntimeCommand | null => {
  const normalized = value?.trim().toLowerCase();

  return normalized ? commandAliases[normalized] ?? null : null;
};

export const formatApiRuntimeCommandUsage = (): string =>
  [
    "Usage: npm --workspace @mongchi/api run start:<command>",
    "",
    "Commands:",
    "  start:api",
    "  start:generation-worker",
    "  start:privacy-worker",
    "  start:outbox-worker",
    "  start:chat-retention-worker",
    "  start:migrate"
  ].join("\n");

const resolveOperationalLogger = (
  command: ApiRuntimeCommand,
  env: ApiRuntimeCommandEnvironment | undefined,
  operationalLogger: OperationalLogger | undefined,
  dependencies: ApiRuntimeCommandDependencies | undefined
): OperationalLogger => {
  if (operationalLogger) {
    return operationalLogger;
  }

  const apiServiceName = command === "api-server" ? env?.TINY_PET_API_SERVICE_NAME?.trim() : undefined;
  const serviceName = apiServiceName || serviceNameByCommand[command];
  const createLogger = dependencies?.createOperationalLogger ?? createJsonLineOperationalLogger;
  const alertSink = dependencies?.createOperationalAlertSink
    ? dependencies.createOperationalAlertSink(env)
    : createOperationalAlertSinkFromRuntimeEnv(env);

  return createAlertingOperationalLogger(createLogger({ serviceName }), alertSink ? { alertSink } : {});
};

export const createOperationalAlertSinkFromRuntimeEnv = (
  env: ApiRuntimeCommandEnvironment | undefined
): OperationalAlertSink | undefined => {
  const routing = env?.TINY_PET_OPERATIONAL_ALERT_ROUTING?.trim().toLowerCase();

  if (!routing || routing === "json_logs") {
    return undefined;
  }

  if (routing !== "webhook") {
    throw new Error("TINY_PET_OPERATIONAL_ALERT_ROUTING must be json_logs or webhook.");
  }

  const endpoint = env?.TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL?.trim();

  if (!endpoint) {
    throw new Error("TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL must be set when alert routing is webhook.");
  }

  const timeoutMs = parseOptionalRuntimeInteger(env?.TINY_PET_OPERATIONAL_ALERT_WEBHOOK_TIMEOUT_MS);

  if (timeoutMs === null) {
    throw new Error("TINY_PET_OPERATIONAL_ALERT_WEBHOOK_TIMEOUT_MS must be a positive integer when set.");
  }

  return createHttpOperationalAlertSink({
    endpoint,
    ...(env?.TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN
      ? { bearerToken: env.TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN }
      : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {})
  });
};

const summarizeWorkerProcessResult = (result: ApiRuntimeWorkerProcessResult): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {
    status: result.status
  };

  for (const key of workerSummaryKeys) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      metadata[key] = result[key as keyof ApiRuntimeWorkerProcessResult];
    }
  }

  return metadata;
};

const logWorkerResult = (
  logger: OperationalLogger,
  command: ApiRuntimeWorkerCommand,
  result: ApiRuntimeWorkerProcessResult
) => {
  const metadata = {
    command,
    ...summarizeWorkerProcessResult(result)
  };

  if (result.status === "failed") {
    logger.error?.("api_runtime_command_failed", metadata);
    return;
  }

  logger.info?.("api_runtime_command_finished", metadata);
};

const defaultMigrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

const defaultRunMigrate = async ({
  env,
  migrationsDir = defaultMigrationsDir
}: RunApiDatabaseMigrateFromRuntimeEnvOptions = {}): Promise<ApiDatabaseMigrationResult> => {
  const config = requireApiRuntimeConfig(env);
  const migrations = await loadApiDatabaseMigrations(migrationsDir);
  const client = createPostgresApiDatabaseClientFromRuntimeConfig(config);

  try {
    return await runApiDatabaseMigrations(client, migrations);
  } finally {
    await client.end();
  }
};

export const runApiRuntimeCommand = async (
  command: ApiRuntimeCommand,
  {
    env,
    signal,
    operationalLogger,
    dependencies
  }: RunApiRuntimeCommandOptions = {}
): Promise<ApiRuntimeCommandResult> => {
  const logger = resolveOperationalLogger(command, env, operationalLogger, dependencies);

  if (command === "api-server") {
    const server = await (dependencies?.startApiServer ?? startPostgresApiNodeServerFromRuntimeEnv)({
      ...(env ? { env } : {}),
      ...(signal ? { signal } : {}),
      operationalLogger: logger
    });

    return {
      command,
      status: "started",
      server
    };
  }

  if (command === "generation-worker") {
    const result = await (dependencies?.runGenerationWorker ?? runOpenAiPostgresGenerationWorkerDeploymentFromRuntimeEnv)({
      ...(env ? { env } : {}),
      operationalLogger: logger,
      ...(signal
        ? {
            processOptions: {
              signal
            }
          }
        : {})
    });

    logWorkerResult(logger, command, result);

    return {
      command,
      status: result.status,
      result
    };
  }

  if (command === "privacy-deletion-worker") {
    const result = await (dependencies?.runPrivacyDeletionWorker ?? runPostgresPrivacyDeletionWorkerDeploymentFromRuntimeEnv)({
      ...(env ? { env } : {}),
      operationalLogger: logger,
      ...(signal
        ? {
            processOptions: {
              signal
            }
          }
        : {})
    });

    logWorkerResult(logger, command, result);

    return {
      command,
      status: result.status,
      result
    };
  }

  if (command === "outbox-worker") {
    const result = await (dependencies?.runOutboxWorker ?? runPostgresApiOutboxWorkerDeploymentFromRuntimeEnv)({
      ...(env ? { env } : {}),
      operationalLogger: logger,
      ...(signal
        ? {
            processOptions: {
              signal
            }
          }
        : {})
    });

    logWorkerResult(logger, command, result);

    return {
      command,
      status: result.status,
      result
    };
  }

  if (command === "chat-retention-worker") {
    const result = await (dependencies?.runChatRetentionWorker ?? runPostgresChatRetentionPurgeWorkerDeploymentFromRuntimeEnv)({
      ...(env ? { env } : {}),
      operationalLogger: logger,
      ...(signal
        ? {
            processOptions: {
              signal
            }
          }
        : {})
    });

    logWorkerResult(logger, command, result);

    return {
      command,
      status: result.status,
      result
    };
  }

  try {
    const result = await (dependencies?.runMigrate ?? defaultRunMigrate)({
      ...(env ? { env } : {})
    });

    logger.info?.("api_runtime_command_finished", {
      command,
      applied: result.applied,
      skipped: result.skipped
    });

    return {
      command,
      status: "applied",
      result
    };
  } catch (error) {
    const safeErrorMessage = toSafeErrorMessage(error);

    logger.error?.("api_runtime_command_failed", {
      command,
      failureCode: "api_migrate_command_failed",
      failureMessageSafe: safeErrorMessage
    });

    return {
      command,
      status: "failed",
      result: {
        applied: [],
        skipped: []
      }
    };
  }
};

export const runApiRuntimeCommandFromArgv = async ({
  argv = process.argv.slice(2),
  ...options
}: RunApiRuntimeCommandFromArgvOptions = {}): Promise<ApiRuntimeCommandResult> => {
  const command = parseApiRuntimeCommand(argv[0]);

  if (!command) {
    throw new Error(formatApiRuntimeCommandUsage());
  }

  return runApiRuntimeCommand(command, options);
};

const createProcessAbortSignal = (processSignals: RuntimeSignalTarget) => {
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
  };
  const dispose = () => {
    processSignals.off("SIGINT", abort);
    processSignals.off("SIGTERM", abort);
  };

  processSignals.once("SIGINT", abort);
  processSignals.once("SIGTERM", abort);
  controller.signal.addEventListener("abort", dispose, { once: true });

  return {
    signal: controller.signal,
    dispose
  };
};

const waitForAbort = (signal: AbortSignal): Promise<void> => {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
};

const toSafeErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : "API runtime command failed.");

export const runApiRuntimeCommandCli = async ({
  argv = process.argv.slice(2),
  env = process.env,
  operationalLogger,
  dependencies,
  writeError = (message) => console.error(message),
  setExitCode = (code) => {
    process.exitCode = code;
  },
  processSignals = process
}: RunApiRuntimeCommandCliOptions = {}): Promise<ApiRuntimeCommandResult | null> => {
  const command = parseApiRuntimeCommand(argv[0]);
  const processAbortSignal = createProcessAbortSignal(processSignals);

  try {
    if (!command) {
      throw new Error(formatApiRuntimeCommandUsage());
    }

    if (command === "api-server") {
      const result = await runApiRuntimeCommand("api-server", {
        env,
        ...(operationalLogger ? { operationalLogger } : {}),
        ...(dependencies ? { dependencies } : {})
      });

      await waitForAbort(processAbortSignal.signal);

      if (result.command === "api-server") {
        await result.server.close();
      }

      return result;
    }

    const result = await runApiRuntimeCommand(command, {
      env,
      signal: processAbortSignal.signal,
      ...(operationalLogger ? { operationalLogger } : {}),
      ...(dependencies ? { dependencies } : {})
    });

    setExitCode(result.status === "failed" ? 1 : 0);

    return result;
  } catch (error) {
    const logger = command ? resolveOperationalLogger(command, env, operationalLogger, dependencies) : operationalLogger;

    logger?.error?.("api_runtime_command_failed", {
      ...(command ? { command } : {}),
      failureCode: "api_runtime_command_failed"
    });
    writeError(toSafeErrorMessage(error));
    setExitCode(1);

    return null;
  } finally {
    processAbortSignal.dispose();
  }
};
