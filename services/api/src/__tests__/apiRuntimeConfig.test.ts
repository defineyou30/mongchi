import { describe, expect, it } from "vitest";

import { readApiRuntimeConfig, requireApiRuntimeConfig } from "../apiRuntimeConfig";

const productionPremiumChatPolicyEnv = {
  TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES: "8",
  TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS: "60000",
  TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT: "12",
  TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS: "120000"
};

describe("API runtime config", () => {
  it("allows local development without a database URL", () => {
    const result = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "development"
    });

    expect(result).toEqual({
      ok: true,
      config: {
        releaseProfile: "development",
        production: false,
        allowMockGenerationPolling: true,
        auth: null,
        database: null,
        storage: null,
        commerceWebhookSecret: null,
        storeVerifier: null,
        premiumChat: null
      }
    });
  });

  it("requires a production Postgres URL, SSL, and private storage settings", () => {
    const missing = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production"
    });
    const localhost = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_DATABASE_URL: "postgres://user:pass@localhost:5432/tiny_pet"
    });
    const sslDisabled = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_DATABASE_URL: "postgresql://user:pass@db.mongchi.app:5432/tiny_pet",
      TINY_PET_DATABASE_SSL_MODE: "disable"
    });

    expect(missing.ok).toBe(false);
    expect(localhost.ok).toBe(false);
    expect(sslDisabled.ok).toBe(false);

    if (!missing.ok) {
      expect(missing.errors).toContain("TINY_PET_DATABASE_URL must be set to a non-placeholder production Postgres URL.");
      expect(missing.errors).toContain("TINY_PET_AUTH_ISSUER must be set to a production auth issuer https URL.");
      expect(missing.errors).toContain("TINY_PET_AUTH_AUDIENCE must be set for production auth verification.");
      expect(missing.errors).toContain("TINY_PET_AUTH_JWKS_URL must be set to a production JWKS https URL.");
      expect(missing.errors).toContain("TINY_PET_STORAGE_BUCKET must be set to a production private storage bucket.");
      expect(missing.errors).toContain("TINY_PET_STORAGE_ACCESS_KEY_ID must be set for production private storage signing.");
      expect(missing.errors).toContain("TINY_PET_COMMERCE_WEBHOOK_SECRET must be set for production store webhook verification.");
      expect(missing.errors).toContain(
        "TINY_PET_STORE_VERIFIER_ENDPOINT and TINY_PET_STORE_VERIFIER_API_KEY must be set for production purchase verification."
      );
      expect(missing.errors).toContain("TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY or OPENAI_API_KEY must be set for production premium chat.");
      expect(missing.errors).toContain("TINY_PET_PREMIUM_CHAT_OPENAI_MODEL must be set for production premium chat model selection.");
      expect(missing.errors).toContain("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES must be set for production premium chat turn limits.");
      expect(missing.errors).toContain("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS must be set for production premium chat turn limits.");
      expect(missing.errors).toContain("TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT must be set for production premium chat context limits.");
      expect(missing.errors).toContain("TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS must be set for production premium chat retention policy.");
    }

    if (!sslDisabled.ok) {
      expect(sslDisabled.errors).toContain("TINY_PET_DATABASE_SSL_MODE must not be disable for production API deployments.");
    }
  });

  it("parses production database runtime settings", () => {
    const result = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_DATABASE_URL: "postgresql://user:pass@db.mongchi.app:5432/tiny_pet",
      TINY_PET_DATABASE_SSL_MODE: "verify-full",
      TINY_PET_DATABASE_MAX_POOL_SIZE: "12",
      TINY_PET_DATABASE_CONNECT_TIMEOUT_MS: "7000",
      TINY_PET_AUTH_ISSUER: "https://auth.mongchi.app/",
      TINY_PET_AUTH_AUDIENCE: "tiny-pet-mobile",
      TINY_PET_AUTH_JWKS_URL: "https://auth.mongchi.app/.well-known/jwks.json",
      TINY_PET_AUTH_PROVIDER: "tiny-pet-auth",
      TINY_PET_AUTH_USER_ID_CLAIM: "sub",
      TINY_PET_AUTH_CLOCK_TOLERANCE_SECONDS: "45",
      TINY_PET_AUTH_JWKS_CACHE_TTL_MS: "600000",
      TINY_PET_STORAGE_BUCKET: "tiny-pet-private-prod",
      TINY_PET_STORAGE_REGION: "us-east-1",
      TINY_PET_STORAGE_ACCESS_KEY_ID: "AKIAPRODUCTIONKEY",
      TINY_PET_STORAGE_SECRET_ACCESS_KEY: "production-secret-key",
      TINY_PET_STORAGE_ENDPOINT: "https://s3.us-east-1.amazonaws.com/",
      TINY_PET_STORAGE_ORIGINAL_PHOTO_PREFIX: "source/originals",
      TINY_PET_COMMERCE_WEBHOOK_SECRET: "commerce-webhook-secret-001",
      TINY_PET_STORE_VERIFIER_ENDPOINT: "https://store-verifier.mongchi.app/verify/",
      TINY_PET_STORE_VERIFIER_API_KEY: "store-verifier-secret-001",
      TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY: "sk-premium-chat",
      TINY_PET_PREMIUM_CHAT_OPENAI_MODEL: "gpt-5.5",
      TINY_PET_PREMIUM_CHAT_OPENAI_BASE_URL: "https://api.openai.com/v1/",
      TINY_PET_PREMIUM_CHAT_OPENAI_MAX_OUTPUT_TOKENS: "320",
      ...productionPremiumChatPolicyEnv
    });

    expect(result).toEqual({
      ok: true,
      config: {
        releaseProfile: "production",
        production: true,
        allowMockGenerationPolling: false,
        auth: {
          issuer: "https://auth.mongchi.app",
          audience: "tiny-pet-mobile",
          jwksUrl: "https://auth.mongchi.app/.well-known/jwks.json",
          provider: "tiny-pet-auth",
          userIdClaim: "sub",
          clockToleranceSeconds: 45,
          jwksCacheTtlMs: 600000
        },
        database: {
          databaseUrl: "postgresql://user:pass@db.mongchi.app:5432/tiny_pet",
          sslMode: "verify-full",
          maxPoolSize: 12,
          connectTimeoutMs: 7000
        },
        storage: {
          bucket: "tiny-pet-private-prod",
          region: "us-east-1",
          accessKeyId: "AKIAPRODUCTIONKEY",
          secretAccessKey: "production-secret-key",
          endpoint: "https://s3.us-east-1.amazonaws.com",
          forcePathStyle: false,
          originalPhotoPrefix: "source/originals"
        },
        commerceWebhookSecret: "commerce-webhook-secret-001",
        storeVerifier: {
          provider: "http",
          endpoint: "https://store-verifier.mongchi.app/verify",
          apiKey: "store-verifier-secret-001"
        },
        premiumChat: {
          provider: "openai",
          apiKey: "sk-premium-chat",
          model: "gpt-5.5",
          baseUrl: "https://api.openai.com/v1",
          maxOutputTokens: 320,
          policy: {
            maxUserMessagesPerWindow: 8,
            rateLimitWindowMs: 60000,
            contextMessageLimit: 12,
            retentionWindowMs: 120000
          }
        }
      }
    });
  });

  it("parses direct App Store and Google Play verifier runtime settings", () => {
    const result = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_DATABASE_URL: "postgresql://user:pass@db.mongchi.app:5432/tiny_pet",
      TINY_PET_DATABASE_SSL_MODE: "verify-full",
      TINY_PET_AUTH_ISSUER: "https://auth.mongchi.app/",
      TINY_PET_AUTH_AUDIENCE: "tiny-pet-mobile",
      TINY_PET_AUTH_JWKS_URL: "https://auth.mongchi.app/.well-known/jwks.json",
      TINY_PET_STORAGE_BUCKET: "tiny-pet-private-prod",
      TINY_PET_STORAGE_REGION: "us-east-1",
      TINY_PET_STORAGE_ACCESS_KEY_ID: "AKIAPRODUCTIONKEY",
      TINY_PET_STORAGE_SECRET_ACCESS_KEY: "production-secret-key",
      TINY_PET_COMMERCE_WEBHOOK_SECRET: "commerce-webhook-secret-001",
      TINY_PET_STORE_VERIFIER_PROVIDER: "direct",
      TINY_PET_APP_STORE_BUNDLE_ID: "app.mongchi.mobile",
      TINY_PET_APP_STORE_ISSUER_ID: "app-store-issuer-001",
      TINY_PET_APP_STORE_KEY_ID: "app-store-key-001",
      TINY_PET_APP_STORE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\napp-store-test-key\\n-----END PRIVATE KEY-----",
      TINY_PET_APP_STORE_ENVIRONMENT: "sandbox",
      TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256:
        "5F:CB:07:9C:CB:94:F4:83:10:6A:C7:6A:81:90:2F:9A:82:5F:2E:C2:13:B5:D6:1E:CB:27:A7:97:0E:9B:F3:C3",
      TINY_PET_APP_STORE_BASE_URL: "https://api.storekit-sandbox.itunes.apple.com/",
      TINY_PET_GOOGLE_PLAY_PACKAGE_NAME: "app.mongchi.mobile",
      TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "android-publisher@tinypet.iam.gserviceaccount.com",
      TINY_PET_GOOGLE_PLAY_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ngoogle-play-test-key\\n-----END PRIVATE KEY-----",
      TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS: "premium_chat_monthly,plus_family_monthly",
      TINY_PET_GOOGLE_PLAY_BASE_URL: "https://androidpublisher.googleapis.com/",
      TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY: "sk-premium-chat",
      TINY_PET_PREMIUM_CHAT_OPENAI_MODEL: "gpt-5.5",
      ...productionPremiumChatPolicyEnv,
      TINY_PET_WORKER_GENERATION_PROVIDER: "openai",
      TINY_PET_WORKER_PROVIDER_API_KEY: "worker-provider-secret"
    });

    expect(result).toMatchObject({
      ok: true,
      config: {
        storeVerifier: {
          provider: "direct",
          appStore: {
            bundleId: "app.mongchi.mobile",
            issuerId: "app-store-issuer-001",
            keyId: "app-store-key-001",
            privateKey: "-----BEGIN PRIVATE KEY-----\\napp-store-test-key\\n-----END PRIVATE KEY-----",
            environment: "sandbox",
            notificationRootCertificateSha256Fingerprints: [
              "sha256:5fcb079ccb94f483106ac76a81902f9a825f2ec213b5d61ecb27a7970e9bf3c3"
            ],
            baseUrl: "https://api.storekit-sandbox.itunes.apple.com"
          },
          googlePlay: {
            packageName: "app.mongchi.mobile",
            serviceAccountClientEmail: "android-publisher@tinypet.iam.gserviceaccount.com",
            serviceAccountPrivateKey: "-----BEGIN PRIVATE KEY-----\\ngoogle-play-test-key\\n-----END PRIVATE KEY-----",
            subscriptionProductIds: ["premium_chat_monthly", "plus_family_monthly"],
            baseUrl: "https://androidpublisher.googleapis.com"
          }
        }
      }
    });
  });

  it("requires direct Google Play product ids for production subscription verification", () => {
    const result = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_DATABASE_URL: "postgresql://user:pass@db.mongchi.app:5432/tiny_pet",
      TINY_PET_AUTH_ISSUER: "https://auth.mongchi.app/",
      TINY_PET_AUTH_AUDIENCE: "tiny-pet-mobile",
      TINY_PET_AUTH_JWKS_URL: "https://auth.mongchi.app/.well-known/jwks.json",
      TINY_PET_STORAGE_BUCKET: "tiny-pet-private-prod",
      TINY_PET_STORAGE_REGION: "us-east-1",
      TINY_PET_STORAGE_ACCESS_KEY_ID: "AKIAPRODUCTIONKEY",
      TINY_PET_STORAGE_SECRET_ACCESS_KEY: "production-secret-key",
      TINY_PET_COMMERCE_WEBHOOK_SECRET: "commerce-webhook-secret-001",
      TINY_PET_STORE_VERIFIER_PROVIDER: "direct",
      TINY_PET_APP_STORE_BUNDLE_ID: "app.mongchi.mobile",
      TINY_PET_APP_STORE_ISSUER_ID: "app-store-issuer-001",
      TINY_PET_APP_STORE_KEY_ID: "app-store-key-001",
      TINY_PET_APP_STORE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\napp-store-test-key\\n-----END PRIVATE KEY-----",
      TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256: "sha256:5fcb079ccb94f483106ac76a81902f9a825f2ec213b5d61ecb27a7970e9bf3c3",
      TINY_PET_GOOGLE_PLAY_PACKAGE_NAME: "app.mongchi.mobile",
      TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "android-publisher@tinypet.iam.gserviceaccount.com",
      TINY_PET_GOOGLE_PLAY_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ngoogle-play-test-key\\n-----END PRIVATE KEY-----",
      TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY: "sk-premium-chat",
      TINY_PET_PREMIUM_CHAT_OPENAI_MODEL: "gpt-5.5",
      ...productionPremiumChatPolicyEnv
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        "TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS must be set for direct Google Play subscription verification."
      );
    }
  });

  it("requires an App Store notification root certificate fingerprint for production direct webhook verification", () => {
    const result = readApiRuntimeConfig({
      TINY_PET_RELEASE_PROFILE: "production",
      TINY_PET_DATABASE_URL: "postgresql://user:pass@db.mongchi.app:5432/tiny_pet",
      TINY_PET_AUTH_ISSUER: "https://auth.mongchi.app/",
      TINY_PET_AUTH_AUDIENCE: "tiny-pet-mobile",
      TINY_PET_AUTH_JWKS_URL: "https://auth.mongchi.app/.well-known/jwks.json",
      TINY_PET_STORAGE_BUCKET: "tiny-pet-private-prod",
      TINY_PET_STORAGE_REGION: "us-east-1",
      TINY_PET_STORAGE_ACCESS_KEY_ID: "AKIAPRODUCTIONKEY",
      TINY_PET_STORAGE_SECRET_ACCESS_KEY: "production-secret-key",
      TINY_PET_COMMERCE_WEBHOOK_SECRET: "commerce-webhook-secret-001",
      TINY_PET_STORE_VERIFIER_PROVIDER: "direct",
      TINY_PET_APP_STORE_BUNDLE_ID: "app.mongchi.mobile",
      TINY_PET_APP_STORE_ISSUER_ID: "app-store-issuer-001",
      TINY_PET_APP_STORE_KEY_ID: "app-store-key-001",
      TINY_PET_APP_STORE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\napp-store-test-key\\n-----END PRIVATE KEY-----",
      TINY_PET_GOOGLE_PLAY_PACKAGE_NAME: "app.mongchi.mobile",
      TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "android-publisher@tinypet.iam.gserviceaccount.com",
      TINY_PET_GOOGLE_PLAY_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ngoogle-play-test-key\\n-----END PRIVATE KEY-----",
      TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS: "premium_chat_monthly",
      TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY: "sk-premium-chat",
      TINY_PET_PREMIUM_CHAT_OPENAI_MODEL: "gpt-5.5",
      ...productionPremiumChatPolicyEnv
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        "TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256 must be set for direct App Store server notification verification."
      );
    }
  });

  it("throws a safe aggregate config error for invalid values", () => {
    expect(() =>
      requireApiRuntimeConfig({
        TINY_PET_RELEASE_PROFILE: "production",
        TINY_PET_DATABASE_URL: "https://db.example.com",
        TINY_PET_DATABASE_MAX_POOL_SIZE: "0"
      })
    ).toThrow(/Invalid API runtime config/);
  });
});
