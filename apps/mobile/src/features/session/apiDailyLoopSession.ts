import {
  createMobileApiClient,
  resolveMobileApiBaseUrl
} from "../../shared/api";
import type {
  MobileApiClientOptions,
  MobileApiError,
  MobileApiResult
} from "../../shared/api";
import { createMobileApiAuthTokenProvider, getConfiguredDevelopmentAuthToken } from "./mobileAuthSession";
import {
  applyRelationshipCareAction,
  isPlantGrowthEnabledItemId,
  waterPlantGrowthEntries
} from "@mongchi/shared";
import type {
  CareActionRequest,
  CareActionReward,
  CareActionType,
  CareState,
  CommerceProduct,
  CommerceProductsResponse,
  CreditWallet,
  CurrentUserResponse,
  DeleteChatHistoryResponse,
  DeleteOriginalPhotosRequest,
  DeleteOriginalPhotosResponse,
  DeletePetResponse,
  Entitlement,
  EntitlementsResponse,
  GeneratedAssetId,
  GeneratedAssetSignedUrlResponse,
  GenerationIssueReportRequest,
  GenerationIssueReportResponse,
  Inventory,
  InventoryPlacementResponse,
  Item,
  ItemId,
  ListPetsResponse,
  PetBundle,
  PetProfile,
  PlaceInventoryItemRequest,
  PrototypeSessionState,
  PurchaseInventoryItemRequest,
  PurchaseInventoryItemResponse,
  PurchaseVerificationRequest,
  PurchaseVerificationResponse,
  RestorePurchasesRequest,
  RelationshipState,
  SelectedReaction,
  WeatherLookupRequest,
  WeatherLookupResponse,
  WalkSession
} from "@mongchi/shared";

export type TerrariumRuntimeMode = "local" | "api";

export interface DailyLoopApiClient {
  getCurrentUser: () => Promise<MobileApiResult<CurrentUserResponse>>;
  listPets: () => Promise<MobileApiResult<ListPetsResponse>>;
  getCareState: (petId: string) => Promise<MobileApiResult<CareState>>;
  getRelationshipState: (petId: string) => Promise<MobileApiResult<RelationshipState>>;
  getInventory: () => Promise<MobileApiResult<Inventory>>;
  getItemCatalog: () => Promise<MobileApiResult<{ items: Item[] }>>;
  getCommerceProducts: () => Promise<MobileApiResult<CommerceProductsResponse>>;
  getEntitlements: () => Promise<MobileApiResult<EntitlementsResponse>>;
  verifyPurchase: (body: PurchaseVerificationRequest) => Promise<MobileApiResult<PurchaseVerificationResponse>>;
  performCareAction: (
    petId: string,
    body: CareActionRequest
  ) => Promise<
    MobileApiResult<{
      careState: CareState;
      relationshipState: RelationshipState;
      inventory: Inventory | null;
      wallet?: CreditWallet;
      reaction: SelectedReaction | null;
      reward: CareActionReward | null;
    }>
  >;
  startWalk: (
    petId: string
  ) => Promise<MobileApiResult<{ walk: WalkSession; careState: CareState; relationshipState: RelationshipState; reaction: SelectedReaction | null }>>;
  claimWalkReward: (
    walkId: string
  ) => Promise<MobileApiResult<{ walk: WalkSession; inventory: Inventory; relationshipState: RelationshipState; reaction: SelectedReaction | null }>>;
  lookupCurrentWeather: (body: WeatherLookupRequest) => Promise<MobileApiResult<WeatherLookupResponse>>;
  purchaseInventoryItem: (body: PurchaseInventoryItemRequest) => Promise<MobileApiResult<PurchaseInventoryItemResponse>>;
  placeInventoryItem: (body: PlaceInventoryItemRequest) => Promise<MobileApiResult<InventoryPlacementResponse>>;
  removePlacedItem: (itemId: ItemId) => Promise<MobileApiResult<InventoryPlacementResponse>>;
  getGeneratedAssetSignedUrl: (assetId: GeneratedAssetId) => Promise<MobileApiResult<GeneratedAssetSignedUrlResponse>>;
  reportGenerationIssue: (body: GenerationIssueReportRequest) => Promise<MobileApiResult<GenerationIssueReportResponse>>;
  deleteOriginalPhotos: (body: DeleteOriginalPhotosRequest) => Promise<MobileApiResult<DeleteOriginalPhotosResponse>>;
  deleteChatHistory: () => Promise<MobileApiResult<DeleteChatHistoryResponse>>;
  deletePrivacyPet: (petId: string) => Promise<MobileApiResult<DeletePetResponse>>;
  restorePurchases: (body: RestorePurchasesRequest) => Promise<MobileApiResult<PurchaseVerificationResponse>>;
  // Premium chat's createPremiumConversation/getConversationThread/
  // deleteConversation/sendPremiumConversationMessage methods used to live
  // here -- removed in Chat Live wave C2 (docs/chat-live-design.md §6.1/§9
  // risk 5). Live chat now talks to the chat-turn Edge Function directly via
  // supabasePremiumChatSession.ts, never through this services/api HTTP
  // client (that backend is not deployed to production). services/api's own
  // server-side chat route (services/api/src/postgresApiService.ts et al.)
  // is unaffected and stays frozen/undeleted -- only this dead mobile-client
  // call surface was removed.
}

