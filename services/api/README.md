# API Placeholder

Backend/API boundary for Mongchi.

Implemented locally:

- Pure mock service with auth context enforcement.
- Mock service snapshot export/import plus a JSON file snapshot store for local/runtime state restoration.
- Initial Postgres SQL migration and tested migration runner boundary for API-owned state, ownership indexes, reaction catalog versions, commerce ledger uniqueness, privacy deletion jobs, and outbox events.
- Tested mock-service snapshot to Postgres repository boundary that emits ordered, parameterized SQL for users, pets, photos, generation jobs, generated assets, care state, inventory, walks, conversations, entitlements, and purchase ledger rows.
- API runtime config parser that requires production auth issuer/audience/JWKS settings, a production Postgres URL, non-disabled SSL mode, and S3-compatible private storage signing settings before production API deployment.
- `pg` Pool adapter for the API database `query()` boundary, with runtime config mapping for URL, SSL mode, pool size, and connection timeout.
- Request-scoped Postgres repository for API users, current-user onboarding state, and pet profile list/read/upsert/soft-delete mapping.
- Request-scoped Postgres repository for original-photo metadata, generation jobs, worker-safe generation job claiming/status transitions, and generated asset metadata/read ownership mapping.
- Request-scoped Postgres repository for care state, item catalog rows, active reaction catalog versions, inventory items/placements, walk sessions, and recent reaction history mapping.
- Request-scoped Postgres repository for premium chat conversations, message thread reads, message writes, conversation soft-delete, and full chat-history deletion mapping.
- Batch Postgres retention purge path for premium chat messages, including a created-at retention index and scheduler-friendly worker/process/runtime-env deployment composer.
- Request-scoped Postgres repository for commerce entitlements, active entitlement checks, purchase ledger upserts, restore lookups, and revocation state mapping.
- Request-scoped Postgres repository for privacy deletion job queueing, claiming, completion, failure, retry, and user-scoped job reads.
- Request-scoped Postgres outbox repository for sanitized API audit/operational events, including privacy deletion completion/failure audit records.
- Tested Postgres repository bundle that composes all request-scoped repository slices on one database client for production request-service wiring.
- Async-only Postgres-backed API service slice for `/v1/me`, pet profile list/create/update/delete, source-photo upload metadata, upload completion, generation job create/read/poll, durable mock generation completion/failure/retry, worker-supplied private generated asset completion metadata, generated asset listing, generated asset signed-read URL, generation accept/activate, item catalog, active versioned reaction catalog, inventory, care state/action, walk start/reward claim, commerce product/entitlement/purchase verification/restore, premium chat conversation/message/thread/delete, and privacy original-photo/chat-history/pet deletion request routes, with provider identity upserted through the user repository and unmounted routes failing closed with 503.
- Privacy deletion worker runner and scheduler-friendly process runner that claim queued jobs, call an injected deletion processor, and mark jobs completed or failed with safe retry metadata.
- OpenAI/Postgres generation worker deployment composer that combines the tested worker process runner, OpenAI generation runtime, S3 worker storage, and Postgres generation repository bundle behind worker runtime config.
- Postgres privacy deletion processor that hard-deletes original-photo rows, chat conversations, and deleted pet rows after private storage cleanup succeeds.
- API outbox worker runner and scheduler-friendly process/runtime-env deployment composer that delivers sanitized outbox events through an injected sink or the safe operational logger and marks processed/failed delivery state.
- Chat retention purge worker runner and scheduler-friendly process runner that delete expired premium-chat messages in bounded batches without exposing message text in telemetry.
- Pure HTTP router adapter for `/v1` method/path requests with injectable auth resolution, server-only async session/storage/purchase verifier injection points, a production-style option to reject default mock auth headers, and production-style options to reject mock storage/purchase signing.
- Tested Node HTTP server adapter with JSON body parsing, request body size limits, method allowlisting, optional CORS origin allowlisting, optional per-client in-memory rate limiting, and safe structured request logging without headers/query/body.
- Safe operational logger helpers for JSON-line logs, request logs, premium-chat provider monitor events, and scheduler-friendly worker telemetry, with metadata redaction for secrets, raw text, receipt data, and storage/photo URIs.
- Tested operational alert policy that wraps the default runtime command logger and emits sanitized `operational_alert_triggered` events for API server errors, generation worker failures/failed batches, store purchase verifier failures, commerce store webhook rejections, privacy deletion failures, outbox delivery failures, premium chat provider failures, runtime command failures, and cost spikes.
- Tested Postgres Node server factory that mounts the async Postgres API service on the Node HTTP adapter instead of the default mock service, plus a runtime-config factory that composes the database client, JWT verifier, S3 signer, store verifier, OpenAI premium chat provider, and optional operational logger by default.
- Tested API server process runtime that reads `TINY_PET_API_*` listen/CORS/body/rate-limit env, starts the Postgres Node server with the safe operational logger, exposes a base URL for integration harnesses, and closes owned database resources during shutdown.
- Tested runtime command CLI and npm scripts for starting the Postgres API server plus generation, privacy deletion, outbox, and chat-retention workers with safe operational logging and shutdown signal wiring.
- Current-user onboarding state plus pet list/create/update/delete profile boundaries.
- Pet, photo, and generation-job ownership guards.
- Private signed upload URL issuance with upload method/header metadata for mobile transport, plus a server-only storage signer injection point for real private storage.
- Source-photo file type and size validation.
- Upload completion hash validation.
- Generation-job creation preconditions requiring uploaded owned source photos.
- Generation-job lifecycle boundary with job reads, worker-safe claiming/status transitions, mock polling/progression, mock completion, generated asset listing, accept/activate, quality failure, and retry behavior.
- App-private generated asset signed-read URL contract with ownership checks and short expiry, plus a server-only storage signer injection point for real private storage.
- Daily loop boundary with authored item catalog, active versioned reaction catalog, user inventory, owned pet care state, care actions, walk start, walk return gating, reward claim, and reaction history.
- Original-photo metadata deletion while preserving generated pet state.
- Privacy deletion routes for original photo metadata, premium chat conversations/messages, and pet records with ownership checks.
- Premium chat active-entitlement enforcement, AI disclosure requirement, input/output moderation, conversation thread read/delete ownership checks, server-only provider injection with retention-filtered capped recent-message context, configurable server-side turn rate and retention-window policy, safe provider monitor hooks without message text, tested OpenAI Responses structured-output adapter, refusal handling, safe provider-unavailable failure, and local backend-only mock fallback.
- Commerce product catalog and current-user entitlement reads, plus mock server-verified purchase grants, idempotent transaction handling, restore purchases, transaction reuse protection, and refund/revocation handling.
- Mock purchase verification can be disabled with `allowMockPurchaseVerification: false` so product/entitlement reads remain available while mock receipt grants and restore calls return a safe unavailable error.
- Server-only `StorePurchaseVerifier` injection with tested HTTP verifier gateway and direct App Store Server API / Google Play Developer API adapters; purchase and restore requests can include raw `storeVerificationToken` values for verifier-only transport, while ledgers/analytics retain only normalized receipt metadata and never require mobile-held payment secrets. Direct App Store runtime config also mounts x5c/ES256 transaction and notification JWS verification from `TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256`.
- The Node HTTP adapter supports optional request throttling with a default in-memory limiter or an injected `ApiNodeRateLimitStore` for shared production deployments. Postgres runtime deployments automatically use the tested `public.api_rate_limits` shared store when API rate-limit env is set. Default rate-limit keys hash bearer/mock-user/IP inputs before storage so raw session tokens are not retained as limiter keys.
- Server-only `PrivateStorageSigner` injection for original-photo upload URLs and generated-asset read URLs; mock storage signing can be disabled with `allowMockStorageSigning: false`.
- Server-only S3-compatible `PrivateStorageSigner` implementation, including runtime-config construction, for short-lived original-photo upload URLs, generated-asset read URLs, and internal `s3://` storage URI persistence without exposing bucket credentials to mobile.
- Server-only S3-compatible private storage object deleter for idempotent signed `DELETE Object` cleanup of original-photo and generated-asset URIs.
- Server-only RS256 JWT/JWKS `ApiSessionVerifier` implementation and runtime-config construction for provider tokens with issuer, audience, expiry, not-before, key id, and signature checks.

