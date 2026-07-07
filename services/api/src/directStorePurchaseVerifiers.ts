import { createHash, createSign } from "node:crypto";

import type { ISODateTime } from "@mongchi/shared";

import { createAppStoreNotificationJwsVerifier } from "./appStoreWebhookVerifier";
import type { AppStoreJwsVerifier } from "./appStoreWebhookVerifier";
import type { ApiRuntimeConfig } from "./apiRuntimeConfig";
import type {
  StorePurchaseVerificationError,
  StorePurchaseVerificationInput,
  StorePurchaseVerificationResult,
  StorePurchaseVerifier,
  StorePurchaseRestoreInput,
  StorePurchaseRestoreResult,
  VerifiedStorePurchase
} from "./purchaseVerifier";

export type StoreApiFetch = (
  url: string,
  init: {
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
  }
) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

export type StoreAccessTokenProvider = () => Promise<string>;

export interface AppleAppStoreJwtOptions {
  issuerId: string;
  keyId: string;
  bundleId: string;
  privateKey: string;
  now?: () => ISODateTime;
}

export interface AppleAppStorePurchaseVerifierOptions {
  bundleId: string;
  issuerId?: string;
  keyId?: string;
  privateKey?: string;
  jwtProvider?: StoreAccessTokenProvider;
  environment?: "sandbox" | "production";
  baseUrl?: string;
  fetch?: StoreApiFetch;
  now?: () => ISODateTime;
  signedTransactionVerifier?: AppStoreJwsVerifier;
  decodeSignedTransaction?: (signedTransactionInfo: string) => AppleSignedTransactionInfo | null;
}

export interface GoogleServiceAccountAccessTokenProviderOptions {
  clientEmail: string;
  privateKey: string;
  tokenUrl?: string;
  fetch?: StoreApiFetch;
  now?: () => ISODateTime;
}

export interface GooglePlayPurchaseVerifierOptions {
  packageName: string;
  serviceAccountClientEmail?: string;
  serviceAccountPrivateKey?: string;
  accessTokenProvider?: StoreAccessTokenProvider;
  subscriptionProductIds?: readonly string[];
  baseUrl?: string;
  fetch?: StoreApiFetch;
  now?: () => ISODateTime;
}

export interface DirectStorePurchaseVerifierOptions {
  appStore?: StorePurchaseVerifier;
  googlePlay?: StorePurchaseVerifier;
}

export interface DirectStorePurchaseVerifierRuntimeOptions {
  fetch?: StoreApiFetch;
  appStoreJwtProvider?: StoreAccessTokenProvider;
  googlePlayAccessTokenProvider?: StoreAccessTokenProvider;
  now?: () => ISODateTime;
}

export interface AppleSignedTransactionInfo {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  bundleId?: string;
  environment?: string;
  expiresDate?: number;
  revocationDate?: number;
}

interface GoogleProductPurchase {
  purchaseState?: unknown;
  orderId?: unknown;
  productId?: unknown;
  purchaseTimeMillis?: unknown;
  purchaseType?: unknown;
}

interface GoogleSubscriptionPurchaseV2 {
  subscriptionState?: unknown;
  latestOrderId?: unknown;
  startTime?: unknown;
  testPurchase?: unknown;
  lineItems?: unknown;
}

interface GoogleSubscriptionLineItem {
  productId?: unknown;
  expiryTime?: unknown;
}

const defaultAppleProductionBaseUrl = "https://api.storekit.itunes.apple.com";
const defaultAppleSandboxBaseUrl = "https://api.storekit-sandbox.itunes.apple.com";
const defaultGooglePlayBaseUrl = "https://androidpublisher.googleapis.com";
const defaultGoogleTokenUrl = "https://oauth2.googleapis.com/token";
const androidPublisherScope = "https://www.googleapis.com/auth/androidpublisher";
const DEFAULT_NOW = "2026-06-24T09:00:00.000Z";

const unavailable = (code = "store_verifier_unavailable"): StorePurchaseVerificationResult => ({
  ok: false,
  error: {
    status: 503,
    code,
    messageSafe: "Store purchase verification is unavailable."
  }
});

