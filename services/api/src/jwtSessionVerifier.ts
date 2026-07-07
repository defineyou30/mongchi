import { createPublicKey, verify } from "node:crypto";

import type { ApiRuntimeConfig } from "./apiRuntimeConfig";
import type { ApiSessionVerifier, ApiSessionVerificationResult } from "./sessionVerifier";

export interface JwtJsonWebKey extends Record<string, unknown> {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
}

export interface JwtJsonWebKeySet {
  keys: JwtJsonWebKey[];
}

export interface JwtSessionVerifierFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type JwtSessionVerifierFetch = (url: string) => Promise<JwtSessionVerifierFetchResponse>;

export interface JwtSessionVerifierOptions {
  issuer: string;
  audience: string | readonly string[];
  jwks?: JwtJsonWebKeySet;
  jwksUrl?: string;
  provider?: string;
  userIdClaim?: string;
  clockToleranceSeconds?: number;
  nowSeconds?: () => number;
  fetchImpl?: JwtSessionVerifierFetch;
  jwksCacheTtlMs?: number;
}

interface ParsedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: Buffer;
  signingInput: string;
}

const jwtPartPattern = /^[A-Za-z0-9_-]+$/;

const authError = (code: string, messageSafe = "Sign in is required."): ApiSessionVerificationResult => ({
  ok: false,
  error: {
    status: 401,
    code,
    messageSafe
  }
});

const unavailableError = (code: string, messageSafe = "Sign in is temporarily unavailable."): ApiSessionVerificationResult => ({
  ok: false,
  error: {
    status: 503,
    code,
    messageSafe
  }
});

const decodeBase64Url = (value: string): Buffer | null => {
  if (!jwtPartPattern.test(value)) {
    return null;
  }

  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
};

const parseJsonPart = (value: string): Record<string, unknown> | null => {
  const decoded = decodeBase64Url(value);

  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded.toString("utf8"));

    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const parseJwt = (token: string): ParsedJwt | null => {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = parseJsonPart(encodedHeader);
  const payload = parseJsonPart(encodedPayload);
  const signature = decodeBase64Url(encodedSignature);

  if (!header || !payload || !signature) {
    return null;
  }

  return {
    header,
    payload,
    signature,
    signingInput: `${encodedHeader}.${encodedPayload}`
  };
};

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

const hasExpectedAudience = (audienceClaim: unknown, expectedAudiences: readonly string[]): boolean => {
  if (typeof audienceClaim === "string") {
    return expectedAudiences.includes(audienceClaim);
  }

  if (isStringArray(audienceClaim)) {
    return audienceClaim.some((audience) => expectedAudiences.includes(audience));
  }

  return false;
};

const isJwks = (value: unknown): value is JwtJsonWebKeySet => {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { keys?: unknown }).keys)) {
    return false;
  }

  return (value as { keys: unknown[] }).keys.every((key) => typeof key === "object" && key !== null);
};

const defaultFetch: JwtSessionVerifierFetch = async (url) => {
  const response = await fetch(url);

  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json()
  };
};

