import { createHash, randomUUID } from "node:crypto";

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
  isCareItemEligibleForAction,
  isPlantGrowthEnabledItemId,
  getCareDaysAway,
  placeInventoryItemInFixedSlot,
  mockCareState,
  mockCreditWallet,
  mockGeneratedAssets,
  mockInventory,
  mockItems,
  premiumChatGate,
  projectCareStateForTime,
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
  CareActionResponse,
  CareActionType,
  CareState,
  ClaimWalkResponse,
  Conversation,
  ConversationId,
  ConversationMessage,
  CreditWallet,
  CreditWalletGrant,
  CreditWalletSpendBreakdown,
  Entitlement,
  EntitlementKey,
  GeneratedAssetId,
  GeneratedAsset,
  GenerationIssueCategory,
  GenerationJob,
  GenerationJobId,
  GenerationJobStatus,
  Inventory,
  InventoryEntry,
  InventorySource,
  ISODateTime,
  Item,
  ItemCatalogResponse,
  ItemId,
  Locale,
  PetId,
  PetProfile,
  PlacedItem,
  PhotoId,
  ReactionRule,
  RelationshipState,
  SelectedReaction,
  SourcePhotoContentType,
  StartWalkResponse,
  UserId,
  WeatherContext,
  WalkSession,
  WalkSessionId
} from "@mongchi/shared";

import type {
  AcceptGenerationJobRequest,
  AcceptGenerationJobResponse,
  CommerceProductsResponse,
  CompleteGenerationJobRequest,
  CompleteGenerationJobResponse,
  CompletePhotoUploadRequest,
  ConversationThreadResponse,
  CreateGenerationJobRequest,
  CreateConversationRequest,
  CreateConversationResponse,
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
  InventoryPlacementResponse,
  PetAssetsResponse,
  PlaceInventoryItemRequest,
  PhotoUploadUrlRequest,
  PhotoUploadUrlResponse,
  PurchaseReceiptRevocationRequest,
  PurchaseRevocationRequest,
  PurchaseRevocationResponse,
  PurchaseVerificationRequest,
  PurchaseVerificationResponse,
  RestorePurchasesRequest,
  RetryGenerationJobResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  PurchaseInventoryItemRequest,
  PurchaseInventoryItemResponse,
  UpdatePetRequest,
  WeatherLookupRequest,
  WeatherLookupResponse
} from "./contracts";
import type { ApiPostgresRepositoryBundle } from "./postgresRepositoryBundle";
import type { StorePurchaseVerifier, VerifiedStorePurchase } from "./purchaseVerifier";
import type {
  ApiAuthContext,
  ApiResult,
  ApiStatus,
  AsyncOnlyApiService,
  CompletePhotoUploadResponse,
  PurchaseLedgerRecord,
  MockApiServiceSnapshot,
  OriginalPhotoRecord
} from "./service";
import { commerceProducts } from "./service";
import type { PrivateStorageSigner } from "./storageSigner";
import {
  createLocalPremiumChatProvider,
  type PremiumChatCareContext,
  type PremiumChatProvider,
  type PremiumChatProviderResult
} from "./premiumChatProvider";
import {
  checkPremiumChatRateLimit,
  filterPremiumChatRetainedMessages,
  resolvePremiumChatPolicy,
  selectPremiumChatContextMessages,
  type PremiumChatPolicyOptions
} from "./premiumChatPolicy";
import {
  moderatePremiumChatInput,
  moderatePremiumChatProviderReply
} from "./premiumChatModeration";
import type { PremiumChatMonitor } from "./premiumChatMonitoring";
import { emitPremiumChatMonitorEvent } from "./premiumChatMonitoring";

export interface PostgresApiServiceOptions {
  repositories: ApiPostgresRepositoryBundle;
  now?: () => ISODateTime;
  allowMockPurchaseVerification?: boolean;
  allowMockStorageSigning?: boolean;
  allowMockGenerationPolling?: boolean;
  purchaseVerifier?: StorePurchaseVerifier;
  privateStorageSigner?: PrivateStorageSigner;
  premiumChatProvider?: PremiumChatProvider;
  premiumChatMonitor?: PremiumChatMonitor;
  premiumChatPolicy?: PremiumChatPolicyOptions;
}

type AuthenticatedContext = {
  userId: UserId;
  locale: Locale;
  timezone: string;
  authProvider: string;
  authSubject: string;
};

const systemNow = (): ISODateTime => new Date().toISOString();
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const ASSET_READ_URL_TTL_MS = 10 * 60 * 1000;
const MOCK_WALK_DURATION_MS = 15 * 1000;
const WALK_REWARD_ITEM_ID: ItemId = "item_flower_pot_sunny";
const walkDiscoveryLineByLocale: Record<Locale, string> = {
  "en-US": "A tiny leaf thought of you.",
  "ko-KR": "작은 잎사귀가 네 생각을 했대.",
  "ja-JP": "小さな葉っぱが、きみのことを思い出したんだって。",
  "zh-TW": "一片小葉子說它想起了你。",
  "de-DE": "Ein kleines Blatt hat an dich gedacht.",
  "fr-FR": "Une petite feuille a pensé à toi.",
  "pt-BR": "Uma folhinha pensou em você.",
  "es-MX": "Una hojita pensó en ti."
};
const mockGenerationPollStatuses: GenerationJobStatus[] = [
  "preprocessing",
  "safety_checking",
  "generating",
  "quality_checking",
  "completed"
];
const subscriptionDurationMs = 30 * 24 * 60 * 60 * 1000;
const transactionIdPattern = /^[A-Za-z0-9_.:-]{6,160}$/;
const storeVerificationTokenControlPattern = /[\u0000-\u001f\u007f]/;
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
const supportedSourcePhotoContentTypeSet = new Set<string>(supportedSourcePhotoContentTypes);
const contentHashPattern = /^(sha256:)?[a-f0-9]{32,128}$/i;
const commerceProductById = new Map(commerceProducts.map((product) => [product.productId, product]));
const consumableWalletGrants: Partial<Record<EntitlementKey, CreditWalletGrant>> = {
  regeneration_credit: { credits: 1 }
};

const getConsumableWalletGrant = (product: CommerceProductDefinition): CreditWalletGrant | null =>
  product.grantType === "consumable" ? consumableWalletGrants[product.entitlementKey] ?? null : null;

const cloneWeatherContext = (weather: WeatherContext): WeatherContext => ({ ...weather });

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

const unavailable = <T = never>(): ApiResult<T> =>
  fail(503, "postgres_service_method_unmounted", "This API route is not mounted on the database-backed service yet.");

const createPetId = (): PetId => `pet_${randomUUID().replace(/-/g, "")}`;
const createPhotoId = (): PhotoId => `photo_${randomUUID().replace(/-/g, "")}`;
const createGenerationJobId = (): GenerationJobId => `gen_${randomUUID().replace(/-/g, "")}`;
const createGenerationIssueReportId = (): string => `gen_issue_${randomUUID().replace(/-/g, "")}`;
const createGeneratedAssetId = (jobId: GenerationJobId, state: string): GeneratedAssetId =>
  `asset_${safeStorageSegment(jobId)}_${safeStorageSegment(state)}_${randomUUID().replace(/-/g, "")}`;
const createWalkSessionId = (): WalkSessionId => `walk_${randomUUID().replace(/-/g, "")}`;
const createConversationId = (): ConversationId => `conv_${randomUUID().replace(/-/g, "")}`;
const createConversationMessageId = (): string => `msg_${randomUUID().replace(/-/g, "")}`;
const createPrivacyDeletionJobId = (): string => `privacy_${randomUUID().replace(/-/g, "")}`;
const addMs = (timestamp: ISODateTime, durationMs: number): ISODateTime =>
  new Date(new Date(timestamp).getTime() + durationMs).toISOString();
const safeStorageSegment = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, "_");
const isSupportedSourcePhotoContentType = (contentType: string): contentType is SourcePhotoContentType =>
  supportedSourcePhotoContentTypeSet.has(contentType);

const storageSigningUnavailable = <T = never>(): ApiResult<T> =>
  fail(503, "storage_signing_unavailable", "Private storage signing is not available yet.");

const mapStorageSignerError = <T>(error: {
  status: 403 | 404 | 422 | 503;
  code: string;
  messageSafe: string;
}): ApiResult<T> => fail(error.status, error.code, error.messageSafe);

const isRenderableSignedStorageUrl = (value: string): boolean =>
  /^https:\/\//i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value);

const cloneInventoryEntry = (entry: InventoryEntry): InventoryEntry => ({ ...entry });
const clonePlacedItem = (item: PlacedItem): PlacedItem => ({ ...item });
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

const emptySnapshot = (): MockApiServiceSnapshot => ({
  sequence: 0,
  pets: [],
  photos: [],
  generationJobs: [],
  generationIssueReports: [],
  generatedAssets: [],
  careStates: [],
  relationshipStates: [],
  wallets: [],
  inventories: [],
  itemCatalog: [],
  walkSessions: [],
  recentReactions: [],
  entitlements: [],
  purchaseLedger: [],
  conversations: [],
  conversationMessages: []
});

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

