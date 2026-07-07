import * as SecureStore from "expo-secure-store";

import {
  MOBILE_AUTH_SESSION_KEYCHAIN_SERVICE,
  createSecureStoreMobileAuthSessionStorage
} from "./mobileAuthSessionStorage.shared";

export const MOBILE_AUTH_SESSION_STORAGE_KIND = "secure-store";

export const mobileAuthSessionSecureStoreOptions = {
  keychainService: MOBILE_AUTH_SESSION_KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

export const defaultMobileAuthSessionStorage = createSecureStoreMobileAuthSessionStorage(
  SecureStore,
  mobileAuthSessionSecureStoreOptions
);
