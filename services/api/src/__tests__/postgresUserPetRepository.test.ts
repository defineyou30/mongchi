import { describe, expect, it } from "vitest";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresUserPetRepository } from "../postgresUserPetRepository";
import type { PetProfile } from "@mongchi/shared";

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

const pet: PetProfile = {
  id: "pet_nori_001",
  userId: "user_demo_001",
  name: "Nori",
  species: "dog",
  personalityTags: ["curious", "affectionate"],
  talkingStyle: "gentle",
  favoriteThing: "moss pillows",
  lifecycleStatus: "draft",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const petRow = {
  id: pet.id,
  user_id: pet.userId,
  name: pet.name,
  species: pet.species,
  personality_tags: JSON.stringify(pet.personalityTags),
  talking_style: pet.talkingStyle,
  favorite_thing: pet.favoriteThing ?? null,
  memory_note: null,
  active_generation_job_id: null,
  active_asset_id: null,
  lifecycle_status: pet.lifecycleStatus,
  original_photo_deleted_at: null,
  created_at: pet.createdAt,
  updated_at: pet.updatedAt
};

describe("Postgres user/pet repository", () => {
  it("upserts API users with parameterized SQL and maps returned rows", async () => {
    const client = new QueueDatabaseClient([
      [
        {
          id: "user_demo_001",
          auth_provider: "test-auth",
          auth_subject: "provider-subject-001",
          locale: "ko-KR",
          timezone: "Asia/Seoul",
          created_at: "2026-06-24T09:00:00.000Z",
          updated_at: "2026-06-24T09:00:00.000Z"
        }
      ]
    ]);
    const repository = createPostgresUserPetRepository(client);
    const user = await repository.upsertUser({
      id: "user_demo_001",
      authProvider: "test-auth",
      authSubject: "provider-subject-001",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      now: "2026-06-24T09:00:00.000Z"
    });

    expect(user).toEqual({
      id: "user_demo_001",
      authProvider: "test-auth",
      authSubject: "provider-subject-001",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      createdAt: "2026-06-24T09:00:00.000Z",
      updatedAt: "2026-06-24T09:00:00.000Z"
    });
    expect(client.queries[0]?.sql).toContain("INSERT INTO public.api_users");
    expect(client.queries[0]?.sql).not.toContain("provider-subject-001");
    expect(client.queries[0]?.params).toEqual([
      "user_demo_001",
      "test-auth",
      "provider-subject-001",
      "ko-KR",
      "Asia/Seoul",
      "2026-06-24T09:00:00.000Z"
    ]);
  });

  it("upserts and reads pet profiles as shared domain objects", async () => {
    const client = new QueueDatabaseClient([[petRow], [petRow], [petRow]]);
    const repository = createPostgresUserPetRepository(client);

    await expect(repository.upsertPet({ pet })).resolves.toEqual(pet);
    await expect(repository.listLivePetsByUserId(pet.userId)).resolves.toEqual([pet]);
    await expect(repository.findOwnedLivePet(pet.userId, pet.id)).resolves.toEqual(pet);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.pets");
    expect(client.queries[0]?.sql).not.toContain("Nori");
    expect(client.queries[0]?.params).toEqual([
      pet.id,
      pet.userId,
      pet.name,
      pet.species,
      JSON.stringify(pet.personalityTags),
      pet.talkingStyle,
      pet.favoriteThing,
      null,
      null,
      null,
      pet.lifecycleStatus,
      null,
      pet.createdAt,
      pet.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("WHERE user_id = $1 AND lifecycle_status <> 'deleted'");
    expect(client.queries[2]?.sql).toContain("WHERE id = $2 AND user_id = $1 AND lifecycle_status <> 'deleted'");
  });

  it("soft deletes owned live pets without hard deletion", async () => {
    const client = new QueueDatabaseClient([[{ id: pet.id }], []]);
    const repository = createPostgresUserPetRepository(client);

    await expect(repository.softDeletePet(pet.userId, pet.id, "2026-06-24T10:00:00.000Z")).resolves.toBe(true);
    await expect(repository.softDeletePet(pet.userId, "pet_missing_001", "2026-06-24T10:00:00.000Z")).resolves.toBe(false);

    expect(client.queries[0]?.sql).toContain("SET lifecycle_status = 'deleted'");
    expect(client.queries[0]?.params).toEqual([pet.userId, pet.id, "2026-06-24T10:00:00.000Z"]);
  });

  it("derives current-user onboarding state from live pets and active generation jobs", async () => {
    const repository = createPostgresUserPetRepository(
      new QueueDatabaseClient([
        [
          {
            live_pet_count: "1",
            active_pet_count: "0",
            active_generation_count: "1"
          }
        ],
        [
          {
            live_pet_count: "1",
            active_pet_count: "1",
            active_generation_count: "0"
          }
        ],
        [
          {
            live_pet_count: "0",
            active_pet_count: "0",
            active_generation_count: "0"
          }
        ]
      ])
    );

    await expect(repository.getCurrentUserOnboardingState("user_demo_001", "ko-KR", "Asia/Seoul")).resolves.toMatchObject({
      onboardingState: "generation_started"
    });
    await expect(repository.getCurrentUserOnboardingState("user_demo_001", "ko-KR", "Asia/Seoul")).resolves.toMatchObject({
      onboardingState: "pet_active"
    });
    await expect(repository.getCurrentUserOnboardingState("user_new_001", "en-US", "America/New_York")).resolves.toEqual({
      userId: "user_new_001",
      locale: "en-US",
      timezone: "America/New_York",
      onboardingState: "new"
    });
  });
});
