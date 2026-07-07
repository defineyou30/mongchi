import {
  MAX_SOURCE_PHOTO_BYTES,
  applyRelationshipCareAction,
  applyLocalCareAction,
  canSpendPremiumChatTurn,
  consumeInventoryItem,
  createApproximateLocationWeatherContext,
  generatedAssetStates,
  getAvailableTreatItemId,
  getPlantBloomRewards,
  getWeatherLookupCacheKey,
  grantCreditWalletValue,
  getCreditItemPrice,
  grantRelationshipBondXp,
  isPlantGrowthEnabledItemId,
  isTreatInventoryItem,
  placeInventoryItemInFixedSlot,
  mockCareState,
  mockCreditWallet,
  mockGenerationJob,
  premiumChatGate,
  projectCareStateForTime,
  mockGeneratedAssets,
  mockInventory,
  mockItems,
  mockPetProfile,
  mockRelationshipState,
  selectLocalReaction,
  starterReactionCatalogVersion,
  starterReactionRules,
  normalizeApproximateWeatherCoordinates,
  summarizePlantBloomRewards,
  supportedSourcePhotoContentTypes,
  spendPremiumChatTurn,
  spendCredits,
  WEATHER_CACHE_TTL_MS,
  waterPlantGrowthEntriesWithOutcome
} from "@mongchi/shared";
import type {
  CareActionRequest,
  CareActionType,
  CareState,
  Conversation,
  ConversationId,
  ConversationMessage,
  CreditWallet,
  CreditWalletGrant,
  CreditWalletSpendBreakdown,
  Entitlement,
  EntitlementKey,
  GeneratedAsset,
  GeneratedAssetId,
  GenerationIssueCategory,
  GenerationJob,
  GenerationJobId,
  GenerationJobStatus,
  Inventory,
  InventoryEntry,
  InventorySource,
  ISODateTime,
  Item,
  ItemId,
  Locale,
  PetId,
  PetProfile,
  PlacedItem,
  PhotoId,
  ReactionRule,
  RelationshipState,
  RecentReaction,
  SelectedReaction,
  SourcePhotoContentType,
  UserId,
  WeatherContext,
  WalkSession,
  WalkSessionId
} from "@mongchi/shared";

import type {
  AcceptGenerationJobRequest,
  AcceptGenerationJobResponse,
  CareActionResponse,
  ClaimWalkResponse,
  CommerceProduct,
  CommerceProductsResponse,
  CompleteGenerationJobRequest,
  CompleteGenerationJobResponse,
  CompletePhotoUploadRequest,
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
  EntitlementsResponse,
  GeneratedAssetSignedUrlResponse,
  GenerationIssueReportRequest,
  GenerationIssueReportResponse,
  GenerationPollResponse,
  ItemCatalogResponse,
  InventoryPlacementResponse,
  ListPetsResponse,
  PlaceInventoryItemRequest,
  PhotoUploadUrlRequest,
  PhotoUploadUrlResponse,
  PurchaseInventoryItemRequest,
  PurchaseInventoryItemResponse,
  PurchaseReceiptRevocationRequest,
  PurchaseRevocationRequest,
  PurchaseRevocationResponse,
  PurchaseVerificationRequest,
  PurchaseVerificationResponse,
  RetryGenerationJobResponse,
  RestorePurchasesRequest,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  StartWalkResponse,
  UpdatePetRequest,
  WeatherLookupRequest,
  WeatherLookupResponse
} from "./contracts";
import type { StorePurchaseVerifier, VerifiedStorePurchase } from "./purchaseVerifier";
import type { PrivateStorageSigner } from "./storageSigner";
import {
  checkPremiumChatRateLimit,
  filterPremiumChatRetainedMessages,
  resolvePremiumChatPolicy,
  type PremiumChatPolicyOptions
} from "./premiumChatPolicy";
import {
  moderatePremiumChatInput,
  moderatePremiumChatProviderReply
} from "./premiumChatModeration";

export type ApiStatus = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503;

export interface ApiError {
  status: ApiStatus;
  code: string;
  messageSafe: string;
}

export type ApiResult<T> =
  | {
      ok: true;
      status: ApiStatus;
      data: T;
    }
  | {
      ok: false;
      error: ApiError;
    };

export interface ApiAuthContext {
  userId?: UserId | null;
  locale?: Locale;
  timezone?: string;
  authProvider?: string;
  authSubject?: string;
}

export type OriginalPhotoStatus = "upload_url_issued" | "uploaded" | "deleted";

export interface OriginalPhotoRecord {
  id: PhotoId;
  userId: UserId;
  petId: PetId;
  contentType: SourcePhotoContentType;
  byteSize: number;
  status: OriginalPhotoStatus;
  uploadUrl: string;
  storageUri?: string;
  expiresAt: ISODateTime;
  contentHash?: string;
  uploadedAt?: ISODateTime;
  deletedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CompletePhotoUploadResponse {
  photo: OriginalPhotoRecord;
}

export interface RecentReactionRecord extends RecentReaction {
  userId: UserId;
  petId: PetId;
}

export interface MockApiServiceSeed {
  sequence?: number;
  pets?: PetProfile[];
  photos?: OriginalPhotoRecord[];
  generationJobs?: GenerationJob[];
  generationIssueReports?: GenerationIssueReportRecord[];
  generatedAssets?: GeneratedAsset[];
  careStates?: CareState[];
  relationshipStates?: RelationshipState[];
  wallets?: CreditWallet[];
  inventories?: Inventory[];
  itemCatalog?: Item[];
  walkSessions?: WalkSession[];
  recentReactions?: RecentReactionRecord[];
  entitlements?: Entitlement[];
  purchaseLedger?: PurchaseLedgerRecord[];
  conversations?: Conversation[];
  conversationMessages?: ConversationMessage[];
}

export interface MockApiServiceSnapshot {
  sequence: number;
  pets: PetProfile[];
  photos: OriginalPhotoRecord[];
  generationJobs: GenerationJob[];
  generationIssueReports: GenerationIssueReportRecord[];
  generatedAssets: GeneratedAsset[];
  careStates: CareState[];
  relationshipStates: RelationshipState[];
  wallets: CreditWallet[];
  inventories: Inventory[];
  itemCatalog: Item[];
  walkSessions: WalkSession[];
  recentReactions: RecentReactionRecord[];
  entitlements: Entitlement[];
  purchaseLedger: PurchaseLedgerRecord[];
  conversations: Conversation[];
  conversationMessages: ConversationMessage[];
}

export interface PurchaseLedgerRecord {
  ledgerEntryId: string;
  userId: UserId;
  platform: "ios" | "android";
  productId: string;
  transactionId: string;
  receiptHash: string;
  entitlementId: string;
  status: "verified" | "restored" | "revoked";
  verifiedAt: ISODateTime;
  restoredAt?: ISODateTime;
  revokedAt?: ISODateTime;
  revocationReason?: PurchaseRevocationRequest["reason"];
}

export interface GenerationIssueReportRecord extends GenerationIssueReportResponse {
  userId: UserId;
}

export interface MockApiServiceOptions {
  seed?: MockApiServiceSeed;
  now?: () => ISODateTime;
  allowMockPurchaseVerification?: boolean;
  allowMockStorageSigning?: boolean;
  purchaseVerifier?: StorePurchaseVerifier;
  privateStorageSigner?: PrivateStorageSigner;
  premiumChatPolicy?: PremiumChatPolicyOptions;
}

const DEFAULT_NOW = "2026-06-24T09:00:00.000Z";
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const ASSET_READ_URL_TTL_MS = 10 * 60 * 1000;
const MOCK_WALK_DURATION_MS = 15 * 1000;
const WALK_REWARD_ITEM_ID: ItemId = "item_flower_pot_sunny";
const mockGenerationPollStatuses: GenerationJobStatus[] = [
  "preprocessing",
  "safety_checking",
  "generating",
  "quality_checking",
  "completed"
];
const contentHashPattern = /^(sha256:)?[a-f0-9]{32,128}$/i;
const transactionIdPattern = /^[A-Za-z0-9_.:-]{6,160}$/;
const storeVerificationTokenControlPattern = /[\u0000-\u001f\u007f]/;
const supportedSourcePhotoContentTypeSet = new Set<string>(supportedSourcePhotoContentTypes);
const supportedPetSpecies = new Set(["dog", "cat"]);
const supportedCareActions = new Set<CareActionType>([
  "feed",
  "talk",
  "walk",
  "play",
  "rest",
  "affection",
  "water_garden",
  "clean",
  "treat"
]);
const supportedPersonalityTags = new Set(["playful", "calm", "shy", "curious", "sleepy", "affectionate"]);
const supportedTalkingStyles = new Set(["cute", "gentle", "cheerful", "comforting"]);
const supportedGeneratedAssetStates = new Set(generatedAssetStates);
const supportedGeneratedAssetQualityStatuses = new Set(["pending", "passed", "failed", "manual_review"]);
const supportedGenerationIssueCategories = new Set<GenerationIssueCategory>([
  "wrong_pet",
  "unsafe_or_scary",
  "poor_quality"
]);

const isValidStoreVerificationToken = (value: string): boolean =>
  value.length >= 8 && value.length <= 8192 && !storeVerificationTokenControlPattern.test(value);

const ok = <T>(data: T, status: ApiStatus = 200): ApiResult<T> => ({
  ok: true,
  status,
  data
});

const fail = <T = never>(status: ApiStatus, code: string, messageSafe: string): ApiResult<T> => ({
  ok: false,
  error: {
    status,
    code,
    messageSafe
  }
});

const addMs = (timestamp: ISODateTime, durationMs: number): ISODateTime =>
  new Date(new Date(timestamp).getTime() + durationMs).toISOString();

const clonePet = (pet: PetProfile): PetProfile => ({
  ...pet,
  personalityTags: [...pet.personalityTags]
});

const clonePhoto = (photo: OriginalPhotoRecord): OriginalPhotoRecord => ({ ...photo });

const cloneGenerationJob = (job: GenerationJob): GenerationJob => ({
  ...job,
  sourcePhotoIds: [...job.sourcePhotoIds],
  optionalPhotoIds: [...job.optionalPhotoIds],
  inputSnapshot: {
    ...job.inputSnapshot,
    personalityTags: [...job.inputSnapshot.personalityTags]
  },
  quality: {
    ...job.quality,
    failedChecks: [...job.quality.failedChecks]
  },
  ...(job.failure ? { failure: { ...job.failure } } : {})
});

const cloneGeneratedAsset = (asset: GeneratedAsset): GeneratedAsset => ({ ...asset });
const cloneGenerationIssueReport = (report: GenerationIssueReportRecord): GenerationIssueReportRecord => ({ ...report });

const cloneCareState = (careState: CareState): CareState => ({ ...careState });

const cloneInventoryEntry = (entry: InventoryEntry): InventoryEntry => ({ ...entry });

const clonePlacedItem = (item: PlacedItem): PlacedItem => ({ ...item });

const cloneInventory = (inventory: Inventory): Inventory => ({
  ...inventory,
  items: inventory.items.map(cloneInventoryEntry),
  ownedThemeIds: [...(inventory.ownedThemeIds ?? [])],
  placedItems: inventory.placedItems.map(clonePlacedItem),
  plantGrowth: inventory.plantGrowth?.map((entry) => ({ ...entry })) ?? []
});

const cloneRelationshipState = (relationshipState: RelationshipState): RelationshipState => ({ ...relationshipState });

const cloneCreditWallet = (wallet: CreditWallet): CreditWallet => ({ ...wallet });

const cloneItem = (item: Item): Item => ({
  ...item,
  behaviorTags: [...item.behaviorTags],
  placementSlots: [...item.placementSlots]
});

const cloneWalkSession = (walk: WalkSession): WalkSession => ({
  ...walk,
  rewardItemIds: [...walk.rewardItemIds]
});

const cloneReactionRule = (rule: ReactionRule): ReactionRule => ({
  ...rule,
  conditions: {
    ...rule.conditions,
    ...(rule.conditions.personalityTagsAny ? { personalityTagsAny: [...rule.conditions.personalityTagsAny] } : {}),
    ...(rule.conditions.personalityTagsAll ? { personalityTagsAll: [...rule.conditions.personalityTagsAll] } : {}),
    ...(rule.conditions.talkingStylesAny ? { talkingStylesAny: [...rule.conditions.talkingStylesAny] } : {}),
    ...(rule.conditions.species ? { species: [...rule.conditions.species] } : {}),
    ...(rule.conditions.recentActionAny ? { recentActionAny: [...rule.conditions.recentActionAny] } : {}),
    ...(rule.conditions.walkStatus ? { walkStatus: [...rule.conditions.walkStatus] } : {}),
    ...(rule.conditions.eventContext ? { eventContext: [...rule.conditions.eventContext] } : {})
  },
  lines: [...rule.lines]
});

const cloneSelectedReaction = (reaction: SelectedReaction): SelectedReaction => ({ ...reaction });

const cloneRecentReactionRecord = (reaction: RecentReactionRecord): RecentReactionRecord => ({ ...reaction });

const cloneEntitlement = (entitlement: Entitlement): Entitlement => ({
  ...entitlement,
  metadata: { ...entitlement.metadata }
});

const clonePurchaseLedgerRecord = (record: PurchaseLedgerRecord): PurchaseLedgerRecord => ({ ...record });

const cloneConversation = (conversation: Conversation): Conversation => ({ ...conversation });

const cloneConversationMessage = (message: ConversationMessage): ConversationMessage => ({
  ...message,
  safetyFlags: [...message.safetyFlags]
});

const cloneWeatherContext = (weather: WeatherContext): WeatherContext => ({ ...weather });

const isSupportedSourcePhotoContentType = (contentType: string): contentType is SourcePhotoContentType =>
  supportedSourcePhotoContentTypeSet.has(contentType);

const safeStorageSegment = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, "_");

