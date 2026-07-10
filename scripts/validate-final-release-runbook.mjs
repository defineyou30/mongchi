import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const packageJson = readJson("package.json");
const scripts = packageJson.scripts ?? {};
const finalGate = readText("scripts/validate-final-release-readiness.mjs");
const iosPreflight = readText("scripts/validate-ios-preflight.mjs");
const mobileVisualDirection = readText("scripts/validate-mobile-visual-direction.mjs");
const mobileSecretBoundaries = readText("scripts/validate-mobile-secret-boundaries.mjs");
const privacySdkBoundaries = readText("scripts/validate-privacy-sdk-boundaries.mjs");
const releaseConfigValidator = readText("scripts/validate-release-config.mjs");
const apiRuntimeConfig = readText("services/api/src/apiRuntimeConfig.ts");
const apiHttpRouter = readText("services/api/src/httpRouter.ts");
const apiNodeServer = readText("services/api/src/nodeServer.ts");
const commerceStoreWebhook = readText("services/api/src/commerceStoreWebhook.ts");
const appStoreWebhookVerifier = readText("services/api/src/appStoreWebhookVerifier.ts");
const directStorePurchaseVerifiers = readText("services/api/src/directStorePurchaseVerifiers.ts");
const operationalLogger = readText("services/api/src/operationalLogger.ts");
const postgresApiService = readText("services/api/src/postgresApiService.ts");
const postgresNodeServer = readText("services/api/src/postgresNodeServer.ts");
const postgresRateLimitStore = readText("services/api/src/postgresRateLimitStore.ts");
const workerRuntimeConfig = readText("workers/ai/src/workerRuntimeConfig.ts");
const releaseReadiness = readText("docs/release-readiness.md");
const workerQualityCalibration = readText("docs/worker-quality-calibration.md");
const nativeRunbook = readText("docs/mobile-native-runbook.md");
const mvpStatus = readText("docs/mvp-slice-status.md");
const iosManualQa = readText("docs/ios-manual-qa-checklist.md");
const qaDeviceChecks = readText("docs/qa-device-checks.md");
const storePrivacy = readText("docs/store-privacy-data-safety.md");

const requireIncludes = (content, text, label) => {
  if (!content.includes(text)) {
    failures.push(`${label} must include "${text}".`);
  }
};

const requirePattern = (content, pattern, label) => {
  if (!pattern.test(content)) {
    failures.push(`${label} is missing ${label.endsWith(".") ? "required content" : "required content."}`);
  }
};

const requirePackageScript = (name, command) => {
  if (scripts[name] !== command) {
    failures.push(`package.json must expose "${name}": "${command}".`);
  }
};

requirePackageScript("validate:final-release-runbook", "node scripts/validate-final-release-runbook.mjs");
requirePackageScript("validate:final-release-plan", "TINY_PET_FINAL_RELEASE_DRY_RUN=true node scripts/validate-final-release-readiness.mjs");
requirePackageScript("validate:final-release", "node scripts/validate-final-release-readiness.mjs");
requirePackageScript("validate:production-release-config", "TINY_PET_RELEASE_PROFILE=production node scripts/validate-release-config.mjs");
requirePackageScript("validate:final-screenshot-freshness", "node scripts/validate-final-screenshot-freshness.mjs");
requirePackageScript("validate:ios-final-screenshot-freshness", "TINY_PET_FINAL_SCREENSHOT_FRESHNESS_PLATFORMS=ios node scripts/validate-final-screenshot-freshness.mjs");
requirePackageScript("validate:mobile-visual-direction", "node scripts/validate-mobile-visual-direction.mjs");
requirePackageScript("validate:mobile-secret-boundaries", "node scripts/validate-mobile-secret-boundaries.mjs");
requirePackageScript("validate:privacy-sdk-boundaries", "node scripts/validate-privacy-sdk-boundaries.mjs");
requirePackageScript("capture:android-store-screenshots", "node scripts/capture-android-store-screenshots.mjs");
requirePackageScript("validate:android-store-contact-sheet", "node scripts/validate-android-store-contact-sheet.mjs");
requirePackageScript("validate:android", "npm --workspace @mongchi/mobile run validate:android");

