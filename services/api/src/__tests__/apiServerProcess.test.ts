import { describe, expect, it } from "vitest";

import type { ApiRuntimeConfig } from "../apiRuntimeConfig";
import {
  readApiNodeServerProcessRuntimeOptions,
  startPostgresApiNodeServerFromRuntimeEnv
} from "../apiServerProcess";
import type { ApiDatabaseQueryResult } from "../dbMigrations";
import type { PostgresApiDatabaseClient } from "../postgresClient";

class QueueDatabaseClient implements PostgresApiDatabaseClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  closed = false;
  private readonly queuedRows: unknown[][];

  constructor(queuedRows: unknown[][]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });

    return {
      rows: (this.queuedRows.shift() ?? []) as Row[]
    };
  }

  async end(): Promise<void> {
    this.closed = true;
  }
}

const runtimeConfig: ApiRuntimeConfig = {
  releaseProfile: "development",
  production: false,
  allowMockGenerationPolling: true,
  auth: null,
  database: null,
  storage: null,
  commerceWebhookSecret: null,
  storeVerifier: null,
  premiumChat: null
};

describe("API server process runtime", () => {
  it("parses listen, CORS, body, and rate-limit process options from env", () => {
    expect(
      readApiNodeServerProcessRuntimeOptions({
        TINY_PET_API_HOST: "127.0.0.1",
        TINY_PET_API_PORT: "0",
        TINY_PET_API_ALLOWED_ORIGINS: "https://app.tinypet.test, http://localhost:8081/",
        TINY_PET_API_MAX_BODY_BYTES: "65536",
        TINY_PET_API_RATE_LIMIT_WINDOW_MS: "60000",
        TINY_PET_API_RATE_LIMIT_MAX_REQUESTS: "120",
        TINY_PET_API_SERVICE_NAME: "tiny-pet-api-preview"
      })
    ).toEqual({
      ok: true,
      options: {
        host: "127.0.0.1",
        port: 0,
        allowedOrigins: ["https://app.tinypet.test", "http://localhost:8081"],
        maxBodyBytes: 65536,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 120
        },
        serviceName: "tiny-pet-api-preview"
      }
    });
  });

  it("rejects unsafe process option values before listen", () => {
    const result = readApiNodeServerProcessRuntimeOptions({
      TINY_PET_API_HOST: "bad host",
      TINY_PET_API_PORT: "70000",
      TINY_PET_API_ALLOWED_ORIGINS: "https://app.tinypet.test/path",
      TINY_PET_API_MAX_BODY_BYTES: "999999999",
      TINY_PET_API_RATE_LIMIT_WINDOW_MS: "60000",
      TINY_PET_API_SERVICE_NAME: "tiny pet api"
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        "TINY_PET_API_HOST must be a host name or IP address without whitespace.",
        "TINY_PET_API_PORT must be an integer from 0 to 65535 when set.",
        "TINY_PET_API_MAX_BODY_BYTES must be a positive integer no greater than 20971520 when set.",
        "TINY_PET_API_RATE_LIMIT_WINDOW_MS and TINY_PET_API_RATE_LIMIT_MAX_REQUESTS must be set together.",
        "TINY_PET_API_SERVICE_NAME must be a safe service identifier when set.",
        "TINY_PET_API_ALLOWED_ORIGINS must be a comma-separated list of http(s) origins without paths."
      ]
    });
  });

  it("starts a Postgres-backed API server from runtime env and closes owned database resources", async () => {
    const client = new QueueDatabaseClient([[{ ready: 1 }]]);
    const logEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const api = await startPostgresApiNodeServerFromRuntimeEnv({
      env: {
        TINY_PET_API_HOST: "127.0.0.1",
        TINY_PET_API_PORT: "0",
        TINY_PET_API_ALLOWED_ORIGINS: "https://app.tinypet.test",
        TINY_PET_API_SERVICE_NAME: "tiny-pet-api-test"
      },
      runtimeConfig,
      createDatabaseClient: () => client,
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ event, metadata });
        }
      }
    });

    try {
      const response = await fetch(`${api.listenResult.baseUrl}/readyz`, {
        headers: {
          Origin: "https://app.tinypet.test"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("https://app.tinypet.test");
      await expect(response.json()).resolves.toMatchObject({
        status: "ready",
        service: "tiny-pet-api-test",
        checks: {
          database: "ok"
        }
      });
      expect(client.queries[0]?.sql).toBe("SELECT 1 AS ready");
    } finally {
      await api.close();
    }

    expect(client.closed).toBe(true);
    expect(logEvents).toEqual(
      expect.arrayContaining([
        {
          event: "api_server_started",
          metadata: {
            host: "127.0.0.1",
            port: api.listenResult.port,
            serviceName: "tiny-pet-api-test"
          }
        },
        {
          event: "api_request_finished",
          metadata: expect.objectContaining({
            method: "GET",
            path: "/readyz",
            status: 200,
            rateLimited: false
          }) as Record<string, unknown>
        },
        {
          event: "api_server_stopped",
          metadata: {
            host: "127.0.0.1",
            port: api.listenResult.port,
            serviceName: "tiny-pet-api-test"
          }
        }
      ])
    );
  });

  it("forces allowMockAuth off in production regardless of caller-supplied options", async () => {
    const client = new QueueDatabaseClient([[{ ready: 1 }]]);
    const api = await startPostgresApiNodeServerFromRuntimeEnv({
      env: {
        TINY_PET_API_HOST: "127.0.0.1",
        TINY_PET_API_PORT: "0"
      },
      runtimeConfig: {
        ...runtimeConfig,
        releaseProfile: "production",
        production: true
      },
      createDatabaseClient: () => client,
      allowMockAuth: true
    });

    try {
      const response = await fetch(`${api.listenResult.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_demo_001",
          "x-mock-user-id": "user_demo_001"
        }
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          status: 401,
          code: "auth_required"
        }
      });
    } finally {
      await api.close();
    }
  });

  it("keeps mock auth available in non-production release profiles", async () => {
    const client = new QueueDatabaseClient([
      [
        {
          id: "user_demo_001",
          auth_provider: "mock",
          auth_subject: "user_demo_001",
          locale: "en-US",
          timezone: "Asia/Seoul",
          created_at: "2026-06-24T09:00:00.000Z",
          updated_at: "2026-06-24T09:00:00.000Z"
        }
      ],
      [{ live_pet_count: "0", active_pet_count: "0", active_generation_count: "0" }],
      [],
      [
        {
          user_id: "user_demo_001",
          credits: 0,
          bonus_credits: 0,
          free_chat_tickets: 0,
          updated_at: "2026-06-24T09:00:00.000Z"
        }
      ]
    ]);
    const api = await startPostgresApiNodeServerFromRuntimeEnv({
      env: {
        TINY_PET_API_HOST: "127.0.0.1",
        TINY_PET_API_PORT: "0"
      },
      runtimeConfig,
      createDatabaseClient: () => client
    });

    try {
      const response = await fetch(`${api.listenResult.baseUrl}/v1/me`, {
        headers: {
          "x-mock-user-id": "user_demo_001"
        }
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        userId: "user_demo_001"
      });
    } finally {
      await api.close();
    }
  });

  it("mounts a Postgres-backed shared rate-limit store for runtime rate-limit env", async () => {
    const client = new QueueDatabaseClient([[{ windowStart: 1782375000000, count: 1 }]]);
    const api = await startPostgresApiNodeServerFromRuntimeEnv({
      env: {
        TINY_PET_API_HOST: "127.0.0.1",
        TINY_PET_API_PORT: "0",
        TINY_PET_API_RATE_LIMIT_WINDOW_MS: "60000",
        TINY_PET_API_RATE_LIMIT_MAX_REQUESTS: "120"
      },
      runtimeConfig,
      createDatabaseClient: () => client
    });

    try {
      const response = await fetch(`${api.listenResult.baseUrl}/v1/unknown?token=raw-secret`, {
        headers: {
          authorization: "Bearer raw-session-token"
        }
      });

      expect(response.status).toBe(404);
      expect(client.queries[0]?.sql).toContain("INSERT INTO public.api_rate_limits");
      expect(client.queries[0]?.params?.[0]).toMatch(/^auth:[a-f0-9]{32}$/);
      expect(JSON.stringify(client.queries)).not.toContain("raw-session-token");
      expect(JSON.stringify(client.queries)).not.toContain("raw-secret");
    } finally {
      await api.close();
    }
  });
});
