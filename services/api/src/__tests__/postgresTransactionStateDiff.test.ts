import type { PoolConfig } from "pg";

import { describe, expect, it } from "vitest";

import { createPostgresApiDatabaseClient } from "../postgresClient";
import type { PgPoolClientLike, PgPoolConstructor, PgPoolLike } from "../postgresClient";

class StateDiffClient implements PgPoolClientLike {
  private stagedValues: Set<string> | null = null;

  constructor(private readonly committedValues: Set<string>) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: Row[] }> {
    if (sql === "BEGIN") {
      this.stagedValues = new Set(this.committedValues);
    } else if (sql === "COMMIT") {
      const stagedValues = this.stagedValues;
      if (!stagedValues) {
        throw new TypeError("COMMIT requires an active transaction.");
      }
      this.committedValues.clear();
      for (const value of stagedValues) {
        this.committedValues.add(value);
      }
      this.stagedValues = null;
    } else if (sql === "ROLLBACK") {
      this.stagedValues = null;
    } else if (sql === "INSERT_STATE") {
      const value = params?.[0];
      if (typeof value !== "string" || !this.stagedValues) {
        throw new TypeError("INSERT_STATE requires a string value inside a transaction.");
      }
      this.stagedValues.add(value);
    }
    return { rows: [] };
  }

  release(): void {}
}

class StateDiffPool implements PgPoolLike {
  static committedValues = new Set<string>();

  constructor(readonly config: PoolConfig) {}

  static reset(values: readonly string[]): void {
    StateDiffPool.committedValues = new Set(values);
  }

  async connect(): Promise<PgPoolClientLike> {
    return new StateDiffClient(StateDiffPool.committedValues);
  }

  async query<Row = Record<string, unknown>>(): Promise<{ rows: Row[] }> {
    throw new TypeError("Transaction control must not use pool.query.");
  }

  async end(): Promise<void> {}
}

const createClient = () =>
  createPostgresApiDatabaseClient(
    {
      databaseUrl: "postgresql://local-static-integration/mongchi",
      sslMode: "disable",
      maxPoolSize: 2,
      connectTimeoutMs: 100
    },
    { PoolClass: StateDiffPool satisfies PgPoolConstructor }
  );

describe("Postgres transaction state-diff integration", () => {
  it("discards a staged write after an injected mid-operation failure", async () => {
    StateDiffPool.reset(["before"]);
    const client = createClient();

    await expect(
      client.withTransaction(async (transactionClient) => {
        await transactionClient.query("INSERT_STATE", ["partial"]);
        throw new Error("injected failure after first write");
      })
    ).rejects.toThrow("injected failure after first write");

    expect([...StateDiffPool.committedValues]).toEqual(["before"]);
  });

  it("publishes the staged state only after commit", async () => {
    StateDiffPool.reset(["before"]);
    const client = createClient();

    await client.withTransaction(async (transactionClient) => {
      await transactionClient.query("INSERT_STATE", ["committed"]);
    });

    expect([...StateDiffPool.committedValues]).toEqual(["before", "committed"]);
  });
});
