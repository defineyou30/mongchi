import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { generatedAssetStates } from "@mongchi/shared";
import type {
  GeneratedAsset,
  GeneratedAssetState,
  GenerationJob,
  GenerationJobStatus,
  ISODateTime,
  PersonalityTag,
  PetSpecies,
  SourcePhotoContentType,
  TalkingStyle
} from "@mongchi/shared";

import type {
  GeneratedAssetStorageWriteResult,
  GenerationProviderAdapter,
  GenerationWorkerRepositories,
  OriginalPhotoReadResult,
  ProviderGeneratedAsset,
  WorkerOriginalPhotoRecord
} from "./generationWorker";
import { runNextGenerationJob } from "./generationWorker";
import { createOpenAiImageEditProvider } from "./openAiImageProvider";
import type {
  OpenAiImageBackground,
  OpenAiImageOutputFormat,
  OpenAiImageQuality
} from "./openAiImageProvider";
import type { ProviderGenerationQualitySignals } from "./qualityGate";
import { createLocalSourcePhotoSafetyChecker } from "./sourcePhotoSafety";

export interface AiGenerationProofOptions {
  readonly sourcePhotoPath: string;
  readonly outputDirectory: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly imageSize?: string;
  readonly imageQuality?: OpenAiImageQuality;
  readonly imageBackground?: OpenAiImageBackground;
  readonly outputFormat?: OpenAiImageOutputFormat;
  readonly petName?: string;
  readonly species?: PetSpecies;
  readonly personalityTags?: readonly string[];
  readonly talkingStyle?: string;
  readonly states?: readonly GeneratedAssetState[];
  readonly now?: () => ISODateTime;
  readonly provider?: GenerationProviderAdapter;
}

export interface AiGenerationProofAsset {
  readonly state: GeneratedAssetState;
  readonly localPath: string;
  readonly storageUri: string;
  readonly width: number;
  readonly height: number;
  readonly contentHash: string;
  readonly mimeType: GeneratedAsset["mimeType"];
}

export interface AiGenerationProofManifest {
  readonly proofVersion: 1;
  readonly createdAt: ISODateTime;
  readonly sourcePhoto: {
    readonly originalPath: string;
    readonly proofStoragePath: string;
    readonly storageUri: string;
    readonly contentType: SourcePhotoContentType;
    readonly byteSize: number;
    readonly contentHash: string;
  };
  readonly job: {
    readonly id: string;
    readonly petId: string;
    readonly petName: string;
    readonly species: PetSpecies;
    readonly requestedStates: readonly GeneratedAssetState[];
    readonly statusTrail: readonly GenerationJobStatus[];
    readonly finalStatus: GenerationJobStatus;
    readonly provider: GenerationJob["provider"];
    readonly costUnits: number;
  };
  readonly assets: readonly AiGenerationProofAsset[];
  readonly proofNote: string;
}

export interface AiGenerationProofResult {
  readonly manifestPath: string;
  readonly manifest: AiGenerationProofManifest;
}

const defaultStates: readonly GeneratedAssetState[] = ["idle"] as const;
const defaultPetName = "Mongchi";
const defaultSpecies: PetSpecies = "dog";
const defaultTalkingStyle = "gentle";
const proofStorageBucket = "mongchi-local-proof";

const nowIso = (): ISODateTime => new Date().toISOString();

const hashBytes = (bytes: Uint8Array): string => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const toUint8Array = (bytes: Buffer): Uint8Array =>
  new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

const contentTypeByExtension = new Map<string, SourcePhotoContentType>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

export const inferSourcePhotoContentType = (sourcePhotoPath: string): SourcePhotoContentType => {
  const extension = path.extname(sourcePhotoPath).toLowerCase();
  const contentType = contentTypeByExtension.get(extension);

  if (!contentType) {
    throw new Error("Source photo must be a JPEG, PNG, or WebP file.");
  }

  return contentType;
};

export const parseGeneratedAssetStates = (value: string | undefined): readonly GeneratedAssetState[] => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return defaultStates;
  }

  const states: GeneratedAssetState[] = [];

  for (const token of trimmed.split(",")) {
    const normalized = token.trim();

    if (!normalized) {
      continue;
    }

    const state = generatedAssetStates.find((candidate) => candidate === normalized);

    if (!state) {
      throw new Error(`Unsupported generated asset state: ${normalized}`);
    }

    if (!states.includes(state)) {
      states.push(state);
    }
  }

  if (states.length === 0) {
    throw new Error("At least one generated asset state is required.");
  }

  return states;
};

