import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const appJsonPath = path.join(rootDir, "apps/mobile/app.json");
const releaseProfile = process.env.TINY_PET_RELEASE_PROFILE ?? "development";
const production = releaseProfile === "production";

const placeholderPattern = /^(todo|tbd|placeholder|replace-me|example@|support@example\.com)/i;

const normalizeUrl = (value) => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname === "example.com" ||
      parsed.hostname.endsWith(".example.com") ||
      parsed.hostname === "localhost"
    ) {
      return null;
    }

    return trimmed;
  } catch {
    return null;
  }
};

const normalizeEmail = (value) => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed || placeholderPattern.test(trimmed) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }

  if (trimmed.endsWith("@example.com")) {
    return null;
  }

  return trimmed;
};

const normalizeBoolean = (value) => {
  const trimmed = value?.trim().toLowerCase();

  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") {
    return true;
  }

  if (trimmed === "false" || trimmed === "0" || trimmed === "no") {
    return false;
  }

  return null;
};

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const expo = appJson.expo ?? {};
const nativeIosBundleIdentifier = typeof expo.ios?.bundleIdentifier === "string" ? expo.ios.bundleIdentifier.trim() : "";
const nativeAndroidPackage = typeof expo.android?.package === "string" ? expo.android.package.trim() : "";
const failures = [];

const publicConfig = {
  EXPO_PUBLIC_TINY_PET_PRIVACY_URL: normalizeUrl(process.env.EXPO_PUBLIC_TINY_PET_PRIVACY_URL),
  EXPO_PUBLIC_TINY_PET_TERMS_URL: normalizeUrl(process.env.EXPO_PUBLIC_TINY_PET_TERMS_URL),
  EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL: normalizeEmail(process.env.EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL)
};
const developmentAuthFallback = normalizeBoolean(process.env.EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK);
const devUnlockStore = normalizeBoolean(process.env.EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE);
const nativeCheckoutEnabledRaw = process.env.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT?.trim() ?? "";
const nativeCheckoutEnabled = nativeCheckoutEnabledRaw ? normalizeBoolean(nativeCheckoutEnabledRaw) : false;
const apiBaseUrl = normalizeUrl(process.env.EXPO_PUBLIC_TINY_PET_API_BASE_URL);
const mockAuthToken = process.env.EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN?.trim() ?? "";
const storeScreenshotPreset = process.env.EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET?.trim() ?? "";
const qaScreenPreset = process.env.EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET?.trim() ?? "";
const apiMockAuth = normalizeBoolean(process.env.TINY_PET_API_ALLOW_MOCK_AUTH);
const apiMockPurchases = normalizeBoolean(process.env.TINY_PET_API_ALLOW_MOCK_PURCHASES);
const apiMockStorage = normalizeBoolean(process.env.TINY_PET_API_ALLOW_MOCK_STORAGE);
const apiMockGenerationPolling = normalizeBoolean(process.env.TINY_PET_API_ALLOW_MOCK_GENERATION_POLLING);
const apiHost = process.env.TINY_PET_API_HOST?.trim() ?? "";
const apiPort = process.env.TINY_PET_API_PORT?.trim() ?? "";
const apiAllowedOrigins = process.env.TINY_PET_API_ALLOWED_ORIGINS?.trim() ?? "";
const apiMaxBodyBytes = process.env.TINY_PET_API_MAX_BODY_BYTES?.trim() ?? "";
const apiRateLimitWindowMs = process.env.TINY_PET_API_RATE_LIMIT_WINDOW_MS?.trim() ?? "";
const apiRateLimitMaxRequests = process.env.TINY_PET_API_RATE_LIMIT_MAX_REQUESTS?.trim() ?? "";
const apiServiceName = process.env.TINY_PET_API_SERVICE_NAME?.trim() ?? "";
const operationalAlertRouting = process.env.TINY_PET_OPERATIONAL_ALERT_ROUTING?.trim().toLowerCase() ?? "";
const operationalAlertWebhookUrl = normalizeUrl(process.env.TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL);
const operationalAlertWebhookBearerToken = process.env.TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN?.trim() ?? "";
const operationalAlertWebhookTimeoutMs = process.env.TINY_PET_OPERATIONAL_ALERT_WEBHOOK_TIMEOUT_MS?.trim() ?? "";
const authIssuer = normalizeUrl(process.env.TINY_PET_AUTH_ISSUER);
const authAudience = process.env.TINY_PET_AUTH_AUDIENCE?.trim() ?? "";
const authJwksUrl = normalizeUrl(process.env.TINY_PET_AUTH_JWKS_URL);
const authProvider = process.env.TINY_PET_AUTH_PROVIDER?.trim() ?? "";
const authUserIdClaim = process.env.TINY_PET_AUTH_USER_ID_CLAIM?.trim() ?? "";
const authClockToleranceSeconds = process.env.TINY_PET_AUTH_CLOCK_TOLERANCE_SECONDS?.trim() ?? "";
const authJwksCacheTtlMs = process.env.TINY_PET_AUTH_JWKS_CACHE_TTL_MS?.trim() ?? "";
const databaseUrl = process.env.TINY_PET_DATABASE_URL?.trim() ?? "";
const databaseSslMode = process.env.TINY_PET_DATABASE_SSL_MODE?.trim().toLowerCase() ?? "require";
const databaseMaxPoolSize = process.env.TINY_PET_DATABASE_MAX_POOL_SIZE?.trim() ?? "";
const databaseConnectTimeoutMs = process.env.TINY_PET_DATABASE_CONNECT_TIMEOUT_MS?.trim() ?? "";
const storageBucket = process.env.TINY_PET_STORAGE_BUCKET?.trim() ?? "";
const storageRegion = process.env.TINY_PET_STORAGE_REGION?.trim() ?? "";
const storageAccessKeyId = process.env.TINY_PET_STORAGE_ACCESS_KEY_ID?.trim() ?? "";
const storageSecretAccessKey = process.env.TINY_PET_STORAGE_SECRET_ACCESS_KEY?.trim() ?? "";
const storageSessionToken = process.env.TINY_PET_STORAGE_SESSION_TOKEN?.trim() ?? "";
const storageEndpoint = process.env.TINY_PET_STORAGE_ENDPOINT?.trim() ?? "";
const storageForcePathStyle = process.env.TINY_PET_STORAGE_FORCE_PATH_STYLE?.trim() ?? "";
const storageOriginalPhotoPrefix = process.env.TINY_PET_STORAGE_ORIGINAL_PHOTO_PREFIX?.trim() ?? "";
const commerceWebhookSecret = process.env.TINY_PET_COMMERCE_WEBHOOK_SECRET?.trim() ?? "";
const storeVerifierProvider = process.env.TINY_PET_STORE_VERIFIER_PROVIDER?.trim().toLowerCase() ?? "";
const storeVerifierEndpoint = process.env.TINY_PET_STORE_VERIFIER_ENDPOINT?.trim() ?? "";
const storeVerifierApiKey = process.env.TINY_PET_STORE_VERIFIER_API_KEY?.trim() ?? "";
const appStoreBundleId = process.env.TINY_PET_APP_STORE_BUNDLE_ID?.trim() ?? "";
const appStoreIssuerId = process.env.TINY_PET_APP_STORE_ISSUER_ID?.trim() ?? "";
const appStoreKeyId = process.env.TINY_PET_APP_STORE_KEY_ID?.trim() ?? "";
const appStorePrivateKey = process.env.TINY_PET_APP_STORE_PRIVATE_KEY?.trim() ?? "";
const appStoreEnvironment = process.env.TINY_PET_APP_STORE_ENVIRONMENT?.trim().toLowerCase() ?? "production";
const appStoreNotificationRootCertificateSha256 = process.env.TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256?.trim() ?? "";
const appStoreBaseUrl = process.env.TINY_PET_APP_STORE_BASE_URL?.trim() ?? "";
const googlePlayPackageName = process.env.TINY_PET_GOOGLE_PLAY_PACKAGE_NAME?.trim() ?? "";
const googlePlayServiceAccountEmail = process.env.TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
const googlePlayPrivateKey = process.env.TINY_PET_GOOGLE_PLAY_PRIVATE_KEY?.trim() ?? "";
const googlePlaySubscriptionProductIds = process.env.TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS?.trim() ?? "";
const googlePlayBaseUrl = process.env.TINY_PET_GOOGLE_PLAY_BASE_URL?.trim() ?? "";
const premiumChatOpenAiApiKey =
  (process.env.TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY)?.trim() ?? "";
