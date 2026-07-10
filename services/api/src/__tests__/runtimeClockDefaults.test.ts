import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createAppleAppStoreServerApiJwt } from "../directStorePurchaseVerifiers";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const encodedPayload = token.split(".")[1];

  if (!encodedPayload) {
    throw new Error("Expected an encoded JWT payload.");
  }

  const decoded: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

  if (!isRecord(decoded)) {
    throw new Error("Expected a JWT object payload.");
  }

  return decoded;
};

describe("production clock defaults", () => {
  it("Given no injected clock, when an App Store JWT is created, then iat is current and its lifetime is exactly 900 seconds", () => {
    // Given
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const beforeSeconds = Math.floor(Date.now() / 1_000);

    // When
    const token = createAppleAppStoreServerApiJwt({
      issuerId: "issuer-001",
      keyId: "key-001",
      bundleId: "app.mongchi.mobile",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    });
    const afterSeconds = Math.floor(Date.now() / 1_000);
    const payload = decodeJwtPayload(token);

    // Then
    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));

    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      throw new Error("Expected numeric JWT timestamps.");
    }

    expect(payload.iat).toBeGreaterThanOrEqual(beforeSeconds);
    expect(payload.iat).toBeLessThanOrEqual(afterSeconds);
    expect(payload.exp - payload.iat).toBe(900);
  });

  it("Given an injected fixed clock, when an App Store JWT is created, then deterministic timestamps remain exact", () => {
    // Given
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });

    // When
    const payload = decodeJwtPayload(
      createAppleAppStoreServerApiJwt({
        issuerId: "issuer-001",
        keyId: "key-001",
        bundleId: "app.mongchi.mobile",
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        now: () => "2026-06-24T09:00:00.000Z"
      })
    );

    // Then
    expect(payload).toMatchObject({
      iat: 1_782_291_600,
      exp: 1_782_292_500
    });
  });
});
