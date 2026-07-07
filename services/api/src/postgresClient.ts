import { Pool } from "pg";
import type { PoolConfig } from "pg";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "./dbMigrations";
import type { ApiPostgresRuntimeConfig, ApiRuntimeConfig } from "./apiRuntimeConfig";

export interface PgPoolLike {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
}

export interface PgPoolConstructor {
  new (config: PoolConfig): PgPoolLike;
}

export interface PostgresApiDatabaseClient extends ApiDatabaseMigrationClient {
  end: () => Promise<void>;
}

export interface CreatePostgresApiDatabaseClientOptions {
  PoolClass?: PgPoolConstructor;
}

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
): PostgresApiDatabaseClient => {
  const PoolClass = options.PoolClass ?? Pool;
  const pool = new PoolClass(createPostgresPoolConfig(config));

  return {
    query: async <Row = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<ApiDatabaseQueryResult<Row>> => {
      const result = await pool.query(sql, params ? [...params] : undefined);

      return {
        rows: result.rows as Row[]
      };
    },
    end: () => pool.end()
  };
};

export const createPostgresApiDatabaseClientFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: CreatePostgresApiDatabaseClientOptions = {}
): PostgresApiDatabaseClient => {
  if (!config.database) {
    throw new Error("API database runtime config is missing TINY_PET_DATABASE_URL.");
  }

  return createPostgresApiDatabaseClient(config.database, options);
};
