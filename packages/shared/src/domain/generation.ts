import type { AuditTimestamps, GenerationJobId, ISODateTime, PetId, PhotoId, UserId } from "./common";
import type { PetSpecies, PersonalityTag, TalkingStyle } from "./pet";

export type GenerationJobStatus =
  | "created"
  | "queued"
  | "claimed"
  | "validating"
  | "preprocessing"
  | "safety_checking"
  | "generating"
  | "postprocessing"
  | "quality_checking"
  | "uploading_assets"
  | "cleanup_pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type GenerationProvider = "mock" | "openai" | "other";

export type GenerationQualityStatus = "pending" | "passed" | "failed" | "manual_review";

export interface GenerationJobInputSnapshot {
  species: PetSpecies;
  petName: string;
  personalityTags: PersonalityTag[];
  talkingStyle: TalkingStyle;
  favoriteThing?: string;
  styleVariant?: string;
}

export interface GenerationFailure {
  failureCode: string;
  failureMessageSafe: string;
  retryable: boolean;
  refundCreditRequired: boolean;
}

export interface GenerationQualityMetadata {
  qualityStatus: GenerationQualityStatus;
  qualityScore?: number;
  failedChecks: string[];
  manualReviewRequired: boolean;
  retryRecommended: boolean;
}

export interface GenerationJob extends AuditTimestamps {
  id: GenerationJobId;
  userId: UserId;
  petId: PetId;
  sourcePhotoIds: PhotoId[];
  optionalPhotoIds: PhotoId[];
  status: GenerationJobStatus;
  inputSnapshot: GenerationJobInputSnapshot;
  provider: GenerationProvider;
  costUnits: number;
  quality: GenerationQualityMetadata;
  failure?: GenerationFailure;
  completedAt?: ISODateTime;
  expiresAt?: ISODateTime;
}
