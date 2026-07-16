import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  MOBILE_AUTH_SESSION_STORAGE_KIND,
  defaultMobileAuthSessionStorage
} from "./mobileAuthSessionStorage";

export type MobileAuthSessionSource = "development_mock" | "provider";

export interface MobileAuthSession {
  accessToken: string;
  source: MobileAuthSessionSource;
  updatedAt: string;
  expiresAt?: string;
  refreshToken?: string;
}

export interface MobileAuthSessionStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface ReadMobileAuthSessionOptions {
  migrateFromStorage?: MobileAuthSessionStorage | null;
}

export type MobileApiAuthTokenProvider = () => Promise<string | null>;
export type RefreshMobileAuthSession = (session: MobileAuthSession) => Promise<MobileAuthSession | null>;

export interface ResolveMobileApiAuthTokenOptions extends ReadMobileAuthSessionOptions {
  refreshSession?: RefreshMobileAuthSession | null;
  expiryLeewayMs?: number;
  now?: () => string;
}

export const MOBILE_AUTH_SESSION_STORAGE_KEY = "mongchi/mobile-api-session-v1";
export const defaultDevelopmentAuthToken = "user_demo_001";
export { MOBILE_AUTH_SESSION_STORAGE_KIND };

export const legacyMobileAuthSessionStorage: MobileAuthSessionStorage = AsyncStorage;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const normalizeMobileAuthToken = (token: string | null | undefined): string | null => {
  const trimmed = token?.trim();

  if (!trimmed || /\s/.test(trimmed) || trimmed.length > 2048 || /^bearer\s+/i.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const normalizeOptionalIsoTimestamp = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    return null;
  }

  return value;
};

// Both vars below are read as a literal `process.env.EXPO_PUBLIC_...` member
// access directly inside their function bodies (not cached into a
// module-level constant): babel-preset-expo only inlines a literal access
// like this one at build time (a computed/optional-chained lookup comes back
// undefined in release bundles -- see
// scripts/validate-mobile-env-inlining.mjs), and reading it live here also
// lets mobileAuthSession.test.ts's `withDevelopmentAuthFallback` helper flip
// the env var across assertions without needing to re-import the module.
export const isDevelopmentAuthFallbackAllowed = (): boolean => {
  const configured = process.env.EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK;
  const normalized = configured?.trim().toLowerCase();

  return normalized !== "false" && normalized !== "0" && normalized !== "no";
};

export const getConfiguredDevelopmentAuthToken = (): string | null => {
  if (!isDevelopmentAuthFallbackAllowed()) {
    return null;
  }

  return normalizeMobileAuthToken(process.env.EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN) ?? defaultDevelopmentAuthToken;
};

export const parseMobileAuthSession = (value: unknown): MobileAuthSession | null => {
  if (!isObject(value) || (value.source !== "development_mock" && value.source !== "provider")) {
    return null;
  }

  if (typeof value.accessToken !== "string" || typeof value.updatedAt !== "string") {
    return null;
  }

  const accessToken = normalizeMobileAuthToken(value.accessToken);

  if (!accessToken) {
    return null;
  }

  const expiresAt = normalizeOptionalIsoTimestamp(value.expiresAt);
  const refreshToken = value.refreshToken === undefined ? undefined : normalizeMobileAuthToken(value.refreshToken as string | undefined);

  if (expiresAt === null || refreshToken === null) {
    return null;
  }

  return {
    accessToken,
    source: value.source,
    updatedAt: value.updatedAt,
    ...(expiresAt ? { expiresAt } : {}),
    ...(refreshToken ? { refreshToken } : {})
  };
};

export const isMobileAuthSessionExpired = (
  session: MobileAuthSession,
  now: string,
  leewayMs = 60 * 1000
): boolean => {
  if (!session.expiresAt) {
    return false;
  }

  const expiresAtMs = new Date(session.expiresAt).getTime();
  const nowMs = new Date(now).getTime();

  return Number.isNaN(expiresAtMs) || Number.isNaN(nowMs) || expiresAtMs - leewayMs <= nowMs;
};