export interface ApiDailyLoopState {
  petProfile: PetProfile | null;
  careState: CareState | null;
  relationshipState: RelationshipState | null;
  wallet: CreditWallet | null;
  inventory: Inventory | null;
  activeWalk: WalkSession | null;
  currentReaction: SelectedReaction | null;
  commerceProducts: CommerceProduct[];
  entitlements: Entitlement[];
}

export type ApiDailyLoopResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

export type ApiDailyLoopClientResolution =
  | {
      mode: "local";
      error: null;
      client: null;
    }
  | {
      mode: "api";
      error: null;
      client: DailyLoopApiClient;
    }
  | {
      mode: "local";
      error: MobileApiError;
      client: null;
    };

const toDailyLoopError = (error: MobileApiError): ApiDailyLoopResult<never> => ({
  ok: false,
  error
});

const firstError = (result: MobileApiResult<unknown>): ApiDailyLoopResult<never> | null =>
  result.ok ? null : toDailyLoopError(result.error);

const mergePlantGrowthEntries = (
  currentEntries: NonNullable<Inventory["plantGrowth"]> = [],
  incomingEntries: NonNullable<Inventory["plantGrowth"]> = []
): NonNullable<Inventory["plantGrowth"]> => {
  const merged = new Map(currentEntries.map((entry) => [entry.itemId, entry]));

  for (const entry of incomingEntries) {
    merged.set(entry.itemId, entry);
  }

  return [...merged.values()];
};

const mergeInventoryPlantGrowth = (currentInventory: Inventory, incomingInventory: Inventory): Inventory => ({
  ...incomingInventory,
  plantGrowth: mergePlantGrowthEntries(currentInventory.plantGrowth ?? [], incomingInventory.plantGrowth ?? [])
});

const getWaterablePlantItemIds = (state: PrototypeSessionState, catalogItems: readonly Item[]): ItemId[] => {
  const catalogItemById = new Map(catalogItems.map((item) => [item.id, item]));
  const itemIds = state.inventory.placedItems
    .map((placedItem) => catalogItemById.get(placedItem.itemId))
    .filter((item): item is Item => Boolean(item))
    .filter((item) => isPlantGrowthEnabledItemId(item.id))
    .map((item) => item.id);

  return [...new Set(itemIds)];
};

const buildLocalCareProgressPatch = (
  currentState: PrototypeSessionState & PetBundle,
  catalogItems: readonly Item[],
  action: CareActionType,
  occurredAt: string
): Pick<PetBundle, "relationshipState"> & Partial<Pick<PrototypeSessionState, "inventory">> => {
  const relationshipState = applyRelationshipCareAction(currentState.relationshipState, action, occurredAt);

  if (action !== "water_garden") {
    return {
      relationshipState
    };
  }

  const waterablePlantItemIds = getWaterablePlantItemIds(currentState, catalogItems);

  if (waterablePlantItemIds.length === 0) {
    return {
      relationshipState
    };
  }

  return {
    relationshipState,
    inventory: {
      ...currentState.inventory,
      plantGrowth: waterPlantGrowthEntries(currentState.inventory.plantGrowth ?? [], waterablePlantItemIds, occurredAt),
      updatedAt: occurredAt
    }
  };
};

// Read as a literal `process.env.EXPO_PUBLIC_...` member access -- a
// computed/optional-chained lookup is never inlined by babel-preset-expo at
// build time and comes back undefined in release bundles (see
// scripts/validate-mobile-env-inlining.mjs).
const API_BASE_URL = process.env.EXPO_PUBLIC_TINY_PET_API_BASE_URL;

export const getConfiguredApiBaseUrl = (): string | null => API_BASE_URL ?? null;

export const getConfiguredMockAuthToken = getConfiguredDevelopmentAuthToken;

export const createConfiguredDailyLoopApiClient = (
  baseUrl: string | null = getConfiguredApiBaseUrl(),
  authTokenProvider: MobileApiClientOptions["authTokenProvider"] = createMobileApiAuthTokenProvider(),
  localeProvider?: MobileApiClientOptions["localeProvider"],
  timezoneProvider?: MobileApiClientOptions["timezoneProvider"]
): ApiDailyLoopClientResolution => {
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
      authTokenProvider,
      ...(localeProvider ? { localeProvider } : {}),
      ...(timezoneProvider ? { timezoneProvider } : {})
    })
  };
};