Future ownership:

- Provider account setup and deployment wiring for session verification. Default mock auth can be disabled with `allowMockAuth: false`, and production mounts can inject the built-in JWT/JWKS `ApiSessionVerifier` from runtime config or another async verifier.
- Remaining first-session runtime wiring around deployed worker S3 storage configuration, production provider values, and production scheduler infrastructure.
- Private storage object lifecycle policy, bucket policies, and deployed worker storage credentials.
- Deployed API hosting, log shipping/alert backends for the tested safe operational logger, premium-chat monitor events, retention purge worker, privacy deletion worker, and outbox worker telemetry.
- Store account/product setup, deployed App Store / Google Play webhook registration, and entitlement monitoring.
- Privacy deletion and outbox worker scheduler infrastructure plus deployed alerts for privacy deletion audit/failure events.

This service is not deployed with a production database, storage bucket, AI provider credentials, or payment provider yet. The SQL migration under `services/api/migrations`, repository bundle, Postgres API service, Node server, runtime config composers, store verifier adapters, S3 signer/deleter, premium chat provider, privacy deletion worker, outbox worker, chat retention purge worker, generation worker deployment, and snapshot-to-Postgres migration rehearsal are implemented and tested for the production path. The default runtime still uses the mock service for local/runtime tests, and production still needs real provider/S3 credentials, production scheduler infrastructure, deployed log/alert routing backends, bucket policies, store webhook registration, distributed rate limits, backups, and secret management.

