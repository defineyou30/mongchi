import type { AuditTimestamps, ISODateTime, ItemId, PetId, UserId, WalkSessionId } from "./common";

export type WalkStatus = "ready" | "walking" | "returned" | "claimed" | "expired";

export interface WalkSession extends AuditTimestamps {
  id: WalkSessionId;
  userId: UserId;
  petId: PetId;
  status: WalkStatus;
  startedAt: ISODateTime;
  returnAt: ISODateTime;
  claimedAt?: ISODateTime;
  rewardItemIds: ItemId[];
  discoveryLine?: string;
  energyCost: number;
}
