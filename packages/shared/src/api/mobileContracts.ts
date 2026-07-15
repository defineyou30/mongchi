import { getFavoriteCareAction, getFavoriteTreatItemId, getRecentPetMemories, isNightTime, normalizeApproximateWeatherCoordinates } from "../domain";
import type {
  CareActionRequest,
  CareActionReward,
  CareActionType,
  CareState,
  CareStats,
  Conversation,
  ConversationMessage,
  CreditWallet,
  CreditWalletSpendBreakdown,
  Entitlement,
  EntitlementKey,
  GeneratedAsset,
  GeneratedAssetId,
  GenerationJobId,
  GenerationJob,
  Inventory,
  Item,
  ItemId,
  ISODateTime,
  Locale,
  MemoryEntry,
  MemoryType,
  PetId,
  PetProfile,
  PhotoId,
  ReactionRule,
  RelationshipState,
  SelectedReaction,
  UserId,
  WeatherContext,
  WalkSession,
  WalkSessionId
} from "../domain";
import type { GenerationIssueCategory, PetSetupDraft } from "../session/prototypeSession";

export const MAX_SOURCE_PHOTO_BYTES = 10 * 1024 * 1024;

export const supportedSourcePhotoContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type SourcePhotoContentType = (typeof supportedSourcePhotoContentTypes)[number];

export interface CreatePetRequest {
  name: string;
  species: PetProfile["species"];
  personalityTags: PetProfile["personalityTags"];
  talkingStyle: PetProfile["talkingStyle"];
  favoriteThing?: string;
}

export interface UpdatePetRequest {
  name?: string;
  personalityTags?: PetProfile["personalityTags"];
  talkingStyle?: PetProfile["talkingStyle"];
  favoriteThing?: string;
  memoryNote?: string;
}

export interface ListPetsResponse {
  pets: PetProfile[];
}

export interface DeletePetResponse {
  deletedPetId: PetId;
  deletedAt: string;
}

export interface DeleteOriginalPhotosRequest {
  petId: PetId;
}

export interface DeleteOriginalPhotosResponse {
  deletedPhotoIds: PhotoId[];
  deletedAt: string;
}

export interface DeleteChatHistoryResponse {
  deletedConversationIds: string[];
  deletedMessageIds: string[];
  deletedAt: string;
}

export interface LocalPhotoCandidate {
  uri: string;
  byteSize?: number | null;
  mimeType?: string | null;
}

export interface PhotoUploadUrlRequest {
  petId: PetId;
  contentType: SourcePhotoContentType;
  byteSize: number;
}

export interface CompletePhotoUploadRequest {
  photoId: PhotoId;
  contentHash: string;
}

export interface CreateGenerationJobRequest {
  petId: PetId;
  sourcePhotoIds: PhotoId[];
  optionalPhotoIds: PhotoId[];
}

export interface AcceptGenerationJobRequest {
  jobId: GenerationJobId;
  acceptedAssetIds: string[];
}

export interface GenerationIssueReportRequest {
  petId: PetId;
  generationJobId?: GenerationJobId;
  category: GenerationIssueCategory;
}

export interface GenerationIssueReportResponse {
  reportId: string;
  petId: PetId;
  generationJobId?: GenerationJobId;
  category: GenerationIssueCategory;
  reportedAt: string;
}

export interface CurrentUserResponse {
  userId: UserId;
  locale: Locale;
  timezone: string;
  onboardingState: "new" | "pet_created" | "generation_started" | "pet_active";
  wallet: CreditWallet;
}

export interface PhotoUploadUrlResponse {
  photoId: PhotoId;
  uploadUrl: string;
  uploadMethod: "PUT" | "POST";
  uploadHeaders: Record<string, string>;
  expiresAt: string;
  maxByteSize: number;
}

export interface UploadedPhotoSummary {
  id: PhotoId;
  petId: PetId;
  contentType: SourcePhotoContentType;
  byteSize: number;
  status: "uploaded";
  uploadedAt?: string;
}

