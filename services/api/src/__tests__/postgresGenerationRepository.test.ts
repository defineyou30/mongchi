import { describe, expect, it } from "vitest";

import type { GeneratedAsset, GenerationJob } from "@mongchi/shared";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresGenerationRepository } from "../postgresGenerationRepository";
import type { OriginalPhotoRecord } from "../service";

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

const photo: OriginalPhotoRecord = {
  id: "photo_nori_001",
  userId: "user_demo_001",
  petId: "pet_nori_001",
  contentType: "image/jpeg",
  byteSize: 4096,
  status: "upload_url_issued",
  uploadUrl: "s3://tiny-pet-source/user_demo_001/pet_nori_001/photo_nori_001",
  storageUri: "s3://tiny-pet-source/user_demo_001/pet_nori_001/photo_nori_001",
  expiresAt: "2026-06-24T09:15:00.000Z",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const uploadedPhoto: OriginalPhotoRecord = {
  ...photo,
  status: "uploaded",
  contentHash: `sha256:${"a".repeat(64)}`,
  uploadedAt: "2026-06-24T09:01:00.000Z",
  updatedAt: "2026-06-24T09:01:00.000Z"
};

const photoRow = (currentPhoto: OriginalPhotoRecord) => ({
  id: currentPhoto.id,
  user_id: currentPhoto.userId,
  pet_id: currentPhoto.petId,
  content_type: currentPhoto.contentType,
  byte_size: currentPhoto.byteSize,
  status: currentPhoto.status,
  storage_uri: currentPhoto.storageUri ?? currentPhoto.uploadUrl,
  expires_at: currentPhoto.expiresAt,
  content_hash: currentPhoto.contentHash ?? null,
  uploaded_at: currentPhoto.uploadedAt ?? null,
  deleted_at: currentPhoto.deletedAt ?? null,
  created_at: currentPhoto.createdAt,
  updated_at: currentPhoto.updatedAt
});

const generationJob: GenerationJob = {
  id: "gen_nori_001",
  userId: "user_demo_001",
  petId: "pet_nori_001",
  sourcePhotoIds: [photo.id],
  optionalPhotoIds: [],
  status: "completed",
  inputSnapshot: {
    species: "dog",
    petName: "Nori",
    personalityTags: ["curious"],
    talkingStyle: "gentle",
    favoriteThing: "moss pillows"
  },
  provider: "mock",
  costUnits: 0,
  quality: {
    qualityStatus: "passed",
    qualityScore: 0.94,
    failedChecks: [],
    manualReviewRequired: false,
    retryRecommended: false
  },
  completedAt: "2026-06-24T09:03:00.000Z",
  createdAt: "2026-06-24T09:01:00.000Z",
  updatedAt: "2026-06-24T09:03:00.000Z"
};

const generationJobRow = (job: GenerationJob) => ({
  id: job.id,
  user_id: job.userId,
  pet_id: job.petId,
  source_photo_ids: JSON.stringify(job.sourcePhotoIds),
  optional_photo_ids: job.optionalPhotoIds,
  status: job.status,
  input_snapshot: JSON.stringify(job.inputSnapshot),
  provider: job.provider,
  cost_units: job.costUnits,
  quality: job.quality,
  failure: job.failure ? JSON.stringify(job.failure) : null,
  completed_at: job.completedAt ?? null,
  expires_at: job.expiresAt ?? null,
  created_at: job.createdAt,
  updated_at: job.updatedAt
});

const asset: GeneratedAsset = {
  id: "asset_nori_idle_001",
  petId: generationJob.petId,
  generationJobId: generationJob.id,
  state: "idle",
  uri: "s3://tiny-pet-assets/user_demo_001/pet_nori_001/asset_nori_idle_001.png",
  thumbnailUri: "s3://tiny-pet-assets/user_demo_001/pet_nori_001/asset_nori_idle_001_thumb.png",
  width: 256,
  height: 256,
  contentHash: `sha256:${"b".repeat(64)}`,
  mimeType: "image/png",
  storageClass: "private_app_asset",
  version: 1,
  qualityStatus: "passed",
  createdAt: "2026-06-24T09:03:00.000Z",
  updatedAt: "2026-06-24T09:03:00.000Z"
};

const assetRow = (currentAsset: GeneratedAsset) => ({
  id: currentAsset.id,
  pet_id: currentAsset.petId,
  generation_job_id: currentAsset.generationJobId,
  state: currentAsset.state,
  storage_uri: currentAsset.uri,
  thumbnail_uri: currentAsset.thumbnailUri ?? null,
  width: currentAsset.width,
  height: currentAsset.height,
  content_hash: currentAsset.contentHash,
  mime_type: currentAsset.mimeType,
  storage_class: currentAsset.storageClass,
  version: currentAsset.version,
  quality_status: currentAsset.qualityStatus,
  created_at: currentAsset.createdAt,
  updated_at: currentAsset.updatedAt
});

describe("Postgres generation repository", () => {
  it("upserts, reads, uploads, and deletes original photo metadata", async () => {
    const deletedPhoto: OriginalPhotoRecord = {
      ...uploadedPhoto,
      status: "deleted",
      deletedAt: "2026-06-24T09:04:00.000Z",
      updatedAt: "2026-06-24T09:04:00.000Z"
    };
    const client = new QueueDatabaseClient([[photoRow(photo)], [photoRow(photo)], [photoRow(uploadedPhoto)], [photoRow(deletedPhoto)]]);
    const repository = createPostgresGenerationRepository(client);

    await expect(repository.upsertOriginalPhoto({ photo })).resolves.toEqual(photo);
    await expect(repository.findOwnedOriginalPhoto(photo.userId, photo.id)).resolves.toEqual(photo);
    await expect(
      repository.markOriginalPhotoUploaded({
        userId: photo.userId,
        photoId: photo.id,
        contentHash: uploadedPhoto.contentHash!,
        uploadedAt: uploadedPhoto.uploadedAt!
      })
    ).resolves.toEqual(uploadedPhoto);
    await expect(
      repository.markOriginalPhotosDeletedForPet({
        userId: photo.userId,
        petId: photo.petId,
        deletedAt: deletedPhoto.deletedAt!
      })
    ).resolves.toEqual([deletedPhoto]);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.original_photos");
    expect(client.queries[0]?.sql).not.toContain(photo.uploadUrl);
    expect(client.queries[0]?.params).toEqual([
      photo.id,
      photo.userId,
      photo.petId,
      photo.contentType,
      photo.byteSize,
      photo.status,
      photo.uploadUrl,
      photo.expiresAt,
      null,
      null,
      null,
      photo.createdAt,
      photo.updatedAt
    ]);
    expect(client.queries[2]?.sql).toContain("status = 'uploaded'");
    expect(client.queries[3]?.sql).toContain("status = 'deleted'");
  });

  it("upserts and reads generation jobs with JSONB fields", async () => {
    const client = new QueueDatabaseClient([[generationJobRow(generationJob)], [generationJobRow(generationJob)], [generationJobRow(generationJob)]]);
    const repository = createPostgresGenerationRepository(client);

    await expect(repository.upsertGenerationJob({ job: generationJob })).resolves.toEqual(generationJob);
    await expect(repository.findOwnedGenerationJob(generationJob.userId, generationJob.id)).resolves.toEqual(generationJob);
    await expect(repository.listGenerationJobsForPet(generationJob.userId, generationJob.petId)).resolves.toEqual([generationJob]);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.generation_jobs");
    expect(client.queries[0]?.sql).not.toContain(generationJob.id);
    expect(client.queries[0]?.params).toEqual([
      generationJob.id,
      generationJob.userId,
      generationJob.petId,
      JSON.stringify(generationJob.sourcePhotoIds),
      JSON.stringify(generationJob.optionalPhotoIds),
      generationJob.status,
      JSON.stringify(generationJob.inputSnapshot),
      generationJob.provider,
      generationJob.costUnits,
      JSON.stringify(generationJob.quality),
      null,
      generationJob.completedAt,
      null,
      generationJob.createdAt,
      generationJob.updatedAt
    ]);
    expect(client.queries[2]?.sql).toContain("ORDER BY created_at DESC");
  });

  it("claims the next unclaimed generation job and updates active worker status", async () => {
    const { completedAt: _completedAt, ...activeGenerationJob } = generationJob;
    const claimedJob: GenerationJob = {
      ...activeGenerationJob,
      status: "claimed",
      provider: "openai",
      updatedAt: "2026-06-24T09:04:00.000Z"
    };
    const validatingJob: GenerationJob = {
      ...claimedJob,
      status: "validating",
      updatedAt: "2026-06-24T09:05:00.000Z"
    };
    const client = new QueueDatabaseClient([[generationJobRow(claimedJob)], [generationJobRow(validatingJob)]]);
    const repository = createPostgresGenerationRepository(client);

    await expect(
      repository.claimNextGenerationJob({
        claimedAt: claimedJob.updatedAt,
        provider: "openai"
      })
    ).resolves.toEqual(claimedJob);
    await expect(
      repository.updateGenerationJobStatus({
        jobId: generationJob.id,
        status: "validating",
        updatedAt: validatingJob.updatedAt
      })
    ).resolves.toEqual(validatingJob);

    expect(client.queries[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(client.queries[0]?.sql).toContain("status IN ('created', 'queued')");
    expect(client.queries[0]?.sql).toContain("status = 'claimed'");
    expect(client.queries[0]?.params).toEqual([claimedJob.updatedAt, "openai"]);
    expect(client.queries[1]?.sql).toContain("status NOT IN ('completed', 'failed', 'cancelled', 'expired')");
    expect(client.queries[1]?.params).toEqual([generationJob.id, "validating", validatingJob.updatedAt]);
  });

  it("upserts and reads generated assets through pet ownership", async () => {
    const client = new QueueDatabaseClient([[assetRow(asset)], [assetRow(asset)], [assetRow(asset)]]);
    const repository = createPostgresGenerationRepository(client);

    await expect(repository.upsertGeneratedAsset({ asset })).resolves.toEqual(asset);
    await expect(repository.listGeneratedAssetsForPet(generationJob.userId, asset.petId)).resolves.toEqual([asset]);
    await expect(repository.findOwnedGeneratedAsset(generationJob.userId, asset.id)).resolves.toEqual(asset);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.generated_assets");
    expect(client.queries[0]?.params).toEqual([
      asset.id,
      asset.petId,
      asset.generationJobId,
      asset.state,
      asset.uri,
      asset.thumbnailUri,
      asset.width,
      asset.height,
      asset.contentHash,
      asset.mimeType,
      asset.storageClass,
      asset.version,
      asset.qualityStatus,
      asset.createdAt,
      asset.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("JOIN public.pets p ON p.id = ga.pet_id");
    expect(client.queries[2]?.sql).toContain("ga.id = $2");
  });

  it("inserts category-only generation issue reports", async () => {
    const client = new QueueDatabaseClient([
      [
        {
          id: "gen_issue_001",
          pet_id: generationJob.petId,
          generation_job_id: generationJob.id,
          category: "poor_quality",
          reported_at: "2026-06-24T09:06:00.000Z"
        }
      ]
    ]);
    const repository = createPostgresGenerationRepository(client);

    await expect(
      repository.insertGenerationIssueReport({
        reportId: "gen_issue_001",
        userId: generationJob.userId,
        petId: generationJob.petId,
        generationJobId: generationJob.id,
        category: "poor_quality",
        reportedAt: "2026-06-24T09:06:00.000Z"
      })
    ).resolves.toEqual({
      reportId: "gen_issue_001",
      petId: generationJob.petId,
      generationJobId: generationJob.id,
      category: "poor_quality",
      reportedAt: "2026-06-24T09:06:00.000Z"
    });

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.generation_issue_reports");
    expect(client.queries[0]?.params).toEqual([
      "gen_issue_001",
      generationJob.userId,
      generationJob.petId,
      generationJob.id,
      "poor_quality",
      "2026-06-24T09:06:00.000Z"
    ]);
    expect(JSON.stringify(client.queries[0]?.params)).not.toMatch(/photo|image|message|prompt/i);
  });
});
