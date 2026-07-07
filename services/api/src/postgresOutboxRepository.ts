import { randomUUID } from "node:crypto";

import type { ISODateTime } from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import { sanitizeOperationalMetadata } from "./operationalLogger";
import type { PrivacyDeletionAuditSink } from "./privacyDeletionWorker";

export type ApiOutboxEventStatus = "pending" | "processing" | "processed" | "failed";

export interface ApiOutboxEventRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: ApiOutboxEventStatus;
  createdAt: ISODateTime;
  processedAt?: ISODateTime;
  failureCode?: string;
}

export interface EnqueueApiOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ApiOutboxRepository {
  enqueueEvent: (input: EnqueueApiOutboxEventInput) => Promise<ApiOutboxEventRecord>;
  claimNextPendingEvent: () => Promise<ApiOutboxEventRecord | null>;
  markEventProcessed: (id: string, processedAt: ISODateTime) => Promise<ApiOutboxEventRecord | null>;
  markEventFailed: (id: string, failureCode: string, processedAt: ISODateTime) => Promise<ApiOutboxEventRecord | null>;
}

export interface CreatePostgresOutboxRepositoryOptions {
  now?: () => ISODateTime;
  createId?: () => string;
}

interface ApiOutboxEventRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
  status: ApiOutboxEventStatus;
  created_at: ISODateTime;
  processed_at: ISODateTime | null;
  failure_code: string | null;
}

const apiOutboxEventSelectColumns = `
id,
aggregate_type,
aggregate_id,
event_type,
payload,
status,
created_at,
processed_at,
failure_code
`;

const createApiOutboxEventId = (): string => `outbox_${randomUUID().replace(/-/g, "")}`;

const normalizePayload = (payload: unknown): Record<string, unknown> => {
  let parsed = payload;

  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch {
      parsed = {};
    }
  }

  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
};

const mapOutboxEventRow = (row: ApiOutboxEventRow): ApiOutboxEventRecord => ({
  id: row.id,
  aggregateType: row.aggregate_type,
  aggregateId: row.aggregate_id,
  eventType: row.event_type,
  payload: normalizePayload(row.payload),
  status: row.status,
  createdAt: row.created_at,
  ...(row.processed_at ? { processedAt: row.processed_at } : {}),
  ...(row.failure_code ? { failureCode: row.failure_code } : {})
});

export const createPostgresOutboxRepository = (
  client: ApiDatabaseMigrationClient,
  { now = () => new Date().toISOString(), createId = createApiOutboxEventId }: CreatePostgresOutboxRepositoryOptions = {}
): ApiOutboxRepository => ({
  enqueueEvent: async (input) => {
    const result = await client.query<ApiOutboxEventRow>(
      `
INSERT INTO public.api_outbox_events (
  id,
  aggregate_type,
  aggregate_id,
  event_type,
  payload,
  status,
  created_at
)
VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', $6)
RETURNING ${apiOutboxEventSelectColumns}
`,
      [
        createId(),
        input.aggregateType,
        input.aggregateId,
        input.eventType,
        JSON.stringify(sanitizeOperationalMetadata(input.payload)),
        now()
      ]
    );
    const event = result.rows[0];

    if (!event) {
      throw new Error("Failed to enqueue API outbox event.");
    }

    return mapOutboxEventRow(event);
  },

  claimNextPendingEvent: async () => {
    const result = await client.query<ApiOutboxEventRow>(
      `
UPDATE public.api_outbox_events
SET status = 'processing',
    failure_code = NULL
WHERE id = (
  SELECT id
  FROM public.api_outbox_events
  WHERE status IN ('pending', 'failed')
  ORDER BY created_at ASC, id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING ${apiOutboxEventSelectColumns}
`
    );
    const event = result.rows[0];

    return event ? mapOutboxEventRow(event) : null;
  },

  markEventProcessed: async (id, processedAt) => {
    const result = await client.query<ApiOutboxEventRow>(
      `
UPDATE public.api_outbox_events
SET status = 'processed',
    processed_at = $2,
    failure_code = NULL
WHERE id = $1
RETURNING ${apiOutboxEventSelectColumns}
`,
      [id, processedAt]
    );
    const event = result.rows[0];

    return event ? mapOutboxEventRow(event) : null;
  },

  markEventFailed: async (id, failureCode, processedAt) => {
    const result = await client.query<ApiOutboxEventRow>(
      `
UPDATE public.api_outbox_events
SET status = 'failed',
    processed_at = $3,
    failure_code = $2
WHERE id = $1
RETURNING ${apiOutboxEventSelectColumns}
`,
      [id, failureCode, processedAt]
    );
    const event = result.rows[0];

    return event ? mapOutboxEventRow(event) : null;
  }
});

export const createPrivacyDeletionOutboxAuditSink = (outbox: ApiOutboxRepository): PrivacyDeletionAuditSink => ({
  recordPrivacyDeletionAuditEvent: async ({ job, status, recordedAt }) => {
    await outbox.enqueueEvent({
      aggregateType: "privacy_deletion_job",
      aggregateId: job.id,
      eventType: status === "completed" ? "privacy_deletion.completed" : "privacy_deletion.failed",
      payload: {
        jobId: job.id,
        userId: job.userId,
        scope: job.scope,
        status,
        requestedAt: job.requestedAt,
        recordedAt,
        ...(job.targetId ? { targetId: job.targetId } : {}),
        ...(job.completedAt ? { completedAt: job.completedAt } : {}),
        ...(job.failureCode ? { failureCode: job.failureCode } : {})
      }
    });
  }
});
