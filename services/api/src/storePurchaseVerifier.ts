import type { ISODateTime } from "@mongchi/shared";

import type { ApiRuntimeConfig } from "./apiRuntimeConfig";
import type {
  StorePurchaseVerificationError,
  StorePurchaseVerificationInput,
  StorePurchaseVerificationResult,
  StorePurchaseVerificationStatus,
  StorePurchaseVerifier,
  StorePurchaseRestoreInput,
  StorePurchaseRestoreResult,
  VerifiedStorePurchase
} from "./purchaseVerifier";

export type HttpStorePurchaseVerifierFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

export interface HttpStorePurchaseVerifierOptions {
  endpoint: string;
  apiKey: string;
  fetch?: HttpStorePurchaseVerifierFetch;
  logger?: StorePurchaseVerifierLogger;
}

export interface HttpStorePurchaseVerifierRuntimeOptions
  extends Omit<HttpStorePurchaseVerifierOptions, "endpoint" | "apiKey"> {}

export interface StorePurchaseVerifierLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

type StoreVerifierOperation = "verify_purchase" | "restore_purchases";

const defaultInvalidResponseError: StorePurchaseVerificationError = {
  status: 503,
  code: "store_verifier_invalid_response",
  messageSafe: "Store purchase verification returned an invalid response."
};

const transactionIdPattern = /^[A-Za-z0-9_.:-]{6,160}$/;
const productIdPattern = /^[A-Za-z0-9_.:-]{1,160}$/;
const contentHashPattern = /^(sha256:)?[a-f0-9]{32,128}$/i;
const safeErrorCodePattern = /^[a-z][a-z0-9_:-]{1,95}$/;

const getGlobalFetch = (): HttpStorePurchaseVerifierFetch => {
  const globalFetch = (globalThis as { fetch?: HttpStorePurchaseVerifierFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for store purchase verification.");
  }

  return globalFetch;
};

const normalizeEndpoint = (endpoint: string): string => endpoint.replace(/\/+$/g, "");

const normalizeErrorStatus = (value: unknown, fallback: number): StorePurchaseVerificationStatus => {
  const candidate = typeof value === "number" ? value : fallback;

  if (candidate === 400 || candidate === 409 || candidate === 422 || candidate === 503) {
    return candidate;
  }

  return 503;
};

const normalizeErrorCode = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  return safeErrorCodePattern.test(normalized) ? normalized : fallback;
};

const normalizeSafeMessage = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

  return normalized.length > 0 && normalized.length <= 240 ? normalized : fallback;
};

const readResponseJson = async (response: { json: () => Promise<unknown> }): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const readVerifierError = (body: unknown, fallbackStatus: number): StorePurchaseVerificationError => {
  const record = body && typeof body === "object" ? (body as { error?: unknown }) : {};
  const error = record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : {};
  const status = normalizeErrorStatus(error.status, fallbackStatus);

  return {
    status,
    code: normalizeErrorCode(error.code, status === 409 ? "purchase_verification_mismatch" : "store_verifier_rejected"),
    messageSafe: normalizeSafeMessage(error.messageSafe, "Store purchase verification was rejected.")
  };
};

const normalizeIsoDateTime = (value: unknown): ISODateTime | null | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const normalizeEnvironment = (value: unknown): VerifiedStorePurchase["environment"] | null => {
  if (value === undefined || value === null || value === "") {
    return "unknown";
  }

  return value === "sandbox" || value === "production" || value === "unknown" ? value : null;
};

const normalizeVerifiedPurchase = (value: unknown): VerifiedStorePurchase | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const platform = record.platform;
  const productId = record.productId;
  const transactionId = record.transactionId;
  const receiptHash = record.receiptHash;
  const verifiedAt = normalizeIsoDateTime(record.verifiedAt);
  const environment = normalizeEnvironment(record.environment);

  if (
    (platform !== "ios" && platform !== "android") ||
    typeof productId !== "string" ||
    !productIdPattern.test(productId) ||
    typeof transactionId !== "string" ||
    !transactionIdPattern.test(transactionId) ||
    typeof receiptHash !== "string" ||
    !contentHashPattern.test(receiptHash) ||
    verifiedAt === null ||
    environment === null
  ) {
    return null;
  }

  return {
    platform,
    productId,
    transactionId,
    receiptHash,
    ...(verifiedAt ? { verifiedAt } : {}),
    environment
  };
};

const readPurchase = (body: unknown): VerifiedStorePurchase | null => {
  const record = body && typeof body === "object" ? (body as { purchase?: unknown }) : {};

  return normalizeVerifiedPurchase(record.purchase);
};

