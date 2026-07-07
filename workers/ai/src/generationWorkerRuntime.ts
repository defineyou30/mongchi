import type { ISODateTime } from "@mongchi/shared";

import type { GenerationWorkerRepositories, GenerationProviderAdapter } from "./generationWorker";
import { runGenerationWorkerBatch } from "./generationWorkerRunner";
import type { RunGenerationWorkerBatchResult } from "./generationWorkerRunner";
import { createOpenAiGenerationQualitySignalEvaluatorFromRuntimeConfig } from "./openAiGenerationQualityEvaluator";
import type { OpenAiGenerationQualityRuntimeOptions } from "./openAiGenerationQualityEvaluator";
import { createOpenAiImageEditProviderFromRuntimeConfig } from "./openAiImageProvider";
import type { OpenAiImageProviderRuntimeOptions } from "./openAiImageProvider";
import { createOpenAiSourcePhotoSafetyCheckerFromRuntimeConfig } from "./openAiSourcePhotoSafetyClassifier";
import type { OpenAiSourcePhotoSafetyRuntimeOptions } from "./openAiSourcePhotoSafetyClassifier";
import type { GenerationQualityThresholds } from "./qualityGate";
import { createS3GenerationWorkerStorage } from "./s3WorkerStorage";
import type { S3GenerationWorkerStorage, S3WorkerStorageFetch } from "./s3WorkerStorage";
import type { SourcePhotoSafetyChecker } from "./sourcePhotoSafety";
import type { WorkerRuntimeConfig } from "./workerRuntimeConfig";

export type OpenAiImageProviderRuntimeAdapterOptions = Omit<OpenAiImageProviderRuntimeOptions, "qualitySignalEvaluator">;

export interface CreateS3GenerationWorkerStorageFromRuntimeConfigOptions {
  fetch?: S3WorkerStorageFetch;
  now?: () => Date;
}

export interface CreateOpenAiGenerationRuntimeAdaptersOptions {
  image?: OpenAiImageProviderRuntimeAdapterOptions;
  quality?: OpenAiGenerationQualityRuntimeOptions;
  sourcePhotoSafety?: OpenAiSourcePhotoSafetyRuntimeOptions;
}

export interface OpenAiGenerationRuntimeAdapters {
  provider: GenerationProviderAdapter;
  sourcePhotoSafetyChecker: SourcePhotoSafetyChecker;
}

export interface GenerationWorkerBatchRuntimeDependencies {
  repositories: GenerationWorkerRepositories;
  provider: GenerationProviderAdapter;
  sourcePhotoSafetyChecker?: SourcePhotoSafetyChecker;
  storage?: S3GenerationWorkerStorage;
  fetch?: S3WorkerStorageFetch;
  now?: () => ISODateTime;
  storageNow?: () => Date;
  qualityGate?: GenerationQualityThresholds;
}

export interface OpenAiGenerationWorkerBatchRuntimeDependencies
  extends Omit<GenerationWorkerBatchRuntimeDependencies, "provider" | "sourcePhotoSafetyChecker"> {
  openAi?: CreateOpenAiGenerationRuntimeAdaptersOptions;
  provider?: GenerationProviderAdapter;
  sourcePhotoSafetyChecker?: SourcePhotoSafetyChecker;
}

export interface GenerationWorkerBatchRuntime {
  runOnce: (options?: { stopOnFailure?: boolean }) => Promise<RunGenerationWorkerBatchResult>;
}

export const createS3GenerationWorkerStorageFromRuntimeConfig = (
  config: WorkerRuntimeConfig,
  options: CreateS3GenerationWorkerStorageFromRuntimeConfigOptions = {}
): S3GenerationWorkerStorage => {
  if (!config.storage) {
    throw new Error("Worker private storage runtime config is missing.");
  }

  return createS3GenerationWorkerStorage({
    bucket: config.storage.bucket,
    region: config.storage.region,
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
    ...(config.storage.sessionToken ? { sessionToken: config.storage.sessionToken } : {}),
    ...(config.storage.endpoint ? { endpoint: config.storage.endpoint } : {}),
    forcePathStyle: config.storage.forcePathStyle,
    generatedAssetPrefix: config.storage.generatedAssetPrefix,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.now ? { now: options.now } : {})
  });
};

export const createOpenAiGenerationRuntimeAdaptersFromRuntimeConfig = (
  config: WorkerRuntimeConfig,
  options: CreateOpenAiGenerationRuntimeAdaptersOptions = {}
): OpenAiGenerationRuntimeAdapters => {
  const qualitySignalEvaluator = createOpenAiGenerationQualitySignalEvaluatorFromRuntimeConfig(config, options.quality ?? {});

  return {
    provider: createOpenAiImageEditProviderFromRuntimeConfig(config, {
      ...(options.image ?? {}),
      qualitySignalEvaluator
    }),
    sourcePhotoSafetyChecker: createOpenAiSourcePhotoSafetyCheckerFromRuntimeConfig(config, options.sourcePhotoSafety ?? {})
  };
};

export const createGenerationWorkerBatchRuntime = (
  config: WorkerRuntimeConfig,
  dependencies: GenerationWorkerBatchRuntimeDependencies
): GenerationWorkerBatchRuntime => {
  const storage =
    dependencies.storage ??
    createS3GenerationWorkerStorageFromRuntimeConfig(config, {
      ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
      ...(dependencies.storageNow ? { now: dependencies.storageNow } : {})
    });

  return {
    runOnce: (options = {}) =>
      runGenerationWorkerBatch({
        repositories: dependencies.repositories,
        sourcePhotoReader: storage,
        generatedAssetStorage: storage,
        provider: dependencies.provider,
        ...(dependencies.sourcePhotoSafetyChecker ? { sourcePhotoSafetyChecker: dependencies.sourcePhotoSafetyChecker } : {}),
        ...(dependencies.now ? { now: dependencies.now } : {}),
        qualityGate: dependencies.qualityGate ?? config.qualityGate,
        maxJobs: config.maxJobsPerRun,
        stopOnFailure: options.stopOnFailure ?? config.production
      })
  };
};

export const createOpenAiGenerationWorkerBatchRuntime = (
  config: WorkerRuntimeConfig,
  dependencies: OpenAiGenerationWorkerBatchRuntimeDependencies
): GenerationWorkerBatchRuntime => {
  const adapters =
    dependencies.provider && dependencies.sourcePhotoSafetyChecker
      ? null
      : createOpenAiGenerationRuntimeAdaptersFromRuntimeConfig(config, dependencies.openAi ?? {});
  const provider = dependencies.provider ?? adapters?.provider;
  const sourcePhotoSafetyChecker = dependencies.sourcePhotoSafetyChecker ?? adapters?.sourcePhotoSafetyChecker;

  if (!provider || !sourcePhotoSafetyChecker) {
    throw new Error("OpenAI generation worker runtime could not create provider adapters.");
  }

  return createGenerationWorkerBatchRuntime(config, {
    repositories: dependencies.repositories,
    provider,
    sourcePhotoSafetyChecker,
    ...(dependencies.storage ? { storage: dependencies.storage } : {}),
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
    ...(dependencies.storageNow ? { storageNow: dependencies.storageNow } : {}),
    ...(dependencies.qualityGate ? { qualityGate: dependencies.qualityGate } : {})
  });
};