const unavailableError = (code = "store_verifier_unavailable"): StorePurchaseVerificationError => ({
  status: 503,
  code,
  messageSafe: "Store purchase verification is unavailable."
});

const rejected = (code = "store_receipt_invalid", status: 400 | 409 | 422 = 422): StorePurchaseVerificationResult => ({
  ok: false,
  error: {
    status,
    code,
    messageSafe: "The store could not verify this purchase."
  }
});

const restoreUnavailable = (code = "store_verifier_unavailable"): StorePurchaseRestoreResult => ({
  ok: false,
  error: {
    status: 503,
    code,
    messageSafe: "Store purchase verification is unavailable."
  }
});

const restoreRejected = (code = "store_receipt_invalid"): StorePurchaseRestoreResult => ({
  ok: false,
  error: {
    status: 422,
    code,
    messageSafe: "The store could not verify this purchase."
  }
});

const invalidStoreVerifierResponseError: StorePurchaseVerificationError = {
  status: 503,
  code: "store_verifier_invalid_response",
  messageSafe: "Store purchase verification returned an invalid response."
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/g, "");

const getGlobalFetch = (): StoreApiFetch => {
  const globalFetch = (globalThis as { fetch?: StoreApiFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for store purchase verification.");
  }

  return globalFetch;
};

const base64Url = (value: Buffer | string): string =>
  Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const sha256ReceiptHash = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const readJson = async (response: { json: () => Promise<unknown> }): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const mapStoreHttpError = (status: number): StorePurchaseVerificationError =>
  status >= 500
    ? {
        status: 503,
        code: "store_verifier_unavailable",
        messageSafe: "Store purchase verification is unavailable."
      }
    : {
        status: status === 409 ? 409 : 422,
        code: "store_receipt_invalid",
        messageSafe: "The store could not verify this purchase."
      };

const decodeBase64UrlJson = (value: string): unknown => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");

  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as unknown;
};

const decodeAppleSignedTransaction = (signedTransactionInfo: string): AppleSignedTransactionInfo | null => {
  try {
    const [, payload] = signedTransactionInfo.split(".");

    if (!payload) {
      return null;
    }

    const parsed = decodeBase64UrlJson(payload);

    return parsed && typeof parsed === "object" ? (parsed as AppleSignedTransactionInfo) : null;
  } catch {
    return null;
  }
};

const derToJose = (signature: Buffer, keySize = 32): Buffer => {
  let offset = 0;
  const readByte = (): number => {
    const byte = signature[offset++];

    if (byte === undefined) {
      throw new Error("Invalid ECDSA signature.");
    }

    return byte;
  };

  if (readByte() !== 0x30) {
    throw new Error("Invalid ECDSA signature.");
  }

  const sequenceLength = readByte();

  if (sequenceLength + offset !== signature.length || readByte() !== 0x02) {
    throw new Error("Invalid ECDSA signature.");
  }

  const rLength = readByte();
  const r = signature.subarray(offset, offset + rLength);
  offset += rLength;

  if (readByte() !== 0x02) {
    throw new Error("Invalid ECDSA signature.");
  }

  const sLength = readByte();
  const s = signature.subarray(offset, offset + sLength);
  const normalize = (integer: Buffer): Buffer => {
    const stripped = integer[0] === 0 ? integer.subarray(1) : integer;

    if (stripped.length > keySize) {
      return stripped.subarray(stripped.length - keySize);
    }

    if (stripped.length === keySize) {
      return stripped;
    }

    return Buffer.concat([Buffer.alloc(keySize - stripped.length), stripped]);
  };

  return Buffer.concat([normalize(r), normalize(s)]);
};

export const createAppleAppStoreServerApiJwt = ({
  issuerId,
  keyId,
  bundleId,
  privateKey,
  now = () => DEFAULT_NOW
}: AppleAppStoreJwtOptions): string => {
  const issuedAtSeconds = Math.floor(new Date(now()).getTime() / 1000);
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT"
  };
  const payload = {
    iss: issuerId,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + 15 * 60,
    aud: "appstoreconnect-v1",
    bid: bundleId
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign("sha256").update(signingInput).sign(privateKey);

  return `${signingInput}.${base64Url(derToJose(signature))}`;
};

