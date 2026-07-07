import type { PoolConfig } from "pg";

import { describe, expect, it } from "vitest";

import {
  createPostgresApiDatabaseClient,
  createPostgresApiDatabaseClientFromRuntimeConfig,
  createPostgresPoolConfig
} from "../postgresClient";
import type { PgPoolConstructor } from "../postgresClient";

const runtimeDatabaseConfig = {
  databaseUrl: "postgresql://tiny_pet:secret@db.mongchi.app:5432/tiny_pet",
  sslMode: "verify-full" as const,
  maxPoolSize: 12,
  connectTimeoutMs: 7000
};

class FakePool {
  static configs: PoolConfig[] = [];
  static instances: FakePool[] = [];

  readonly queries: Array<{ sql: string; params?: unknown[] }> = [];
  ended = false;

  constructor(readonly config: PoolConfig) {
    FakePool.configs.push(config);
    FakePool.instances.push(this);
  }

  async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
    this.queries.push(params ? { sql, params } : { sql });

    return {
      rows: [{ id: "row_001" }]
    };
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

const resetFakePool = () => {
  FakePool.configs = [];
  FakePool.instances = [];
};

describe("Postgres API database client", () => {
  it("maps runtime config to pg Pool config", () => {
    expect(createPostgresPoolConfig(runtimeDatabaseConfig)).toEqual({
      connectionString: runtimeDatabaseConfig.databaseUrl,
      max: 12,
      connectionTimeoutMillis: 7000,
      ssl: {
        rejectUnauthorized: true
      }
    });
    expect(createPostgresPoolConfig({ ...runtimeDatabaseConfig, sslMode: "require" })).toMatchObject({
      ssl: {
        rejectUnauthorized: false
      }
    });
    expect(createPostgresPoolConfig({ ...runtimeDatabaseConfig, sslMode: "disable" })).toMatchObject({
      ssl: false
    });
  });

  it("wraps pg Pool query and close methods", async () => {
    resetFakePool();

    const client = createPostgresApiDatabaseClient(runtimeDatabaseConfig, {
      PoolClass: FakePool as unknown as PgPoolConstructor
    });
    const result = await client.query<{ id: string }>("SELECT $1::text AS id", ["row_001"]);

    expect(result.rows).toEqual([{ id: "row_001" }]);
    expect(FakePool.configs).toEqual([createPostgresPoolConfig(runtimeDatabaseConfig)]);
    expect(FakePool.instances[0]?.queries).toEqual([
      {
        sql: "SELECT $1::text AS id",
        params: ["row_001"]
      }
    ]);

    await client.end();

    expect(FakePool.instances[0]?.ended).toBe(true);
  });

  it("creates the client from validated runtime config", () => {
    resetFakePool();

    const client = createPostgresApiDatabaseClientFromRuntimeConfig(
      {
        releaseProfile: "production",
        production: true,
        allowMockGenerationPolling: false,
        auth: null,
        database: runtimeDatabaseConfig,
        storage: null,
        commerceWebhookSecret: null,
        storeVerifier: null,
        premiumChat: null
      },
      {
        PoolClass: FakePool as unknown as PgPoolConstructor
      }
    );

    expect(FakePool.configs).toEqual([createPostgresPoolConfig(runtimeDatabaseConfig)]);
    expect(client).toHaveProperty("query");
    expect(() =>
      createPostgresApiDatabaseClientFromRuntimeConfig({
        releaseProfile: "development",
        production: false,
        allowMockGenerationPolling: true,
        auth: null,
        database: null,
        storage: null,
        commerceWebhookSecret: null,
        storeVerifier: null,
        premiumChat: null
      })
    ).toThrow(/TINY_PET_DATABASE_URL/);
  });
});
