import { persistMockApiServiceSnapshot } from "./apiSnapshotRepository";
import { runApiDatabaseMigrations } from "./dbMigrations";
import type { MockApiServiceSnapshotPersistenceOptions } from "./apiSnapshotRepository";
import type { ApiDatabaseMigration, ApiDatabaseMigrationClient, ApiDatabaseMigrationResult } from "./dbMigrations";
import type { ApiServiceSnapshotSource } from "./servicePersistence";

export interface ApiDatabaseBootstrapOptions {
  migrations: readonly ApiDatabaseMigration[];
  snapshotSource?: ApiServiceSnapshotSource | null;
  snapshotOptions?: MockApiServiceSnapshotPersistenceOptions;
}

export interface ApiDatabaseBootstrapResult {
  migrations: ApiDatabaseMigrationResult;
  snapshotPersisted: boolean;
}

export const bootstrapApiDatabase = async (
  client: ApiDatabaseMigrationClient,
  options: ApiDatabaseBootstrapOptions
): Promise<ApiDatabaseBootstrapResult> => {
  const migrations = await runApiDatabaseMigrations(client, options.migrations);

  if (options.snapshotSource) {
    await persistMockApiServiceSnapshot(client, options.snapshotSource.snapshot(), options.snapshotOptions);
  }

  return {
    migrations,
    snapshotPersisted: !!options.snapshotSource
  };
};
