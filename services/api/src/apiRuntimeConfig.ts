import type { PremiumChatPolicyOptions } from "./premiumChatPolicy";

export type ApiReleaseProfile = "development" | "preview" | "production";
export type ApiDatabaseSslMode = "disable" | "require" | "verify-full";

export interface ApiRuntimeEnvironment {
  [key: string]: string | undefined;
}

export interface ApiPostgresRuntimeConfig {
  databaseUrl: string;
  sslMode: ApiDatabaseSslMode;
  maxPoolSize: number;
  connectTimeoutMs: number;
}

export interface ApiS3StorageRuntimeConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpoint?: string;
  forcePathStyle: boolean;
  originalPhotoPrefix: string;
}

export interface ApiAuthRuntimeConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  provider: string;
  userIdClaim: string;
  clockToleranceSeconds: number;
  jwksCacheTtlMs: number;
}

export interface ApiPremiumChatRuntimeConfig {
  provider: "openai";
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens: number;
  policy?: PremiumChatPolicyOptions;
}

export interface ApiStoreVerifierRuntimeConfig {
  provider: "http";
  endpoint: string;
  apiKey: string;
}

export interface ApiAppStoreVerifierRuntimeConfig {
  bundleId: string;
  issuerId: string;
  keyId: string;
  privateKey: string;
  environment: "sandbox" | "production";
  notificationRootCertificateSha256Fingerprints?: string[];
  baseUrl?: string;
}

export interface ApiGooglePlayVerifierRuntimeConfig {
  packageName: string;
  serviceAccountClientEmail: string;
  serviceAccountPrivateKey: string;
  subscriptionProductIds?: string[];
  baseUrl?: string;
}

export interface ApiDirectStoreVerifierRuntimeConfig {
  provider: "direct";
  appStore: ApiAppStoreVerifierRuntimeConfig;
  googlePlay: ApiGooglePlayVerifierRuntimeConfig;
}

export type ApiStorePurchaseVerifierRuntimeConfig = ApiStoreVerifierRuntimeConfig | ApiDirectStoreVerifierRuntimeConfig;

export interface ApiRuntimeConfig {
  releaseProfile: ApiReleaseProfile;
  production: boolean;
  allowMockGenerationPolling: boolean;
  auth: ApiAuthRuntimeConfig | null;
  database: ApiPostgresRuntimeConfig | null;
  storage: ApiS3StorageRuntimeConfig | null;
  commerceWebhookSecret: string | null;
  storeVerifier: ApiStorePurchaseVerifierRuntimeConfig | null;
  premiumChat: ApiPremiumChatRuntimeConfig | null;
}

export type ApiRuntimeConfigResult =
  | {
      ok: true;
      config: ApiRuntimeConfig;
    }
  | {
      ok: false;
      errors: string[];
    };

const placeholderPattern = /^(todo|tbd|placeholder|replace-me|example|postgres:\/\/example|postgresql:\/\/example)/i;
const defaultMaxPoolSize = 10;
const defaultConnectTimeoutMs = 5_000;
const defaultSslMode: ApiDatabaseSslMode = "require";
const defaultOriginalPhotoPrefix = "original-photos";
const defaultAuthProvider = "production-auth";
const defaultAuthUserIdClaim = "sub";
const defaultAuthClockToleranceSeconds = 30;
const defaultAuthJwksCacheTtlMs = 5 * 60 * 1000;
const defaultPremiumChatMaxOutputTokens = 260;

const readReleaseProfile = (value: string | undefined): ApiReleaseProfile => {
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

const normalizeRuntimeHttpsUrl = (value: string | undefined, production: boolean): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "https:") {
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

    return trimmed.replace(/\/+$/g, "");
  } catch {
    return null;
  }
};

const normalizeAuthAudience = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed) || /[\u0000-\u001f\s]/.test(trimmed) || trimmed.length > 256) {
    return null;
  }

  return trimmed;
};