const ensureAppleJwtProvider = (options: AppleAppStorePurchaseVerifierOptions): StoreAccessTokenProvider => {
  if (options.jwtProvider) {
    return options.jwtProvider;
  }

  if (!options.issuerId || !options.keyId || !options.privateKey) {
    throw new Error("Apple App Store verifier requires issuerId, keyId, privateKey, or jwtProvider.");
  }

  return async () =>
    createAppleAppStoreServerApiJwt({
      issuerId: options.issuerId as string,
      keyId: options.keyId as string,
      bundleId: options.bundleId,
      privateKey: options.privateKey as string,
      ...(options.now ? { now: options.now } : {})
    });
};

const appleEnvironment = (value: string | undefined): VerifiedStorePurchase["environment"] => {
  if (value === "Sandbox" || value === "sandbox") {
    return "sandbox";
  }

  if (value === "Production" || value === "production") {
    return "production";
  }

  return "unknown";
};

const isAppleTransactionActive = (transaction: AppleSignedTransactionInfo, requestedAt: ISODateTime): boolean => {
  if (typeof transaction.revocationDate === "number" && transaction.revocationDate > 0) {
    return false;
  }

  if (typeof transaction.expiresDate === "number" && transaction.expiresDate <= new Date(requestedAt).getTime()) {
    return false;
  }

  return true;
};