const readPurchases = (body: unknown): VerifiedStorePurchase[] | null => {
  const record = body && typeof body === "object" ? (body as { purchases?: unknown }) : {};

  if (!Array.isArray(record.purchases)) {
    return null;
  }

  const purchases = record.purchases.map(normalizeVerifiedPurchase);

  return purchases.every((purchase): purchase is VerifiedStorePurchase => purchase !== null) ? purchases : null;
};

export const createHttpStorePurchaseVerifier = ({
  endpoint,
  apiKey,
  fetch,
  logger
}: HttpStorePurchaseVerifierOptions): StorePurchaseVerifier => {
  const resolvedEndpoint = normalizeEndpoint(endpoint);
  const resolvedFetch = fetch ?? getGlobalFetch();
  const authorization = `Bearer ${apiKey}`;

  const post = async (
    operation: StoreVerifierOperation,
    payload: Record<string, unknown>
  ): Promise<
    | {
        ok: true;
        body: unknown;
      }
    | {
        ok: false;
        error: StorePurchaseVerificationError;
      }
  > => {
    const startedAt = Date.now();
    const telemetryBase = {
      operation,
      platform: payload.platform,
      ...(operation === "verify_purchase" ? { productId: payload.productId } : {}),
      ...(operation === "restore_purchases" && Array.isArray(payload.transactionIds)
        ? { transactionCount: payload.transactionIds.length }
        : {}),
      ...(operation === "restore_purchases" && Array.isArray(payload.purchases)
        ? { purchaseTokenCount: payload.purchases.length }
        : {})
    };
    let response: Awaited<ReturnType<HttpStorePurchaseVerifierFetch>>;

    try {
      response = await resolvedFetch(resolvedEndpoint, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          operation,
          ...payload
        })
      });
    } catch {
      logger?.error?.("store_purchase_verifier_transport_failed", {
        ...telemetryBase,
        durationMs: Math.max(0, Date.now() - startedAt)
      });

      return {
        ok: false,
        error: {
          status: 503,
          code: "store_verifier_unavailable",
          messageSafe: "Store purchase verification is unavailable."
        }
      };
    }

    const body = await readResponseJson(response);
    const durationMs = Math.max(0, Date.now() - startedAt);

    if (response.status < 200 || response.status >= 300) {
      logger?.[response.status >= 500 ? "error" : "info"]?.("store_purchase_verifier_rejected", {
        ...telemetryBase,
        httpStatus: response.status,
        durationMs
      });

      return {
        ok: false,
        error: readVerifierError(body, response.status)
      };
    }

    logger?.info?.("store_purchase_verifier_succeeded", {
      ...telemetryBase,
      httpStatus: response.status,
      durationMs
    });

    return {
      ok: true,
      body
    };
  };

  return {
    verifyPurchase: async (input: StorePurchaseVerificationInput): Promise<StorePurchaseVerificationResult> => {
      const verified = await post("verify_purchase", {
        platform: input.platform,
        productId: input.productId,
        transactionId: input.transactionId,
        receiptHash: input.receiptHash,
        ...(input.storeVerificationToken ? { storeVerificationToken: input.storeVerificationToken } : {}),
        userId: input.userId,
        requestedAt: input.requestedAt
      });

      if (!verified.ok) {
        return verified;
      }

      const purchase = readPurchase(verified.body);

      return purchase
        ? {
            ok: true,
            purchase
          }
        : {
            ok: false,
            error: defaultInvalidResponseError
          };
    },
    restorePurchases: async (input: StorePurchaseRestoreInput): Promise<StorePurchaseRestoreResult> => {
      const restored = await post("restore_purchases", {
        platform: input.platform,
        transactionIds: [...input.transactionIds],
        ...(input.purchases ? { purchases: input.purchases.map((purchase) => ({ ...purchase })) } : {}),
        userId: input.userId,
        requestedAt: input.requestedAt
      });

      if (!restored.ok) {
        return restored;
      }

      const purchases = readPurchases(restored.body);

      return purchases
        ? {
            ok: true,
            purchases
          }
        : {
            ok: false,
            error: defaultInvalidResponseError
          };
    }
  };
};

export const createHttpStorePurchaseVerifierFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: HttpStorePurchaseVerifierRuntimeOptions = {}
): StorePurchaseVerifier => {
  if (!config.storeVerifier || config.storeVerifier.provider !== "http") {
    throw new Error("Store purchase verifier runtime config is not available.");
  }

  return createHttpStorePurchaseVerifier({
    endpoint: config.storeVerifier.endpoint,
    apiKey: config.storeVerifier.apiKey,
    ...options
  });
};