export interface CompletePhotoUploadResponse {
  photo: UploadedPhotoSummary;
}

export interface RetryGenerationJobResponse {
  job: GenerationJob;
}

export interface GenerationPollResponse {
  job: GenerationJob;
  assets: GeneratedAsset[];
}

export interface AcceptGenerationJobResponse {
  pet: PetProfile;
  assets: GeneratedAsset[];
}

export interface PetAssetsResponse {
  assets: GeneratedAsset[];
}

export interface GeneratedAssetSignedUrlResponse {
  assetId: GeneratedAssetId;
  petId: PetId;
  signedUrl: string;
  expiresAt: string;
  contentType: GeneratedAsset["mimeType"];
  storageClass: GeneratedAsset["storageClass"];
}

export interface CommerceProduct {
  productId: string;
  entitlementKey: EntitlementKey;
  grantType: "durable" | "consumable" | "subscription";
}

export interface CommerceProductsResponse {
  products: CommerceProduct[];
}

export interface EntitlementsResponse {
  entitlements: Entitlement[];
}

export interface WeatherLookupCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
}

export interface WeatherLookupRequest {
  approximateLatitude: number;
  approximateLongitude: number;
  requestedAt: ISODateTime;
  locale?: Locale;
}

export interface WeatherLookupResponse {
  weather: WeatherContext;
  cache: {
    key: string;
    approximateLatitude: number;
    approximateLongitude: number;
    expiresAt: ISODateTime;
    maxAgeSeconds: number;
  };
}

export interface PurchaseVerificationRequest {
  platform: "ios" | "android";
  productId: string;
  transactionId: string;
  receiptHash: string;
  storeVerificationToken?: string;
}

export interface RestorePurchaseRequestItem {
  productId: string;
  transactionId: string;
  receiptHash: string;
  storeVerificationToken: string;
}

export interface RestorePurchasesRequest {
  platform: "ios" | "android";
  transactionIds: string[];
  purchases?: RestorePurchaseRequestItem[];
}

export interface PurchaseVerificationResponse {
  entitlements: Entitlement[];
  wallet?: CreditWallet;
  serverVerified: true;
}

export interface CareActionResponse {
  careState: CareState;
  relationshipState: RelationshipState;
  inventory: Inventory | null;
  wallet?: CreditWallet;
  reaction: SelectedReaction | null;
  reward: CareActionReward | null;
}

export interface StartWalkResponse {
  walk: WalkSession;
  careState: CareState;
  relationshipState: RelationshipState;
  reaction: SelectedReaction | null;
}

export interface ClaimWalkRequest {
  walkId: WalkSessionId;
}

export interface ClaimWalkResponse {
  walk: WalkSession;
  inventory: Inventory;
  relationshipState: RelationshipState;
  reaction: SelectedReaction | null;
}

export interface PlaceInventoryItemRequest {
  itemId: ItemId;
}

export interface InventoryPlacementResponse {
  inventory: Inventory;
}

export interface PurchaseInventoryItemRequest {
  itemId: ItemId;
}

export interface PurchaseInventoryItemResponse {
  item: Item;
  inventory: Inventory;
  wallet: CreditWallet;
  walletSpend: CreditWalletSpendBreakdown;
  creditCost: number;
}

export interface ReactionCatalogResponse {
  locale: Locale;
  version: string;
  rules: ReactionRule[];
}

export interface ItemCatalogResponse {
  items: Item[];
}

/** One remembered moment, trimmed to just what a chat prompt needs -- no ids or raw refs. */
export interface ChatMemoryContextEntry {
  type: MemoryType;
  line: string;
}

/**
 * Small, privacy-conscious summary of "what this pet remembers about its
 * owner" -- prepared client-side so a future server chat endpoint can fold it
 * into the AI prompt without re-deriving it from the full session state.
 * Nothing here is wallet/PII data, just recent memory lines and habit hints.
 */