export const commerceProducts: CommerceProduct[] = [
  { productId: "premium_chat_monthly", entitlementKey: "premium_chat", grantType: "subscription" },
  { productId: "extra_pet_slot_1", entitlementKey: "extra_pet_slot", grantType: "durable" },
  { productId: "regeneration_credit_1", entitlementKey: "regeneration_credit", grantType: "consumable" },
  { productId: "theme_pack_starter", entitlementKey: "theme_pack", grantType: "durable" }
];

const commerceProductById = new Map(commerceProducts.map((product) => [product.productId, product]));

const consumableWalletGrants: Partial<Record<EntitlementKey, CreditWalletGrant>> = {
  regeneration_credit: { credits: 1 }
};

const getConsumableWalletGrant = (product: CommerceProduct): CreditWalletGrant | null =>
  product.grantType === "consumable" ? consumableWalletGrants[product.entitlementKey] ?? null : null;

const cloneCommerceProduct = (product: CommerceProduct): CommerceProduct => ({ ...product });

const subscriptionDurationMs = 30 * 24 * 60 * 60 * 1000;

export function createMockApiService(options: MockApiServiceOptions = {}) {
  const now = options.now ?? (() => DEFAULT_NOW);
  const allowMockPurchaseVerification = options.allowMockPurchaseVerification ?? true;
  const allowMockStorageSigning = options.allowMockStorageSigning ?? true;
  const purchaseVerifier = options.purchaseVerifier;
  const privateStorageSigner = options.privateStorageSigner;
  const premiumChatPolicy = resolvePremiumChatPolicy(options.premiumChatPolicy);
  let sequence =
    typeof options.seed?.sequence === "number" && Number.isInteger(options.seed.sequence) && options.seed.sequence > 0
      ? options.seed.sequence
      : 1;
  const petSeed = options.seed?.pets ?? [mockPetProfile];
  const generationJobSeed =
    options.seed?.generationJobs ?? (petSeed.some((pet) => pet.id === mockGenerationJob.petId) ? [mockGenerationJob] : []);
  const generatedAssetSeed =
    options.seed?.generatedAssets ??
    (petSeed.some((pet) => mockGeneratedAssets.some((asset) => asset.petId === pet.id)) &&
    generationJobSeed.some((job) => mockGeneratedAssets.some((asset) => asset.generationJobId === job.id))
      ? mockGeneratedAssets
      : []);
  const pets = new Map<PetId, PetProfile>(petSeed.map((pet) => [pet.id, clonePet(pet)]));
  const photos = new Map<PhotoId, OriginalPhotoRecord>(
    (options.seed?.photos ?? []).map((photo) => [photo.id, clonePhoto(photo)])
  );
  const generationJobs = new Map<GenerationJobId, GenerationJob>(
    generationJobSeed.map((job) => [job.id, cloneGenerationJob(job)])
  );
  const generationIssueReports = new Map<string, GenerationIssueReportRecord>(
    (options.seed?.generationIssueReports ?? []).map((report) => [report.reportId, cloneGenerationIssueReport(report)])
  );
  const generatedAssets = new Map<GeneratedAssetId, GeneratedAsset>(
    generatedAssetSeed.map((asset) => [asset.id, cloneGeneratedAsset(asset)])
  );
  const careStates = new Map<PetId, CareState>(
    (options.seed?.careStates ?? [mockCareState]).map((careState) => [careState.petId, cloneCareState(careState)])
  );
  const relationshipStates = new Map<PetId, RelationshipState>(
    (options.seed?.relationshipStates ?? [mockRelationshipState]).map((relationshipState) => [
      relationshipState.petId,
      cloneRelationshipState(relationshipState)
    ])
  );
  const wallets = new Map<UserId, CreditWallet>(
    (options.seed?.wallets ?? [mockCreditWallet]).map((wallet) => [wallet.userId, cloneCreditWallet(wallet)])
  );
  const inventories = new Map<UserId, Inventory>(
    (options.seed?.inventories ?? [mockInventory]).map((inventory) => [inventory.userId, cloneInventory(inventory)])
  );
  const itemCatalog = (options.seed?.itemCatalog ?? mockItems).map(cloneItem);
  const walkSessions = new Map<WalkSessionId, WalkSession>(
    (options.seed?.walkSessions ?? []).map((walk) => [walk.id, cloneWalkSession(walk)])
  );
  const recentReactionRecords = new Map<PetId, RecentReactionRecord[]>();

  for (const reaction of options.seed?.recentReactions ?? []) {
    const current = recentReactionRecords.get(reaction.petId) ?? [];
    recentReactionRecords.set(reaction.petId, [cloneRecentReactionRecord(reaction), ...current].slice(0, 12));
  }

  const entitlements = new Map<string, Entitlement>(
    (options.seed?.entitlements ?? []).map((entitlement) => [entitlement.id, cloneEntitlement(entitlement)])
  );
  const purchaseLedger = new Map<string, PurchaseLedgerRecord>(
    (options.seed?.purchaseLedger ?? []).map((record) => [record.transactionId, clonePurchaseLedgerRecord(record)])
  );
  const conversations = new Map<ConversationId, Conversation>(
    (options.seed?.conversations ?? []).map((conversation) => [conversation.id, cloneConversation(conversation)])
  );
  const conversationMessages = new Map<string, ConversationMessage>(
    (options.seed?.conversationMessages ?? []).map((message) => [message.id, cloneConversationMessage(message)])
  );
  const weatherCache = new Map<string, WeatherLookupResponse>();

  const requireAuth = (context: ApiAuthContext): ApiResult<{ userId: UserId; locale: Locale; timezone: string }> => {
    if (!context.userId) {
      return fail(401, "auth_required", "Sign in is required.");
    }

    return ok({
      userId: context.userId,
      locale: context.locale ?? "ko-KR",
      timezone: context.timezone ?? "Asia/Seoul"
    });
  };

  const findOwnedPet = (context: ApiAuthContext, petId: PetId): ApiResult<PetProfile> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = pets.get(petId);

    if (!pet || pet.userId !== auth.data.userId || pet.lifecycleStatus === "deleted") {
      return fail(404, "pet_not_found", "Pet not found.");
    }

    return ok(clonePet(pet));
  };

  const getCurrentWeather = (context: ApiAuthContext, request: WeatherLookupRequest): ApiResult<WeatherLookupResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const approximateLatitude = typeof request?.approximateLatitude === "number" ? request.approximateLatitude : Number.NaN;
    const approximateLongitude = typeof request?.approximateLongitude === "number" ? request.approximateLongitude : Number.NaN;
    const coordinates = normalizeApproximateWeatherCoordinates(approximateLatitude, approximateLongitude);

    if (!coordinates) {
      return fail(422, "invalid_weather_coordinates", "Weather location is unavailable.");
    }

    const fetchedAt = now();
    const cacheKey = getWeatherLookupCacheKey(coordinates);
    const cached = weatherCache.get(cacheKey);

    if (cached && new Date(cached.cache.expiresAt).getTime() > new Date(fetchedAt).getTime()) {
      return ok({
        weather: {
          ...cloneWeatherContext(cached.weather),
          source: "cached",
          fetchedAt
        },
        cache: { ...cached.cache }
      });
    }

    const weather = createApproximateLocationWeatherContext(coordinates, fetchedAt);
    const response: WeatherLookupResponse = {
      weather,
      cache: {
        key: cacheKey,
        approximateLatitude: coordinates.approximateLatitude,
        approximateLongitude: coordinates.approximateLongitude,
        expiresAt: addMs(fetchedAt, WEATHER_CACHE_TTL_MS),
        maxAgeSeconds: Math.floor(WEATHER_CACHE_TTL_MS / 1000)
      }
    };

    weatherCache.set(cacheKey, response);

    return ok({
      weather: cloneWeatherContext(response.weather),
      cache: { ...response.cache }
    });
  };

  const ensureCareState = (pet: PetProfile, timestamp: ISODateTime = now()): CareState => {
    const existing = careStates.get(pet.id);

    if (existing) {
      return cloneCareState(existing);
    }

    const { activeWalkId: _activeWalkId, ...baseCareState } = mockCareState;
    const careState: CareState = {
      ...baseCareState,
      petId: pet.id,
      updatedAt: timestamp
    };

    careStates.set(pet.id, careState);

    return cloneCareState(careState);
  };

  const ensureRelationshipState = (pet: PetProfile, timestamp: ISODateTime = now()): RelationshipState => {
    const existing = relationshipStates.get(pet.id);

    if (existing) {
      return cloneRelationshipState(existing);
    }

    const { lastBondedAt: _lastBondedAt, ...baseRelationshipState } = mockRelationshipState;
    const relationshipState: RelationshipState = {
      ...baseRelationshipState,
      petId: pet.id,
      bondXp: 0,
      bondLevel: 1,
      totalCareActions: 0,
      totalTalkCount: 0,
      daysTogether: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    relationshipStates.set(pet.id, relationshipState);

    return cloneRelationshipState(relationshipState);
  };

  const ensureWallet = (userId: UserId, timestamp: ISODateTime = now()): CreditWallet => {
    const existing = wallets.get(userId);

    if (existing) {
      return cloneCreditWallet(existing);
    }

    const wallet: CreditWallet = {
      ...mockCreditWallet,
      userId,
      updatedAt: timestamp
    };

    wallets.set(userId, wallet);

    return cloneCreditWallet(wallet);
  };

  const ensureInventory = (userId: UserId, timestamp: ISODateTime = now()): Inventory => {
    const existing = inventories.get(userId);

    if (existing) {
      return cloneInventory(existing);
    }

    const inventory: Inventory = {
      ...mockInventory,
      userId,
      items: mockInventory.items.map(cloneInventoryEntry),
      placedItems: mockInventory.placedItems.map(clonePlacedItem),
      plantGrowth: mockInventory.plantGrowth?.map((entry) => ({ ...entry })) ?? [],
      updatedAt: timestamp
    };

    inventories.set(userId, inventory);

    return cloneInventory(inventory);
  };

  const appendReaction = (
    userId: UserId,
    petId: PetId,
    reaction: SelectedReaction,
    shownAt: ISODateTime
  ): SelectedReaction => {
    const current = recentReactionRecords.get(petId) ?? [];

    recentReactionRecords.set(
      petId,
      [
        {
          userId,
          petId,
          ruleId: reaction.ruleId,
          line: reaction.line,
          shownAt
        },
        ...current
      ].slice(0, 12)
    );

    return cloneSelectedReaction(reaction);
  };

  const selectReactionForPet = (
    auth: { userId: UserId; locale: Locale },
    pet: PetProfile,
    careState: CareState,
    selectedAt: ISODateTime,
    context: Pick<Parameters<typeof selectLocalReaction>[1], "recentAction" | "walkStatus" | "eventContext"> = {}
  ): SelectedReaction => {
    const selectedReaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: auth.locale,
        now: selectedAt,
        pet,
        careState,
        daysAway: 0,
        recentReactions: recentReactionRecords.get(pet.id) ?? [],
        ...context
      },
      { random: () => 0 }
    );

    return appendReaction(auth.userId, pet.id, selectedReaction, selectedAt);
  };

  const grantInventoryItem = (
    inventory: Inventory,
    itemId: ItemId,
    grantedAt: ISODateTime,
    source: InventorySource = "walk_reward"
  ): Inventory => {
    const existing = inventory.items.find((entry) => entry.itemId === itemId);
    const items: InventoryEntry[] = existing
      ? inventory.items.map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity + 1 } : entry))
      : [
          ...inventory.items,
          {
            itemId,
            quantity: 1,
            acquiredAt: grantedAt,
            source
          }
        ];
    const placedItems: PlacedItem[] = inventory.placedItems.some((item) => item.itemId === itemId)
      ? inventory.placedItems.map(clonePlacedItem)
      : [
          ...inventory.placedItems.map(clonePlacedItem),
          {
            itemId,
            slot: "garden",
            x: 0.52,
            y: 0.7,
            rotation: 4
          }
        ];

    return {
      ...inventory,
      items,
      placedItems,
      plantGrowth: inventory.plantGrowth?.map((entry) => ({ ...entry })) ?? [],
      updatedAt: grantedAt
    };
  };

  const waterGardenInventory = (
    inventory: Inventory,
    wateredAt: ISODateTime
  ): { inventory: Inventory; bloomRewards: ReturnType<typeof getPlantBloomRewards> } => {
    const itemById = new Map(itemCatalog.map((item) => [item.id, item]));
    const waterablePlantItemIds = inventory.placedItems
      .map((placedItem) => itemById.get(placedItem.itemId))
      .filter((item): item is Item => Boolean(item))
      .filter((item) => isPlantGrowthEnabledItemId(item.id))
      .map((item) => item.id);

    if (waterablePlantItemIds.length === 0) {
      return {
        inventory: cloneInventory(inventory),
        bloomRewards: []
      };
    }

    const wateringOutcome = waterPlantGrowthEntriesWithOutcome(inventory.plantGrowth ?? [], [...new Set(waterablePlantItemIds)], wateredAt);

    return {
      inventory: {
        ...inventory,
        plantGrowth: wateringOutcome.entries,
        updatedAt: wateredAt
      },
      bloomRewards: getPlantBloomRewards(wateringOutcome.bloomedItemIds)
    };
  };

  const purchaseInventoryItem = (
    context: ApiAuthContext,
    request: PurchaseInventoryItemRequest
  ): ApiResult<PurchaseInventoryItemResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const itemId = request && typeof request.itemId === "string" ? request.itemId : "";
    const item = itemCatalog.find((candidate) => candidate.id === itemId);

    if (!item) {
      return fail(404, "catalog_item_not_found", "Shop item not found.");
    }

    const price = getCreditItemPrice(itemId);

    if (!price) {
      return fail(422, "item_not_credit_purchasable", "This item is not available for credits.");
    }

    const purchasedAt = now();
    const walletSpend = spendCredits(ensureWallet(auth.data.userId, purchasedAt), price.creditCost, purchasedAt);

    if (!walletSpend.ok) {
      return fail(403, "insufficient_credits", "Not enough credits for this item.");
    }

    const inventoryBeforePurchase = ensureInventory(auth.data.userId, purchasedAt);
    const inventory = grantInventoryItem(inventoryBeforePurchase, item.id, purchasedAt, "purchase");

    wallets.set(auth.data.userId, walletSpend.wallet);
    inventories.set(auth.data.userId, inventory);

    return ok(
      {
        item: cloneItem(item),
        inventory: cloneInventory(inventory),
        wallet: cloneCreditWallet(walletSpend.wallet),
        walletSpend: walletSpend.spend,
        creditCost: price.creditCost
      },
      201
    );
  };

  const placeInventoryItem = (
    context: ApiAuthContext,
    request: PlaceInventoryItemRequest
  ): ApiResult<InventoryPlacementResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const itemId = request && typeof request.itemId === "string" ? request.itemId : "";
    const inventory = ensureInventory(auth.data.userId, now());
    const ownedItem = inventory.items.find((entry) => entry.itemId === itemId && entry.quantity > 0);

    if (!ownedItem) {
      return fail(404, "inventory_item_not_found", "Inventory item not found.");
    }

    const updatedAt = now();
    const placed = placeInventoryItemInFixedSlot(inventory, itemCatalog, itemId, updatedAt);

    if (!placed.ok) {
      return fail(404, "inventory_item_not_found", "Inventory item not found.");
    }

    const updatedInventory = placed.inventory;

    inventories.set(auth.data.userId, updatedInventory);

    return ok({ inventory: cloneInventory(updatedInventory) });
  };

  const removePlacedItem = (context: ApiAuthContext, itemId: ItemId): ApiResult<InventoryPlacementResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const inventory = ensureInventory(auth.data.userId, now());
    const placedItems = inventory.placedItems.filter((placedItem) => placedItem.itemId !== itemId).map(clonePlacedItem);

    if (placedItems.length === inventory.placedItems.length) {
      return ok({ inventory: cloneInventory(inventory) });
    }

    const updatedInventory: Inventory = {
      ...inventory,
      placedItems,
      updatedAt: now()
    };

    inventories.set(auth.data.userId, updatedInventory);

    return ok({ inventory: cloneInventory(updatedInventory) });
  };

  const clearCareWalkId = (careState: CareState, timestamp: ISODateTime): CareState => {
    const { activeWalkId: _activeWalkId, ...withoutWalk } = careState;

    return {
      ...withoutWalk,
      happiness: Math.min(100, careState.happiness + 6),
      updatedAt: timestamp
    };
  };

  const getCurrentUser = (context: ApiAuthContext): ApiResult<CurrentUserResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const ownedPets = [...pets.values()].filter((pet) => pet.userId === auth.data.userId && pet.lifecycleStatus !== "deleted");
    const ownedJobs = [...generationJobs.values()].filter((job) => job.userId === auth.data.userId);
    const hasActivePet = ownedPets.some((pet) => pet.lifecycleStatus === "active" && !!pet.activeAssetId);
    const hasGenerationStarted = ownedJobs.some(
      (job) => job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled" && job.status !== "expired"
    );
    const onboardingState: CurrentUserResponse["onboardingState"] = hasActivePet
      ? "pet_active"
      : hasGenerationStarted
        ? "generation_started"
        : ownedPets.length > 0
          ? "pet_created"
          : "new";

    return ok({
      userId: auth.data.userId,
      locale: auth.data.locale,
      timezone: auth.data.timezone,
      onboardingState,
      wallet: ensureWallet(auth.data.userId)
    });
  };

  const listPets = (context: ApiAuthContext): ApiResult<ListPetsResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      pets: [...pets.values()]
        .filter((pet) => pet.userId === auth.data.userId && pet.lifecycleStatus !== "deleted")
        .map(clonePet)
    });
  };

  const normalizePetName = (name: string): ApiResult<string> => {
    if (typeof name !== "string") {
      return fail(422, "invalid_pet_name", "Pet name is required.");
    }

    const trimmed = name.trim().replace(/\s+/g, " ");

    if (trimmed.length < 1 || trimmed.length > 24) {
      return fail(422, "invalid_pet_name", "Pet name must be 1 to 24 characters.");
    }

    return ok(trimmed);
  };

  const validatePersonalityTags = (tags: PetProfile["personalityTags"]): ApiResult<PetProfile["personalityTags"]> => {
    if (!Array.isArray(tags) || tags.length < 1 || tags.length > 3) {
      return fail(422, "invalid_personality_tags", "Choose 1 to 3 personality tags.");
    }

    const uniqueTags = [...new Set(tags)];

    if (uniqueTags.length !== tags.length || uniqueTags.some((tag) => !supportedPersonalityTags.has(tag))) {
      return fail(422, "invalid_personality_tags", "Choose supported personality tags.");
    }

    return ok(uniqueTags);
  };

  const normalizeOptionalText = (value: string | undefined, maxLength: number, code: string, messageSafe: string): ApiResult<string | null> => {
    if (value === undefined) {
      return ok(null);
    }

    if (typeof value !== "string") {
      return fail(422, code, messageSafe);
    }

    const trimmed = value.trim().replace(/\s+/g, " ");

    if (trimmed.length > maxLength) {
      return fail(422, code, messageSafe);
    }

    return ok(trimmed || null);
  };

  const createPet = (context: ApiAuthContext, request: CreatePetRequest): ApiResult<PetProfile> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const name = normalizePetName(request.name);

    if (!name.ok) {
      return name;
    }

    if (!supportedPetSpecies.has(request.species)) {
      return fail(422, "invalid_pet_species", "Choose a supported pet species.");
    }

    const personalityTags = validatePersonalityTags(request.personalityTags);

    if (!personalityTags.ok) {
      return personalityTags;
    }

    if (!supportedTalkingStyles.has(request.talkingStyle)) {
      return fail(422, "invalid_talking_style", "Choose a supported talking style.");
    }

    const favoriteThing = normalizeOptionalText(
      request.favoriteThing,
      40,
      "invalid_favorite_thing",
      "Favorite thing must be 40 characters or fewer."
    );

    if (!favoriteThing.ok) {
      return favoriteThing;
    }

    const createdAt = now();
    const pet: PetProfile = {
      id: `pet_mock_${sequence++}`,
      userId: auth.data.userId,
      name: name.data,
      species: request.species,
      personalityTags: personalityTags.data,
      talkingStyle: request.talkingStyle,
      ...(favoriteThing.data ? { favoriteThing: favoriteThing.data } : {}),
      lifecycleStatus: "draft",
      createdAt,
      updatedAt: createdAt
    };

    pets.set(pet.id, pet);

    return ok(clonePet(pet), 201);
  };

  const updatePet = (context: ApiAuthContext, petId: PetId, request: UpdatePetRequest): ApiResult<PetProfile> => {
    const pet = findOwnedPet(context, petId);

    if (!pet.ok) {
      return pet;
    }

    const normalizedName = request.name !== undefined ? normalizePetName(request.name) : null;

    if (normalizedName && !normalizedName.ok) {
      return normalizedName;
    }

    const personalityTags = request.personalityTags !== undefined ? validatePersonalityTags(request.personalityTags) : null;

    if (personalityTags && !personalityTags.ok) {
      return personalityTags;
    }

    if (request.talkingStyle !== undefined && !supportedTalkingStyles.has(request.talkingStyle)) {
      return fail(422, "invalid_talking_style", "Choose a supported talking style.");
    }

    const favoriteThing = normalizeOptionalText(
      request.favoriteThing,
      40,
      "invalid_favorite_thing",
      "Favorite thing must be 40 characters or fewer."
    );

    if (!favoriteThing.ok) {
      return favoriteThing;
    }

    const memoryNote = normalizeOptionalText(
      request.memoryNote,
      240,
      "invalid_memory_note",
      "Memory note must be 240 characters or fewer."
    );

    if (!memoryNote.ok) {
      return memoryNote;
    }

    const updatedAt = now();
    const updatedPet: PetProfile = {
      ...pet.data,
      ...(normalizedName?.ok ? { name: normalizedName.data } : {}),
      ...(personalityTags?.ok ? { personalityTags: personalityTags.data } : {}),
      ...(request.talkingStyle !== undefined ? { talkingStyle: request.talkingStyle } : {}),
      updatedAt
    };

    if (request.favoriteThing !== undefined) {
      if (favoriteThing.data) {
        updatedPet.favoriteThing = favoriteThing.data;
      } else {
        delete updatedPet.favoriteThing;
      }
    }

    if (request.memoryNote !== undefined) {
      if (memoryNote.data) {
        updatedPet.memoryNote = memoryNote.data;
      } else {
        delete updatedPet.memoryNote;
      }
    }

    pets.set(updatedPet.id, updatedPet);

    return ok(clonePet(updatedPet));
  };

  const deletePet = (context: ApiAuthContext, petId: PetId): ApiResult<{ deletedPetId: PetId; deletedAt: ISODateTime }> => {
    const pet = findOwnedPet(context, petId);

    if (!pet.ok) {
      return pet;
    }

    const deletedAt = now();
    const deletedPet: PetProfile = {
      ...pet.data,
      lifecycleStatus: "deleted",
      updatedAt: deletedAt
    };

    pets.set(deletedPet.id, deletedPet);
    careStates.delete(petId);
    recentReactionRecords.delete(petId);

    for (const photo of photos.values()) {
      if (photo.petId !== petId || photo.userId !== pet.data.userId || photo.status === "deleted") {
        continue;
      }

      photos.set(photo.id, {
        ...photo,
        status: "deleted",
        deletedAt,
        updatedAt: deletedAt
      });
    }

    for (const walk of walkSessions.values()) {
      if (walk.petId !== petId || walk.userId !== pet.data.userId || walk.status === "claimed" || walk.status === "expired") {
        continue;
      }

      walkSessions.set(walk.id, {
        ...walk,
        status: "expired",
        updatedAt: deletedAt
      });
    }

    return ok({ deletedPetId: petId, deletedAt });
  };

  const findOwnedPhoto = (context: ApiAuthContext, photoId: PhotoId): ApiResult<OriginalPhotoRecord> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const photo = photos.get(photoId);

    if (!photo || photo.userId !== auth.data.userId || photo.status === "deleted") {
      return fail(404, "photo_not_found", "Photo not found.");
    }

    return ok(clonePhoto(photo));
  };

  const findOwnedGenerationJob = (context: ApiAuthContext, jobId: GenerationJobId): ApiResult<GenerationJob> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const job = generationJobs.get(jobId);

    if (!job || job.userId !== auth.data.userId) {
      return fail(404, "generation_job_not_found", "Generation job not found.");
    }

    return ok(cloneGenerationJob(job));
  };

  const getCareState = (context: ApiAuthContext, petId: PetId): ApiResult<CareState> => {
    const pet = findOwnedPet(context, petId);

    if (!pet.ok) {
      return pet;
    }

    return ok(projectCareStateForTime(ensureCareState(pet.data), now()));
  };

  const getRelationshipState = (context: ApiAuthContext, petId: PetId): ApiResult<RelationshipState> => {
    const pet = findOwnedPet(context, petId);

    if (!pet.ok) {
      return pet;
    }

    return ok(ensureRelationshipState(pet.data));
  };

  const getItemCatalog = (context: ApiAuthContext): ApiResult<ItemCatalogResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      items: itemCatalog.map(cloneItem)
    });
  };

  const getInventory = (context: ApiAuthContext): ApiResult<Inventory> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok(ensureInventory(auth.data.userId));
  };

  const getReactionCatalog = (context: ApiAuthContext): ApiResult<{ locale: Locale; version: string; rules: ReactionRule[] }> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      locale: auth.data.locale,
      version: starterReactionCatalogVersion,
      rules: starterReactionRules.filter((rule) => rule.locale === auth.data.locale).map(cloneReactionRule)
    });
  };

  const findBlockingWalkForPet = (userId: UserId, petId: PetId): WalkSession | null => {
    for (const walk of walkSessions.values()) {
      if (
        walk.userId === userId &&
        walk.petId === petId &&
        (walk.status === "walking" || walk.status === "returned")
      ) {
        return cloneWalkSession(walk);
      }
    }

    return null;
  };

  const startWalk = (context: ApiAuthContext, petId: PetId): ApiResult<StartWalkResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = findOwnedPet(context, petId);

    if (!pet.ok) {
      return pet;
    }

    const existingWalk = findBlockingWalkForPet(auth.data.userId, petId);

    if (existingWalk) {
      return fail(409, "walk_already_active", "Finish the current walk before starting another.");
    }

    const startedAt = now();
    const returnAt = addMs(startedAt, MOCK_WALK_DURATION_MS);
    const walk: WalkSession = {
      id: `walk_mock_${sequence++}`,
      userId: auth.data.userId,
      petId,
      status: "walking",
      startedAt,
      returnAt,
      rewardItemIds: [WALK_REWARD_ITEM_ID],
      discoveryLine: auth.data.locale === "ko-KR" ? "작은 잎사귀가 네 생각을 했대." : "A tiny leaf thought of you.",
      energyCost: 12,
      createdAt: startedAt,
      updatedAt: startedAt
    };
    const careResult = applyLocalCareAction(ensureCareState(pet.data, startedAt), {
      action: "walk",
      occurredAt: startedAt
    });
    const careState: CareState = {
      ...careResult.nextState,
      activeWalkId: walk.id
    };
    const relationshipState = applyRelationshipCareAction(ensureRelationshipState(pet.data, startedAt), "walk", startedAt);

    walkSessions.set(walk.id, walk);
    careStates.set(petId, careState);
    relationshipStates.set(petId, relationshipState);
    const reaction = selectReactionForPet(auth.data, pet.data, careState, startedAt, {
      recentAction: "walk",
      walkStatus: "walking"
    });

    return ok({
      walk: cloneWalkSession(walk),
      careState: cloneCareState(careState),
      relationshipState: cloneRelationshipState(relationshipState),
      reaction
    }, 201);
  };

  const performCareAction = (
    context: ApiAuthContext,
    petId: PetId,
    request: CareActionRequest
  ): ApiResult<CareActionResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = findOwnedPet(context, petId);

    if (!pet.ok) {
      return pet;
    }

    if (!supportedCareActions.has(request.action)) {
      return fail(422, "invalid_care_action", "Choose a supported care action.");
    }

    if (!request.occurredAt || Number.isNaN(new Date(request.occurredAt).getTime())) {
      return fail(422, "invalid_occurred_at", "Care action time is invalid.");
    }

    let consumedInventory: Inventory | null = null;

    if (request.action === "treat") {
      const inventory = ensureInventory(auth.data.userId, request.occurredAt);
      const treatItemId = request.itemId ?? getAvailableTreatItemId(inventory, itemCatalog);
      const treatItem = treatItemId ? itemCatalog.find((item) => item.id === treatItemId) : null;

      if (!treatItemId || !treatItem) {
        return request.itemId
          ? fail(404, "inventory_item_not_found", "Inventory item not found.")
          : fail(404, "treat_item_not_found", "Add a treat before using this action.");
      }

      if (!isTreatInventoryItem(treatItem)) {
        return fail(422, "invalid_treat_item", "Choose a treat item for this action.");
      }

      const consumed = consumeInventoryItem(inventory, treatItemId, request.occurredAt);

      if (!consumed.ok) {
        return fail(404, "inventory_item_not_found", "Inventory item not found.");
      }

      consumedInventory = consumed.inventory;
    } else if (request.itemId) {
      const inventory = ensureInventory(auth.data.userId, request.occurredAt);
      const ownedItem = inventory.items.find((entry) => entry.itemId === request.itemId && entry.quantity > 0);

      if (!ownedItem) {
        return fail(404, "inventory_item_not_found", "Inventory item not found.");
      }
    }

    if (request.action === "walk") {
      const started = startWalk(context, petId);

      if (!started.ok) {
        return started;
      }

      const reaction = recentReactionRecords.get(petId)?.[0] ?? null;

      return ok({
        careState: started.data.careState,
        relationshipState: started.data.relationshipState,
        inventory: null,
        reaction: reaction
          ? {
              ruleId: reaction.ruleId,
              category: "walk_start",
              line: reaction.line,
              animation: "walk_out",
              priority: 82
            }
          : null,
        reward: null
      });
    }

    const result = applyLocalCareAction(ensureCareState(pet.data, request.occurredAt), request);
    const wateredGarden =
      request.action === "water_garden" ? waterGardenInventory(ensureInventory(auth.data.userId, request.occurredAt), request.occurredAt) : null;
    const bloomRewardSummary = summarizePlantBloomRewards(wateredGarden?.bloomRewards ?? []);
    const relationshipState =
      bloomRewardSummary.bondXp > 0
        ? grantRelationshipBondXp(
            applyRelationshipCareAction(ensureRelationshipState(pet.data, request.occurredAt), request.action, request.occurredAt),
            bloomRewardSummary.bondXp,
            request.occurredAt
          )
        : applyRelationshipCareAction(ensureRelationshipState(pet.data, request.occurredAt), request.action, request.occurredAt);
    const wallet =
      bloomRewardSummary.bonusCredits > 0
        ? grantCreditWalletValue(ensureWallet(auth.data.userId, request.occurredAt), { bonusCredits: bloomRewardSummary.bonusCredits }, request.occurredAt)
        : null;
    const inventory = request.action === "water_garden" ? wateredGarden?.inventory ?? null : consumedInventory;
    const reaction = selectReactionForPet(auth.data, pet.data, result.nextState, request.occurredAt, {
      recentAction: request.action
    });

    careStates.set(petId, result.nextState);
    relationshipStates.set(petId, relationshipState);

    if (inventory) {
      inventories.set(auth.data.userId, inventory);
    }

    if (wallet) {
      wallets.set(auth.data.userId, wallet);
    }

    return ok({
      careState: cloneCareState(result.nextState),
      relationshipState: cloneRelationshipState(relationshipState),
      inventory: inventory ? cloneInventory(inventory) : null,
      ...(wallet ? { wallet: cloneCreditWallet(wallet) } : {}),
      reaction,
      reward: wateredGarden?.bloomRewards[0] ?? null
    });
  };

  const claimWalkReward = (context: ApiAuthContext, walkId: WalkSessionId): ApiResult<ClaimWalkResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const existingWalk = walkSessions.get(walkId);

    if (!existingWalk || existingWalk.userId !== auth.data.userId) {
      return fail(404, "walk_not_found", "Walk not found.");
    }

    const claimedAt = now();
    const returnedWalk: WalkSession =
      existingWalk.status === "walking" && new Date(claimedAt).getTime() >= new Date(existingWalk.returnAt).getTime()
        ? {
            ...existingWalk,
            status: "returned",
            updatedAt: claimedAt
          }
        : existingWalk;

    if (returnedWalk.status === "walking") {
      return fail(409, "walk_not_returned", "Walk reward is not ready yet.");
    }

    if (returnedWalk.status === "claimed") {
      return fail(409, "walk_already_claimed", "Walk reward has already been claimed.");
    }

    if (returnedWalk.status === "expired") {
      return fail(409, "walk_expired", "Walk reward expired.");
    }

    const pet = findOwnedPet(context, returnedWalk.petId);

    if (!pet.ok) {
      return pet;
    }

    const rewardItemId = returnedWalk.rewardItemIds[0] ?? WALK_REWARD_ITEM_ID;
    const inventory = grantInventoryItem(ensureInventory(auth.data.userId, claimedAt), rewardItemId, claimedAt);
    const careState = clearCareWalkId(ensureCareState(pet.data, claimedAt), claimedAt);
    const relationshipState = ensureRelationshipState(pet.data, claimedAt);
    const claimedWalk: WalkSession = {
      ...returnedWalk,
      status: "claimed",
      claimedAt,
      updatedAt: claimedAt
    };
    const reaction = selectReactionForPet(auth.data, pet.data, careState, claimedAt, {
      eventContext: "walk_reward_claimed",
      walkStatus: "claimed"
    });

    inventories.set(auth.data.userId, inventory);
    careStates.set(pet.data.id, careState);
    walkSessions.set(walkId, claimedWalk);

    return ok({
      walk: cloneWalkSession(claimedWalk),
      inventory: cloneInventory(inventory),
      relationshipState: cloneRelationshipState(relationshipState),
      reaction
    });
  };

  const hasActiveEntitlement = (context: ApiAuthContext, key: EntitlementKey): ApiResult<{ active: boolean }> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const checkedAt = now();
    const active = [...entitlements.values()].some((entitlement) => {
      if (entitlement.userId !== auth.data.userId || entitlement.key !== key || entitlement.status !== "active") {
        return false;
      }

      if (new Date(entitlement.startsAt).getTime() > new Date(checkedAt).getTime()) {
        return false;
      }

      return !entitlement.endsAt || new Date(entitlement.endsAt).getTime() > new Date(checkedAt).getTime();
    });

    return ok({ active });
  };

  const listCommerceProducts = (context: ApiAuthContext): ApiResult<CommerceProductsResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      products: commerceProducts.map(cloneCommerceProduct)
    });
  };

  const listEntitlements = (context: ApiAuthContext): ApiResult<EntitlementsResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      entitlements: [...entitlements.values()]
        .filter((entitlement) => entitlement.userId === auth.data.userId)
        .map(cloneEntitlement)
    });
  };

  const requireActiveEntitlement = (context: ApiAuthContext, key: EntitlementKey): ApiResult<{ key: EntitlementKey }> => {
    const entitlement = hasActiveEntitlement(context, key);

    if (!entitlement.ok) {
      return entitlement;
    }

    if (!entitlement.data.active) {
      return fail(403, "entitlement_required", "Plus pass required for longer chat.");
    }

    return ok({ key });
  };

  const emptyWalletSpend = (): CreditWalletSpendBreakdown => ({
    freeChatTicketsSpent: 0,
    bonusCreditsSpent: 0,
    creditsSpent: 0
  });

  const resolvePremiumChatAccess = (
    context: ApiAuthContext,
    auth: { userId: UserId },
    checkedAt: ISODateTime
  ): ApiResult<{ mode: "entitlement" | "wallet"; wallet: CreditWallet }> => {
    const entitlement = hasActiveEntitlement(context, premiumChatGate.requiredEntitlement);

    if (!entitlement.ok) {
      return entitlement;
    }

    const wallet = ensureWallet(auth.userId, checkedAt);

    if (entitlement.data.active) {
      return ok({
        mode: "entitlement",
        wallet
      });
    }

    if (!canSpendPremiumChatTurn(wallet)) {
      return fail(403, "premium_chat_payment_required", "Use a chat ticket, credit, or Plus pass to talk.");
    }

    return ok({
      mode: "wallet",
      wallet
    });
  };

  const buildGrantedEntitlement = (
    userId: UserId,
    product: CommerceProduct,
    transactionId: string,
    source: Entitlement["source"],
    grantedAt: ISODateTime
  ): Entitlement => ({
    id: `ent_${product.entitlementKey}_${transactionId.replace(/[^A-Za-z0-9_-]/g, "_")}`,
    userId,
    key: product.entitlementKey,
    status: "active",
    source,
    productId: product.productId,
    startsAt: grantedAt,
    ...(product.grantType === "subscription" ? { endsAt: addMs(grantedAt, subscriptionDurationMs) } : {}),
    ledgerEntryId: `ledger_${transactionId.replace(/[^A-Za-z0-9_-]/g, "_")}`,
    metadata: {
      serverVerified: true,
      transactionId,
      grantType: product.grantType
    },
    createdAt: grantedAt,
    updatedAt: grantedAt
  });

  const validatePurchasePayload = (
    request: PurchaseVerificationRequest | { platform: "ios" | "android"; transactionId: string; receiptHash?: string; productId?: string }
  ): ApiResult<{ product?: CommerceProduct }> => {
    if (request.platform !== "ios" && request.platform !== "android") {
      return fail(422, "unsupported_purchase_platform", "Purchase platform is not supported.");
    }

    if (!transactionIdPattern.test(request.transactionId)) {
      return fail(422, "invalid_transaction_id", "Purchase transaction metadata is invalid.");
    }

    if ("receiptHash" in request && request.receiptHash !== undefined && !contentHashPattern.test(request.receiptHash)) {
      return fail(422, "invalid_receipt_hash", "Purchase receipt metadata is invalid.");
    }

    if (
      "storeVerificationToken" in request &&
      request.storeVerificationToken !== undefined &&
      !isValidStoreVerificationToken(request.storeVerificationToken)
    ) {
      return fail(422, "invalid_store_verification_token", "Purchase verification metadata is invalid.");
    }

    if ("productId" in request && request.productId !== undefined) {
      const product = commerceProductById.get(request.productId);

      if (!product) {
        return fail(422, "unknown_product", "Purchase product is not available.");
      }

      return ok({ product });
    }

    return ok({});
  };

  const validatePurchaseReceiptRevocationPayload = (
    request: PurchaseReceiptRevocationRequest
  ): ApiResult<{ product?: CommerceProduct }> => {
    if (request.platform !== "ios" && request.platform !== "android") {
      return fail(422, "unsupported_purchase_platform", "Purchase platform is not supported.");
    }

    if (!contentHashPattern.test(request.receiptHash)) {
      return fail(422, "invalid_receipt_hash", "Purchase receipt metadata is invalid.");
    }

    if (
      request.reason !== "refund" &&
      request.reason !== "chargeback" &&
      request.reason !== "developer_revoke" &&
      request.reason !== "store_revoke"
    ) {
      return fail(422, "invalid_revocation_reason", "Purchase revocation metadata is invalid.");
    }

    if (request.productId !== undefined) {
      const product = commerceProductById.get(request.productId);

      if (!product) {
        return fail(422, "unknown_product", "Purchase product is not available.");
      }

      return ok({ product });
    }

    return ok({});
  };

  const purchaseVerificationUnavailable = <T>(): ApiResult<T> =>
    fail(503, "purchase_verification_unavailable", "Purchase verification is not available yet.");

  const mapPurchaseVerifierError = <T>(error: {
    status: 400 | 409 | 422 | 503;
    code: string;
    messageSafe: string;
  }): ApiResult<T> => fail(error.status, error.code, error.messageSafe);

  const assertVerifiedPurchaseMatchesRequest = (
    request: PurchaseVerificationRequest,
    purchase: VerifiedStorePurchase
  ): ApiResult<{ purchase: VerifiedStorePurchase; product: CommerceProduct }> => {
    if (
      purchase.platform !== request.platform ||
      purchase.productId !== request.productId ||
      purchase.transactionId !== request.transactionId ||
      purchase.receiptHash !== request.receiptHash
    ) {
      return fail(409, "purchase_verification_mismatch", "Purchase verification result did not match the request.");
    }

    const validation = validatePurchasePayload(purchase);

    if (!validation.ok) {
      return validation;
    }

    const product = validation.data.product;

    if (!product) {
      return fail(422, "unknown_product", "Purchase product is not available.");
    }

    return ok({ purchase, product });
  };

  const assertVerifiedRestorePurchase = (
    platform: RestorePurchasesRequest["platform"],
    allowedTransactionIds: Set<string>,
    expectedReceiptHashes: Map<string, string>,
    purchase: VerifiedStorePurchase
  ): ApiResult<{ purchase: VerifiedStorePurchase; product: CommerceProduct }> => {
    const expectedReceiptHash = expectedReceiptHashes.get(purchase.transactionId);

    if (
      purchase.platform !== platform ||
      !allowedTransactionIds.has(purchase.transactionId) ||
      (expectedReceiptHash !== undefined && purchase.receiptHash !== expectedReceiptHash)
    ) {
      return fail(409, "purchase_verification_mismatch", "Purchase verification result did not match the request.");
    }

    const validation = validatePurchasePayload(purchase);

    if (!validation.ok) {
      return validation;
    }

    const product = validation.data.product;

    if (!product) {
      return fail(422, "unknown_product", "Purchase product is not available.");
    }

    return ok({ purchase, product });
  };

  const normalizeRestorePurchasesRequest = (
    request: RestorePurchasesRequest
  ): ApiResult<{
    request: RestorePurchasesRequest;
    allowedTransactionIds: Set<string>;
    expectedReceiptHashes: Map<string, string>;
  }> => {
    if (request.platform !== "ios" && request.platform !== "android") {
      return fail(422, "unsupported_purchase_platform", "Purchase platform is not supported.");
    }

    const allowedTransactionIds = new Set<string>();
    const expectedReceiptHashes = new Map<string, string>();
    const purchasesByTransactionId = new Map<string, NonNullable<RestorePurchasesRequest["purchases"]>[number]>();

    for (const transactionId of request.transactionIds) {
      if (!transactionIdPattern.test(transactionId)) {
        return fail(422, "invalid_transaction_id", "Purchase transaction metadata is invalid.");
      }

      allowedTransactionIds.add(transactionId);
    }

    for (const purchase of request.purchases ?? []) {
      const validation = validatePurchasePayload({
        platform: request.platform,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        receiptHash: purchase.receiptHash,
        storeVerificationToken: purchase.storeVerificationToken
      });

      if (!validation.ok) {
        return validation;
      }

      if (!validation.data.product) {
        return fail(422, "unknown_product", "Purchase product is not available.");
      }

      allowedTransactionIds.add(purchase.transactionId);
      expectedReceiptHashes.set(purchase.transactionId, purchase.receiptHash);
      purchasesByTransactionId.set(purchase.transactionId, purchase);
    }

    const purchases = [...purchasesByTransactionId.values()];

    return ok({
      request: {
        platform: request.platform,
        transactionIds: [...allowedTransactionIds],
        ...(purchases.length > 0 ? { purchases } : {})
      },
      allowedTransactionIds,
      expectedReceiptHashes
    });
  };

  const grantWalletForConsumablePurchase = (
    userId: UserId,
    product: CommerceProduct,
    grantedAt: ISODateTime
  ): CreditWallet | null => {
    const walletGrant = getConsumableWalletGrant(product);

    if (!walletGrant) {
      return null;
    }

    const wallet = grantCreditWalletValue(ensureWallet(userId, grantedAt), walletGrant, grantedAt);

    wallets.set(userId, wallet);

    return cloneCreditWallet(wallet);
  };

  const grantVerifiedPurchase = (
    auth: { userId: UserId },
    purchase: VerifiedStorePurchase,
    product: CommerceProduct,
    source: Extract<Entitlement["source"], "purchase" | "restore">
  ): ApiResult<{ entitlement: Entitlement; wallet: CreditWallet | null }> => {
    const existingLedgerRecord = purchaseLedger.get(purchase.transactionId);
    const grantedAt = purchase.verifiedAt ?? now();

    if (existingLedgerRecord && existingLedgerRecord.userId !== auth.userId) {
      return fail(409, "purchase_belongs_to_another_user", "Purchase is already linked to another account.");
    }

    if (existingLedgerRecord && existingLedgerRecord.platform !== purchase.platform) {
      return fail(409, "purchase_verification_mismatch", "Purchase verification result did not match the request.");
    }

    if (existingLedgerRecord) {
      const existingEntitlement = entitlements.get(existingLedgerRecord.entitlementId);

      if (!existingEntitlement) {
        return fail(409, "entitlement_ledger_inconsistent", "Purchase entitlement could not be restored.");
      }

      if (source === "restore" && existingEntitlement.status !== "revoked") {
        const restoredEntitlement: Entitlement = {
          ...existingEntitlement,
          source: "restore",
          status: "active",
          updatedAt: grantedAt,
          metadata: {
            ...existingEntitlement.metadata,
            restored: true,
            storeEnvironment: purchase.environment
          }
        };
        const restoredLedgerRecord: PurchaseLedgerRecord = {
          ...existingLedgerRecord,
          status: "restored",
          restoredAt: grantedAt
        };

        entitlements.set(restoredEntitlement.id, restoredEntitlement);
        purchaseLedger.set(purchase.transactionId, restoredLedgerRecord);

        return ok({
          entitlement: cloneEntitlement(restoredEntitlement),
          wallet: getConsumableWalletGrant(product) ? ensureWallet(auth.userId, grantedAt) : null
        });
      }

      return ok({
        entitlement: cloneEntitlement(existingEntitlement),
        wallet: getConsumableWalletGrant(product) ? ensureWallet(auth.userId, grantedAt) : null
      });
    }

    const baseEntitlement = buildGrantedEntitlement(auth.userId, product, purchase.transactionId, source, grantedAt);
    const entitlement: Entitlement = {
      ...baseEntitlement,
      metadata: {
        ...baseEntitlement.metadata,
        storeEnvironment: purchase.environment
      }
    };
    const ledgerRecord: PurchaseLedgerRecord = {
      ledgerEntryId: entitlement.ledgerEntryId,
      userId: auth.userId,
      platform: purchase.platform,
      productId: purchase.productId,
      transactionId: purchase.transactionId,
      receiptHash: purchase.receiptHash,
      entitlementId: entitlement.id,
      status: source === "restore" ? "restored" : "verified",
      verifiedAt: grantedAt,
      ...(source === "restore" ? { restoredAt: grantedAt } : {})
    };

    entitlements.set(entitlement.id, entitlement);
    purchaseLedger.set(purchase.transactionId, ledgerRecord);

    return ok(
      {
        entitlement: cloneEntitlement(entitlement),
        wallet: grantWalletForConsumablePurchase(auth.userId, product, grantedAt)
      },
      201
    );
  };

  const verifyPurchase = (
    context: ApiAuthContext,
    request: PurchaseVerificationRequest
  ): ApiResult<PurchaseVerificationResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    if (purchaseVerifier) {
      return purchaseVerificationUnavailable();
    }

    if (!allowMockPurchaseVerification) {
      return purchaseVerificationUnavailable();
    }

    const validation = validatePurchasePayload(request);

    if (!validation.ok) {
      return validation;
    }

    const product = validation.data.product;

    if (!product) {
      return fail(422, "unknown_product", "Purchase product is not available.");
    }

    const granted = grantVerifiedPurchase(
      auth.data,
      {
        platform: request.platform,
        productId: request.productId,
        transactionId: request.transactionId,
        receiptHash: request.receiptHash,
        verifiedAt: now(),
        environment: "unknown"
      },
      product,
      "purchase"
    );

    if (!granted.ok) {
      return granted;
    }

    return ok(
      {
        entitlements: [granted.data.entitlement],
        ...(granted.data.wallet ? { wallet: granted.data.wallet } : {}),
        serverVerified: true
      },
      granted.status
    );
  };

  const verifyPurchaseWithStoreVerifier = async (
    context: ApiAuthContext,
    request: PurchaseVerificationRequest
  ): Promise<ApiResult<PurchaseVerificationResponse>> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const validation = validatePurchasePayload(request);

    if (!validation.ok) {
      return validation;
    }

    if (!validation.data.product) {
      return fail(422, "unknown_product", "Purchase product is not available.");
    }

    if (!purchaseVerifier) {
      return verifyPurchase(context, request);
    }

    const verified = await purchaseVerifier.verifyPurchase({
      ...request,
      userId: auth.data.userId,
      requestedAt: now()
    });

    if (!verified.ok) {
      return mapPurchaseVerifierError(verified.error);
    }

    const matchedPurchase = assertVerifiedPurchaseMatchesRequest(request, verified.purchase);

    if (!matchedPurchase.ok) {
      return matchedPurchase;
    }

    const granted = grantVerifiedPurchase(auth.data, matchedPurchase.data.purchase, matchedPurchase.data.product, "purchase");

    if (!granted.ok) {
      return granted;
    }

    return ok(
      {
        entitlements: [granted.data.entitlement],
        ...(granted.data.wallet ? { wallet: granted.data.wallet } : {}),
        serverVerified: true
      },
      granted.status
    );
  };

  const restorePurchases = (
    context: ApiAuthContext,
    request: RestorePurchasesRequest
  ): ApiResult<PurchaseVerificationResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    if (purchaseVerifier) {
      return purchaseVerificationUnavailable();
    }

    if (!allowMockPurchaseVerification) {
      return purchaseVerificationUnavailable();
    }

    const normalized = normalizeRestorePurchasesRequest(request);

    if (!normalized.ok) {
      return normalized;
    }

    const restoredAt = now();
    const restoredEntitlements: Entitlement[] = [];
    let latestWallet: CreditWallet | null = null;

    for (const transactionId of normalized.data.request.transactionIds) {
      const ledgerRecord = purchaseLedger.get(transactionId);

      if (!ledgerRecord || ledgerRecord.userId !== auth.data.userId || ledgerRecord.platform !== request.platform) {
        continue;
      }

      const entitlement = entitlements.get(ledgerRecord.entitlementId);

      if (!entitlement || entitlement.status === "revoked") {
        continue;
      }

      const restoredEntitlement: Entitlement = {
        ...entitlement,
        source: "restore",
        status: "active",
        updatedAt: restoredAt,
        metadata: {
          ...entitlement.metadata,
          restored: true
        }
      };
      const restoredLedgerRecord: PurchaseLedgerRecord = {
        ...ledgerRecord,
        status: "restored",
        restoredAt
      };

      entitlements.set(restoredEntitlement.id, restoredEntitlement);
      purchaseLedger.set(transactionId, restoredLedgerRecord);
      restoredEntitlements.push(cloneEntitlement(restoredEntitlement));

      const product = commerceProductById.get(ledgerRecord.productId);

      if (product && getConsumableWalletGrant(product)) {
        latestWallet = ensureWallet(auth.data.userId, restoredAt);
      }
    }

    return ok({
      entitlements: restoredEntitlements,
      ...(latestWallet ? { wallet: latestWallet } : {}),
      serverVerified: true
    });
  };

  const restorePurchasesWithStoreVerifier = async (
    context: ApiAuthContext,
    request: RestorePurchasesRequest
  ): Promise<ApiResult<PurchaseVerificationResponse>> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const normalized = normalizeRestorePurchasesRequest(request);

    if (!normalized.ok) {
      return normalized;
    }

    if (!purchaseVerifier) {
      return restorePurchases(context, normalized.data.request);
    }

    if (!purchaseVerifier.restorePurchases) {
      return purchaseVerificationUnavailable();
    }

    const restored = await purchaseVerifier.restorePurchases({
      ...normalized.data.request,
      userId: auth.data.userId,
      requestedAt: now()
    });

    if (!restored.ok) {
      return mapPurchaseVerifierError(restored.error);
    }

    const restoredEntitlements: Entitlement[] = [];
    let latestWallet: CreditWallet | null = null;

    for (const purchase of restored.purchases) {
      const matchedPurchase = assertVerifiedRestorePurchase(
        normalized.data.request.platform,
        normalized.data.allowedTransactionIds,
        normalized.data.expectedReceiptHashes,
        purchase
      );

      if (!matchedPurchase.ok) {
        return matchedPurchase;
      }

      const granted = grantVerifiedPurchase(auth.data, matchedPurchase.data.purchase, matchedPurchase.data.product, "restore");

      if (!granted.ok) {
        return granted;
      }

      restoredEntitlements.push(granted.data.entitlement);

      if (granted.data.wallet) {
        latestWallet = granted.data.wallet;
      }
    }

    return ok({
      entitlements: restoredEntitlements,
      ...(latestWallet ? { wallet: latestWallet } : {}),
      serverVerified: true
    });
  };

  const revokeLedgerRecord = (
    ledgerRecord: PurchaseLedgerRecord,
    reason: PurchaseRevocationRequest["reason"]
  ): ApiResult<PurchaseRevocationResponse> => {
    const entitlement = entitlements.get(ledgerRecord.entitlementId);

    if (!entitlement) {
      return fail(409, "entitlement_ledger_inconsistent", "Purchase entitlement could not be restored.");
    }

    const revokedAt = now();
    const revokedEntitlement: Entitlement = {
      ...entitlement,
      status: "revoked",
      updatedAt: revokedAt,
      metadata: {
        ...entitlement.metadata,
        revoked: true,
        revocationReason: reason
      }
    };
    const revokedLedgerRecord: PurchaseLedgerRecord = {
      ...ledgerRecord,
      status: "revoked",
      revokedAt,
      revocationReason: reason
    };

    entitlements.set(revokedEntitlement.id, revokedEntitlement);
    purchaseLedger.set(ledgerRecord.transactionId, revokedLedgerRecord);

    return ok({
      entitlement: cloneEntitlement(revokedEntitlement),
      revoked: true
    });
  };

  const revokePurchase = (request: PurchaseRevocationRequest): ApiResult<PurchaseRevocationResponse> => {
    const validation = validatePurchasePayload(request);

    if (!validation.ok) {
      return validation;
    }

    if (
      request.reason !== "refund" &&
      request.reason !== "chargeback" &&
      request.reason !== "developer_revoke" &&
      request.reason !== "store_revoke"
    ) {
      return fail(422, "invalid_revocation_reason", "Purchase revocation metadata is invalid.");
    }

    const ledgerRecord = purchaseLedger.get(request.transactionId);

    if (!ledgerRecord || ledgerRecord.platform !== request.platform) {
      return fail(404, "purchase_not_found", "Purchase not found.");
    }

    return revokeLedgerRecord(ledgerRecord, request.reason);
  };

  const revokePurchaseByReceiptHash = (request: PurchaseReceiptRevocationRequest): ApiResult<PurchaseRevocationResponse> => {
    const validation = validatePurchaseReceiptRevocationPayload(request);

    if (!validation.ok) {
      return validation;
    }

    const ledgerRecord = [...purchaseLedger.values()].find(
      (candidate) =>
        candidate.platform === request.platform &&
        candidate.receiptHash === request.receiptHash &&
        (request.productId === undefined || candidate.productId === request.productId)
    );

    if (!ledgerRecord) {
      return fail(404, "purchase_not_found", "Purchase not found.");
    }

    return revokeLedgerRecord(ledgerRecord, request.reason);
  };

  const storageSigningUnavailable = <T>(): ApiResult<T> =>
    fail(503, "storage_signing_unavailable", "Private storage signing is not available yet.");

  const mapStorageSignerError = <T>(error: {
    status: 403 | 404 | 422 | 503;
    code: string;
    messageSafe: string;
  }): ApiResult<T> => fail(error.status, error.code, error.messageSafe);

  const isRenderableSignedStorageUrl = (value: string): boolean =>
    /^https:\/\//i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value);

  const issuePhotoUploadUrl = (
    context: ApiAuthContext,
    request: PhotoUploadUrlRequest
  ): ApiResult<PhotoUploadUrlResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = findOwnedPet(context, request.petId);

    if (!pet.ok) {
      return pet;
    }

    if (!isSupportedSourcePhotoContentType(request.contentType)) {
      return fail(422, "unsupported_photo_type", "Choose a JPEG, PNG, or WebP pet photo.");
    }

    if (!Number.isInteger(request.byteSize) || request.byteSize <= 0) {
      return fail(422, "invalid_photo_size", "Photo size must be known before upload.");
    }

    if (request.byteSize > MAX_SOURCE_PHOTO_BYTES) {
      return fail(422, "photo_too_large", "Choose an image under 10 MB with your pet clearly visible.");
    }

    if (privateStorageSigner || !allowMockStorageSigning) {
      return storageSigningUnavailable();
    }

    const issuedAt = now();
    const expiresAt = addMs(issuedAt, UPLOAD_URL_TTL_MS);
    const photoId = `photo_mock_${sequence++}`;
    const uploadUrl = `mock-signed-upload://private/${auth.data.userId}/${request.petId}/${photoId}?expires_at=${encodeURIComponent(expiresAt)}`;
    const photo: OriginalPhotoRecord = {
      id: photoId,
      userId: auth.data.userId,
      petId: request.petId,
      contentType: request.contentType,
      byteSize: request.byteSize,
      status: "upload_url_issued",
      uploadUrl,
      expiresAt,
      createdAt: issuedAt,
      updatedAt: issuedAt
    };

    photos.set(photoId, photo);

    return ok(
      {
        photoId,
        uploadUrl,
        uploadMethod: "PUT",
        uploadHeaders: {
          "Content-Type": request.contentType
        },
        expiresAt,
        maxByteSize: MAX_SOURCE_PHOTO_BYTES
      },
      201
    );
  };

  const issuePhotoUploadUrlWithStorageSigner = async (
    context: ApiAuthContext,
    request: PhotoUploadUrlRequest
  ): Promise<ApiResult<PhotoUploadUrlResponse>> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = findOwnedPet(context, request.petId);

    if (!pet.ok) {
      return pet;
    }

    if (!isSupportedSourcePhotoContentType(request.contentType)) {
      return fail(422, "unsupported_photo_type", "Choose a JPEG, PNG, or WebP pet photo.");
    }

    if (!Number.isInteger(request.byteSize) || request.byteSize <= 0) {
      return fail(422, "invalid_photo_size", "Photo size must be known before upload.");
    }

    if (request.byteSize > MAX_SOURCE_PHOTO_BYTES) {
      return fail(422, "photo_too_large", "Choose an image under 10 MB with your pet clearly visible.");
    }

    if (!privateStorageSigner) {
      return issuePhotoUploadUrl(context, request);
    }

    const issuedAt = now();
    const expiresAt = addMs(issuedAt, UPLOAD_URL_TTL_MS);
    const photoId = `photo_mock_${sequence++}`;
    const signedUpload = await privateStorageSigner.createOriginalPhotoUpload({
      userId: auth.data.userId,
      petId: request.petId,
      photoId,
      contentType: request.contentType,
      byteSize: request.byteSize,
      expiresAt,
      maxByteSize: MAX_SOURCE_PHOTO_BYTES
    });

    if (!signedUpload.ok) {
      return mapStorageSignerError(signedUpload.error);
    }

    if (!isRenderableSignedStorageUrl(signedUpload.signed.uploadUrl)) {
      return fail(503, "storage_signing_invalid_result", "Private storage signing is not available yet.");
    }

    const signedExpiresAt = signedUpload.signed.expiresAt ?? expiresAt;
    const photo: OriginalPhotoRecord = {
      id: photoId,
      userId: auth.data.userId,
      petId: request.petId,
      contentType: request.contentType,
      byteSize: request.byteSize,
      status: "upload_url_issued",
      uploadUrl: signedUpload.signed.uploadUrl,
      ...(signedUpload.signed.storageUri ? { storageUri: signedUpload.signed.storageUri } : {}),
      expiresAt: signedExpiresAt,
      createdAt: issuedAt,
      updatedAt: issuedAt
    };

    photos.set(photoId, photo);

    return ok(
      {
        photoId,
        uploadUrl: signedUpload.signed.uploadUrl,
        uploadMethod: signedUpload.signed.uploadMethod,
        uploadHeaders: signedUpload.signed.uploadHeaders ?? {
          "Content-Type": request.contentType
        },
        expiresAt: signedExpiresAt,
        maxByteSize: signedUpload.signed.maxByteSize ?? MAX_SOURCE_PHOTO_BYTES
      },
      201
    );
  };

  const completePhotoUpload = (
    context: ApiAuthContext,
    request: CompletePhotoUploadRequest
  ): ApiResult<CompletePhotoUploadResponse> => {
    const photo = findOwnedPhoto(context, request.photoId);

    if (!photo.ok) {
      return photo;
    }

    const completedAt = now();

    if (new Date(completedAt).getTime() > new Date(photo.data.expiresAt).getTime()) {
      return fail(409, "upload_url_expired", "Photo upload link expired. Choose the photo again.");
    }

    if (!contentHashPattern.test(request.contentHash)) {
      return fail(422, "invalid_content_hash", "Uploaded photo metadata is invalid.");
    }

    const updatedPhoto: OriginalPhotoRecord = {
      ...photo.data,
      status: "uploaded",
      contentHash: request.contentHash,
      uploadedAt: completedAt,
      updatedAt: completedAt
    };

    photos.set(updatedPhoto.id, updatedPhoto);

    return ok({ photo: clonePhoto(updatedPhoto) });
  };

  const createGenerationJob = (
    context: ApiAuthContext,
    request: CreateGenerationJobRequest
  ): ApiResult<GenerationJob> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = findOwnedPet(context, request.petId);

    if (!pet.ok) {
      return pet;
    }

    if (request.sourcePhotoIds.length === 0) {
      return fail(422, "source_photo_required", "A source pet photo is required.");
    }

    const requestedPhotoIds = [...request.sourcePhotoIds, ...request.optionalPhotoIds];

    for (const photoId of requestedPhotoIds) {
      const photo = findOwnedPhoto(context, photoId);

      if (!photo.ok) {
        return photo;
      }

      if (photo.data.petId !== request.petId) {
        return fail(403, "photo_pet_mismatch", "Photo does not belong to this pet.");
      }

      if (photo.data.status !== "uploaded") {
        return fail(409, "photo_upload_incomplete", "Photo upload must complete before generation starts.");
      }
    }

    const createdAt = now();
    const favoriteThing = pet.data.favoriteThing;
    const job: GenerationJob = {
      id: `gen_mock_${sequence++}`,
      userId: auth.data.userId,
      petId: request.petId,
      sourcePhotoIds: [...request.sourcePhotoIds],
      optionalPhotoIds: [...request.optionalPhotoIds],
      status: "created",
      inputSnapshot: {
        species: pet.data.species,
        petName: pet.data.name,
        personalityTags: [...pet.data.personalityTags],
        talkingStyle: pet.data.talkingStyle,
        ...(favoriteThing ? { favoriteThing } : {})
      },
      provider: "mock",
      costUnits: 0,
      quality: {
        qualityStatus: "pending",
        failedChecks: [],
        manualReviewRequired: false,
        retryRecommended: false
      },
      createdAt,
      updatedAt: createdAt
    };

    generationJobs.set(job.id, job);

    return ok(cloneGenerationJob(job), 201);
  };

  const buildGeneratedAssetsForJob = (job: GenerationJob, createdAt: ISODateTime): GeneratedAsset[] =>
    mockGeneratedAssets.map((template) => {
      const storagePetId = safeStorageSegment(job.petId);
      const storageJobId = safeStorageSegment(job.id);
      const assetId = `asset_${storageJobId}_${template.state}_${sequence++}`;

      return {
        id: assetId,
        petId: job.petId,
        generationJobId: job.id,
        state: template.state,
        uri: `mock://assets/pets/${storagePetId}/${storageJobId}/${template.state}.png`,
        ...(template.thumbnailUri
          ? { thumbnailUri: `mock://assets/pets/${storagePetId}/${storageJobId}/${template.state}-thumb.png` }
          : {}),
        width: template.width,
        height: template.height,
        contentHash: `mock_hash_${storageJobId}_${template.state}`,
        mimeType: template.mimeType,
        storageClass: "private_app_asset",
        version: template.version,
        qualityStatus: "passed",
        createdAt,
        updatedAt: createdAt
      };
    });

  const isPrivateGeneratedAssetUri = (value: string): boolean => /^(mock|s3|gs|r2):\/\//i.test(value);

  const normalizeCompletedGenerationAsset = (
    job: GenerationJob,
    asset: CompleteGenerationJobRequest["assets"][number],
    completedAt: ISODateTime
  ): ApiResult<GeneratedAsset> => {
    if (!asset || typeof asset !== "object") {
      return fail(422, "invalid_generated_asset", "Generated asset metadata is invalid.");
    }

    if (typeof asset.state !== "string" || !supportedGeneratedAssetStates.has(asset.state)) {
      return fail(422, "invalid_generated_asset_state", "Generated asset state is invalid.");
    }

    if (typeof asset.uri !== "string" || !isPrivateGeneratedAssetUri(asset.uri)) {
      return fail(422, "invalid_generated_asset_uri", "Generated asset storage metadata is invalid.");
    }

    if (!Number.isInteger(asset.width) || asset.width < 1 || asset.width > 4096) {
      return fail(422, "invalid_generated_asset_dimensions", "Generated asset dimensions are invalid.");
    }

    if (!Number.isInteger(asset.height) || asset.height < 1 || asset.height > 4096) {
      return fail(422, "invalid_generated_asset_dimensions", "Generated asset dimensions are invalid.");
    }

    if (!contentHashPattern.test(asset.contentHash)) {
      return fail(422, "invalid_generated_asset_hash", "Generated asset metadata is invalid.");
    }

    if (asset.mimeType !== "image/png" && asset.mimeType !== "image/webp") {
      return fail(422, "invalid_generated_asset_type", "Generated asset type is invalid.");
    }

    const storageClass = asset.storageClass ?? "private_app_asset";

    if (storageClass !== "private_app_asset" && storageClass !== "share_export") {
      return fail(422, "invalid_generated_asset_storage_class", "Generated asset storage metadata is invalid.");
    }

    const qualityStatus = asset.qualityStatus ?? "passed";

    if (!supportedGeneratedAssetQualityStatuses.has(qualityStatus)) {
      return fail(422, "invalid_generated_asset_quality", "Generated asset quality metadata is invalid.");
    }

    const version = asset.version ?? 1;

    if (!Number.isInteger(version) || version < 1) {
      return fail(422, "invalid_generated_asset_version", "Generated asset version is invalid.");
    }

    return ok({
      id: asset.id ?? `asset_${safeStorageSegment(job.id)}_${safeStorageSegment(asset.state)}_${sequence++}`,
      petId: job.petId,
      generationJobId: job.id,
      state: asset.state,
      uri: asset.uri,
      ...(asset.thumbnailUri ? { thumbnailUri: asset.thumbnailUri } : {}),
      width: asset.width,
      height: asset.height,
      contentHash: asset.contentHash,
      mimeType: asset.mimeType,
      storageClass,
      version,
      qualityStatus,
      createdAt: completedAt,
      updatedAt: completedAt
    });
  };

  const completeGenerationJob = (
    context: ApiAuthContext,
    request: CompleteGenerationJobRequest
  ): ApiResult<CompleteGenerationJobResponse> => {
    const job = findOwnedGenerationJob(context, request.jobId);

    if (!job.ok) {
      return job;
    }

    if (job.data.status === "completed") {
      const existingAssets = [...generatedAssets.values()].filter((asset) => asset.generationJobId === job.data.id);

      return ok({
        job: cloneGenerationJob(job.data),
        assets: existingAssets.map(cloneGeneratedAsset)
      });
    }

    if (job.data.status === "failed" || job.data.status === "cancelled" || job.data.status === "expired") {
      return fail(409, "generation_job_not_active", "Retry this generation job before completing it.");
    }

    if (!Array.isArray(request.assets) || request.assets.length === 0) {
      return fail(422, "generated_asset_required", "At least one generated asset is required.");
    }

    const completedAt = request.completedAt ?? now();
    const assets: GeneratedAsset[] = [];

    for (const input of request.assets) {
      const asset = normalizeCompletedGenerationAsset(job.data, input, completedAt);

      if (!asset.ok) {
        return asset;
      }

      assets.push(asset.data);
    }

    for (const asset of assets) {
      generatedAssets.set(asset.id, asset);
    }

    const quality = request.quality ?? {
      qualityStatus: "passed",
      qualityScore: 0.92,
      failedChecks: [],
      manualReviewRequired: false,
      retryRecommended: false
    };
    const { failure: _failure, completedAt: _completedAt, expiresAt: _expiresAt, ...baseJob } = job.data;
    const completedJob: GenerationJob = {
      ...baseJob,
      provider: request.provider ?? job.data.provider,
      costUnits: request.costUnits ?? job.data.costUnits,
      status: "completed",
      quality,
      completedAt,
      updatedAt: completedAt
    };

    generationJobs.set(completedJob.id, completedJob);

    return ok({
      job: cloneGenerationJob(completedJob),
      assets: assets.map(cloneGeneratedAsset)
    });
  };

  const completeMockGenerationJob = (
    context: ApiAuthContext,
    jobId: GenerationJobId
  ): ApiResult<CompleteGenerationJobResponse> => {
    const job = findOwnedGenerationJob(context, jobId);

    if (!job.ok) {
      return job;
    }

    const existingAssets = [...generatedAssets.values()].filter((asset) => asset.generationJobId === job.data.id);

    if (job.data.status === "completed") {
      return ok({
        job: cloneGenerationJob(job.data),
        assets: existingAssets.map(cloneGeneratedAsset)
      });
    }

    if (job.data.status === "failed" || job.data.status === "cancelled" || job.data.status === "expired") {
      return fail(409, "generation_job_not_active", "Retry this generation job before completing it.");
    }

    const completedAt = now();
    const assets = existingAssets.length > 0 ? existingAssets : buildGeneratedAssetsForJob(job.data, completedAt);

    for (const asset of assets) {
      generatedAssets.set(asset.id, asset);
    }

    const { failure: _failure, completedAt: _completedAt, expiresAt: _expiresAt, ...baseJob } = job.data;
    const completedJob: GenerationJob = {
      ...baseJob,
      status: "completed",
      quality: {
        qualityStatus: "passed",
        qualityScore: 0.92,
        failedChecks: [],
        manualReviewRequired: false,
        retryRecommended: false
      },
      completedAt,
      updatedAt: completedAt
    };

    generationJobs.set(completedJob.id, completedJob);

    return ok({
      job: cloneGenerationJob(completedJob),
      assets: assets.map(cloneGeneratedAsset)
    });
  };

  const pollGenerationJob = (context: ApiAuthContext, jobId: GenerationJobId): ApiResult<GenerationPollResponse> => {
    const job = findOwnedGenerationJob(context, jobId);

    if (!job.ok) {
      return job;
    }

    const existingAssets = [...generatedAssets.values()].filter((asset) => asset.generationJobId === job.data.id);

    if (job.data.status === "completed") {
      return ok({
        job: cloneGenerationJob(job.data),
        assets: existingAssets.map(cloneGeneratedAsset)
      });
    }

    if (job.data.status === "failed" || job.data.status === "cancelled" || job.data.status === "expired") {
      return ok({
        job: cloneGenerationJob(job.data),
        assets: []
      });
    }

    const currentIndex = mockGenerationPollStatuses.indexOf(job.data.status);
    const nextStatus = currentIndex === -1 ? mockGenerationPollStatuses[0] : mockGenerationPollStatuses[currentIndex + 1];

    if (!nextStatus || nextStatus === "completed") {
      return completeMockGenerationJob(context, jobId);
    }

    const polledAt = now();
    const { failure: _failure, completedAt: _completedAt, expiresAt: _expiresAt, ...baseJob } = job.data;
    const polledJob: GenerationJob = {
      ...baseJob,
      status: nextStatus,
      updatedAt: polledAt
    };

    generationJobs.set(polledJob.id, polledJob);

    return ok({
      job: cloneGenerationJob(polledJob),
      assets: []
    });
  };

  const failGenerationJobForQualityGate = (
    context: ApiAuthContext,
    jobId: GenerationJobId,
    failedChecks: string[] = ["quality_gate_failed"]
  ): ApiResult<GenerationJob> => {
    const job = findOwnedGenerationJob(context, jobId);

    if (!job.ok) {
      return job;
    }

    if (job.data.status === "completed") {
      return fail(409, "generation_job_already_completed", "Completed generation jobs cannot be failed.");
    }

    const failedAt = now();
    const { failure: _failure, completedAt: _completedAt, expiresAt: _expiresAt, ...baseJob } = job.data;
    const failedJob: GenerationJob = {
      ...baseJob,
      status: "failed",
      quality: {
        qualityStatus: "failed",
        failedChecks: [...failedChecks],
        manualReviewRequired: false,
        retryRecommended: true
      },
      failure: {
        failureCode: "quality_gate_failed",
        failureMessageSafe: "Generated pet could not pass quality checks. Try again.",
        retryable: true,
        refundCreditRequired: false
      },
      updatedAt: failedAt
    };

    generationJobs.set(failedJob.id, failedJob);

    return ok(cloneGenerationJob(failedJob));
  };

  const retryGenerationJob = (
    context: ApiAuthContext,
    jobId: GenerationJobId
  ): ApiResult<RetryGenerationJobResponse> => {
    const job = findOwnedGenerationJob(context, jobId);

    if (!job.ok) {
      return job;
    }

    const isRetryableStatus = job.data.status === "failed" || job.data.status === "cancelled" || job.data.status === "expired";

    if (!isRetryableStatus || job.data.failure?.retryable === false) {
      return fail(409, "generation_job_not_retryable", "This generation job cannot be retried.");
    }

    const retriedAt = now();
    const { failure: _failure, completedAt: _completedAt, expiresAt: _expiresAt, ...baseJob } = job.data;
    const retriedJob: GenerationJob = {
      ...baseJob,
      status: "created",
      costUnits: 0,
      quality: {
        qualityStatus: "pending",
        failedChecks: [],
        manualReviewRequired: false,
        retryRecommended: false
      },
      updatedAt: retriedAt
    };

    generationJobs.set(retriedJob.id, retriedJob);

    return ok({ job: cloneGenerationJob(retriedJob) });
  };

  const acceptGenerationJob = (
    context: ApiAuthContext,
    request: AcceptGenerationJobRequest
  ): ApiResult<AcceptGenerationJobResponse> => {
    const job = findOwnedGenerationJob(context, request.jobId);

    if (!job.ok) {
      return job;
    }

    const pet = findOwnedPet(context, job.data.petId);

    if (!pet.ok) {
      return pet;
    }

    if (job.data.status !== "completed") {
      return fail(409, "generation_not_completed", "Generated pet assets are not ready yet.");
    }

    if (request.acceptedAssetIds.length === 0) {
      return fail(422, "generated_asset_required", "Choose at least one generated pet asset.");
    }

    const assetsById = new Map(
      [...generatedAssets.values()]
        .filter((asset) => asset.petId === pet.data.id && asset.generationJobId === job.data.id)
        .map((asset) => [asset.id, asset])
    );
    const acceptedAssets: GeneratedAsset[] = [];

    for (const assetId of [...new Set(request.acceptedAssetIds)]) {
      const asset = assetsById.get(assetId);

      if (!asset) {
        return fail(404, "generated_asset_not_found", "Generated pet asset not found.");
      }

      if (asset.qualityStatus !== "passed") {
        return fail(409, "generated_asset_not_ready", "Generated pet asset is not ready.");
      }

      acceptedAssets.push(asset);
    }

    const acceptedAt = now();
    const activeAsset = acceptedAssets[0];

    if (!activeAsset) {
      return fail(422, "generated_asset_required", "Choose at least one generated pet asset.");
    }

    const updatedPet: PetProfile = {
      ...pet.data,
      activeGenerationJobId: job.data.id,
      activeAssetId: activeAsset.id,
      lifecycleStatus: "active",
      updatedAt: acceptedAt
    };

    pets.set(updatedPet.id, updatedPet);

    return ok({
      pet: clonePet(updatedPet),
      assets: acceptedAssets.map(cloneGeneratedAsset)
    });
  };

  const reportGenerationIssue = (
    context: ApiAuthContext,
    request: GenerationIssueReportRequest
  ): ApiResult<GenerationIssueReportResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    if (!request || typeof request.petId !== "string" || request.petId.trim().length === 0) {
      return fail(422, "invalid_generation_issue_report", "Choose a pet before sending a report.");
    }

    if (!supportedGenerationIssueCategories.has(request.category)) {
      return fail(422, "invalid_generation_issue_category", "Choose a supported report reason.");
    }

    const pet = findOwnedPet(context, request.petId);

    if (!pet.ok) {
      return pet;
    }

    const generationJobId = request.generationJobId;

    if (generationJobId !== undefined) {
      if (typeof generationJobId !== "string" || generationJobId.trim().length === 0) {
        return fail(422, "invalid_generation_issue_report", "Generated pet report metadata is invalid.");
      }

      const job = findOwnedGenerationJob(context, generationJobId);

      if (!job.ok) {
        return job;
      }

      if (job.data.petId !== pet.data.id) {
        return fail(403, "generation_issue_pet_mismatch", "Generated pet report does not match this pet.");
      }
    }

    const reportedAt = now();
    const report: GenerationIssueReportRecord = {
      reportId: `gen_issue_mock_${sequence++}`,
      userId: auth.data.userId,
      petId: pet.data.id,
      ...(generationJobId ? { generationJobId } : {}),
      category: request.category,
      reportedAt
    };

    generationIssueReports.set(report.reportId, report);

    const { userId: _userId, ...response } = report;

    return ok(response, 201);
  };

  const deleteOriginalPhotos = (
    context: ApiAuthContext,
    request: DeleteOriginalPhotosRequest
  ): ApiResult<DeleteOriginalPhotosResponse> => {
    const pet = findOwnedPet(context, request.petId);

    if (!pet.ok) {
      return pet;
    }

    const deletedAt = now();
    const deletedPhotoIds: PhotoId[] = [];

    for (const photo of photos.values()) {
      if (photo.petId !== request.petId || photo.userId !== pet.data.userId || photo.status === "deleted") {
        continue;
      }

      const deletedPhoto: OriginalPhotoRecord = {
        ...photo,
        status: "deleted",
        deletedAt,
        updatedAt: deletedAt
      };

      photos.set(photo.id, deletedPhoto);
      deletedPhotoIds.push(photo.id);
    }

    const updatedPet: PetProfile = {
      ...pet.data,
      originalPhotoDeletedAt: deletedAt,
      updatedAt: deletedAt
    };

    pets.set(updatedPet.id, updatedPet);

    return ok({ deletedPhotoIds, deletedAt });
  };

  const deleteChatHistory = (context: ApiAuthContext): ApiResult<DeleteChatHistoryResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const deletedAt = now();
    const deletedConversationIds: ConversationId[] = [];
    const deletedConversationIdSet = new Set<ConversationId>();
    const deletedMessageIds: string[] = [];

    for (const conversation of conversations.values()) {
      if (conversation.userId !== auth.data.userId || conversation.status === "deleted") {
        continue;
      }

      conversations.set(conversation.id, {
        ...conversation,
        status: "deleted",
        deletedAt,
        updatedAt: deletedAt
      });
      deletedConversationIds.push(conversation.id);
      deletedConversationIdSet.add(conversation.id);
    }

    for (const message of conversationMessages.values()) {
      if (!deletedConversationIdSet.has(message.conversationId)) {
        continue;
      }

      conversationMessages.delete(message.id);
      deletedMessageIds.push(message.id);
    }

    return ok({
      deletedConversationIds,
      deletedMessageIds,
      deletedAt
    });
  };

  const listGeneratedAssets = (context: ApiAuthContext, petId: PetId) => {
    const pet = findOwnedPet(context, petId);

    if (!pet.ok) {
      return pet;
    }

    return ok({
      assets: [...generatedAssets.values()]
        .filter((asset) => asset.petId === pet.data.id)
        .map(cloneGeneratedAsset)
    });
  };

  const issueGeneratedAssetReadUrl = (
    context: ApiAuthContext,
    assetId: GeneratedAssetId
  ): ApiResult<GeneratedAssetSignedUrlResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const asset = generatedAssets.get(assetId);

    if (!asset) {
      return fail(404, "generated_asset_not_found", "Generated asset not found.");
    }

    const pet = pets.get(asset.petId);

    if (!pet || pet.userId !== auth.data.userId || pet.lifecycleStatus === "deleted") {
      return fail(404, "generated_asset_not_found", "Generated asset not found.");
    }

    if (privateStorageSigner || !allowMockStorageSigning) {
      return storageSigningUnavailable();
    }

    const expiresAt = addMs(now(), ASSET_READ_URL_TTL_MS);

    return ok({
      assetId: asset.id,
      petId: asset.petId,
      signedUrl: `mock-signed-read://private/${safeStorageSegment(auth.data.userId)}/${safeStorageSegment(asset.petId)}/${safeStorageSegment(asset.id)}?expires_at=${encodeURIComponent(expiresAt)}`,
      expiresAt,
      contentType: asset.mimeType,
      storageClass: asset.storageClass
    });
  };

  const issueGeneratedAssetReadUrlWithStorageSigner = async (
    context: ApiAuthContext,
    assetId: GeneratedAssetId
  ): Promise<ApiResult<GeneratedAssetSignedUrlResponse>> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const asset = generatedAssets.get(assetId);

    if (!asset) {
      return fail(404, "generated_asset_not_found", "Generated asset not found.");
    }

    const pet = pets.get(asset.petId);

    if (!pet || pet.userId !== auth.data.userId || pet.lifecycleStatus === "deleted") {
      return fail(404, "generated_asset_not_found", "Generated asset not found.");
    }

    if (!privateStorageSigner) {
      return issueGeneratedAssetReadUrl(context, assetId);
    }

    const expiresAt = addMs(now(), ASSET_READ_URL_TTL_MS);
    const signedRead = await privateStorageSigner.createGeneratedAssetRead({
      userId: auth.data.userId,
      petId: asset.petId,
      assetId: asset.id,
      assetUri: asset.uri,
      contentHash: asset.contentHash,
      contentType: asset.mimeType,
      storageClass: asset.storageClass,
      expiresAt
    });

    if (!signedRead.ok) {
      return mapStorageSignerError(signedRead.error);
    }

    if (!isRenderableSignedStorageUrl(signedRead.signed.signedUrl)) {
      return fail(503, "storage_signing_invalid_result", "Private storage signing is not available yet.");
    }

    return ok({
      assetId: asset.id,
      petId: asset.petId,
      signedUrl: signedRead.signed.signedUrl,
      expiresAt: signedRead.signed.expiresAt ?? expiresAt,
      contentType: signedRead.signed.contentType ?? asset.mimeType,
      storageClass: asset.storageClass
    });
  };

  const findOwnedConversation = (context: ApiAuthContext, conversationId: ConversationId): ApiResult<Conversation> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const conversation = conversations.get(conversationId);

    if (!conversation || conversation.userId !== auth.data.userId || conversation.status === "deleted") {
      return fail(404, "conversation_not_found", "Conversation not found.");
    }

    return ok(cloneConversation(conversation));
  };

  const getConversationThread = (
    context: ApiAuthContext,
    conversationId: ConversationId
  ): ApiResult<ConversationThreadResponse> => {
    const conversation = findOwnedConversation(context, conversationId);

    if (!conversation.ok) {
      return conversation;
    }

    return ok({
      conversation: conversation.data,
      messages: filterPremiumChatRetainedMessages(
        [...conversationMessages.values()]
          .filter((message) => message.conversationId === conversation.data.id)
          .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
        now(),
        premiumChatPolicy
      ).map(cloneConversationMessage)
    });
  };

  const deleteConversation = (
    context: ApiAuthContext,
    conversationId: ConversationId
  ): ApiResult<DeleteConversationResponse> => {
    const conversation = findOwnedConversation(context, conversationId);

    if (!conversation.ok) {
      return conversation;
    }

    const deletedAt = now();
    const deletedMessageIds: string[] = [];

    for (const message of conversationMessages.values()) {
      if (message.conversationId !== conversation.data.id) {
        continue;
      }

      conversationMessages.delete(message.id);
      deletedMessageIds.push(message.id);
    }

    conversations.set(conversation.data.id, {
      ...conversation.data,
      status: "deleted",
      deletedAt,
      updatedAt: deletedAt
    });

    return ok({
      deletedConversationId: conversation.data.id,
      deletedMessageIds,
      deletedAt
    });
  };

  const premiumChatRateLimited = <T = never>(retryAfterSeconds: number): ApiResult<T> =>
    fail(429, "premium_chat_rate_limited", `Premium chat is moving too fast. Try again in ${retryAfterSeconds} seconds.`);

  const createPremiumConversation = (
    context: ApiAuthContext,
    request: CreateConversationRequest
  ): ApiResult<CreateConversationResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = findOwnedPet(context, request.petId);

    if (!pet.ok) {
      return pet;
    }

    if (!request.disclosureAccepted) {
      return fail(422, "ai_disclosure_required", "AI chat disclosure must be accepted before premium chat.");
    }

    const createdAt = now();
    const chatAccess = resolvePremiumChatAccess(context, auth.data, createdAt);

    if (!chatAccess.ok) {
      return chatAccess;
    }

    const conversation: Conversation = {
      id: `conv_mock_${sequence++}`,
      userId: auth.data.userId,
      petId: request.petId,
      type: "premium_ai_chat",
      status: "open",
      disclosureAcceptedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    };

    conversations.set(conversation.id, conversation);

    return ok(
      {
        conversation: cloneConversation(conversation),
        disclosureText: premiumChatGate.disclosureText
      },
      201
    );
  };

  const sendPremiumConversationMessage = (
    context: ApiAuthContext,
    request: SendConversationMessageRequest
  ): ApiResult<SendConversationMessageResponse> => {
    const auth = requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const conversation = findOwnedConversation(context, request.conversationId);

    if (!conversation.ok) {
      return conversation;
    }

    if (conversation.data.type !== "premium_ai_chat" || !conversation.data.disclosureAcceptedAt) {
      return fail(409, "conversation_not_ready", "Premium chat disclosure must be accepted first.");
    }

    const pet = findOwnedPet(context, conversation.data.petId);

    if (!pet.ok) {
      return pet;
    }

    const moderation = moderatePremiumChatInput(request.text);

    if (!moderation.ok) {
      return fail(moderation.status, moderation.code, moderation.messageSafe);
    }

    const createdAt = now();
    const conversationHistory = [...conversationMessages.values()]
      .filter((message) => message.conversationId === conversation.data.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const retainedConversationHistory = filterPremiumChatRetainedMessages(conversationHistory, createdAt, premiumChatPolicy);
    const rateLimit = checkPremiumChatRateLimit(retainedConversationHistory, createdAt, premiumChatPolicy);

    if (rateLimit.limited) {
      return premiumChatRateLimited(rateLimit.retryAfterSeconds ?? 1);
    }

    const chatAccess = resolvePremiumChatAccess(context, auth.data, createdAt);

    if (!chatAccess.ok) {
      return chatAccess;
    }

    const providerOutput = moderatePremiumChatProviderReply(
      {
        text: `${pet.data.name} tilts closer. This is a mock moderated AI gateway response; real provider output stays backend-only.`,
        safetyFlags: []
      },
      context.locale ?? "ko-KR"
    );

    if (!providerOutput.ok) {
      return fail(providerOutput.status, providerOutput.code, providerOutput.messageSafe);
    }

    const walletSpend =
      chatAccess.data.mode === "entitlement"
        ? {
            ok: true as const,
            wallet: chatAccess.data.wallet,
            spend: emptyWalletSpend()
          }
        : spendPremiumChatTurn(chatAccess.data.wallet, createdAt);

    if (!walletSpend.ok) {
      return fail(403, "premium_chat_payment_required", "Use a chat ticket, credit, or Plus pass to talk.");
    }

    const userMessage: ConversationMessage = {
      id: `msg_mock_${sequence++}`,
      conversationId: conversation.data.id,
      sender: "user",
      text: moderation.normalizedText,
      safetyFlags: moderation.safetyFlags,
      createdAt
    };
    const petMessage: ConversationMessage = {
      id: `msg_mock_${sequence++}`,
      conversationId: conversation.data.id,
      sender: "pet_ai",
      text: providerOutput.text,
      safetyFlags: providerOutput.safetyFlags,
      createdAt
    };

    conversationMessages.set(userMessage.id, userMessage);
    conversationMessages.set(petMessage.id, petMessage);

    if (chatAccess.data.mode === "wallet") {
      wallets.set(auth.data.userId, walletSpend.wallet);
    }

    conversations.set(conversation.data.id, {
      ...conversation.data,
      updatedAt: createdAt
    });

    return ok({
      userMessage: cloneConversationMessage(userMessage),
      petMessage: cloneConversationMessage(petMessage),
      safetyFlags: Array.from(new Set([...moderation.safetyFlags, ...providerOutput.safetyFlags])),
      wallet: cloneCreditWallet(walletSpend.wallet),
      walletSpend: walletSpend.spend
    });
  };

  const snapshot = (): MockApiServiceSnapshot => ({
    sequence,
    pets: [...pets.values()].map(clonePet),
    photos: [...photos.values()].map(clonePhoto),
    generationJobs: [...generationJobs.values()].map(cloneGenerationJob),
    generationIssueReports: [...generationIssueReports.values()].map(cloneGenerationIssueReport),
    generatedAssets: [...generatedAssets.values()].map(cloneGeneratedAsset),
    careStates: [...careStates.values()].map(cloneCareState),
    relationshipStates: [...relationshipStates.values()].map(cloneRelationshipState),
    wallets: [...wallets.values()].map(cloneCreditWallet),
    inventories: [...inventories.values()].map(cloneInventory),
    itemCatalog: itemCatalog.map(cloneItem),
    walkSessions: [...walkSessions.values()].map(cloneWalkSession),
    recentReactions: [...recentReactionRecords.values()].flat().map(cloneRecentReactionRecord),
    entitlements: [...entitlements.values()].map(cloneEntitlement),
    purchaseLedger: [...purchaseLedger.values()].map(clonePurchaseLedgerRecord),
    conversations: [...conversations.values()].map(cloneConversation),
    conversationMessages: [...conversationMessages.values()].map(cloneConversationMessage)
  });

  return {
    requireAuth,
    getCurrentUser,
    listPets,
    createPet,
    updatePet,
    deletePet,
    findOwnedPet,
    findOwnedPhoto,
    findOwnedGenerationJob,
    getGenerationJob: findOwnedGenerationJob,
    getCareState,
    getRelationshipState,
    performCareAction,
    startWalk,
    claimWalkReward,
    purchaseInventoryItem,
    placeInventoryItem,
    removePlacedItem,
    getReactionCatalog,
    getCurrentWeather,
    getItemCatalog,
    getInventory,
    issuePhotoUploadUrl,
    issuePhotoUploadUrlWithStorageSigner,
    completePhotoUpload,
    createGenerationJob,
    pollGenerationJob,
    completeGenerationJob,
    completeMockGenerationJob,
    failGenerationJobForQualityGate,
    retryGenerationJob,
    acceptGenerationJob,
    reportGenerationIssue,
    deleteOriginalPhotos,
    deleteChatHistory,
    listGeneratedAssets,
    issueGeneratedAssetReadUrl,
    issueGeneratedAssetReadUrlWithStorageSigner,
    listCommerceProducts,
    listEntitlements,
    getConversationThread,
    deleteConversation,
    hasActiveEntitlement,
    requireActiveEntitlement,
    createPremiumConversation,
    sendPremiumConversationMessage,
    moderatePremiumChatInput,
    verifyPurchase,
    verifyPurchaseWithStoreVerifier,
    restorePurchases,
    restorePurchasesWithStoreVerifier,
    revokePurchase,
    revokePurchaseByReceiptHash,
    snapshot,
    inspectState: snapshot
  };
}

export type MockApiService = ReturnType<typeof createMockApiService>;
export type MaybePromise<T> = T | Promise<T>;
type ApiResultSuccessData<Result> = Extract<Result, { ok: true }> extends { data: infer Data } ? Data : never;
type MaybeAsyncApiMethodResult<Result> =
  [ApiResultSuccessData<Result>] extends [never] ? Result : MaybePromise<ApiResult<ApiResultSuccessData<Result>>>;
type MaybeAsyncApiMethod<Method> = Method extends (...args: infer Args) => infer Result
  ? (...args: Args) => MaybeAsyncApiMethodResult<Result>
  : Method;
type AsyncCapableApiService = {
  [MethodName in keyof MockApiService]: MaybeAsyncApiMethod<MockApiService[MethodName]>;
};
export type ApiService = Omit<AsyncCapableApiService, "snapshot" | "inspectState"> &
  Pick<MockApiService, "snapshot" | "inspectState">;

export interface AsyncOnlyApiService extends ApiService {
  asyncOnly: true;
}
