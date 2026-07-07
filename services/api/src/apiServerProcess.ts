import type { AddressInfo } from "node:net";

import type { ApiRuntimeConfig, ApiRuntimeEnvironment } from "./apiRuntimeConfig";
import { requireApiRuntimeConfig } from "./apiRuntimeConfig";
import type { ApiNodeRateLimitOptions, ApiNodeServer } from "./nodeServer";
import type { OperationalLogger } from "./operationalLogger";
import { createJsonLineOperationalLogger } from "./operationalLogger";
import { createPostgresApiNodeServerFromRuntimeConfig } from "./postgresNodeServer";
import type { PostgresApiNodeServerRuntimeOptions } from "./postgresNodeServer";
import type { PostgresApiDatabaseClient } from "./postgresClient";
import { createPostgresApiDatabaseClientFromRuntimeConfig } from "./postgresClient";
import { createPostgresApiRateLimitStore } from "./postgresRateLimitStore";

export interface ApiNodeServerProcessRuntimeOptions {
  host: string;
  port: number;
  allowedOrigins?: readonly string[];
  maxBodyBytes?: number;
  rateLimit?: ApiNodeRateLimitOptions;
  serviceName?: string;
}

export type ApiNodeServerProcessRuntimeOptionsResult =
  | {
      ok: true;
      options: ApiNodeServerProcessRuntimeOptions;
    }
  | {
      ok: false;
      errors: string[];
    };

export interface CreatePostgresApiNodeServerDeploymentOptions
  extends Omit<PostgresApiNodeServerRuntimeOptions, "databaseClient" | "operationalLogger"> {
  databaseClient?: PostgresApiDatabaseClient;
  createDatabaseClient?: (config: ApiRuntimeConfig) => PostgresApiDatabaseClient;
  operationalLogger?: OperationalLogger;
}

export interface PostgresApiNodeServerDeployment extends ApiNodeServer {
  listen: (options?: Partial<Pick<ApiNodeServerProcessRuntimeOptions, "host" | "port">>) => Promise<ApiNodeServerListenResult>;
  close: () => Promise<void>;
}

export interface ApiNodeServerListenResult {
  host: string;
  port: number;
  baseUrl: string;
}

export interface StartPostgresApiNodeServerFromRuntimeEnvOptions extends CreatePostgresApiNodeServerDeploymentOptions {
  env?: ApiRuntimeEnvironment;
  runtimeConfig?: ApiRuntimeConfig;
  signal?: AbortSignal;
}

export interface StartedPostgresApiNodeServer extends PostgresApiNodeServerDeployment {
  listenResult: ApiNodeServerListenResult;
}

const defaultHost = "0.0.0.0";
const defaultPort = 8787;
const maxApiPort = 65_535;
const maxApiBodyBytes = 20 * 1024 * 1024;
const maxRateLimitWindowMs = 86_400_000;
const maxRateLimitRequests = 100_000;

const parsePositiveInteger = (value: string | undefined): number | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isSafeInteger(parsed) ? parsed : null;
};

const normalizeHost = (value: string | undefined): string | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.length <= 255 && !/[\u0000-\u001f\s]/.test(trimmed) ? trimmed : null;
};

const normalizeServiceName = (value: string | undefined): string | null | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return /^[A-Za-z0-9_.:-]{1,96}$/.test(trimmed) ? trimmed : null;
};

const normalizeOrigin = (value: string): string | null => {
  const trimmed = value.trim().replace(/\/$/g, "");

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

const readAllowedOrigins = (value: string | undefined): { ok: true; origins?: string[] } | { ok: false } => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return { ok: true };
  }

  const origins = trimmed
    .split(",")
    .map(normalizeOrigin);

  if (origins.length === 0 || origins.some((origin) => origin === null)) {
    return { ok: false };
  }

  return {
    ok: true,
    origins: [...new Set(origins as string[])]
  };
};