const normalizeOptionalText = (
  value: string | undefined,
  maxLength: number,
  code: string,
  messageSafe: string
): ApiResult<string | null> => {
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

const createStarterCareState = (pet: PetProfile, timestamp: ISODateTime): CareState => {
  const { activeWalkId: _activeWalkId, ...baseCareState } = mockCareState;

  return {
    ...baseCareState,
    petId: pet.id,
    updatedAt: timestamp
  };
};

const createStarterRelationshipState = (pet: PetProfile, timestamp: ISODateTime): RelationshipState => {
  const { lastBondedAt: _lastBondedAt, ...baseRelationshipState } = mockRelationshipState;

  return {
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
};

const createStarterCreditWallet = (userId: UserId, timestamp: ISODateTime): CreditWallet => ({
  ...mockCreditWallet,
  userId,
  updatedAt: timestamp
});

const createStarterInventory = (userId: UserId, timestamp: ISODateTime): Inventory => ({
  ...mockInventory,
  userId,
  items: mockInventory.items.map(cloneInventoryEntry).map((entry) => ({
    ...entry,
    acquiredAt: timestamp
  })),
  placedItems: mockInventory.placedItems.map(clonePlacedItem),
  plantGrowth: mockInventory.plantGrowth?.map((entry) => ({ ...entry })) ?? [],
  updatedAt: timestamp
});

const compareItems = (left: Item, right: Item): number =>
  left.category.localeCompare(right.category) ||
  left.rarity.localeCompare(right.rarity) ||
  left.name.localeCompare(right.name) ||
  left.id.localeCompare(right.id);

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
  catalogItems: readonly Item[],
  wateredAt: ISODateTime
): { inventory: Inventory; bloomRewards: ReturnType<typeof getPlantBloomRewards> } => {
  const itemById = new Map(catalogItems.map((item) => [item.id, item]));
  const waterablePlantItemIds = inventory.placedItems
    .map((placedItem) => itemById.get(placedItem.itemId))
    .filter((item): item is Item => Boolean(item))
    .filter((item) => isPlantGrowthEnabledItemId(item.id))
    .map((item) => item.id);

  if (waterablePlantItemIds.length === 0) {
    return {
      inventory: {
        ...inventory,
        plantGrowth: inventory.plantGrowth?.map((entry) => ({ ...entry })) ?? []
      },
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

const clearCareWalkId = (careState: CareState, timestamp: ISODateTime): CareState => {
  const { activeWalkId: _activeWalkId, ...withoutWalk } = careState;

  return {
    ...withoutWalk,
    happiness: Math.min(100, careState.happiness + 6),
    updatedAt: timestamp
  };
};

type CommerceProductDefinition = (typeof commerceProducts)[number];

const buildGrantedEntitlement = (
  userId: UserId,
  product: CommerceProductDefinition,
  transactionId: string,
  source: Extract<Entitlement["source"], "purchase" | "restore">,
  grantedAt: ISODateTime,
  environment: VerifiedStorePurchase["environment"]
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
    grantType: product.grantType,
    storeEnvironment: environment
  },
  createdAt: grantedAt,
  updatedAt: grantedAt
});

const validatePurchasePayload = (
  request:
    | PurchaseVerificationRequest
    | PurchaseRevocationRequest
    | { platform: "ios" | "android"; transactionId: string; receiptHash?: string; productId?: string }
): ApiResult<{ product?: CommerceProductDefinition }> => {
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
): ApiResult<{ product?: CommerceProductDefinition }> => {
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

const assertVerifiedPurchaseMatchesRequest = (
  request: PurchaseVerificationRequest,
  purchase: VerifiedStorePurchase
): ApiResult<{ purchase: VerifiedStorePurchase; product: CommerceProductDefinition }> => {
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
): ApiResult<{ purchase: VerifiedStorePurchase; product: CommerceProductDefinition }> => {
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

const purchaseVerificationUnavailable = <T = never>(): ApiResult<T> =>
  fail(503, "purchase_verification_unavailable", "Purchase verification is not available yet.");

const mapPurchaseVerifierError = <T>(error: {
  status: 400 | 409 | 422 | 503;
  code: string;
  messageSafe: string;
}): ApiResult<T> => fail(error.status, error.code, error.messageSafe);

const loadPremiumChatRecentMessagesUnavailable = <T = never>(): ApiResult<T> =>
  fail(503, "premium_chat_history_unavailable", "Premium chat is not available right now.");

const premiumChatRateLimited = <T = never>(retryAfterSeconds: number): ApiResult<T> =>
  fail(429, "premium_chat_rate_limited", `Premium chat is moving too fast. Try again in ${retryAfterSeconds} seconds.`);

const commerceRevocationOutboxAggregateType = "commerce_purchase";
const commerceRevocationOutboxEventType = "commerce.purchase_revoked";

const createCommerceRevocationAggregateId = (ledger: PurchaseLedgerRecord): string => {
  const digest = createHash("sha256").update(`${ledger.platform}:${ledger.transactionId}`).digest("hex");

  return `commerce_purchase_${digest.slice(0, 32)}`;
};

const requireAuthContext = (context: ApiAuthContext): ApiResult<AuthenticatedContext> => {
  if (!context.userId) {
    return fail(401, "auth_required", "Sign in is required.");
  }

  return ok({
    userId: context.userId,
    locale: context.locale ?? "ko-KR",
    timezone: context.timezone ?? "Asia/Seoul",
    authProvider: context.authProvider ?? "api",
    authSubject: context.authSubject ?? context.userId
  });
};

export const createPostgresApiService = ({
  repositories,
  now = systemNow,
  allowMockPurchaseVerification = false,
  allowMockStorageSigning = false,
  allowMockGenerationPolling = true,
  purchaseVerifier,
  privateStorageSigner,
  premiumChatProvider,
  premiumChatMonitor,
  premiumChatPolicy: premiumChatPolicyOptions
}: PostgresApiServiceOptions): AsyncOnlyApiService => {
  const chatProvider = premiumChatProvider ?? createLocalPremiumChatProvider();
  const premiumChatPolicy = resolvePremiumChatPolicy(premiumChatPolicyOptions);
  const weatherCache = new Map<string, WeatherLookupResponse>();

  const enqueueCommerceRevocationAuditEvent = async (
    ledger: PurchaseLedgerRecord,
    entitlement: Entitlement,
    reason: PurchaseRevocationRequest["reason"],
    revokedAt: ISODateTime
  ): Promise<void> => {
    try {
      await repositories.outbox.enqueueEvent({
        aggregateType: commerceRevocationOutboxAggregateType,
        aggregateId: createCommerceRevocationAggregateId(ledger),
        eventType: commerceRevocationOutboxEventType,
        payload: {
          platform: ledger.platform,
          productId: ledger.productId,
          entitlementKey: entitlement.key,
          revocationReason: reason,
          status: "revoked",
          revokedAt
        }
      });
    } catch {
      return;
    }
  };

  const requireAuth = async (context: ApiAuthContext): Promise<ApiResult<AuthenticatedContext>> => {
    const auth = requireAuthContext(context);

    if (!auth.ok) {
      return auth;
    }

    const timestamp = now();

    await repositories.userPets.upsertUser({
      id: auth.data.userId,
      authProvider: auth.data.authProvider,
      authSubject: auth.data.authSubject,
      locale: auth.data.locale,
      timezone: auth.data.timezone,
      now: timestamp
    });

    return auth;
  };

  const findOwnedPet = async (context: ApiAuthContext, petId: PetId): Promise<ApiResult<PetProfile>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await repositories.userPets.findOwnedLivePet(auth.data.userId, petId);

    return pet ? ok(pet) : fail(404, "pet_not_found", "Pet not found.");
  };

  const getCurrentUser = async (context: ApiAuthContext): Promise<ApiResult<CurrentUserResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      ...(await repositories.userPets.getCurrentUserOnboardingState(
        auth.data.userId,
        auth.data.locale,
        auth.data.timezone
      )),
      wallet: await ensureWallet(auth.data.userId)
    });
  };

  const listPets = async (context: ApiAuthContext): Promise<ApiResult<{ pets: PetProfile[] }>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      pets: await repositories.userPets.listLivePetsByUserId(auth.data.userId)
    });
  };

  const createPet = async (context: ApiAuthContext, request: CreatePetRequest): Promise<ApiResult<PetProfile>> => {
    const auth = await requireAuth(context);

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
      id: createPetId(),
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

    return ok(await repositories.userPets.upsertPet({ pet }), 201);
  };

  const updatePet = async (
    context: ApiAuthContext,
    petId: PetId,
    request: UpdatePetRequest
  ): Promise<ApiResult<PetProfile>> => {
    const existing = await findOwnedPet(context, petId);

    if (!existing.ok) {
      return existing;
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

    const updatedPet: PetProfile = {
      ...existing.data,
      ...(normalizedName?.ok ? { name: normalizedName.data } : {}),
      ...(personalityTags?.ok ? { personalityTags: personalityTags.data } : {}),
      ...(request.talkingStyle !== undefined ? { talkingStyle: request.talkingStyle } : {}),
      updatedAt: now()
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

    return ok(await repositories.userPets.upsertPet({ pet: updatedPet }));
  };

  const deletePet = async (context: ApiAuthContext, petId: PetId): Promise<ApiResult<{ deletedPetId: PetId; deletedAt: ISODateTime }>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const deletedAt = now();
    const deleted = await repositories.userPets.softDeletePet(auth.data.userId, petId, deletedAt);

    if (!deleted) {
      return fail(404, "pet_not_found", "Pet not found.");
    }

    await enqueuePrivacyDeletionJob(auth.data, "pet", deletedAt, petId);

    return ok({ deletedPetId: petId, deletedAt });
  };

  const findOwnedPhoto = async (context: ApiAuthContext, photoId: PhotoId) => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const photo = await repositories.generation.findOwnedOriginalPhoto(auth.data.userId, photoId);

    return photo ? ok(photo) : fail(404, "photo_not_found", "Photo not found.");
  };

  const findOwnedGenerationJob = async (context: ApiAuthContext, jobId: GenerationJobId) => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const job = await repositories.generation.findOwnedGenerationJob(auth.data.userId, jobId);

    return job ? ok(job) : fail(404, "generation_job_not_found", "Generation job not found.");
  };

  const findOwnedPetForAuth = async (auth: AuthenticatedContext, petId: PetId): Promise<ApiResult<PetProfile>> => {
    const pet = await repositories.userPets.findOwnedLivePet(auth.userId, petId);

    return pet ? ok(pet) : fail(404, "pet_not_found", "Pet not found.");
  };

  const enqueuePrivacyDeletionJob = async (
    auth: Pick<AuthenticatedContext, "userId">,
    scope: "original_photos" | "chat_history" | "pet",
    requestedAt: ISODateTime,
    targetId?: string
  ) =>
    repositories.privacy.enqueueDeletionJob({
      id: createPrivacyDeletionJobId(),
      userId: auth.userId,
      scope,
      ...(targetId ? { targetId } : {}),
      requestedAt
    });

  const ensureStarterItemCatalog = async (): Promise<Item[]> => {
    const existingItems = await repositories.dailyLoop.listItems();
    const existingById = new Map(existingItems.map((item) => [item.id, item]));
    const items = [...existingItems];

    for (const starterItem of mockItems) {
      if (!existingById.has(starterItem.id)) {
        const savedItem = await repositories.dailyLoop.upsertItem(starterItem);
        existingById.set(savedItem.id, savedItem);
        items.push(savedItem);
      }
    }

    return items.sort(compareItems);
  };

  const getItemCatalogSnapshot = async (): Promise<Item[]> => {
    const existingItems = await repositories.dailyLoop.listItems();
    const existingIds = new Set(existingItems.map((item) => item.id));

    return [...existingItems, ...mockItems.filter((item) => !existingIds.has(item.id))].sort(compareItems);
  };

  const ensureCareState = async (pet: PetProfile, timestamp: ISODateTime = now()): Promise<CareState> => {
    const existing = await repositories.dailyLoop.findCareState(pet.id);

    if (existing) {
      return existing;
    }

    return repositories.dailyLoop.upsertCareState(createStarterCareState(pet, timestamp));
  };

  const ensureRelationshipState = async (pet: PetProfile, timestamp: ISODateTime = now()): Promise<RelationshipState> => {
    const existing = await repositories.dailyLoop.findRelationshipState(pet.id);

    if (existing) {
      return existing;
    }

    return repositories.dailyLoop.upsertRelationshipState(createStarterRelationshipState(pet, timestamp));
  };

  const ensureWallet = async (userId: UserId, timestamp: ISODateTime = now()): Promise<CreditWallet> => {
    const existing = await repositories.dailyLoop.findCreditWallet(userId);

    if (existing) {
      return existing;
    }

    return repositories.dailyLoop.upsertCreditWallet(createStarterCreditWallet(userId, timestamp));
  };

  const ensureInventory = async (userId: UserId, timestamp: ISODateTime = now()): Promise<Inventory> => {
    const existing = await repositories.dailyLoop.findInventory(userId);

    if (existing) {
      return existing;
    }

    await ensureStarterItemCatalog();

    return repositories.dailyLoop.upsertInventory(createStarterInventory(userId, timestamp));
  };

  const getInventorySnapshot = async (userId: UserId, timestamp: ISODateTime = now()): Promise<Inventory> =>
    (await repositories.dailyLoop.findInventory(userId)) ?? createStarterInventory(userId, timestamp);

  const ensureStarterReactionCatalog = async (
    locale: Locale,
    timestamp: ISODateTime = now()
  ): Promise<{ locale: Locale; version: string; rules: ReactionRule[] }> => {
    const existing = await repositories.dailyLoop.findActiveReactionCatalogVersion(locale);

    if (existing) {
      return {
        locale: existing.locale,
        version: existing.version,
        rules: existing.rules.map(cloneReactionRule)
      };
    }

    const saved = await repositories.dailyLoop.upsertReactionCatalogVersion({
      locale,
      version: starterReactionCatalogVersion,
      rules: starterReactionRules.filter((rule) => rule.locale === locale).map(cloneReactionRule),
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return {
      locale: saved.locale,
      version: saved.version,
      rules: saved.rules.map(cloneReactionRule)
    };
  };

  const selectReactionForPet = async (
    auth: Pick<AuthenticatedContext, "userId" | "locale">,
    pet: PetProfile,
    careState: CareState,
    selectedAt: ISODateTime,
    context: Pick<Parameters<typeof selectLocalReaction>[1], "recentAction" | "walkStatus" | "eventContext"> = {}
  ): Promise<SelectedReaction> => {
    const reactionCatalog = await ensureStarterReactionCatalog(auth.locale, selectedAt);
    const selectedReaction = selectLocalReaction(
      reactionCatalog.rules,
      {
        locale: auth.locale,
        now: selectedAt,
        pet,
        careState,
        daysAway: 0,
        recentReactions: await repositories.dailyLoop.listRecentReactionsForPet(auth.userId, pet.id),
        ...context
      },
      { random: () => 0 }
    );

    const savedReaction = await repositories.dailyLoop.upsertRecentReaction({
      userId: auth.userId,
      petId: pet.id,
      ruleId: selectedReaction.ruleId,
      line: selectedReaction.line,
      shownAt: selectedAt
    });

    return {
      ...selectedReaction,
      line: savedReaction.line
    };
  };

  const getCareState = async (context: ApiAuthContext, petId: PetId): Promise<ApiResult<CareState>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await findOwnedPetForAuth(auth.data, petId);

    if (!pet.ok) {
      return pet;
    }

    return ok(projectCareStateForTime(await ensureCareState(pet.data), now()));
  };

  const getRelationshipState = async (context: ApiAuthContext, petId: PetId): Promise<ApiResult<RelationshipState>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await findOwnedPetForAuth(auth.data, petId);

    if (!pet.ok) {
      return pet;
    }

    return ok(await ensureRelationshipState(pet.data));
  };

  const getItemCatalog = async (context: ApiAuthContext): Promise<ApiResult<ItemCatalogResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      items: await ensureStarterItemCatalog()
    });
  };

  const getInventory = async (context: ApiAuthContext): Promise<ApiResult<Inventory>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok(await ensureInventory(auth.data.userId));
  };

  const purchaseInventoryItem = async (
    context: ApiAuthContext,
    request: PurchaseInventoryItemRequest
  ): Promise<ApiResult<PurchaseInventoryItemResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const itemId = request && typeof request.itemId === "string" ? request.itemId : "";
    const itemCatalog = await ensureStarterItemCatalog();
    const item = itemCatalog.find((candidate) => candidate.id === itemId);

    if (!item) {
      return fail(404, "catalog_item_not_found", "Shop item not found.");
    }

    const price = getCreditItemPrice(itemId);

    if (!price) {
      return fail(422, "item_not_credit_purchasable", "This item is not available for credits.");
    }

    const purchasedAt = now();
    const walletSpend = spendCredits(await ensureWallet(auth.data.userId, purchasedAt), price.creditCost, purchasedAt);

    if (!walletSpend.ok) {
      return fail(403, "insufficient_credits", "Not enough credits for this item.");
    }

    const inventory = grantInventoryItem(await ensureInventory(auth.data.userId, purchasedAt), item.id, purchasedAt, "purchase");
    const [savedWallet, savedInventory] = await Promise.all([
      repositories.dailyLoop.upsertCreditWallet(walletSpend.wallet),
      repositories.dailyLoop.upsertInventory(inventory)
    ]);

    return ok(
      {
        item,
        inventory: savedInventory,
        wallet: savedWallet,
        walletSpend: walletSpend.spend,
        creditCost: price.creditCost
      },
      201
    );
  };

  const placeInventoryItem = async (
    context: ApiAuthContext,
    request: PlaceInventoryItemRequest
  ): Promise<ApiResult<InventoryPlacementResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const itemId = request && typeof request.itemId === "string" ? request.itemId : "";
    const inventory = await ensureInventory(auth.data.userId);
    const ownedItem = inventory.items.find((entry) => entry.itemId === itemId && entry.quantity > 0);

    if (!ownedItem) {
      return fail(404, "inventory_item_not_found", "Inventory item not found.");
    }

    if (inventory.placedItems.some((placedItem) => placedItem.itemId === itemId)) {
      return ok({ inventory });
    }

    const placedAt = now();
    const itemCatalog = await ensureStarterItemCatalog();
    const placed = placeInventoryItemInFixedSlot(inventory, itemCatalog, itemId, placedAt);

    if (!placed.ok) {
      return fail(404, "inventory_item_not_found", "Inventory item not found.");
    }

    return ok({
      inventory: await repositories.dailyLoop.upsertInventory(placed.inventory)
    });
  };

  const removePlacedItem = async (
    context: ApiAuthContext,
    itemId: ItemId
  ): Promise<ApiResult<InventoryPlacementResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const inventory = await ensureInventory(auth.data.userId);
    const placedItems = inventory.placedItems.filter((placedItem) => placedItem.itemId !== itemId).map(clonePlacedItem);

    if (placedItems.length === inventory.placedItems.length) {
      return ok({ inventory });
    }

    const updatedInventory: Inventory = {
      ...inventory,
      placedItems,
      updatedAt: now()
    };

    return ok({
      inventory: await repositories.dailyLoop.upsertInventory(updatedInventory)
    });
  };

  const getReactionCatalog = async (
    context: ApiAuthContext
  ): Promise<ApiResult<{ locale: Locale; version: string; rules: ReactionRule[] }>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      ...(await ensureStarterReactionCatalog(auth.data.locale))
    });
  };

  const getCurrentWeather = async (
    context: ApiAuthContext,
    request: WeatherLookupRequest
  ): Promise<ApiResult<WeatherLookupResponse>> => {
    const auth = await requireAuth(context);

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

    const weather = createApproximateLocationWeatherContext(coordinates, fetchedAt, {
      locale: request.locale ?? auth.data.locale
    });
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

  const startWalk = async (context: ApiAuthContext, petId: PetId): Promise<ApiResult<StartWalkResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await findOwnedPetForAuth(auth.data, petId);

    if (!pet.ok) {
      return pet;
    }

    const existingWalk = await repositories.dailyLoop.findActiveWalkForPet(auth.data.userId, petId);

    if (existingWalk) {
      return fail(409, "walk_already_active", "Finish the current walk before starting another.");
    }

    const startedAt = now();
    const returnAt = addMs(startedAt, MOCK_WALK_DURATION_MS);
    const walk: WalkSession = {
      id: createWalkSessionId(),
      userId: auth.data.userId,
      petId,
      status: "walking",
      startedAt,
      returnAt,
      rewardItemIds: [WALK_REWARD_ITEM_ID],
      discoveryLine: walkDiscoveryLineByLocale[auth.data.locale],
      energyCost: 12,
      createdAt: startedAt,
      updatedAt: startedAt
    };
    const careResult = applyLocalCareAction(await ensureCareState(pet.data, startedAt), {
      action: "walk",
      occurredAt: startedAt
    });
    const careState: CareState = {
      ...careResult.nextState,
      activeWalkId: walk.id
    };
    const relationshipState = applyRelationshipCareAction(await ensureRelationshipState(pet.data, startedAt), "walk", startedAt);
    const savedWalk = await repositories.dailyLoop.upsertWalkSession(walk);
    const savedCareState = await repositories.dailyLoop.upsertCareState(careState);
    const savedRelationshipState = await repositories.dailyLoop.upsertRelationshipState(relationshipState);
    const reaction = await selectReactionForPet(auth.data, pet.data, savedCareState, startedAt, {
      recentAction: "walk",
      walkStatus: "walking"
    });

    return ok({ walk: savedWalk, careState: savedCareState, relationshipState: savedRelationshipState, reaction }, 201);
  };

  const performCareAction = async (
    context: ApiAuthContext,
    petId: PetId,
    request: CareActionRequest
  ): Promise<ApiResult<CareActionResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await findOwnedPetForAuth(auth.data, petId);

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
      const inventory = await getInventorySnapshot(auth.data.userId, request.occurredAt);
      const itemCatalog = await getItemCatalogSnapshot();
      const treatItemId = request.itemId ?? getAvailableTreatItemId(inventory, itemCatalog);
      const treatItem = treatItemId ? itemCatalog.find((item) => item.id === treatItemId) : null;

      if (!treatItemId || !treatItem) {
        return request.itemId
          ? fail(404, "inventory_item_not_found", "Inventory item not found.")
          : fail(404, "treat_item_not_found", "Add a treat before using this action.");
      }

      if (!isCareItemEligibleForAction(treatItem, request.action)) {
        return fail(422, "invalid_treat_item", "Choose a treat item for this action.");
      }

      const consumed = consumeInventoryItem(inventory, treatItemId, request.occurredAt);

      if (!consumed.ok) {
        return fail(404, "inventory_item_not_found", "Inventory item not found.");
      }

      consumedInventory = consumed.inventory;
    } else if (request.action === "water_garden" && request.itemId) {
      const inventory = await getInventorySnapshot(auth.data.userId, request.occurredAt);
      const itemCatalog = await getItemCatalogSnapshot();
      const drinkItem = itemCatalog.find((item) => item.id === request.itemId);

      if (!drinkItem) {
        return fail(404, "inventory_item_not_found", "Inventory item not found.");
      }

      if (!isCareItemEligibleForAction(drinkItem, request.action)) {
        return fail(422, "invalid_drink_item", "Choose a drink item for this action.");
      }

      const consumed = consumeInventoryItem(inventory, request.itemId, request.occurredAt);

      if (!consumed.ok) {
        return fail(404, "inventory_item_not_found", "Inventory item not found.");
      }

      consumedInventory = consumed.inventory;
    } else if (request.itemId) {
      const itemCatalog = await getItemCatalogSnapshot();
      const careItem = itemCatalog.find((item) => item.id === request.itemId);

      if (!careItem) {
        return fail(404, "inventory_item_not_found", "Inventory item not found.");
      }

      if (!isCareItemEligibleForAction(careItem, request.action)) {
        return fail(422, "invalid_care_item", "Choose an item made for this care action.");
      }

      const inventory = await getInventorySnapshot(auth.data.userId, request.occurredAt);
      const ownedItem = inventory.items.find((entry) => entry.itemId === request.itemId && entry.quantity > 0);

      if (!ownedItem) {
        return fail(404, "inventory_item_not_found", "Inventory item not found.");
      }
    }

    if (request.action === "walk") {
      const started = await startWalk(context, petId);

      if (!started.ok) {
        return started;
      }

      return ok({
        careState: started.data.careState,
        relationshipState: started.data.relationshipState,
        inventory: null,
        reaction: started.data.reaction,
        reward: null
      });
    }

    const result = applyLocalCareAction(await ensureCareState(pet.data, request.occurredAt), request);
    const wateredGarden =
      request.action === "water_garden"
        ? waterGardenInventory(
            consumedInventory ?? (await ensureInventory(auth.data.userId, request.occurredAt)),
            await ensureStarterItemCatalog(),
            request.occurredAt
          )
        : null;
    const bloomRewardSummary = summarizePlantBloomRewards(wateredGarden?.bloomRewards ?? []);
    const baseRelationshipState = applyRelationshipCareAction(
      await ensureRelationshipState(pet.data, request.occurredAt),
      request.action,
      request.occurredAt
    );
    const relationshipState =
      bloomRewardSummary.bondXp > 0 ? grantRelationshipBondXp(baseRelationshipState, bloomRewardSummary.bondXp, request.occurredAt) : baseRelationshipState;
    const wallet =
      bloomRewardSummary.bonusCredits > 0
        ? grantCreditWalletValue(await ensureWallet(auth.data.userId, request.occurredAt), { bonusCredits: bloomRewardSummary.bonusCredits }, request.occurredAt)
        : null;
    const inventory = request.action === "water_garden" ? wateredGarden?.inventory ?? null : consumedInventory;
    const savedCareState = await repositories.dailyLoop.upsertCareState(result.nextState);
    const savedRelationshipState = await repositories.dailyLoop.upsertRelationshipState(relationshipState);
    const savedInventory = inventory ? await repositories.dailyLoop.upsertInventory(inventory) : null;
    const savedWallet = wallet ? await repositories.dailyLoop.upsertCreditWallet(wallet) : null;
    const reaction = await selectReactionForPet(auth.data, pet.data, savedCareState, request.occurredAt, {
      recentAction: request.action
    });

    return ok({
      careState: savedCareState,
      relationshipState: savedRelationshipState,
      inventory: savedInventory,
      ...(savedWallet ? { wallet: savedWallet } : {}),
      reaction,
      reward: wateredGarden?.bloomRewards[0] ?? null
    });
  };

  const claimWalkReward = async (
    context: ApiAuthContext,
    walkId: WalkSessionId
  ): Promise<ApiResult<ClaimWalkResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const existingWalk = await repositories.dailyLoop.findWalkSession(auth.data.userId, walkId);

    if (!existingWalk) {
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

    const pet = await findOwnedPetForAuth(auth.data, returnedWalk.petId);

    if (!pet.ok) {
      return pet;
    }

    const rewardItemId = returnedWalk.rewardItemIds[0] ?? WALK_REWARD_ITEM_ID;
    const inventory = grantInventoryItem(await ensureInventory(auth.data.userId, claimedAt), rewardItemId, claimedAt);
    const careState = clearCareWalkId(await ensureCareState(pet.data, claimedAt), claimedAt);
    const relationshipState = await ensureRelationshipState(pet.data, claimedAt);
    const claimedWalk: WalkSession = {
      ...returnedWalk,
      status: "claimed",
      claimedAt,
      updatedAt: claimedAt
    };
    await ensureStarterItemCatalog();
    const savedInventory = await repositories.dailyLoop.upsertInventory(inventory);
    const savedCareState = await repositories.dailyLoop.upsertCareState(careState);
    const savedWalk = await repositories.dailyLoop.upsertWalkSession(claimedWalk);
    const reaction = await selectReactionForPet(auth.data, pet.data, savedCareState, claimedAt, {
      eventContext: "walk_reward_claimed",
      walkStatus: "claimed"
    });

    return ok({
      walk: savedWalk,
      inventory: savedInventory,
      relationshipState,
      reaction
    });
  };

  const listCommerceProducts = async (context: ApiAuthContext): Promise<ApiResult<CommerceProductsResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      products: commerceProducts.map((product) => ({ ...product }))
    });
  };

  const listEntitlements = async (context: ApiAuthContext): Promise<ApiResult<EntitlementsResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      entitlements: await repositories.commerce.listEntitlementsForUser(auth.data.userId)
    });
  };

  const hasActiveEntitlement = async (
    context: ApiAuthContext,
    key: EntitlementKey
  ): Promise<ApiResult<{ active: boolean }>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return ok({
      active: await repositories.commerce.hasActiveEntitlement(auth.data.userId, key, now())
    });
  };

  const requireActiveEntitlementForAuth = async (
    auth: AuthenticatedContext,
    key: EntitlementKey
  ): Promise<ApiResult<{ key: EntitlementKey }>> => {
    const active = await repositories.commerce.hasActiveEntitlement(auth.userId, key, now());

    if (!active) {
      return fail(403, "entitlement_required", "Plus pass required for longer chat.");
    }

    return ok({ key });
  };

  const requireActiveEntitlement = async (
    context: ApiAuthContext,
    key: EntitlementKey
  ): Promise<ApiResult<{ key: EntitlementKey }>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    return requireActiveEntitlementForAuth(auth.data, key);
  };

  const emptyWalletSpend = (): CreditWalletSpendBreakdown => ({
    freeChatTicketsSpent: 0,
    bonusCreditsSpent: 0,
    creditsSpent: 0
  });

  const resolvePremiumChatAccessForAuth = async (
    auth: AuthenticatedContext,
    checkedAt: ISODateTime
  ): Promise<ApiResult<{ mode: "entitlement" | "wallet"; wallet: CreditWallet }>> => {
    const wallet = await ensureWallet(auth.userId, checkedAt);
    const active = await repositories.commerce.hasActiveEntitlement(auth.userId, premiumChatGate.requiredEntitlement, checkedAt);

    if (active) {
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

  const grantWalletForConsumablePurchase = async (
    userId: UserId,
    product: CommerceProductDefinition,
    grantedAt: ISODateTime
  ): Promise<CreditWallet | null> => {
    const walletGrant = getConsumableWalletGrant(product);

    if (!walletGrant) {
      return null;
    }

    const wallet = grantCreditWalletValue(await ensureWallet(userId, grantedAt), walletGrant, grantedAt);

    return repositories.dailyLoop.upsertCreditWallet(wallet);
  };

  const grantVerifiedPurchase = async (
    auth: Pick<AuthenticatedContext, "userId">,
    purchase: VerifiedStorePurchase,
    product: CommerceProductDefinition,
    source: Extract<Entitlement["source"], "purchase" | "restore">
  ): Promise<ApiResult<{ entitlement: Entitlement; wallet: CreditWallet | null }>> => {
    const existingLedgerRecord = await repositories.commerce.findLedgerByTransactionId(purchase.transactionId);
    const grantedAt = purchase.verifiedAt ?? now();

    if (existingLedgerRecord && existingLedgerRecord.userId !== auth.userId) {
      return fail(409, "purchase_belongs_to_another_user", "Purchase is already linked to another account.");
    }

    if (existingLedgerRecord && existingLedgerRecord.platform !== purchase.platform) {
      return fail(409, "purchase_verification_mismatch", "Purchase verification result did not match the request.");
    }

    if (existingLedgerRecord) {
      const existingEntitlement = await repositories.commerce.findEntitlementById(existingLedgerRecord.entitlementId);

      if (!existingEntitlement) {
        return fail(409, "entitlement_ledger_inconsistent", "Purchase entitlement could not be restored.");
      }

      if (source === "restore" && existingEntitlement.status !== "revoked") {
        const restoredEntitlement = await repositories.commerce.markEntitlementRestored(existingEntitlement.id, grantedAt, {
          restored: true,
          storeEnvironment: purchase.environment
        });

        if (!restoredEntitlement) {
          return fail(409, "entitlement_ledger_inconsistent", "Purchase entitlement could not be restored.");
        }

        await repositories.commerce.markLedgerRestored(purchase.transactionId, grantedAt);

        return ok({
          entitlement: restoredEntitlement,
          wallet: getConsumableWalletGrant(product) ? await ensureWallet(auth.userId, grantedAt) : null
        });
      }

      return ok({
        entitlement: existingEntitlement,
        wallet: getConsumableWalletGrant(product) ? await ensureWallet(auth.userId, grantedAt) : null
      });
    }

    const entitlement = buildGrantedEntitlement(auth.userId, product, purchase.transactionId, source, grantedAt, purchase.environment);
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
    const savedEntitlement = await repositories.commerce.upsertEntitlement(entitlement);

    await repositories.commerce.upsertPurchaseLedgerRecord(ledgerRecord);

    return ok(
      {
        entitlement: savedEntitlement,
        wallet: await grantWalletForConsumablePurchase(auth.userId, product, grantedAt)
      },
      201
    );
  };

  const verifyPurchase = async (
    context: ApiAuthContext,
    request: PurchaseVerificationRequest
  ): Promise<ApiResult<PurchaseVerificationResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const validation = validatePurchasePayload(request);

    if (!validation.ok) {
      return validation;
    }

    const product = validation.data.product;

    if (!product) {
      return fail(422, "unknown_product", "Purchase product is not available.");
    }

    if (purchaseVerifier) {
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

      const granted = await grantVerifiedPurchase(auth.data, matchedPurchase.data.purchase, matchedPurchase.data.product, "purchase");

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
    }

    if (!allowMockPurchaseVerification) {
      return purchaseVerificationUnavailable();
    }

    const granted = await grantVerifiedPurchase(
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

  const verifyPurchaseWithStoreVerifier = verifyPurchase;

  const restorePurchases = async (
    context: ApiAuthContext,
    request: RestorePurchasesRequest
  ): Promise<ApiResult<PurchaseVerificationResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const normalized = normalizeRestorePurchasesRequest(request);

    if (!normalized.ok) {
      return normalized;
    }

    if (purchaseVerifier) {
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

        const granted = await grantVerifiedPurchase(auth.data, matchedPurchase.data.purchase, matchedPurchase.data.product, "restore");

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
    }

    if (!allowMockPurchaseVerification) {
      return purchaseVerificationUnavailable();
    }

    const ledgerRecords = await repositories.commerce.listLedgerRecordsForRestore(
      auth.data.userId,
      normalized.data.request.platform,
      normalized.data.request.transactionIds
    );
    const restoredEntitlements: Entitlement[] = [];
    const restoredAt = now();
    let latestWallet: CreditWallet | null = null;

    for (const ledgerRecord of ledgerRecords) {
      const entitlement = await repositories.commerce.markEntitlementRestored(ledgerRecord.entitlementId, restoredAt, {
        restored: true
      });

      if (!entitlement) {
        continue;
      }

      await repositories.commerce.markLedgerRestored(ledgerRecord.transactionId, restoredAt);
      restoredEntitlements.push(entitlement);

      const product = commerceProductById.get(ledgerRecord.productId);

      if (product && getConsumableWalletGrant(product)) {
        latestWallet = await ensureWallet(auth.data.userId, restoredAt);
      }
    }

    return ok({
      entitlements: restoredEntitlements,
      ...(latestWallet ? { wallet: latestWallet } : {}),
      serverVerified: true
    });
  };

  const restorePurchasesWithStoreVerifier = restorePurchases;

  const revokeLedgerEntitlement = async (
    ledger: Awaited<ReturnType<typeof repositories.commerce.markLedgerRevoked>>,
    revokedAt: ISODateTime,
    reason: PurchaseRevocationRequest["reason"]
  ): Promise<ApiResult<PurchaseRevocationResponse>> => {
    if (!ledger) {
      return fail(404, "purchase_not_found", "Purchase not found.");
    }

    const entitlement = await repositories.commerce.markEntitlementRevoked(ledger.entitlementId, revokedAt, reason);

    if (!entitlement) {
      return fail(409, "entitlement_ledger_inconsistent", "Purchase entitlement could not be restored.");
    }

    await enqueueCommerceRevocationAuditEvent(ledger, entitlement, reason, revokedAt);

    return ok({ entitlement, revoked: true });
  };

  const revokePurchase = async (request: PurchaseRevocationRequest): Promise<ApiResult<PurchaseRevocationResponse>> => {
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

    const revokedAt = now();
    const ledger = await repositories.commerce.markLedgerRevoked({
      platform: request.platform,
      transactionId: request.transactionId,
      reason: request.reason,
      revokedAt
    });

    return revokeLedgerEntitlement(ledger, revokedAt, request.reason);
  };

  const revokePurchaseByReceiptHash = async (
    request: PurchaseReceiptRevocationRequest
  ): Promise<ApiResult<PurchaseRevocationResponse>> => {
    const validation = validatePurchaseReceiptRevocationPayload(request);

    if (!validation.ok) {
      return validation;
    }

    const revokedAt = now();
    const ledger = await repositories.commerce.markLedgerRevokedByReceiptHash({
      platform: request.platform,
      receiptHash: request.receiptHash,
      ...(request.productId ? { productId: request.productId } : {}),
      reason: request.reason,
      revokedAt
    });

    return revokeLedgerEntitlement(ledger, revokedAt, request.reason);
  };

  const getConversationThread = async (
    context: ApiAuthContext,
    conversationId: ConversationId
  ): Promise<ApiResult<ConversationThreadResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const conversation = await repositories.chat.findOwnedConversation(auth.data.userId, conversationId);

    if (!conversation) {
      return fail(404, "conversation_not_found", "Conversation not found.");
    }

    return ok({
      conversation,
      messages: filterPremiumChatRetainedMessages(
        await repositories.chat.listMessagesForOwnedConversation(auth.data.userId, conversation.id),
        now(),
        premiumChatPolicy
      )
    });
  };

  const deleteConversation = async (
    context: ApiAuthContext,
    conversationId: ConversationId
  ): Promise<ApiResult<DeleteConversationResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const deletedAt = now();
    const deleted = await repositories.chat.deleteOwnedConversation(auth.data.userId, conversationId, deletedAt);

    if (!deleted) {
      return fail(404, "conversation_not_found", "Conversation not found.");
    }

    return ok({
      deletedConversationId: deleted.conversation.id,
      deletedMessageIds: deleted.deletedMessageIds,
      deletedAt
    });
  };

  const deleteChatHistory = async (context: ApiAuthContext): Promise<ApiResult<DeleteChatHistoryResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const deletedAt = now();
    const deleted = await repositories.chat.deleteChatHistoryForUser(auth.data.userId, deletedAt);

    await enqueuePrivacyDeletionJob(auth.data, "chat_history", deletedAt);

    return ok({
      deletedConversationIds: deleted.deletedConversationIds,
      deletedMessageIds: deleted.deletedMessageIds,
      deletedAt: deleted.deletedAt
    });
  };

  const createPremiumConversation = async (
    context: ApiAuthContext,
    request: CreateConversationRequest
  ): Promise<ApiResult<CreateConversationResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await findOwnedPetForAuth(auth.data, request.petId);

    if (!pet.ok) {
      return pet;
    }

    if (!request.disclosureAccepted) {
      return fail(422, "ai_disclosure_required", "AI chat disclosure must be accepted before premium chat.");
    }

    const createdAt = now();
    const chatAccess = await resolvePremiumChatAccessForAuth(auth.data, createdAt);

    if (!chatAccess.ok) {
      return chatAccess;
    }

    const conversation: Conversation = {
      id: createConversationId(),
      userId: auth.data.userId,
      petId: request.petId,
      type: "premium_ai_chat",
      status: "open",
      disclosureAcceptedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    };

    return ok(
      {
        conversation: await repositories.chat.upsertConversation(conversation),
        disclosureText: premiumChatGate.disclosureText
      },
      201
    );
  };

  const sendPremiumConversationMessage = async (
    context: ApiAuthContext,
    request: SendConversationMessageRequest
  ): Promise<ApiResult<SendConversationMessageResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const conversation = await repositories.chat.findOwnedConversation(auth.data.userId, request.conversationId as ConversationId);

    if (!conversation) {
      return fail(404, "conversation_not_found", "Conversation not found.");
    }

    if (conversation.type !== "premium_ai_chat" || !conversation.disclosureAcceptedAt) {
      return fail(409, "conversation_not_ready", "Premium chat disclosure must be accepted first.");
    }

    const pet = await findOwnedPetForAuth(auth.data, conversation.petId);

    if (!pet.ok) {
      return pet;
    }

    const moderation = moderatePremiumChatInput(request.text, auth.data.locale);

    if (!moderation.ok) {
      return fail(moderation.status, moderation.code, moderation.messageSafe);
    }

    const createdAt = now();
    let providerReply: PremiumChatProviderResult;
    let recentMessages: ConversationMessage[];

    try {
      recentMessages = await repositories.chat.listMessagesForOwnedConversation(auth.data.userId, conversation.id);
    } catch {
      return loadPremiumChatRecentMessagesUnavailable();
    }

    const retainedRecentMessages = filterPremiumChatRetainedMessages(recentMessages, createdAt, premiumChatPolicy);
    const rateLimit = checkPremiumChatRateLimit(retainedRecentMessages, createdAt, premiumChatPolicy);

    if (rateLimit.limited) {
      return premiumChatRateLimited(rateLimit.retryAfterSeconds ?? 1);
    }

    const chatAccess = await resolvePremiumChatAccessForAuth(auth.data, createdAt);

    if (!chatAccess.ok) {
      return chatAccess;
    }

    const providerRecentMessages = selectPremiumChatContextMessages(retainedRecentMessages, premiumChatPolicy);
    const monitorMetadata = {
      conversationId: conversation.id,
      petId: pet.data.id,
      locale: auth.data.locale,
      recentMessageCount: providerRecentMessages.length,
      inputSafetyFlags: moderation.safetyFlags
    };

    let chatCareContext: PremiumChatCareContext | undefined;

    try {
      const petCareState = await repositories.dailyLoop.findCareState(pet.data.id);

      if (petCareState) {
        chatCareContext = {
          satiety: petCareState.satiety,
          energy: petCareState.energy,
          happiness: petCareState.happiness,
          affection: petCareState.affection,
          cleanliness: petCareState.cleanliness,
          gardenHealth: petCareState.gardenHealth,
          daysAway: getCareDaysAway(petCareState, createdAt)
        };
      }
    } catch {
      // Care context is a best-effort enrichment; chat proceeds without it.
    }

    try {
      providerReply = await chatProvider.generateReply({
        auth: auth.data,
        conversation,
        pet: pet.data,
        userText: moderation.normalizedText,
        safetyFlags: moderation.safetyFlags,
        now: createdAt,
        recentMessages: providerRecentMessages,
        ...(chatCareContext ? { careContext: chatCareContext } : {})
      });
    } catch {
      emitPremiumChatMonitorEvent(premiumChatMonitor, "error", "premium_chat_provider_unavailable", {
        ...monitorMetadata,
        failureCode: "premium_chat_provider_unavailable",
        failureStatus: 503
      });

      return fail(503, "premium_chat_provider_unavailable", "Premium chat is not available right now.");
    }

    const providerOutput = moderatePremiumChatProviderReply(providerReply, auth.data.locale);

    if (!providerOutput.ok) {
      emitPremiumChatMonitorEvent(premiumChatMonitor, "error", "premium_chat_provider_output_rejected", {
        ...monitorMetadata,
        outputSafetyFlags: providerReply.safetyFlags,
        failureCode: providerOutput.code,
        failureStatus: providerOutput.status
      });

      return fail(providerOutput.status, providerOutput.code, providerOutput.messageSafe);
    }

    const providerOutputModerated = providerOutput.safetyFlags.includes("provider_output_moderated");

    if (providerOutputModerated) {
      emitPremiumChatMonitorEvent(premiumChatMonitor, "info", "premium_chat_provider_output_moderated", {
        ...monitorMetadata,
        outputSafetyFlags: providerOutput.safetyFlags,
        providerOutputModerated
      });
    }

    emitPremiumChatMonitorEvent(premiumChatMonitor, "info", "premium_chat_provider_succeeded", {
      ...monitorMetadata,
      outputSafetyFlags: providerOutput.safetyFlags,
      providerOutputModerated
    });

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

    const responseWallet =
      chatAccess.data.mode === "entitlement"
        ? walletSpend.wallet
        : await repositories.dailyLoop.upsertCreditWallet(walletSpend.wallet);

    const messages: [ConversationMessage, ConversationMessage] = [
      {
        id: createConversationMessageId(),
        conversationId: conversation.id,
        sender: "user",
        text: moderation.normalizedText,
        safetyFlags: moderation.safetyFlags,
        createdAt
      },
      {
        id: createConversationMessageId(),
        conversationId: conversation.id,
        sender: "pet_ai",
        text: providerOutput.text,
        safetyFlags: providerOutput.safetyFlags,
        createdAt
      }
    ];
    const [userMessage, petMessage] = await repositories.chat.upsertMessages(messages);

    await repositories.chat.touchOwnedConversation(auth.data.userId, conversation.id, createdAt);

    if (!userMessage || !petMessage) {
      return fail(503, "conversation_message_unavailable", "Premium chat message could not be stored.");
    }

    return ok({
      userMessage,
      petMessage,
      safetyFlags: Array.from(new Set([...moderation.safetyFlags, ...providerOutput.safetyFlags])),
      wallet: responseWallet,
      walletSpend: walletSpend.spend
    });
  };

  const validatePhotoUploadRequest = async (
    context: ApiAuthContext,
    request: PhotoUploadUrlRequest
  ): Promise<ApiResult<{ auth: AuthenticatedContext; pet: PetProfile }>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await repositories.userPets.findOwnedLivePet(auth.data.userId, request.petId);

    if (!pet) {
      return fail(404, "pet_not_found", "Pet not found.");
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

    return ok({ auth: auth.data, pet });
  };

  const issuePhotoUploadUrlWithStorageSigner = async (
    context: ApiAuthContext,
    request: PhotoUploadUrlRequest
  ): Promise<ApiResult<PhotoUploadUrlResponse>> => {
    const validated = await validatePhotoUploadRequest(context, request);

    if (!validated.ok) {
      return validated;
    }

    if (!privateStorageSigner && !allowMockStorageSigning) {
      return storageSigningUnavailable();
    }

    const issuedAt = now();
    const expiresAt = addMs(issuedAt, UPLOAD_URL_TTL_MS);
    const photoId = createPhotoId();
    const mockUploadUrl = `mock-signed-upload://private/${safeStorageSegment(validated.data.auth.userId)}/${safeStorageSegment(
      request.petId
    )}/${photoId}?expires_at=${encodeURIComponent(expiresAt)}`;
    let signed: {
      uploadUrl: string;
      uploadMethod: "PUT" | "POST";
      uploadHeaders: Record<string, string>;
      storageUri?: string;
      expiresAt: ISODateTime;
      maxByteSize: number;
    } = {
      uploadUrl: mockUploadUrl,
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": request.contentType
      },
      expiresAt,
      maxByteSize: MAX_SOURCE_PHOTO_BYTES
    };

    if (privateStorageSigner) {
      const signedUpload = await privateStorageSigner.createOriginalPhotoUpload({
        userId: validated.data.auth.userId,
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

      signed = {
        uploadUrl: signedUpload.signed.uploadUrl,
        uploadMethod: signedUpload.signed.uploadMethod,
        uploadHeaders: signedUpload.signed.uploadHeaders ?? {
          "Content-Type": request.contentType
        },
        ...(signedUpload.signed.storageUri ? { storageUri: signedUpload.signed.storageUri } : {}),
        expiresAt: signedUpload.signed.expiresAt ?? expiresAt,
        maxByteSize: signedUpload.signed.maxByteSize ?? MAX_SOURCE_PHOTO_BYTES
      };
    }

    const photo: OriginalPhotoRecord = {
      id: photoId,
      userId: validated.data.auth.userId,
      petId: request.petId,
      contentType: request.contentType,
      byteSize: request.byteSize,
      status: "upload_url_issued",
      uploadUrl: signed.uploadUrl,
      ...(signed.storageUri ? { storageUri: signed.storageUri } : {}),
      expiresAt: signed.expiresAt,
      createdAt: issuedAt,
      updatedAt: issuedAt
    };
    const savedPhoto = await repositories.generation.upsertOriginalPhoto({ photo });

    return ok(
      {
        photoId: savedPhoto.id,
        uploadUrl: signed.uploadUrl,
        uploadMethod: signed.uploadMethod,
        uploadHeaders: signed.uploadHeaders,
        expiresAt: savedPhoto.expiresAt,
        maxByteSize: signed.maxByteSize
      },
      201
    );
  };

  const issuePhotoUploadUrl = (context: ApiAuthContext, request: PhotoUploadUrlRequest) =>
    issuePhotoUploadUrlWithStorageSigner(context, request);

  const completePhotoUpload = async (
    context: ApiAuthContext,
    request: CompletePhotoUploadRequest
  ): Promise<ApiResult<CompletePhotoUploadResponse>> => {
    const photo = await findOwnedPhoto(context, request.photoId);

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

    const updatedPhoto = await repositories.generation.markOriginalPhotoUploaded({
      userId: photo.data.userId,
      photoId: request.photoId,
      contentHash: request.contentHash,
      uploadedAt: completedAt
    });

    return updatedPhoto ? ok({ photo: updatedPhoto }) : fail(409, "photo_upload_not_pending", "Photo upload is not pending.");
  };

  const deleteOriginalPhotos = async (
    context: ApiAuthContext,
    request: DeleteOriginalPhotosRequest
  ): Promise<ApiResult<DeleteOriginalPhotosResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await findOwnedPetForAuth(auth.data, request.petId);

    if (!pet.ok) {
      return pet;
    }

    const deletedAt = now();
    const deletedPhotos = await repositories.generation.markOriginalPhotosDeletedForPet({
      userId: auth.data.userId,
      petId: request.petId,
      deletedAt
    });
    const updatedPet: PetProfile = {
      ...pet.data,
      originalPhotoDeletedAt: deletedAt,
      updatedAt: deletedAt
    };

    await repositories.userPets.upsertPet({ pet: updatedPet });
    await enqueuePrivacyDeletionJob(auth.data, "original_photos", deletedAt, request.petId);

    return ok({
      deletedPhotoIds: deletedPhotos.map((photo) => photo.id),
      deletedAt
    });
  };

  const createGenerationJob = async (
    context: ApiAuthContext,
    request: CreateGenerationJobRequest
  ): Promise<ApiResult<GenerationJob>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await repositories.userPets.findOwnedLivePet(auth.data.userId, request.petId);

    if (!pet) {
      return fail(404, "pet_not_found", "Pet not found.");
    }

    const sourcePhotoIds = Array.isArray(request.sourcePhotoIds) ? request.sourcePhotoIds : [];
    const optionalPhotoIds = Array.isArray(request.optionalPhotoIds) ? request.optionalPhotoIds : [];

    if (sourcePhotoIds.length === 0) {
      return fail(422, "source_photo_required", "A source pet photo is required.");
    }

    for (const photoId of [...sourcePhotoIds, ...optionalPhotoIds]) {
      const photo = await repositories.generation.findOwnedOriginalPhoto(auth.data.userId, photoId);

      if (!photo) {
        return fail(404, "photo_not_found", "Photo not found.");
      }

      if (photo.petId !== request.petId) {
        return fail(403, "photo_pet_mismatch", "Photo does not belong to this pet.");
      }

      if (photo.status !== "uploaded") {
        return fail(409, "photo_upload_incomplete", "Photo upload must complete before generation starts.");
      }
    }

    const createdAt = now();
    const favoriteThing = pet.favoriteThing;
    const job: GenerationJob = {
      id: createGenerationJobId(),
      userId: auth.data.userId,
      petId: request.petId,
      sourcePhotoIds: [...sourcePhotoIds],
      optionalPhotoIds: [...optionalPhotoIds],
      status: "created",
      inputSnapshot: {
        species: pet.species,
        petName: pet.name,
        personalityTags: [...pet.personalityTags],
        talkingStyle: pet.talkingStyle,
        ...(favoriteThing ? { favoriteThing } : {})
      },
      provider: "other",
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

    return ok(await repositories.generation.upsertGenerationJob({ job }), 201);
  };

  const listGeneratedAssets = async (context: ApiAuthContext, petId: PetId): Promise<ApiResult<PetAssetsResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const pet = await repositories.userPets.findOwnedLivePet(auth.data.userId, petId);

    if (!pet) {
      return fail(404, "pet_not_found", "Pet not found.");
    }

    return ok({
      assets: await repositories.generation.listGeneratedAssetsForPet(auth.data.userId, petId)
    });
  };

  const listGeneratedAssetsForJob = async (job: GenerationJob): Promise<GeneratedAsset[]> => {
    const assets = await repositories.generation.listGeneratedAssetsForPet(job.userId, job.petId);

    return assets.filter((asset) => asset.generationJobId === job.id);
  };

  const buildGeneratedAssetsForJob = (job: GenerationJob, createdAt: ISODateTime): GeneratedAsset[] =>
    mockGeneratedAssets.map((template) => {
      const storagePetId = safeStorageSegment(job.petId);
      const storageJobId = safeStorageSegment(job.id);

      return {
        id: createGeneratedAssetId(job.id, template.state),
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

  const persistGeneratedAssets = async (assets: GeneratedAsset[]): Promise<GeneratedAsset[]> => {
    const persistedAssets: GeneratedAsset[] = [];

    for (const asset of assets) {
      persistedAssets.push(await repositories.generation.upsertGeneratedAsset({ asset }));
    }

    return persistedAssets;
  };

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
      id: asset.id ?? createGeneratedAssetId(job.id, asset.state),
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

  const completeGenerationJob = async (
    context: ApiAuthContext,
    request: CompleteGenerationJobRequest
  ): Promise<ApiResult<CompleteGenerationJobResponse>> => {
    const job = await findOwnedGenerationJob(context, request.jobId);

    if (!job.ok) {
      return job;
    }

    if (job.data.status === "completed") {
      return ok({
        job: job.data,
        assets: await listGeneratedAssetsForJob(job.data)
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

    return ok({
      job: await repositories.generation.upsertGenerationJob({ job: completedJob }),
      assets: await persistGeneratedAssets(assets)
    });
  };

  const completeMockGenerationJob = async (
    context: ApiAuthContext,
    jobId: GenerationJobId
  ): Promise<ApiResult<CompleteGenerationJobResponse>> => {
    const job = await findOwnedGenerationJob(context, jobId);

    if (!job.ok) {
      return job;
    }

    const existingAssets = await listGeneratedAssetsForJob(job.data);

    if (job.data.status === "completed") {
      return ok({
        job: job.data,
        assets: existingAssets
      });
    }

    if (job.data.status === "failed" || job.data.status === "cancelled" || job.data.status === "expired") {
      return fail(409, "generation_job_not_active", "Retry this generation job before completing it.");
    }

    const completedAt = now();
    const assets = existingAssets.length > 0 ? existingAssets : await persistGeneratedAssets(buildGeneratedAssetsForJob(job.data, completedAt));
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

    return ok({
      job: await repositories.generation.upsertGenerationJob({ job: completedJob }),
      assets
    });
  };

  const nextMockGenerationStatus = (status: GenerationJobStatus): GenerationJobStatus | null => {
    if (status === "postprocessing") {
      return "quality_checking";
    }

    if (status === "uploading_assets") {
      return "completed";
    }

    const currentIndex = mockGenerationPollStatuses.indexOf(status);

    if (currentIndex === -1) {
      return mockGenerationPollStatuses[0] ?? null;
    }

    return mockGenerationPollStatuses[currentIndex + 1] ?? null;
  };

  const pollGenerationJob = async (
    context: ApiAuthContext,
    jobId: GenerationJobId
  ): Promise<ApiResult<GenerationPollResponse>> => {
    const job = await findOwnedGenerationJob(context, jobId);

    if (!job.ok) {
      return job;
    }

    if (job.data.status === "completed") {
      return ok({
        job: job.data,
        assets: await listGeneratedAssetsForJob(job.data)
      });
    }

    if (job.data.status === "failed" || job.data.status === "cancelled" || job.data.status === "expired") {
      return ok({
        job: job.data,
        assets: []
      });
    }

    if (!allowMockGenerationPolling) {
      return ok({
        job: job.data,
        assets: []
      });
    }

    const nextStatus = nextMockGenerationStatus(job.data.status);

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

    return ok({
      job: await repositories.generation.upsertGenerationJob({ job: polledJob }),
      assets: []
    });
  };

  const failGenerationJobForQualityGate = async (
    context: ApiAuthContext,
    jobId: GenerationJobId,
    failedChecks: string[] = ["quality_gate_failed"]
  ): Promise<ApiResult<GenerationJob>> => {
    const job = await findOwnedGenerationJob(context, jobId);

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

    return ok(await repositories.generation.upsertGenerationJob({ job: failedJob }));
  };

  const retryGenerationJob = async (
    context: ApiAuthContext,
    jobId: GenerationJobId
  ): Promise<ApiResult<RetryGenerationJobResponse>> => {
    const job = await findOwnedGenerationJob(context, jobId);

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

    return ok({
      job: await repositories.generation.upsertGenerationJob({ job: retriedJob })
    });
  };

  const issueGeneratedAssetReadUrl = async (
    context: ApiAuthContext,
    assetId: GeneratedAssetId
  ): Promise<ApiResult<GeneratedAssetSignedUrlResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    const asset = await repositories.generation.findOwnedGeneratedAsset(auth.data.userId, assetId);

    if (!asset) {
      return fail(404, "generated_asset_not_found", "Generated asset not found.");
    }

    const expiresAt = addMs(now(), ASSET_READ_URL_TTL_MS);

    if (!privateStorageSigner) {
      if (!allowMockStorageSigning) {
        return storageSigningUnavailable();
      }

      return ok({
        assetId: asset.id,
        petId: asset.petId,
        signedUrl: `mock-signed-read://private/${safeStorageSegment(auth.data.userId)}/${safeStorageSegment(
          asset.petId
        )}/${safeStorageSegment(asset.id)}?expires_at=${encodeURIComponent(expiresAt)}`,
        expiresAt,
        contentType: asset.mimeType,
        storageClass: asset.storageClass
      });
    }

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

  const acceptGenerationJob = async (
    context: ApiAuthContext,
    request: AcceptGenerationJobRequest
  ): Promise<ApiResult<AcceptGenerationJobResponse>> => {
    const job = await findOwnedGenerationJob(context, request.jobId);

    if (!job.ok) {
      return job;
    }

    const pet = await findOwnedPet(context, job.data.petId);

    if (!pet.ok) {
      return pet;
    }

    if (job.data.status !== "completed") {
      return fail(409, "generation_not_completed", "Generated pet assets are not ready yet.");
    }

    const acceptedAssetIds = Array.isArray(request.acceptedAssetIds) ? [...new Set(request.acceptedAssetIds)] : [];

    if (acceptedAssetIds.length === 0) {
      return fail(422, "generated_asset_required", "Choose at least one generated pet asset.");
    }

    const assets = await repositories.generation.listGeneratedAssetsForPet(job.data.userId, job.data.petId);
    const assetsById = new Map(
      assets.filter((asset) => asset.generationJobId === job.data.id).map((asset) => [asset.id, asset])
    );
    const acceptedAssets: GeneratedAsset[] = [];

    for (const assetId of acceptedAssetIds) {
      const asset = assetsById.get(assetId);

      if (!asset) {
        return fail(404, "generated_asset_not_found", "Generated pet asset not found.");
      }

      if (asset.qualityStatus !== "passed") {
        return fail(409, "generated_asset_not_ready", "Generated pet asset is not ready.");
      }

      acceptedAssets.push(asset);
    }

    const activeAsset = acceptedAssets[0];

    if (!activeAsset) {
      return fail(422, "generated_asset_required", "Choose at least one generated pet asset.");
    }

    const acceptedAt = now();
    const updatedPet: PetProfile = {
      ...pet.data,
      activeGenerationJobId: job.data.id,
      activeAssetId: activeAsset.id,
      lifecycleStatus: "active",
      updatedAt: acceptedAt
    };

    return ok({
      pet: await repositories.userPets.upsertPet({ pet: updatedPet }),
      assets: acceptedAssets
    });
  };

  const reportGenerationIssue = async (
    context: ApiAuthContext,
    request: GenerationIssueReportRequest
  ): Promise<ApiResult<GenerationIssueReportResponse>> => {
    const auth = await requireAuth(context);

    if (!auth.ok) {
      return auth;
    }

    if (!request || typeof request.petId !== "string" || request.petId.trim().length === 0) {
      return fail(422, "invalid_generation_issue_report", "Choose a pet before sending a report.");
    }

    if (!supportedGenerationIssueCategories.has(request.category)) {
      return fail(422, "invalid_generation_issue_category", "Choose a supported report reason.");
    }

    const pet = await findOwnedPetForAuth(auth.data, request.petId);

    if (!pet.ok) {
      return pet;
    }

    const generationJobId = request.generationJobId;

    if (generationJobId !== undefined) {
      if (typeof generationJobId !== "string" || generationJobId.trim().length === 0) {
        return fail(422, "invalid_generation_issue_report", "Generated pet report metadata is invalid.");
      }

      const job = await findOwnedGenerationJob(context, generationJobId);

      if (!job.ok) {
        return job;
      }

      if (job.data.petId !== pet.data.id) {
        return fail(403, "generation_issue_pet_mismatch", "Generated pet report does not match this pet.");
      }
    }

    const reportedAt = now();

    return ok(
      await repositories.generation.insertGenerationIssueReport({
        reportId: createGenerationIssueReportId(),
        userId: auth.data.userId,
        petId: pet.data.id,
        ...(generationJobId ? { generationJobId } : {}),
        category: request.category,
        reportedAt
      }),
      201
    );
  };

  const snapshot = emptySnapshot;

  return {
    asyncOnly: true,
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
    issueGeneratedAssetReadUrlWithStorageSigner: issueGeneratedAssetReadUrl,
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
};