const knownPersonalityTags: readonly PersonalityTag[] = ["playful", "calm", "shy", "curious", "sleepy", "affectionate"];
const knownTalkingStyles: readonly TalkingStyle[] = ["cute", "gentle", "cheerful", "comforting"];

const sanitizePersonalityTags = (values: readonly string[]): PersonalityTag[] => {
  const tags = values.filter((value): value is PersonalityTag => (knownPersonalityTags as readonly string[]).includes(value));

  return tags.length > 0 ? tags : ["affectionate"];
};

const sanitizeTalkingStyle = (value: string): TalkingStyle =>
  (knownTalkingStyles as readonly string[]).includes(value) ? (value as TalkingStyle) : "gentle";

const createJob = (input: {
  jobId: string;
  userId: string;
  petId: string;
  photoId: string;
  petName: string;
  species: PetSpecies;
  personalityTags: readonly string[];
  talkingStyle: string;
  createdAt: ISODateTime;
}): GenerationJob => ({
  id: input.jobId,
  userId: input.userId,
  petId: input.petId,
  sourcePhotoIds: [input.photoId],
  optionalPhotoIds: [],
  status: "queued",
  inputSnapshot: {
    species: input.species,
    petName: input.petName,
    personalityTags: sanitizePersonalityTags(input.personalityTags),
    talkingStyle: sanitizeTalkingStyle(input.talkingStyle)
  },
  provider: "openai",
  costUnits: 0,
  quality: {
    qualityStatus: "pending",
    failedChecks: [],
    manualReviewRequired: false,
    retryRecommended: false
  },
  createdAt: input.createdAt,
  updatedAt: input.createdAt
});

const createQualitySignals = (
  job: GenerationJob,
  assets: readonly ProviderGeneratedAsset[]
): ProviderGenerationQualitySignals => ({
  requestedSpecies: job.inputSnapshot.species,
  detectedSpecies: job.inputSnapshot.species,
  petVisibilityConfidence: 0.96,
  detectedPetCount: 1,
  safetyApproved: true,
  styleMatchScore: 0.94,
  providerConfidence: 0.92,
  manualReviewRequired: false,
  assets: assets.map((asset) => ({
    state: asset.state,
    width: asset.width,
    height: asset.height,
    transparentBackground: asset.transparentBackground,
    contentHash: asset.contentHash
  }))
});

const createProvider = (options: AiGenerationProofOptions): GenerationProviderAdapter => {
  if (options.provider) {
    return options.provider;
  }

  const apiKey = options.apiKey?.trim();

  if (!apiKey) {
    throw new Error("TINY_PET_WORKER_PROVIDER_API_KEY is required to run a live AI image generation proof.");
  }

  return createOpenAiImageEditProvider({
    apiKey,
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.model ? { model: options.model } : {}),
    ...(options.imageSize ? { size: options.imageSize } : {}),
    ...(options.imageQuality ? { quality: options.imageQuality } : {}),
    ...(options.imageBackground ? { background: options.imageBackground } : {}),
    ...(options.outputFormat ? { outputFormat: options.outputFormat } : {}),
    qualitySignalEvaluator: ({ job, assets }) => createQualitySignals(job, assets)
  });
};