export const readApiNodeServerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): ApiNodeServerProcessRuntimeOptionsResult => {
  const errors: string[] = [];
  const host = normalizeHost(env.TINY_PET_API_HOST);
  const port = parsePositiveInteger(env.TINY_PET_API_PORT);
  const maxBodyBytes = parsePositiveInteger(env.TINY_PET_API_MAX_BODY_BYTES);
  const rateLimitWindowMs = parsePositiveInteger(env.TINY_PET_API_RATE_LIMIT_WINDOW_MS);
  const rateLimitMaxRequests = parsePositiveInteger(env.TINY_PET_API_RATE_LIMIT_MAX_REQUESTS);
  const serviceName = normalizeServiceName(env.TINY_PET_API_SERVICE_NAME);
  const allowedOrigins = readAllowedOrigins(env.TINY_PET_API_ALLOWED_ORIGINS);

  if (host === null) {
    errors.push("TINY_PET_API_HOST must be a host name or IP address without whitespace.");
  }

  if (port === null || (port !== undefined && port > maxApiPort)) {
    errors.push("TINY_PET_API_PORT must be an integer from 0 to 65535 when set.");
  }

  if (maxBodyBytes === null || (maxBodyBytes !== undefined && (maxBodyBytes <= 0 || maxBodyBytes > maxApiBodyBytes))) {
    errors.push("TINY_PET_API_MAX_BODY_BYTES must be a positive integer no greater than 20971520 when set.");
  }

  if (rateLimitWindowMs === null || (rateLimitWindowMs !== undefined && (rateLimitWindowMs <= 0 || rateLimitWindowMs > maxRateLimitWindowMs))) {
    errors.push("TINY_PET_API_RATE_LIMIT_WINDOW_MS must be a positive integer no greater than 86400000 when set.");
  }

  if (
    rateLimitMaxRequests === null ||
    (rateLimitMaxRequests !== undefined && (rateLimitMaxRequests <= 0 || rateLimitMaxRequests > maxRateLimitRequests))
  ) {
    errors.push("TINY_PET_API_RATE_LIMIT_MAX_REQUESTS must be a positive integer no greater than 100000 when set.");
  }

  if ((rateLimitWindowMs !== undefined && rateLimitWindowMs !== null) !== (rateLimitMaxRequests !== undefined && rateLimitMaxRequests !== null)) {
    errors.push("TINY_PET_API_RATE_LIMIT_WINDOW_MS and TINY_PET_API_RATE_LIMIT_MAX_REQUESTS must be set together.");
  }

  if (serviceName === null) {
    errors.push("TINY_PET_API_SERVICE_NAME must be a safe service identifier when set.");
  }

  if (!allowedOrigins.ok) {
    errors.push("TINY_PET_API_ALLOWED_ORIGINS must be a comma-separated list of http(s) origins without paths.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const resolvedAllowedOrigins = allowedOrigins.ok ? allowedOrigins.origins : undefined;
  const resolvedMaxBodyBytes = typeof maxBodyBytes === "number" ? maxBodyBytes : undefined;
  const resolvedRateLimitWindowMs = typeof rateLimitWindowMs === "number" ? rateLimitWindowMs : undefined;
  const resolvedRateLimitMaxRequests = typeof rateLimitMaxRequests === "number" ? rateLimitMaxRequests : undefined;

  return {
    ok: true,
    options: {
      host: host ?? defaultHost,
      port: port ?? defaultPort,
      ...(resolvedAllowedOrigins ? { allowedOrigins: resolvedAllowedOrigins } : {}),
      ...(resolvedMaxBodyBytes !== undefined ? { maxBodyBytes: resolvedMaxBodyBytes } : {}),
      ...(resolvedRateLimitWindowMs !== undefined && resolvedRateLimitMaxRequests !== undefined
        ? {
            rateLimit: {
              windowMs: resolvedRateLimitWindowMs,
              maxRequests: resolvedRateLimitMaxRequests
            }
          }
        : {}),
      ...(serviceName ? { serviceName } : {})
    }
  };
};

export const requireApiNodeServerProcessRuntimeOptions = (
  env: ApiRuntimeEnvironment = {}
): ApiNodeServerProcessRuntimeOptions => {
  const result = readApiNodeServerProcessRuntimeOptions(env);

  if (result.ok) {
    return result.options;
  }

  throw new Error(`Invalid API server process config:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
};

const closeServer = (server: ApiNodeServer["server"]): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export const createPostgresApiNodeServerDeployment = (
  config: ApiRuntimeConfig,
  { databaseClient, createDatabaseClient, operationalLogger, ...options }: CreatePostgresApiNodeServerDeploymentOptions = {}
): PostgresApiNodeServerDeployment => {
  const ownsDatabaseClient = !databaseClient;
  const resolvedDatabaseClient = databaseClient ?? createDatabaseClient?.(config) ?? createPostgresApiDatabaseClientFromRuntimeConfig(config);
  const resolvedRateLimit =
    options.rateLimit && !options.rateLimit.store
      ? {
          ...options.rateLimit,
          store: createPostgresApiRateLimitStore(resolvedDatabaseClient)
        }
      : options.rateLimit;
  const api = createPostgresApiNodeServerFromRuntimeConfig(config, {
    ...options,
    ...(resolvedRateLimit ? { rateLimit: resolvedRateLimit } : {}),
    databaseClient: resolvedDatabaseClient,
    ...(operationalLogger ? { operationalLogger } : {}),
    // Production must never accept mock bearer tokens / x-mock-user-id headers as authentication,
    // regardless of what a caller or env-derived option would otherwise set. This overrides any
    // allowMockAuth value in `options` when the release profile is production.
    ...(config.production ? { allowMockAuth: false } : {})
  });
  let closed = false;

  return {
    ...api,
    listen: ({ host = defaultHost, port = defaultPort } = {}) =>
      new Promise<ApiNodeServerListenResult>((resolve, reject) => {
        const onError = (error: Error) => {
          api.server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          api.server.off("error", onError);
          const address = api.server.address();

          if (!address || typeof address === "string") {
            reject(new Error("Expected TCP listener address."));
            return;
          }

          const resolvedAddress = address as AddressInfo;
          const resolvedHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;

          resolve({
            host,
            port: resolvedAddress.port,
            baseUrl: `http://${resolvedHost}:${resolvedAddress.port}`
          });
        };

        api.server.once("error", onError);
        api.server.once("listening", onListening);
        api.server.listen(port, host);
      }),
    close: async () => {
      if (closed) {
        return;
      }

      closed = true;
      await closeServer(api.server);

      if (ownsDatabaseClient) {
        await resolvedDatabaseClient.end();
      }
    }
  };
};

