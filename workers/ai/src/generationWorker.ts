import type {
  GeneratedAsset,
  GeneratedAssetState,
  GenerationJob,
  GenerationJobId,
  GenerationJobStatus,
  GenerationProvider,
  GenerationQualityMetadata,
  ISODateTime,
  PhotoId,
  SourcePhotoContentType,
  UserId
} from "@mongchi/shared";
import { generatedAssetStates } from "@mongchi/shared";

import { firstPassAssetStates } from "./pipeline";
import { validateSourcePhotoIntakeWithPixelDecode } from "./photoIntake";
import { evaluateGenerationQualityGate } from "./qualityGate";
import type { GenerationQualityThresholds, ProviderGenerationQualitySignals } from "./qualityGate";
import { createLocalSourcePhotoSafetyChecker } from "./sourcePhotoSafety";
import type { SourcePhotoSafetyChecker } from "./sourcePhotoSafety";

export interface WorkerOriginalPhotoRecord {
  id: PhotoId;
  userId: UserId;
  petId: string;
  contentType: SourcePhotoContentType;
  byteSize: number;
  status: string;
  storageUri?: string;
  uploadUrl?: string;
}

export interface GenerationWorkerRepositories {
  generation: {
    claimNextGenerationJob: (input: { claimedAt: ISODateTime; provider?: GenerationProvider }) => Promise<GenerationJob | null>;
    updateGenerationJobStatus: (input: {
      jobId: GenerationJobId;
      status: GenerationJobStatus;
      updatedAt: ISODateTime;
    }) => Promise<GenerationJob | null>;
    findOwnedOriginalPhoto: (userId: UserId, photoId: PhotoId) => Promise<WorkerOriginalPhotoRecord | null>;
    upsertGeneratedAsset: (input: { asset: GeneratedAsset }) => Promise<GeneratedAsset>;
    upsertGenerationJob: (input: { job: GenerationJob }) => Promise<GenerationJob>;
  };
}

export interface OriginalPhotoReadResult {
  bytes: Uint8Array;
  declaredContentType?: SourcePhotoContentType;
}

export interface OriginalPhotoReader {
  readOriginalPhoto: (input: { photo: WorkerOriginalPhotoRecord; storageUri: string }) => Promise<OriginalPhotoReadResult>;
}

export interface PreparedSourcePhoto {
  photoId: PhotoId;
  storageUri: string;
  contentType: SourcePhotoContentType;
  byteSize: number;
  width: number;
  height: number;
  providerSafeBytes: Uint8Array;
  metadataRemoved: boolean;
  warnings: string[];
}

export interface ProviderGeneratedAsset {
  id?: string;
  state: GeneratedAssetState;
  bytes: Uint8Array;
  width: number;
  height: number;
  contentHash: string;
  mimeType: GeneratedAsset["mimeType"];
  transparentBackground: boolean;
  version?: number;
}

export interface ProviderGenerationResult {
  provider: GenerationProvider;
  costUnits: number;
  assets: ProviderGeneratedAsset[];
  qualitySignals: ProviderGenerationQualitySignals;
}

export interface GenerationProviderAdapter {
  provider: GenerationProvider;
  generate: (input: {
    job: GenerationJob;
    sourcePhotos: PreparedSourcePhoto[];
    requiredAssetStates: readonly GeneratedAssetState[];
  }) => Promise<ProviderGenerationResult>;
}

export interface GeneratedAssetStorageWriteResult {
  uri: string;
  thumbnailUri?: string;
  contentHash?: string;
}

export interface GeneratedAssetStorageWriter {
  writeGeneratedAsset: (input: {
    job: GenerationJob;
    asset: ProviderGeneratedAsset;
    contentType: GeneratedAsset["mimeType"];
  }) => Promise<GeneratedAssetStorageWriteResult>;
}

export type RunNextGenerationJobResult =
  | {
      status: "idle";
      claimedJob: null;
    }
  | {
      status: "completed";
      job: GenerationJob;
      assets: GeneratedAsset[];
    }
  | {
      status: "failed";
      job: GenerationJob;
      failureCode: string;
      failureMessageSafe: string;
    };

export interface RunNextGenerationJobInput {
  repositories: GenerationWorkerRepositories;
  sourcePhotoReader: OriginalPhotoReader;
  provider: GenerationProviderAdapter;
  generatedAssetStorage: GeneratedAssetStorageWriter;
  sourcePhotoSafetyChecker?: SourcePhotoSafetyChecker;
  now?: () => ISODateTime;
  requiredAssetStates?: readonly GeneratedAssetState[];
  qualityGate?: GenerationQualityThresholds;
}