export const createAppleAppStorePurchaseVerifier = (options: AppleAppStorePurchaseVerifierOptions): StorePurchaseVerifier => {
  const fetch = options.fetch ?? getGlobalFetch();
  const jwtProvider = ensureAppleJwtProvider(options);
  const decodeSignedTransaction = options.decodeSignedTransaction ?? decodeAppleSignedTransaction;
  const verifySignedTransaction = (signedTransactionInfo: string): boolean => {
    try {
      return options.signedTransactionVerifier?.verifyAppStoreJws({
        jws: signedTransactionInfo,
        purpose: "transaction"
      }) ?? true;
    } catch {
      return false;
    }
  };
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ??
      (options.environment === "sandbox" ? defaultAppleSandboxBaseUrl : defaultAppleProductionBaseUrl)
  );

  const getTransaction = async (
    transactionId: string
  ): Promise<
    | {
        ok: true;
        signedTransactionInfo: string;
        transaction: AppleSignedTransactionInfo;
      }
    | {
        ok: false;
        error: StorePurchaseVerificationError;
      }
  > => {
    let response: Awaited<ReturnType<StoreApiFetch>>;

    try {
      response = await fetch(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await jwtProvider()}`,
          Accept: "application/json"
        }
      });
    } catch {
      return {
        ok: false,
        error: unavailableError()
      };
    }

    const body = await readJson(response);

    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        error: mapStoreHttpError(response.status)
      };
    }

    const signedTransactionInfo =
      body && typeof body === "object" && typeof (body as { signedTransactionInfo?: unknown }).signedTransactionInfo === "string"
        ? ((body as { signedTransactionInfo: string }).signedTransactionInfo)
        : null;
    const transaction =
      signedTransactionInfo && verifySignedTransaction(signedTransactionInfo) ? decodeSignedTransaction(signedTransactionInfo) : null;

    return signedTransactionInfo && transaction
      ? {
          ok: true,
          signedTransactionInfo,
          transaction
        }
      : {
          ok: false,
          error: invalidStoreVerifierResponseError
        };
  };

  const purchaseFromTransaction = (
    input: StorePurchaseVerificationInput | (StorePurchaseRestoreInput & { productId?: string; receiptHash?: string }),
    signedTransactionInfo: string,
    transaction: AppleSignedTransactionInfo
  ): VerifiedStorePurchase | null => {
    const productId = transaction.productId;
    const transactionId = transaction.transactionId;

    if (
      transaction.bundleId !== options.bundleId ||
      typeof productId !== "string" ||
      typeof transactionId !== "string" ||
      ("productId" in input && input.productId && productId !== input.productId) ||
      !isAppleTransactionActive(transaction, input.requestedAt)
    ) {
      return null;
    }

    return {
      platform: "ios",
      productId,
      transactionId,
      receiptHash: input.receiptHash ?? sha256ReceiptHash(signedTransactionInfo),
      verifiedAt: input.requestedAt,
      environment: appleEnvironment(transaction.environment)
    };
  };

  return {
    verifyPurchase: async (input) => {
      if (input.platform !== "ios") {
        return rejected("unsupported_purchase_platform");
      }

      const transaction = await getTransaction(input.transactionId);

      if (!transaction.ok) {
        return {
          ok: false,
          error: transaction.error
        };
      }

      const purchase = purchaseFromTransaction(input, transaction.signedTransactionInfo, transaction.transaction);

      return purchase
        ? {
            ok: true,
            purchase
          }
        : rejected("store_receipt_mismatch", 409);
    },
    restorePurchases: async (input) => {
      if (input.platform !== "ios") {
        return restoreRejected("unsupported_purchase_platform");
      }

      const purchases: VerifiedStorePurchase[] = [];
      const restorePurchaseByTransactionId = new Map((input.purchases ?? []).map((purchase) => [purchase.transactionId, purchase]));

      for (const transactionId of input.transactionIds) {
        const transaction = await getTransaction(transactionId);

        if (!transaction.ok) {
          return {
            ok: false,
            error: transaction.error
          };
        }

        const restorePurchase = restorePurchaseByTransactionId.get(transactionId);
        const purchase = purchaseFromTransaction(
          restorePurchase
            ? {
                ...input,
                productId: restorePurchase.productId,
                receiptHash: restorePurchase.receiptHash
              }
            : input,
          transaction.signedTransactionInfo,
          transaction.transaction
        );

        if (!purchase) {
          return restoreRejected("store_receipt_mismatch");
        }

        purchases.push(purchase);
      }

      return {
        ok: true,
        purchases
      };
    }
  };
};

export const createGoogleServiceAccountAccessTokenProvider = ({
  clientEmail,
  privateKey,
  tokenUrl = defaultGoogleTokenUrl,
  fetch,
  now = () => DEFAULT_NOW
}: GoogleServiceAccountAccessTokenProviderOptions): StoreAccessTokenProvider => {
  const resolvedFetch = fetch ?? getGlobalFetch();
  let cachedToken: { token: string; expiresAtMs: number } | null = null;

  return async () => {
    const nowMs = new Date(now()).getTime();

    if (cachedToken && cachedToken.expiresAtMs - 60_000 > nowMs) {
      return cachedToken.token;
    }

    const issuedAtSeconds = Math.floor(nowMs / 1000);
    const header = {
      alg: "RS256",
      typ: "JWT"
    };
    const payload = {
      iss: clientEmail,
      scope: androidPublisherScope,
      aud: tokenUrl,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + 60 * 60
    };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey);
    const assertion = `${signingInput}.${base64Url(signature)}`;
    const response = await resolvedFetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      }).toString()
    });
    const body = await readJson(response);

    if (response.status < 200 || response.status >= 300 || !body || typeof body !== "object") {
      throw new Error("Google Play access token request failed.");
    }

    const record = body as { access_token?: unknown; expires_in?: unknown };

    if (typeof record.access_token !== "string") {
      throw new Error("Google Play access token response was invalid.");
    }

    const expiresInSeconds = typeof record.expires_in === "number" ? record.expires_in : 3600;
    cachedToken = {
      token: record.access_token,
      expiresAtMs: nowMs + expiresInSeconds * 1000
    };

    return cachedToken.token;
  };
};

const ensureGoogleAccessTokenProvider = (options: GooglePlayPurchaseVerifierOptions): StoreAccessTokenProvider => {
  if (options.accessTokenProvider) {
    return options.accessTokenProvider;
  }

  if (!options.serviceAccountClientEmail || !options.serviceAccountPrivateKey) {
    throw new Error("Google Play verifier requires service account credentials or accessTokenProvider.");
  }

  return createGoogleServiceAccountAccessTokenProvider({
    clientEmail: options.serviceAccountClientEmail,
    privateKey: options.serviceAccountPrivateKey,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.now ? { now: options.now } : {})
  });
};

const isGoogleSubscriptionActive = (state: unknown): boolean =>
  state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";

const isGoogleSandboxPurchase = (value: unknown): boolean => Boolean(value && typeof value === "object");

const googleVerifiedAt = (value: unknown, fallback: ISODateTime): ISODateTime => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = new Date(value);

  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
};

const googlePurchaseTime = (value: unknown, fallback: ISODateTime): ISODateTime => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = new Date(Number.parseInt(value, 10));

  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
};

const googleLineItems = (value: unknown): GoogleSubscriptionLineItem[] =>
  Array.isArray(value) ? value.filter((item): item is GoogleSubscriptionLineItem => Boolean(item) && typeof item === "object") : [];

export const createGooglePlayPurchaseVerifier = (options: GooglePlayPurchaseVerifierOptions): StorePurchaseVerifier => {
  const fetch = options.fetch ?? getGlobalFetch();
  const accessTokenProvider = ensureGoogleAccessTokenProvider(options);
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? defaultGooglePlayBaseUrl);
  const subscriptionProductIds = new Set(options.subscriptionProductIds ?? ["premium_chat_monthly"]);

  const getGooglePurchase = async (
    input: { productId: string; token: string; requestedAt: ISODateTime }
  ): Promise<StorePurchaseVerificationResult> => {
    const isSubscription = subscriptionProductIds.has(input.productId);
    const path = isSubscription
      ? `/androidpublisher/v3/applications/${encodeURIComponent(options.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(
          input.token
        )}`
      : `/androidpublisher/v3/applications/${encodeURIComponent(options.packageName)}/purchases/products/${encodeURIComponent(
          input.productId
        )}/tokens/${encodeURIComponent(input.token)}`;
    let response: Awaited<ReturnType<StoreApiFetch>>;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await accessTokenProvider()}`,
          Accept: "application/json"
        }
      });
    } catch {
      return unavailable();
    }

    const body = await readJson(response);

    if (response.status < 200 || response.status >= 300 || !body || typeof body !== "object") {
      return {
        ok: false,
        error: mapStoreHttpError(response.status)
      };
    }

    if (isSubscription) {
      const subscription = body as GoogleSubscriptionPurchaseV2;
      const lineItem = googleLineItems(subscription.lineItems).find((item) => item.productId === input.productId);
      const latestOrderId = typeof subscription.latestOrderId === "string" ? subscription.latestOrderId : null;

      if (!lineItem || !latestOrderId || !isGoogleSubscriptionActive(subscription.subscriptionState)) {
        return rejected("store_receipt_mismatch", 409);
      }

      return {
        ok: true,
        purchase: {
          platform: "android",
          productId: input.productId,
          transactionId: latestOrderId,
          receiptHash: sha256ReceiptHash(input.token),
          verifiedAt: googleVerifiedAt(subscription.startTime, input.requestedAt),
          environment: isGoogleSandboxPurchase(subscription.testPurchase) ? "sandbox" : "production"
        }
      };
    }

    const product = body as GoogleProductPurchase;
    const orderId = typeof product.orderId === "string" ? product.orderId : null;

    if (product.productId !== input.productId || !orderId || product.purchaseState !== 0) {
      return rejected("store_receipt_mismatch", 409);
    }

    return {
      ok: true,
      purchase: {
        platform: "android",
        productId: input.productId,
        transactionId: orderId,
        receiptHash: sha256ReceiptHash(input.token),
        verifiedAt: googlePurchaseTime(product.purchaseTimeMillis, input.requestedAt),
        environment: product.purchaseType === 0 ? "sandbox" : "production"
      }
    };
  };

  return {
    verifyPurchase: async (input) => {
      if (input.platform !== "android") {
        return rejected("unsupported_purchase_platform");
      }

      if (!input.storeVerificationToken) {
        return rejected("store_verification_token_required");
      }

      const result = await getGooglePurchase({
        productId: input.productId,
        token: input.storeVerificationToken,
        requestedAt: input.requestedAt
      });

      if (!result.ok) {
        return result;
      }

      if (result.purchase.transactionId !== input.transactionId) {
        return rejected("store_receipt_mismatch", 409);
      }

      return {
        ok: true,
        purchase: {
          ...result.purchase,
          receiptHash: input.receiptHash
        }
      };
    },
    restorePurchases: async (input) => {
      if (input.platform !== "android") {
        return restoreRejected("unsupported_purchase_platform");
      }

      const purchases: VerifiedStorePurchase[] = [];

      for (const restorePurchase of input.purchases ?? []) {
        const result = await getGooglePurchase({
          productId: restorePurchase.productId,
          token: restorePurchase.storeVerificationToken,
          requestedAt: input.requestedAt
        });

        if (!result.ok) {
          return result;
        }

        if (result.purchase.transactionId !== restorePurchase.transactionId) {
          return restoreRejected("store_receipt_mismatch");
        }

        purchases.push({
          ...result.purchase,
          receiptHash: restorePurchase.receiptHash
        });
      }

      return {
        ok: true,
        purchases
      };
    }
  };
};

