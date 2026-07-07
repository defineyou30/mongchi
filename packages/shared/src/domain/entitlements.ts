import type { AuditTimestamps, EntitlementId, ISODateTime, UserId } from "./common";

export type EntitlementKey =
  | "premium_chat"
  | "extra_pet_slot"
  | "regeneration_credit"
  | "theme_pack"
  | "item_pack"
  | "treat_pack"
  | "subscription_plus";

export type EntitlementStatus = "pending" | "active" | "expired" | "revoked";

export type EntitlementSource = "purchase" | "restore" | "admin_grant" | "starter" | "event";

export interface Entitlement extends AuditTimestamps {
  id: EntitlementId;
  userId: UserId;
  key: EntitlementKey;
  status: EntitlementStatus;
  source: EntitlementSource;
  productId?: string;
  startsAt: ISODateTime;
  endsAt?: ISODateTime;
  ledgerEntryId: string;
  metadata: Record<string, string | number | boolean>;
}

export interface PurchaseVerificationState {
  productId: string;
  platform: "ios" | "android";
  status: "not_started" | "verifying" | "verified" | "failed" | "restored" | "revoked";
  serverVerified: boolean;
  lastCheckedAt?: ISODateTime;
}
