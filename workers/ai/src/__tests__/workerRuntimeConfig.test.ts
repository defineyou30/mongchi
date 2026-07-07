import { describe, expect, it } from "vitest";

import { readWorkerRuntimeConfig, requireWorkerRuntimeConfig } from "../workerRuntimeConfig";

describe("AI worker runtime config", () => {
  it("allows local development without provider, database, or storage credentials", () => {
    expect(
      readWorkerRuntimeConfig({
        TINY_PET_RELEASE_PROFILE: "development"
      })
    ).toEqual({
      ok: true,
      config: {
        releaseProfile: "development",
        production: false,
        database: null,
        storage: null,
        provider: null,
        qualityGate: {
          minimumPetVisibilityConfidence: 0.72,
          minimumStyleMatchScore: 0.7,
          minimumProviderConfidence: 0.68
        },
        maxJobsPerRun: 1
      }
    });
  });

  it("requires production database, storage, and provider settings", () => {
    const missing = readWorkerRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production"
    });
    const localhost = readWorkerRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_WORKER_DATABASE_URL: "postgresql://worker:secret@localhost:5432/tiny_pet"
    });
    const sslDisabled = readWorkerRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_WORKER_DATABASE_URL: "postgresql://worker:secret@db.mongchi.app:5432/tiny_pet",
      TINY_PET_WORKER_DATABASE_SSL_MODE: "disable"
    });

    expect(missing.ok).toBe(false);
    expect(localhost.ok).toBe(false);
    expect(sslDisabled.ok).toBe(false);

    if (!missing.ok) {
      expect(missing.errors).toContain("TINY_PET_WORKER_DATABASE_URL must be set to a non-placeholder production Postgres URL.");
      expect(missing.errors).toContain("TINY_PET_WORKER_STORAGE_BUCKET must be set to a production private storage bucket.");
      expect(missing.errors).toContain("TINY_PET_WORKER_GENERATION_PROVIDER must be set for production generation.");
      expect(missing.errors).toContain("TINY_PET_WORKER_PROVIDER_API_KEY must be set for production generation.");
      expect(missing.errors).toContain("TINY_PET_WORKER_PROVIDER_MODEL must be set for production generation model selection.");
      expect(missing.errors).toContain(
        "TINY_PET_WORKER_PROVIDER_SAFETY_MODEL must be set for production generation safety and quality checks."
      );
      expect(missing.errors).toContain(
        "TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE must be set for production generation quality calibration."
      );
      expect(missing.errors).toContain(
        "TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE must be set for production generation quality calibration."
      );
      expect(missing.errors).toContain(
        "TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE must be set for production generation quality calibration."
      );
      expect(missing.errors).toContain(
        "TINY_PET_WORKER_QUALITY_CALIBRATION_ID must be set for production generation quality calibration traceability."
      );
      expect(missing.errors).toContain("TINY_PET_WORKER_MAX_JOBS_PER_RUN must be set for production generation worker batch limits.");
    }

    if (!sslDisabled.ok) {
      expect(sslDisabled.errors).toContain("TINY_PET_WORKER_DATABASE_SSL_MODE must not be disable for production worker deployments.");
    }
  });

  it("parses production worker database, storage, provider, and batch settings", () => {
    const result = readWorkerRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_WORKER_DATABASE_URL: "postgresql://worker:secret@db.mongchi.app:5432/tiny_pet",
      TINY_PET_WORKER_DATABASE_SSL_MODE: "verify-full",
      TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE: "6",
      TINY_PET_WORKER_DATABASE_CONNECT_TIMEOUT_MS: "8000",
      TINY_PET_WORKER_STORAGE_BUCKET: "tiny-pet-private-prod",
      TINY_PET_WORKER_STORAGE_REGION: "us-east-1",
      TINY_PET_WORKER_STORAGE_ACCESS_KEY_ID: "AKIAWORKERKEY",
      TINY_PET_WORKER_STORAGE_SECRET_ACCESS_KEY: "worker-secret-key",
      TINY_PET_WORKER_STORAGE_SESSION_TOKEN: "worker-session-token",
      TINY_PET_WORKER_STORAGE_ENDPOINT: "https://s3.us-east-1.amazonaws.com/",
      TINY_PET_WORKER_STORAGE_GENERATED_ASSET_PREFIX: "generated/prod",
      TINY_PET_WORKER_GENERATION_PROVIDER: "openai",
      TINY_PET_WORKER_PROVIDER_API_KEY: "provider-secret-key",
      TINY_PET_WORKER_PROVIDER_MODEL: "image-model-1",
      TINY_PET_WORKER_PROVIDER_SAFETY_MODEL: "safety-model-1",
      TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE: "0.81",
      TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE: "0.79",
      TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE: "0.77",
      TINY_PET_WORKER_QUALITY_CALIBRATION_ID: "calibration-2026-06-provider-v1",
      TINY_PET_WORKER_MAX_JOBS_PER_RUN: "4"
    });

    expect(result).toEqual({
      ok: true,
      config: {
        releaseProfile: "production",
        production: true,
        database: {
          databaseUrl: "postgresql://worker:secret@db.mongchi.app:5432/tiny_pet",
          sslMode: "verify-full",
          maxPoolSize: 6,
          connectTimeoutMs: 8000
        },
        storage: {
          bucket: "tiny-pet-private-prod",
          region: "us-east-1",
          accessKeyId: "AKIAWORKERKEY",
          secretAccessKey: "worker-secret-key",
          sessionToken: "worker-session-token",
          endpoint: "https://s3.us-east-1.amazonaws.com",
          forcePathStyle: false,
          generatedAssetPrefix: "generated/prod"
        },
        provider: {
          provider: "openai",
          apiKey: "provider-secret-key",
          model: "image-model-1",
          safetyModel: "safety-model-1"
        },
        qualityGate: {
          minimumPetVisibilityConfidence: 0.81,
          minimumStyleMatchScore: 0.79,
          minimumProviderConfidence: 0.77
        },
        qualityCalibrationId: "calibration-2026-06-provider-v1",
        maxJobsPerRun: 4
      }
    });
  });

  it("rejects invalid worker quality threshold environment values", () => {
    const result = readWorkerRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "development",
      TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE: "loud",
      TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE: "1.2",
      TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE: "-0.1",
      TINY_PET_WORKER_QUALITY_CALIBRATION_ID: "tbd"
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        "TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE must be a number between 0 and 1 when set."
      );
      expect(result.errors).toContain("TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE must be a number between 0 and 1 when set.");
      expect(result.errors).toContain("TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE must be a number between 0 and 1 when set.");
      expect(result.errors).toContain("TINY_PET_WORKER_QUALITY_CALIBRATION_ID must be a safe calibration identifier when set.");
    }
  });

  it("falls back to shared API database and storage env names for integration deployments", () => {
    const result = readWorkerRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_DATABASE_URL: "postgresql://worker:secret@db.mongchi.app:5432/tiny_pet",
      TINY_PET_DATABASE_SSL_MODE: "require",
      TINY_PET_STORAGE_BUCKET: "tiny-pet-private-prod",
      TINY_PET_STORAGE_REGION: "us-east-1",
      TINY_PET_STORAGE_ACCESS_KEY_ID: "AKIAWORKERKEY",
      TINY_PET_STORAGE_SECRET_ACCESS_KEY: "worker-secret-key",
      TINY_PET_WORKER_GENERATION_PROVIDER: "other",
      TINY_PET_WORKER_PROVIDER_API_KEY: "provider-secret-key",
      TINY_PET_WORKER_PROVIDER_MODEL: "image-model-1",
      TINY_PET_WORKER_PROVIDER_SAFETY_MODEL: "safety-model-1",
      TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE: "0.8",
      TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE: "0.78",
      TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE: "0.76",
      TINY_PET_WORKER_QUALITY_CALIBRATION_ID: "calibration-2026-06-shared-env",
      TINY_PET_WORKER_MAX_JOBS_PER_RUN: "2"
    });

    expect(result).toMatchObject({
      ok: true,
      config: {
        database: {
          databaseUrl: "postgresql://worker:secret@db.mongchi.app:5432/tiny_pet"
        },
        storage: {
          bucket: "tiny-pet-private-prod"
        },
        provider: {
          provider: "other"
        }
      }
    });
  });

  it("throws a safe aggregate config error without leaking provided secrets", () => {
    expect(() =>
      requireWorkerRuntimeConfig({
        TINY_PET_RELEASE_PROFILE: "production",
        TINY_PET_WORKER_DATABASE_URL: "https://db.example.com",
        TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE: "0",
        TINY_PET_WORKER_PROVIDER_API_KEY: "raw-secret-provider-key"
      })
    ).toThrow(/Invalid worker runtime config/);

    try {
      requireWorkerRuntimeConfig({
        TINY_PET_RELEASE_PROFILE: "production",
        TINY_PET_WORKER_DATABASE_URL: "https://db.example.com",
        TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE: "0",
        TINY_PET_WORKER_PROVIDER_API_KEY: "raw-secret-provider-key"
      });
    } catch (error) {
      expect(String(error)).not.toContain("raw-secret-provider-key");
    }
  });
});