Production deployment must set `TINY_PET_API_ALLOW_MOCK_AUTH=false`, `TINY_PET_API_ALLOW_MOCK_PURCHASES=false`, `TINY_PET_API_ALLOW_MOCK_STORAGE=false`, production auth/JWKS env, production Postgres env, private storage signing env, either HTTP or direct store verifier env, and premium chat OpenAI env. Premium chat production env must include `TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY` or `OPENAI_API_KEY`, `TINY_PET_PREMIUM_CHAT_OPENAI_MODEL`, `TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES`, `TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS`, `TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT`, and `TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS`; these fail closed when omitted. Optional `TINY_PET_OUTBOX_WORKER_*` and `TINY_PET_CHAT_RETENTION_WORKER_*` tune outbox delivery and retention purge scheduling. Production mounts should pass `allowMockAuth: false`, `allowMockPurchaseVerification: false`, and `allowMockStorageSigning: false`, then mount `createPostgresApiNodeServerFromRuntimeConfig(requireApiRuntimeConfig(), { operationalLogger: createJsonLineOperationalLogger() })` or inject equivalent runtime-config-built verifier/signer/provider instances manually.

Production API process mounts can call `startPostgresApiNodeServerFromRuntimeEnv()` to read runtime config, start the Postgres-backed Node server, emit safe JSON-line operational events, and close owned database resources on shutdown. Runtime commands wrap the default logger with the alert policy so production log sinks can route `operational_alert_triggered` without reading raw payloads. Optional `TINY_PET_API_HOST`, `TINY_PET_API_PORT`, `TINY_PET_API_ALLOWED_ORIGINS`, `TINY_PET_API_MAX_BODY_BYTES`, `TINY_PET_API_RATE_LIMIT_WINDOW_MS`, `TINY_PET_API_RATE_LIMIT_MAX_REQUESTS`, and `TINY_PET_API_SERVICE_NAME` tune the process listener and are covered by release-config validation when set.

Production premium chat config also fails closed unless `TINY_PET_PREMIUM_CHAT_OPENAI_MODEL`, turn-limit, context-limit, and retention-window env values are set alongside `TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY` or `OPENAI_API_KEY`, so deployed chat behavior does not silently drift to default model, cost, or retention policy.

Runtime commands:

```sh
npm run start:api
npm run start:generation-worker
npm run start:privacy-worker
npm run start:outbox-worker
npm run start:chat-retention-worker
```

