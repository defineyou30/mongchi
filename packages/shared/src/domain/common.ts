export type ISODateTime = string;

export type Locale = "ko-KR" | "en-US";

export type UserId = string;
export type PetId = string;
export type PhotoId = string;
export type GenerationJobId = string;
export type GeneratedAssetId = string;
export type ItemId = string;
export type WalkSessionId = string;
export type ConversationId = string;
export type EntitlementId = string;

export type MeterValue = number;

export interface AuditTimestamps {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
