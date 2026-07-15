import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { loadApiDatabaseMigrations, runApiDatabaseMigrations } from "../dbMigrations";

class MemoryMigrationClient implements ApiDatabaseMigrationClient {
  readonly appliedIds = new Set<string>();
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];

  constructor(appliedIds: readonly string[] = []) {
    for (const id of appliedIds) {
      this.appliedIds.add(id);
    }
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });

    if (/SELECT id FROM public\.api_schema_migrations/i.test(sql)) {
      return {
        rows: [...this.appliedIds].sort().map((id) => ({ id }) as Row)
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

const withTemporaryDirectory = async (testBody: (directory: string) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), "tiny-pet-migrations-"));

  try {
    await testBody(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

describe("API database migrations", () => {
  it("loads the checked-in Postgres migrations in order", async () => {
    const migrationsDir = resolve(new URL("../../migrations", import.meta.url).pathname);
    const migrations = await loadApiDatabaseMigrations(migrationsDir);

    expect(migrations.map((migration) => migration.id)).toEqual([
      "0001_initial_api_state",
      "0002_generation_issue_reports",
      "0003_conversation_message_retention_index",
      "0004_reaction_catalog_versions",
      "0005_api_rate_limits",
      "0006_relationship_wallet_plant_growth",
      "0007_inventory_items_dedupe_pk",
      "0008_care_shop_drinks"
    ]);
    expect(migrations[0]?.sql).toContain("CREATE TABLE IF NOT EXISTS public.pets");
    expect(migrations[0]?.sql).toContain("CREATE TABLE IF NOT EXISTS public.purchase_ledger");
    expect(migrations[1]?.sql).toContain("CREATE TABLE IF NOT EXISTS public.generation_issue_reports");
    expect(migrations[2]?.sql).toContain("conversation_messages_created_at_idx");
    expect(migrations[3]?.sql).toContain("reaction_catalog_versions_active_locale_idx");
    expect(migrations[4]?.sql).toContain("CREATE TABLE IF NOT EXISTS public.api_rate_limits");
    expect(migrations[5]?.sql).toContain("CREATE TABLE IF NOT EXISTS public.relationship_states");
    expect(migrations[5]?.sql).toContain("CREATE TABLE IF NOT EXISTS public.credit_wallets");
    expect(migrations[6]?.sql).toContain("ADD PRIMARY KEY (user_id, item_id)");
    expect(migrations[7]?.sql).toContain("item_milk_pup_cup");
    expect(migrations[7]?.sql).toContain("category = 'drink'");
  });

  it("applies only pending migrations and records them", async () => {
    const client = new MemoryMigrationClient(["0001_initial_api_state"]);
    const result = await runApiDatabaseMigrations(client, [
      {
        id: "0002_add_runtime_table",
        sql: "BEGIN;\nCREATE TABLE public.runtime_check (id TEXT PRIMARY KEY);\nCOMMIT;"
      },
      {
        id: "0001_initial_api_state",
        sql: "BEGIN;\nCREATE TABLE public.initial_check (id TEXT PRIMARY KEY);\nCOMMIT;"
      }
    ]);

    expect(result).toEqual({
      applied: ["0002_add_runtime_table"],
      skipped: ["0001_initial_api_state"]
    });
    expect(client.appliedIds.has("0002_add_runtime_table")).toBe(true);
    expect(client.queries.some((query) => query.sql.includes("CREATE TABLE public.runtime_check"))).toBe(true);
    expect(client.queries.some((query) => query.sql.includes("CREATE TABLE public.initial_check"))).toBe(false);
  });

  it("rejects invalid migration files and duplicate ids", async () => {
    await withTemporaryDirectory(async (directory) => {
      await writeFile(join(directory, "bad-name.sql"), "BEGIN;\nSELECT 1;\nCOMMIT;", "utf8");

      await expect(loadApiDatabaseMigrations(directory)).rejects.toThrow(/Invalid migration file name/);
    });

    await expect(
      runApiDatabaseMigrations(new MemoryMigrationClient(), [
        { id: "0001_duplicate", sql: "BEGIN;\nSELECT 1;\nCOMMIT;" },
        { id: "0001_duplicate", sql: "BEGIN;\nSELECT 2;\nCOMMIT;" }
      ])
    ).rejects.toThrow(/Duplicate migration id/);
  });
});