The `@mongchi/api` workspace exposes the same commands as `start:api`, `start:generation-worker`, `start:privacy-worker`, `start:outbox-worker`, and `start:chat-retention-worker`. These commands use the tested runtime-env composers; production still needs real env values, scheduler/hosting infrastructure, and log/alert shipping.

Migration validation:

```sh
npm run validate:db-migrations
```

Example runtime mount:

```ts
import { createApiNodeServer } from "@mongchi/api";

const { server } = createApiNodeServer({
  allowedOrigins: ["http://localhost:8081"],
  allowMockAuth: true,
  allowMockPurchaseVerification: true,
  allowMockStorageSigning: true,
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 120
  },
  requestLogger: (event) => console.info(JSON.stringify(event))
});

server.listen(8787, "127.0.0.1");
```

Production-style S3 storage signer mount:

```ts
import { createApiNodeServer, createS3PrivateStorageSignerFromRuntimeConfig, requireApiRuntimeConfig } from "@mongchi/api";

const runtimeConfig = requireApiRuntimeConfig();
const { server } = createApiNodeServer({
  allowMockStorageSigning: false,
  privateStorageSigner: createS3PrivateStorageSignerFromRuntimeConfig(runtimeConfig)
});
```

Production-style session verifier mount:

```ts
import { createApiNodeServer, createJwtSessionVerifierFromRuntimeConfig, requireApiRuntimeConfig } from "@mongchi/api";

const runtimeConfig = requireApiRuntimeConfig();

const { server } = createApiNodeServer({
  allowMockAuth: false,
  sessionVerifier: createJwtSessionVerifierFromRuntimeConfig(runtimeConfig)
});
```

Production-style purchase verifier mount:

```ts
import { createApiNodeServer } from "@mongchi/api";
import type { StorePurchaseVerifier } from "@mongchi/api";

const purchaseVerifier: StorePurchaseVerifier = {
  verifyPurchase: async (input) => {
    // Call App Store / Google Play APIs from the server using backend secrets.
    // Use input.storeVerificationToken for provider verification when present.
    // Return only normalized metadata; never return raw receipts, tokens, or provider credentials.
    return {
      ok: true,
      purchase: {
        platform: input.platform,
        productId: input.productId,
        transactionId: input.transactionId,
        receiptHash: input.receiptHash,
        environment: "production"
      }
    };
  }
};

const { server } = createApiNodeServer({
  allowMockAuth: false,
  allowMockPurchaseVerification: false,
  purchaseVerifier
});
```

Production runtime config can also mount the built-in HTTP store verifier through `createPostgresApiNodeServerFromRuntimeConfig(requireApiRuntimeConfig())` when `TINY_PET_STORE_VERIFIER_ENDPOINT` and `TINY_PET_STORE_VERIFIER_API_KEY` are set, or the direct Apple/Google verifier when `TINY_PET_STORE_VERIFIER_PROVIDER=direct`, the store server credential env vars, `TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256`, and `TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS` are set.

Example persisted local mock service:

```ts
import { createApiNodeServer, createJsonFileApiServiceSnapshotStore, createPersistedMockApiService } from "@mongchi/api";

const snapshotStore = createJsonFileApiServiceSnapshotStore(".data/api-snapshot.json");
const persisted = await createPersistedMockApiService(snapshotStore, {
  allowMockPurchaseVerification: true,
  allowMockStorageSigning: true
});
const { server } = createApiNodeServer({
  service: persisted.service,
  allowMockAuth: true
});

server.listen(8787, "127.0.0.1");
```

Example snapshot-to-Postgres rehearsal:

```ts
import {
  bootstrapApiDatabase,
  createPostgresApiDatabaseClientFromRuntimeConfig,
  loadApiDatabaseMigrations,
  requireApiRuntimeConfig
} from "@mongchi/api";

const migrations = await loadApiDatabaseMigrations("services/api/migrations");
const runtimeConfig = requireApiRuntimeConfig();
const postgresClient = createPostgresApiDatabaseClientFromRuntimeConfig(runtimeConfig);

try {
  await bootstrapApiDatabase(postgresClient, {
    migrations,
    snapshotSource: persisted.service
  });
} finally {
  await postgresClient.end();
}
```
