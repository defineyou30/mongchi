import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { PostgresTransactionalDatabaseClient } from "./postgresClient";
import { createPostgresChatRepository } from "./postgresChatRepository";
import { createPostgresCommerceRepository } from "./postgresCommerceRepository";
import { createPostgresDailyLoopRepository } from "./postgresDailyLoopRepository";
import { createPostgresGenerationRepository } from "./postgresGenerationRepository";
import { createPostgresOutboxRepository } from "./postgresOutboxRepository";
import { createPostgresPrivacyRepository } from "./postgresPrivacyRepository";
import { createPostgresUserPetRepository } from "./postgresUserPetRepository";

export interface ApiPostgresRepositoryBundle {
  userPets: ReturnType<typeof createPostgresUserPetRepository>;
  generation: ReturnType<typeof createPostgresGenerationRepository>;
  dailyLoop: ReturnType<typeof createPostgresDailyLoopRepository>;
  chat: ReturnType<typeof createPostgresChatRepository>;
  commerce: ReturnType<typeof createPostgresCommerceRepository>;
  privacy: ReturnType<typeof createPostgresPrivacyRepository>;
  outbox: ReturnType<typeof createPostgresOutboxRepository>;
}

export const createPostgresRepositoryBundle = (client: ApiDatabaseMigrationClient): ApiPostgresRepositoryBundle => ({
  userPets: createPostgresUserPetRepository(client),
  generation: createPostgresGenerationRepository(client),
  dailyLoop: createPostgresDailyLoopRepository(client),
  chat: createPostgresChatRepository(client),
  commerce: createPostgresCommerceRepository(client),
  privacy: createPostgresPrivacyRepository(client),
  outbox: createPostgresOutboxRepository(client)
});

export const withPostgresRepositoryTransaction = <Result>(
  client: Pick<PostgresTransactionalDatabaseClient, "withTransaction">,
  operation: (repositories: ApiPostgresRepositoryBundle) => Promise<Result>
): Promise<Result> =>
  client.withTransaction((transactionClient) =>
    operation(createPostgresRepositoryBundle(transactionClient))
  );
