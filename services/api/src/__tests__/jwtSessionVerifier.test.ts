import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createJwtSessionVerifier, createJwtSessionVerifierFromRuntimeConfig } from "../jwtSessionVerifier";
import type { JwtJsonWebKeySet, JwtSessionVerifierFetch } from "../jwtSessionVerifier";

const issuer = "https://auth.example.com/";
const audience = "tiny-pet-mobile";
const nowSeconds = 1_800_000_000;

const base64UrlJson = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const createJwtFixture = () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  const kid = "test-key-001";
  const publicJwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  const jwks: JwtJsonWebKeySet = {
    keys: [
      {
        ...publicJwk,
        kid,
        alg: "RS256",
        use: "sig"
      }
    ]
  };
  const signToken = (
    payloadOverrides: Record<string, unknown> = {},
    headerOverrides: Record<string, unknown> = {}
  ): string => {
    const header = {
      alg: "RS256",
      typ: "JWT",
      kid,
      ...headerOverrides
    };
    const payload = {
      iss: issuer,
      aud: audience,
      sub: "provider-subject-001",
      exp: nowSeconds + 600,
      iat: nowSeconds - 60,
      ...payloadOverrides
    };
    const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
    const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput, "utf8"), privateKey).toString("base64url");

    return `${signingInput}.${signature}`;
  };

  return { jwks, signToken };
};

describe("JWT session verifier", () => {
  it("verifies RS256 JWTs against a configured JWKS", async () => {
    const { jwks, signToken } = createJwtFixture();
    const verifier = createJwtSessionVerifier({
      issuer,
      audience,
      jwks,
      provider: "jwks-test",
      nowSeconds: () => nowSeconds
    });

    await expect(
      verifier.verifySession({
        token: signToken(),
        authorizationHeader: "Bearer token",
        locale: "en-US",
        timezone: "America/New_York"
      })
    ).resolves.toEqual({
      ok: true,
      session: {
        userId: "provider-subject-001",
        locale: "en-US",
        timezone: "America/New_York",
        provider: "jwks-test",
        subject: "provider-subject-001"
      }
    });
  });

  it("rejects unsupported algorithms, bad audiences, expired tokens, and invalid signatures", async () => {
    const { jwks, signToken } = createJwtFixture();
    const otherFixture = createJwtFixture();
    const verifier = createJwtSessionVerifier({
      issuer,
      audience,
      jwks,
      nowSeconds: () => nowSeconds
    });
    const unsupportedAlgorithm = signToken({}, { alg: "HS256" });
    const badAudience = signToken({ aud: "other-mobile-app" });
    const expired = signToken({ exp: nowSeconds - 120 });
    const invalidSignature = otherFixture.signToken({ sub: "provider-subject-001" });

    await expect(
      verifier.verifySession({
        token: unsupportedAlgorithm,
        authorizationHeader: "Bearer token",
        locale: "ko-KR",
        timezone: "Asia/Seoul"
      })
    ).resolves.toMatchObject({
      ok: false,
      error: {
        status: 401,
        code: "jwt_unsupported_algorithm"
      }
    });
    await expect(
      verifier.verifySession({
        token: badAudience,
        authorizationHeader: "Bearer token",
        locale: "ko-KR",
        timezone: "Asia/Seoul"
      })
    ).resolves.toMatchObject({
      ok: false,
      error: {
        status: 401,
        code: "jwt_audience_invalid"
      }
    });
    await expect(
      verifier.verifySession({
        token: expired,
        authorizationHeader: "Bearer token",
        locale: "ko-KR",
        timezone: "Asia/Seoul"
      })
    ).resolves.toMatchObject({
      ok: false,
      error: {
        status: 401,
        code: "jwt_expired"
      }
    });
    await expect(
      verifier.verifySession({
        token: invalidSignature,
        authorizationHeader: "Bearer token",
        locale: "ko-KR",
        timezone: "Asia/Seoul"
      })
    ).resolves.toMatchObject({
      ok: false,
      error: {
        status: 401,
        code: "jwt_signature_invalid"
      }
    });
  });

  it("loads and caches JWKS documents through an injected fetch implementation", async () => {
    const { jwks, signToken } = createJwtFixture();
    const fetchCalls: string[] = [];
    const fetchImpl: JwtSessionVerifierFetch = async (url) => {
      fetchCalls.push(url);

      return {
        ok: true,
        status: 200,
        json: async () => jwks
      };
    };
    const verifier = createJwtSessionVerifier({
      issuer,
      audience,
      jwksUrl: "https://auth.example.com/.well-known/jwks.json",
      fetchImpl,
      nowSeconds: () => nowSeconds
    });
    const input = {
      token: signToken(),
      authorizationHeader: "Bearer token",
      locale: "ko-KR" as const,
      timezone: "Asia/Seoul"
    };

    await expect(verifier.verifySession(input)).resolves.toMatchObject({ ok: true });
    await expect(verifier.verifySession(input)).resolves.toMatchObject({ ok: true });
    expect(fetchCalls).toEqual(["https://auth.example.com/.well-known/jwks.json"]);
  });

  it("creates a verifier from validated API runtime config", async () => {
    const { jwks, signToken } = createJwtFixture();
    const verifier = createJwtSessionVerifierFromRuntimeConfig(
      {
        releaseProfile: "production",
        production: true,
        allowMockGenerationPolling: false,
        auth: {
          issuer,
          audience,
          jwksUrl: "https://auth.example.com/.well-known/jwks.json",
          provider: "runtime-auth",
          userIdClaim: "sub",
          clockToleranceSeconds: 30,
          jwksCacheTtlMs: 300000
        },
        database: null,
        storage: null,
        commerceWebhookSecret: null,
        storeVerifier: null,
        premiumChat: null
      },
      {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => jwks
        }),
        nowSeconds: () => nowSeconds
      }
    );

    await expect(
      verifier.verifySession({
        token: signToken(),
        authorizationHeader: "Bearer token",
        locale: "ko-KR",
        timezone: "Asia/Seoul"
      })
    ).resolves.toMatchObject({
      ok: true,
      session: {
        provider: "runtime-auth"
      }
    });
    expect(() =>
      createJwtSessionVerifierFromRuntimeConfig({
        releaseProfile: "development",
        production: false,
        allowMockGenerationPolling: true,
        auth: null,
        database: null,
        storage: null,
        commerceWebhookSecret: null,
        storeVerifier: null,
        premiumChat: null
      })
    ).toThrow(/TINY_PET_AUTH_ISSUER/);
  });
});