export const readMobileAuthSession = async (
  storage: MobileAuthSessionStorage = defaultMobileAuthSessionStorage,
  options: ReadMobileAuthSessionOptions = {}
): Promise<MobileAuthSession | null> => {
  try {
    const stored = await storage.getItem(MOBILE_AUTH_SESSION_STORAGE_KEY);

    if (stored) {
      const parsed = parseMobileAuthSession(JSON.parse(stored));

      if (parsed) {
        return parsed;
      }

      await storage.removeItem(MOBILE_AUTH_SESSION_STORAGE_KEY);
    }

    const migrationStorage = options.migrateFromStorage;

    if (!migrationStorage) {
      return null;
    }

    const legacyStored = await migrationStorage.getItem(MOBILE_AUTH_SESSION_STORAGE_KEY);

    if (!legacyStored) {
      return null;
    }

    const legacySession = parseMobileAuthSession(JSON.parse(legacyStored));

    if (!legacySession) {
      await migrationStorage.removeItem(MOBILE_AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    await storage.setItem(MOBILE_AUTH_SESSION_STORAGE_KEY, JSON.stringify(legacySession));
    await migrationStorage.removeItem(MOBILE_AUTH_SESSION_STORAGE_KEY);
    return legacySession;
  } catch {
    await storage.removeItem(MOBILE_AUTH_SESSION_STORAGE_KEY);
    return null;
  }
};

export const writeMobileAuthSession = async (
  session: MobileAuthSession,
  storage: MobileAuthSessionStorage = defaultMobileAuthSessionStorage
): Promise<boolean> => {
  const parsed = parseMobileAuthSession(session);

  if (!parsed) {
    return false;
  }

  await storage.setItem(MOBILE_AUTH_SESSION_STORAGE_KEY, JSON.stringify(parsed));
  return true;
};

export const clearMobileAuthSession = (storage: MobileAuthSessionStorage = defaultMobileAuthSessionStorage): Promise<void> =>
  storage.removeItem(MOBILE_AUTH_SESSION_STORAGE_KEY);

const getDefaultReadOptions = (
  storage: MobileAuthSessionStorage,
  options?: ResolveMobileApiAuthTokenOptions
): ResolveMobileApiAuthTokenOptions =>
  options ?? (storage === defaultMobileAuthSessionStorage ? { migrateFromStorage: legacyMobileAuthSessionStorage } : {});

export const resolveMobileApiAuthToken = async (
  storage: MobileAuthSessionStorage = defaultMobileAuthSessionStorage,
  options?: ResolveMobileApiAuthTokenOptions
): Promise<string | null> => {
  const resolvedOptions = getDefaultReadOptions(storage, options);
  const session = await readMobileAuthSession(storage, resolvedOptions);

  if (session && !isMobileAuthSessionExpired(session, resolvedOptions.now?.() ?? new Date().toISOString(), resolvedOptions.expiryLeewayMs)) {
    return session.accessToken;
  }

  if (session?.source === "provider" && resolvedOptions.refreshSession) {
    const refreshed = parseMobileAuthSession(await resolvedOptions.refreshSession(session));

    if (refreshed && !isMobileAuthSessionExpired(refreshed, resolvedOptions.now?.() ?? new Date().toISOString(), 0)) {
      await writeMobileAuthSession(refreshed, storage);
      return refreshed.accessToken;
    }
  }

  if (session) {
    await clearMobileAuthSession(storage);
  }

  return getConfiguredDevelopmentAuthToken();
};

export const createMobileApiAuthTokenProvider = (
  storage: MobileAuthSessionStorage = defaultMobileAuthSessionStorage,
  options?: ResolveMobileApiAuthTokenOptions
): MobileApiAuthTokenProvider => {
  return () => resolveMobileApiAuthToken(storage, options);
};