const defaultNow = (): ISODateTime => new Date().toISOString();
const contentHashPattern = /^(sha256:)?[a-f0-9]{32,128}$/i;
const generatedAssetIdPattern = /^[A-Za-z0-9_-]{3,160}$/;
const minGeneratedAssetSidePx = 128;
const maxGeneratedAssetSidePx = 2048;
const supportedGeneratedAssetStates = new Set<GeneratedAssetState>(generatedAssetStates);
const supportedGeneratedAssetMimeTypes = new Set<GeneratedAsset["mimeType"]>(["image/png", "image/webp"]);
const statusProgression: GenerationJobStatus[] = [
  "validating",
  "preprocessing",
  "safety_checking",
  "generating",
  "postprocessing",
  "quality_checking",
  "uploading_assets"
];

const makeGeneratedAssetId = (jobId: GenerationJobId, state: GeneratedAssetState): string =>
  `asset_${jobId}_${state}`.replace(/[^A-Za-z0-9_-]/g, "_");

const normalizeGeneratedAssetId = (jobId: GenerationJobId, state: GeneratedAssetState, id?: string): string => {
  const trimmed = id?.trim();

  if (!trimmed) {
    return makeGeneratedAssetId(jobId, state);
  }

  if (!generatedAssetIdPattern.test(trimmed)) {
    throw new Error("Provider generated asset id is invalid.");
  }

  return trimmed;
};

const normalizeGeneratedAssetHash = (value?: string): string => {
  const trimmed = value?.trim() ?? "";

  if (!contentHashPattern.test(trimmed)) {
    throw new Error("Provider generated asset hash is invalid.");
  }

  const digest = trimmed.replace(/^sha256:/i, "").toLowerCase();

  return `sha256:${digest}`;
};

const normalizeGeneratedAssetDimensions = (asset: ProviderGeneratedAsset): { width: number; height: number } => {
  if (
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height) ||
    asset.width < minGeneratedAssetSidePx ||
    asset.height < minGeneratedAssetSidePx ||
    asset.width > maxGeneratedAssetSidePx ||
    asset.height > maxGeneratedAssetSidePx
  ) {
    throw new Error("Provider generated asset dimensions are invalid.");
  }

  return {
    width: asset.width,
    height: asset.height
  };
};

const normalizeGeneratedAssetMimeType = (mimeType: GeneratedAsset["mimeType"]): GeneratedAsset["mimeType"] => {
  if (!supportedGeneratedAssetMimeTypes.has(mimeType)) {
    throw new Error("Provider generated asset mime type is invalid.");
  }

  return mimeType;
};

const normalizeGeneratedAssetState = (state: GeneratedAssetState): GeneratedAssetState => {
  if (!supportedGeneratedAssetStates.has(state)) {
    throw new Error("Provider generated asset state is invalid.");
  }

  return state;
};

const normalizeGeneratedAssetVersion = (version?: number): number => {
  const normalized = version ?? 1;

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error("Provider generated asset version is invalid.");
  }

  return normalized;
};

const normalizeGeneratedAssetStorageUri = (uri?: string): string => {
  const trimmed = uri?.trim() ?? "";

  if (!/^s3:\/\/[A-Za-z0-9][A-Za-z0-9._-]*\/.+/.test(trimmed) || /[\u0000-\u001f\s]/.test(trimmed)) {
    throw new Error("Generated asset storage URI is invalid.");
  }

  return trimmed;
};

const markStatus = async (
  repositories: GenerationWorkerRepositories,
  jobId: GenerationJobId,
  status: GenerationJobStatus,
  updatedAt: ISODateTime
): Promise<void> => {
  await repositories.generation.updateGenerationJobStatus({
    jobId,
    status,
    updatedAt
  });
};