const premiumChatOpenAiModel = process.env.TINY_PET_PREMIUM_CHAT_OPENAI_MODEL?.trim() ?? "";
const premiumChatOpenAiBaseUrl = process.env.TINY_PET_PREMIUM_CHAT_OPENAI_BASE_URL?.trim() ?? "";
const premiumChatOpenAiMaxOutputTokens = process.env.TINY_PET_PREMIUM_CHAT_OPENAI_MAX_OUTPUT_TOKENS?.trim() ?? "";
const premiumChatRateLimitMaxMessages = process.env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES?.trim() ?? "";
const premiumChatRateLimitWindowMs = process.env.TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS?.trim() ?? "";
const premiumChatContextMessageLimit = process.env.TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT?.trim() ?? "";
const premiumChatRetentionWindowMs = process.env.TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS?.trim() ?? "";
const workerDatabaseUrl = (process.env.TINY_PET_WORKER_DATABASE_URL ?? process.env.TINY_PET_DATABASE_URL)?.trim() ?? "";
const workerDatabaseSslMode = (process.env.TINY_PET_WORKER_DATABASE_SSL_MODE ?? process.env.TINY_PET_DATABASE_SSL_MODE)?.trim().toLowerCase() ?? "require";
const workerDatabaseMaxPoolSize = process.env.TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE?.trim() ?? "";
const workerDatabaseConnectTimeoutMs = process.env.TINY_PET_WORKER_DATABASE_CONNECT_TIMEOUT_MS?.trim() ?? "";
const workerStorageBucket = (process.env.TINY_PET_WORKER_STORAGE_BUCKET ?? process.env.TINY_PET_STORAGE_BUCKET)?.trim() ?? "";
const workerStorageRegion = (process.env.TINY_PET_WORKER_STORAGE_REGION ?? process.env.TINY_PET_STORAGE_REGION)?.trim() ?? "";
const workerStorageAccessKeyId =
  (process.env.TINY_PET_WORKER_STORAGE_ACCESS_KEY_ID ?? process.env.TINY_PET_STORAGE_ACCESS_KEY_ID)?.trim() ?? "";
const workerStorageSecretAccessKey =
  (process.env.TINY_PET_WORKER_STORAGE_SECRET_ACCESS_KEY ?? process.env.TINY_PET_STORAGE_SECRET_ACCESS_KEY)?.trim() ?? "";
const workerStorageSessionToken =
  (process.env.TINY_PET_WORKER_STORAGE_SESSION_TOKEN ?? process.env.TINY_PET_STORAGE_SESSION_TOKEN)?.trim() ?? "";
const workerStorageEndpoint = (process.env.TINY_PET_WORKER_STORAGE_ENDPOINT ?? process.env.TINY_PET_STORAGE_ENDPOINT)?.trim() ?? "";
const workerStorageForcePathStyle =
  (process.env.TINY_PET_WORKER_STORAGE_FORCE_PATH_STYLE ?? process.env.TINY_PET_STORAGE_FORCE_PATH_STYLE)?.trim() ?? "";