[
  "TINY_PET_FINAL_RELEASE_ALLOW_ANDROID",
  "validate:ios-preflight",
  "validate:production-release-config",
  "TINY_PET_REQUIRE_STORE_SCREENSHOTS",
  "validate:final-screenshot-freshness",
  "validate:android-store-contact-sheet",
  "validate:android",
  "FINAL RELEASE SIMULATION ONLY — NOT RELEASE-READY",
  "No child gate was executed",
  "TINY_PET_FINAL_RELEASE_STEP_TIMEOUT_MS",
  "clean release worktree",
  "Final release fixture contract passed",
  "Actual final run requires TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true"
].forEach((text) => requireIncludes(finalGate, text, "Final release readiness script"));

if ((finalGate.match(/requiresAndroid: true/g) ?? []).length < 2) {
  failures.push("Final release readiness script must mark both final Android steps as Android-gated.");
}

[
  /label:\s*"strict iOS\/Android store screenshot coverage"/,
  /env:\s*\{\s*TINY_PET_REQUIRE_STORE_SCREENSHOTS:\s*"all"\s*\}/s,
  /label:\s*"final screenshot freshness after UI\/art changes"/,
  /label:\s*"final Android store contact sheet"/,
  /label:\s*"final Android export validation"/
].forEach((pattern) => requirePattern(finalGate, pattern, "Final release readiness script"));

requireIncludes(iosPreflight, "validate:mobile-secret-boundaries", "iOS preflight");
requireIncludes(iosPreflight, "validate:privacy-sdk-boundaries", "iOS preflight");
requireIncludes(iosPreflight, "validate:mobile-visual-direction", "iOS preflight");
requireIncludes(iosPreflight, "validate:ios-final-screenshot-freshness", "iOS preflight");
requireIncludes(iosPreflight, "validate:final-release-runbook", "iOS preflight");
requireIncludes(iosPreflight, "validate:final-release-plan", "iOS preflight");

[
  "premium cozy casual mobile game UI",
  'scene=\\"reveal\\"',
  'scene=\\"garden\\"',
  "Back to dome",
  "Mobile visual direction validation passed."
].forEach((text) => requireIncludes(mobileVisualDirection, text, "Mobile visual direction validator"));

[
  "allowedPublicEnvKeys",
  "serverOnlyEnvPattern",
  "realLookingSecretPattern",
  "Mobile secret boundary validation passed."
].forEach((text) => requireIncludes(mobileSecretBoundaries, text, "Mobile secret boundary validator"));

[
  "disallowedSdkPackageMatchers",
  "package-lock.json",
  "expo-tracking-transparency",
  "@sentry/",
  "Privacy SDK boundary validation passed."
].forEach((text) => requireIncludes(privacySdkBoundaries, text, "Privacy SDK boundary validator"));

[
  /"validate:android"/,
  /"validate:android-store-contact-sheet"/,
  /"validate:android-store-screenshots"/,
  /"capture:android-store-screenshots"/
].forEach((pattern) => {
  if (pattern.test(iosPreflight)) {
    failures.push("iOS preflight must not execute Android validation or Android screenshot capture.");
  }
});

[
  "npm run validate:final-release-runbook",
  "TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true npm run validate:final-release",
  "npm run validate:production-release-config",
  "npm run validate:final-screenshot-freshness",
  "npm run capture:android-store-screenshots",
  "npm run validate:android-store-contact-sheet"
].forEach((command) => {
  requireIncludes(releaseReadiness, command, "Release readiness");
  requireIncludes(nativeRunbook, command, "Mobile native runbook");
});

[
  "TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true npm run validate:final-release",
  "npm run validate:final-screenshot-freshness",
  "npm run capture:android-store-screenshots",
  "validate:final-release-runbook"
].forEach((text) => requireIncludes(mvpStatus, text, "MVP slice status"));

