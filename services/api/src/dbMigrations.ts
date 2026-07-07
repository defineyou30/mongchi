import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ApiDatabaseMigration {
  id: string;
  sql: string;
}

export interface ApiDatabaseQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
}

export interface ApiDatabaseMigrationClient {
  query: <Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]) => Promise<ApiDatabaseQueryResult<Row>>;
}

export interface ApiDatabaseMigrationResult {
  applied: string[];
  skipped: string[];
}

const migrationFilePattern = /^\d{4}_[a-z0-9_]+\.sql$/;
const migrationsTableSql = `
CREATE TABLE IF NOT EXISTS public.api_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const loadApiDatabaseMigrations = async (migrationsDir: string): Promise<ApiDatabaseMigration[]> => {
  const fileNames = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  const duplicatePrefixes = fileNames
    .map((fileName) => fileName.slice(0, 4))
    .filter((prefix, index, prefixes) => prefixes.indexOf(prefix) !== index);

  if (duplicatePrefixes.length > 0) {
    throw new Error(`Duplicate migration prefix: ${[...new Set(duplicatePrefixes)].join(", ")}`);
  }

  return Promise.all(
    fileNames.map(async (fileName) => {
      if (!migrationFilePattern.test(fileName)) {
        throw new Error(`Invalid migration file name: ${fileName}`);
      }

      const sql = (await readFile(join(migrationsDir, fileName), "utf8")).trim();

      if (!/^BEGIN;/i.test(sql) || !/COMMIT;$/i.test(sql)) {
        throw new Error(`Migration must be wrapped in BEGIN/COMMIT: ${fileName}`);
      }

      return {
        id: fileName.replace(/\.sql$/, ""),
        sql
      };
    })
  );
};

export const runApiDatabaseMigrations = async (
  client: ApiDatabaseMigrationClient,
  migrations: readonly ApiDatabaseMigration[]
): Promise<ApiDatabaseMigrationResult> => {
  const orderedMigrations = [...migrations].sort((left, right) => left.id.localeCompare(right.id));
  const migrationIds = orderedMigrations.map((migration) => migration.id);
  const duplicateIds = migrationIds.filter((id, index) => migrationIds.indexOf(id) !== index);

  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate migration id: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  await client.query(migrationsTableSql);

  const existing = await client.query<{ id: string }>("SELECT id FROM public.api_schema_migrations ORDER BY id");
  const appliedIds = new Set(existing.rows.map((row) => row.id));
  const result: ApiDatabaseMigrationResult = {
    applied: [],
    skipped: []
  };

  for (const migration of orderedMigrations) {
    if (appliedIds.has(migration.id)) {
      result.skipped.push(migration.id);
      continue;
    }

    await client.query(migration.sql);
    await client.query("INSERT INTO public.api_schema_migrations (id) VALUES ($1)", [migration.id]);
    result.applied.push(migration.id);
  }

  return result;
};
