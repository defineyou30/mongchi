import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from "node:http";

import type { HttpMethod } from "./contracts";
import { createApiHttpRouter } from "./httpRouter";
import type { ApiHttpRequest, ApiHttpResponse, ApiHttpRouterOptions } from "./httpRouter";

export interface ApiNodeServerOptions extends ApiHttpRouterOptions {
  allowedOrigins?: readonly string[];
  maxBodyBytes?: number;
  rateLimit?: ApiNodeRateLimitOptions;
  requestLogger?: ApiNodeRequestLogger;
  readinessCheck?: ApiNodeReadinessCheck;
  serviceName?: string;
}

export interface ApiNodeServer {
  server: Server;
  router: ReturnType<typeof createApiHttpRouter>;
}

export interface ApiNodeRateLimitOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
  keyResolver?: (request: IncomingMessage) => string | null;
  store?: ApiNodeRateLimitStore;
}

export interface ApiNodeRateLimitStoreInput {
  key: string;
  windowMs: number;
  maxRequests: number;
  nowMs: number;
}

export interface ApiNodeRateLimitStoreResult {
  windowStart: number;
  count: number;
}

export interface ApiNodeRateLimitStore {
  increment: (input: ApiNodeRateLimitStoreInput) => ApiNodeRateLimitStoreResult | Promise<ApiNodeRateLimitStoreResult>;
}

export interface ApiNodeRequestLogEvent {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  rateLimited: boolean;
  errorCode?: string;
}

export type ApiNodeRequestLogger = (event: ApiNodeRequestLogEvent) => void;

export interface ApiNodeReadinessCheckResult {
  ok: boolean;
  checks?: Record<string, "ok" | "degraded" | "error">;
  messageSafe?: string;
}

export type ApiNodeReadinessCheck = () => Promise<ApiNodeReadinessCheckResult> | ApiNodeReadinessCheckResult;

interface RateLimitBucket {
  windowStart: number;
  count: number;
}

interface RateLimitDecision {
  allowed: boolean;
  headers: Record<string, string>;
  response?: ApiHttpResponse;
}

const defaultMaxBodyBytes = 1024 * 1024;
const defaultServiceName = "mongchi-api";
const supportedMethods = new Set<HttpMethod>(["GET", "POST", "PATCH", "DELETE"]);
const methodAllowHeader = "GET, POST, PATCH, DELETE";

const jsonError = (status: number, code: string, messageSafe: string): ApiHttpResponse => ({
  status,
  body: {
    error: {
      status,
      code,
      messageSafe
    }
  }
});

const normalizeHeaders = (headers: IncomingHttpHeaders): Record<string, string | undefined> =>
  Object.entries(headers).reduce<Record<string, string | undefined>>((normalizedHeaders, [key, value]) => {
    normalizedHeaders[key] = Array.isArray(value) ? value.join(", ") : value;

    return normalizedHeaders;
  }, {});

const firstHeaderValue = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const getSafePathForLog = (url: string | undefined): string => {
  const path = (url ?? "/").split("?")[0] ?? "/";

  return path.length > 512 ? path.slice(0, 512) : path || "/";
};

const getErrorCode = (apiResponse: ApiHttpResponse): string | undefined => {
  const body = apiResponse.body;
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;

  return typeof error?.code === "string" ? error.code : undefined;
};

const operationalProbeResponse = (
  status: "ok" | "ready",
  serviceName: string,
  checks: Record<string, "ok" | "degraded" | "error"> = {}
): ApiHttpResponse => ({
  status: 200,
  body: {
    status,
    service: serviceName,
    checks,
    checkedAt: new Date().toISOString()
  }
});

const notReadyResponse = (
  serviceName: string,
  code: "service_not_ready" | "readiness_check_failed",
  messageSafe: string,
  checks: Record<string, "ok" | "degraded" | "error"> = {}
): ApiHttpResponse => ({
  status: 503,
  body: {
    status: "not_ready",
    service: serviceName,
    checks,
    checkedAt: new Date().toISOString(),
    error: {
      status: 503,
      code,
      messageSafe
    }
  }
});

const createRequestId = (() => {
  let sequence = 0;

  return (request: IncomingMessage): string => {
    const providedRequestId = firstHeaderValue(request.headers["x-request-id"])?.trim();

    if (providedRequestId && /^[A-Za-z0-9_.:-]{1,128}$/.test(providedRequestId)) {
      return providedRequestId;
    }

    sequence += 1;

    return `req_${sequence.toString(36)}`;
  };
})();