export const startPostgresApiNodeServerFromRuntimeEnv = async ({
  env,
  runtimeConfig,
  signal,
  operationalLogger = createJsonLineOperationalLogger(),
  ...deploymentOptions
}: StartPostgresApiNodeServerFromRuntimeEnvOptions = {}): Promise<StartedPostgresApiNodeServer> => {
  const config = runtimeConfig ?? requireApiRuntimeConfig(env);
  const processOptions = requireApiNodeServerProcessRuntimeOptions(env);
  const deployment = createPostgresApiNodeServerDeployment(config, {
    ...deploymentOptions,
    operationalLogger,
    ...(processOptions.allowedOrigins ? { allowedOrigins: processOptions.allowedOrigins } : {}),
    ...(processOptions.maxBodyBytes !== undefined ? { maxBodyBytes: processOptions.maxBodyBytes } : {}),
    ...(processOptions.rateLimit ? { rateLimit: processOptions.rateLimit } : {}),
    ...(processOptions.serviceName ? { serviceName: processOptions.serviceName } : {})
  });
  const listenResult = await deployment.listen({
    host: processOptions.host,
    port: processOptions.port
  });

  operationalLogger.info?.("api_server_started", {
    host: listenResult.host,
    port: listenResult.port,
    serviceName: processOptions.serviceName ?? "mongchi-api"
  });

  const closeWithLog = async () => {
    await deployment.close();
    operationalLogger.info?.("api_server_stopped", {
      host: listenResult.host,
      port: listenResult.port,
      serviceName: processOptions.serviceName ?? "mongchi-api"
    });
  };

  if (signal) {
    if (signal.aborted) {
      await closeWithLog();
    } else {
      signal.addEventListener(
        "abort",
        () => {
          void closeWithLog();
        },
        { once: true }
      );
    }
  }

  return {
    ...deployment,
    listenResult,
    close: closeWithLog
  };
};