[
  "intermediate iOS loop",
  "final Android pass",
  "VoiceOver",
  "TalkBack",
  "Android Reduce Motion",
  "strict iOS/Android store screenshot coverage"
].forEach((text) => {
  requireIncludes(releaseReadiness, text, "Release readiness");
  requireIncludes(nativeRunbook, text, "Mobile native runbook");
});

[
  "VoiceOver Checklist",
  "Reduced Motion Checklist",
  "Android screenshot/export evidence is outside this intermediate iOS checklist and is tracked separately; TalkBack and Android Reduce Motion remain final Android manual completion checks."
].forEach((text) => requireIncludes(iosManualQa, text, "iOS manual QA checklist"));

[
  "Manual VoiceOver pass",
  "Android store screenshots, Android contact sheet validation, and Android export validation now have local evidence; TalkBack and Android Reduce Motion remain final Android manual completion checks"
].forEach((text) => requireIncludes(qaDeviceChecks, text, "QA device checks"));

[
  "App Store Privacy Labels",
  "Google Play Data Safety",
  "crash reporting",
  "privacy SDK boundary",
  "npm run validate:privacy-sdk-boundaries",
  "Encrypted at rest",
  "deletion workers",
  "privacy-policy text"
].forEach((text) => requireIncludes(storePrivacy, text, "Store privacy/data safety draft"));

[
  "EXPO_PUBLIC_TINY_PET_API_BASE_URL",
  "EXPO_PUBLIC_TINY_PET_PRIVACY_URL",
  "EXPO_PUBLIC_TINY_PET_TERMS_URL",
  "EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL",
  "TINY_PET_API_ALLOWED_ORIGINS",
  "TINY_PET_API_MAX_BODY_BYTES",
  "TINY_PET_API_RATE_LIMIT_WINDOW_MS",
  "TINY_PET_API_RATE_LIMIT_MAX_REQUESTS",
  "TINY_PET_API_SERVICE_NAME",
  "TINY_PET_AUTH_ISSUER",
  "TINY_PET_AUTH_AUDIENCE",
  "TINY_PET_AUTH_JWKS_URL",
  "TINY_PET_DATABASE_URL",
  "TINY_PET_OPERATIONAL_ALERT_ROUTING",
  "TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL",
  "TINY_PET_STORAGE_BUCKET",
  "TINY_PET_STORE_VERIFIER_PROVIDER",
  "TINY_PET_STORE_VERIFIER_ENDPOINT",
  "TINY_PET_STORE_VERIFIER_API_KEY",
  "TINY_PET_APP_STORE_PRIVATE_KEY",
  "TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256",
  "TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
  "TINY_PET_GOOGLE_PLAY_PRIVATE_KEY",
  "TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS",
  "TINY_PET_COMMERCE_WEBHOOK_SECRET",
  "TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY",
  "TINY_PET_PREMIUM_CHAT_OPENAI_MODEL",
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES",
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS",
  "TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT",
  "TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS",
  "TINY_PET_WORKER_PROVIDER_API_KEY",
  "TINY_PET_WORKER_PROVIDER_MODEL",
  "TINY_PET_WORKER_PROVIDER_SAFETY_MODEL",
  "TINY_PET_WORKER_PROCESS_MODE",
  "TINY_PET_WORKER_MAX_JOBS_PER_RUN",
  "TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE",
  "TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE",
  "TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE",
  "TINY_PET_WORKER_QUALITY_CALIBRATION_ID",
  "TINY_PET_PRIVACY_WORKER_PROCESS_MODE",
  "TINY_PET_OUTBOX_WORKER_PROCESS_MODE",
  "TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE"
].forEach((key) => requireIncludes(releaseReadiness, key, "Release readiness production env coverage"));

