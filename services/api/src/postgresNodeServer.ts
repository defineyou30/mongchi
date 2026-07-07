import type { ISODateTime } from "@mongchi/shared";

import { createAppStoreNotificationJwsVerifier } from "./appStoreWebhookVerifier";
import type { ApiRuntimeConfig } from "./apiRuntimeConfig";
import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import { createDirectStorePurchaseVerifierFromRuntimeConfig } from "./directStorePurchaseVerifiers";
import type { DirectStorePurchaseVerifierRuntimeOptions } from "./directStorePurchaseVerifiers";
import { createJwtSessionVerifierFromRuntimeConfig } from "./jwtSessionVerifier";
import { createApiNodeServer } from "./nodeServer";
import type { ApiNodeServer, ApiNodeServerOptions } from "./nodeServer";
import type { OperationalLogger } from "./operationalLogger";
import { createApiNodeRequestLogger, createPremiumChatMonitor } from "./operationalLogger";
import { createPostgresApiService } from "./postgresApiService";
import { createPostgresApiDatabaseClientFromRuntimeConfig } from "./postgresClient";
import { createPostgresRepositoryBundle } from "./postgresRepositoryBundle";
import type { ApiPostgresRepositoryBundle } from "./postgresRepositoryBundle";
import type { PremiumChatMonitor } from "./premiumChatMonitoring";
import type { PremiumChatPolicyOptions } from "./premiumChatPolicy";
import { createOpenAiPremiumChatProviderFromRuntimeConfig } from "./premiumChatProvider";
import type { OpenAiPremiumChatRuntimeOptions, PremiumChatProvider } from "./premiumChatProvider";
import { createHttpStorePurchaseVerifierFromRuntimeConfig } from "./storePurchaseVerifier";
import type { HttpStorePurchaseVerifierRuntimeOptions } from "./storePurchaseVerifier";
import { createS3PrivateStorageSignerFromRuntimeConfig } from "./s3StorageSigner";

export interface PostgresApiNodeServerOptions extends Omit<ApiNodeServerOptions, "service"> {
  databaseClient: ApiDatabaseMigrationClient;
  repositories?: ApiPostgresRepositoryBundle;
  now?: () => ISODateTime;
  allowMockGenerationPolling?: boolean;
  operationalLogger?: OperationalLogger;
  premiumChatProvider?: PremiumChatProvider;
  premiumChatMonitor?: PremiumChatMonitor;
  premiumChatPolicy?: PremiumChatPolicyOptions;
}

export interface PostgresApiNodeServerRuntimeOptions
  extends Omit<
    PostgresApiNodeServerOptions,
    "databaseClient" | "privateStorageSigner" | "premiumChatProvider" | "purchaseVerifier" | "sessionVerifier"
  > {
  databaseClient?: ApiDatabaseMigrationClient;
  privateStorageSigner?: PostgresApiNodeServerOptions["privateStorageSigner"];
  operationalLogger?: OperationalLogger;
  premiumChatProvider?: PremiumChatProvider;
  premiumChatMonitor?: PremiumChatMonitor;
  premiumChatProviderOptions?: OpenAiPremiumChatRuntimeOptions;
  purchaseVerifier?: PostgresApiNodeServerOptions["purchaseVerifier"];
  directStorePurchaseVerifierOptions?: DirectStorePurchaseVerifierRuntimeOptions;
  storePurchaseVerifierOptions?: HttpStorePurchaseVerifierRuntimeOptions;
  sessionVerifier?: PostgresApiNodeServerOptions["sessionVerifier"];
}

export const createPostgresApiNodeServer = ({
  databaseClient,
  repositories,
  now,
  allowMockPurchaseVerification,
  allowMockStorageSigning,
  allowMockGenerationPolling,
  operationalLogger,
  purchaseVerifier,
  privateStorageSigner,
  premiumChatProvider,
  premiumChatMonitor,
  premiumChatPolicy,
  ...serverOptions
}: PostgresApiNodeServerOptions): ApiNodeServer => {
  const resolvedPremiumChatMonitor = premiumChatMonitor ?? (operationalLogger ? createPremiumChatMonitor(operationalLogger) : undefined);
  const resolvedRequestLogger =
    serverOptions.requestLogger ?? (operationalLogger ? createApiNodeRequestLogger(operationalLogger) : undefined);
  const resolvedCommerceWebhookLogger = serverOptions.commerceWebhookLogger ?? operationalLogger;
  const service = createPostgresApiService({
    repositories: repositories ?? createPostgresRepositoryBundle(databaseClient),
    ...(now ? { now } : {}),
    ...(allowMockPurchaseVerification !== undefined ? { allowMockPurchaseVerification } : {}),
    ...(allowMockStorageSigning !== undefined ? { allowMockStorageSigning } : {}),
    ...(allowMockGenerationPolling !== undefined ? { allowMockGenerationPolling } : {}),
    ...(purchaseVerifier ? { purchaseVerifier } : {}),
    ...(privateStorageSigner ? { privateStorageSigner } : {}),
    ...(premiumChatProvider ? { premiumChatProvider } : {}),
    ...(resolvedPremiumChatMonitor ? { premiumChatMonitor: resolvedPremiumChatMonitor } : {}),
    ...(premiumChatPolicy ? { premiumChatPolicy } : {})
  });
  const readinessCheck =
    serverOptions.readinessCheck ??
    (async () => {
      try {
        await databaseClient.query("SELECT 1 AS ready");

        return {
          ok: true,
          checks: {
            database: "ok" as const
          }
        };
      } catch {
        return {
          ok: false,
          checks: {
            database: "error" as const
          },
          messageSafe: "Database is not ready."
        };
      }
    });

  return createApiNodeServer({
    ...serverOptions,
    ...(resolvedRequestLogger ? { requestLogger: resolvedRequestLogger } : {}),
    ...(resolvedCommerceWebhookLogger ? { commerceWebhookLogger: resolvedCommerceWebhookLogger } : {}),
    readinessCheck,
    service,
    ...(allowMockPurchaseVerification !== undefined ? { allowMockPurchaseVerification } : {}),
    ...(allowMockStorageSigning !== undefined ? { allowMockStorageSigning } : {}),
    ...(purchaseVerifier ? { purchaseVerifier } : {}),
    ...(privateStorageSigner ? { privateStorageSigner } : {})
  });
};

export const createPostgresApiNodeServerFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  {
    databaseClient,
    privateStorageSigner,
    operationalLogger,
    premiumChatProvider,
    premiumChatMonitor,
    premiumChatProviderOptions,
    premiumChatPolicy,
    purchaseVerifier,
    directStorePurchaseVerifierOptions,
    sessionVerifier,
    storePurchaseVerifierOptions,
    ...options
  }: PostgresApiNodeServerRuntimeOptions = {}
): ApiNodeServer => {
  const resolvedDatabaseClient = databaseClient ?? createPostgresApiDatabaseClientFromRuntimeConfig(config);
  const resolvedSessionVerifier =
    sessionVerifier ?? (config.auth ? createJwtSessionVerifierFromRuntimeConfig(config) : undefined);
  const resolvedPrivateStorageSigner =
    privateStorageSigner ?? (config.storage ? createS3PrivateStorageSignerFromRuntimeConfig(config) : undefined);
  const resolvedPremiumChatProvider =
    premiumChatProvider ??
    (config.premiumChat ? createOpenAiPremiumChatProviderFromRuntimeConfig(config, premiumChatProviderOptions ?? {}) : undefined);
  const resolvedPremiumChatPolicy = premiumChatPolicy ?? config.premiumChat?.policy;
  const resolvedStorePurchaseVerifierOptions =
    operationalLogger && !storePurchaseVerifierOptions?.logger
      ? {
          ...storePurchaseVerifierOptions,
          logger: operationalLogger
        }
      : storePurchaseVerifierOptions ?? {};
  const resolvedPurchaseVerifier =
    purchaseVerifier ??
    (config.storeVerifier?.provider === "direct"
      ? createDirectStorePurchaseVerifierFromRuntimeConfig(config, directStorePurchaseVerifierOptions ?? {})
      : config.storeVerifier
        ? createHttpStorePurchaseVerifierFromRuntimeConfig(config, resolvedStorePurchaseVerifierOptions)
        : undefined);
  const resolvedAppStoreJwsVerifier =
    config.storeVerifier?.provider === "direct" && config.storeVerifier.appStore.notificationRootCertificateSha256Fingerprints
      ? createAppStoreNotificationJwsVerifier({
          trustedRootCertificateSha256Fingerprints: config.storeVerifier.appStore.notificationRootCertificateSha256Fingerprints
        })
      : undefined;

  return createPostgresApiNodeServer({
    ...options,
    databaseClient: resolvedDatabaseClient,
    allowMockGenerationPolling: config.allowMockGenerationPolling,
    ...(config.commerceWebhookSecret ? { commerceWebhookSecret: config.commerceWebhookSecret } : {}),
    ...(config.storeVerifier?.provider === "direct"
      ? {
          storeWebhookOptions: {
            appStoreBundleId: config.storeVerifier.appStore.bundleId,
            ...(resolvedAppStoreJwsVerifier ? { appStoreJwsVerifier: resolvedAppStoreJwsVerifier } : {}),
            googlePlayPackageName: config.storeVerifier.googlePlay.packageName
          }
        }
      : {}),
    ...(operationalLogger ? { operationalLogger } : {}),
    ...(resolvedSessionVerifier ? { sessionVerifier: resolvedSessionVerifier } : {}),
    ...(resolvedPrivateStorageSigner ? { privateStorageSigner: resolvedPrivateStorageSigner } : {}),
    ...(resolvedPurchaseVerifier ? { purchaseVerifier: resolvedPurchaseVerifier } : {}),
    ...(resolvedPremiumChatProvider ? { premiumChatProvider: resolvedPremiumChatProvider } : {}),
    ...(premiumChatMonitor ? { premiumChatMonitor } : {}),
    ...(resolvedPremiumChatPolicy ? { premiumChatPolicy: resolvedPremiumChatPolicy } : {})
  });
};
