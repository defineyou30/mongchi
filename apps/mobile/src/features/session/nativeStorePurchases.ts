import { Platform } from "react-native";

import { classifyRevenueCatPurchaseError } from "./creditPackCheckout";
import type { StoreProductPricing } from "./creditPackCheckout";

// react-native-purchases wraps native StoreKit/Play Billing bindings and
// cannot be imported at module scope here -- like expo-iap before it (see
// this file's git history) and @sentry/react-native (shared/monitoring/
// sentry.ts's header comment), it is not safe to load under vitest's
// transform. Every export below that needs the real SDK loads it lazily via
// loadRevenueCatModule, so nativeStorePurchases.test.ts can import this file
// and exercise its pure helpers without ever triggering that import. See
// creditPackCheckout.ts for the pure product-mapping/error-classification/
// poll-termination logic this file wires the SDK into.
type RevenueCatModule = typeof import("react-native-purchases");
type RevenueCatPurchases = RevenueCatModule["default"];

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type NativePurchasePlatform = "ios" | "android";

export const getNativePurchasePlatform = (): NativePurchasePlatform | null =>
  Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

/**
 * Native checkout stays off unless EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT
 * is explicitly "true" for this build (see apps/mobile/.env.example) --
 * originally gated on "server-side receipt verification already deployed",
 * which is now satisfied by the revenuecat-credit-webhook Edge Function (see
 * docs/engineering/current/credit-store-foundation.md). Kept as an explicit
 * opt-in (rather than removed) so it still doubles as an operator-controlled
 * kill switch per build/environment.
 */
export const isNativeStoreCheckoutEnabled = (): boolean =>
  getNativePurchasePlatform() !== null &&
  typeof process !== "undefined" &&
  process.env?.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT === "true";

// RevenueCat iOS Public SDK Key (see
// docs/engineering/current/credit-store-foundation.md's confirmed facts).
const REVENUECAT_IOS_SDK_KEY = "appl_vcqaVXPMgBRmsuMSCTadOJUQolA";

const readEnvVar = (key: string): string | null => {
  const value = typeof process === "undefined" ? undefined : process.env?.[key];
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

/**
 * Android has no RevenueCat public SDK key provisioned yet. Rather than
 * configuring the SDK with a missing/wrong key, checkout on Android stays
 * gracefully unavailable until EXPO_PUBLIC_REVENUECAT_ANDROID_SDK_KEY is set
 * (an operator/config action, not a code change).
 */
const getRevenueCatApiKey = (platform: NativePurchasePlatform): string | null =>
  platform === "ios" ? REVENUECAT_IOS_SDK_KEY : readEnvVar("EXPO_PUBLIC_REVENUECAT_ANDROID_SDK_KEY");

let revenueCatModulePromise: Promise<RevenueCatModule> | null = null;

const loadRevenueCatModule = (): Promise<RevenueCatModule> => {
  revenueCatModulePromise ??= import("react-native-purchases");

  return revenueCatModulePromise;
};

const safeStoreErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Store checkout is unavailable right now.";
};

let configuredApiKey: string | null = null;

type EnsureRevenueCatConfiguredResult =
  | { ok: true; purchases: RevenueCatPurchases }
  | { ok: false; messageSafe: string };

/** Lazily configures RevenueCat at most once per apiKey (safe to call before
 * every store operation below -- re-configuring with the same key is a
 * no-op). */
const ensureRevenueCatConfigured = async (): Promise<EnsureRevenueCatConfiguredResult> => {
  const platform = getNativePurchasePlatform();

  if (!platform) {
    return { ok: false, messageSafe: "Store checkout is only available on iOS or Android." };
  }

  const apiKey = getRevenueCatApiKey(platform);

  if (!apiKey) {
    return { ok: false, messageSafe: "Store checkout is unavailable right now." };
  }

  try {
    const { default: Purchases } = await loadRevenueCatModule();

    if (configuredApiKey !== apiKey) {
      Purchases.configure({ apiKey });
      configuredApiKey = apiKey;
    }

    return { ok: true, purchases: Purchases };
  } catch (error) {
    return { ok: false, messageSafe: safeStoreErrorMessage(error) };
  }
};

export type LogInStoreUserResult = { ok: true } | { ok: false; messageSafe: string };

