import { describe, expect, it } from "vitest";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresApiRateLimitStore } from "../postgresRateLimitStore";

class QueueDatabaseClient implements ApiDatabaseMigrationClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][];

  constructor(queuedRows: unknown[][]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });

    return {
      rows: (this.queuedRows.shift() ?? []) as Row[]
    };
  }
}

describe("Postgres API rate-limit store", () => {
  it("upserts a shared rate-limit bucket without storing raw tokens", async () => {
    const client = new QueueDatabaseClient([[{ windowStart: "1782375000000", count: 2 }]]);
    const store = createPostgresApiRateLimitStore(client);

    await expect(
      store.increment({
        key: `auth:${"a".repeat(32)}`,
        windowMs: 60_000,
        maxRequests: 120,
        nowMs: 1782375000000
      })
    ).resolves.toEqual({
      windowStart: 1782375000000,
      count: 2
    });

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.api_rate_limits");
    expect(client.queries[0]?.sql).toContain("ON CONFLICT (key) DO UPDATE");
    expect(client.queries[0]?.params).toEqual([`auth:${"a".repeat(32)}`, 1782375000000, 60_000]);
    expect(JSON.stringify(client.queries)).not.toContain("raw-session-token");
  });

  it("fails closed when the database returns an invalid bucket row", async () => {
    const client = new QueueDatabaseClient([[{ windowStart: "bad", count: 0 }]]);
    const store = createPostgresApiRateLimitStore(client);

    await expect(
      store.increment({
        key: `auth:${"b".repeat(32)}`,
        windowMs: 60_000,
        maxRequests: 120,
        nowMs: 1782375000000
      })
    ).rejects.toThrow(/invalid row/);
  });
});
