import type {
  AcceptGenerationJobRequest,
  AcceptGenerationJobResponse,
  CareActionRequest,
  CareActionResponse,
  CareState,
  ClaimWalkResponse,
  CommerceProductsResponse,
  CompletePhotoUploadRequest,
  CompletePhotoUploadResponse,
  ConversationThreadResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  CreateGenerationJobRequest,
  CreatePetRequest,
  CurrentUserResponse,
  DeleteChatHistoryResponse,
  DeleteConversationResponse,
  DeleteOriginalPhotosRequest,
  DeleteOriginalPhotosResponse,
  DeletePetResponse,
  EntitlementsResponse,
  GeneratedAssetId,
  GeneratedAssetSignedUrlResponse,
  GenerationIssueReportRequest,
  GenerationIssueReportResponse,
  GenerationJob,
  GenerationJobId,
  GenerationPollResponse,
  Inventory,
  InventoryPlacementResponse,
  ItemId,
  ItemCatalogResponse,
  ListPetsResponse,
  PetAssetsResponse,
  PetId,
  PetProfile,
  PlaceInventoryItemRequest,
  PhotoUploadUrlRequest,
  PhotoUploadUrlResponse,
  PurchaseInventoryItemRequest,
  PurchaseInventoryItemResponse,
  PurchaseVerificationRequest,
  PurchaseVerificationResponse,
  RetryGenerationJobResponse,
  RestorePurchasesRequest,
  ReactionCatalogResponse,
  RelationshipState,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  StartWalkResponse,
  UpdatePetRequest,
  WeatherLookupRequest,
  WeatherLookupResponse
} from "@mongchi/shared";

export interface MobileApiError {
  status: number;
  code: string;
  messageSafe: string;
  retryable: boolean;
}

