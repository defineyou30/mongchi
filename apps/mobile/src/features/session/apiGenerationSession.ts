import {
  buildAcceptGenerationJobRequest,
  buildCreateGenerationJobRequest,
  buildCreatePetRequest,
  buildPhotoUploadUrlRequest,
  generationStepStatuses
} from "@mongchi/shared";
import type {
  AcceptGenerationJobResponse,
  CompletePhotoUploadResponse,
  CreateGenerationJobRequest,
  CreatePetRequest,
  GeneratedAsset,
  GenerationJob,
  GenerationJobId,
  GenerationJobStatus,
  GenerationPollResponse,
  PetAssetsResponse,
  PetProfile,
  PhotoUploadUrlRequest,
  PhotoUploadUrlResponse,
  PrototypeSessionState,
  RetryGenerationJobResponse
} from "@mongchi/shared";

import {
  createMobileApiClient,
  resolveMobileApiBaseUrl
} from "../../shared/api";
import type { MobileApiClientOptions, MobileApiError, MobileApiResult } from "../../shared/api";
import { getConfiguredApiBaseUrl } from "./apiDailyLoopSession";
import { createMobileApiAuthTokenProvider } from "./mobileAuthSession";
import { uploadSourcePhotoToSignedUrl } from "./signedPhotoUpload";
import type { SignedPhotoUploadRequest, SignedPhotoUploadResult } from "./signedPhotoUpload";

export interface GenerationApiClient {
  createPet: (body: CreatePetRequest) => Promise<MobileApiResult<PetProfile>>;
  issuePhotoUploadUrl: (body: PhotoUploadUrlRequest) => Promise<MobileApiResult<PhotoUploadUrlResponse>>;
  completePhotoUpload: (body: { photoId: string; contentHash: string }) => Promise<MobileApiResult<CompletePhotoUploadResponse>>;
  createGenerationJob: (body: CreateGenerationJobRequest) => Promise<MobileApiResult<GenerationJob>>;
  pollGenerationJob: (jobId: GenerationJobId) => Promise<MobileApiResult<GenerationPollResponse>>;
  retryGenerationJob: (jobId: GenerationJobId) => Promise<MobileApiResult<RetryGenerationJobResponse>>;
  listGeneratedAssets: (petId: string) => Promise<MobileApiResult<PetAssetsResponse>>;
  acceptGenerationJob: (body: { jobId: GenerationJobId; acceptedAssetIds: string[] }) => Promise<MobileApiResult<AcceptGenerationJobResponse>>;
}

export type ApiGenerationClientResolution =
  | {
      mode: "local";
      error: null;
      client: null;
    }
  | {
      mode: "api";
      error: null;
      client: GenerationApiClient;
    }
  | {
      mode: "local";
      error: MobileApiError;
      client: null;
    };

export type ApiGenerationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

const generationPollIntervalMs = 900;

export type SourcePhotoUploadTransport = (request: SignedPhotoUploadRequest) => Promise<SignedPhotoUploadResult>;

const addMs = (timestamp: string, durationMs: number): string =>
  new Date(new Date(timestamp).getTime() + durationMs).toISOString();

const toGenerationError = (error: MobileApiError): ApiGenerationResult<never> => ({
  ok: false,
  error
});

const localGenerationError = (code: string, messageSafe: string): ApiGenerationResult<never> => ({
  ok: false,
  error: {
    status: 0,
    code,
    messageSafe,
    retryable: false
  }
});

const sourcePhotoError = (code: string, messageSafe: string): { ok: false; error: MobileApiError } => ({
  ok: false,
  error: {
    status: 0,
    code,
    messageSafe,
    retryable: false
  }
});

