import { AsyncLocalStorage } from "node:async_hooks";

import { Pool } from "pg";
import type { PoolConfig } from "pg";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "./dbMigrations";
import type { ApiPostgresRuntimeConfig, ApiRuntimeConfig } from "./apiRuntimeConfig";

export interface PgPoolLike {
  query: <Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<ApiDatabaseQueryResult<Row>>;
  connect: () => Promise<PgPoolClientLike>;
  end: () => Promise<void>;
}

export interface PgPoolClientLike {
  query: <Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<ApiDatabaseQueryResult<Row>>;
  release: (error?: Error | boolean) => void;
}

export interface PgPoolConstructor {
  new (config: PoolConfig): PgPoolLike;
}

export interface PostgresApiDatabaseClient extends ApiDatabaseMigrationClient {
  end: () => Promise<void>;
}

export interface PostgresTransactionalDatabaseClient extends PostgresApiDatabaseClient {
  withTransaction: <Result>(
    operation: (client: ApiDatabaseMigrationClient) => Promise<Result>
  ) => Promise<Result>;
}

export interface CreatePostgresApiDatabaseClientOptions {
  PoolClass?: PgPoolConstructor;
}

const transactionCleanupStages = ["rollback", "release"] as const;
type PostgresTransactionCleanupStage = (typeof transactionCleanupStages)[number];

type PostgresTransactionCleanupFailure = {
  readonly stage: PostgresTransactionCleanupStage;
  readonly error: Error;
};

export class PostgresTransactionCleanupError extends Error {
  readonly cleanupStages: readonly PostgresTransactionCleanupStage[];
  readonly cleanupErrors: readonly Error[];

  constructor(primaryError: Error, cleanupFailures: readonly PostgresTransactionCleanupFailure[]) {
    super("Postgres transaction failed and cleanup was incomplete.", { cause: primaryError });
    this.name = "PostgresTransactionCleanupError";
    this.cleanupStages = cleanupFailures.map(({ stage }) => stage);
    this.cleanupErrors = cleanupFailures.map(({ error }) => error);
  }
}

export class PostgresUnexpectedThrownValueError extends Error {
  constructor(cause: unknown) {
    super("Postgres transaction received a non-Error rejection.", { cause });
    this.name = "PostgresUnexpectedThrownValueError";
  }
}

export class PostgresNestedTransactionError extends Error {
  constructor() {
    super("Nested Postgres transactions are not supported; reuse the transaction-scoped repositories.");
    this.name = "PostgresNestedTransactionError";
  }
}

type PostgresTransactionOutcome<Result> =
  | { readonly kind: "committed"; readonly value: Result }
  | { readonly kind: "failed"; readonly error: Error };

const runPostgresTransaction = async <Result>(
  pool: PgPoolLike,
  operation: (client: ApiDatabaseMigrationClient) => Promise<Result>
): Promise<Result> => {
  const connectedClient = await pool.connect();
  const transactionClient: ApiDatabaseMigrationClient = {
    query: async <Row = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<ApiDatabaseQueryResult<Row>> => {
      return connectedClient.query<Row>(sql, params ? [...params] : undefined);
    }
  };
  const cleanupFailures: PostgresTransactionCleanupFailure[] = [];
  let connectionEvictionError: Error | undefined;
  let transactionOpen = false;
  let outcome: PostgresTransactionOutcome<Result>;

  try {
    await connectedClient.query("BEGIN");
    transactionOpen = true;
    const value = await operation(transactionClient);
    await connectedClient.query("COMMIT");
    transactionOpen = false;
    outcome = { kind: "committed", value };
  } catch (error) {
    const operationError =
      error instanceof Error ? error : new PostgresUnexpectedThrownValueError(error);
    outcome = { kind: "failed", error: operationError };
    if (transactionOpen) {
      try {
        await connectedClient.query("ROLLBACK");
      } catch (rollbackError) {
        const normalizedRollbackError =
          rollbackError instanceof Error
            ? rollbackError
            : new PostgresUnexpectedThrownValueError(rollbackError);
        connectionEvictionError = normalizedRollbackError;
        cleanupFailures.push({
          stage: "rollback",
          error: normalizedRollbackError
        });
      }
    }
  }

  try {
    connectedClient.release(connectionEvictionError);
  } catch (releaseError) {
    cleanupFailures.push({
      stage: "release",
      error:
        releaseError instanceof Error
          ? releaseError
          : new PostgresUnexpectedThrownValueError(releaseError)
    });
  }

  if (outcome.kind === "failed") {
    if (cleanupFailures.length > 0) {
      throw new PostgresTransactionCleanupError(outcome.error, cleanupFailures);
    }
    throw outcome.error;
  }

  const [cleanupFailure] = cleanupFailures;
  if (cleanupFailure) {
    throw cleanupFailure.error;
  }

  return outcome.value;
};

export const createPostgresPoolConfig = (config: ApiPostgresRuntimeConfig): PoolConfig => ({
  connectionString: config.databaseUrl,
  max: config.maxPoolSize,
  connectionTimeoutMillis: config.connectTimeoutMs,
  ssl:
    config.sslMode === "disable"
      ? false
      : {
          rejectUnauthorized: config.sslMode === "verify-full"
        }
});

export const createPostgresApiDatabaseClient = (
  config: ApiPostgresRuntimeConfig,
  options: CreatePostgresApiDatabaseClientOptions = {}
): PostgresTransactionalDatabaseClient => {
  const PoolClass = options.PoolClass ?? Pool;
  const pool = new PoolClass(createPostgresPoolConfig(config));
  const transactionContext = new AsyncLocalStorage<boolean>();

  return {
    query: async <Row = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<ApiDatabaseQueryResult<Row>> => {
      return pool.query<Row>(sql, params ? [...params] : undefined);
    },
    withTransaction: (operation) => {
      if (transactionContext.getStore()) {
        return Promise.reject(new PostgresNestedTransactionError());
      }
      return transactionContext.run(true, () => runPostgresTransaction(pool, operation));
    },
    end: () => pool.end()
  };
};

export const createPostgresApiDatabaseClientFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: CreatePostgresApiDatabaseClientOptions = {}
): PostgresTransactionalDatabaseClient => {
  if (!config.database) {
    throw new Error("API database runtime config is missing TINY_PET_DATABASE_URL.");
  }

  return createPostgresApiDatabaseClient(config.database, options);
};