export type MobileApiResult<T> =
  | {
      ok: true;
      status: number;
      data: T;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export interface MobileApiRequestInit {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
}

export interface MobileApiResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export type MobileApiFetch = (url: string, init: MobileApiRequestInit) => Promise<MobileApiResponse>;

export interface MobileApiClientOptions {
  baseUrl: string;
  authTokenProvider?: () => Promise<string | null> | string | null;
  fetchImpl?: MobileApiFetch;
}

export type BaseUrlResolution =
  | {
      ok: true;
      baseUrl: string;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

const defaultFetch: MobileApiFetch = async (url, init) => fetch(url, init);

const configError = (messageSafe: string): BaseUrlResolution => ({
  ok: false,
  error: {
    status: 0,
    code: "api_base_url_invalid",
    messageSafe,
    retryable: false
  }
});

export const resolveMobileApiBaseUrl = (value?: string | null): BaseUrlResolution => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return configError("API base URL is not configured.");
  }

  if (/\s/.test(trimmed)) {
    return configError("API base URL is invalid.");
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return configError("API base URL is invalid.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return configError("API base URL must use HTTPS.");
  }

  if (parsed.protocol === "http:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    return configError("API base URL must use HTTPS.");
  }

  return {
    ok: true,
    baseUrl: trimmed.replace(/\/+$/, "")
  };
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const encodePathSegment = (value: string): string => encodeURIComponent(value);

const parseJsonBody = (bodyText: string): unknown => {
  if (!bodyText.trim()) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return null;
  }
};

const coerceApiError = (status: number, payload: unknown): MobileApiError => {
  const errorPayload = isObject(payload) && isObject(payload.error) ? payload.error : payload;
  const code = isObject(errorPayload) && typeof errorPayload.code === "string" ? errorPayload.code : "api_request_failed";
  const messageSafe =
    isObject(errorPayload) && typeof errorPayload.messageSafe === "string"
      ? errorPayload.messageSafe
      : "Request failed. Please try again.";

  return {
    status,
    code,
    messageSafe,
    retryable: status === 0 || status === 408 || status === 429 || status >= 500
  };
};

export function createMobileApiClient(options: MobileApiClientOptions) {
  const resolvedBaseUrl = resolveMobileApiBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  const request = async <T>(
    method: MobileApiRequestInit["method"],
    path: string,
    body?: unknown
  ): Promise<MobileApiResult<T>> => {
    if (!resolvedBaseUrl.ok) {
      return {
        ok: false,
        error: resolvedBaseUrl.error
      };
    }

    const token = (await options.authTokenProvider?.()) ?? null;
    const headers: Record<string, string> = {
      Accept: "application/json"
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetchImpl(`${resolvedBaseUrl.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      const payload = parseJsonBody(await response.text());

      if (!response.ok) {
        return {
          ok: false,
          error: coerceApiError(response.status, payload)
        };
      }

      return {
        ok: true,
        status: response.status,
        data: payload as T
      };
    } catch {
      return {
        ok: false,
        error: {
          status: 0,
          code: "network_error",
          messageSafe: "Network request failed. Check your connection and try again.",
          retryable: true
        }
      };
    }
  };

  return {
    getCurrentUser: () => request<CurrentUserResponse>("GET", "/v1/me"),
    listPets: () => request<ListPetsResponse>("GET", "/v1/pets"),
    createPet: (body: CreatePetRequest) => request<PetProfile>("POST", "/v1/pets", body),
    updatePet: (petId: PetId, body: UpdatePetRequest) => request<PetProfile>("PATCH", `/v1/pets/${encodePathSegment(petId)}`, body),
    deletePet: (petId: PetId) => request<DeletePetResponse>("DELETE", `/v1/pets/${encodePathSegment(petId)}`),
    deleteOriginalPhotos: (body: DeleteOriginalPhotosRequest) =>
      request<DeleteOriginalPhotosResponse>("DELETE", "/v1/privacy/original-photos", body),
    deleteChatHistory: () => request<DeleteChatHistoryResponse>("DELETE", "/v1/privacy/chat-history"),
    deletePrivacyPet: (petId: PetId) => request<DeletePetResponse>("DELETE", `/v1/privacy/pet/${encodePathSegment(petId)}`),
    issuePhotoUploadUrl: (body: PhotoUploadUrlRequest) => request<PhotoUploadUrlResponse>("POST", "/v1/photos/upload-url", body),
    completePhotoUpload: (body: CompletePhotoUploadRequest) =>
      request<CompletePhotoUploadResponse>("POST", "/v1/photos/complete-upload", body),
    createGenerationJob: (body: CreateGenerationJobRequest) => request<GenerationJob>("POST", "/v1/generation-jobs", body),
    getGenerationJob: (jobId: GenerationJobId) =>
      request<GenerationJob>("GET", `/v1/generation-jobs/${encodePathSegment(jobId)}`),
    retryGenerationJob: (jobId: GenerationJobId) =>
      request<RetryGenerationJobResponse>("POST", `/v1/generation-jobs/${encodePathSegment(jobId)}/retry`),
    pollGenerationJob: (jobId: GenerationJobId) =>
      request<GenerationPollResponse>("POST", `/v1/generation-jobs/${encodePathSegment(jobId)}/poll`),
    acceptGenerationJob: (body: AcceptGenerationJobRequest) =>
      request<AcceptGenerationJobResponse>("POST", `/v1/generation-jobs/${encodePathSegment(body.jobId)}/accept`, body),
    reportGenerationIssue: (body: GenerationIssueReportRequest) =>
      request<GenerationIssueReportResponse>("POST", "/v1/generation-issue-reports", body),
    listGeneratedAssets: (petId: PetId) => request<PetAssetsResponse>("GET", `/v1/pets/${encodePathSegment(petId)}/assets`),
    getGeneratedAssetSignedUrl: (assetId: GeneratedAssetId) =>
      request<GeneratedAssetSignedUrlResponse>("GET", `/v1/assets/${encodePathSegment(assetId)}/signed-url`),
    getCareState: (petId: PetId) => request<CareState>("GET", `/v1/pets/${encodePathSegment(petId)}/care-state`),
    getRelationshipState: (petId: PetId) =>
      request<RelationshipState>("GET", `/v1/pets/${encodePathSegment(petId)}/relationship-state`),
    performCareAction: (petId: PetId, body: CareActionRequest) =>
      request<CareActionResponse>("POST", `/v1/pets/${encodePathSegment(petId)}/care-actions`, body),
    startWalk: (petId: PetId) => request<StartWalkResponse>("POST", `/v1/pets/${encodePathSegment(petId)}/walks`),
    claimWalkReward: (walkId: string) => request<ClaimWalkResponse>("POST", `/v1/walks/${encodePathSegment(walkId)}/claim`),
    lookupCurrentWeather: (body: WeatherLookupRequest) => request<WeatherLookupResponse>("POST", "/v1/weather/current", body),
    getReactionCatalog: () => request<ReactionCatalogResponse>("GET", "/v1/reaction-catalog"),
    getItemCatalog: () => request<ItemCatalogResponse>("GET", "/v1/catalog/items"),
    getInventory: () => request<Inventory>("GET", "/v1/inventory"),
    purchaseInventoryItem: (body: PurchaseInventoryItemRequest) =>
      request<PurchaseInventoryItemResponse>("POST", "/v1/inventory/purchases", body),
    placeInventoryItem: (body: PlaceInventoryItemRequest) =>
      request<InventoryPlacementResponse>("POST", "/v1/inventory/placements", body),
    removePlacedItem: (itemId: ItemId) =>
      request<InventoryPlacementResponse>("DELETE", `/v1/inventory/placements/${encodePathSegment(itemId)}`),
    getCommerceProducts: () => request<CommerceProductsResponse>("GET", "/v1/commerce/products"),
    getEntitlements: () => request<EntitlementsResponse>("GET", "/v1/entitlements"),
    verifyPurchase: (body: PurchaseVerificationRequest) =>
      request<PurchaseVerificationResponse>("POST", "/v1/commerce/purchases/verify", body),
    restorePurchases: (body: RestorePurchasesRequest) =>
      request<PurchaseVerificationResponse>("POST", "/v1/commerce/restore", body),
    createPremiumConversation: (body: CreateConversationRequest) => request<CreateConversationResponse>("POST", "/v1/conversations", body),
    getConversationThread: (conversationId: string) =>
      request<ConversationThreadResponse>("GET", `/v1/conversations/${encodePathSegment(conversationId)}`),
    deleteConversation: (conversationId: string) =>
      request<DeleteConversationResponse>("DELETE", `/v1/conversations/${encodePathSegment(conversationId)}`),
    sendPremiumConversationMessage: (body: SendConversationMessageRequest) =>
      request<SendConversationMessageResponse>("POST", `/v1/conversations/${encodePathSegment(body.conversationId)}/messages`, body)
  };
}