const normalizeAuthIdentifier = (value: string | undefined, fallback: string): string | null => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  if (placeholderPattern.test(trimmed) || !/^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(trimmed)) {
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
    return defaultOriginalPhotoPrefix;
  }

  if (!/^[A-Za-z0-9_.\/-]{1,160}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const normalizeMobilePackageIdentifier = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed) || trimmed.length > 220) {
    return null;
  }

  return /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(trimmed) ? trimmed : null;
};

const normalizeStoreEnvironment = (value: string | undefined): "sandbox" | "production" | null => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return "production";
  }

  return trimmed === "sandbox" || trimmed === "production" ? trimmed : null;
};

const normalizeCsvSafeIdentifiers = (value: string | undefined): string[] | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const values = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0 || values.length > 40 || values.some((item) => placeholderPattern.test(item) || !/^[A-Za-z0-9_.:-]{1,160}$/.test(item))) {
    return null;
  }

  return Array.from(new Set(values));
};

const normalizeSha256CertificateFingerprint = (value: string): string | null => {
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, "").replace(/:/g, "");

  return /^[a-f0-9]{64}$/.test(normalized) ? `sha256:${normalized}` : null;
};

const normalizeCsvSha256CertificateFingerprints = (value: string | undefined): string[] | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const values = trimmed
    .split(",")
    .map((item) => normalizeSha256CertificateFingerprint(item))
    .filter((item): item is string => Boolean(item));
  const rawValues = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawValues.length === 0 || values.length !== rawValues.length || values.length > 8) {
    return null;
  }

  return Array.from(new Set(values));
};

const readSslMode = (value: string | undefined): ApiDatabaseSslMode | null => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return defaultSslMode;
  }

  if (trimmed === "disable" || trimmed === "require" || trimmed === "verify-full") {
    return trimmed;
  }

  return null;
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