export const createConfiguredGenerationApiClient = (
  baseUrl: string | null = getConfiguredApiBaseUrl(),
  authTokenProvider: MobileApiClientOptions["authTokenProvider"] = createMobileApiAuthTokenProvider()
): ApiGenerationClientResolution => {
  if (!baseUrl?.trim()) {
    return {
      mode: "local",
      error: null,
      client: null
    };
  }

  const resolved = resolveMobileApiBaseUrl(baseUrl);

  if (!resolved.ok) {
    return {
      mode: "local",
      error: resolved.error,
      client: null
    };
  }

  return {
    mode: "api",
    error: null,
    client: createMobileApiClient({
      baseUrl: resolved.baseUrl,
      authTokenProvider
    })
  };
};

const toLocalGenerationState = (
  status: GenerationJobStatus,
  now: string,
  retryCount: number,
  pollAttemptCount: number
): PrototypeSessionState["generation"] => {
  const currentStepIndex = Math.max(0, generationStepStatuses.indexOf(status));
  const terminal = status === "completed" || status === "failed";

  return {
    retryCount,
    pollAttemptCount,
    status,
    currentStepIndex,
    lastPolledAt: now,
    ...(terminal ? {} : { nextPollAfter: addMs(now, generationPollIntervalMs) }),
    ...(status === "completed" ? { completedAt: now } : {}),
    ...(status === "failed" ? { failedAt: now } : {})
  };
};

const resolveSourcePhotoCandidate = (
  state: PrototypeSessionState
):
  | {
      ok: true;
      candidate: {
        uri: string;
        byteSize: number | null;
        mimeType: string | null;
      };
    }
  | {
      ok: false;
      error: MobileApiError;
    } => {
  if (state.photo.selectedMockPhoto) {
    return {
      ok: true as const,
      candidate: {
        uri: "sample://mongchi/pet-photo.png",
        byteSize: state.photo.byteSize ?? 4096,
        mimeType: state.photo.mimeType ?? "image/png"
      }
    };
  }

  if (!state.photo.selectedPhotoUri) {
    return sourcePhotoError("source_photo_required", "Choose a pet photo so your tiny friend can move in.");
  }

  return {
    ok: true as const,
    candidate: {
      uri: state.photo.selectedPhotoUri,
      byteSize: state.photo.byteSize ?? null,
      mimeType: state.photo.mimeType ?? null
    }
  };
};

export const startApiGenerationFlow = async (
  client: GenerationApiClient,
  state: PrototypeSessionState,
  now: string,
  uploadTransport: SourcePhotoUploadTransport = uploadSourcePhotoToSignedUrl
): Promise<ApiGenerationResult<Partial<PrototypeSessionState>>> => {
  const sourcePhoto = resolveSourcePhotoCandidate(state);

  if (!sourcePhoto.ok) {
    return sourcePhoto;
  }

  const createdPet = await client.createPet(buildCreatePetRequest(state.draft));

  if (!createdPet.ok) {
    return toGenerationError(createdPet.error);
  }

  const uploadRequest = buildPhotoUploadUrlRequest(createdPet.data.id, sourcePhoto.candidate);

  if (!uploadRequest.ok) {
    return localGenerationError(uploadRequest.issue, uploadRequest.messageSafe);
  }

  const uploadUrl = await client.issuePhotoUploadUrl(uploadRequest.request);

  if (!uploadUrl.ok) {
    return toGenerationError(uploadUrl.error);
  }

  const uploadedPhoto = await uploadTransport({
    sourceUri: sourcePhoto.candidate.uri,
    contentType: uploadRequest.request.contentType,
    expectedByteSize: uploadRequest.request.byteSize,
    signedUpload: uploadUrl.data
  });

  if (!uploadedPhoto.ok) {
    return toGenerationError(uploadedPhoto.error);
  }

  const completedUpload = await client.completePhotoUpload({
    photoId: uploadUrl.data.photoId,
    contentHash: uploadedPhoto.contentHash
  });

  if (!completedUpload.ok) {
    return toGenerationError(completedUpload.error);
  }

  const generationJob = await client.createGenerationJob(
    buildCreateGenerationJobRequest(createdPet.data.id, uploadUrl.data.photoId)
  );

  if (!generationJob.ok) {
    return toGenerationError(generationJob.error);
  }

  const localPet: PetProfile = {
    ...createdPet.data,
    activeGenerationJobId: generationJob.data.id
  };

  return {
    ok: true,
    data: {
      petProfile: localPet,
      generation: {
        retryCount: state.generation.retryCount,
        pollAttemptCount: 0,
        status: "preprocessing",
        currentStepIndex: 0,
        startedAt: now,
        lastPolledAt: now,
        nextPollAfter: addMs(now, generationPollIntervalMs)
      },
      acceptedAsset: null,
      acceptedAssets: []
    }
  };
};