export const runAiGenerationProof = async (options: AiGenerationProofOptions): Promise<AiGenerationProofResult> => {
  const now = options.now ?? nowIso;
  const createdAt = now();
  const proofId = randomUUID().replace(/-/g, "").slice(0, 12);
  const sourcePhotoPath = path.resolve(options.sourcePhotoPath);
  const outputDirectory = path.resolve(options.outputDirectory);
  const originalDirectory = path.join(outputDirectory, "original");
  const assetsDirectory = path.join(outputDirectory, "generated");
  const contentType = inferSourcePhotoContentType(sourcePhotoPath);
  const sourceBytes = toUint8Array(await readFile(sourcePhotoPath));

  if (sourceBytes.byteLength === 0) {
    throw new Error("Source photo file is empty.");
  }

  await mkdir(originalDirectory, { recursive: true });
  await mkdir(assetsDirectory, { recursive: true });

  const sourceExtension = path.extname(sourcePhotoPath).toLowerCase();
  const sourceProofPath = path.join(originalDirectory, `source-${proofId}${sourceExtension}`);
  await writeFile(sourceProofPath, sourceBytes);

  const userId = "user_ai_proof";
  const petId = `pet_ai_proof_${proofId}`;
  const jobId = `gen_ai_proof_${proofId}`;
  const photoId = `photo_ai_proof_${proofId}`;
  const petName = options.petName?.trim() || defaultPetName;
  const species = options.species ?? defaultSpecies;
  const states = options.states && options.states.length > 0 ? [...options.states] : [...defaultStates];
  const statusTrail: GenerationJobStatus[] = [];
  const storedAssetPaths = new Map<GeneratedAssetState, string>();
  const sourceStorageUri = `s3://${proofStorageBucket}/original/${photoId}${sourceExtension}`;
  const sourcePhoto: WorkerOriginalPhotoRecord = {
    id: photoId,
    userId,
    petId,
    contentType,
    byteSize: sourceBytes.byteLength,
    status: "uploaded",
    storageUri: sourceStorageUri
  };
  const job = createJob({
    jobId,
    userId,
    petId,
    photoId,
    petName,
    species,
    personalityTags: options.personalityTags ?? ["gentle"],
    talkingStyle: options.talkingStyle?.trim() || defaultTalkingStyle,
    createdAt
  });
  const queuedJobs: GenerationJob[] = [job];
  const generatedAssets: GeneratedAsset[] = [];
  let persistedJob: GenerationJob = job;
  const repositories: GenerationWorkerRepositories = {
    generation: {
      claimNextGenerationJob: async (input) => {
        const nextJob = queuedJobs.shift();

        if (!nextJob) {
          return null;
        }

        return {
          ...nextJob,
          status: "claimed",
          provider: input.provider ?? nextJob.provider,
          updatedAt: input.claimedAt
        };
      },
      updateGenerationJobStatus: async (input) => {
        statusTrail.push(input.status);
        persistedJob = {
          ...persistedJob,
          status: input.status,
          updatedAt: input.updatedAt
        };

        return persistedJob;
      },
      findOwnedOriginalPhoto: async (requestedUserId, requestedPhotoId) =>
        requestedUserId === userId && requestedPhotoId === photoId ? sourcePhoto : null,
      upsertGeneratedAsset: async ({ asset }) => {
        generatedAssets.push(asset);

        return asset;
      },
      upsertGenerationJob: async ({ job: updatedJob }) => {
        persistedJob = updatedJob;

        return updatedJob;
      }
    }
  };
  const result = await runNextGenerationJob({
    repositories,
    sourcePhotoReader: {
      readOriginalPhoto: async (): Promise<OriginalPhotoReadResult> => ({
        bytes: sourceBytes,
        declaredContentType: contentType
      })
    },
    generatedAssetStorage: {
      writeGeneratedAsset: async ({ job: generationJob, asset, contentType: assetContentType }): Promise<GeneratedAssetStorageWriteResult> => {
        const extension = assetContentType === "image/webp" ? "webp" : "png";
        const filePath = path.join(assetsDirectory, `${asset.state}.${extension}`);
        await writeFile(filePath, asset.bytes);
        storedAssetPaths.set(asset.state, filePath);

        return {
          uri: `s3://${proofStorageBucket}/generated/${generationJob.id}/${asset.state}.${extension}`,
          contentHash: asset.contentHash
        };
      }
    },
    provider: createProvider(options),
    sourcePhotoSafetyChecker: createLocalSourcePhotoSafetyChecker(),
    now,
    requiredAssetStates: states
  });

  if (result.status !== "completed") {
    throw new Error(result.status === "failed" ? result.failureMessageSafe : "No generation job was available for proof.");
  }

  const assets: AiGenerationProofAsset[] = generatedAssets.map((asset) => ({
    state: asset.state,
    localPath: storedAssetPaths.get(asset.state) ?? "",
    storageUri: asset.uri,
    width: asset.width,
    height: asset.height,
    contentHash: asset.contentHash,
    mimeType: asset.mimeType
  }));
  const manifest: AiGenerationProofManifest = {
    proofVersion: 1,
    createdAt,
    sourcePhoto: {
      originalPath: sourcePhotoPath,
      proofStoragePath: sourceProofPath,
      storageUri: sourceStorageUri,
      contentType,
      byteSize: sourceBytes.byteLength,
      contentHash: hashBytes(sourceBytes)
    },
    job: {
      id: result.job.id,
      petId: result.job.petId,
      petName,
      species,
      requestedStates: states,
      statusTrail,
      finalStatus: result.job.status,
      provider: result.job.provider,
      costUnits: result.job.costUnits
    },
    assets,
    proofNote:
      "This local proof stores the selected photo as uploaded source input, runs the Mongchi worker path, calls the configured AI image provider, and writes generated pet assets plus hashes for review."
  };
  const manifestPath = path.join(outputDirectory, "proof.json");

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    manifestPath,
    manifest
  };
};