export const readApiRuntimeConfig = (env: ApiRuntimeEnvironment = process.env): ApiRuntimeConfigResult => {
  const releaseProfile = readReleaseProfile(env.TINY_PET_RELEASE_PROFILE);
  const production = releaseProfile === "production";
  const errors: string[] = [];
  const allowMockGenerationPolling = parseBoolean(env.TINY_PET_API_ALLOW_MOCK_GENERATION_POLLING, !production);
  const databaseUrl = normalizeDatabaseUrl(env.TINY_PET_DATABASE_URL, production);
  const sslMode = readSslMode(env.TINY_PET_DATABASE_SSL_MODE);
  const maxPoolSize = parsePositiveInteger(env.TINY_PET_DATABASE_MAX_POOL_SIZE, defaultMaxPoolSize);
  const connectTimeoutMs = parsePositiveInteger(env.TINY_PET_DATABASE_CONNECT_TIMEOUT_MS, defaultConnectTimeoutMs);
  const authIssuer = normalizeRuntimeHttpsUrl(env.TINY_PET_AUTH_ISSUER, production);
  const authAudience = normalizeAuthAudience(env.TINY_PET_AUTH_AUDIENCE);
  const authJwksUrl = normalizeRuntimeHttpsUrl(env.TINY_PET_AUTH_JWKS_URL, production);
  const authProvider = normalizeAuthIdentifier(env.TINY_PET_AUTH_PROVIDER, defaultAuthProvider);
  const authUserIdClaim = normalizeAuthIdentifier(env.TINY_PET_AUTH_USER_ID_CLAIM, defaultAuthUserIdClaim);
  const authClockToleranceSeconds = parsePositiveInteger(
    env.TINY_PET_AUTH_CLOCK_TOLERANCE_SECONDS,
    defaultAuthClockToleranceSeconds
  );
  const authJwksCacheTtlMs = parsePositiveInteger(env.TINY_PET_AUTH_JWKS_CACHE_TTL_MS, defaultAuthJwksCacheTtlMs);
  const storageBucket = normalizeStorageBucket(env.TINY_PET_STORAGE_BUCKET);
  const storageRegion = normalizeStorageRegion(env.TINY_PET_STORAGE_REGION);
  const storageAccessKeyId = normalizeRequiredSecret(env.TINY_PET_STORAGE_ACCESS_KEY_ID);
  const storageSecretAccessKey = normalizeRequiredSecret(env.TINY_PET_STORAGE_SECRET_ACCESS_KEY);
  const storageSessionToken = normalizeRequiredSecret(env.TINY_PET_STORAGE_SESSION_TOKEN);
  const storageEndpoint = normalizeStorageEndpoint(env.TINY_PET_STORAGE_ENDPOINT);
  const storageForcePathStyle = parseBoolean(env.TINY_PET_STORAGE_FORCE_PATH_STYLE, false);
  const storageOriginalPhotoPrefix = normalizeStoragePrefix(env.TINY_PET_STORAGE_ORIGINAL_PHOTO_PREFIX);
  const commerceWebhookSecret = normalizeRequiredSecret(env.TINY_PET_COMMERCE_WEBHOOK_SECRET);
  const storeVerifierProviderRaw = env.TINY_PET_STORE_VERIFIER_PROVIDER?.trim().toLowerCase();
  const storeVerifierProvider =
    storeVerifierProviderRaw === undefined || storeVerifierProviderRaw === ""
      ? undefined
      : storeVerifierProviderRaw === "http" || storeVerifierProviderRaw === "direct"
        ? storeVerifierProviderRaw
        : null;
  const storeVerifierEndpoint = normalizeRuntimeHttpsUrl(env.TINY_PET_STORE_VERIFIER_ENDPOINT, production);
  const storeVerifierApiKey = normalizeRequiredSecret(env.TINY_PET_STORE_VERIFIER_API_KEY);
  const appStoreBundleId = normalizeMobilePackageIdentifier(env.TINY_PET_APP_STORE_BUNDLE_ID);
  const appStoreIssuerId = normalizeRequiredSecret(env.TINY_PET_APP_STORE_ISSUER_ID);
  const appStoreKeyId = normalizeRequiredSecret(env.TINY_PET_APP_STORE_KEY_ID);
  const appStorePrivateKey = normalizeRequiredSecret(env.TINY_PET_APP_STORE_PRIVATE_KEY);
  const appStoreEnvironment = normalizeStoreEnvironment(env.TINY_PET_APP_STORE_ENVIRONMENT);
  const appStoreNotificationRootCertificateSha256Fingerprints = normalizeCsvSha256CertificateFingerprints(
    env.TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256
  );
  const appStoreBaseUrl = normalizeRuntimeHttpsUrl(env.TINY_PET_APP_STORE_BASE_URL, production);
  const googlePlayPackageName = normalizeMobilePackageIdentifier(env.TINY_PET_GOOGLE_PLAY_PACKAGE_NAME);
  const googlePlayServiceAccountEmail = normalizeRequiredSecret(env.TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL);
  const googlePlayPrivateKey = normalizeRequiredSecret(env.TINY_PET_GOOGLE_PLAY_PRIVATE_KEY);
  const googlePlaySubscriptionProductIds = normalizeCsvSafeIdentifiers(env.TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS);
  const googlePlayBaseUrl = normalizeRuntimeHttpsUrl(env.TINY_PET_GOOGLE_PLAY_BASE_URL, production);
  const directStoreVerifierRequested =
    storeVerifierProvider === "direct" ||
    Boolean(
      env.TINY_PET_APP_STORE_BUNDLE_ID?.trim() ||
        env.TINY_PET_APP_STORE_ISSUER_ID?.trim() ||
        env.TINY_PET_APP_STORE_KEY_ID?.trim() ||
        env.TINY_PET_APP_STORE_PRIVATE_KEY?.trim() ||
        env.TINY_PET_GOOGLE_PLAY_PACKAGE_NAME?.trim() ||
        env.TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim() ||
        env.TINY_PET_GOOGLE_PLAY_PRIVATE_KEY?.trim()
    );
  const premiumChatApiKey = normalizeRequiredSecret(env.TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY ?? env.OPENAI_API_KEY);
  const premiumChatModelRaw = env.TINY_PET_PREMIUM_CHAT_OPENAI_MODEL?.trim() ?? "";
  const premiumChatModel = normalizeOptionalSafeValue(premiumChatModelRaw, 80);
  const premiumChatBaseUrl = normalizeRuntimeHttpsUrl(env.TINY_PET_PREMIUM_CHAT_OPENAI_BASE_URL, production);
  const premiumChatMaxOutputTokens = parsePositiveInteger(
    env.TINY_PET_PREMIUM_CHAT_OPENAI_MAX_OUTPUT_TOKENS,
    defaultPremiumChatMaxOutputTokens
  );
  const premiumChatRateLimitMaxMessages = parsePositiveInteger(env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES, 10);
  const premiumChatRateLimitWindowMs = parsePositiveInteger(env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS, 60_000);
  const premiumChatContextMessageLimit = parsePositiveInteger(env.TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT, 16);
  const premiumChatRetentionWindowMs = parsePositiveInteger(env.TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS, 2_592_000_000);

  if (env.TINY_PET_DATABASE_URL?.trim() && !databaseUrl) {
    errors.push("TINY_PET_DATABASE_URL must be a valid postgres:// or postgresql:// URL.");
  }

  if (production && !databaseUrl) {
    errors.push("TINY_PET_DATABASE_URL must be set to a non-placeholder production Postgres URL.");
  }

  if (!sslMode) {
    errors.push("TINY_PET_DATABASE_SSL_MODE must be disable, require, or verify-full.");
  } else if (production && sslMode === "disable") {
    errors.push("TINY_PET_DATABASE_SSL_MODE must not be disable for production API deployments.");
  }

  if (!maxPoolSize || maxPoolSize > 100) {
    errors.push("TINY_PET_DATABASE_MAX_POOL_SIZE must be a positive integer no greater than 100.");
  }

  if (!connectTimeoutMs || connectTimeoutMs < 1_000 || connectTimeoutMs > 30_000) {
    errors.push("TINY_PET_DATABASE_CONNECT_TIMEOUT_MS must be between 1000 and 30000 milliseconds.");
  }

  if (env.TINY_PET_AUTH_ISSUER?.trim() && !authIssuer) {
    errors.push("TINY_PET_AUTH_ISSUER must be a valid non-placeholder https URL.");
  }

  if (env.TINY_PET_AUTH_AUDIENCE?.trim() && !authAudience) {
    errors.push("TINY_PET_AUTH_AUDIENCE must be a valid non-placeholder audience string.");
  }

  if (env.TINY_PET_AUTH_JWKS_URL?.trim() && !authJwksUrl) {
    errors.push("TINY_PET_AUTH_JWKS_URL must be a valid non-placeholder https URL.");
  }

  if (!authProvider) {
    errors.push("TINY_PET_AUTH_PROVIDER must be a safe auth provider identifier when set.");
  }

  if (!authUserIdClaim) {
    errors.push("TINY_PET_AUTH_USER_ID_CLAIM must be a safe JWT claim identifier when set.");
  }

  if (!authClockToleranceSeconds || authClockToleranceSeconds > 300) {
    errors.push("TINY_PET_AUTH_CLOCK_TOLERANCE_SECONDS must be a positive integer no greater than 300.");
  }

  if (!authJwksCacheTtlMs || authJwksCacheTtlMs < 1_000 || authJwksCacheTtlMs > 86_400_000) {
    errors.push("TINY_PET_AUTH_JWKS_CACHE_TTL_MS must be between 1000 and 86400000 milliseconds.");
  }

  if (env.TINY_PET_STORAGE_BUCKET?.trim() && !storageBucket) {
    errors.push("TINY_PET_STORAGE_BUCKET must be a valid non-placeholder S3 bucket name.");
  }

  if (env.TINY_PET_STORAGE_REGION?.trim() && !storageRegion) {
    errors.push("TINY_PET_STORAGE_REGION must be a valid S3 region.");
  }

  if (env.TINY_PET_STORAGE_ENDPOINT?.trim() && !storageEndpoint) {
    errors.push("TINY_PET_STORAGE_ENDPOINT must be a valid https URL when set.");
  }

  if (storageForcePathStyle === null) {
    errors.push("TINY_PET_STORAGE_FORCE_PATH_STYLE must be true or false when set.");
  }

  if (!storageOriginalPhotoPrefix) {
    errors.push("TINY_PET_STORAGE_ORIGINAL_PHOTO_PREFIX must contain only safe object-key characters.");
  }

  if (allowMockGenerationPolling === null) {
    errors.push("TINY_PET_API_ALLOW_MOCK_GENERATION_POLLING must be true or false when set.");
  }

  if ((env.TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim()) && !premiumChatApiKey) {
    errors.push("TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY or OPENAI_API_KEY must be a non-placeholder secret when set.");
  }

  if (storeVerifierProvider === null) {
    errors.push("TINY_PET_STORE_VERIFIER_PROVIDER must be http or direct when set.");
  }

  if (env.TINY_PET_STORE_VERIFIER_ENDPOINT?.trim() && !storeVerifierEndpoint) {
    errors.push("TINY_PET_STORE_VERIFIER_ENDPOINT must be a valid non-placeholder https URL.");
  }

  if (env.TINY_PET_STORE_VERIFIER_API_KEY?.trim() && !storeVerifierApiKey) {
    errors.push("TINY_PET_STORE_VERIFIER_API_KEY must be a non-placeholder secret when set.");
  }

  if (!directStoreVerifierRequested && ((storeVerifierEndpoint && !storeVerifierApiKey) || (!storeVerifierEndpoint && storeVerifierApiKey))) {
    errors.push("TINY_PET_STORE_VERIFIER_ENDPOINT and TINY_PET_STORE_VERIFIER_API_KEY must be set together.");
  }

  if (directStoreVerifierRequested) {
    if (!appStoreBundleId) {
      errors.push("TINY_PET_APP_STORE_BUNDLE_ID must be a valid app bundle identifier for direct store verification.");
    }

    if (!appStoreIssuerId) {
      errors.push("TINY_PET_APP_STORE_ISSUER_ID must be set for direct App Store verification.");
    }

    if (!appStoreKeyId) {
      errors.push("TINY_PET_APP_STORE_KEY_ID must be set for direct App Store verification.");
    }

    if (!appStorePrivateKey) {
      errors.push("TINY_PET_APP_STORE_PRIVATE_KEY must be set for direct App Store verification.");
    }

    if (!appStoreEnvironment) {
      errors.push("TINY_PET_APP_STORE_ENVIRONMENT must be sandbox or production when set.");
    }

    if (appStoreNotificationRootCertificateSha256Fingerprints === null) {
      errors.push("TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256 must be one or more SHA-256 certificate fingerprints.");
    }

    if (production && !appStoreNotificationRootCertificateSha256Fingerprints) {
      errors.push(
        "TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256 must be set for direct App Store server notification verification."
      );
    }

    if (env.TINY_PET_APP_STORE_BASE_URL?.trim() && !appStoreBaseUrl) {
      errors.push("TINY_PET_APP_STORE_BASE_URL must be a valid non-placeholder https URL when set.");
    }

    if (!googlePlayPackageName) {
      errors.push("TINY_PET_GOOGLE_PLAY_PACKAGE_NAME must be a valid Android package name for direct store verification.");
    }

    if (!googlePlayServiceAccountEmail) {
      errors.push("TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL must be set for direct Google Play verification.");
    }

    if (!googlePlayPrivateKey) {
      errors.push("TINY_PET_GOOGLE_PLAY_PRIVATE_KEY must be set for direct Google Play verification.");
    }

    if (googlePlaySubscriptionProductIds === null) {
      errors.push("TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS must be a comma-separated list of safe product ids when set.");
    }

    if (production && !googlePlaySubscriptionProductIds) {
      errors.push("TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS must be set for direct Google Play subscription verification.");
    }

    if (env.TINY_PET_GOOGLE_PLAY_BASE_URL?.trim() && !googlePlayBaseUrl) {
      errors.push("TINY_PET_GOOGLE_PLAY_BASE_URL must be a valid non-placeholder https URL when set.");
    }
  }

  if (premiumChatModel === null) {
    errors.push("TINY_PET_PREMIUM_CHAT_OPENAI_MODEL must be a safe model identifier when set.");
  }

  if (env.TINY_PET_PREMIUM_CHAT_OPENAI_BASE_URL?.trim() && !premiumChatBaseUrl) {
    errors.push("TINY_PET_PREMIUM_CHAT_OPENAI_BASE_URL must be a valid non-placeholder https URL when set.");
  }

  if (!premiumChatMaxOutputTokens || premiumChatMaxOutputTokens > 1_000) {
    errors.push("TINY_PET_PREMIUM_CHAT_OPENAI_MAX_OUTPUT_TOKENS must be a positive integer no greater than 1000.");
  }

  if (
    env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES?.trim() &&
    (!premiumChatRateLimitMaxMessages || premiumChatRateLimitMaxMessages > 120)
  ) {
    errors.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES must be a positive integer no greater than 120 when set.");
  }

  if (
    env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS?.trim() &&
    (!premiumChatRateLimitWindowMs || premiumChatRateLimitWindowMs > 86_400_000)
  ) {
    errors.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS must be a positive integer no greater than 86400000 when set.");
  }

  if (
    env.TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT?.trim() &&
    (!premiumChatContextMessageLimit || premiumChatContextMessageLimit > 80)
  ) {
    errors.push("TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT must be a positive integer no greater than 80 when set.");
  }

  if (
    env.TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS?.trim() &&
    (!premiumChatRetentionWindowMs || premiumChatRetentionWindowMs > 31_536_000_000)
  ) {
    errors.push("TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS must be a positive integer no greater than 31536000000 when set.");
  }

  if (production) {
    if (!authIssuer) {
      errors.push("TINY_PET_AUTH_ISSUER must be set to a production auth issuer https URL.");
    }

    if (!authAudience) {
      errors.push("TINY_PET_AUTH_AUDIENCE must be set for production auth verification.");
    }

    if (!authJwksUrl) {
      errors.push("TINY_PET_AUTH_JWKS_URL must be set to a production JWKS https URL.");
    }

    if (!storageBucket) {
      errors.push("TINY_PET_STORAGE_BUCKET must be set to a production private storage bucket.");
    }

    if (!storageRegion) {
      errors.push("TINY_PET_STORAGE_REGION must be set for production private storage signing.");
    }

    if (!storageAccessKeyId) {
      errors.push("TINY_PET_STORAGE_ACCESS_KEY_ID must be set for production private storage signing.");
    }

    if (!storageSecretAccessKey) {
      errors.push("TINY_PET_STORAGE_SECRET_ACCESS_KEY must be set for production private storage signing.");
    }

    if (!commerceWebhookSecret) {
      errors.push("TINY_PET_COMMERCE_WEBHOOK_SECRET must be set for production store webhook verification.");
    }

    if (!directStoreVerifierRequested && (!storeVerifierEndpoint || !storeVerifierApiKey)) {
      errors.push("TINY_PET_STORE_VERIFIER_ENDPOINT and TINY_PET_STORE_VERIFIER_API_KEY must be set for production purchase verification.");
    }

    if (!premiumChatApiKey) {
      errors.push("TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY or OPENAI_API_KEY must be set for production premium chat.");
    }

    if (!premiumChatModelRaw) {
      errors.push("TINY_PET_PREMIUM_CHAT_OPENAI_MODEL must be set for production premium chat model selection.");
    }

    if (!env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES?.trim()) {
      errors.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES must be set for production premium chat turn limits.");
    }

    if (!env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS?.trim()) {
      errors.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS must be set for production premium chat turn limits.");
    }

    if (!env.TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT?.trim()) {
      errors.push("TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT must be set for production premium chat context limits.");
    }

    if (!env.TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS?.trim()) {
      errors.push("TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS must be set for production premium chat retention policy.");
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
      allowMockGenerationPolling: allowMockGenerationPolling ?? false,
      auth:
        authIssuer && authAudience && authJwksUrl && authProvider && authUserIdClaim && authClockToleranceSeconds && authJwksCacheTtlMs
          ? {
              issuer: authIssuer,
              audience: authAudience,
              jwksUrl: authJwksUrl,
              provider: authProvider,
              userIdClaim: authUserIdClaim,
              clockToleranceSeconds: authClockToleranceSeconds,
              jwksCacheTtlMs: authJwksCacheTtlMs
            }
          : null,
      database: databaseUrl
        ? {
            databaseUrl,
            sslMode: sslMode ?? defaultSslMode,
            maxPoolSize: maxPoolSize ?? defaultMaxPoolSize,
            connectTimeoutMs: connectTimeoutMs ?? defaultConnectTimeoutMs
          }
        : null,
      storage:
        storageBucket && storageRegion && storageAccessKeyId && storageSecretAccessKey && storageOriginalPhotoPrefix
          ? {
              bucket: storageBucket,
              region: storageRegion,
              accessKeyId: storageAccessKeyId,
              secretAccessKey: storageSecretAccessKey,
              ...(storageSessionToken ? { sessionToken: storageSessionToken } : {}),
              ...(storageEndpoint ? { endpoint: storageEndpoint } : {}),
              forcePathStyle: storageForcePathStyle ?? false,
              originalPhotoPrefix: storageOriginalPhotoPrefix
          }
          : null,
      commerceWebhookSecret,
      storeVerifier:
        directStoreVerifierRequested &&
        appStoreBundleId &&
        appStoreIssuerId &&
        appStoreKeyId &&
        appStorePrivateKey &&
        appStoreEnvironment &&
        appStoreNotificationRootCertificateSha256Fingerprints !== null &&
        googlePlayPackageName &&
        googlePlayServiceAccountEmail &&
        googlePlayPrivateKey &&
        googlePlaySubscriptionProductIds !== null
          ? {
              provider: "direct",
              appStore: {
                bundleId: appStoreBundleId,
                issuerId: appStoreIssuerId,
                keyId: appStoreKeyId,
                privateKey: appStorePrivateKey,
                environment: appStoreEnvironment,
                ...(appStoreNotificationRootCertificateSha256Fingerprints
                  ? { notificationRootCertificateSha256Fingerprints: appStoreNotificationRootCertificateSha256Fingerprints }
                  : {}),
                ...(appStoreBaseUrl ? { baseUrl: appStoreBaseUrl } : {})
              },
              googlePlay: {
                packageName: googlePlayPackageName,
                serviceAccountClientEmail: googlePlayServiceAccountEmail,
                serviceAccountPrivateKey: googlePlayPrivateKey,
                ...(googlePlaySubscriptionProductIds ? { subscriptionProductIds: googlePlaySubscriptionProductIds } : {}),
                ...(googlePlayBaseUrl ? { baseUrl: googlePlayBaseUrl } : {})
              }
            }
          : storeVerifierEndpoint && storeVerifierApiKey
          ? {
              provider: "http",
              endpoint: storeVerifierEndpoint,
              apiKey: storeVerifierApiKey
            }
          : null,
      premiumChat:
        premiumChatApiKey && premiumChatMaxOutputTokens
          ? {
              provider: "openai",
              apiKey: premiumChatApiKey,
              ...(premiumChatModel ? { model: premiumChatModel } : {}),
              ...(premiumChatBaseUrl ? { baseUrl: premiumChatBaseUrl } : {}),
              maxOutputTokens: premiumChatMaxOutputTokens,
              ...(env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES?.trim() ||
              env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS?.trim() ||
              env.TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT?.trim() ||
              env.TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS?.trim()
                ? {
                    policy: {
                      ...(env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES?.trim()
                        ? { maxUserMessagesPerWindow: premiumChatRateLimitMaxMessages ?? 10 }
                        : {}),
                      ...(env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS?.trim()
                        ? { rateLimitWindowMs: premiumChatRateLimitWindowMs ?? 60_000 }
                        : {}),
                      ...(env.TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT?.trim()
                        ? { contextMessageLimit: premiumChatContextMessageLimit ?? 16 }
                        : {}),
                      ...(env.TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS?.trim()
                        ? { retentionWindowMs: premiumChatRetentionWindowMs ?? 2_592_000_000 }
                        : {})
                    }
                  }
                : {})
            }
          : null
    }
  };
};

export const requireApiRuntimeConfig = (env: ApiRuntimeEnvironment = process.env): ApiRuntimeConfig => {
  const result = readApiRuntimeConfig(env);

  if (result.ok) {
    return result.config;
  }

  throw new Error(`Invalid API runtime config:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
};
