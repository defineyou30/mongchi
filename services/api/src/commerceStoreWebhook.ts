import { createHash } from "node:crypto";

import type { AppStoreJwsVerifier } from "./appStoreWebhookVerifier";
import type { PurchaseReceiptRevocationRequest, PurchaseRevocationRequest } from "./contracts";

export interface CommerceStoreWebhookOptions {
  appStoreBundleId?: string;
  appStoreJwsVerifier?: AppStoreJwsVerifier;
  googlePlayPackageName?: string;
}

export type CommerceStoreWebhookDecision =
  | {
      action: "revoke";
      source: "app_store_server_notification_v2";
      request: PurchaseRevocationRequest;
    }
  | {
      action: "revoke_by_receipt_hash";
      source: "google_play_rtdn";
      request: PurchaseReceiptRevocationRequest;
    }
  | {
      action: "ignore";
      source: "app_store_server_notification_v2" | "google_play_rtdn";
      reason: "store_notification_not_relevant";
      eventType: string;
    };

export type CommerceStoreWebhookNormalizationResult =
  | {
      ok: true;
      decision: CommerceStoreWebhookDecision;
    }
  | {
      ok: false;
      error: {
        status: 422;
        code: "commerce_webhook_invalid_payload";
        messageSafe: string;
      };
    };

const transactionIdPattern = /^[A-Za-z0-9_.:-]{6,160}$/;
const productIdPattern = /^[A-Za-z0-9_.:-]{1,160}$/;
const mobilePackageIdentifierPattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const base64UrlSegmentPattern = /^[A-Za-z0-9_-]+$/;
const storeTokenControlPattern = /[\u0000-\u001f\u007f]/;
const appStoreRevocationReasons: Record<string, PurchaseRevocationRequest["reason"] | undefined> = {
  DID_REVOKE: "store_revoke",
  REFUND: "refund",
  REVOKE: "store_revoke"
};
const googleSubscriptionRevocationNotificationType = 12;
const googleOneTimeProductCanceledNotificationType = 2;

