import { describe, expect, it } from "vitest";

import type { CurrentUserResponse, PurchaseRevocationResponse, PurchaseVerificationResponse } from "../contracts";
import type { ApiRuntimeConfig } from "../apiRuntimeConfig";
import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import type { OpenAiPremiumChatFetch } from "../premiumChatProvider";
import { createPostgresApiNodeServer, createPostgresApiNodeServerFromRuntimeConfig } from "../postgresNodeServer";
import type { HttpStorePurchaseVerifierFetch } from "../storePurchaseVerifier";

type QueuedRows = unknown[] | ((sql: string, params?: readonly unknown[]) => unknown[]);

class QueueDatabaseClient implements ApiDatabaseMigrationClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  private readonly queuedRows: QueuedRows[];

  constructor(queuedRows: QueuedRows[]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });
    const rows = this.queuedRows.shift();

    return {
      rows: (typeof rows === "function" ? rows(sql, params) : rows ?? []) as Row[]
    };
  }
}

const apiUserRow = {
  id: "user_provider_001",
  auth_provider: "test-provider",
  auth_subject: "provider-subject-001",
  locale: "en-US",
  timezone: "America/New_York",
  created_at: "2026-06-24T09:00:00.000Z",
  updated_at: "2026-06-24T09:00:00.000Z"
};

const activePetRow = {
  id: "pet_db_001",
  user_id: "user_provider_001",
  name: "Nori",
  species: "dog",
  personality_tags: JSON.stringify(["curious", "affectionate"]),
  talking_style: "gentle",
  favorite_thing: "moss pillows",
  memory_note: null,
  active_generation_job_id: "gen_db_001",
  active_asset_id: "asset_db_idle_001",
  lifecycle_status: "active",
  original_photo_deleted_at: null,
  created_at: "2026-06-24T09:00:00.000Z",
  updated_at: "2026-06-24T09:35:00.000Z"
};

const creditWalletRow = {
  user_id: "user_provider_001",
  credits: 0,
  bonus_credits: 25,
  free_chat_tickets: 3,
  updated_at: "2026-06-24T09:00:00.000Z"
};

const runtimeConfig: ApiRuntimeConfig = {
  releaseProfile: "development",
  production: false,
  allowMockGenerationPolling: true,
  auth: null,
  database: {
    databaseUrl: "postgresql://user:pass@localhost:5432/tiny_pet",
    sslMode: "disable",
    maxPoolSize: 2,
    connectTimeoutMs: 1000
  },
  storage: null,
  commerceWebhookSecret: null,
  storeVerifier: {
    provider: "http",
    endpoint: "https://store-verifier.example.test/verify",
    apiKey: "runtime-store-verifier-secret"
  },
  premiumChat: {
    provider: "openai",
    apiKey: "sk-runtime-premium-chat",
    model: "gpt-5.5",
    baseUrl: "https://api.example.test/v1",
    maxOutputTokens: 200
  }
};

const base64Url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const jws = (payload: unknown): string => `${base64Url({ alg: "ES256" })}.${base64Url(payload)}.signature`;

const conversationRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  user_id: params?.[1],
  pet_id: params?.[2],
  type: params?.[3],
  status: params?.[4],
  disclosure_accepted_at: params?.[5],
  deleted_at: params?.[6],
  created_at: params?.[7],
  updated_at: params?.[8]
});

const messageRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  conversation_id: params?.[1],
  sender: params?.[2],
  text: params?.[3],
  safety_flags: params?.[4],
  created_at: params?.[5]
});

const entitlementRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  user_id: params?.[1],
  key: params?.[2],
  status: params?.[3],
  source: params?.[4],
  product_id: params?.[5],
  starts_at: params?.[6],
  ends_at: params?.[7],
  ledger_entry_id: params?.[8],
  metadata: params?.[9],
  created_at: params?.[10],
  updated_at: params?.[11]
});

const purchaseLedgerRowFromParams = (params: readonly unknown[] | undefined) => ({
  ledger_entry_id: params?.[0],
  user_id: params?.[1],
  platform: params?.[2],
  product_id: params?.[3],
  transaction_id: params?.[4],
  receipt_hash: params?.[5],
  entitlement_id: params?.[6],
  status: params?.[7],
  verified_at: params?.[8],
  restored_at: params?.[9],
  revoked_at: params?.[10],
  revocation_reason: params?.[11],
  metadata: params?.[12],
  created_at: params?.[13],
  updated_at: params?.[14]
});

const outboxRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  aggregate_type: params?.[1],
  aggregate_id: params?.[2],
  event_type: params?.[3],
  payload: params?.[4],
  status: "pending",
  created_at: params?.[5],
  processed_at: null,
  failure_code: null
});

