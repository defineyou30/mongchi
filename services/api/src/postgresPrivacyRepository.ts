import type { ISODateTime, UserId } from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";

export type PrivacyDeletionScope = "original_photos" | "chat_history" | "pet";
export type PrivacyDeletionJobStatus = "queued" | "processing" | "completed" | "failed";

export interface PrivacyDeletionJobRecord {
  id: string;
  userId: UserId;
  scope: PrivacyDeletionScope;
  targetId?: string;
  status: PrivacyDeletionJobStatus;
  requestedAt: ISODateTime;
  completedAt?: ISODateTime;
  failureCode?: string;
  failureMessageSafe?: string;
}

export interface EnqueuePrivacyDeletionJobInput {
  id: string;
  userId: UserId;
  scope: PrivacyDeletionScope;
  targetId?: string;
  requestedAt: ISODateTime;
}

export interface FailPrivacyDeletionJobInput {
  id: string;
  failureCode: string;
  failureMessageSafe: string;
}

interface PrivacyDeletionJobRow {
  id: string;
  user_id: string;
  scope: PrivacyDeletionScope;
  target_id: string | null;
  status: PrivacyDeletionJobStatus;
  requested_at: Date | string;
  completed_at: Date | string | null;
  failure_code: string | null;
  failure_message_safe: string | null;
}

const toIso = (value: Date | string): ISODateTime => (value instanceof Date ? value.toISOString() : value);
const nullableIso = (value: Date | string | null): ISODateTime | undefined => (value ? toIso(value) : undefined);

const mapPrivacyDeletionJobRow = (row: PrivacyDeletionJobRow): PrivacyDeletionJobRecord => {
  const completedAt = nullableIso(row.completed_at);

  return {
    id: row.id,
    userId: row.user_id,
    scope: row.scope,
    ...(row.target_id ? { targetId: row.target_id } : {}),
    status: row.status,
    requestedAt: toIso(row.requested_at),
    ...(completedAt ? { completedAt } : {}),
    ...(row.failure_code ? { failureCode: row.failure_code } : {}),
    ...(row.failure_message_safe ? { failureMessageSafe: row.failure_message_safe } : {})
  };
};

const privacyDeletionJobSelectColumns = `
  id,
  user_id,
  scope,
  target_id,
  status,
  requested_at,
  completed_at,
  failure_code,
  failure_message_safe
`;

export const createPostgresPrivacyRepository = (client: ApiDatabaseMigrationClient) => ({
  enqueueDeletionJob: async (input: EnqueuePrivacyDeletionJobInput): Promise<PrivacyDeletionJobRecord> => {
    const result = await client.query<PrivacyDeletionJobRow>(
      `
INSERT INTO public.privacy_deletion_jobs (
  id,
  user_id,
  scope,
  target_id,
  status,
  requested_at,
  completed_at,
  failure_code,
  failure_message_safe
)
VALUES ($1, $2, $3, $4, 'queued', $5, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET scope = EXCLUDED.scope,
    target_id = EXCLUDED.target_id,
    status = EXCLUDED.status,
    requested_at = EXCLUDED.requested_at,
    completed_at = NULL,
    failure_code = NULL,
    failure_message_safe = NULL
RETURNING ${privacyDeletionJobSelectColumns}
`,
      [input.id, input.userId, input.scope, input.targetId ?? null, input.requestedAt]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to enqueue privacy deletion job.");
    }

    return mapPrivacyDeletionJobRow(row);
  },

  findDeletionJob: async (jobId: string): Promise<PrivacyDeletionJobRecord | null> => {
    const result = await client.query<PrivacyDeletionJobRow>(
      `
SELECT ${privacyDeletionJobSelectColumns}
FROM public.privacy_deletion_jobs
WHERE id = $1
`,
      [jobId]
    );

    return result.rows[0] ? mapPrivacyDeletionJobRow(result.rows[0]) : null;
  },

  listDeletionJobsForUser: async (userId: UserId, limit: number = 25): Promise<PrivacyDeletionJobRecord[]> => {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const result = await client.query<PrivacyDeletionJobRow>(
      `
SELECT ${privacyDeletionJobSelectColumns}
FROM public.privacy_deletion_jobs
WHERE user_id = $1
ORDER BY requested_at DESC, id DESC
LIMIT $2
`,
      [userId, safeLimit]
    );

    return result.rows.map(mapPrivacyDeletionJobRow);
  },

  claimNextQueuedDeletionJob: async (): Promise<PrivacyDeletionJobRecord | null> => {
    const result = await client.query<PrivacyDeletionJobRow>(
      `
UPDATE public.privacy_deletion_jobs
SET status = 'processing',
    failure_code = NULL,
    failure_message_safe = NULL
WHERE id = (
  SELECT id
  FROM public.privacy_deletion_jobs
  WHERE status = 'queued'
  ORDER BY requested_at ASC, id ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING ${privacyDeletionJobSelectColumns}
`
    );

    return result.rows[0] ? mapPrivacyDeletionJobRow(result.rows[0]) : null;
  },

  markDeletionJobCompleted: async (
    jobId: string,
    completedAt: ISODateTime
  ): Promise<PrivacyDeletionJobRecord | null> => {
    const result = await client.query<PrivacyDeletionJobRow>(
      `
UPDATE public.privacy_deletion_jobs
SET status = 'completed',
    completed_at = $2,
    failure_code = NULL,
    failure_message_safe = NULL
WHERE id = $1
RETURNING ${privacyDeletionJobSelectColumns}
`,
      [jobId, completedAt]
    );

    return result.rows[0] ? mapPrivacyDeletionJobRow(result.rows[0]) : null;
  },

  markDeletionJobFailed: async (input: FailPrivacyDeletionJobInput): Promise<PrivacyDeletionJobRecord | null> => {
    const result = await client.query<PrivacyDeletionJobRow>(
      `
UPDATE public.privacy_deletion_jobs
SET status = 'failed',
    completed_at = NULL,
    failure_code = $2,
    failure_message_safe = $3
WHERE id = $1
RETURNING ${privacyDeletionJobSelectColumns}
`,
      [input.id, input.failureCode, input.failureMessageSafe]
    );

    return result.rows[0] ? mapPrivacyDeletionJobRow(result.rows[0]) : null;
  },

  retryFailedDeletionJob: async (jobId: string, requestedAt: ISODateTime): Promise<PrivacyDeletionJobRecord | null> => {
    const result = await client.query<PrivacyDeletionJobRow>(
      `
UPDATE public.privacy_deletion_jobs
SET status = 'queued',
    requested_at = $2,
    completed_at = NULL,
    failure_code = NULL,
    failure_message_safe = NULL
WHERE id = $1 AND status = 'failed'
RETURNING ${privacyDeletionJobSelectColumns}
`,
      [jobId, requestedAt]
    );

    return result.rows[0] ? mapPrivacyDeletionJobRow(result.rows[0]) : null;
  }
});