requireIncludes(releaseReadiness, "validate:mobile-secret-boundaries", "Release readiness mobile secret boundary coverage");
requireIncludes(releaseReadiness, "validate:privacy-sdk-boundaries", "Release readiness privacy SDK boundary coverage");
requireIncludes(releaseReadiness, "validate:mobile-visual-direction", "Release readiness mobile visual direction coverage");
requireIncludes(nativeRunbook, "validate:privacy-sdk-boundaries", "Mobile native runbook privacy SDK boundary coverage");
requireIncludes(mvpStatus, "validate:privacy-sdk-boundaries", "MVP slice privacy SDK boundary coverage");
requireIncludes(mvpStatus, "validate:mobile-visual-direction", "MVP slice mobile visual direction coverage");
requireIncludes(qaDeviceChecks, "validate:mobile-visual-direction", "QA device checks visual direction coverage");

[
  "operational_alert_triggered",
  "generation failure rate",
  "purchase verification",
  "deletion failures",
  "API errors",
  "cost spikes"
].forEach((text) => requireIncludes(releaseReadiness, text, "Release readiness monitoring coverage"));

[
  "generation_failure_rate",
  "purchase_verification",
  "store_webhook",
  "deletion_failures",
  "api_errors",
  "cost_spike"
].forEach((category) => requireIncludes(operationalLogger, category, "Operational alert policy"));

[
  "createHttpOperationalAlertSink",
  "OperationalAlertSink",
  "operational_alert_delivery_failed"
].forEach((text) => requireIncludes(operationalLogger, text, "Operational alert sink routing"));

[
  "/v1/commerce/store-webhooks",
  "Google Play RTDN",
  "receipt-hash revokes",
  "x5c certificate chain",
  "commerce_store_webhook_processed",
  "commerce_store_webhook_ignored",
  "commerce_store_webhook_rejected",
  "supported ES256 protected headers",
  "commerce.purchase_revoked"
].forEach((text) => requireIncludes(releaseReadiness, text, "Release readiness commerce webhook coverage"));

[
  "store-webhooks",
  "normalizeCommerceStoreWebhookNotification",
  "revokePurchaseByReceiptHash"
].forEach((text) => requireIncludes(apiHttpRouter, text, "API router commerce webhook ingress"));

[
  "ApiNodeRateLimitStore",
  "rate_limit_unavailable",
  "hashRateLimitKey"
].forEach((text) => requireIncludes(apiNodeServer, text, "API node server production rate-limit boundary"));

[
  "createPostgresApiRateLimitStore",
  "public.api_rate_limits",
  "ON CONFLICT (key) DO UPDATE"
].forEach((text) => requireIncludes(postgresRateLimitStore, text, "Postgres shared API rate-limit store"));

[
  "app_store_server_notification_v2",
  "google_play_rtdn",
  "sha256ReceiptHash",
  "base64UrlSegmentPattern",
  "algorithm !== \"ES256\""
].forEach((text) => requireIncludes(commerceStoreWebhook, text, "Commerce store webhook normalization"));

[
  "createAppStoreNotificationJwsVerifier",
  "X509Certificate",
  "trustedRootCertificateSha256Fingerprints",
  "dsaEncoding: \"ieee-p1363\"",
  "x5c"
].forEach((text) => requireIncludes(appStoreWebhookVerifier, text, "App Store webhook JWS verifier"));

[
  "signedTransactionVerifier",
  "verifyAppStoreJws",
  "createAppStoreNotificationJwsVerifier"
].forEach((text) => requireIncludes(directStorePurchaseVerifiers, text, "Direct App Store purchase verifier JWS verification"));

[
  "createCommerceRevocationAggregateId",
  "commerce.purchase_revoked",
  "commerce_purchase"
].forEach((text) => requireIncludes(postgresApiService, text, "Postgres commerce revocation outbox audit"));

[
  "commerceWebhookSecret",
  "storeWebhookOptions",
  "createAppStoreNotificationJwsVerifier",
  "appStoreJwsVerifier",
  "googlePlayPackageName"
].forEach((text) => requireIncludes(postgresNodeServer, text, "Runtime Postgres node server commerce webhook wiring"));

