import { createHash, createPrivateKey, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createAppStoreNotificationJwsVerifier } from "../appStoreWebhookVerifier";
import { normalizeCommerceStoreWebhookNotification } from "../commerceStoreWebhook";

const base64Url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const base64UrlBytes = (value: Buffer): string => value.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const jws = (payload: unknown, header: Record<string, unknown> = { alg: "ES256" }): string =>
  `${base64Url(header)}.${base64Url(payload)}.signature`;

const testPrivateKeyPem = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIH5/ibOVBX4GDM3jUmwh2R1oVZOcbq5ZY912L7dCRy+4oAoGCCqGSM49
AwEHoUQDQgAEr3P6fmDh1kzKHpT5MMSzmp/MQLudYzaBGgRLEAWMzysktuqknbwG
VL+s++dKhzTHdJ3lOxaTYQEfT4heQSyUPQ==
-----END EC PRIVATE KEY-----`;

const testCertificateX5c =
  "MIIBsjCCAVmgAwIBAgIUIHF2OPde4JwHAy4ybRahM+iGaTIwCgYIKoZIzj0EAwIwLzEtMCsGA1UEAwwkVGlueSBQZXQgVGVzdCBBcHAgU3RvcmUgTm90aWZpY2F0aW9uMB4XDTI2MDYyNTA4MzU0NloXDTM2MDYyMjA4MzU0NlowLzEtMCsGA1UEAwwkVGlueSBQZXQgVGVzdCBBcHAgU3RvcmUgTm90aWZpY2F0aW9uMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEr3P6fmDh1kzKHpT5MMSzmp/MQLudYzaBGgRLEAWMzysktuqknbwGVL+s++dKhzTHdJ3lOxaTYQEfT4heQSyUPaNTMFEwHQYDVR0OBBYEFAvjSZSg5y/db/MhYLGiMplfBSmZMB8GA1UdIwQYMBaAFAvjSZSg5y/db/MhYLGiMplfBSmZMA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDRwAwRAIgGC7mAAkWqKeRSHFbD3nv+rJ3pI2dkOUxwTCqGQJuepQCIDhDxzTKxAOo71Rlvz66oFD2LfZp42VNUrVCw8NAXQDE";

const signedJws = (payload: unknown): string => {
  const signingInput = `${base64Url({ alg: "ES256", x5c: [testCertificateX5c] })}.${base64Url(payload)}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(testPrivateKeyPem),
    dsaEncoding: "ieee-p1363"
  });

  return `${signingInput}.${base64UrlBytes(signature)}`;
};

const appStoreJwsVerifier = createAppStoreNotificationJwsVerifier({
  trustedRootCertificateSha256Fingerprints: ["sha256:5fcb079ccb94f483106ac76a81902f9a825f2ec213b5d61ecb27a7970e9bf3c3"],
  now: () => new Date("2026-06-25T09:00:00.000Z")
});

const googlePubSubBody = (payload: unknown) => ({
  message: {
    data: Buffer.from(JSON.stringify(payload)).toString("base64"),
    messageId: "msg_store_001"
  },
  subscription: "projects/tiny-pet/subscriptions/google-play"
});