const hashRateLimitKey = (scope: string, value: string): string =>
  `${scope}:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;

const defaultRateLimitKeyResolver = (request: IncomingMessage): string => {
  const authorization = firstHeaderValue(request.headers.authorization);
  const mockUserId = firstHeaderValue(request.headers["x-mock-user-id"]);

  if (authorization?.trim()) {
    return hashRateLimitKey("auth", authorization.trim());
  }

  if (mockUserId?.trim()) {
    return hashRateLimitKey("mock-user", mockUserId.trim());
  }

  return hashRateLimitKey("ip", request.socket.remoteAddress ?? "unknown");
};

const createInMemoryRateLimitStore = (): ApiNodeRateLimitStore => {
  const buckets = new Map<string, RateLimitBucket>();

  return {
    increment: ({ key, windowMs, nowMs }) => {
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
};

const createRateLimiter = (options: ApiNodeRateLimitOptions | undefined) => {
  if (!options) {
    return null;
  }

  if (options.windowMs <= 0 || options.maxRequests <= 0) {
    throw new Error("Rate limit windowMs and maxRequests must be positive.");
  }

  const now = options.now ?? Date.now;
  const resolveKey = options.keyResolver ?? defaultRateLimitKeyResolver;
  const store = options.store ?? createInMemoryRateLimitStore();

  return async (request: IncomingMessage): Promise<RateLimitDecision> => {
    const currentTime = now();
    const key = resolveKey(request) ?? defaultRateLimitKeyResolver(request);
    let bucket: ApiNodeRateLimitStoreResult;

    try {
      bucket = await store.increment({
        key,
        windowMs: options.windowMs,
        maxRequests: options.maxRequests,
        nowMs: currentTime
      });
    } catch {
      return {
        allowed: false,
        headers: {},
        response: jsonError(503, "rate_limit_unavailable", "Request throttling is temporarily unavailable.")
      };
    }

    if (
      !Number.isFinite(bucket.windowStart) ||
      !Number.isFinite(bucket.count) ||
      bucket.count < 1 ||
      bucket.windowStart > currentTime
    ) {
      return {
        allowed: false,
        headers: {},
        response: jsonError(503, "rate_limit_unavailable", "Request throttling is temporarily unavailable.")
      };
    }

    const resetAt = bucket.windowStart + options.windowMs;
    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const headers = {
      "X-RateLimit-Limit": options.maxRequests.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(resetAt / 1000).toString()
    };

    if (bucket.count <= options.maxRequests) {
      return {
        allowed: true,
        headers
      };
    }

    return {
      allowed: false,
      headers: {
        ...headers,
        "Retry-After": Math.max(1, Math.ceil((resetAt - currentTime) / 1000)).toString()
      },
      response: jsonError(429, "rate_limited", "Too many requests. Please try again soon.")
    };
  };
};

const resolveCorsHeaders = (
  request: IncomingMessage,
  allowedOrigins: readonly string[] | undefined
): Record<string, string> => {
  const origin = request.headers.origin;

  if (!origin || !allowedOrigins?.includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methodAllowHeader,
    "Access-Control-Allow-Headers": "authorization, content-type, x-mock-user-id, x-locale, x-timezone",
    Vary: "Origin"
  };
};

const sendJson = (
  response: ServerResponse,
  apiResponse: ApiHttpResponse,
  headers: Record<string, string> = {}
): void => {
  const bodyText = JSON.stringify(apiResponse.body);

  response.writeHead(apiResponse.status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(bodyText).toString(),
    ...headers
  });
  response.end(bodyText);
};

const readJsonBody = async (
  request: IncomingMessage,
  maxBodyBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; response: ApiHttpResponse }> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let bodyTooLarge = false;

    request.on("data", (chunk: Buffer) => {
      totalBytes += chunk.byteLength;

      if (totalBytes > maxBodyBytes) {
        bodyTooLarge = true;
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (bodyTooLarge) {
        resolve({
          ok: false,
          response: jsonError(413, "request_body_too_large", "Request body is too large.")
        });
        return;
      }

      if (chunks.length === 0) {
        resolve({ ok: true, body: undefined });
        return;
      }

      const text = Buffer.concat(chunks).toString("utf8");

      if (!text.trim()) {
        resolve({ ok: true, body: undefined });
        return;
      }

      try {
        resolve({ ok: true, body: JSON.parse(text) });
      } catch {
        resolve({
          ok: false,
          response: jsonError(400, "invalid_json", "Request body must be valid JSON.")
        });
      }
    });

    request.on("error", () => {
      resolve({
        ok: false,
        response: jsonError(400, "request_stream_error", "Request body could not be read.")
      });
    });
  });

export function createApiNodeServer(options: ApiNodeServerOptions = {}): ApiNodeServer {
  const router = createApiHttpRouter(options);
  const maxBodyBytes = options.maxBodyBytes ?? defaultMaxBodyBytes;
  const rateLimiter = createRateLimiter(options.rateLimit);
  const serviceName = options.serviceName ?? defaultServiceName;

  const server = createServer((request, response) => {
    const startedAt = Date.now();
    const requestId = createRequestId(request);
    const logPath = getSafePathForLog(request.url);
    const logResponse = (apiResponse: ApiHttpResponse, rateLimited = false): void => {
      const errorCode = getErrorCode(apiResponse);

      try {
        options.requestLogger?.({
          requestId,
          method: request.method ?? "UNKNOWN",
          path: logPath,
          status: apiResponse.status,
          durationMs: Math.max(0, Date.now() - startedAt),
          rateLimited,
          ...(errorCode ? { errorCode } : {})
        });
      } catch {
        // Logging must never break API responses.
      }
    };

    void (async () => {
      const corsHeaders = resolveCorsHeaders(request, options.allowedOrigins);
      const requestIdHeaders = {
        "X-Request-Id": requestId
      };

      if (request.method === "OPTIONS") {
        const responsePayload: ApiHttpResponse = {
          status: 204,
          body: null
        };

        response.writeHead(204, {
          Allow: methodAllowHeader,
          ...requestIdHeaders,
          ...corsHeaders
        });
        response.end();
        logResponse(responsePayload);
        return;
      }

      if (!request.method || !supportedMethods.has(request.method as HttpMethod)) {
        const responsePayload = jsonError(405, "method_not_allowed", "Method not allowed.");

        sendJson(response, responsePayload, {
          Allow: methodAllowHeader,
          ...requestIdHeaders,
          ...corsHeaders
        });
        logResponse(responsePayload);
        return;
      }

      if (request.method === "GET" && logPath === "/healthz") {
        const responsePayload = operationalProbeResponse("ok", serviceName);

        sendJson(response, responsePayload, {
          ...requestIdHeaders,
          ...corsHeaders
        });
        logResponse(responsePayload);
        return;
      }

      if (request.method === "GET" && logPath === "/readyz") {
        let responsePayload: ApiHttpResponse;

        try {
          const readiness = options.readinessCheck ? await options.readinessCheck() : { ok: true, checks: { runtime: "ok" as const } };

          responsePayload = readiness.ok
            ? operationalProbeResponse("ready", serviceName, readiness.checks)
            : notReadyResponse(
                serviceName,
                "service_not_ready",
                readiness.messageSafe ?? "Service is not ready.",
                readiness.checks
              );
        } catch {
          responsePayload = notReadyResponse(serviceName, "readiness_check_failed", "Readiness check failed.", {
            runtime: "error"
          });
        }

        sendJson(response, responsePayload, {
          ...requestIdHeaders,
          ...corsHeaders
        });
        logResponse(responsePayload);
        return;
      }

      const rateLimit = rateLimiter ? await rateLimiter(request) : undefined;

      if (rateLimit && !rateLimit.allowed) {
        const responsePayload = rateLimit.response ?? jsonError(429, "rate_limited", "Too many requests. Please try again soon.");

        sendJson(response, responsePayload, {
          ...requestIdHeaders,
          ...corsHeaders,
          ...rateLimit.headers
        });
        logResponse(responsePayload, true);
        return;
      }

      const parsedBody = await readJsonBody(request, maxBodyBytes);

      if (!parsedBody.ok) {
        sendJson(response, parsedBody.response, {
          ...requestIdHeaders,
          ...corsHeaders,
          ...(rateLimit?.headers ?? {})
        });
        logResponse(parsedBody.response);
        return;
      }

      const apiRequest: ApiHttpRequest = {
        method: request.method as HttpMethod,
        path: request.url ?? "/",
        headers: normalizeHeaders(request.headers),
        ...(parsedBody.body !== undefined ? { body: parsedBody.body } : {})
      };

      const apiResponse = await router.handleAsync(apiRequest);

      sendJson(response, apiResponse, {
        ...requestIdHeaders,
        ...corsHeaders,
        ...(rateLimit?.headers ?? {})
      });
      logResponse(apiResponse);
    })().catch(() => {
      if (response.writableEnded) {
        return;
      }

      if (response.headersSent) {
        response.destroy();
        return;
      }

      const responsePayload = jsonError(500, "internal_server_error", "The server could not complete the request.");

      sendJson(response, responsePayload, {
        "X-Request-Id": requestId
      });
      logResponse(responsePayload);
    });
  });

  return { server, router };
}
