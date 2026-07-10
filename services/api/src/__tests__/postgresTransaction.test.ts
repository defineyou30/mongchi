import type { PoolConfig } from "pg";

import { describe, expect, it } from "vitest";

import {
  PostgresNestedTransactionError,
  PostgresTransactionCleanupError,
  createPostgresApiDatabaseClient
} from "../postgresClient";
import type {
  PgPoolClientLike,
  PgPoolConstructor,
  PgPoolLike
} from "../postgresClient";
import { withPostgresRepositoryTransaction } from "../postgresRepositoryBundle";

const runtimeDatabaseConfig = {
  databaseUrl: "postgresql://tiny_pet:secret@db.mongchi.app:5432/tiny_pet",
  sslMode: "verify-full" as const,
  maxPoolSize: 4,
  connectTimeoutMs: 1000
};

type FakeClientOptions = {
  readonly failSql?: string;
  readonly releaseError?: Error;
};

class FakePoolClient implements PgPoolClientLike {
  readonly queries: Array<{ readonly sql: string; readonly params?: readonly unknown[] }> = [];
  readonly releaseArguments: Array<Error | boolean | undefined> = [];
  releaseCalls = 0;

  constructor(private readonly options: FakeClientOptions = {}) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: Row[] }> {
    this.queries.push(params ? { sql, params } : { sql });
    if (this.options.failSql === sql) {
      throw new Error(`${sql} failed`);
    }
    return { rows: [] };
  }

  release(error?: Error | boolean): void {
    this.releaseCalls += 1;
    this.releaseArguments.push(error);
    if (this.options.releaseError) {
      throw this.options.releaseError;
    }
  }
}

class FakePool implements PgPoolLike {
  static clients: FakePoolClient[] = [];
  static poolQueries: string[] = [];
  static nextClientOptions: FakeClientOptions[] = [];

  constructor(readonly config: PoolConfig) {}

  static reset(options: readonly FakeClientOptions[] = []): void {
    FakePool.clients = [];
    FakePool.poolQueries = [];
    FakePool.nextClientOptions = [...options];
  }

  async connect(): Promise<PgPoolClientLike> {
    const client = new FakePoolClient(FakePool.nextClientOptions.shift());
    FakePool.clients.push(client);
    return client;
  }

  async query<Row = Record<string, unknown>>(sql: string): Promise<{ rows: Row[] }> {
    FakePool.poolQueries.push(sql);
    return { rows: [] };
  }

  async end(): Promise<void> {}
}

const createClient = () =>
  createPostgresApiDatabaseClient(runtimeDatabaseConfig, {
    PoolClass: FakePool satisfies PgPoolConstructor
  });

