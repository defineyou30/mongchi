import { createPrivateKey, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createAppStoreNotificationJwsVerifier } from "../appStoreWebhookVerifier";

const testPrivateKeyPem = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIH5/ibOVBX4GDM3jUmwh2R1oVZOcbq5ZY912L7dCRy+4oAoGCCqGSM49
AwEHoUQDQgAEr3P6fmDh1kzKHpT5MMSzmp/MQLudYzaBGgRLEAWMzysktuqknbwG
VL+s++dKhzTHdJ3lOxaTYQEfT4heQSyUPQ==
-----END EC PRIVATE KEY-----`;

const testCertificateX5c =
  "MIIBsjCCAVmgAwIBAgIUIHF2OPde4JwHAy4ybRahM+iGaTIwCgYIKoZIzj0EAwIwLzEtMCsGA1UEAwwkVGlueSBQZXQgVGVzdCBBcHAgU3RvcmUgTm90aWZpY2F0aW9uMB4XDTI2MDYyNTA4MzU0NloXDTM2MDYyMjA4MzU0NlowLzEtMCsGA1UEAwwkVGlueSBQZXQgVGVzdCBBcHAgU3RvcmUgTm90aWZpY2F0aW9uMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEr3P6fmDh1kzKHpT5MMSzmp/MQLudYzaBGgRLEAWMzysktuqknbwGVL+s++dKhzTHdJ3lOxaTYQEfT4heQSyUPaNTMFEwHQYDVR0OBBYEFAvjSZSg5y/db/MhYLGiMplfBSmZMB8GA1UdIwQYMBaAFAvjSZSg5y/db/MhYLGiMplfBSmZMA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDRwAwRAIgGC7mAAkWqKeRSHFbD3nv+rJ3pI2dkOUxwTCqGQJuepQCIDhDxzTKxAOo71Rlvz66oFD2LfZp42VNUrVCw8NAXQDE";

const testCertificateFingerprint = "sha256:5fcb079ccb94f483106ac76a81902f9a825f2ec213b5d61ecb27a7970e9bf3c3";

const base64UrlJson = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");
const base64UrlBytes = (value: Buffer): string => value.toString("base64url");

const signedJws = (payload: unknown): string => {
  const signingInput = `${base64UrlJson({ alg: "ES256", x5c: [testCertificateX5c] })}.${base64UrlJson(payload)}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(testPrivateKeyPem),
    dsaEncoding: "ieee-p1363"
  });

  return `${signingInput}.${base64UrlBytes(signature)}`;
};

describe("App Store webhook JWS verifier", () => {
  it("verifies ES256 App Store notification JWS signatures against a trusted x5c certificate fingerprint", () => {
    const verifier = createAppStoreNotificationJwsVerifier({
      trustedRootCertificateSha256Fingerprints: [testCertificateFingerprint],
      now: () => new Date("2026-06-25T09:00:00.000Z")
    });

    expect(
      verifier.verifyAppStoreJws({
        jws: signedJws({
          notificationType: "REFUND"
        }),
        purpose: "notification"
      })
    ).toBe(true);
  });

  it("rejects tampered payloads and untrusted certificate fingerprints", () => {
    const trustedVerifier = createAppStoreNotificationJwsVerifier({
      trustedRootCertificateSha256Fingerprints: [testCertificateFingerprint],
      now: () => new Date("2026-06-25T09:00:00.000Z")
    });
    const untrustedVerifier = createAppStoreNotificationJwsVerifier({
      trustedRootCertificateSha256Fingerprints: [`sha256:${"0".repeat(64)}`],
      now: () => new Date("2026-06-25T09:00:00.000Z")
    });
    const [header, , signature] = signedJws({ transactionId: "ios_webhook_signed_001" }).split(".");
    const tamperedJws = `${header}.${base64UrlJson({ transactionId: "ios_webhook_signed_002" })}.${signature}`;

    expect(
      trustedVerifier.verifyAppStoreJws({
        jws: tamperedJws,
        purpose: "transaction"
      })
    ).toBe(false);
    expect(
      untrustedVerifier.verifyAppStoreJws({
        jws: signedJws({ transactionId: "ios_webhook_signed_001" }),
        purpose: "transaction"
      })
    ).toBe(false);
  });
});
