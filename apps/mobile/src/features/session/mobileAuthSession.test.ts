import { describe, expect, it } from "vitest";

import {
  MOBILE_AUTH_SESSION_STORAGE_KEY,
  clearMobileAuthSession,
  defaultDevelopmentAuthToken,
  getConfiguredDevelopmentAuthToken,
  isMobileAuthSessionExpired,
  isDevelopmentAuthFallbackAllowed,
  normalizeMobileAuthToken,
  parseMobileAuthSession,
  readMobileAuthSession,
  resolveMobileApiAuthToken,
  writeMobileAuthSession
} from "./mobileAuthSession";
import type { MobileAuthSessionStorage } from "./mobileAuthSession";
import {
  MOBILE_AUTH_SESSION_KEYCHAIN_SERVICE,
  createSecureStoreMobileAuthSessionStorage
} from "./mobileAuthSessionStorage.shared";

const createMemoryStorage = (): MobileAuthSessionStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    }
  };
};

const withDevelopmentAuthFallback = async <T>(value: string | undefined, run: () => Promise<T> | T): Promise<T> => {
  const previous = process.env.EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK;

  if (value === undefined) {
    delete process.env.EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK;
  } else {
    process.env.EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK = value;
  }

  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK;
    } else {
      process.env.EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK = previous;
    }
  }
};