const workerStorageGeneratedAssetPrefix = process.env.TINY_PET_WORKER_STORAGE_GENERATED_ASSET_PREFIX?.trim() ?? "";
const workerGenerationProvider = process.env.TINY_PET_WORKER_GENERATION_PROVIDER?.trim().toLowerCase() ?? "";
const workerProviderApiKey = process.env.TINY_PET_WORKER_PROVIDER_API_KEY?.trim() ?? "";
const workerProviderModel = process.env.TINY_PET_WORKER_PROVIDER_MODEL?.trim() ?? "";
const workerProviderSafetyModel = process.env.TINY_PET_WORKER_PROVIDER_SAFETY_MODEL?.trim() ?? "";
const workerQualityMinPetVisibilityConfidence =
  process.env.TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE?.trim() ?? "";
const workerQualityMinStyleMatchScore = process.env.TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE?.trim() ?? "";
const workerQualityMinProviderConfidence = process.env.TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE?.trim() ?? "";
const workerQualityCalibrationId = process.env.TINY_PET_WORKER_QUALITY_CALIBRATION_ID?.trim() ?? "";
const workerProcessMode = process.env.TINY_PET_WORKER_PROCESS_MODE?.trim().toLowerCase() ?? "";
const workerPollIntervalMs = process.env.TINY_PET_WORKER_POLL_INTERVAL_MS?.trim() ?? "";
const workerMaxRuns = process.env.TINY_PET_WORKER_MAX_RUNS?.trim() ?? "";
const workerMaxJobsPerRun = process.env.TINY_PET_WORKER_MAX_JOBS_PER_RUN?.trim() ?? "";
const workerStopOnIdle = process.env.TINY_PET_WORKER_STOP_ON_IDLE?.trim() ?? "";
const workerStopOnFailure = process.env.TINY_PET_WORKER_STOP_ON_FAILURE?.trim() ?? "";
const workerStopProcessOnFailure = process.env.TINY_PET_WORKER_STOP_PROCESS_ON_FAILURE?.trim() ?? "";
const privacyWorkerProcessMode = process.env.TINY_PET_PRIVACY_WORKER_PROCESS_MODE?.trim().toLowerCase() ?? "";
const privacyWorkerPollIntervalMs = process.env.TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS?.trim() ?? "";
const privacyWorkerMaxRuns = process.env.TINY_PET_PRIVACY_WORKER_MAX_RUNS?.trim() ?? "";
const privacyWorkerStopOnIdle = process.env.TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE?.trim() ?? "";
const privacyWorkerStopProcessOnFailure = process.env.TINY_PET_PRIVACY_WORKER_STOP_PROCESS_ON_FAILURE?.trim() ?? "";
const outboxWorkerProcessMode = process.env.TINY_PET_OUTBOX_WORKER_PROCESS_MODE?.trim().toLowerCase() ?? "";
const outboxWorkerPollIntervalMs = process.env.TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS?.trim() ?? "";
const outboxWorkerMaxRuns = process.env.TINY_PET_OUTBOX_WORKER_MAX_RUNS?.trim() ?? "";
const outboxWorkerStopOnIdle = process.env.TINY_PET_OUTBOX_WORKER_STOP_ON_IDLE?.trim() ?? "";
const outboxWorkerStopProcessOnFailure = process.env.TINY_PET_OUTBOX_WORKER_STOP_PROCESS_ON_FAILURE?.trim() ?? "";
const chatRetentionWorkerProcessMode = process.env.TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE?.trim().toLowerCase() ?? "";
const chatRetentionWorkerPollIntervalMs = process.env.TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS?.trim() ?? "";
const chatRetentionWorkerMaxRuns = process.env.TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS?.trim() ?? "";
const chatRetentionWorkerBatchSize = process.env.TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE?.trim() ?? "";
const chatRetentionWorkerRetentionWindowMs = process.env.TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS?.trim() ?? "";
const chatRetentionWorkerStopOnIdle = process.env.TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE?.trim() ?? "";

const isProductionDatabaseUrl = (value) => {
  if (!value || placeholderPattern.test(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);

    return (
      (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1" &&
      parsed.hostname !== "::1" &&
      parsed.hostname !== "example.com" &&
      !parsed.hostname.endsWith(".example.com")
    );
  } catch {
    return false;
  }
};

const isProductionStorageBucket = (value) =>
  !!value && !placeholderPattern.test(value) && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value);

const isStorageRegion = (value) => !!value && !placeholderPattern.test(value) && /^[a-z]{2}[-a-z0-9]+-\d$/.test(value);

const isProductionSecret = (value) => !!value && !placeholderPattern.test(value);

const isProductionAuthAudience = (value) =>
  !!value && !/^(todo|tbd|placeholder|replace-me|example)$/i.test(value) && !/[\u0000-\u001f\s]/.test(value);

const isSafeCalibrationId = (value) =>
  !!value && !placeholderPattern.test(value) && /^[A-Za-z0-9][A-Za-z0-9_.:-]{5,159}$/.test(value);

const isMobilePackageIdentifier = (value) =>
  !!value &&
  !placeholderPattern.test(value) &&
  value.length <= 220 &&
  /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value);

const isOptionalStoreEnvironment = (value) => !value || value === "sandbox" || value === "production";

const isOptionalProductIdList = (value) => {
  if (!value) {
    return true;
  }

  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 && values.length <= 40 && values.every((item) => /^[A-Za-z0-9_.:-]{1,160}$/.test(item));
};

const isSha256CertificateFingerprintList = (value) => {
  if (!value) {
    return false;
  }

  const values = value
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/^sha256:/, "").replace(/:/g, ""))
    .filter(Boolean);

  return values.length > 0 && values.length <= 8 && values.every((item) => /^[a-f0-9]{64}$/.test(item));
};