export const loadApiDailyLoopState = async (
  client: DailyLoopApiClient
): Promise<ApiDailyLoopResult<{ state: ApiDailyLoopState; catalogItems: Item[] }>> => {
  const [currentUserResult, petsResult, inventoryResult, itemCatalogResult, commerceProductsResult, entitlementsResult] = await Promise.all([
    client.getCurrentUser(),
    client.listPets(),
    client.getInventory(),
    client.getItemCatalog(),
    client.getCommerceProducts(),
    client.getEntitlements()
  ]);

  for (const result of [currentUserResult, petsResult, inventoryResult, itemCatalogResult, commerceProductsResult, entitlementsResult]) {
    const error = firstError(result);

    if (error) {
      return error;
    }
  }

  if (
    !currentUserResult.ok ||
    !petsResult.ok ||
    !inventoryResult.ok ||
    !itemCatalogResult.ok ||
    !commerceProductsResult.ok ||
    !entitlementsResult.ok
  ) {
    throw new Error("Unexpected daily loop API result narrowing failure");
  }

  const pet = petsResult.data.pets[0] ?? null;
  const careStateResult = pet ? await client.getCareState(pet.id) : null;
  const relationshipStateResult = pet ? await client.getRelationshipState(pet.id) : null;

  for (const result of [careStateResult, relationshipStateResult]) {
    if (!result) {
      continue;
    }

    const error = firstError(result);

    if (error) {
      return error;
    }
  }

  return {
    ok: true,
    data: {
      state: {
        petProfile: pet,
        careState: careStateResult?.ok ? careStateResult.data : null,
        relationshipState: relationshipStateResult?.ok ? relationshipStateResult.data : null,
        wallet: currentUserResult.data.wallet,
        inventory: inventoryResult.data,
        activeWalk: null,
        currentReaction: null,
        commerceProducts: commerceProductsResult.data.products,
        entitlements: entitlementsResult.data.entitlements
      },
      catalogItems: itemCatalogResult.data.items
    }
  };
};

export const performApiDailyLoopCareAction = async (
  client: DailyLoopApiClient,
  currentState: PrototypeSessionState & PetBundle,
  catalogItems: readonly Item[],
  petId: string,
  action: CareActionType,
  occurredAt: string,
  itemId?: ItemId
): Promise<ApiDailyLoopResult<Partial<PrototypeSessionState> & Partial<PetBundle>>> => {
  if (action === "walk") {
    const startedWalk = await client.startWalk(petId);

    if (!startedWalk.ok) {
      return toDailyLoopError(startedWalk.error);
    }

    const localPatch = buildLocalCareProgressPatch(currentState, catalogItems, action, occurredAt);

    return {
      ok: true,
      data: {
        activeWalk: startedWalk.data.walk,
        careState: startedWalk.data.careState,
        relationshipState: startedWalk.data.relationshipState ?? localPatch.relationshipState,
        currentReaction: startedWalk.data.reaction,
        ...(localPatch.inventory ? { inventory: localPatch.inventory } : {})
      }
    };
  }

  const result = await client.performCareAction(petId, {
    action,
    ...(itemId ? { itemId } : {}),
    occurredAt
  });

  if (!result.ok) {
    return toDailyLoopError(result.error);
  }

  const localPatch = buildLocalCareProgressPatch(currentState, catalogItems, action, occurredAt);
  const inventory = result.data.inventory
    ? mergeInventoryPlantGrowth(localPatch.inventory ?? currentState.inventory, result.data.inventory)
    : localPatch.inventory;

  return {
    ok: true,
    data: {
      careState: result.data.careState,
      relationshipState: result.data.relationshipState ?? localPatch.relationshipState,
      ...(inventory ? { inventory } : {}),
      ...(result.data.wallet ? { wallet: result.data.wallet } : {}),
      currentReaction: result.data.reaction,
      lastCareReward: result.data.reward
    }
  };
};

export const claimApiDailyLoopWalkReward = async (
  client: DailyLoopApiClient,
  currentState: PrototypeSessionState & PetBundle,
  walkId: string,
  petId: string
): Promise<ApiDailyLoopResult<Partial<PrototypeSessionState> & Partial<PetBundle>>> => {
  const claimed = await client.claimWalkReward(walkId);

  if (!claimed.ok) {
    return toDailyLoopError(claimed.error);
  }

  const careState = await client.getCareState(petId);

  if (!careState.ok) {
    return toDailyLoopError(careState.error);
  }

  return {
    ok: true,
    data: {
      activeWalk: null,
      inventory: mergeInventoryPlantGrowth(currentState.inventory, claimed.data.inventory),
      relationshipState: claimed.data.relationshipState,
      careState: careState.data,
      currentReaction: claimed.data.reaction
    }
  };
};

export const refreshApiWalkLocally = (walk: WalkSession | null, now: string): WalkSession | null => {
  if (!walk || walk.status !== "walking") {
    return walk;
  }

  if (new Date(now).getTime() < new Date(walk.returnAt).getTime()) {
    return walk;
  }

  return {
    ...walk,
    status: "returned",
    updatedAt: now
  };
};
