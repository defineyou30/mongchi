import type { GenerationProvider } from "@mongchi/shared";

import { defaultGenerationQualityThresholds } from "./qualityGate";
import type { GenerationQualityThresholds } from "./qualityGate";

export type WorkerReleaseProfile = "development" | "preview" | "production";
export type WorkerDatabaseSslMode = "disable" | "require" | "verify-full";

export interface WorkerRuntimeEnvironment {
  [key: string]: string | undefined;
}

declare const process:
  | {
      env: WorkerRuntimeEnvironment;
    }
  | undefined;

export interface WorkerPostgresRuntimeConfig {
  databaseUrl: string;
  sslMode: WorkerDatabaseSslMode;
  maxPoolSize: number;
  connectTimeoutMs: number;
}

export interface WorkerS3StorageRuntimeConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpoint?: string;
  forcePathStyle: boolean;
  generatedAssetPrefix: string;
}

export interface WorkerProviderRuntimeConfig {
  provider: Exclude<GenerationProvider, "mock">;
  apiKey: string;
  model?: string;
  safetyModel?: string;
}

export type WorkerGenerationQualityRuntimeConfig = Required<GenerationQualityThresholds>;

export interface WorkerRuntimeConfig {
  releaseProfile: WorkerReleaseProfile;
  production: boolean;
  database: WorkerPostgresRuntimeConfig | null;
  storage: WorkerS3StorageRuntimeConfig | null;
  provider: WorkerProviderRuntimeConfig | null;
  qualityGate: WorkerGenerationQualityRuntimeConfig;
  qualityCalibrationId?: string;
  maxJobsPerRun: number;
}

export type WorkerRuntimeConfigResult =
  | {
      ok: true;
      config: WorkerRuntimeConfig;
    }
  | {
      ok: false;
      errors: string[];
    };

const placeholderPattern = /^(todo|tbd|placeholder|replace-me|example|postgres:\/\/example|postgresql:\/\/example)/i;
const defaultSslMode: WorkerDatabaseSslMode = "require";
const defaultMaxPoolSize = 4;
const defaultConnectTimeoutMs = 5_000;
const defaultGeneratedAssetPrefix = "generated-assets";
const defaultMaxJobsPerRun = 1;

const getDefaultEnvironment = (): WorkerRuntimeEnvironment => (typeof process === "undefined" ? {} : process.env);

const readReleaseProfile = (value: string | undefined): WorkerReleaseProfile => {
  if (value === "production" || value === "preview") {
    return value;
  }

  return "development";
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number | null => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseUnitIntervalNumber = (value: string | undefined, fallback: number): number | null => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean | null => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return fallback;
  }

  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") {
    return true;
  }

  if (trimmed === "false" || trimmed === "0" || trimmed === "no") {
    return false;
  }

  return null;
};

const normalizeRequiredSecret = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const normalizeOptionalSafeValue = (value: string | undefined, maxLength = 160): string | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (placeholderPattern.test(trimmed) || /[\u0000-\u001f]/.test(trimmed) || trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
};

const normalizeDatabaseUrl = (value: string | undefined, production: boolean): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      return null;
    }

    if (
      production &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1" ||
        parsed.hostname === "example.com" ||
        parsed.hostname.endsWith(".example.com"))
    ) {
      return null;
    }

    return trimmed;
  } catch {
    return null;
  }
};

const readSslMode = (value: string | undefined): WorkerDatabaseSslMode | null => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return defaultSslMode;
  }

  if (trimmed === "disable" || trimmed === "require" || trimmed === "verify-full") {
    return trimmed;
  }

  return null;
};

const normalizeStorageBucket = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const normalizeStorageRegion = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed) || !/^[a-z]{2}[-a-z0-9]+-\d$/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const normalizeStorageEndpoint = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (placeholderPattern.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "https:") {
      return null;
    }

    return trimmed.replace(/\/+$/g, "");
  } catch {
    return null;
  }
};

