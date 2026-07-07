import { describe, expect, it } from "vitest";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresRepositoryBundle } from "../postgresRepositoryBundle";

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

describe("Postgres repository bundle", () => {
  it("composes all request-scoped repositories on the same database client", async () => {
    const client = new QueueDatabaseClient([[], [], [], [], [{ active: false }], [], []]);
    const repositories = createPostgresRepositoryBundle(client);

    expect(Object.keys(repositories).sort()).toEqual([
      "chat",
      "commerce",
      "dailyLoop",
      "generation",
      "outbox",
      "privacy",
      "userPets"
    ]);

    await expect(repositories.userPets.findUserById("user_demo_001")).resolves.toBeNull();
    await expect(repositories.generation.findOwnedOriginalPhoto("user_demo_001", "photo_001")).resolves.toBeNull();
    await expect(repositories.dailyLoop.findCareState("pet_001")).resolves.toBeNull();
    await expect(repositories.chat.findOwnedConversation("user_demo_001", "conv_001")).resolves.toBeNull();
    await expect(
      repositories.commerce.hasActiveEntitlement(
        "user_demo_001",
        "premium_chat",
        "2026-06-24T09:00:00.000Z"
      )
    ).resolves.toBe(false);
    await expect(repositories.privacy.findDeletionJob("privacy_001")).resolves.toBeNull();
    await expect(repositories.outbox.claimNextPendingEvent()).resolves.toBeNull();

    expect(client.queries).toHaveLength(7);
    expect(client.queries[0]?.sql).toContain("FROM public.api_users");
    expect(client.queries[1]?.sql).toContain("FROM public.original_photos");
    expect(client.queries[2]?.sql).toContain("FROM public.care_states");
    expect(client.queries[3]?.sql).toContain("FROM public.conversations");
    expect(client.queries[4]?.sql).toContain("FROM public.entitlements");
    expect(client.queries[5]?.sql).toContain("FROM public.privacy_deletion_jobs");
    expect(client.queries[6]?.sql).toContain("FROM public.api_outbox_events");
  });
});
