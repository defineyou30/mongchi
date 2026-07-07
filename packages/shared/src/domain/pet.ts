import type { AuditTimestamps, GenerationJobId, GeneratedAssetId, ISODateTime, PetId, UserId } from "./common";

export type PetSpecies = "dog" | "cat";

export type PersonalityTag =
  | "playful"
  | "calm"
  | "shy"
  | "curious"
  | "sleepy"
  | "affectionate";

export type TalkingStyle = "cute" | "gentle" | "cheerful" | "comforting";

export type PetLifecycleStatus = "draft" | "generating" | "active" | "archived" | "deleted";

export interface PetProfile extends AuditTimestamps {
  id: PetId;
  userId: UserId;
  name: string;
  species: PetSpecies;
  personalityTags: PersonalityTag[];
  talkingStyle: TalkingStyle;
  favoriteThing?: string;
  memoryNote?: string;
  activeGenerationJobId?: GenerationJobId;
  activeAssetId?: GeneratedAssetId;
  lifecycleStatus: PetLifecycleStatus;
  originalPhotoDeletedAt?: ISODateTime;
}
