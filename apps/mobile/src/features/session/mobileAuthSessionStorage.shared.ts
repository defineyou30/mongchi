import type { MobileAuthSessionStorage } from "./mobileAuthSession";

export interface SecureStoreLike {
  getItemAsync: (key: string, options?: Record<string, unknown>) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  deleteItemAsync: (key: string, options?: Record<string, unknown>) => Promise<void>;
}

export const MOBILE_AUTH_SESSION_KEYCHAIN_SERVICE = "mongchi.mobile-auth-session";

export const createSecureStoreMobileAuthSessionStorage = (
  secureStore: SecureStoreLike,
  options: Record<string, unknown>
): MobileAuthSessionStorage => ({
  getItem: (key) => secureStore.getItemAsync(key, options),
  setItem: (key, value) => secureStore.setItemAsync(key, value, options),
  removeItem: (key) => secureStore.deleteItemAsync(key, options)
});
