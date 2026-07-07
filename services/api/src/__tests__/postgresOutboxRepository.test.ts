import { describe, expect, it } from "vitest";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresOutboxRepository, createPrivacyDeletionOutboxAuditSink } from "../postgresOutboxRepository";
import type { PrivacyDeletionJobRecord } from "../postgresPrivacyRepository";

type QueuedRows = unknown[] | ((sql: string, params?: readonly unknown[]) => unknown[]);

class QueueDatabaseClient implements ApiDatabaseMigrationClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  private readonly queuedRows: QueuedRows[];

  constructor(queuedRows: QueuedRows[]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });
    const rows = this.queuedRows.shift();

    return {
      rows: (typeof rows === "function" ? rows(sql, params) : rows ?? []) as Row[]
    };
  }
}

const rowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  aggregate_type: params?.[1],
  aggregate_id: params?.[2],
  event_type: params?.[3],
  payload: params?.[4],
  status: "pending",
  created_at: params?.[5],
  processed_at: null,
  failure_code: null
});

const privacyJob: PrivacyDeletionJobRecord = {
  id: "privacy_job_001",
  userId: "user_demo_001",
  scope: "original_photos",
  targetId: "pet_miso_001",
  status: "completed",
  requestedAt: "2026-06-24T09:00:00.000Z",
  completedAt: "2026-06-24T09:05:00.000Z"
};

describe("Postgres outbox repository", () => {
  it("enqueues sanitized pending events", async () => {
    const client = new QueueDatabaseClient([(_sql, params) => [rowFromParams(params)]]);
    const repository = createPostgresOutboxRepository(client, {
      now: () => "2026-06-24T09:10:00.000Z",
      createId: () => "outbox_test_001"
    });

    await expect(
      repository.enqueueEvent({
        aggregateType: "privacy_deletion_job",
        aggregateId: "privacy_job_001",
        eventType: "privacy_deletion.failed",
        payload: {
          jobId: "privacy_job_001",
          signedUrl: "https://storage.example.test/private?X-Amz-Signature=raw",
          messageText: "raw user text",
          failureCode: "storage_deletion_request_failed"
        }
      })
    ).resolves.toEqual({
      id: "outbox_test_001",
      aggregateType: "privacy_deletion_job",
      aggregateId: "privacy_job_001",
      eventType: "privacy_deletion.failed",
      payload: {
        jobId: "privacy_job_001",
        signedUrl: "[redacted]",
        messageText: "[redacted]",
        failureCode: "storage_deletion_request_failed"
      },
      status: "pending",
      createdAt: "2026-06-24T09:10:00.000Z"
    });
    expect(client.queries[0]?.sql).toContain("INSERT INTO public.api_outbox_events");
    expect(client.queries[0]?.params).toEqual([
      "outbox_test_001",
      "privacy_deletion_job",
      "privacy_job_001",
      "privacy_deletion.failed",
      JSON.stringify({
        jobId: "privacy_job_001",
        signedUrl: "[redacted]",
        messageText: "[redacted]",
        failureCode: "storage_deletion_request_failed"
      }),
      "2026-06-24T09:10:00.000Z"
    ]);
    expect(JSON.stringify(client.queries[0]?.params)).not.toContain("X-Amz-Signature");
    expect(JSON.stringify(client.queries[0]?.params)).not.toContain("raw user text");
  });

  it("claims and marks outbox events for deployed sinks", async () => {
    const client = new QueueDatabaseClient([
      [
        {
          id: "outbox_claim_001",
          aggregate_type: "privacy_deletion_job",
          aggregate_id: "privacy_job_001",
          event_type: "privacy_deletion.completed",
          payload: { jobId: "privacy_job_001" },
          status: "processing",
          created_at: "2026-06-24T09:10:00.000Z",
          processed_at: null,
          failure_code: null
        }
      ],
      [
        {
          id: "outbox_claim_001",
          aggregate_type: "privacy_deletion_job",
          aggregate_id: "privacy_job_001",
          event_type: "privacy_deletion.completed",
          payload: { jobId: "privacy_job_001" },
          status: "processed",
          created_at: "2026-06-24T09:10:00.000Z",
          processed_at: "2026-06-24T09:11:00.000Z",
          failure_code: null
        }
      ]
    ]);
    const repository = createPostgresOutboxRepository(client);

    await expect(repository.claimNextPendingEvent()).resolves.toMatchObject({
      id: "outbox_claim_001",
      status: "processing"
    });
    await expect(repository.markEventProcessed("outbox_claim_001", "2026-06-24T09:11:00.000Z")).resolves.toMatchObject({
      id: "outbox_claim_001",
      status: "processed",
      processedAt: "2026-06-24T09:11:00.000Z"
    });
    expect(client.queries[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(client.queries[1]?.sql).toContain("status = 'processed'");
  });

  it("falls back to an empty payload when persisted payload JSON is invalid", async () => {
    const client = new QueueDatabaseClient([
      [
        {
          id: "outbox_claim_002",
          aggregate_type: "privacy_deletion_job",
          aggregate_id: "privacy_job_001",
          event_type: "privacy_deletion.completed",
          payload: "{invalid-json",
          status: "processing",
          created_at: "2026-06-24T09:10:00.000Z",
          processed_at: null,
          failure_code: null
        }
      ]
    ]);
    const repository = createPostgresOutboxRepository(client);

    await expect(repository.claimNextPendingEvent()).resolves.toMatchObject({
      id: "outbox_claim_002",
      payload: {}
    });
  });

  it("adapts privacy deletion audit events onto the outbox", async () => {
    const calls: Array<{ aggregateType: string; aggregateId: string; eventType: string; payload: Record<string, unknown> }> = [];
    const auditSink = createPrivacyDeletionOutboxAuditSink({
      enqueueEvent: async (input) => {
        calls.push(input);

        return {
          id: "outbox_privacy_001",
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          eventType: input.eventType,
          payload: input.payload,
          status: "pending",
          createdAt: "2026-06-24T09:10:00.000Z"
        };
      },
      claimNextPendingEvent: async () => null,
      markEventProcessed: async () => null,
      markEventFailed: async () => null
    });

    await auditSink.recordPrivacyDeletionAuditEvent({
      job: privacyJob,
      status: "completed",
      recordedAt: "2026-06-24T09:05:00.000Z"
    });

    expect(calls).toEqual([
      {
        aggregateType: "privacy_deletion_job",
        aggregateId: "privacy_job_001",
        eventType: "privacy_deletion.completed",
        payload: {
          jobId: "privacy_job_001",
          userId: "user_demo_001",
          scope: "original_photos",
          status: "completed",
          requestedAt: "2026-06-24T09:00:00.000Z",
          recordedAt: "2026-06-24T09:05:00.000Z",
          targetId: "pet_miso_001",
          completedAt: "2026-06-24T09:05:00.000Z"
        }
      }
    ]);
  });
});