export interface ChatMemoryContext {
  recentMemories: ChatMemoryContextEntry[];
  favoriteCareAction: CareActionType | null;
  favoriteTreatItemId: ItemId | null;
}

export interface CreateConversationRequest {
  petId: PetId;
  disclosureAccepted: boolean;
  /** Optional "this pet remembers me" context for a future server-side chat prompt. Not required by today's endpoint. */
  memoryContext?: ChatMemoryContext;
}

export interface CreateConversationResponse {
  conversation: Conversation;
  disclosureText: string;
}

export interface ConversationThreadResponse {
  conversation: Conversation;
  messages: ConversationMessage[];
}

export interface DeleteConversationResponse {
  deletedConversationId: string;
  deletedMessageIds: string[];
  deletedAt: string;
}

export interface SendConversationMessageRequest {
  conversationId: string;
  text: string;
}

export interface SendConversationMessageResponse {
  userMessage: ConversationMessage;
  petMessage: ConversationMessage;
  safetyFlags: string[];
  wallet: CreditWallet;
  walletSpend: CreditWalletSpendBreakdown;
}

export type LocalPhotoValidationIssue = "unsupported_type" | "too_large" | "missing_size";
export type WeatherLookupValidationIssue = "invalid_coordinates";

export type LocalPhotoValidationResult =
  | {
      ok: true;
      contentType: SourcePhotoContentType;
      byteSize: number | null;
    }
  | {
      ok: false;
      issue: LocalPhotoValidationIssue;
      messageSafe: string;
    };

export type WeatherLookupRequestResult =
  | {
      ok: true;
      request: WeatherLookupRequest;
    }
  | {
      ok: false;
      issue: WeatherLookupValidationIssue;
      messageSafe: string;
    };

export type PhotoUploadUrlRequestResult =
  | {
      ok: true;
      request: PhotoUploadUrlRequest;
    }
  | {
      ok: false;
      issue: LocalPhotoValidationIssue;
      messageSafe: string;
    };

const extensionToContentType: Record<string, SourcePhotoContentType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export const inferSourcePhotoContentType = (candidate: Pick<LocalPhotoCandidate, "mimeType" | "uri">): SourcePhotoContentType | null => {
  if (candidate.mimeType && supportedSourcePhotoContentTypes.includes(candidate.mimeType as SourcePhotoContentType)) {
    return candidate.mimeType as SourcePhotoContentType;
  }

  const extension = candidate.uri.split("?")[0]?.split(".").pop()?.toLowerCase();

  return extension ? extensionToContentType[extension] ?? null : null;
};

export const validateLocalPhotoCandidate = (candidate: LocalPhotoCandidate): LocalPhotoValidationResult => {
  const contentType = inferSourcePhotoContentType(candidate);

  if (!contentType) {
    return {
      ok: false,
      issue: "unsupported_type",
      messageSafe: "Choose a JPEG, PNG, or WebP pet photo."
    };
  }

  if (candidate.byteSize && candidate.byteSize > MAX_SOURCE_PHOTO_BYTES) {
    return {
      ok: false,
      issue: "too_large",
      messageSafe: "Choose an image under 10 MB with your pet clearly visible."
    };
  }

  return {
    ok: true,
    contentType,
    byteSize: candidate.byteSize ?? null
  };
};

export const buildApproximateWeatherLookupRequest = (
  coordinates: WeatherLookupCoordinates,
  requestedAt: ISODateTime,
  locale?: Locale
): WeatherLookupRequestResult => {
  const approximateCoordinates = normalizeApproximateWeatherCoordinates(coordinates.latitude, coordinates.longitude);

  if (!approximateCoordinates) {
    return {
      ok: false,
      issue: "invalid_coordinates",
      messageSafe: "Location is unavailable. Try manual weather preview instead."
    };
  }

  return {
    ok: true,
    request: {
      ...approximateCoordinates,
      requestedAt,
      ...(locale ? { locale } : {})
    }
  };
};