const invalid = (messageSafe = "Commerce webhook payload is invalid."): CommerceStoreWebhookNormalizationResult => ({
  ok: false,
  error: {
    status: 422,
    code: "commerce_webhook_invalid_payload",
    messageSafe
  }
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeString = (value: unknown): string | null => (typeof value === "string" ? value.trim() || null : null);

const base64UrlDecodeJson = (value: string): unknown => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");

  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as unknown;
};

const base64DecodeJson = (value: string): unknown => JSON.parse(Buffer.from(value, "base64").toString("utf8")) as unknown;

const decodeJwsPayload = (jws: string): Record<string, unknown> | null => {
  try {
    const [protectedHeader, payload, signature, ...extraParts] = jws.split(".");

    if (
      extraParts.length > 0 ||
      !protectedHeader ||
      !payload ||
      !signature ||
      !base64UrlSegmentPattern.test(protectedHeader) ||
      !base64UrlSegmentPattern.test(payload) ||
      !base64UrlSegmentPattern.test(signature)
    ) {
      return null;
    }

    const header = base64UrlDecodeJson(protectedHeader);
    const decoded = payload ? base64UrlDecodeJson(payload) : null;
    const algorithm = isRecord(header) ? normalizeString(header.alg) : null;

    if (algorithm !== "ES256") {
      return null;
    }

    return isRecord(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

const verifyAppStoreJws = (
  jws: string,
  options: CommerceStoreWebhookOptions,
  purpose: "notification" | "transaction"
): boolean => options.appStoreJwsVerifier?.verifyAppStoreJws({ jws, purpose }) ?? true;

const sha256ReceiptHash = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const isValidStoreToken = (value: string): boolean => value.length >= 8 && value.length <= 8192 && !storeTokenControlPattern.test(value);

const readGoogleDeveloperNotification = (body: unknown): Record<string, unknown> | null => {
  if (!isRecord(body)) {
    return null;
  }

  if (typeof body.packageName === "string") {
    return body;
  }

  const message = isRecord(body.message) ? body.message : null;
  const encodedData = normalizeString(message?.data);

  if (!encodedData) {
    return null;
  }

  try {
    const decoded = base64DecodeJson(encodedData);

    return isRecord(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

const normalizeAppStoreNotification = (
  body: Record<string, unknown>,
  options: CommerceStoreWebhookOptions
): CommerceStoreWebhookNormalizationResult | null => {
  const signedPayload = normalizeString(body.signedPayload);

  if (!signedPayload) {
    return null;
  }

  if (!verifyAppStoreJws(signedPayload, options, "notification")) {
    return invalid("Commerce webhook signature is invalid.");
  }

  const payload = decodeJwsPayload(signedPayload);
  const notificationType = normalizeString(payload?.notificationType);
  const reason = notificationType ? appStoreRevocationReasons[notificationType] : undefined;

  if (!payload || !notificationType) {
    return invalid();
  }

  if (!reason) {
    return {
      ok: true,
      decision: {
        action: "ignore",
        source: "app_store_server_notification_v2",
        reason: "store_notification_not_relevant",
        eventType: notificationType
      }
    };
  }

  const data = isRecord(payload.data) ? payload.data : null;
  const bundleId = normalizeString(data?.bundleId);

  if (options.appStoreBundleId && bundleId !== options.appStoreBundleId) {
    return invalid("Commerce webhook app identity is invalid.");
  }

  const signedTransactionInfo = normalizeString(data?.signedTransactionInfo);
  if (signedTransactionInfo && !verifyAppStoreJws(signedTransactionInfo, options, "transaction")) {
    return invalid("Commerce webhook signature is invalid.");
  }

  const transaction = signedTransactionInfo ? decodeJwsPayload(signedTransactionInfo) : null;
  const transactionId = normalizeString(transaction?.transactionId);
  const transactionBundleId = normalizeString(transaction?.bundleId);

  if (!transactionId || !transactionIdPattern.test(transactionId)) {
    return invalid();
  }

  if (options.appStoreBundleId && transactionBundleId && transactionBundleId !== options.appStoreBundleId) {
    return invalid("Commerce webhook app identity is invalid.");
  }

  return {
    ok: true,
    decision: {
      action: "revoke",
      source: "app_store_server_notification_v2",
      request: {
        platform: "ios",
        transactionId,
        reason
      }
    }
  };
};

const normalizeGoogleNotification = (
  body: unknown,
  options: CommerceStoreWebhookOptions
): CommerceStoreWebhookNormalizationResult | null => {
  const notification = readGoogleDeveloperNotification(body);

  if (!notification) {
    return null;
  }

  const packageName = normalizeString(notification.packageName);

  if (
    !packageName ||
    !mobilePackageIdentifierPattern.test(packageName) ||
    (options.googlePlayPackageName && packageName !== options.googlePlayPackageName)
  ) {
    return invalid("Commerce webhook app identity is invalid.");
  }

  const subscription = isRecord(notification.subscriptionNotification) ? notification.subscriptionNotification : null;
  const oneTimeProduct = isRecord(notification.oneTimeProductNotification) ? notification.oneTimeProductNotification : null;
  const notificationType =
    typeof subscription?.notificationType === "number"
      ? subscription.notificationType
      : typeof oneTimeProduct?.notificationType === "number"
        ? oneTimeProduct.notificationType
        : null;
  const purchaseToken = normalizeString(subscription?.purchaseToken ?? oneTimeProduct?.purchaseToken);
  const productId = normalizeString(subscription?.subscriptionId ?? oneTimeProduct?.sku);
  const isRevocation =
    subscription?.notificationType === googleSubscriptionRevocationNotificationType ||
    oneTimeProduct?.notificationType === googleOneTimeProductCanceledNotificationType;

  if (notificationType === null) {
    return invalid();
  }

  if (!isRevocation) {
    return {
      ok: true,
      decision: {
        action: "ignore",
        source: "google_play_rtdn",
        reason: "store_notification_not_relevant",
        eventType: String(notificationType)
      }
    };
  }

  if (!purchaseToken || !isValidStoreToken(purchaseToken) || (productId !== null && !productIdPattern.test(productId))) {
    return invalid();
  }

  return {
    ok: true,
    decision: {
      action: "revoke_by_receipt_hash",
      source: "google_play_rtdn",
      request: {
        platform: "android",
        receiptHash: sha256ReceiptHash(purchaseToken),
        reason: "store_revoke",
        ...(productId ? { productId } : {})
      }
    }
  };
};

export const normalizeCommerceStoreWebhookNotification = (
  body: unknown,
  options: CommerceStoreWebhookOptions = {}
): CommerceStoreWebhookNormalizationResult => {
  if (!isRecord(body)) {
    return invalid();
  }

  return normalizeAppStoreNotification(body, options) ?? normalizeGoogleNotification(body, options) ?? invalid();
};