export const createJwtSessionVerifier = (options: JwtSessionVerifierOptions): ApiSessionVerifier => {
  if (!options.issuer.trim()) {
    throw new Error("JWT session verifier issuer is required.");
  }

  const expectedAudiences = (Array.isArray(options.audience) ? options.audience : [options.audience]).map((audience) =>
    audience.trim()
  );

  if (expectedAudiences.length === 0 || expectedAudiences.some((audience) => !audience)) {
    throw new Error("JWT session verifier audience is required.");
  }

  if (!options.jwks && !options.jwksUrl) {
    throw new Error("JWT session verifier requires jwks or jwksUrl.");
  }

  const provider = options.provider ?? "jwt";
  const userIdClaim = options.userIdClaim ?? "sub";
  const clockToleranceSeconds = options.clockToleranceSeconds ?? 30;
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const jwksCacheTtlMs = options.jwksCacheTtlMs ?? 5 * 60 * 1000;
  let cachedJwks: JwtJsonWebKeySet | null = options.jwks ?? null;
  let cachedAt = cachedJwks ? Date.now() : 0;

  const loadJwks = async (): Promise<{ ok: true; jwks: JwtJsonWebKeySet } | { ok: false; result: ApiSessionVerificationResult }> => {
    if (options.jwks) {
      return { ok: true, jwks: options.jwks };
    }

    if (cachedJwks && Date.now() - cachedAt < jwksCacheTtlMs) {
      return { ok: true, jwks: cachedJwks };
    }

    if (!options.jwksUrl) {
      return { ok: false, result: unavailableError("jwks_unavailable") };
    }

    let response: JwtSessionVerifierFetchResponse;

    try {
      response = await fetchImpl(options.jwksUrl);
    } catch {
      return { ok: false, result: unavailableError("jwks_fetch_failed") };
    }

    if (!response.ok) {
      return { ok: false, result: unavailableError("jwks_fetch_failed") };
    }

    let parsed: unknown;

    try {
      parsed = await response.json();
    } catch {
      return { ok: false, result: unavailableError("jwks_invalid") };
    }

    if (!isJwks(parsed)) {
      return { ok: false, result: unavailableError("jwks_invalid") };
    }

    cachedJwks = parsed;
    cachedAt = Date.now();

    return { ok: true, jwks: parsed };
  };

  return {
    verifySession: async (input) => {
      const parsed = parseJwt(input.token);

      if (!parsed) {
        return authError("jwt_malformed");
      }

      if (parsed.header.alg !== "RS256") {
        return authError("jwt_unsupported_algorithm");
      }

      const loadedJwks = await loadJwks();

      if (!loadedJwks.ok) {
        return loadedJwks.result;
      }

      const kid = typeof parsed.header.kid === "string" ? parsed.header.kid : null;
      const candidates = kid
        ? loadedJwks.jwks.keys.filter((key) => key.kid === kid)
        : loadedJwks.jwks.keys.length === 1
          ? loadedJwks.jwks.keys
          : [];
      const jwk = candidates.find((key) => (key.use === undefined || key.use === "sig") && key.kty === "RSA");

      if (!jwk) {
        return authError("jwt_key_not_found");
      }

      let verified = false;

      try {
        const publicKey = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });

        verified = verify("RSA-SHA256", Buffer.from(parsed.signingInput, "utf8"), publicKey, parsed.signature);
      } catch {
        return unavailableError("jwks_key_invalid");
      }

      if (!verified) {
        return authError("jwt_signature_invalid");
      }

      const now = nowSeconds();
      const issuer = typeof parsed.payload.iss === "string" ? parsed.payload.iss : null;

      if (issuer !== options.issuer) {
        return authError("jwt_issuer_invalid");
      }

      if (!hasExpectedAudience(parsed.payload.aud, expectedAudiences)) {
        return authError("jwt_audience_invalid");
      }

      if (typeof parsed.payload.exp !== "number" || parsed.payload.exp + clockToleranceSeconds < now) {
        return authError("jwt_expired");
      }

      if (typeof parsed.payload.nbf === "number" && parsed.payload.nbf - clockToleranceSeconds > now) {
        return authError("jwt_not_yet_valid");
      }

      const userId = parsed.payload[userIdClaim];
      const subject = typeof parsed.payload.sub === "string" ? parsed.payload.sub : undefined;

      if (typeof userId !== "string" || !userId.trim()) {
        return authError("jwt_subject_missing");
      }

      return {
        ok: true,
        session: {
          userId,
          locale: input.locale,
          timezone: input.timezone,
          provider,
          ...(subject ? { subject } : {})
        }
      };
    }
  };
};

export const createJwtSessionVerifierFromRuntimeConfig = (
  config: ApiRuntimeConfig,
  options: Pick<JwtSessionVerifierOptions, "fetchImpl" | "nowSeconds"> = {}
): ApiSessionVerifier => {
  if (!config.auth) {
    throw new Error("API auth runtime config is missing TINY_PET_AUTH_ISSUER.");
  }

  return createJwtSessionVerifier({
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    jwksUrl: config.auth.jwksUrl,
    provider: config.auth.provider,
    userIdClaim: config.auth.userIdClaim,
    clockToleranceSeconds: config.auth.clockToleranceSeconds,
    jwksCacheTtlMs: config.auth.jwksCacheTtlMs,
    ...options
  });
};
