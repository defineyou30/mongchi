import { creditPacks } from "@mongchi/shared";

/**
 * Credit pack purchases confirm asynchronously: RevenueCat verifies the
 * receipt with the store and calls the revenuecat-credit-webhook Edge
 * Function, which grants credits via `grant_credits`
 * (docs/engineering/current/credit-store-foundation.md's "RevenueCat
 * Webhook" section) -- there is no synchronous confirmation the mobile
 * client can await. Once purchaseStoreProduct itself resolves, the client
 * polls the server-authoritative balance (hydrateServerCreditBalance) on
 * this cadence until it observes an increase or gives up. 2s x 10 attempts
 * gives the webhook a generous ~20s window before falling back to a "still
 * on the way" message instead of a false failure -- see
 * shouldStopCreditBalancePolling below.
 */
export const CREDIT_BALANCE_POLL_INTERVAL_MS = 2000;
export const CREDIT_BALANCE_POLL_MAX_ATTEMPTS = 10;

/** The RevenueCat-registered, Supabase-granted consumable credit packs (see
 * confirmed facts in docs/engineering/current/credit-store-foundation.md). */
export const creditPackProductIds: readonly string[] = creditPacks.map((pack) => pack.productId);

export const isCreditPackProductId = (productId: string): boolean =>
  creditPacks.some((pack) => pack.productId === productId);

/**
 * Structural mirror of RevenueCat's PurchasesError (see
 * @revenuecat/purchases-typescript-internal's errors.d.ts). Declared locally,
 * rather than imported from react-native-purchases, so this file -- and its
 * test coverage -- never pulls in the native SDK module; nativeStorePurchases.ts
 * is the one seam that actually talks to react-native-purchases (mirroring
 * shared/monitoring/sentryScrubbing.ts's split from sentry.ts).
 */
export interface RevenueCatPurchaseErrorLike {
  code?: string;
  userCancelled?: boolean | null;
}

export type PurchaseResultClassification = "cancelled" | "pending" | "failed";

// Mirrors react-native-purchases' generated PURCHASES_ERROR_CODE enum values
// PURCHASE_CANCELLED_ERROR ("1") and PAYMENT_PENDING_ERROR ("20") -- stable
// strings per RevenueCat's public API contract.
const PURCHASE_CANCELLED_ERROR_CODE = "1";
const PAYMENT_PENDING_ERROR_CODE = "20";

/**
 * Classifies a thrown RevenueCat purchase error into the three outcomes the
 * credit store reacts to differently: a user-initiated cancel must never
 * show an error dialog, a pending purchase (e.g. iOS Ask to Buy, a pending
 * Google Play transaction) is a soft "on its way" state rather than a
 * failure, and anything else is a genuine, retryable failure with a warm
 * retry message.
 */
export const classifyRevenueCatPurchaseError = (error: unknown): PurchaseResultClassification => {
  if (!error || typeof error !== "object") {
    return "failed";
  }

  const { code, userCancelled } = error as RevenueCatPurchaseErrorLike;

  if (userCancelled === true || code === PURCHASE_CANCELLED_ERROR_CODE) {
    return "cancelled";
  }

  if (code === PAYMENT_PENDING_ERROR_CODE) {
    return "pending";
  }

  return "failed";
};

export interface StoreProductPricing {
  productId: string;
  priceString: string;
}

/** Maps RevenueCat's fetched store products into a productId -> localized
 * price string lookup for the credit store's UI (see CreditStoreScreen's
 * per-pack price text). */
export const mapStoreProductsToPricingById = (
  products: readonly StoreProductPricing[]
): Partial<Record<string, string>> =>
  Object.fromEntries(products.map((product) => [product.productId, product.priceString]));

/**
 * Decides when the post-purchase balance-poll loop can stop: either the
 * server-authoritative balance has actually increased (the webhook landed),
 * or the attempt budget is exhausted. Exhausting the budget is not treated
 * as a failure by callers -- the webhook is durable and will land
 * eventually, so the UI should show a warm "still on the way" message
 * instead of an error in that case.
 */
export const shouldStopCreditBalancePolling = ({
  attempt,
  maxAttempts,
  previousBalance,
  currentBalance
}: {
  attempt: number;
  maxAttempts: number;
  previousBalance: number;
  currentBalance: number;
}): boolean => currentBalance > previousBalance || attempt >= maxAttempts;
