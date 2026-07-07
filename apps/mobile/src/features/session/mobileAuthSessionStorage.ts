import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MobileAuthSessionStorage } from "./mobileAuthSession";

export const MOBILE_AUTH_SESSION_STORAGE_KIND = "async-storage-fallback";

export const defaultMobileAuthSessionStorage: MobileAuthSessionStorage = AsyncStorage;