[
  "EXPO_PUBLIC_TINY_PET_API_BASE_URL must be set to a production https URL for production builds.",
  "TINY_PET_API_RATE_LIMIT_WINDOW_MS and TINY_PET_API_RATE_LIMIT_MAX_REQUESTS must be set for production API throttling.",
  "TINY_PET_WORKER_PROCESS_MODE must be set to once or poll for production generation worker deployment.",
  "TINY_PET_PRIVACY_WORKER_PROCESS_MODE must be set to once or poll for production privacy deletion worker deployment.",
  "TINY_PET_OUTBOX_WORKER_PROCESS_MODE must be set to once or poll for production outbox worker deployment.",
  "TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE must be set to once or poll for production chat retention worker deployment.",
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES must be set for production premium chat turn limits.",
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS must be set for production premium chat turn limits.",
  "TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT must be set for production premium chat context limits.",
  "TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS must be set for production premium chat retention policy."
].forEach((message) => {
  requireIncludes(releaseConfigValidator, message, "Production release-config gate");
});

[
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES must be set for production premium chat turn limits.",
  "TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS must be set for production premium chat turn limits.",
  "TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT must be set for production premium chat context limits.",
  "TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS must be set for production premium chat retention policy."
].forEach((message) => requireIncludes(apiRuntimeConfig, message, "API runtime premium chat policy gate"));

[
  "TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256 must be set for direct App Store server notification verification.",
  "TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS must be set for direct Google Play subscription verification.",
  "TINY_PET_APP_STORE_BUNDLE_ID must match expo.ios.bundleIdentifier for production direct store verification.",
  "TINY_PET_GOOGLE_PLAY_PACKAGE_NAME must match expo.android.package for production direct store verification."
].forEach((message) => {
  requireIncludes(releaseConfigValidator, message, "Production release-config direct store verifier gate");
});

[
  "TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256 must be set for direct App Store server notification verification.",
  "TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS must be set for direct Google Play subscription verification."
].forEach((message) => requireIncludes(apiRuntimeConfig, message, "API runtime direct store verifier gate"));

[
  "TINY_PET_OPERATIONAL_ALERT_ROUTING must be set to json_logs or webhook for production alert routing.",
  "TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL must be set to an https URL when alert routing is webhook.",
  "TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN must be set for webhook alert routing.",
  "TINY_PET_PREMIUM_CHAT_OPENAI_MODEL must be set for production premium chat model selection."
].forEach((message) => {
  requireIncludes(releaseConfigValidator, message, "Production release-config operational/premium chat gate");
  if (message.includes("PREMIUM_CHAT")) {
    requireIncludes(apiRuntimeConfig, message, "API runtime premium chat gate");
  }
});

[
  "TINY_PET_WORKER_PROVIDER_MODEL must be set for production generation model selection.",
  "TINY_PET_WORKER_PROVIDER_SAFETY_MODEL must be set for production generation safety and quality checks.",
  "TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE must be set for production generation quality calibration.",
  "TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE must be set for production generation quality calibration.",
  "TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE must be set for production generation quality calibration.",
  "TINY_PET_WORKER_QUALITY_CALIBRATION_ID must be set for production generation quality calibration traceability.",
  "TINY_PET_WORKER_MAX_JOBS_PER_RUN must be set for production generation worker batch limits."
].forEach((message) => {
  requireIncludes(releaseConfigValidator, message, "Production release-config worker generation gate");
  requireIncludes(workerRuntimeConfig, message, "Worker runtime generation gate");
});

[
  "TINY_PET_WORKER_QUALITY_CALIBRATION_ID",
  "approved calibration run",
  "False accept and false reject review notes"
].forEach((text) => requireIncludes(workerQualityCalibration, text, "Worker quality calibration record"));

if (/\b(TODO|TBD|replace-me)\b/i.test(releaseReadiness)) {
  failures.push("Release readiness must not contain TODO/TBD/replace-me placeholders.");
}

if (failures.length > 0) {
  console.error("Final release runbook validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Final release runbook validation passed.");