const normalizeStoragePrefix = (value: string | undefined): string | null => {
  const trimmed = value?.trim().replace(/^\/+|\/+$/g, "");

  if (!trimmed) {
    return defaultGeneratedAssetPrefix;
  }

  if (!/^[A-Za-z0-9_.\/-]{1,160}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const normalizeProvider = (value: string | undefined): WorkerProviderRuntimeConfig["provider"] | null => {
  const trimmed = value?.trim().toLowerCase();

  if (trimmed === "openai" || trimmed === "other") {
    return trimmed;
  }

  return null;
};

const normalizeCalibrationId = (value: string | undefined): string | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (placeholderPattern.test(trimmed) || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{5,159}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

export const readWorkerRuntimeConfig = (env: WorkerRuntimeEnvironment = getDefaultEnvironment()): WorkerRuntimeConfigResult => {
  const releaseProfile = readReleaseProfile(env.TINY_PET_RELEASE_PROFILE);
  const production = releaseProfile === "production";
  const errors: string[] = [];
  const databaseUrl = normalizeDatabaseUrl(env.TINY_PET_WORKER_DATABASE_URL ?? env.TINY_PET_DATABASE_URL, production);
  const sslMode = readSslMode(env.TINY_PET_WORKER_DATABASE_SSL_MODE ?? env.TINY_PET_DATABASE_SSL_MODE);
  const maxPoolSize = parsePositiveInteger(env.TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE, defaultMaxPoolSize);
  const connectTimeoutMs = parsePositiveInteger(env.TINY_PET_WORKER_DATABASE_CONNECT_TIMEOUT_MS, defaultConnectTimeoutMs);
  const storageBucket = normalizeStorageBucket(env.TINY_PET_WORKER_STORAGE_BUCKET ?? env.TINY_PET_STORAGE_BUCKET);
  const storageRegion = normalizeStorageRegion(env.TINY_PET_WORKER_STORAGE_REGION ?? env.TINY_PET_STORAGE_REGION);
  const storageAccessKeyId = normalizeRequiredSecret(
    env.TINY_PET_WORKER_STORAGE_ACCESS_KEY_ID ?? env.TINY_PET_STORAGE_ACCESS_KEY_ID
  );
  const storageSecretAccessKey = normalizeRequiredSecret(
    env.TINY_PET_WORKER_STORAGE_SECRET_ACCESS_KEY ?? env.TINY_PET_STORAGE_SECRET_ACCESS_KEY
  );
  const storageSessionToken = normalizeRequiredSecret(env.TINY_PET_WORKER_STORAGE_SESSION_TOKEN ?? env.TINY_PET_STORAGE_SESSION_TOKEN);
  const storageEndpoint = normalizeStorageEndpoint(env.TINY_PET_WORKER_STORAGE_ENDPOINT ?? env.TINY_PET_STORAGE_ENDPOINT);
  const storageForcePathStyle = parseBoolean(
    env.TINY_PET_WORKER_STORAGE_FORCE_PATH_STYLE ?? env.TINY_PET_STORAGE_FORCE_PATH_STYLE,
    false
  );
  const generatedAssetPrefix = normalizeStoragePrefix(env.TINY_PET_WORKER_STORAGE_GENERATED_ASSET_PREFIX);
  const provider = normalizeProvider(env.TINY_PET_WORKER_GENERATION_PROVIDER);
  const providerApiKey = normalizeRequiredSecret(env.TINY_PET_WORKER_PROVIDER_API_KEY);
  const workerProviderModelRaw = env.TINY_PET_WORKER_PROVIDER_MODEL?.trim() ?? "";
  const workerProviderSafetyModelRaw = env.TINY_PET_WORKER_PROVIDER_SAFETY_MODEL?.trim() ?? "";
  const providerModel = normalizeOptionalSafeValue(workerProviderModelRaw);
  const providerSafetyModel = normalizeOptionalSafeValue(workerProviderSafetyModelRaw);
  const workerQualityMinPetVisibilityConfidenceRaw =
    env.TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE?.trim() ?? "";
  const workerQualityMinStyleMatchScoreRaw = env.TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE?.trim() ?? "";
  const workerQualityMinProviderConfidenceRaw = env.TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE?.trim() ?? "";
  const workerQualityCalibrationIdRaw = env.TINY_PET_WORKER_QUALITY_CALIBRATION_ID?.trim() ?? "";
  const workerQualityCalibrationId = normalizeCalibrationId(workerQualityCalibrationIdRaw);
  const minimumPetVisibilityConfidence = parseUnitIntervalNumber(
    workerQualityMinPetVisibilityConfidenceRaw,
    defaultGenerationQualityThresholds.minimumPetVisibilityConfidence
  );
  const minimumStyleMatchScore = parseUnitIntervalNumber(
    workerQualityMinStyleMatchScoreRaw,
    defaultGenerationQualityThresholds.minimumStyleMatchScore
  );
  const minimumProviderConfidence = parseUnitIntervalNumber(
    workerQualityMinProviderConfidenceRaw,
    defaultGenerationQualityThresholds.minimumProviderConfidence
  );
  const workerMaxJobsPerRunRaw = env.TINY_PET_WORKER_MAX_JOBS_PER_RUN?.trim() ?? "";
  const maxJobsPerRun = parsePositiveInteger(workerMaxJobsPerRunRaw, defaultMaxJobsPerRun);

  if ((env.TINY_PET_WORKER_DATABASE_URL ?? env.TINY_PET_DATABASE_URL)?.trim() && !databaseUrl) {
    errors.push("TINY_PET_WORKER_DATABASE_URL must be a valid postgres:// or postgresql:// URL.");
  }

  if (production && !databaseUrl) {
    errors.push("TINY_PET_WORKER_DATABASE_URL must be set to a non-placeholder production Postgres URL.");
  }

  if (!sslMode) {
    errors.push("TINY_PET_WORKER_DATABASE_SSL_MODE must be disable, require, or verify-full.");
  } else if (production && sslMode === "disable") {
    errors.push("TINY_PET_WORKER_DATABASE_SSL_MODE must not be disable for production worker deployments.");
  }

  if (!maxPoolSize || maxPoolSize > 50) {
    errors.push("TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE must be a positive integer no greater than 50.");
  }

  if (!connectTimeoutMs || connectTimeoutMs < 1_000 || connectTimeoutMs > 30_000) {
    errors.push("TINY_PET_WORKER_DATABASE_CONNECT_TIMEOUT_MS must be between 1000 and 30000 milliseconds.");
  }

  if ((env.TINY_PET_WORKER_STORAGE_BUCKET ?? env.TINY_PET_STORAGE_BUCKET)?.trim() && !storageBucket) {
    errors.push("TINY_PET_WORKER_STORAGE_BUCKET must be a valid non-placeholder S3 bucket name.");
  }

  if ((env.TINY_PET_WORKER_STORAGE_REGION ?? env.TINY_PET_STORAGE_REGION)?.trim() && !storageRegion) {
    errors.push("TINY_PET_WORKER_STORAGE_REGION must be a valid S3 region.");
  }

  if ((env.TINY_PET_WORKER_STORAGE_ENDPOINT ?? env.TINY_PET_STORAGE_ENDPOINT)?.trim() && !storageEndpoint) {
    errors.push("TINY_PET_WORKER_STORAGE_ENDPOINT must be a valid https URL when set.");
  }

  if (storageForcePathStyle === null) {
    errors.push("TINY_PET_WORKER_STORAGE_FORCE_PATH_STYLE must be true or false when set.");
  }

  if (!generatedAssetPrefix) {
    errors.push("TINY_PET_WORKER_STORAGE_GENERATED_ASSET_PREFIX must contain only safe object-key characters.");
  }

  if (env.TINY_PET_WORKER_GENERATION_PROVIDER?.trim() && !provider) {
    errors.push("TINY_PET_WORKER_GENERATION_PROVIDER must be openai or other.");
  }

  if (providerModel === null) {
    errors.push("TINY_PET_WORKER_PROVIDER_MODEL must be a safe model identifier when set.");
  }

  if (providerSafetyModel === null) {
    errors.push("TINY_PET_WORKER_PROVIDER_SAFETY_MODEL must be a safe model identifier when set.");
  }

  if (minimumPetVisibilityConfidence === null) {
    errors.push("TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE must be a number between 0 and 1 when set.");
  }

  if (minimumStyleMatchScore === null) {
    errors.push("TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE must be a number between 0 and 1 when set.");
  }

  if (minimumProviderConfidence === null) {
    errors.push("TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE must be a number between 0 and 1 when set.");
  }

  if (workerQualityCalibrationId === null) {
    errors.push("TINY_PET_WORKER_QUALITY_CALIBRATION_ID must be a safe calibration identifier when set.");
  }

  if (!maxJobsPerRun || maxJobsPerRun > 25) {
    errors.push("TINY_PET_WORKER_MAX_JOBS_PER_RUN must be a positive integer no greater than 25.");
  }

  if (production) {
    if (!storageBucket) {
      errors.push("TINY_PET_WORKER_STORAGE_BUCKET must be set to a production private storage bucket.");
    }

    if (!storageRegion) {
      errors.push("TINY_PET_WORKER_STORAGE_REGION must be set for production private storage.");
    }

    if (!storageAccessKeyId) {
      errors.push("TINY_PET_WORKER_STORAGE_ACCESS_KEY_ID must be set for production private storage.");
    }

    if (!storageSecretAccessKey) {
      errors.push("TINY_PET_WORKER_STORAGE_SECRET_ACCESS_KEY must be set for production private storage.");
    }

    if (!provider) {
      errors.push("TINY_PET_WORKER_GENERATION_PROVIDER must be set for production generation.");
    }

    if (!providerApiKey) {
      errors.push("TINY_PET_WORKER_PROVIDER_API_KEY must be set for production generation.");
    }

    if (!workerProviderModelRaw) {
      errors.push("TINY_PET_WORKER_PROVIDER_MODEL must be set for production generation model selection.");
    }

    if (!workerProviderSafetyModelRaw) {
      errors.push("TINY_PET_WORKER_PROVIDER_SAFETY_MODEL must be set for production generation safety and quality checks.");
    }

    if (!workerQualityMinPetVisibilityConfidenceRaw) {
      errors.push(
        "TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE must be set for production generation quality calibration."
      );
    }

    if (!workerQualityMinStyleMatchScoreRaw) {
      errors.push("TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE must be set for production generation quality calibration.");
    }

    if (!workerQualityMinProviderConfidenceRaw) {
      errors.push("TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE must be set for production generation quality calibration.");
    }

    if (!workerQualityCalibrationIdRaw) {
      errors.push("TINY_PET_WORKER_QUALITY_CALIBRATION_ID must be set for production generation quality calibration traceability.");
    }

    if (!workerMaxJobsPerRunRaw) {
      errors.push("TINY_PET_WORKER_MAX_JOBS_PER_RUN must be set for production generation worker batch limits.");
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    config: {
      releaseProfile,
      production,
      database: databaseUrl
        ? {
            databaseUrl,
            sslMode: sslMode ?? defaultSslMode,
            maxPoolSize: maxPoolSize ?? defaultMaxPoolSize,
            connectTimeoutMs: connectTimeoutMs ?? defaultConnectTimeoutMs
          }
        : null,
      storage:
        storageBucket && storageRegion && storageAccessKeyId && storageSecretAccessKey && generatedAssetPrefix
          ? {
              bucket: storageBucket,
              region: storageRegion,
              accessKeyId: storageAccessKeyId,
              secretAccessKey: storageSecretAccessKey,
              ...(storageSessionToken ? { sessionToken: storageSessionToken } : {}),
              ...(storageEndpoint ? { endpoint: storageEndpoint } : {}),
              forcePathStyle: storageForcePathStyle ?? false,
              generatedAssetPrefix
            }
          : null,
      provider:
        provider && providerApiKey
          ? {
              provider,
              apiKey: providerApiKey,
              ...(providerModel ? { model: providerModel } : {}),
              ...(providerSafetyModel ? { safetyModel: providerSafetyModel } : {})
            }
          : null,
      qualityGate: {
        minimumPetVisibilityConfidence:
          minimumPetVisibilityConfidence ?? defaultGenerationQualityThresholds.minimumPetVisibilityConfidence,
        minimumStyleMatchScore: minimumStyleMatchScore ?? defaultGenerationQualityThresholds.minimumStyleMatchScore,
        minimumProviderConfidence: minimumProviderConfidence ?? defaultGenerationQualityThresholds.minimumProviderConfidence
      },
      ...(workerQualityCalibrationId ? { qualityCalibrationId: workerQualityCalibrationId } : {}),
      maxJobsPerRun: maxJobsPerRun ?? defaultMaxJobsPerRun
    }
  };
};

export const requireWorkerRuntimeConfig = (env: WorkerRuntimeEnvironment = getDefaultEnvironment()): WorkerRuntimeConfig => {
  const result = readWorkerRuntimeConfig(env);

  if (result.ok) {
    return result.config;
  }

  throw new Error(`Invalid worker runtime config:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
};