const failJob = async (
  repositories: GenerationWorkerRepositories,
  job: GenerationJob,
  input: {
    failedAt: ISODateTime;
    failureCode: string;
    failureMessageSafe: string;
    retryable?: boolean;
    failedChecks?: string[];
    quality?: GenerationQualityMetadata;
  }
): Promise<RunNextGenerationJobResult> => {
  const { failure: _failure, completedAt: _completedAt, expiresAt: _expiresAt, ...baseJob } = job;
  const quality = input.quality ?? {
    qualityStatus: "failed",
    failedChecks: input.failedChecks ?? [input.failureCode],
    manualReviewRequired: false,
    retryRecommended: input.retryable ?? true
  };
  const failedJob: GenerationJob = {
    ...baseJob,
    status: "failed",
    quality,
    failure: {
      failureCode: input.failureCode,
      failureMessageSafe: input.failureMessageSafe,
      retryable: input.retryable ?? quality.retryRecommended,
      refundCreditRequired: false
    },
    updatedAt: input.failedAt
  };
  const persistedJob = await repositories.generation.upsertGenerationJob({ job: failedJob });

  return {
    status: "failed",
    job: persistedJob,
    failureCode: input.failureCode,
    failureMessageSafe: input.failureMessageSafe
  };
};

const normalizeStorageUri = (photo: WorkerOriginalPhotoRecord): string | null => photo.storageUri ?? photo.uploadUrl ?? null;

const loadSourcePhotos = async (
  input: RunNextGenerationJobInput,
  job: GenerationJob
): Promise<
  | {
      ok: true;
      photos: PreparedSourcePhoto[];
    }
  | {
      ok: false;
      failureCode: string;
      failureMessageSafe: string;
      failedChecks: string[];
    }
> => {
  const photos: PreparedSourcePhoto[] = [];

  for (const photoId of job.sourcePhotoIds) {
    const photo = await input.repositories.generation.findOwnedOriginalPhoto(job.userId, photoId);

    if (!photo || photo.status !== "uploaded") {
      return {
        ok: false,
        failureCode: "source_photo_unavailable",
        failureMessageSafe: "Source photo is not available for generation.",
        failedChecks: ["source_photo_unavailable"]
      };
    }

    const storageUri = normalizeStorageUri(photo);

    if (!storageUri) {
      return {
        ok: false,
        failureCode: "source_photo_storage_missing",
        failureMessageSafe: "Source photo storage metadata is missing.",
        failedChecks: ["source_photo_storage_missing"]
      };
    }

    const read = await input.sourcePhotoReader.readOriginalPhoto({
      photo,
      storageUri
    });
    const intake = await validateSourcePhotoIntakeWithPixelDecode({
      declaredContentType: read.declaredContentType ?? photo.contentType,
      bytes: read.bytes
    });

    if (!intake.ok) {
      return {
        ok: false,
        failureCode: `source_photo_${intake.issue}`,
        failureMessageSafe: intake.messageSafe,
        failedChecks: [intake.issue]
      };
    }

    photos.push({
      photoId,
      storageUri,
      contentType: intake.contentType,
      byteSize: intake.byteSize,
      width: intake.width,
      height: intake.height,
      providerSafeBytes: intake.providerSafeBytes,
      metadataRemoved: intake.metadataRemoved,
      warnings: intake.warnings
    });
  }

  if (photos.length === 0) {
    return {
      ok: false,
      failureCode: "source_photo_required",
      failureMessageSafe: "At least one source photo is required for generation.",
      failedChecks: ["source_photo_required"]
    };
  }

  return {
    ok: true,
    photos
  };
};

const normalizeProviderAsset = async (
  input: RunNextGenerationJobInput,
  job: GenerationJob,
  asset: ProviderGeneratedAsset,
  createdAt: ISODateTime
): Promise<GeneratedAsset> => {
  const state = normalizeGeneratedAssetState(asset.state);
  const { width, height } = normalizeGeneratedAssetDimensions(asset);
  const mimeType = normalizeGeneratedAssetMimeType(asset.mimeType);
  const providerContentHash = normalizeGeneratedAssetHash(asset.contentHash);
  const version = normalizeGeneratedAssetVersion(asset.version);

  const stored = await input.generatedAssetStorage.writeGeneratedAsset({
    job,
    asset: {
      ...asset,
      state,
      width,
      height,
      contentHash: providerContentHash,
      mimeType,
      version
    },
    contentType: mimeType
  });
  const storedContentHash = stored.contentHash ? normalizeGeneratedAssetHash(stored.contentHash) : providerContentHash;

  return {
    id: normalizeGeneratedAssetId(job.id, state, asset.id),
    petId: job.petId,
    generationJobId: job.id,
    state,
    uri: normalizeGeneratedAssetStorageUri(stored.uri),
    ...(stored.thumbnailUri ? { thumbnailUri: normalizeGeneratedAssetStorageUri(stored.thumbnailUri) } : {}),
    width,
    height,
    contentHash: storedContentHash,
    mimeType,
    storageClass: "private_app_asset",
    version,
    qualityStatus: "passed",
    createdAt,
    updatedAt: createdAt
  };
};

