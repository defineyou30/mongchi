import { describe, expect, it } from "vitest";

import { bootstrapApiDatabase } from "../apiDatabaseBootstrap";
import { createMockApiService } from "../service";
import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";

class RecordingDatabaseClient implements ApiDatabaseMigrationClient {
  readonly appliedIds = new Set<string>();
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });

    if (/SELECT id FROM public\.api_schema_migrations/i.test(sql)) {
      return {
        rows: [...this.appliedIds].map((id) => ({ id }) as Row)
      };
    }

    if (/INSERT INTO public\.api_schema_migrations/i.test(sql)) {
      const id = params?.[0];

      if (typeof id === "string") {
        this.appliedIds.add(id);
      }
    }

    return { rows: [] };
  }
}

describe("API database bootstrap", () => {
  it("runs migrations before optional snapshot persistence", async () => {
    const client = new RecordingDatabaseClient();
    const service = createMockApiService();
    const result = await bootstrapApiDatabase(client, {
      migrations: [
        {
          id: "0001_initial_api_state",
          sql: "BEGIN;\nCREATE TABLE public.bootstrap_check (id TEXT PRIMARY KEY);\nCOMMIT;"
        }
      ],
      snapshotSource: service,
      snapshotOptions: {
        persistedAt: "2026-06-24T09:00:00.000Z"
      }
    });

    const migrationIndex = client.queries.findIndex((query) => query.sql.includes("CREATE TABLE public.bootstrap_check"));
    const migrationRecordIndex = client.queries.findIndex((query) => query.sql.includes("INSERT INTO public.api_schema_migrations"));
    const snapshotTransactionIndex = client.queries.findIndex((query, index) => index > migrationRecordIndex && query.sql === "BEGIN");
    const snapshotUserIndex = client.queries.findIndex((query) => query.sql.includes("INSERT INTO public.api_users"));

    expect(result).toEqual({
      migrations: {
        applied: ["0001_initial_api_state"],
        skipped: []
      },
      snapshotPersisted: true
    });
    expect(migrationIndex).toBeGreaterThanOrEqual(0);
    expect(migrationRecordIndex).toBeGreaterThan(migrationIndex);
    expect(snapshotTransactionIndex).toBeGreaterThan(migrationRecordIndex);
    expect(snapshotUserIndex).toBeGreaterThan(snapshotTransactionIndex);
  });

  it("can run migrations without persisting a snapshot", async () => {
    const client = new RecordingDatabaseClient();
    const result = await bootstrapApiDatabase(client, {
      migrations: [
        {
          id: "0001_initial_api_state",
          sql: "BEGIN;\nSELECT 1;\nCOMMIT;"
        }
      ]
    });

    expect(result.snapshotPersisted).toBe(false);
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.api_users"))).toBe(false);
  });
});
