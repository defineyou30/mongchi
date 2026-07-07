import type {
  GeneratedAsset,
  GeneratedAssetId,
  ISODateTime,
  PetId,
  PhotoId,
  SourcePhotoContentType,
  UserId
} from "@mongchi/shared";

export type PrivateStorageSigningStatus = 403 | 404 | 422 | 503;

export interface PrivateStorageSigningError {
  status: PrivateStorageSigningStatus;
  code: string;
  messageSafe: string;
}

export interface OriginalPhotoUploadSigningInput {
  userId: UserId;
  petId: PetId;
  photoId: PhotoId;
  contentType: SourcePhotoContentType;
  byteSize: number;
  expiresAt: ISODateTime;
  maxByteSize: number;
}

export interface OriginalPhotoUploadSigningResult {
  uploadUrl: string;
  uploadMethod: "PUT" | "POST";
  uploadHeaders?: Record<string, string>;
  storageUri?: string;
  expiresAt?: ISODateTime;
  maxByteSize?: number;
}

export interface GeneratedAssetReadSigningInput {
  userId: UserId;
  petId: PetId;
  assetId: GeneratedAssetId;
  assetUri: string;
  contentHash: string;
  contentType: GeneratedAsset["mimeType"];
  storageClass: GeneratedAsset["storageClass"];
  expiresAt: ISODateTime;
}

export interface GeneratedAssetReadSigningResult {
  signedUrl: string;
  expiresAt?: ISODateTime;
  contentType?: GeneratedAsset["mimeType"];
}

export type PrivateStorageSigningResult<T> =
  | {
      ok: true;
      signed: T;
    }
  | {
      ok: false;
      error: PrivateStorageSigningError;
    };

export interface PrivateStorageSigner {
  createOriginalPhotoUpload: (
    input: OriginalPhotoUploadSigningInput
  ) => Promise<PrivateStorageSigningResult<OriginalPhotoUploadSigningResult>>;
  createGeneratedAssetRead: (
    input: GeneratedAssetReadSigningInput
  ) => Promise<PrivateStorageSigningResult<GeneratedAssetReadSigningResult>>;
}