describe("commerce store webhook normalization", () => {
  it("normalizes App Store revocation notifications to transaction revokes", () => {
    const result = normalizeCommerceStoreWebhookNotification(
      {
        signedPayload: jws({
          notificationType: "REFUND",
          data: {
            bundleId: "app.mongchi.mobile",
            signedTransactionInfo: jws({
              transactionId: "ios_store_webhook_001",
              productId: "premium_chat_monthly",
              bundleId: "app.mongchi.mobile"
            })
          }
        })
      },
      {
        appStoreBundleId: "app.mongchi.mobile"
      }
    );

    expect(result).toEqual({
      ok: true,
      decision: {
        action: "revoke",
        source: "app_store_server_notification_v2",
        request: {
          platform: "ios",
          transactionId: "ios_store_webhook_001",
          reason: "refund"
        }
      }
    });
  });

  it("verifies App Store notification and transaction JWS signatures when a verifier is configured", () => {
    const result = normalizeCommerceStoreWebhookNotification(
      {
        signedPayload: signedJws({
          notificationType: "REFUND",
          data: {
            bundleId: "app.mongchi.mobile",
            signedTransactionInfo: signedJws({
              transactionId: "ios_store_webhook_signed_001",
              productId: "premium_chat_monthly",
              bundleId: "app.mongchi.mobile"
            })
          }
        })
      },
      {
        appStoreBundleId: "app.mongchi.mobile",
        appStoreJwsVerifier
      }
    );

    expect(result).toEqual({
      ok: true,
      decision: {
        action: "revoke",
        source: "app_store_server_notification_v2",
        request: {
          platform: "ios",
          transactionId: "ios_store_webhook_signed_001",
          reason: "refund"
        }
      }
    });
  });

  it("rejects App Store notifications when a configured transaction JWS signature is invalid", () => {
    const signedTransactionInfo = signedJws({
      transactionId: "ios_store_webhook_signed_001",
      productId: "premium_chat_monthly",
      bundleId: "app.mongchi.mobile"
    });
    const [transactionHeader, , transactionSignature] = signedTransactionInfo.split(".");
    const tamperedSignedTransactionInfo = `${transactionHeader}.${base64Url({
      transactionId: "ios_store_webhook_signed_002",
      productId: "premium_chat_monthly",
      bundleId: "app.mongchi.mobile"
    })}.${transactionSignature}`;
    const result = normalizeCommerceStoreWebhookNotification(
      {
        signedPayload: signedJws({
          notificationType: "REFUND",
          data: {
            bundleId: "app.mongchi.mobile",
            signedTransactionInfo: tamperedSignedTransactionInfo
          }
        })
      },
      {
        appStoreBundleId: "app.mongchi.mobile",
        appStoreJwsVerifier
      }
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 422,
        code: "commerce_webhook_invalid_payload",
        messageSafe: "Commerce webhook signature is invalid."
      }
    });
  });

  it("rejects App Store notifications for another bundle", () => {
    const result = normalizeCommerceStoreWebhookNotification(
      {
        signedPayload: jws({
          notificationType: "REFUND",
          data: {
            bundleId: "other.app",
            signedTransactionInfo: jws({
              transactionId: "ios_store_webhook_001",
              bundleId: "other.app"
            })
          }
        })
      },
      {
        appStoreBundleId: "app.mongchi.mobile"
      }
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 422,
        code: "commerce_webhook_invalid_payload"
      }
    });
  });

  it("rejects App Store notifications without a supported signed JWS structure", () => {
    expect(
      normalizeCommerceStoreWebhookNotification({
        signedPayload: jws(
          {
            notificationType: "REFUND",
            data: {
              bundleId: "app.mongchi.mobile",
              signedTransactionInfo: jws({
                transactionId: "ios_store_webhook_001",
                bundleId: "app.mongchi.mobile"
              })
            }
          },
          { alg: "none" }
        )
      })
    ).toMatchObject({
      ok: false,
      error: {
        status: 422,
        code: "commerce_webhook_invalid_payload"
      }
    });

    expect(
      normalizeCommerceStoreWebhookNotification({
        signedPayload: `${base64Url({ alg: "ES256" })}.${base64Url({
          notificationType: "REFUND"
        })}.`
      })
    ).toMatchObject({
      ok: false,
      error: {
        status: 422,
        code: "commerce_webhook_invalid_payload"
      }
    });
  });

  it("rejects App Store revocations when signed transaction info is not a supported JWS", () => {
    const result = normalizeCommerceStoreWebhookNotification({
      signedPayload: jws({
        notificationType: "REFUND",
        data: {
          bundleId: "app.mongchi.mobile",
          signedTransactionInfo: jws(
            {
              transactionId: "ios_store_webhook_001",
              bundleId: "app.mongchi.mobile"
            },
            { alg: "none" }
          )
        }
      })
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 422,
        code: "commerce_webhook_invalid_payload"
      }
    });
  });

  it("normalizes Google RTDN revocations to receipt-hash revokes without retaining the purchase token", () => {
    const purchaseToken = "google-play-token-production-001";
    const result = normalizeCommerceStoreWebhookNotification(
      googlePubSubBody({
        version: "1.0",
        packageName: "app.mongchi.mobile",
        eventTimeMillis: "1782375000000",
        subscriptionNotification: {
          version: "1.0",
          notificationType: 12,
          purchaseToken,
          subscriptionId: "premium_chat_monthly"
        }
      }),
      {
        googlePlayPackageName: "app.mongchi.mobile"
      }
    );

    expect(result).toEqual({
      ok: true,
      decision: {
        action: "revoke_by_receipt_hash",
        source: "google_play_rtdn",
        request: {
          platform: "android",
          receiptHash: `sha256:${createHash("sha256").update(purchaseToken).digest("hex")}`,
          productId: "premium_chat_monthly",
          reason: "store_revoke"
        }
      }
    });
    expect(JSON.stringify(result)).not.toContain(purchaseToken);
  });

  it("acknowledges non-revocation store notifications as ignored decisions", () => {
    expect(
      normalizeCommerceStoreWebhookNotification({
        signedPayload: jws({
          notificationType: "DID_RENEW",
          data: {
            bundleId: "app.mongchi.mobile"
          }
        })
      })
    ).toEqual({
      ok: true,
      decision: {
        action: "ignore",
        source: "app_store_server_notification_v2",
        reason: "store_notification_not_relevant",
        eventType: "DID_RENEW"
      }
    });
  });
});