const startPostgresServer = async (client: ApiDatabaseMigrationClient) => {
  const { server, router } = createPostgresApiNodeServer({
    databaseClient: client,
    allowMockAuth: false
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Expected TCP listener address"));
        return;
      }

      resolve(address.port);
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    router,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
};

describe("Postgres Node server factory", () => {
  it("serves readiness through a database ping instead of mock route state", async () => {
    const client = new QueueDatabaseClient([[{ ready: 1 }]]);
    const api = await startPostgresServer(client);

    try {
      const response = await fetch(`${api.baseUrl}/readyz`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: "ready",
        service: "mongchi-api",
        checks: {
          database: "ok"
        }
      });
      expect(client.queries[0]?.sql).toBe("SELECT 1 AS ready");
    } finally {
      await api.close();
    }
  });

  it("uses the operational logger as the default request logger", async () => {
    const client = new QueueDatabaseClient([]);
    const logEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const { server } = createPostgresApiNodeServer({
      databaseClient: client,
      allowMockAuth: false,
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ event, metadata });
        }
      }
    });
    const port = await new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();

        if (!address || typeof address === "string") {
          reject(new Error("Expected TCP listener address"));
          return;
        }

        resolve(address.port);
      });
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);

      expect(response.status).toBe(200);
      expect(logEvents).toHaveLength(1);
      expect(logEvents[0]).toMatchObject({
        event: "api_request_finished",
        metadata: {
          method: "GET",
          path: "/healthz",
          status: 200,
          rateLimited: false
        }
      });
      expect(JSON.stringify(logEvents)).not.toContain("authorization");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  it("mounts the async Postgres API service instead of the default mock service", async () => {
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [
        {
          live_pet_count: "1",
          active_pet_count: "0",
          active_generation_count: "1"
        }
      ],
      [],
      (_sql, params) => [
        {
          user_id: params?.[0],
          credits: params?.[1],
          bonus_credits: params?.[2],
          free_chat_tickets: params?.[3],
          updated_at: params?.[4]
        }
      ]
    ]);
    const { router } = createPostgresApiNodeServer({
      databaseClient: client,
      allowMockAuth: true,
      now: () => "2026-06-24T09:00:00.000Z"
    });

    const syncResponse = router.handle({
      method: "GET",
      path: "/v1/me",
      headers: {
        "x-mock-user-id": "user_provider_001"
      }
    });

    expect(syncResponse.status).toBe(503);
    expect(syncResponse.body).toMatchObject({
      error: {
        code: "async_service_requires_async_handler"
      }
    });

    const response = await router.handleAsync({
      method: "GET",
      path: "/v1/me",
      headers: {
        "x-mock-user-id": "user_provider_001",
        "x-locale": "en-US",
        "x-timezone": "America/New_York"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body as CurrentUserResponse).toEqual({
      userId: "user_provider_001",
      locale: "en-US",
      timezone: "America/New_York",
      onboardingState: "generation_started",
      wallet: {
        userId: "user_provider_001",
        credits: 0,
        bonusCredits: 25,
        freeChatTickets: 3,
        updatedAt: "2026-06-24T09:00:00.000Z"
      }
    });
    expect(client.queries[0]?.sql).toContain("INSERT INTO public.api_users");
    expect(client.queries[1]?.sql).toContain("FROM public.pets p");
  });

  it("mounts runtime-configured premium chat provider on the Postgres service", async () => {
    let conversationRow: Record<string, unknown> | null = null;
    const openAiRequests: Array<{ url: string; init: Parameters<OpenAiPremiumChatFetch>[1] }> = [];
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [activePetRow],
      [creditWalletRow],
      [{ active: true }],
      (_sql, params) => {
        conversationRow = conversationRowFromParams(params);

        return [conversationRow];
      },
      [apiUserRow],
      () => (conversationRow ? [conversationRow] : []),
      [activePetRow],
      [],
      [creditWalletRow],
      [{ active: true }],
      [],
      (_sql, params) => [messageRowFromParams(params)],
      (_sql, params) => [messageRowFromParams(params)],
      () => (conversationRow ? [{ ...conversationRow, updated_at: "2026-06-24T09:50:00.000Z" }] : [])
    ]);
    const openAiFetch: OpenAiPremiumChatFetch = async (url, init) => {
      openAiRequests.push({ url, init });

      return {
        status: 200,
        json: async () => ({
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    replyText: "Nori waves from the runtime-configured garden.",
                    safetyFlags: ["runtime_provider"]
                  })
                }
              ]
            }
          ]
        })
      };
    };
    const { router } = createPostgresApiNodeServerFromRuntimeConfig(runtimeConfig, {
      databaseClient: client,
      allowMockAuth: true,
      now: () => "2026-06-24T09:50:00.000Z",
      premiumChatProviderOptions: {
        fetch: openAiFetch
      }
    });
    const headers = {
      "x-mock-user-id": "user_provider_001",
      "x-locale": "en-US",
      "x-timezone": "America/New_York"
    };
    const conversation = await router.handleAsync({
      method: "POST",
      path: "/v1/conversations",
      headers,
      body: {
        petId: "pet_db_001",
        disclosureAccepted: true
      }
    });
    const message = await router.handleAsync({
      method: "POST",
      path: `/v1/conversations/${(conversation.body as { conversation: { id: string } }).conversation.id}/messages`,
      headers,
      body: {
        text: "  Hello   runtime friend  "
      }
    });

    expect(message.status).toBe(200);
    expect(message.body).toMatchObject({
      petMessage: {
        text: "Nori waves from the runtime-configured garden.",
        safetyFlags: ["runtime_provider"]
      },
      safetyFlags: ["runtime_provider"]
    });
    expect(openAiRequests).toHaveLength(1);
    expect(openAiRequests[0]?.url).toBe("https://api.example.test/v1/responses");
    expect(openAiRequests[0]?.init.headers.Authorization).toBe("Bearer sk-runtime-premium-chat");
  });

  it("mounts runtime-configured store purchase verifier on the Postgres service", async () => {
    let entitlementRow: Record<string, unknown> | null = null;
    let purchaseLedgerRow: Record<string, unknown> | null = null;
    const validHash = `sha256:${"b".repeat(64)}`;
    const storeVerificationToken = "google-play-token.production.001";
    const storeRequests: Array<{ url: string; init: Parameters<HttpStorePurchaseVerifierFetch>[1] }> = [];
    const storeFetch: HttpStorePurchaseVerifierFetch = async (url, init) => {
      storeRequests.push({ url, init });
      const body = JSON.parse(init.body) as {
        platform: "ios" | "android";
        productId: string;
        transactionId: string;
        receiptHash: string;
      };

      return {
        status: 200,
        json: async () => ({
          purchase: {
            platform: body.platform,
            productId: body.productId,
            transactionId: body.transactionId,
            receiptHash: body.receiptHash,
            verifiedAt: "2026-06-24T09:55:00.000Z",
            environment: "production"
          }
        })
      };
    };
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [],
      (_sql, params) => {
        entitlementRow = entitlementRowFromParams(params);

        return [entitlementRow];
      },
      (_sql, params) => {
        purchaseLedgerRow = purchaseLedgerRowFromParams(params);

        return [purchaseLedgerRow];
      }
    ]);
    const { router } = createPostgresApiNodeServerFromRuntimeConfig(runtimeConfig, {
      databaseClient: client,
      allowMockAuth: true,
      now: () => "2026-06-24T09:55:00.000Z",
      storePurchaseVerifierOptions: {
        fetch: storeFetch
      }
    });
    const response = await router.handleAsync({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers: {
        "x-mock-user-id": "user_provider_001",
        "x-locale": "en-US",
        "x-timezone": "America/New_York"
      },
      body: {
        platform: "android",
        productId: "premium_chat_monthly",
        transactionId: "gpa.1234-5678-9012",
        receiptHash: validHash,
        storeVerificationToken
      }
    });

    expect(response.status).toBe(201);
    expect(response.body as PurchaseVerificationResponse).toMatchObject({
      serverVerified: true,
      entitlements: [
        {
          key: "premium_chat",
          status: "active",
          source: "purchase",
          metadata: {
            storeEnvironment: "production"
          }
        }
      ]
    });
    expect(storeRequests).toHaveLength(1);
    expect(storeRequests[0]?.url).toBe("https://store-verifier.example.test/verify");
    expect(storeRequests[0]?.init.headers.Authorization).toBe("Bearer runtime-store-verifier-secret");
    expect(JSON.parse(storeRequests[0]?.init.body ?? "{}")).toMatchObject({
      operation: "verify_purchase",
      platform: "android",
      productId: "premium_chat_monthly",
      transactionId: "gpa.1234-5678-9012",
      receiptHash: validHash,
      storeVerificationToken,
      userId: "user_provider_001"
    });
    expect(JSON.stringify(purchaseLedgerRow)).not.toContain(storeVerificationToken);
  });

  it("passes runtime commerce webhook settings into the async router", async () => {
    const revokedAt = "2026-06-24T10:05:00.000Z";
    const ledgerRow = {
      ledger_entry_id: "ledger_runtime_webhook_001",
      user_id: "user_provider_001",
      platform: "ios",
      product_id: "premium_chat_monthly",
      transaction_id: "ios_runtime_webhook_001",
      receipt_hash: `sha256:${"f".repeat(64)}`,
      entitlement_id: "ent_runtime_webhook_001",
      status: "revoked",
      verified_at: "2026-06-24T10:00:00.000Z",
      restored_at: null,
      revoked_at: revokedAt,
      revocation_reason: "refund"
    };
    const entitlementRow = {
      id: "ent_runtime_webhook_001",
      user_id: "user_provider_001",
      key: "premium_chat",
      status: "revoked",
      source: "purchase",
      product_id: "premium_chat_monthly",
      starts_at: "2026-06-24T10:00:00.000Z",
      ends_at: "2026-07-24T10:00:00.000Z",
      ledger_entry_id: "ledger_runtime_webhook_001",
      metadata: JSON.stringify({ revoked: true, revocationReason: "refund" }),
      created_at: "2026-06-24T10:00:00.000Z",
      updated_at: revokedAt
    };
    const client = new QueueDatabaseClient([[ledgerRow], [entitlementRow], (_sql, params) => [outboxRowFromParams(params)]]);
    const operationalEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const { router } = createPostgresApiNodeServerFromRuntimeConfig(
      {
        ...runtimeConfig,
        commerceWebhookSecret: "commerce-webhook-secret-001",
        storeVerifier: {
          provider: "direct",
          appStore: {
            bundleId: "app.mongchi.mobile",
            issuerId: "issuer-runtime-001",
            keyId: "key-runtime-001",
            privateKey: "-----BEGIN PRIVATE KEY-----\\nruntime\\n-----END PRIVATE KEY-----",
            environment: "production"
          },
          googlePlay: {
            packageName: "app.mongchi.mobile",
            serviceAccountClientEmail: "store-runtime@example.iam.gserviceaccount.com",
            serviceAccountPrivateKey: "-----BEGIN PRIVATE KEY-----\\nruntime\\n-----END PRIVATE KEY-----",
            subscriptionProductIds: ["premium_chat_monthly"]
          }
        }
      },
      {
        databaseClient: client,
        allowMockAuth: true,
        now: () => revokedAt,
        operationalLogger: {
          info: (event, metadata) => operationalEvents.push({ event, metadata }),
          error: (event, metadata) => operationalEvents.push({ event, metadata })
        },
        purchaseVerifier: {
          verifyPurchase: async () => ({
            ok: false,
            error: {
              status: 503,
              code: "unused",
              messageSafe: "Unused in this test."
            }
          })
        }
      }
    );
    const response = await router.handleAsync({
      method: "POST",
      path: "/v1/commerce/store-webhooks",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "commerce-webhook-secret-001"
      },
      body: {
        signedPayload: jws({
          notificationType: "REFUND",
          data: {
            bundleId: "app.mongchi.mobile",
            signedTransactionInfo: jws({
              transactionId: "ios_runtime_webhook_001",
              productId: "premium_chat_monthly",
              bundleId: "app.mongchi.mobile"
            })
          }
        })
      }
    });

    expect(response.status).toBe(200);
    expect(response.body as PurchaseRevocationResponse).toMatchObject({
      revoked: true,
      entitlement: {
        id: "ent_runtime_webhook_001",
        status: "revoked",
        metadata: {
          revocationReason: "refund"
        }
      }
    });
    expect(client.queries[0]?.params).toEqual(["ios_runtime_webhook_001", "ios", revokedAt, "refund"]);
    const outboxInsert = client.queries.find((query) => query.sql.includes("INSERT INTO public.api_outbox_events"));
    expect(outboxInsert?.params?.[1]).toBe("commerce_purchase");
    expect(outboxInsert?.params?.[2]).toMatch(/^commerce_purchase_[a-f0-9]{32}$/);
    expect(outboxInsert?.params?.[3]).toBe("commerce.purchase_revoked");
    expect(JSON.parse(outboxInsert?.params?.[4] as string)).toEqual({
      platform: "ios",
      productId: "premium_chat_monthly",
      entitlementKey: "premium_chat",
      revocationReason: "refund",
      status: "revoked",
      revokedAt
    });
    expect(operationalEvents).toContainEqual({
      event: "commerce_store_webhook_processed",
      metadata: {
        source: "app_store_server_notification_v2",
        action: "revoke",
        platform: "ios",
        reason: "refund",
        status: 200
      }
    });
    expect(JSON.stringify(operationalEvents)).not.toContain("ios_runtime_webhook_001");
    expect(JSON.stringify(outboxInsert?.params)).not.toContain("ios_runtime_webhook_001");
    expect(JSON.stringify(outboxInsert?.params)).not.toContain(`sha256:${"f".repeat(64)}`);
  });
});