export const pollApiGenerationFlow = async (
  client: GenerationApiClient,
  state: PrototypeSessionState,
  now: string
): Promise<ApiGenerationResult<Partial<PrototypeSessionState>>> => {
  const jobId = state.petProfile?.activeGenerationJobId;

  if (!jobId) {
    return localGenerationError("generation_job_missing", "Generation job could not be found.");
  }

  const polled = await client.pollGenerationJob(jobId);

  if (!polled.ok) {
    return toGenerationError(polled.error);
  }

  return {
    ok: true,
    data: {
      generation: toLocalGenerationState(
        polled.data.job.status,
        now,
        state.generation.retryCount,
        (state.generation.pollAttemptCount ?? 0) + 1
      ),
      ...(polled.data.assets[0]
        ? {
            acceptedAsset: polled.data.assets[0],
            acceptedAssets: polled.data.assets
          }
        : {})
    }
  };
};

export const retryApiGenerationFlow = async (
  client: GenerationApiClient,
  state: PrototypeSessionState,
  now: string
): Promise<ApiGenerationResult<Partial<PrototypeSessionState>>> => {
  const jobId = state.petProfile?.activeGenerationJobId;

  if (!jobId) {
    return localGenerationError("generation_job_missing", "Generation job could not be found.");
  }

  const retried = await client.retryGenerationJob(jobId);

  if (!retried.ok) {
    return toGenerationError(retried.error);
  }

  return {
    ok: true,
    data: {
      generation: {
        retryCount: state.generation.retryCount + 1,
        pollAttemptCount: 0,
        status: "preprocessing",
        currentStepIndex: 0,
        startedAt: now,
        lastPolledAt: now,
        nextPollAfter: addMs(now, generationPollIntervalMs)
      },
      acceptedAsset: null,
      acceptedAssets: []
    }
  };
};

export const acceptApiGeneratedPet = async (
  client: GenerationApiClient,
  state: PrototypeSessionState
): Promise<ApiGenerationResult<Partial<PrototypeSessionState>>> => {
  const pet = state.petProfile;
  const jobId = pet?.activeGenerationJobId;

  if (!pet || !jobId) {
    return localGenerationError("generation_job_missing", "Generation job could not be found.");
  }

  const assetsResult = state.acceptedAssets.length > 0
    ? {
        ok: true as const,
        status: 200,
        data: {
          assets: state.acceptedAssets
        }
      }
    : state.acceptedAsset
    ? {
        ok: true as const,
        status: 200,
        data: {
          assets: [state.acceptedAsset]
        }
      }
    : await client.listGeneratedAssets(pet.id);

  if (!assetsResult.ok) {
    return toGenerationError(assetsResult.error);
  }

  const asset = assetsResult.data.assets[0];

  if (!asset) {
    return localGenerationError("generated_asset_required", "Generated pet asset is not ready yet.");
  }

  const acceptedAssetIds = assetsResult.data.assets.map((candidate) => candidate.id);
  const accepted = await client.acceptGenerationJob(buildAcceptGenerationJobRequest(jobId, acceptedAssetIds));

  if (!accepted.ok) {
    return toGenerationError(accepted.error);
  }

  return {
    ok: true,
    data: {
      petProfile: accepted.data.pet,
      acceptedAsset: accepted.data.assets[0] ?? (asset as GeneratedAsset),
      acceptedAssets: accepted.data.assets.length > 0 ? accepted.data.assets : assetsResult.data.assets
    }
  };
};
