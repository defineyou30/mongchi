import { describe, expect, it } from "vitest";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import type { PrivacyDeletionJobRecord } from "../postgresPrivacyRepository";
import { createPostgresPrivacyDeletionProcessor } from "../postgresPrivacyDeletionProcessor";
import type { PrivateStorageObjectDeleter } from "../privateStorageDeletion";

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

const originalPhotoJob: PrivacyDeletionJobRecord = {
  id: "privacy_original_photos_001",
  userId: "user_demo_001",
  scope: "original_photos",
  targetId: "pet_miso_001",
  status: "processing",
  requestedAt: "2026-06-24T09:00:00.000Z"
};

const createStorageDeleter = (uris: string[] = []): PrivateStorageObjectDeleter => ({
  deleteObjects: async (input) => {
    uris.push(...input.uris);

    return {
      ok: true,
      deletedUriCount: input.uris.length
    };
  }
});

describe("Postgres privacy deletion processor", () => {
  it("deletes original-photo storage objects before hard-deleting original-photo rows", async () => {
    const deletedUris: string[] = [];
    const auditEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const client = new QueueDatabaseClient([
      [
        { storage_uri: "s3://tiny-pet-private/originals/photo_001.png" },
        { storage_uri: "s3://tiny-pet-private/originals/photo_001.png" },
        { storage_uri: "s3://tiny-pet-private/originals/photo_002.png" }
      ],
      [{ id: "photo_001" }, { id: "photo_002" }],
      []
    ]);
    const processor = createPostgresPrivacyDeletionProcessor({
      client,
      privateStorageDeleter: createStorageDeleter(deletedUris),
      now: () => "2026-06-24T09:05:00.000Z",
      logger: {
        info: (event, metadata) => auditEvents.push({ event, metadata })
      }
    });

    await expect(processor.deleteOriginalPhotos({ job: originalPhotoJob, petId: "pet_miso_001" })).resolves.toEqual({
      ok: true
    });

    expect(deletedUris).toEqual([
      "s3://tiny-pet-private/originals/photo_001.png",
      "s3://tiny-pet-private/originals/photo_002.png"
    ]);
    expect(client.queries[0]?.sql).toContain("FROM public.original_photos");
    expect(client.queries[1]?.sql).toContain("DELETE FROM public.original_photos");
    expect(client.queries[1]?.params).toEqual(["user_demo_001", "pet_miso_001"]);
    expect(client.queries[2]?.sql).toContain("original_photo_deleted_at = COALESCE");
    expect(client.queries[2]?.params).toEqual(["user_demo_001", "pet_miso_001", "2026-06-24T09:05:00.000Z"]);
    expect(auditEvents).toEqual([
      {
        event: "privacy_deletion_processor_completed",
        metadata: expect.objectContaining({
          jobId: "privacy_original_photos_001",
          scope: "original_photos",
          storageObjectCount: 2,
          deletedOriginalPhotoCount: 2
        })
      }
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain("s3://tiny-pet-private");
  });

  it("hard-deletes chat conversations for the job owner", async () => {
    const client = new QueueDatabaseClient([[{ id: "conversation_001" }]]);
    const processor = createPostgresPrivacyDeletionProcessor({
      client,
      privateStorageDeleter: createStorageDeleter()
    });
    const { targetId: _targetId, ...chatJob } = originalPhotoJob;

    await expect(
      processor.deleteChatHistory({
        job: {
          ...chatJob,
          scope: "chat_history"
        }
      })
    ).resolves.toEqual({ ok: true });

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.sql).toContain("DELETE FROM public.conversations");
    expect(client.queries[0]?.params).toEqual(["user_demo_001"]);
  });

  it("deletes original-photo and generated-asset storage before hard-deleting a pet", async () => {
    const deletedUris: string[] = [];
    const client = new QueueDatabaseClient([
      [{ storage_uri: "s3://tiny-pet-private/originals/photo_001.png" }],
      [
        {
          storage_uri: "s3://tiny-pet-private/generated/pet_miso_001/idle.png",
          thumbnail_uri: "s3://tiny-pet-private/generated/pet_miso_001/thumb.png"
        }
      ],
      [{ id: "pet_miso_001" }]
    ]);
    const processor = createPostgresPrivacyDeletionProcessor({
      client,
      privateStorageDeleter: createStorageDeleter(deletedUris)
    });

    await expect(
      processor.deletePet({
        job: {
          ...originalPhotoJob,
          scope: "pet"
        },
        petId: "pet_miso_001"
      })
    ).resolves.toEqual({ ok: true });

    expect(deletedUris).toEqual([
      "s3://tiny-pet-private/originals/photo_001.png",
      "s3://tiny-pet-private/generated/pet_miso_001/idle.png",
      "s3://tiny-pet-private/generated/pet_miso_001/thumb.png"
    ]);
    expect(client.queries[1]?.sql).toContain("FROM public.generated_assets ga");
    expect(client.queries[2]?.sql).toContain("DELETE FROM public.pets");
    expect(client.queries[2]?.params).toEqual(["user_demo_001", "pet_miso_001"]);
  });

  it("fails safely without hard-deleting rows when private storage deletion fails", async () => {
    const errorEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const client = new QueueDatabaseClient([[{ storage_uri: "s3://tiny-pet-private/originals/photo_001.png" }]]);
    const processor = createPostgresPrivacyDeletionProcessor({
      client,
      privateStorageDeleter: {
        deleteObjects: async () => ({
          ok: false,
          failureCode: "storage_deletion_request_failed",
          failureMessageSafe: "Private storage deletion is queued for retry."
        })
      },
      logger: {
        error: (event, metadata) => errorEvents.push({ event, metadata })
      }
    });

    await expect(processor.deleteOriginalPhotos({ job: originalPhotoJob, petId: "pet_miso_001" })).resolves.toEqual({
      ok: false,
      failureCode: "storage_deletion_request_failed",
      failureMessageSafe: "Private storage deletion is queued for retry."
    });

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.sql).toContain("FROM public.original_photos");
    expect(errorEvents).toEqual([
      {
        event: "privacy_deletion_processor_failed",
        metadata: expect.objectContaining({
          jobId: "privacy_original_photos_001",
          scope: "original_photos",
          storageObjectCount: 1,
          failureCode: "storage_deletion_request_failed"
        })
      }
    ]);
    expect(JSON.stringify(errorEvents)).not.toContain("s3://tiny-pet-private");
  });
});