const isHttpsEndpoint = (value) => {
  if (!value) {
    return true;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const isOptionalUnitIntervalNumber = (value) => {
  if (!value) {
    return true;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
};

const isOptionalPositiveIntegerAtMost = (value, max) => {
  if (!value) {
    return true;
  }

  if (!/^\d+$/.test(value)) {
    return false;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max;
};

const isOptionalIntegerBetween = (value, min, max) => {
  if (!value) {
    return true;
  }

  if (!/^\d+$/.test(value)) {
    return false;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max;
};

const isOptionalHost = (value) => !value || (value.length <= 255 && !/[\u0000-\u001f\s]/.test(value));

const isOptionalServiceName = (value) => !value || /^[A-Za-z0-9_.:-]{1,96}$/.test(value);
const isOptionalOperationalAlertRouting = (value) => !value || value === "json_logs" || value === "webhook";
const isOptionalSafeRuntimeValue = (value, maxLength = 160) =>
  !value || (!placeholderPattern.test(value) && value.length <= maxLength && !/[\u0000-\u001f]/.test(value));
const isOptionalStoragePrefix = (value) =>
  !value || /^[A-Za-z0-9_.\/-]{1,160}$/.test(value.trim().replace(/^\/+|\/+$/g, ""));
const isOptionalProductionSecret = (value) => !value || isProductionSecret(value);
const normalizePresetKey = (value) => value.trim().toLowerCase().replace(/_/g, "-");
const validStoreScreenshotPresetKeys = new Set([
  "welcome",
  "onboarding",
  "pet-setup",
  "setup",
  "photo-upload",
  "photo",
  "hatching",
  "hatch",
  "generation",
  "pet-reveal",
  "reveal",
  "terrarium",
  "main-terrarium",
  "chat",
  "ai-chat",
  "premium-bond",
  "shop"
]);
const validQaScreenPresetKeys = new Set([
  "settings-privacy-error",
  "settings-error",
  "privacy-error",
  "settings-privacy-progress",
  "settings-progress",
  "privacy-progress",
  "settings-privacy-syncing",
  "privacy-syncing"
]);

const isOptionalHttpOriginList = (value) => {
  if (!value) {
    return true;
  }

  return value.split(",").every((item) => {
    const trimmed = item.trim().replace(/\/$/g, "");

    if (!trimmed) {
      return false;
    }

    try {
      const parsed = new URL(trimmed);

      return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.pathname === "/" && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  });
};

const isOptionalWorkerProcessMode = (value) => !value || value === "once" || value === "poll";
const isOptionalBoolean = (value) => !value || normalizeBoolean(value) !== null;

if (!isOptionalHost(apiHost)) {
  failures.push("TINY_PET_API_HOST must be a host name or IP address without whitespace when set.");
}

if (!isOptionalIntegerBetween(apiPort, 0, 65535)) {
  failures.push("TINY_PET_API_PORT must be an integer from 0 to 65535 when set.");
}

if (!isOptionalHttpOriginList(apiAllowedOrigins)) {
  failures.push("TINY_PET_API_ALLOWED_ORIGINS must be a comma-separated list of http(s) origins without paths when set.");
}

if (!isOptionalIntegerBetween(apiMaxBodyBytes, 1, 20971520)) {
  failures.push("TINY_PET_API_MAX_BODY_BYTES must be a positive integer no greater than 20971520 when set.");
}

if (!isOptionalIntegerBetween(apiRateLimitWindowMs, 1, 86400000)) {
  failures.push("TINY_PET_API_RATE_LIMIT_WINDOW_MS must be a positive integer no greater than 86400000 when set.");
}

if (!isOptionalIntegerBetween(apiRateLimitMaxRequests, 1, 100000)) {
  failures.push("TINY_PET_API_RATE_LIMIT_MAX_REQUESTS must be a positive integer no greater than 100000 when set.");
}

if (Boolean(apiRateLimitWindowMs) !== Boolean(apiRateLimitMaxRequests)) {
  failures.push("TINY_PET_API_RATE_LIMIT_WINDOW_MS and TINY_PET_API_RATE_LIMIT_MAX_REQUESTS must be set together.");
}

if (!isOptionalServiceName(apiServiceName)) {
  failures.push("TINY_PET_API_SERVICE_NAME must be a safe service identifier when set.");
}

if (!isOptionalOperationalAlertRouting(operationalAlertRouting)) {
  failures.push("TINY_PET_OPERATIONAL_ALERT_ROUTING must be json_logs or webhook when set.");
}

if (operationalAlertRouting === "webhook") {
  if (!operationalAlertWebhookUrl) {
    failures.push("TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL must be set to an https URL when alert routing is webhook.");
  }

  if (!isProductionSecret(operationalAlertWebhookBearerToken) || operationalAlertWebhookBearerToken.length < 16) {
    failures.push("TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN must be set for webhook alert routing.");
  }
} else if (!isHttpsEndpoint(operationalAlertWebhookUrl)) {
  failures.push("TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL must be a valid https URL when set.");
}

if (!isOptionalIntegerBetween(operationalAlertWebhookTimeoutMs, 500, 30000)) {
  failures.push("TINY_PET_OPERATIONAL_ALERT_WEBHOOK_TIMEOUT_MS must be between 500 and 30000 milliseconds when set.");
}

if (!isOptionalServiceName(authProvider)) {
  failures.push("TINY_PET_AUTH_PROVIDER must be a safe auth provider identifier when set.");
}

if (!isOptionalServiceName(authUserIdClaim)) {
  failures.push("TINY_PET_AUTH_USER_ID_CLAIM must be a safe JWT claim identifier when set.");
}

if (!isOptionalPositiveIntegerAtMost(authClockToleranceSeconds, 300)) {
  failures.push("TINY_PET_AUTH_CLOCK_TOLERANCE_SECONDS must be a positive integer no greater than 300 when set.");
}

if (!isOptionalIntegerBetween(authJwksCacheTtlMs, 1000, 86400000)) {
  failures.push("TINY_PET_AUTH_JWKS_CACHE_TTL_MS must be between 1000 and 86400000 milliseconds when set.");
}

if (!isOptionalPositiveIntegerAtMost(databaseMaxPoolSize, 100)) {
  failures.push("TINY_PET_DATABASE_MAX_POOL_SIZE must be a positive integer no greater than 100 when set.");
}

if (!isOptionalIntegerBetween(databaseConnectTimeoutMs, 1000, 30000)) {
  failures.push("TINY_PET_DATABASE_CONNECT_TIMEOUT_MS must be between 1000 and 30000 milliseconds when set.");
}

if (!isOptionalProductionSecret(storageSessionToken)) {
  failures.push("TINY_PET_STORAGE_SESSION_TOKEN must be a non-placeholder secret when set.");
}

if (!isOptionalBoolean(storageForcePathStyle)) {
  failures.push("TINY_PET_STORAGE_FORCE_PATH_STYLE must be true or false when set.");
}

if (!isOptionalStoragePrefix(storageOriginalPhotoPrefix)) {
  failures.push("TINY_PET_STORAGE_ORIGINAL_PHOTO_PREFIX must contain only safe object-key characters when set.");
}

if (!isOptionalSafeRuntimeValue(premiumChatOpenAiModel, 80)) {
  failures.push("TINY_PET_PREMIUM_CHAT_OPENAI_MODEL must be a safe model identifier when set.");
}

if (!isOptionalPositiveIntegerAtMost(workerDatabaseMaxPoolSize, 50)) {
  failures.push("TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE must be a positive integer no greater than 50 when set.");
}

if (!isOptionalIntegerBetween(workerDatabaseConnectTimeoutMs, 1000, 30000)) {
  failures.push("TINY_PET_WORKER_DATABASE_CONNECT_TIMEOUT_MS must be between 1000 and 30000 milliseconds when set.");
}

if (!isOptionalProductionSecret(workerStorageSessionToken)) {
  failures.push("TINY_PET_WORKER_STORAGE_SESSION_TOKEN must be a non-placeholder secret when set.");
}

if (!isOptionalBoolean(workerStorageForcePathStyle)) {
  failures.push("TINY_PET_WORKER_STORAGE_FORCE_PATH_STYLE must be true or false when set.");
}

if (!isOptionalStoragePrefix(workerStorageGeneratedAssetPrefix)) {
  failures.push("TINY_PET_WORKER_STORAGE_GENERATED_ASSET_PREFIX must contain only safe object-key characters when set.");
}

if (!isOptionalSafeRuntimeValue(workerProviderModel)) {
  failures.push("TINY_PET_WORKER_PROVIDER_MODEL must be a safe model identifier when set.");
}

if (!isOptionalSafeRuntimeValue(workerProviderSafetyModel)) {
  failures.push("TINY_PET_WORKER_PROVIDER_SAFETY_MODEL must be a safe model identifier when set.");
}

if (storeScreenshotPreset && !validStoreScreenshotPresetKeys.has(normalizePresetKey(storeScreenshotPreset))) {
  failures.push("EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET must be a supported store screenshot preset when set.");
}

if (qaScreenPreset && !validQaScreenPresetKeys.has(normalizePresetKey(qaScreenPreset))) {
  failures.push("EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET must be a supported QA screen preset when set.");
}

if (production) {
  for (const [key, value] of Object.entries(publicConfig)) {
    if (!value) {
      failures.push(`${key} must be set to a non-placeholder production value.`);
    }
  }

  if (developmentAuthFallback !== false) {
    failures.push("EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK must be set to false for production builds.");
  }

  if (devUnlockStore === true) {
    failures.push("EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE must not be set to true for production builds.");
  }

  if (mockAuthToken) {
    failures.push("EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN must not be set for production builds.");
  }

  if (storeScreenshotPreset) {
    failures.push("EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET must not be set for production builds.");
  }

  if (qaScreenPreset) {
    failures.push("EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET must not be set for production builds.");
  }

  if (nativeCheckoutEnabledRaw && nativeCheckoutEnabled === null) {
    failures.push("EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT must be a boolean value when set.");
  }

  if (!apiBaseUrl) {
    failures.push("EXPO_PUBLIC_TINY_PET_API_BASE_URL must be set to a production https URL for production builds.");
  }

  if (!apiRateLimitWindowMs || !apiRateLimitMaxRequests) {
    failures.push("TINY_PET_API_RATE_LIMIT_WINDOW_MS and TINY_PET_API_RATE_LIMIT_MAX_REQUESTS must be set for production API throttling.");
  }

  if (apiMockAuth !== false) {
    failures.push("TINY_PET_API_ALLOW_MOCK_AUTH must be set to false for production API deployments.");
  }

  if (apiMockPurchases !== false) {
    failures.push("TINY_PET_API_ALLOW_MOCK_PURCHASES must be set to false for production API deployments.");
  }

  if (apiMockStorage !== false) {
    failures.push("TINY_PET_API_ALLOW_MOCK_STORAGE must be set to false for production API deployments.");
  }

  if (apiMockGenerationPolling !== false) {
    failures.push("TINY_PET_API_ALLOW_MOCK_GENERATION_POLLING must be set to false for production API deployments.");
  }

  if (!operationalAlertRouting) {
    failures.push("TINY_PET_OPERATIONAL_ALERT_ROUTING must be set to json_logs or webhook for production alert routing.");
  }

  if (!authIssuer) {
    failures.push("TINY_PET_AUTH_ISSUER must be set to a production auth issuer https URL.");
  }

  if (!isProductionAuthAudience(authAudience)) {
    failures.push("TINY_PET_AUTH_AUDIENCE must be set for production auth verification.");
  }

  if (!authJwksUrl) {
    failures.push("TINY_PET_AUTH_JWKS_URL must be set to a production JWKS https URL.");
  }

  if (!isProductionDatabaseUrl(databaseUrl)) {
    failures.push("TINY_PET_DATABASE_URL must be set to a non-placeholder production Postgres URL.");
  }

  if (databaseSslMode === "disable") {
    failures.push("TINY_PET_DATABASE_SSL_MODE must not be disable for production API deployments.");
  }

  if (!isProductionStorageBucket(storageBucket)) {
    failures.push("TINY_PET_STORAGE_BUCKET must be set to a production private storage bucket.");
  }

  if (!isStorageRegion(storageRegion)) {
    failures.push("TINY_PET_STORAGE_REGION must be set for production private storage signing.");
  }

  if (!isProductionSecret(storageAccessKeyId)) {
    failures.push("TINY_PET_STORAGE_ACCESS_KEY_ID must be set for production private storage signing.");
  }

  if (!isProductionSecret(storageSecretAccessKey)) {
    failures.push("TINY_PET_STORAGE_SECRET_ACCESS_KEY must be set for production private storage signing.");
  }

  if (!isHttpsEndpoint(storageEndpoint)) {
    failures.push("TINY_PET_STORAGE_ENDPOINT must be a valid https URL when set.");
  }

  if (!isProductionSecret(commerceWebhookSecret) || commerceWebhookSecret.length < 16) {
    failures.push("TINY_PET_COMMERCE_WEBHOOK_SECRET must be set for production store webhook verification.");
  }

  const directStoreVerifierRequested =
    storeVerifierProvider === "direct" ||
    Boolean(
      appStoreBundleId ||
        appStoreIssuerId ||
        appStoreKeyId ||
        appStorePrivateKey ||
        googlePlayPackageName ||
        googlePlayServiceAccountEmail ||
        googlePlayPrivateKey
    );
  const httpStoreVerifierRequested = storeVerifierProvider === "http" || Boolean(storeVerifierEndpoint || storeVerifierApiKey);

  if (storeVerifierProvider && storeVerifierProvider !== "http" && storeVerifierProvider !== "direct") {
    failures.push("TINY_PET_STORE_VERIFIER_PROVIDER must be http or direct when set.");
  }

  if (directStoreVerifierRequested) {
    if (!isMobilePackageIdentifier(appStoreBundleId)) {
      failures.push("TINY_PET_APP_STORE_BUNDLE_ID must be a valid app bundle identifier for direct store verification.");
    }

    if (appStoreBundleId && nativeIosBundleIdentifier && appStoreBundleId !== nativeIosBundleIdentifier) {
      failures.push("TINY_PET_APP_STORE_BUNDLE_ID must match expo.ios.bundleIdentifier for production direct store verification.");
    }

    if (!isProductionSecret(appStoreIssuerId)) {
      failures.push("TINY_PET_APP_STORE_ISSUER_ID must be set for direct App Store verification.");
    }

    if (!isProductionSecret(appStoreKeyId)) {
      failures.push("TINY_PET_APP_STORE_KEY_ID must be set for direct App Store verification.");
    }

    if (!isProductionSecret(appStorePrivateKey) || appStorePrivateKey.length < 16) {
      failures.push("TINY_PET_APP_STORE_PRIVATE_KEY must be set for direct App Store verification.");
    }

    if (!isOptionalStoreEnvironment(appStoreEnvironment)) {
      failures.push("TINY_PET_APP_STORE_ENVIRONMENT must be sandbox or production when set.");
    }

    if (!isSha256CertificateFingerprintList(appStoreNotificationRootCertificateSha256)) {
      failures.push(
        "TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256 must be set for direct App Store server notification verification."
      );
    }

    if (!isHttpsEndpoint(appStoreBaseUrl)) {
      failures.push("TINY_PET_APP_STORE_BASE_URL must be a valid https URL when set.");
    }

    if (!isMobilePackageIdentifier(googlePlayPackageName)) {
      failures.push("TINY_PET_GOOGLE_PLAY_PACKAGE_NAME must be a valid Android package name for direct store verification.");
    }

    if (googlePlayPackageName && nativeAndroidPackage && googlePlayPackageName !== nativeAndroidPackage) {
      failures.push("TINY_PET_GOOGLE_PLAY_PACKAGE_NAME must match expo.android.package for production direct store verification.");
    }

    if (!isProductionSecret(googlePlayServiceAccountEmail)) {
      failures.push("TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL must be set for direct Google Play verification.");
    }

    if (!isProductionSecret(googlePlayPrivateKey) || googlePlayPrivateKey.length < 16) {
      failures.push("TINY_PET_GOOGLE_PLAY_PRIVATE_KEY must be set for direct Google Play verification.");
    }

    if (!isOptionalProductIdList(googlePlaySubscriptionProductIds)) {
      failures.push("TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS must be a comma-separated list of safe product ids when set.");
    }

    if (!googlePlaySubscriptionProductIds) {
      failures.push("TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS must be set for direct Google Play subscription verification.");
    }

    if (!isHttpsEndpoint(googlePlayBaseUrl)) {
      failures.push("TINY_PET_GOOGLE_PLAY_BASE_URL must be a valid https URL when set.");
    }
  }

  if (!directStoreVerifierRequested && (!normalizeUrl(storeVerifierEndpoint) || !isProductionSecret(storeVerifierApiKey) || storeVerifierApiKey.length < 16)) {
    failures.push("TINY_PET_STORE_VERIFIER_ENDPOINT and TINY_PET_STORE_VERIFIER_API_KEY must be set for production purchase verification.");
  }

  if (!isProductionSecret(premiumChatOpenAiApiKey)) {
    failures.push("TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY or OPENAI_API_KEY must be set for production premium chat.");
  }

  if (!premiumChatOpenAiModel) {
    failures.push("TINY_PET_PREMIUM_CHAT_OPENAI_MODEL must be set for production premium chat model selection.");
  }

  if (!premiumChatRateLimitMaxMessages) {
    failures.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES must be set for production premium chat turn limits.");
  }

  if (!premiumChatRateLimitWindowMs) {
    failures.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS must be set for production premium chat turn limits.");
  }

  if (!premiumChatContextMessageLimit) {
    failures.push("TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT must be set for production premium chat context limits.");
  }

  if (!premiumChatRetentionWindowMs) {
    failures.push("TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS must be set for production premium chat retention policy.");
  }

  if (!isHttpsEndpoint(premiumChatOpenAiBaseUrl)) {
    failures.push("TINY_PET_PREMIUM_CHAT_OPENAI_BASE_URL must be a valid https URL when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(premiumChatOpenAiMaxOutputTokens, 1000)) {
    failures.push("TINY_PET_PREMIUM_CHAT_OPENAI_MAX_OUTPUT_TOKENS must be a positive integer no greater than 1000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(premiumChatRateLimitMaxMessages, 120)) {
    failures.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES must be a positive integer no greater than 120 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(premiumChatRateLimitWindowMs, 86400000)) {
    failures.push("TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS must be a positive integer no greater than 86400000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(premiumChatContextMessageLimit, 80)) {
    failures.push("TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT must be a positive integer no greater than 80 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(premiumChatRetentionWindowMs, 31536000000)) {
    failures.push("TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS must be a positive integer no greater than 31536000000 when set.");
  }

  if (!isProductionDatabaseUrl(workerDatabaseUrl)) {
    failures.push("TINY_PET_WORKER_DATABASE_URL must be set to a non-placeholder production Postgres URL.");
  }

  if (workerDatabaseSslMode === "disable") {
    failures.push("TINY_PET_WORKER_DATABASE_SSL_MODE must not be disable for production worker deployments.");
  }

  if (!isProductionStorageBucket(workerStorageBucket)) {
    failures.push("TINY_PET_WORKER_STORAGE_BUCKET must be set to a production private storage bucket.");
  }

  if (!isStorageRegion(workerStorageRegion)) {
    failures.push("TINY_PET_WORKER_STORAGE_REGION must be set for production worker private storage.");
  }

  if (!isProductionSecret(workerStorageAccessKeyId)) {
    failures.push("TINY_PET_WORKER_STORAGE_ACCESS_KEY_ID must be set for production worker private storage.");
  }

  if (!isProductionSecret(workerStorageSecretAccessKey)) {
    failures.push("TINY_PET_WORKER_STORAGE_SECRET_ACCESS_KEY must be set for production worker private storage.");
  }

  if (!isHttpsEndpoint(workerStorageEndpoint)) {
    failures.push("TINY_PET_WORKER_STORAGE_ENDPOINT must be a valid https URL when set.");
  }

  if (workerGenerationProvider !== "openai" && workerGenerationProvider !== "other") {
    failures.push("TINY_PET_WORKER_GENERATION_PROVIDER must be set to openai or other for production generation.");
  }

  if (!isProductionSecret(workerProviderApiKey)) {
    failures.push("TINY_PET_WORKER_PROVIDER_API_KEY must be set for production generation.");
  }

  if (!workerProviderModel) {
    failures.push("TINY_PET_WORKER_PROVIDER_MODEL must be set for production generation model selection.");
  }

  if (!workerProviderSafetyModel) {
    failures.push("TINY_PET_WORKER_PROVIDER_SAFETY_MODEL must be set for production generation safety and quality checks.");
  }

  if (!workerQualityMinPetVisibilityConfidence) {
    failures.push(
      "TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE must be set for production generation quality calibration."
    );
  }

  if (!workerQualityMinStyleMatchScore) {
    failures.push("TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE must be set for production generation quality calibration.");
  }

  if (!workerQualityMinProviderConfidence) {
    failures.push("TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE must be set for production generation quality calibration.");
  }

  if (!workerQualityCalibrationId) {
    failures.push("TINY_PET_WORKER_QUALITY_CALIBRATION_ID must be set for production generation quality calibration traceability.");
  }

  if (!workerProcessMode) {
    failures.push("TINY_PET_WORKER_PROCESS_MODE must be set to once or poll for production generation worker deployment.");
  }

  if (!workerMaxJobsPerRun) {
    failures.push("TINY_PET_WORKER_MAX_JOBS_PER_RUN must be set for production generation worker batch limits.");
  }

  if (!privacyWorkerProcessMode) {
    failures.push("TINY_PET_PRIVACY_WORKER_PROCESS_MODE must be set to once or poll for production privacy deletion worker deployment.");
  }

  if (!outboxWorkerProcessMode) {
    failures.push("TINY_PET_OUTBOX_WORKER_PROCESS_MODE must be set to once or poll for production outbox worker deployment.");
  }

  if (!chatRetentionWorkerProcessMode) {
    failures.push("TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE must be set to once or poll for production chat retention worker deployment.");
  }

  if (!isOptionalUnitIntervalNumber(workerQualityMinPetVisibilityConfidence)) {
    failures.push("TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE must be a number between 0 and 1 when set.");
  }

  if (!isOptionalUnitIntervalNumber(workerQualityMinStyleMatchScore)) {
    failures.push("TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE must be a number between 0 and 1 when set.");
  }

  if (!isOptionalUnitIntervalNumber(workerQualityMinProviderConfidence)) {
    failures.push("TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE must be a number between 0 and 1 when set.");
  }

  if (workerQualityCalibrationId && !isSafeCalibrationId(workerQualityCalibrationId)) {
    failures.push("TINY_PET_WORKER_QUALITY_CALIBRATION_ID must be a safe calibration identifier when set.");
  }

  if (!isOptionalWorkerProcessMode(workerProcessMode)) {
    failures.push("TINY_PET_WORKER_PROCESS_MODE must be once or poll when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(workerPollIntervalMs, 86400000)) {
    failures.push("TINY_PET_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(workerMaxRuns, 10000)) {
    failures.push("TINY_PET_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(workerMaxJobsPerRun, 25)) {
    failures.push("TINY_PET_WORKER_MAX_JOBS_PER_RUN must be a positive integer no greater than 25 when set.");
  }

  if (!isOptionalBoolean(workerStopOnIdle)) {
    failures.push("TINY_PET_WORKER_STOP_ON_IDLE must be true or false when set.");
  }

  if (!isOptionalBoolean(workerStopOnFailure)) {
    failures.push("TINY_PET_WORKER_STOP_ON_FAILURE must be true or false when set.");
  }

  if (!isOptionalBoolean(workerStopProcessOnFailure)) {
    failures.push("TINY_PET_WORKER_STOP_PROCESS_ON_FAILURE must be true or false when set.");
  }

  if (!isOptionalWorkerProcessMode(privacyWorkerProcessMode)) {
    failures.push("TINY_PET_PRIVACY_WORKER_PROCESS_MODE must be once or poll when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(privacyWorkerPollIntervalMs, 86400000)) {
    failures.push("TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(privacyWorkerMaxRuns, 10000)) {
    failures.push("TINY_PET_PRIVACY_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  }

  if (!isOptionalBoolean(privacyWorkerStopOnIdle)) {
    failures.push("TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE must be true or false when set.");
  }

  if (!isOptionalBoolean(privacyWorkerStopProcessOnFailure)) {
    failures.push("TINY_PET_PRIVACY_WORKER_STOP_PROCESS_ON_FAILURE must be true or false when set.");
  }

  if (!isOptionalWorkerProcessMode(outboxWorkerProcessMode)) {
    failures.push("TINY_PET_OUTBOX_WORKER_PROCESS_MODE must be once or poll when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(outboxWorkerPollIntervalMs, 86400000)) {
    failures.push("TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(outboxWorkerMaxRuns, 10000)) {
    failures.push("TINY_PET_OUTBOX_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  }

  if (!isOptionalBoolean(outboxWorkerStopOnIdle)) {
    failures.push("TINY_PET_OUTBOX_WORKER_STOP_ON_IDLE must be true or false when set.");
  }

  if (!isOptionalBoolean(outboxWorkerStopProcessOnFailure)) {
    failures.push("TINY_PET_OUTBOX_WORKER_STOP_PROCESS_ON_FAILURE must be true or false when set.");
  }

  if (!isOptionalWorkerProcessMode(chatRetentionWorkerProcessMode)) {
    failures.push("TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE must be once or poll when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(chatRetentionWorkerPollIntervalMs, 86400000)) {
    failures.push("TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS must be a positive integer no greater than 86400000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(chatRetentionWorkerMaxRuns, 10000)) {
    failures.push("TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS must be a positive integer no greater than 10000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(chatRetentionWorkerBatchSize, 10000)) {
    failures.push("TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE must be a positive integer no greater than 10000 when set.");
  }

  if (!isOptionalPositiveIntegerAtMost(chatRetentionWorkerRetentionWindowMs, 31536000000)) {
    failures.push("TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS must be a positive integer no greater than 31536000000 when set.");
  }

  if (!isOptionalBoolean(chatRetentionWorkerStopOnIdle)) {
    failures.push("TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE must be true or false when set.");
  }

  // GENERATION_TEST_STATES / GENERATION_DRY_RUN are generate-avatar Supabase
  // Edge Function secrets, not TINY_PET_*/mobile build env -- this script
  // cannot see the deployed function's env (separate deploy target/secret
  // store). This only catches the case where they leak into the local/CI
  // process env that triggers a production build (see docs/launch-plan.md
  // §6 for the required manual Supabase dashboard check).
  if (process.env.GENERATION_TEST_STATES) {
    failures.push("GENERATION_TEST_STATES must not be set when producing a production build (generate-avatar test-only override).");
  }

  if (process.env.GENERATION_DRY_RUN) {
    failures.push("GENERATION_DRY_RUN must not be set when producing a production build (generate-avatar dry-run override).");
  }
}

if (!expo.ios?.bundleIdentifier || /example|placeholder|todo/i.test(expo.ios.bundleIdentifier)) {
  failures.push("expo.ios.bundleIdentifier must be a real bundle identifier.");
}

if (!expo.android?.package || /example|placeholder|todo/i.test(expo.android.package)) {
  failures.push("expo.android.package must be a real package id.");
}

if (expo.android?.permissions?.includes("RECORD_AUDIO")) {
  failures.push("Android RECORD_AUDIO must not be requested for still-photo capture.");
}

if (!expo.android?.blockedPermissions?.includes("android.permission.RECORD_AUDIO")) {
  failures.push("Android RECORD_AUDIO must remain blocked.");
}

if (expo.ios?.config?.usesNonExemptEncryption !== false) {
  failures.push("iOS usesNonExemptEncryption must be declared false unless encryption usage changes.");
}

if (failures.length > 0) {
  console.error(`Release config validation failed for profile "${releaseProfile}":`);

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(`Release config validation passed for profile "${releaseProfile}".`);