/**
 * Links the RevenueCat identity to this device's Supabase user id, so the
 * revenuecat-credit-webhook's `app_user_id` matches a real Supabase user
 * (docs/engineering/current/credit-store-foundation.md's "RevenueCat
 * Webhook" section, point 4) -- without this, a purchase verifies fine but
 * grants nobody. Safe to call before every purchase attempt: RevenueCat's
 * logIn is a fast no-op once the current app user id already matches.
 */
export const logInStoreUser = async (supabaseUserId: string): Promise<LogInStoreUserResult> => {
  const configured = await ensureRevenueCatConfigured();

  if (!configured.ok) {
    return configured;
  }

  try {
    await configured.purchases.logIn(supabaseUserId);
    return { ok: true };
  } catch (error) {
    return { ok: false, messageSafe: safeStoreErrorMessage(error) };
  }
};

export type FetchStoreProductsResult =
  | { ok: true; products: StoreProductPricing[] }
  | { ok: false; messageSafe: string };

// Cache of the raw store product objects RevenueCat returned, keyed by
// productId -- purchaseStoreProduct needs the full product object (not just
// its id) to start a purchase, so it reuses whatever the most recent fetch
// cached instead of re-fetching on every attempt.
const storeProductCache = new Map<string, Awaited<ReturnType<RevenueCatPurchases["getProducts"]>>[number]>();

export const fetchStoreProducts = async (productIds: readonly string[]): Promise<FetchStoreProductsResult> => {
  const configured = await ensureRevenueCatConfigured();

  if (!configured.ok) {
    return configured;
  }

  try {
    const products = await configured.purchases.getProducts([...productIds]);

    for (const product of products) {
      storeProductCache.set(product.identifier, product);
    }

    return {
      ok: true,
      products: products.map((product) => ({ productId: product.identifier, priceString: product.priceString }))
    };
  } catch (error) {
    return { ok: false, messageSafe: safeStoreErrorMessage(error) };
  }
};

export type PurchaseStoreProductOutcome =
  | { ok: true; status: "purchased" }
  | { ok: true; status: "pending" }
  | { ok: true; status: "cancelled" }
  | { ok: false; messageSafe: string };

/**
 * Purchases a single store product by id. Resolves `ok: true` for all three
 * non-error outcomes (purchased/pending/cancelled) -- see
 * classifyRevenueCatPurchaseError's doc comment for why a user cancel and a
 * pending (e.g. Ask to Buy) purchase are not treated as failures. Callers
 * decide what to do next per status: `purchased` should kick off a credit-
 * balance poll (see creditPackCheckout.ts), `pending`/`cancelled` need no
 * further action here.
 */
export const purchaseStoreProduct = async (productId: string): Promise<PurchaseStoreProductOutcome> => {
  const configured = await ensureRevenueCatConfigured();

  if (!configured.ok) {
    return configured;
  }

  let product = storeProductCache.get(productId);

  if (!product) {
    const fetched = await fetchStoreProducts([productId]);

    if (!fetched.ok) {
      return fetched;
    }

    product = storeProductCache.get(productId);
  }

  if (!product) {
    return { ok: false, messageSafe: "This item is not available in the store right now." };
  }

  try {
    await configured.purchases.purchaseStoreProduct(product);
    return { ok: true, status: "purchased" };
  } catch (error) {
    const classification = classifyRevenueCatPurchaseError(error);

    if (classification === "cancelled" || classification === "pending") {
      return { ok: true, status: classification };
    }

    return { ok: false, messageSafe: safeStoreErrorMessage(error) };
  }
};

export type RestoreStoreEntitlementsResult = { ok: true } | { ok: false; messageSafe: string };

/**
 * Reconciles this device against RevenueCat's record of the current user's
 * purchases. Note this does not re-grant already-consumed credit packs --
 * consumables are not restorable on either store, by design (the balance
 * itself, hydrated via hydrateServerCreditBalance, is the durable record).
 * This exists for completeness/future non-consumable entitlements; nothing
 * in the credit store's own UI currently calls it.
 */
export const restoreStoreEntitlements = async (): Promise<RestoreStoreEntitlementsResult> => {
  const configured = await ensureRevenueCatConfigured();

  if (!configured.ok) {
    return configured;
  }

  try {
    await configured.purchases.restorePurchases();
    return { ok: true };
  } catch (error) {
    return { ok: false, messageSafe: safeStoreErrorMessage(error) };
  }
};
