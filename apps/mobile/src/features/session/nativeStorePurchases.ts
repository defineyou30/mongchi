import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import type { CommerceProduct, PurchaseVerificationRequest, RestorePurchasesRequest } from "@mongchi/shared";
import type { Purchase } from "expo-iap";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type NativePurchasePlatform = "ios" | "android";

export type NativeStorePurchaseConnection = {
  requestPurchase: (product: CommerceProduct) => Promise<void>;
  restorePurchases: () => Promise<Purchase[]>;
  finishPurchase: (purchase: Purchase, isConsumable: boolean) => Promise<void>;
  close: () => Promise<void>;
};

export type NativeStoreConnectionResult =
  | {
      ok: true;
      connection: NativeStorePurchaseConnection;
    }
  | {
      ok: false;
      messageSafe: string;
    };

type ExpoIapModule = typeof import("expo-iap");

let expoIapModulePromise: Promise<ExpoIapModule> | null = null;

export const isNativeStoreCheckoutEnabled = (): boolean =>
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT === "true";

export const getNativePurchasePlatform = (): NativePurchasePlatform | null =>
  Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

const loadExpoIapModule = (): Promise<ExpoIapModule> => {
  expoIapModulePromise ??= import("expo-iap");

  return expoIapModulePromise;
};

const safeStoreErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Store checkout is unavailable right now.";
};

const getPurchaseTransactionId = (purchase: Purchase): string | null => {
  const transactionId = "transactionId" in purchase ? purchase.transactionId : null;

  return transactionId || purchase.id || null;
};

export const buildStorePurchaseVerificationRequest = async (
  platform: NativePurchasePlatform,
  product: CommerceProduct,
  purchase: Purchase
): Promise<
  | {
      ok: true;
      request: PurchaseVerificationRequest;
    }
  | {
      ok: false;
      messageSafe: string;
    }
> => {
  if (purchase.productId !== product.productId) {
    return {
      ok: false,
      messageSafe: "The store returned a different product than requested."
    };
  }

  if (purchase.purchaseState !== "purchased") {
    return {
      ok: false,
      messageSafe: "The purchase is still pending."
    };
  }

  const storeVerificationToken = purchase.purchaseToken ?? null;
  const transactionId = getPurchaseTransactionId(purchase);

  if (!storeVerificationToken || !transactionId) {
    return {
      ok: false,
      messageSafe: "The store did not return purchase details."
    };
  }

  const receiptHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, storeVerificationToken);

  return {
    ok: true,
    request: {
      platform,
      productId: product.productId,
      transactionId,
      receiptHash: `sha256:${receiptHash}`,
      storeVerificationToken
    }
  };
};

export const buildStoreRestorePurchasesRequest = async (
  platform: NativePurchasePlatform,
  products: readonly CommerceProduct[],
  purchases: readonly Purchase[]
): Promise<{
  request: RestorePurchasesRequest;
  eligibleCount: number;
  skippedCount: number;
}> => {
  const productById = new Map(products.map((product) => [product.productId, product]));
  const purchasesByTransactionId = new Map<string, NonNullable<RestorePurchasesRequest["purchases"]>[number]>();
  let skippedCount = 0;

  for (const purchase of purchases) {
    const product = productById.get(purchase.productId);

    if (!product || purchase.purchaseState !== "purchased") {
      skippedCount += 1;
      continue;
    }

    const verification = await buildStorePurchaseVerificationRequest(platform, product, purchase);

    if (!verification.ok) {
      skippedCount += 1;
      continue;
    }

    purchasesByTransactionId.set(verification.request.transactionId, {
      productId: verification.request.productId,
      transactionId: verification.request.transactionId,
      receiptHash: verification.request.receiptHash,
      storeVerificationToken: verification.request.storeVerificationToken as string
    });
  }

  const restorePurchases = [...purchasesByTransactionId.values()];

  return {
    request: {
      platform,
      transactionIds: restorePurchases.map((purchase) => purchase.transactionId),
      ...(restorePurchases.length > 0 ? { purchases: restorePurchases } : {})
    },
    eligibleCount: restorePurchases.length,
    skippedCount
  };
};

export const startNativeStorePurchaseConnection = async ({
  onPurchase,
  onError
}: {
  onPurchase: (purchase: Purchase) => void;
  onError: (messageSafe: string) => void;
}): Promise<NativeStoreConnectionResult> => {
  const platform = getNativePurchasePlatform();

  if (!platform) {
    return {
      ok: false,
      messageSafe: "Store checkout is only available on iOS or Android."
    };
  }

  if (!isNativeStoreCheckoutEnabled()) {
      return {
        ok: false,
        messageSafe: "Store checkout is unavailable right now."
      };
  }

  try {
    const iap = await loadExpoIapModule();
    await iap.initConnection();

    const purchaseSubscription = iap.purchaseUpdatedListener(onPurchase);
    const errorSubscription = iap.purchaseErrorListener((error) => {
      onError(safeStoreErrorMessage(error));
    });

    return {
      ok: true,
      connection: {
        requestPurchase: async (product) => {
          if (product.grantType === "subscription") {
            if (platform === "ios") {
              await iap.requestPurchase({ type: "subs", request: { apple: { sku: product.productId } } });
              return;
            }

            await iap.requestPurchase({ type: "subs", request: { google: { skus: [product.productId] } } });
            return;
          }

          if (platform === "ios") {
            await iap.requestPurchase({ type: "in-app", request: { apple: { sku: product.productId } } });
            return;
          }

          await iap.requestPurchase({ type: "in-app", request: { google: { skus: [product.productId] } } });
        },
        restorePurchases: async () =>
          iap.getAvailablePurchases({
            includeSuspendedAndroid: false,
            onlyIncludeActiveItemsIOS: true
          }),
        finishPurchase: async (purchase, isConsumable) => {
          await iap.finishTransaction({ purchase, isConsumable });
        },
        close: async () => {
          purchaseSubscription.remove();
          errorSubscription.remove();
          await iap.endConnection();
        }
      }
    };
  } catch (error) {
    return {
      ok: false,
      messageSafe: safeStoreErrorMessage(error)
    };
  }
};
