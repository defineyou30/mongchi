import type { ISODateTime, UserId } from "@mongchi/shared";

import type { PurchaseVerificationRequest, RestorePurchasesRequest } from "./contracts";

export type StorePurchaseVerificationStatus = 400 | 409 | 422 | 503;

export interface StorePurchaseVerificationError {
  status: StorePurchaseVerificationStatus;
  code: string;
  messageSafe: string;
}

export interface VerifiedStorePurchase {
  platform: PurchaseVerificationRequest["platform"];
  productId: string;
  transactionId: string;
  receiptHash: string;
  verifiedAt?: ISODateTime;
  environment: "sandbox" | "production" | "unknown";
}

export interface StorePurchaseVerificationInput extends PurchaseVerificationRequest {
  userId: UserId;
  requestedAt: ISODateTime;
}

export interface StorePurchaseRestoreInput extends RestorePurchasesRequest {
  userId: UserId;
  requestedAt: ISODateTime;
}

export type StorePurchaseVerificationResult =
  | {
      ok: true;
      purchase: VerifiedStorePurchase;
    }
  | {
      ok: false;
      error: StorePurchaseVerificationError;
    };

export type StorePurchaseRestoreResult =
  | {
      ok: true;
      purchases: VerifiedStorePurchase[];
    }
  | {
      ok: false;
      error: StorePurchaseVerificationError;
    };

export interface StorePurchaseVerifier {
  verifyPurchase: (input: StorePurchaseVerificationInput) => Promise<StorePurchaseVerificationResult>;
  restorePurchases?: (input: StorePurchaseRestoreInput) => Promise<StorePurchaseRestoreResult>;
}