export const createDirectStorePurchaseVerifier = ({
  appStore,
  googlePlay
}: DirectStorePurchaseVerifierOptions): StorePurchaseVerifier => ({
  verifyPurchase: async (input): Promise<StorePurchaseVerificationResult> => {
    if (input.platform === "ios") {
      return appStore ? appStore.verifyPurchase(input) : unavailable("app_store_verifier_unavailable");
    }

    return googlePlay ? googlePlay.verifyPurchase(input) : unavailable("google_play_verifier_unavailable");
  },
  restorePurchases: async (input): Promise<StorePurchaseRestoreResult> => {
    if (input.platform === "ios") {
      return appStore?.restorePurchases ? appStore.restorePurchases(input) : restoreUnavailable("app_store_restore_unavailable");
    }

    return googlePlay?.restorePurchases ? googlePlay.restorePurchases(input) : restoreUnavailable("google_play_restore_unavailable");
  }
});

const normalizeRuntimePrivateKey = (value: string): string => value.replace(/\\n/g, "\n");

export const createDirectStorePurchaseVerifierFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: DirectStorePurchaseVerifierRuntimeOptions = {}
): StorePurchaseVerifier => {
  if (!config.storeVerifier || config.storeVerifier.provider !== "direct") {
    throw new Error("Direct store purchase verifier runtime config is not available.");
  }

  const signedTransactionVerifier = config.storeVerifier.appStore.notificationRootCertificateSha256Fingerprints
    ? createAppStoreNotificationJwsVerifier({
        trustedRootCertificateSha256Fingerprints: config.storeVerifier.appStore.notificationRootCertificateSha256Fingerprints
      })
    : undefined;

  return createDirectStorePurchaseVerifier({
    appStore: createAppleAppStorePurchaseVerifier({
      bundleId: config.storeVerifier.appStore.bundleId,
      issuerId: config.storeVerifier.appStore.issuerId,
      keyId: config.storeVerifier.appStore.keyId,
      privateKey: normalizeRuntimePrivateKey(config.storeVerifier.appStore.privateKey),
      environment: config.storeVerifier.appStore.environment,
      ...(config.storeVerifier.appStore.baseUrl ? { baseUrl: config.storeVerifier.appStore.baseUrl } : {}),
      ...(signedTransactionVerifier ? { signedTransactionVerifier } : {}),
      ...(options.appStoreJwtProvider ? { jwtProvider: options.appStoreJwtProvider } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(options.now ? { now: options.now } : {})
    }),
    googlePlay: createGooglePlayPurchaseVerifier({
      packageName: config.storeVerifier.googlePlay.packageName,
      serviceAccountClientEmail: config.storeVerifier.googlePlay.serviceAccountClientEmail,
      serviceAccountPrivateKey: normalizeRuntimePrivateKey(config.storeVerifier.googlePlay.serviceAccountPrivateKey),
      ...(config.storeVerifier.googlePlay.subscriptionProductIds
        ? { subscriptionProductIds: config.storeVerifier.googlePlay.subscriptionProductIds }
        : {}),
      ...(config.storeVerifier.googlePlay.baseUrl ? { baseUrl: config.storeVerifier.googlePlay.baseUrl } : {}),
      ...(options.googlePlayAccessTokenProvider ? { accessTokenProvider: options.googlePlayAccessTokenProvider } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(options.now ? { now: options.now } : {})
    })
  });
};
