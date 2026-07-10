import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(
  process.env.TINY_PET_VALIDATOR_ROOT ?? fileURLToPath(new URL("..", import.meta.url))
);
const failures = [];

const readEnvExample = (relativePath) => {
  const filePath = resolve(ROOT, relativePath);

  if (!existsSync(filePath)) {
    failures.push(`${relativePath} is missing.`);
    return "";
  }

  return readFileSync(filePath, "utf8");
};

const mobileEnv = readEnvExample("apps/mobile/.env.example");
const apiEnv = readEnvExample("services/api/.env.example");

const requireKeys = (content, relativePath, keys) => {
  for (const key of keys) {
    if (!new RegExp(`^${key}=`, "m").test(content)) {
      failures.push(`${relativePath} must document ${key}.`);
    }
  }
};

const extractRuntimeEnvKeys = (relativePaths, prefixPattern) => {
  const keys = new Set();

  for (const relativePath of relativePaths) {
    const content = readEnvExample(relativePath);

    for (const match of content.matchAll(/\b(?:EXPO_PUBLIC_)?TINY_PET_[A-Z0-9_]+\b/g)) {
      const key = match[0];

      if (prefixPattern.test(key)) {
        keys.add(key);
      }
    }
  }

  return [...keys].sort();
};

requireKeys(mobileEnv, "apps/mobile/.env.example", [
  "EXPO_PUBLIC_TINY_PET_API_BASE_URL",
  "EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK",
  "EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN",
  "EXPO_PUBLIC_TINY_PET_PRIVACY_URL",
  "EXPO_PUBLIC_TINY_PET_TERMS_URL",
  "EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL",
  "EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT",
  "EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET",
  "EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_WEATHER_CONDITION",
  "EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET"
]);

requireKeys(apiEnv, "services/api/.env.example", [
  "TINY_PET_RELEASE_PROFILE",
  "TINY_PET_API_ALLOW_MOCK_AUTH",
  "TINY_PET_API_ALLOW_MOCK_PURCHASES",
  "TINY_PET_API_ALLOW_MOCK_STORAGE",
  "TINY_PET_API_ALLOW_MOCK_GENERATION_POLLING",
  "TINY_PET_API_HOST",
  "TINY_PET_API_PORT",
  "TINY_PET_API_ALLOWED_ORIGINS",
  "TINY_PET_API_MAX_BODY_BYTES",
  "TINY_PET_API_RATE_LIMIT_WINDOW_MS",
  "TINY_PET_API_RATE_LIMIT_MAX_REQUESTS",
  "TINY_PET_API_SERVICE_NAME",
  "TINY_PET_OPERATIONAL_ALERT_ROUTING",
  "TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL",
  "TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN",
  "TINY_PET_OPERATIONAL_ALERT_WEBHOOK_TIMEOUT_MS",
  "TINY_PET_AUTH_ISSUER",
  "TINY_PET_AUTH_AUDIENCE",
  "TINY_PET_AUTH_JWKS_URL",
  "TINY_PET_AUTH_PROVIDER",
  "TINY_PET_AUTH_USER_ID_CLAIM",
  "TINY_PET_AUTH_CLOCK_TOLERANCE_SECONDS",
  "TINY_PET_AUTH_JWKS_CACHE_TTL_MS",
  "TINY_PET_DATABASE_URL",
  "TINY_PET_DATABASE_SSL_MODE",
  "TINY_PET_DATABASE_MAX_POOL_SIZE",
  "TINY_PET_DATABASE_CONNECT_TIMEOUT_MS",
  "TINY_PET_STORAGE_BUCKET",
  "TINY_PET_STORAGE_REGION",
  "TINY_PET_STORAGE_ENDPOINT",
  "TINY_PET_STORAGE_FORCE_PATH_STYLE",
  "TINY_PET_STORAGE_ACCESS_KEY_ID",
  "TINY_PET_STORAGE_SECRET_ACCESS_KEY",
  "TINY_PET_STORAGE_SESSION_TOKEN",
  "TINY_PET_STORAGE_ORIGINAL_PHOTO_PREFIX",
  "TINY_PET_STORE_VERIFIER_PROVIDER",
  "TINY_PET_STORE_VERIFIER_ENDPOINT",
  "TINY_PET_STORE_VERIFIER_API_KEY",
  "TINY_PET_APP_STORE_ENVIRONMENT",
  "TINY_PET_APP_STORE_ISSUER_ID",
  "TINY_PET_APP_STORE_KEY_ID",
  "TINY_PET_APP_STORE_BUNDLE_ID",
  "TINY_PET_APP_STORE_PRIVATE_KEY",
  "TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256",
  "TINY_PET_APP_STORE_BASE_URL",
  "TINY_PET_GOOGLE_PLAY_PACKAGE_NAME",
  "TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
  "TINY_PET_GOOGLE_PLAY_PRIVATE_KEY",
  "TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS",
  "TINY_PET_GOOGLE_PLAY_BASE_URL",
  "TINY_PET_COMMERCE_WEBHOOK_SECRET",
  "TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY",
  "TINY_PET_PREMIUM_CHAT_OPENAI_MODEL",
  "TINY_PET_PREMIUM_CHAT_OPENAI_BASE_URL",
  "TINY_PET_PREMIUM_CHAT_OPENAI_MAX_OUTPUT_TOKENS",
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES",
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS",
  "TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT",
  "TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS",
  "TINY_PET_WORKER_DATABASE_URL",
  "TINY_PET_WORKER_DATABASE_SSL_MODE",
  "TINY_PET_WORKER_DATABASE_MAX_POOL_SIZE",
  "TINY_PET_WORKER_DATABASE_CONNECT_TIMEOUT_MS",
  "TINY_PET_WORKER_STORAGE_BUCKET",
  "TINY_PET_WORKER_STORAGE_REGION",
  "TINY_PET_WORKER_STORAGE_ENDPOINT",
  "TINY_PET_WORKER_STORAGE_FORCE_PATH_STYLE",
  "TINY_PET_WORKER_STORAGE_ACCESS_KEY_ID",
  "TINY_PET_WORKER_STORAGE_SECRET_ACCESS_KEY",
  "TINY_PET_WORKER_STORAGE_SESSION_TOKEN",
  "TINY_PET_WORKER_STORAGE_GENERATED_ASSET_PREFIX",
  "TINY_PET_WORKER_GENERATION_PROVIDER",
  "TINY_PET_WORKER_PROVIDER_API_KEY",
  "TINY_PET_WORKER_PROVIDER_MODEL",
  "TINY_PET_WORKER_PROVIDER_SAFETY_MODEL",
  "TINY_PET_WORKER_PROCESS_MODE",
  "TINY_PET_WORKER_POLL_INTERVAL_MS",
  "TINY_PET_WORKER_MAX_RUNS",
  "TINY_PET_WORKER_MAX_JOBS_PER_RUN",
  "TINY_PET_WORKER_STOP_ON_IDLE",
  "TINY_PET_WORKER_STOP_ON_FAILURE",
  "TINY_PET_WORKER_STOP_PROCESS_ON_FAILURE",
  "TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE",
  "TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE",
  "TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE",
  "TINY_PET_WORKER_QUALITY_CALIBRATION_ID",
  "TINY_PET_PRIVACY_WORKER_PROCESS_MODE",
  "TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS",
  "TINY_PET_PRIVACY_WORKER_MAX_RUNS",
  "TINY_PET_PRIVACY_WORKER_STOP_ON_IDLE",
  "TINY_PET_PRIVACY_WORKER_STOP_PROCESS_ON_FAILURE",
  "TINY_PET_OUTBOX_WORKER_PROCESS_MODE",
  "TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS",
  "TINY_PET_OUTBOX_WORKER_MAX_RUNS",
  "TINY_PET_OUTBOX_WORKER_STOP_ON_IDLE",
  "TINY_PET_OUTBOX_WORKER_STOP_PROCESS_ON_FAILURE",
  "TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE",
  "TINY_PET_CHAT_RETENTION_WORKER_POLL_INTERVAL_MS",
  "TINY_PET_CHAT_RETENTION_WORKER_MAX_RUNS",
  "TINY_PET_CHAT_RETENTION_WORKER_BATCH_SIZE",
  "TINY_PET_CHAT_RETENTION_WORKER_RETENTION_WINDOW_MS",
  "TINY_PET_CHAT_RETENTION_WORKER_STOP_ON_IDLE"
]);

