import type { AuditTimestamps, GeneratedAssetId, GenerationJobId, PetId } from "./common";
import type { GenerationQualityStatus } from "./generation";

export const generatedAssetStates = [
  "idle",
  "base",
  "happy",
  "sleep",
  "play",
  "hungry",
  "walk_return",
  "treat_reaction",
  "chat_portrait",
  "curious",
  "celebrate",
  "garden_help",
  "seasonal",
  "sad",
  "sick",
  "messy"
] as const;

export type GeneratedAssetState = (typeof generatedAssetStates)[number];

export type AssetStorageClass = "private_app_asset" | "share_export";

export interface GeneratedAsset extends AuditTimestamps {
  id: GeneratedAssetId;
  petId: PetId;
  generationJobId: GenerationJobId;
  state: GeneratedAssetState;
  uri: string;
  thumbnailUri?: string;
  width: number;
  height: number;
  contentHash: string;
  mimeType: "image/png" | "image/webp";
  storageClass: AssetStorageClass;
  version: number;
  qualityStatus: GenerationQualityStatus;
}