export const buildCreatePetRequest = (draft: PetSetupDraft): CreatePetRequest => {
  const favoriteThing = draft.favoriteThing.trim();

  return {
    name: draft.name.trim(),
    species: draft.species,
    personalityTags: draft.personalityTags,
    talkingStyle: draft.talkingStyle,
    ...(favoriteThing ? { favoriteThing } : {})
  };
};

export const buildPhotoUploadUrlRequest = (petId: PetId, candidate: LocalPhotoCandidate): PhotoUploadUrlRequestResult => {
  const validation = validateLocalPhotoCandidate(candidate);

  if (!validation.ok) {
    return validation;
  }

  if (!validation.byteSize) {
    return {
      ok: false,
      issue: "missing_size",
      messageSafe: "Photo size must be known before requesting a signed upload URL."
    };
  }

  return {
    ok: true,
    request: {
      petId,
      contentType: validation.contentType,
      byteSize: validation.byteSize
    }
  };
};

export const buildCreateGenerationJobRequest = (
  petId: PetId,
  sourcePhotoId: PhotoId,
  optionalPhotoIds: PhotoId[] = []
): CreateGenerationJobRequest => ({
  petId,
  sourcePhotoIds: [sourcePhotoId],
  optionalPhotoIds
});

export const buildAcceptGenerationJobRequest = (
  jobId: GenerationJobId,
  acceptedAssetIds: string[]
): AcceptGenerationJobRequest => ({
  jobId,
  acceptedAssetIds
});

export const buildCareActionRequest = (
  action: CareActionType,
  occurredAt: string,
  itemId?: ItemId
): CareActionRequest => ({
  action,
  occurredAt,
  ...(itemId ? { itemId } : {})
});

const CHAT_MEMORY_CONTEXT_RECENT_LIMIT = 5;

/**
 * Builds the small "this pet remembers me" summary a future server chat
 * endpoint can fold into its prompt: the most recent remembered moments
 * (type + line, newest first) plus the owner's favorite care action and
 * favorite treat, if any. Pure and read-only -- does not call the network,
 * just shapes data already present in session state for `CreateConversationRequest.memoryContext`.
 */
export const buildChatMemoryContext = (state: { memories: MemoryEntry[]; careStats: CareStats }): ChatMemoryContext => ({
  recentMemories: getRecentPetMemories(state.memories, CHAT_MEMORY_CONTEXT_RECENT_LIMIT).map((memory) => ({
    type: memory.type,
    line: memory.line
  })),
  favoriteCareAction: getFavoriteCareAction(state.careStats),
  favoriteTreatItemId: getFavoriteTreatItemId(state.careStats)
});

// ---------------------------------------------------------------------------
// Live chat-turn Edge Function contract (Chat Live wave C2,
// docs/chat-live-design.md §6.2/§1.1). The single-function `chat-turn`
// transport (supabase/functions/chat-turn) replaces the dead services/api
// three-call contract above (CreateConversationRequest/
// ConversationThreadResponse/SendConversationMessageRequest -- those stay
// only for services/api's own frozen chat route, docs/chat-live-design.md §9
// risk 5) as the mobile client's live chat transport.
// ---------------------------------------------------------------------------

/** Mirrors supabase/functions/chat-turn/chatProvider.ts's PremiumChatCareContext. */
export interface ChatCareContext {
  satiety: number;
  energy: number;
  happiness: number;
  affection: number;
  cleanliness: number;
  gardenHealth: number;
  daysAway?: number;
  /**
   * The pet's local time of day at the moment this turn is sent -- "night"
   * for the same 22:00-05:59 sleep window as dayNightCycle.ts's
   * isNightHour/isNightTime (re-derived client-side from device local time
   * in buildChatCareContext below, not the server's clock/timezone). Lets
   * chat-turn's system prompt add a drowsy, "just woke up" tone at night
   * without locking or charging anything differently -- world-flavor only.
   */
  localTimeOfDay?: "day" | "night";
}

