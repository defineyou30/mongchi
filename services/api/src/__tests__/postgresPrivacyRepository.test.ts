import { describe, expect, it } from "vitest";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresPrivacyRepository } from "../postgresPrivacyRepository";
import type { PrivacyDeletionJobRecord } from "../postgresPrivacyRepository";

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

const deletionJob: PrivacyDeletionJobRecord = {
  id: "privacy_delete_original_photos_001",
  userId: "user_demo_001",
  scope: "original_photos",
  targetId: "pet_miso_001",
  status: "queued",
  requestedAt: "2026-06-24T09:00:00.000Z"
};

const deletionJobRow = (job: PrivacyDeletionJobRecord) => ({
  id: job.id,
  user_id: job.userId,
  scope: job.scope,
  target_id: job.targetId ?? null,
  status: job.status,
  requested_at: job.requestedAt,
  completed_at: job.completedAt ?? null,
  failure_code: job.failureCode ?? null,
  failure_message_safe: job.failureMessageSafe ?? null
});

describe("Postgres privacy repository", () => {
  it("enqueues, finds, and lists deletion jobs for a user", async () => {
    const client = new QueueDatabaseClient([
      [deletionJobRow(deletionJob)],
      [deletionJobRow(deletionJob)],
      [deletionJobRow(deletionJob)]
    ]);
    const repository = createPostgresPrivacyRepository(client);

    await expect(
      repository.enqueueDeletionJob({
        id: deletionJob.id,
        userId: deletionJob.userId,
        scope: deletionJob.scope,
        ...(deletionJob.targetId ? { targetId: deletionJob.targetId } : {}),
        requestedAt: deletionJob.requestedAt
      })
    ).resolves.toEqual(deletionJob);
    await expect(repository.findDeletionJob(deletionJob.id)).resolves.toEqual(deletionJob);
    await expect(repository.listDeletionJobsForUser(deletionJob.userId, 10)).resolves.toEqual([deletionJob]);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.privacy_deletion_jobs");
    expect(client.queries[0]?.sql).not.toContain(deletionJob.id);
    expect(client.queries[0]?.params).toEqual([
      deletionJob.id,
      deletionJob.userId,
      deletionJob.scope,
      deletionJob.targetId,
      deletionJob.requestedAt
    ]);
    expect(client.queries[2]?.sql).toContain("ORDER BY requested_at DESC");
    expect(client.queries[2]?.params).toEqual([deletionJob.userId, 10]);
  });

  it("claims the next queued deletion job without exposing another worker to the same row", async () => {
    const processingJob: PrivacyDeletionJobRecord = {
      ...deletionJob,
      status: "processing"
    };
    const client = new QueueDatabaseClient([[deletionJobRow(processingJob)]]);
    const repository = createPostgresPrivacyRepository(client);

    await expect(repository.claimNextQueuedDeletionJob()).resolves.toEqual(processingJob);

    expect(client.queries[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(client.queries[0]?.sql).toContain("status = 'processing'");
    expect(client.queries[0]?.params).toBeUndefined();
  });

  it("marks deletion jobs completed", async () => {
    const completedJob: PrivacyDeletionJobRecord = {
      ...deletionJob,
      status: "completed",
      completedAt: "2026-06-24T09:05:00.000Z"
    };
    const client = new QueueDatabaseClient([[deletionJobRow(completedJob)]]);
    const repository = createPostgresPrivacyRepository(client);

    await expect(repository.markDeletionJobCompleted(deletionJob.id, completedJob.completedAt!)).resolves.toEqual(completedJob);

    expect(client.queries[0]?.sql).toContain("status = 'completed'");
    expect(client.queries[0]?.params).toEqual([deletionJob.id, completedJob.completedAt]);
  });

  it("marks deletion jobs failed with safe failure metadata", async () => {
    const failedJob: PrivacyDeletionJobRecord = {
      ...deletionJob,
      status: "failed",
      failureCode: "storage_delete_failed",
      failureMessageSafe: "Private storage deletion is queued for retry."
    };
    const client = new QueueDatabaseClient([[deletionJobRow(failedJob)]]);
    const repository = createPostgresPrivacyRepository(client);

    await expect(
      repository.markDeletionJobFailed({
        id: deletionJob.id,
        failureCode: failedJob.failureCode!,
        failureMessageSafe: failedJob.failureMessageSafe!
      })
    ).resolves.toEqual(failedJob);

    expect(client.queries[0]?.sql).toContain("status = 'failed'");
    expect(client.queries[0]?.sql).not.toContain(failedJob.failureMessageSafe!);
    expect(client.queries[0]?.params).toEqual([deletionJob.id, failedJob.failureCode, failedJob.failureMessageSafe]);
  });

  it("retries failed deletion jobs by returning them to queued state", async () => {
    const retryAt = "2026-06-24T09:10:00.000Z";
    const retriedJob: PrivacyDeletionJobRecord = {
      ...deletionJob,
      requestedAt: retryAt
    };
    const client = new QueueDatabaseClient([[deletionJobRow(retriedJob)]]);
    const repository = createPostgresPrivacyRepository(client);

    await expect(repository.retryFailedDeletionJob(deletionJob.id, retryAt)).resolves.toEqual(retriedJob);

    expect(client.queries[0]?.sql).toContain("WHERE id = $1 AND status = 'failed'");
    expect(client.queries[0]?.params).toEqual([deletionJob.id, retryAt]);
  });
});
