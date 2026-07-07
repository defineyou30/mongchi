import type {
  GeneratedAsset,
  GeneratedAssetId,
  GeneratedAssetState,
  GenerationIssueCategory,
  GenerationFailure,
  GenerationJob,
  GenerationJobId,
  GenerationJobInputSnapshot,
  GenerationJobStatus,
  GenerationProvider,
  GenerationQualityMetadata,
  GenerationQualityStatus,
  ISODateTime,
  PetId,
  PhotoId,
  SourcePhotoContentType,
  UserId
} from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { GenerationIssueReportResponse } from "./contracts";
import type { OriginalPhotoRecord, OriginalPhotoStatus } from "./service";

interface OriginalPhotoRow {
  id: string;
  user_id: string;
  pet_id: string;
  content_type: SourcePhotoContentType;
  byte_size: number;
  status: OriginalPhotoStatus;
  storage_uri: string;
  expires_at: Date | string;
  content_hash: string | null;
  uploaded_at: Date | string | null;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface GenerationJobRow {
  id: string;
  user_id: string;
  pet_id: string;
  source_photo_ids: unknown;
  optional_photo_ids: unknown;
  status: GenerationJobStatus;
  input_snapshot: unknown;
  provider: GenerationProvider;
  cost_units: number;
  quality: unknown;
  failure: unknown | null;
  completed_at: Date | string | null;
  expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface GeneratedAssetRow {
  id: string;
  pet_id: string;
  generation_job_id: string;
  state: GeneratedAssetState;
  storage_uri: string;
  thumbnail_uri: string | null;
  width: number;
  height: number;
  content_hash: string;
  mime_type: "image/png" | "image/webp";
  storage_class: GeneratedAsset["storageClass"];
  version: number;
  quality_status: GenerationQualityStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

interface GenerationIssueReportRow {
  id: string;
  pet_id: string;
  generation_job_id: string | null;
  category: GenerationIssueCategory;
  reported_at: Date | string;
}

export interface UpsertOriginalPhotoInput {
  photo: OriginalPhotoRecord;
}

export interface MarkOriginalPhotoUploadedInput {
  photoId: PhotoId;
  userId: UserId;
  contentHash: string;
  uploadedAt: ISODateTime;
}

export interface MarkOriginalPhotosDeletedInput {
  userId: UserId;
  petId: PetId;
  deletedAt: ISODateTime;
}

export interface UpsertGenerationJobInput {
  job: GenerationJob;
}

export interface ClaimNextGenerationJobInput {
  claimedAt: ISODateTime;
  provider?: GenerationProvider;
}

export interface UpdateGenerationJobStatusInput {
  jobId: GenerationJobId;
  status: GenerationJobStatus;
  updatedAt: ISODateTime;
}

export interface UpsertGeneratedAssetInput {
  asset: GeneratedAsset;
}

export interface InsertGenerationIssueReportInput {
  reportId: string;
  userId: UserId;
  petId: PetId;
  generationJobId?: GenerationJobId;
  category: GenerationIssueCategory;
  reportedAt: ISODateTime;
}

const toIso = (value: Date | string): ISODateTime => (value instanceof Date ? value.toISOString() : value);
const nullableIso = (value: Date | string | null): ISODateTime | undefined => (value ? toIso(value) : undefined);

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
};

const mapOriginalPhotoRow = (row: OriginalPhotoRow): OriginalPhotoRecord => {
  const uploadedAt = nullableIso(row.uploaded_at);
  const deletedAt = nullableIso(row.deleted_at);

  return {
    id: row.id,
    userId: row.user_id,
    petId: row.pet_id,
    contentType: row.content_type,
    byteSize: row.byte_size,
    status: row.status,
    uploadUrl: row.storage_uri,
    storageUri: row.storage_uri,
    expiresAt: toIso(row.expires_at),
    ...(row.content_hash ? { contentHash: row.content_hash } : {}),
    ...(uploadedAt ? { uploadedAt } : {}),
    ...(deletedAt ? { deletedAt } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

const mapGenerationJobRow = (row: GenerationJobRow): GenerationJob => {
  const failure = parseJson<GenerationFailure | null>(row.failure, null);
  const completedAt = nullableIso(row.completed_at);
  const expiresAt = nullableIso(row.expires_at);

  return {
    id: row.id as GenerationJobId,
    userId: row.user_id,
    petId: row.pet_id,
    sourcePhotoIds: parseJson<PhotoId[]>(row.source_photo_ids, []),
    optionalPhotoIds: parseJson<PhotoId[]>(row.optional_photo_ids, []),
    status: row.status,
    inputSnapshot: parseJson<GenerationJobInputSnapshot>(row.input_snapshot, {
      species: "dog",
      petName: "",
      personalityTags: [],
      talkingStyle: "gentle"
    }),
    provider: row.provider,
    costUnits: row.cost_units,
    quality: parseJson<GenerationQualityMetadata>(row.quality, {
      qualityStatus: "pending",
      failedChecks: [],
      manualReviewRequired: false,
      retryRecommended: false
    }),
    ...(failure ? { failure } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

const mapGeneratedAssetRow = (row: GeneratedAssetRow): GeneratedAsset => ({
  id: row.id as GeneratedAssetId,
  petId: row.pet_id,
  generationJobId: row.generation_job_id as GenerationJobId,
  state: row.state,
  uri: row.storage_uri,
  ...(row.thumbnail_uri ? { thumbnailUri: row.thumbnail_uri } : {}),
  width: row.width,
  height: row.height,
  contentHash: row.content_hash,
  mimeType: row.mime_type,
  storageClass: row.storage_class,
  version: row.version,
  qualityStatus: row.quality_status,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const mapGenerationIssueReportRow = (row: GenerationIssueReportRow): GenerationIssueReportResponse => ({
  reportId: row.id,
  petId: row.pet_id,
  ...(row.generation_job_id ? { generationJobId: row.generation_job_id as GenerationJobId } : {}),
  category: row.category,
  reportedAt: toIso(row.reported_at)
});

const originalPhotoSelectColumns = `
  id,
  user_id,
  pet_id,
  content_type,
  byte_size,
  status,
  storage_uri,
  expires_at,
  content_hash,
  uploaded_at,
  deleted_at,
  created_at,
  updated_at
`;

const generationJobSelectColumns = `
  id,
  user_id,
  pet_id,
  source_photo_ids,
  optional_photo_ids,
  status,
  input_snapshot,
  provider,
  cost_units,
  quality,
  failure,
  completed_at,
  expires_at,
  created_at,
  updated_at
`;

const generatedAssetSelectColumns = `
  id,
  pet_id,
  generation_job_id,
  state,
  storage_uri,
  thumbnail_uri,
  width,
  height,
  content_hash,
  mime_type,
  storage_class,
  version,
  quality_status,
  created_at,
  updated_at
`;

export const createPostgresGenerationRepository = (client: ApiDatabaseMigrationClient) => ({
  upsertOriginalPhoto: async ({ photo }: UpsertOriginalPhotoInput): Promise<OriginalPhotoRecord> => {
    const result = await client.query<OriginalPhotoRow>(
      `
INSERT INTO public.original_photos (
  id,
  user_id,
  pet_id,
  content_type,
  byte_size,
  status,
  storage_uri,
  expires_at,
  content_hash,
  uploaded_at,
  deleted_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    storage_uri = EXCLUDED.storage_uri,
    content_hash = EXCLUDED.content_hash,
    uploaded_at = EXCLUDED.uploaded_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = EXCLUDED.updated_at
RETURNING ${originalPhotoSelectColumns}
`,
      [
        photo.id,
        photo.userId,
        photo.petId,
        photo.contentType,
        photo.byteSize,
        photo.status,
        photo.storageUri ?? photo.uploadUrl,
        photo.expiresAt,
        photo.contentHash ?? null,
        photo.uploadedAt ?? null,
        photo.deletedAt ?? null,
        photo.createdAt,
        photo.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert original photo.");
    }

    return mapOriginalPhotoRow(row);
  },

  findOwnedOriginalPhoto: async (userId: UserId, photoId: PhotoId): Promise<OriginalPhotoRecord | null> => {
    const result = await client.query<OriginalPhotoRow>(
      `
SELECT ${originalPhotoSelectColumns}
FROM public.original_photos
WHERE id = $2 AND user_id = $1 AND status <> 'deleted'
`,
      [userId, photoId]
    );

    return result.rows[0] ? mapOriginalPhotoRow(result.rows[0]) : null;
  },

  markOriginalPhotoUploaded: async (input: MarkOriginalPhotoUploadedInput): Promise<OriginalPhotoRecord | null> => {
    const result = await client.query<OriginalPhotoRow>(
      `
UPDATE public.original_photos
SET status = 'uploaded',
    content_hash = $3,
    uploaded_at = $4,
    updated_at = $4
WHERE id = $2 AND user_id = $1 AND status = 'upload_url_issued'
RETURNING ${originalPhotoSelectColumns}
`,
      [input.userId, input.photoId, input.contentHash, input.uploadedAt]
    );

    return result.rows[0] ? mapOriginalPhotoRow(result.rows[0]) : null;
  },

  markOriginalPhotosDeletedForPet: async (input: MarkOriginalPhotosDeletedInput): Promise<OriginalPhotoRecord[]> => {
    const result = await client.query<OriginalPhotoRow>(
      `
UPDATE public.original_photos
SET status = 'deleted',
    deleted_at = $3,
    updated_at = $3
WHERE user_id = $1 AND pet_id = $2 AND status <> 'deleted'
RETURNING ${originalPhotoSelectColumns}
`,
      [input.userId, input.petId, input.deletedAt]
    );

    return result.rows.map(mapOriginalPhotoRow);
  },

  upsertGenerationJob: async ({ job }: UpsertGenerationJobInput): Promise<GenerationJob> => {
    const result = await client.query<GenerationJobRow>(
      `
INSERT INTO public.generation_jobs (
  id,
  user_id,
  pet_id,
  source_photo_ids,
  optional_photo_ids,
  status,
  input_snapshot,
  provider,
  cost_units,
  quality,
  failure,
  completed_at,
  expires_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15)
ON CONFLICT (id) DO UPDATE
SET source_photo_ids = EXCLUDED.source_photo_ids,
    optional_photo_ids = EXCLUDED.optional_photo_ids,
    status = EXCLUDED.status,
    input_snapshot = EXCLUDED.input_snapshot,
    provider = EXCLUDED.provider,
    cost_units = EXCLUDED.cost_units,
    quality = EXCLUDED.quality,
    failure = EXCLUDED.failure,
    completed_at = EXCLUDED.completed_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at
RETURNING ${generationJobSelectColumns}
`,
      [
        job.id,
        job.userId,
        job.petId,
        JSON.stringify(job.sourcePhotoIds),
        JSON.stringify(job.optionalPhotoIds),
        job.status,
        JSON.stringify(job.inputSnapshot),
        job.provider,
        job.costUnits,
        JSON.stringify(job.quality),
        job.failure ? JSON.stringify(job.failure) : null,
        job.completedAt ?? null,
        job.expiresAt ?? null,
        job.createdAt,
        job.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert generation job.");
    }

    return mapGenerationJobRow(row);
  },

  findOwnedGenerationJob: async (userId: UserId, jobId: GenerationJobId): Promise<GenerationJob | null> => {
    const result = await client.query<GenerationJobRow>(
      `
SELECT ${generationJobSelectColumns}
FROM public.generation_jobs
WHERE id = $2 AND user_id = $1
`,
      [userId, jobId]
    );

    return result.rows[0] ? mapGenerationJobRow(result.rows[0]) : null;
  },

  listGenerationJobsForPet: async (userId: UserId, petId: PetId): Promise<GenerationJob[]> => {
    const result = await client.query<GenerationJobRow>(
      `
SELECT ${generationJobSelectColumns}
FROM public.generation_jobs
WHERE user_id = $1 AND pet_id = $2
ORDER BY created_at DESC, id DESC
`,
      [userId, petId]
    );

    return result.rows.map(mapGenerationJobRow);
  },

  claimNextGenerationJob: async (input: ClaimNextGenerationJobInput): Promise<GenerationJob | null> => {
    const result = await client.query<GenerationJobRow>(
      `
UPDATE public.generation_jobs
SET status = 'claimed',
    provider = COALESCE($2, provider),
    updated_at = $1
WHERE id = (
  SELECT id
  FROM public.generation_jobs
  WHERE status IN ('created', 'queued')
  ORDER BY created_at ASC, id ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING ${generationJobSelectColumns}
`,
      [input.claimedAt, input.provider ?? null]
    );

    return result.rows[0] ? mapGenerationJobRow(result.rows[0]) : null;
  },

  updateGenerationJobStatus: async (input: UpdateGenerationJobStatusInput): Promise<GenerationJob | null> => {
    const result = await client.query<GenerationJobRow>(
      `
UPDATE public.generation_jobs
SET status = $2,
    updated_at = $3
WHERE id = $1
  AND status NOT IN ('completed', 'failed', 'cancelled', 'expired')
RETURNING ${generationJobSelectColumns}
`,
      [input.jobId, input.status, input.updatedAt]
    );

    return result.rows[0] ? mapGenerationJobRow(result.rows[0]) : null;
  },

  upsertGeneratedAsset: async ({ asset }: UpsertGeneratedAssetInput): Promise<GeneratedAsset> => {
    const result = await client.query<GeneratedAssetRow>(
      `
INSERT INTO public.generated_assets (
  id,
  pet_id,
  generation_job_id,
  state,
  storage_uri,
  thumbnail_uri,
  width,
  height,
  content_hash,
  mime_type,
  storage_class,
  version,
  quality_status,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT (id) DO UPDATE
SET state = EXCLUDED.state,
    storage_uri = EXCLUDED.storage_uri,
    thumbnail_uri = EXCLUDED.thumbnail_uri,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    content_hash = EXCLUDED.content_hash,
    mime_type = EXCLUDED.mime_type,
    storage_class = EXCLUDED.storage_class,
    version = EXCLUDED.version,
    quality_status = EXCLUDED.quality_status,
    updated_at = EXCLUDED.updated_at
RETURNING ${generatedAssetSelectColumns}
`,
      [
        asset.id,
        asset.petId,
        asset.generationJobId,
        asset.state,
        asset.uri,
        asset.thumbnailUri ?? null,
        asset.width,
        asset.height,
        asset.contentHash,
        asset.mimeType,
        asset.storageClass,
        asset.version,
        asset.qualityStatus,
        asset.createdAt,
        asset.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert generated asset.");
    }

    return mapGeneratedAssetRow(row);
  },

  listGeneratedAssetsForPet: async (userId: UserId, petId: PetId): Promise<GeneratedAsset[]> => {
    const result = await client.query<GeneratedAssetRow>(
      `
SELECT ga.${generatedAssetSelectColumns
        .trim()
        .split(",")
        .map((column) => column.trim())
        .join(", ga.")}
FROM public.generated_assets ga
JOIN public.pets p ON p.id = ga.pet_id
WHERE p.user_id = $1 AND ga.pet_id = $2 AND p.lifecycle_status <> 'deleted'
ORDER BY ga.created_at ASC, ga.id ASC
`,
      [userId, petId]
    );

    return result.rows.map(mapGeneratedAssetRow);
  },

  findOwnedGeneratedAsset: async (userId: UserId, assetId: GeneratedAssetId): Promise<GeneratedAsset | null> => {
    const result = await client.query<GeneratedAssetRow>(
      `
SELECT ga.${generatedAssetSelectColumns
        .trim()
        .split(",")
        .map((column) => column.trim())
        .join(", ga.")}
FROM public.generated_assets ga
JOIN public.pets p ON p.id = ga.pet_id
WHERE p.user_id = $1 AND ga.id = $2 AND p.lifecycle_status <> 'deleted'
`,
      [userId, assetId]
    );

    return result.rows[0] ? mapGeneratedAssetRow(result.rows[0]) : null;
  },

  insertGenerationIssueReport: async (
    input: InsertGenerationIssueReportInput
  ): Promise<GenerationIssueReportResponse> => {
    const result = await client.query<GenerationIssueReportRow>(
      `
INSERT INTO public.generation_issue_reports (
  id,
  user_id,
  pet_id,
  generation_job_id,
  category,
  reported_at
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, pet_id, generation_job_id, category, reported_at
`,
      [
        input.reportId,
        input.userId,
        input.petId,
        input.generationJobId ?? null,
        input.category,
        input.reportedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to insert generation issue report.");
    }

    return mapGenerationIssueReportRow(row);
  }
});