/** Just what chat-turn's prompt needs from a pet profile -- mirrors supabase/functions/chat-turn/index.ts's ValidatedPetProfile. */
export interface ChatTurnPetProfile {
  name: string;
  species: string;
  personalityTags?: string[];
  talkingStyle?: string;
  favoriteThing?: string;
  memoryNote?: string;
}

export interface ChatTurnRequest {
  petId: PetId;
  conversationId?: string;
  text: string;
  disclosureAccepted: boolean;
  requestId: string;
  locale?: Locale;
  timezone?: string;
  petProfile: ChatTurnPetProfile;
  memoryContext?: ChatMemoryContext;
  careContext?: ChatCareContext;
}

export interface ChatTurnResponse {
  conversation: Conversation;
  userMessage: ConversationMessage;
  petMessage: ConversationMessage;
  safetyFlags: string[];
  /** Server-owned credit_wallets balance after this turn. */
  serverBalance: number;
  chargedCredit: number;
  chargeKind: "plus" | "day_pass" | "starter_free" | "daily_free" | "credit" | "crisis";
  freeTurnsRemaining: number;
  /** True when the input matched the crisis-referral pattern (§5.2 layer 1) -- petMessage is a `sender: "system"` resource message and nothing was charged. */
  crisisReferral: boolean;
}

/**
 * Assembles the chat-turn care band the pet's live reply leans on -- mirrors
 * buildChatMemoryContext above (client-prepared, pure, no network). daysAway
 * is threaded in separately since CareState itself has no notion of "now"
 * (see getCareDaysAway). nowIso is the device's current local time, reused
 * (via isNightTime, the same 22:00-05:59 boundary bgmAssets.ts's day/night
 * crossfade already agrees on) to fill in localTimeOfDay -- see
 * ChatCareContext's doc comment.
 */
export const buildChatCareContext = (
  careState: Pick<CareState, "satiety" | "energy" | "happiness" | "affection" | "cleanliness" | "gardenHealth">,
  daysAway: number,
  nowIso: string
): ChatCareContext => ({
  satiety: careState.satiety,
  energy: careState.energy,
  happiness: careState.happiness,
  affection: careState.affection,
  cleanliness: careState.cleanliness,
  gardenHealth: careState.gardenHealth,
  daysAway,
  localTimeOfDay: isNightTime(nowIso) ? "night" : "day"
});

/**
 * Trims a full PetProfile down to the inline snapshot chat-turn requires on
 * every request. There is no `pets` table in the live schema
 * (0005_pet_namespace.sql), so the pet's name/species/personality/etc. travel
 * with every request instead of being looked up server-side -- the same
 * inputSnapshot pattern generate-avatar already uses for the identical gap.
 */
export const buildChatTurnPetProfile = (
  pet: Pick<PetProfile, "name" | "species" | "personalityTags" | "talkingStyle" | "favoriteThing" | "memoryNote">
): ChatTurnPetProfile => ({
  name: pet.name,
  species: pet.species,
  ...(pet.personalityTags.length > 0 ? { personalityTags: [...pet.personalityTags] } : {}),
  ...(pet.talkingStyle ? { talkingStyle: pet.talkingStyle } : {}),
  ...(pet.favoriteThing ? { favoriteThing: pet.favoriteThing } : {}),
  ...(pet.memoryNote ? { memoryNote: pet.memoryNote } : {})
});

// ---------------------------------------------------------------------------
// purchase-chat-pass Edge Function contract (Chat Live BM decision:
// subscription-free single credit economy + a one-off "chatty day pass").
// Mirrors supabase/functions/purchase-chat-pass/purchasePlan.ts's
// PurchaseChatPassRequestBody/PurchaseChatPassMappedResponse -- the request
// body key stays snake_case (request_id) to match that function's own
// convention (see purchasePlan.ts's doc comment), while the response is
// camelCase like every other mobile contract in this file.
// ---------------------------------------------------------------------------

export interface PurchaseChatPassRequest {
  request_id: string;
}

export interface PurchaseChatPassResponse {
  dayPassExpiresAt: string;
  serverBalance: number;
}
