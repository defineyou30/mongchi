import type { Server } from "node:http";

import { describe, expect, it } from "vitest";

import { createApiNodeServer } from "../nodeServer";
import type { ApiNodeRateLimitStore, ApiNodeRequestLogEvent, ApiNodeServerOptions } from "../nodeServer";
import type { StorePurchaseVerifier } from "../purchaseVerifier";
import type { ApiSessionVerifier } from "../sessionVerifier";
import type { PrivateStorageSigner } from "../storageSigner";

const validHash = `sha256:${"c".repeat(64)}`;

const startServer = async (options: ApiNodeServerOptions = {}) => {
  const { server, router } = createApiNodeServer(options);
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
        closeServer(server, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
};

const closeServer = (server: Server, callback: (error?: Error) => void) => {
  server.close((error) => callback(error ?? undefined));
};

describe("API Node HTTP server", () => {
  it("serves liveness and readiness probes without auth or route state", async () => {
    const logs: ApiNodeRequestLogEvent[] = [];
    const api = await startServer({
      serviceName: "tiny-pet-api",
      readinessCheck: async () => ({
        ok: true,
        checks: {
          runtime: "ok",
          database: "ok"
        }
      }),
      requestLogger: (event) => {
        logs.push(event);
      }
    });

    try {
      const health = await fetch(`${api.baseUrl}/healthz`);
      const readiness = await fetch(`${api.baseUrl}/readyz?token=raw-secret`);

      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toMatchObject({
        status: "ok",
        service: "tiny-pet-api",
        checks: {}
      });
      expect(readiness.status).toBe(200);
      await expect(readiness.json()).resolves.toMatchObject({
        status: "ready",
        service: "tiny-pet-api",
        checks: {
          runtime: "ok",
          database: "ok"
        }
      });
      expect(logs.map((event) => event.path)).toEqual(["/healthz", "/readyz"]);
      expect(JSON.stringify(logs)).not.toMatch(/raw-secret/i);
    } finally {
      await api.close();
    }
  });

  it("returns safe readiness failures without leaking thrown errors", async () => {
    const notReadyApi = await startServer({
      readinessCheck: () => ({
        ok: false,
        checks: {
          database: "error"
        },
        messageSafe: "Database is not ready."
      })
    });

    try {
      const response = await fetch(`${notReadyApi.baseUrl}/readyz`);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        status: "not_ready",
        checks: {
          database: "error"
        },
        error: {
          status: 503,
          code: "service_not_ready",
          messageSafe: "Database is not ready."
        }
      });
    } finally {
      await notReadyApi.close();
    }

    const thrownApi = await startServer({
      readinessCheck: () => {
        throw new Error("raw database password");
      }
    });

    try {
      const response = await fetch(`${thrownApi.baseUrl}/readyz`);
      const bodyText = await response.text();

      expect(response.status).toBe(503);
      expect(bodyText).toContain("readiness_check_failed");
      expect(bodyText).not.toContain("raw database password");
    } finally {
      await thrownApi.close();
    }
  });

  it("serves router responses over HTTP with auth headers and CORS allowlist", async () => {
    const api = await startServer({
      allowedOrigins: ["http://localhost:8081"]
    });

    try {
      const response = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_demo_001",
          origin: "http://localhost:8081",
          "x-locale": "en-US",
          "x-timezone": "America/New_York"
        }
      });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
      expect(body).toMatchObject({
        userId: "user_demo_001",
        locale: "en-US",
        timezone: "America/New_York",
        onboardingState: "pet_active"
      });
    } finally {
      await api.close();
    }
  });

  it("can reject mock auth headers before production auth middleware is mounted", async () => {
    const api = await startServer({ allowMockAuth: false });

    try {
      const response = await fetch(`${api.baseUrl}/v1/me`, {
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

  it("serves provider-authenticated requests through the async session verifier", async () => {
    const verifierCalls: string[] = [];
    const sessionVerifier: ApiSessionVerifier = {
      verifySession: async (input) => {
        verifierCalls.push(input.token);

        return {
          ok: true,
          session: {
            userId: "user_provider_node_001",
            locale: input.locale,
            timezone: input.timezone,
            provider: "test-provider"
          }
        };
      }
    };
    const api = await startServer({
      allowMockAuth: false,
      sessionVerifier
    });

    try {
      const response = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer provider-node-token",
          "x-locale": "en-US",
          "x-timezone": "America/New_York"
        }
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        userId: "user_provider_node_001",
        locale: "en-US",
        timezone: "America/New_York"
      });
      expect(verifierCalls).toEqual(["provider-node-token"]);
    } finally {
      await api.close();
    }
  });

  it("serves signed upload URLs through the async private storage signer", async () => {
    const signedPhotoIds: string[] = [];
    const privateStorageSigner: PrivateStorageSigner = {
      createOriginalPhotoUpload: async (input) => {
        signedPhotoIds.push(input.photoId);

        return {
          ok: true,
          signed: {
            uploadUrl: `https://storage.example.com/uploads/${input.photoId}`,
            uploadMethod: "PUT",
            uploadHeaders: {
              "Content-Type": input.contentType
            }
          }
        };
      },
      createGeneratedAssetRead: async (input) => ({
        ok: true,
        signed: {
          signedUrl: `https://storage.example.com/assets/${input.assetId}`
        }
      })
    };
    const api = await startServer({
      allowMockStorageSigning: false,
      privateStorageSigner
    });

    try {
      const response = await fetch(`${api.baseUrl}/v1/photos/upload-url`, {
        method: "POST",
        headers: {
          authorization: "Bearer user_demo_001",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          petId: "pet_miso_001",
          contentType: "image/png",
          byteSize: 4096
        })
      });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(201);
      expect(body.uploadUrl).toBe(`https://storage.example.com/uploads/${body.photoId as string}`);
      expect(signedPhotoIds).toEqual([body.photoId]);
    } finally {
      await api.close();
    }
  });

  it("returns safe provider auth failures from the async session verifier", async () => {
    const sessionVerifier: ApiSessionVerifier = {
      verifySession: async () => ({
        ok: false,
        error: {
          status: 401,
          code: "session_invalid",
          messageSafe: "Sign in is required."
        }
      })
    };
    const api = await startServer({
      allowMockAuth: false,
      sessionVerifier
    });

    try {
      const response = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer invalid-provider-node-token"
        }
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          status: 401,
          code: "session_invalid"
        }
      });
    } finally {
      await api.close();
    }
  });

  it("can reject mock purchase verification before store provider wiring is mounted", async () => {
    const api = await startServer({ allowMockPurchaseVerification: false });

    try {
      const response = await fetch(`${api.baseUrl}/v1/commerce/purchases/verify`, {
        method: "POST",
        headers: {
          authorization: "Bearer user_demo_001",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          platform: "ios",
          productId: "premium_chat_monthly",
          transactionId: "ios_node_disabled_001",
          receiptHash: validHash
        })
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          status: 503,
          code: "purchase_verification_unavailable"
        }
      });
    } finally {
      await api.close();
    }
  });

  it("serves store-verifier purchase grants through the async router path", async () => {
    const verifier: StorePurchaseVerifier = {
      verifyPurchase: async (input) => ({
        ok: true,
        purchase: {
          platform: input.platform,
          productId: input.productId,
          transactionId: input.transactionId,
          receiptHash: input.receiptHash,
          verifiedAt: "2026-06-24T10:30:00.000Z",
          environment: "production"
        }
      })
    };
    const api = await startServer({
      allowMockPurchaseVerification: false,
      purchaseVerifier: verifier
    });

    try {
      const response = await fetch(`${api.baseUrl}/v1/commerce/purchases/verify`, {
        method: "POST",
        headers: {
          authorization: "Bearer user_demo_001",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          platform: "ios",
          productId: "premium_chat_monthly",
          transactionId: "ios_node_store_001",
          receiptHash: validHash
        })
      });

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        serverVerified: true,
        entitlements: [
          {
            key: "premium_chat",
            source: "purchase"
          }
        ]
      });
    } finally {
      await api.close();
    }
  });

  it("returns safe HTTP errors for unsupported methods, invalid JSON, and oversized bodies", async () => {
    const api = await startServer({ maxBodyBytes: 8 });

    try {
      const unsupported = await fetch(`${api.baseUrl}/v1/me`, { method: "PUT" });
      const invalidJson = await fetch(`${api.baseUrl}/v1/pets`, {
        method: "POST",
        headers: {
          authorization: "Bearer user_demo_001",
          "content-type": "application/json"
        },
        body: "{"
      });
      const oversized = await fetch(`${api.baseUrl}/v1/pets`, {
        method: "POST",
        headers: {
          authorization: "Bearer user_demo_001",
          "content-type": "application/json"
        },
        body: JSON.stringify({ name: "Nori" })
      });

      await expect(unsupported.json()).resolves.toMatchObject({
        error: { status: 405, code: "method_not_allowed" }
      });
      expect(unsupported.headers.get("allow")).toBe("GET, POST, PATCH, DELETE");
      expect(invalidJson.status).toBe(400);
      await expect(invalidJson.json()).resolves.toMatchObject({
        error: { status: 400, code: "invalid_json" }
      });
      expect(oversized.status).toBe(413);
      await expect(oversized.json()).resolves.toMatchObject({
        error: { status: 413, code: "request_body_too_large" }
      });
    } finally {
      await api.close();
    }
  });

  it("handles daily loop routes through the mounted HTTP runtime", async () => {
    const api = await startServer();

    try {
      const careAction = await fetch(`${api.baseUrl}/v1/pets/pet_miso_001/care-actions`, {
        method: "POST",
        headers: {
          authorization: "Bearer user_demo_001",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action: "feed",
          occurredAt: "2026-06-24T09:20:00.000Z"
        })
      });
      const careBody = (await careAction.json()) as Record<string, unknown>;
      const inventory = await fetch(`${api.baseUrl}/v1/inventory`, {
        headers: {
          authorization: "Bearer user_demo_001"
        }
      });
      const inventoryBody = (await inventory.json()) as Record<string, unknown>;

      expect(careAction.status).toBe(200);
      expect(careBody).toMatchObject({
        careState: {
          petId: "pet_miso_001",
          lastFedAt: "2026-06-24T09:20:00.000Z"
        },
        reaction: {
          category: "fed_recent"
        },
        reward: null
      });
      expect(inventory.status).toBe(200);
      expect(inventoryBody).toMatchObject({
        userId: "user_demo_001"
      });
    } finally {
      await api.close();
    }
  });

  it("enforces optional per-client rate limits before routing requests", async () => {
    let now = 0;
    const api = await startServer({
      rateLimit: {
        windowMs: 1000,
        maxRequests: 2,
        now: () => now
      }
    });

    try {
      const first = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_demo_001"
        }
      });
      const second = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_demo_001"
        }
      });
      const limited = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_demo_001"
        }
      });

      expect(first.status).toBe(200);
      expect(first.headers.get("x-ratelimit-limit")).toBe("2");
      expect(first.headers.get("x-ratelimit-remaining")).toBe("1");
      expect(second.status).toBe(200);
      expect(second.headers.get("x-ratelimit-remaining")).toBe("0");
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBe("1");
      await expect(limited.json()).resolves.toMatchObject({
        error: {
          status: 429,
          code: "rate_limited"
        }
      });

      const otherClient = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_other_001"
        }
      });

      expect(otherClient.status).toBe(200);

      now = 1000;

      const resetWindow = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_demo_001"
        }
      });

      expect(resetWindow.status).toBe(200);
      expect(resetWindow.headers.get("x-ratelimit-remaining")).toBe("1");
    } finally {
      await api.close();
    }
  });

  it("can use an injected shared rate-limit store without exposing raw bearer tokens as store keys", async () => {
    let now = 0;
    const buckets = new Map<string, { windowStart: number; count: number }>();
    const observedKeys: string[] = [];
    const store: ApiNodeRateLimitStore = {
      increment: ({ key, windowMs, nowMs }) => {
        observedKeys.push(key);
        const existing = buckets.get(key);
        const bucket =
          !existing || nowMs - existing.windowStart >= windowMs
            ? {
                windowStart: nowMs,
                count: 0
              }
            : existing;

        bucket.count += 1;
        buckets.set(key, bucket);

        return bucket;
      }
    };
    const rateLimit = {
      windowMs: 1000,
      maxRequests: 2,
      now: () => now,
      store
    };
    const firstApi = await startServer({ rateLimit });
    const secondApi = await startServer({ rateLimit });

    try {
      const headers = {
        authorization: "Bearer raw-session-token"
      };
      const first = await fetch(`${firstApi.baseUrl}/v1/me`, { headers });
      const second = await fetch(`${secondApi.baseUrl}/v1/me`, { headers });
      const limited = await fetch(`${firstApi.baseUrl}/v1/me`, { headers });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(limited.status).toBe(429);
      expect(observedKeys).toHaveLength(3);
      expect(new Set(observedKeys).size).toBe(1);
      expect(observedKeys.join("\n")).not.toContain("raw-session-token");

      now = 1000;

      const reset = await fetch(`${secondApi.baseUrl}/v1/me`, { headers });

      expect(reset.status).toBe(200);
      expect(reset.headers.get("x-ratelimit-remaining")).toBe("1");
    } finally {
      await firstApi.close();
      await secondApi.close();
    }
  });

  it("fails closed with a safe error when the injected rate-limit store is unavailable", async () => {
    const api = await startServer({
      rateLimit: {
        windowMs: 1000,
        maxRequests: 2,
        store: {
          increment: () => {
            throw new Error("redis password leaked");
          }
        }
      }
    });

    try {
      const response = await fetch(`${api.baseUrl}/v1/me`, {
        headers: {
          authorization: "Bearer user_demo_001"
        }
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: {
          status: 503,
          code: "rate_limit_unavailable",
          messageSafe: "Request throttling is temporarily unavailable."
        }
      });
    } finally {
      await api.close();
    }
  });

  it("emits safe request logs without headers, query strings, or bodies", async () => {
    const logs: ApiNodeRequestLogEvent[] = [];
    const api = await startServer({
      requestLogger: (event) => {
        logs.push(event);
      }
    });

    try {
      const response = await fetch(`${api.baseUrl}/v1/pets?receipt=raw-secret`, {
        method: "POST",
        headers: {
          authorization: "Bearer raw-session-token",
          "content-type": "application/json",
          "x-request-id": "req_mobile_001"
        },
        body: JSON.stringify({
          name: "Nori Secret",
          species: "dog",
          personalityTags: ["playful"],
          talkingStyle: "cute",
          favoriteThing: "raw-private-note"
        })
      });

      expect(response.status).toBe(201);
      expect(response.headers.get("x-request-id")).toBe("req_mobile_001");
      expect(logs).toEqual([
        expect.objectContaining({
          requestId: "req_mobile_001",
          method: "POST",
          path: "/v1/pets",
          status: 201,
          rateLimited: false
        })
      ]);
      expect(typeof logs[0]?.durationMs).toBe("number");
      expect(JSON.stringify(logs[0])).not.toMatch(/raw-session-token|raw-secret|Nori Secret|raw-private-note/i);
    } finally {
      await api.close();
    }
  });
});