describe("mobile auth session boundary", () => {
  it("normalizes bearer token values without accepting header-shaped strings", () => {
    expect(normalizeMobileAuthToken(" user_demo_001 ")).toBe("user_demo_001");
    expect(normalizeMobileAuthToken("Bearer user_demo_001")).toBeNull();
    expect(normalizeMobileAuthToken("raw token")).toBeNull();
    expect(normalizeMobileAuthToken("")).toBeNull();
  });

  it("parses only valid stored session payloads", () => {
    expect(
      parseMobileAuthSession({
        accessToken: "session_token_001",
        source: "provider",
        updatedAt: "2026-06-24T09:00:00.000Z",
        expiresAt: "2026-06-24T10:00:00.000Z",
        refreshToken: "refresh_token_001"
      })
    ).toEqual({
      accessToken: "session_token_001",
      source: "provider",
      updatedAt: "2026-06-24T09:00:00.000Z",
      expiresAt: "2026-06-24T10:00:00.000Z",
      refreshToken: "refresh_token_001"
    });
    expect(parseMobileAuthSession({ accessToken: "Bearer raw", source: "provider", updatedAt: "now" })).toBeNull();
    expect(parseMobileAuthSession({ accessToken: "session_token_001", source: "unknown", updatedAt: "now" })).toBeNull();
    expect(
      parseMobileAuthSession({
        accessToken: "session_token_001",
        source: "provider",
        updatedAt: "2026-06-24T09:00:00.000Z",
        expiresAt: "not-a-date"
      })
    ).toBeNull();
  });

  it("detects expired or near-expired provider sessions with configurable leeway", () => {
    const session = {
      accessToken: "session_token_001",
      source: "provider" as const,
      updatedAt: "2026-06-24T09:00:00.000Z",
      expiresAt: "2026-06-24T09:02:00.000Z"
    };
    const { expiresAt: _expiresAt, ...nonExpiringSession } = session;

    expect(isMobileAuthSessionExpired(session, "2026-06-24T09:00:30.000Z", 60_000)).toBe(false);
    expect(isMobileAuthSessionExpired(session, "2026-06-24T09:01:00.000Z", 60_000)).toBe(true);
    expect(isMobileAuthSessionExpired(nonExpiringSession, "2026-06-24T09:01:00.000Z")).toBe(false);
  });

  it("reads, writes, clears, and falls back to the development mock token", async () => {
    const storage = createMemoryStorage();
    const session = {
      accessToken: "session_token_001",
      source: "provider" as const,
      updatedAt: "2026-06-24T09:00:00.000Z"
    };

    await expect(writeMobileAuthSession(session, storage)).resolves.toBe(true);
    await expect(readMobileAuthSession(storage)).resolves.toEqual(session);
    await expect(resolveMobileApiAuthToken(storage)).resolves.toBe("session_token_001");

    await clearMobileAuthSession(storage);

    expect(storage.values.has(MOBILE_AUTH_SESSION_STORAGE_KEY)).toBe(false);
    await expect(resolveMobileApiAuthToken(storage)).resolves.toBe(defaultDevelopmentAuthToken);
  });

  it("does not return a development mock token when fallback is disabled", async () => {
    await withDevelopmentAuthFallback("false", async () => {
      const storage = createMemoryStorage();

      expect(isDevelopmentAuthFallbackAllowed()).toBe(false);
      expect(getConfiguredDevelopmentAuthToken()).toBeNull();
      await expect(resolveMobileApiAuthToken(storage)).resolves.toBeNull();
    });
  });

  it("uses valid provider tokens without refreshing them", async () => {
    const storage = createMemoryStorage();
    const session = {
      accessToken: "session_token_001",
      source: "provider" as const,
      updatedAt: "2026-06-24T09:00:00.000Z",
      expiresAt: "2026-06-24T10:00:00.000Z",
      refreshToken: "refresh_token_001"
    };
    let refreshCalls = 0;

    await writeMobileAuthSession(session, storage);

    await expect(
      resolveMobileApiAuthToken(storage, {
        now: () => "2026-06-24T09:10:00.000Z",
        refreshSession: async () => {
          refreshCalls += 1;
          return null;
        }
      })
    ).resolves.toBe("session_token_001");
    expect(refreshCalls).toBe(0);
  });

  it("refreshes expired provider tokens and stores the replacement session", async () => {
    const storage = createMemoryStorage();

    await writeMobileAuthSession(
      {
        accessToken: "expired_session_token_001",
        source: "provider",
        updatedAt: "2026-06-24T09:00:00.000Z",
        expiresAt: "2026-06-24T09:01:00.000Z",
        refreshToken: "refresh_token_001"
      },
      storage
    );

    await expect(
      resolveMobileApiAuthToken(storage, {
        now: () => "2026-06-24T09:02:00.000Z",
        refreshSession: async (session) => ({
          accessToken: `new_${session.refreshToken}`,
          source: "provider",
          updatedAt: "2026-06-24T09:02:00.000Z",
          expiresAt: "2026-06-24T10:02:00.000Z",
          refreshToken: "refresh_token_002"
        })
      })
    ).resolves.toBe("new_refresh_token_001");
    await expect(readMobileAuthSession(storage)).resolves.toMatchObject({
      accessToken: "new_refresh_token_001",
      refreshToken: "refresh_token_002"
    });
  });

  it("clears expired provider tokens when refresh fails", async () => {
    await withDevelopmentAuthFallback("false", async () => {
      const storage = createMemoryStorage();

      await writeMobileAuthSession(
        {
          accessToken: "expired_session_token_001",
          source: "provider",
          updatedAt: "2026-06-24T09:00:00.000Z",
          expiresAt: "2026-06-24T09:01:00.000Z",
          refreshToken: "refresh_token_001"
        },
        storage
      );

      await expect(
        resolveMobileApiAuthToken(storage, {
          now: () => "2026-06-24T09:02:00.000Z",
          refreshSession: async () => null
        })
      ).resolves.toBeNull();
      expect(storage.values.has(MOBILE_AUTH_SESSION_STORAGE_KEY)).toBe(false);
    });
  });

  it("allows explicit development mock fallback for local adapter builds", async () => {
    await withDevelopmentAuthFallback("true", async () => {
      expect(isDevelopmentAuthFallbackAllowed()).toBe(true);
      expect(getConfiguredDevelopmentAuthToken()).toBe(defaultDevelopmentAuthToken);
    });
  });

  it("removes unreadable stored session payloads", async () => {
    const storage = createMemoryStorage();
    await storage.setItem(MOBILE_AUTH_SESSION_STORAGE_KEY, "{bad json");

    await expect(readMobileAuthSession(storage)).resolves.toBeNull();
    expect(storage.values.has(MOBILE_AUTH_SESSION_STORAGE_KEY)).toBe(false);
  });

  it("migrates a valid legacy session into the primary auth storage", async () => {
    const primaryStorage = createMemoryStorage();
    const legacyStorage = createMemoryStorage();
    const session = {
      accessToken: "legacy_session_token_001",
      source: "provider" as const,
      updatedAt: "2026-06-24T10:00:00.000Z"
    };

    await legacyStorage.setItem(MOBILE_AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));

    await expect(resolveMobileApiAuthToken(primaryStorage, { migrateFromStorage: legacyStorage })).resolves.toBe(
      "legacy_session_token_001"
    );
    await expect(readMobileAuthSession(primaryStorage)).resolves.toEqual(session);
    expect(legacyStorage.values.has(MOBILE_AUTH_SESSION_STORAGE_KEY)).toBe(false);
  });

  it("does not try legacy migration when a custom storage is passed without migration options", async () => {
    const storage = createMemoryStorage();

    await expect(resolveMobileApiAuthToken(storage)).resolves.toBe(defaultDevelopmentAuthToken);
    expect(storage.values.size).toBe(0);
  });

  it("wraps Expo SecureStore with the configured keychain service options", async () => {
    const calls: Array<{
      operation: string;
      key: string;
      value?: string;
      options: Record<string, unknown> | undefined;
    }> = [];
    const options = {
      keychainService: MOBILE_AUTH_SESSION_KEYCHAIN_SERVICE,
      keychainAccessible: 42
    };
    const storage = createSecureStoreMobileAuthSessionStorage(
      {
        getItemAsync: async (key, receivedOptions) => {
          calls.push({ operation: "get", key, options: receivedOptions });
          return "stored-session";
        },
        setItemAsync: async (key, value, receivedOptions) => {
          calls.push({ operation: "set", key, value, options: receivedOptions });
        },
        deleteItemAsync: async (key, receivedOptions) => {
          calls.push({ operation: "delete", key, options: receivedOptions });
        }
      },
      options
    );

    await expect(storage.getItem("auth-key")).resolves.toBe("stored-session");
    await storage.setItem("auth-key", "session-json");
    await storage.removeItem("auth-key");

    expect(calls).toEqual([
      { operation: "get", key: "auth-key", options },
      { operation: "set", key: "auth-key", value: "session-json", options },
      { operation: "delete", key: "auth-key", options }
    ]);
  });
});