export const runNextGenerationJob = async (input: RunNextGenerationJobInput): Promise<RunNextGenerationJobResult> => {
  const now = input.now ?? defaultNow;
  const claimedAt = now();
  const claimedJob = await input.repositories.generation.claimNextGenerationJob({
    claimedAt,
    provider: input.provider.provider
  });

  if (!claimedJob) {
    return {
      status: "idle",
      claimedJob: null
    };
  }

  try {
    await markStatus(input.repositories, claimedJob.id, statusProgression[0] ?? "validating", now());

    const loadedPhotos = await loadSourcePhotos(input, claimedJob);

    if (!loadedPhotos.ok) {
      return failJob(input.repositories, claimedJob, {
        failedAt: now(),
        failureCode: loadedPhotos.failureCode,
        failureMessageSafe: loadedPhotos.failureMessageSafe,
        failedChecks: loadedPhotos.failedChecks
      });
    }

    await markStatus(input.repositories, claimedJob.id, "preprocessing", now());
    await markStatus(input.repositories, claimedJob.id, "safety_checking", now());

    const sourcePhotoSafetyChecker = input.sourcePhotoSafetyChecker ?? createLocalSourcePhotoSafetyChecker();
    const safetyCheck = await sourcePhotoSafetyChecker.checkSourcePhotos({
      job: claimedJob,
      sourcePhotos: loadedPhotos.photos
    });

    if (!safetyCheck.ok) {
      return failJob(input.repositories, claimedJob, {
        failedAt: now(),
        failureCode: safetyCheck.failureCode,
        failureMessageSafe: safetyCheck.failureMessageSafe,
        retryable: safetyCheck.retryable,
        failedChecks: safetyCheck.quality.failedChecks,
        quality: safetyCheck.quality
      });
    }

    await markStatus(input.repositories, claimedJob.id, "generating", now());

    const requiredAssetStates = input.requiredAssetStates ?? firstPassAssetStates;
    const providerResult = await input.provider.generate({
      job: claimedJob,
      sourcePhotos: loadedPhotos.photos,
      requiredAssetStates
    });

    await markStatus(input.repositories, claimedJob.id, "postprocessing", now());
    await markStatus(input.repositories, claimedJob.id, "quality_checking", now());

    const qualityGate = evaluateGenerationQualityGate({
      inputSnapshot: claimedJob.inputSnapshot,
      requiredAssetStates,
      signals: providerResult.qualitySignals,
      ...(input.qualityGate ? input.qualityGate : {})
    });

    if (!qualityGate.ok) {
      return failJob(input.repositories, claimedJob, {
        failedAt: now(),
        failureCode: qualityGate.failureCode,
        failureMessageSafe: qualityGate.failureMessageSafe,
        retryable: qualityGate.quality.retryRecommended,
        failedChecks: qualityGate.quality.failedChecks,
        quality: qualityGate.quality
      });
    }

    await markStatus(input.repositories, claimedJob.id, "uploading_assets", now());

    const completedAt = now();
    const assets: GeneratedAsset[] = [];

    for (const asset of providerResult.assets) {
      const normalizedAsset = await normalizeProviderAsset(input, claimedJob, asset, completedAt);
      assets.push(await input.repositories.generation.upsertGeneratedAsset({ asset: normalizedAsset }));
    }

    const { failure: _failure, completedAt: _completedAt, expiresAt: _expiresAt, ...baseJob } = claimedJob;
    const completedJob: GenerationJob = {
      ...baseJob,
      provider: providerResult.provider,
      costUnits: providerResult.costUnits,
      status: "completed",
      quality: qualityGate.quality,
      completedAt,
      updatedAt: completedAt
    };
    const persistedJob = await input.repositories.generation.upsertGenerationJob({ job: completedJob });

    return {
      status: "completed",
      job: persistedJob,
      assets
    };
  } catch {
    return failJob(input.repositories, claimedJob, {
      failedAt: now(),
      failureCode: "generation_worker_failed",
      failureMessageSafe: "Generation worker could not complete this pet. Try again.",
      failedChecks: ["generation_worker_failed"]
    });
  }
};