requireKeys(
  mobileEnv,
  "apps/mobile/.env.example",
  extractRuntimeEnvKeys(
    [
      "apps/mobile/src/shared/config/publicReleaseConfig.ts",
      "apps/mobile/src/features/session/apiDailyLoopSession.ts",
      "apps/mobile/src/features/session/mobileAuthSession.ts",
      "apps/mobile/src/features/session/nativeStorePurchases.ts",
      "apps/mobile/src/features/session/qaScreenSession.ts",
      "apps/mobile/src/features/session/storeScreenshotSession.ts"
    ],
    /^EXPO_PUBLIC_TINY_PET_/
  )
);

requireKeys(
  apiEnv,
  "services/api/.env.example",
  extractRuntimeEnvKeys(
    [
      "services/api/src/apiRuntimeConfig.ts",
      "services/api/src/apiServerProcess.ts",
      "services/api/src/generationWorkerDeployment.ts",
      "services/api/src/privacyDeletionWorkerDeployment.ts",
      "services/api/src/outboxWorkerDeployment.ts",
      "services/api/src/chatRetentionPurgeWorkerDeployment.ts",
      "workers/ai/src/workerRuntimeConfig.ts"
    ],
    /^TINY_PET_/
  )
);

[
  "TINY_PET_API_CORS_ALLOWED_ORIGINS",
  "TINY_PET_API_BODY_LIMIT_BYTES",
  "TINY_PET_SERVICE_NAME",
  "TINY_PET_APP_STORE_PRIVATE_KEY_PEM",
  "TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
].forEach((legacyKey) => {
  if (new RegExp(`^${legacyKey}=`, "m").test(apiEnv)) {
    failures.push(`services/api/.env.example must not document legacy key ${legacyKey}.`);
  }
});

if (/PRIVATE KEY-----BEGIN|sk-[A-Za-z0-9]/.test(mobileEnv) || /PRIVATE KEY-----BEGIN|sk-[A-Za-z0-9]/.test(apiEnv)) {
  failures.push("Env example files must not contain real-looking private keys or API keys.");
}

if (!mobileEnv.toLowerCase().includes("provider keys, service tokens, payment secrets")) {
  failures.push("apps/mobile/.env.example must warn that server secrets do not belong in mobile env files.");
}

if (!apiEnv.includes("server-only") || !apiEnv.includes("secret storage")) {
  failures.push("services/api/.env.example must document server-only secret handling.");
}

if (failures.length > 0) {
  console.error("Env example validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Env example validation passed.");