describe("Postgres transaction substrate", () => {
  it("uses one connected client and commits exactly once on success", async () => {
    FakePool.reset();
    const client = createClient();

    await expect(
      client.withTransaction(async (transactionClient) => {
        await transactionClient.query("SELECT $1::text", ["same-connection"]);
        return "committed";
      })
    ).resolves.toBe("committed");

    expect(FakePool.poolQueries).toEqual([]);
    expect(FakePool.clients).toHaveLength(1);
    expect(FakePool.clients[0]?.queries.map(({ sql }) => sql)).toEqual([
      "BEGIN",
      "SELECT $1::text",
      "COMMIT"
    ]);
    expect(FakePool.clients[0]?.releaseCalls).toBe(1);
  });

  it("preserves an operation error, rolls back exactly once, and releases", async () => {
    FakePool.reset();
    const client = createClient();
    const operationError = new TypeError("injected mid-operation failure");

    const transaction = client.withTransaction(async (transactionClient) => {
      await transactionClient.query("INSERT INTO state_diff VALUES ($1)", ["partial"]);
      throw operationError;
    });

    await expect(transaction).rejects.toBe(operationError);
    expect(FakePool.clients[0]?.queries.map(({ sql }) => sql)).toEqual([
      "BEGIN",
      "INSERT INTO state_diff VALUES ($1)",
      "ROLLBACK"
    ]);
    expect(FakePool.clients[0]?.releaseCalls).toBe(1);
  });

  it.each(["BEGIN", "COMMIT"])("releases when %s fails", async (failSql) => {
    FakePool.reset([{ failSql }]);
    const client = createClient();

    await expect(client.withTransaction(async () => "unreachable-after-commit-failure")).rejects.toThrow(
      `${failSql} failed`
    );
    expect(FakePool.clients[0]?.releaseCalls).toBe(1);
    expect(FakePool.clients[0]?.queries.filter(({ sql }) => sql === "COMMIT")).toHaveLength(
      failSql === "COMMIT" ? 1 : 0
    );
    expect(FakePool.clients[0]?.queries.filter(({ sql }) => sql === "ROLLBACK")).toHaveLength(
      failSql === "COMMIT" ? 1 : 0
    );
  });

  it("retains the operation failure as cause when rollback also fails", async () => {
    FakePool.reset([{ failSql: "ROLLBACK" }]);
    const client = createClient();
    const operationError = new RangeError("primary operation failure");

    const transaction = client.withTransaction(async () => {
      throw operationError;
    });

    await expect(transaction).rejects.toMatchObject({
      name: PostgresTransactionCleanupError.name,
      cause: operationError,
      cleanupStages: ["rollback"]
    });
    const [releaseArgument] = FakePool.clients[0]?.releaseArguments ?? [];
    expect(releaseArgument).toBeInstanceOf(Error);
    expect(releaseArgument).toMatchObject({ message: "ROLLBACK failed" });
    expect(FakePool.clients[0]?.releaseCalls).toBe(1);
  });

  it("retains the operation failure when release also fails", async () => {
    const releaseError = new Error("release failed");
    FakePool.reset([{ releaseError }]);
    const client = createClient();
    const operationError = new Error("operation failed");

    const transaction = client.withTransaction(async () => {
      throw operationError;
    });

    await expect(transaction).rejects.toMatchObject({
      name: PostgresTransactionCleanupError.name,
      cause: operationError,
      cleanupStages: ["release"]
    });
    expect(FakePool.clients[0]?.releaseCalls).toBe(1);
  });

  it("surfaces release failure after a committed operation", async () => {
    const releaseError = new Error("release failed after commit");
    FakePool.reset([{ releaseError }]);
    const client = createClient();

    await expect(client.withTransaction(async () => "committed")).rejects.toBe(releaseError);
    expect(FakePool.clients[0]?.queries.map(({ sql }) => sql)).toEqual(["BEGIN", "COMMIT"]);
    expect(FakePool.clients[0]?.releaseCalls).toBe(1);
  });

  it("uses separate connections for concurrent transactions", async () => {
    FakePool.reset();
    const client = createClient();

    await Promise.all([
      client.withTransaction(async () => "left"),
      client.withTransaction(async () => "right")
    ]);

    expect(FakePool.clients).toHaveLength(2);
    for (const connectedClient of FakePool.clients) {
      expect(connectedClient.queries.map(({ sql }) => sql)).toEqual(["BEGIN", "COMMIT"]);
      expect(connectedClient.releaseCalls).toBe(1);
    }
  });

  it("rejects nested re-entry before a second connection can deadlock the pool", async () => {
    FakePool.reset();
    const client = createClient();

    const transaction = client.withTransaction(async () =>
      client.withTransaction(async () => "nested")
    );

    await expect(transaction).rejects.toBeInstanceOf(PostgresNestedTransactionError);
    expect(FakePool.clients).toHaveLength(1);
    expect(FakePool.clients[0]?.queries.map(({ sql }) => sql)).toEqual(["BEGIN", "ROLLBACK"]);
    expect(FakePool.clients[0]?.releaseCalls).toBe(1);
  });

  it("creates every transaction-scoped repository on the connected client", async () => {
    FakePool.reset();
    const client = createClient();

    await withPostgresRepositoryTransaction(client, async (repositories) => {
      await repositories.userPets.findUserById("user_tx_001");
      await repositories.privacy.findDeletionJob("privacy_tx_001");
    });

    expect(FakePool.poolQueries).toEqual([]);
    expect(FakePool.clients[0]?.queries.map(({ sql }) => sql)).toEqual([
      "BEGIN",
      expect.stringContaining("FROM public.api_users"),
      expect.stringContaining("FROM public.privacy_deletion_jobs"),
      "COMMIT"
    ]);
  });
});
