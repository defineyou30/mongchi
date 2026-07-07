import { describe, expect, it } from "vitest";

import { generatedAssetStates, mockItems, starterReactionCatalogVersion, starterReactionRules } from "@mongchi/shared";
import type { CareState, CreditWallet, Inventory, Item, ReactionRule, RelationshipState, WalkSession } from "@mongchi/shared";

import type {
  AcceptGenerationJobResponse,
  CareActionResponse,
  ClaimWalkResponse,
  CommerceProductsResponse,
  ConversationThreadResponse,
  CreateConversationResponse,
  CurrentUserResponse,
  DeleteChatHistoryResponse,
  DeleteOriginalPhotosResponse,
  EntitlementsResponse,
  GeneratedAssetSignedUrlResponse,
  GenerationIssueReportResponse,
  GenerationPollResponse,
  InventoryPlacementResponse,
  ItemCatalogResponse,
  ListPetsResponse,
  PhotoUploadUrlResponse,
  PurchaseRevocationResponse,
  PurchaseVerificationResponse,
  ReactionCatalogResponse,
  SendConversationMessageResponse,
  StartWalkResponse
} from "../contracts";
import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createApiHttpRouter } from "../httpRouter";
import { createPostgresApiService } from "../postgresApiService";
import type { PremiumChatProvider } from "../premiumChatProvider";
import { createPostgresRepositoryBundle } from "../postgresRepositoryBundle";
import type { StorePurchaseVerifier } from "../purchaseVerifier";
import type { ApiSessionVerifier } from "../sessionVerifier";
import type { CompletePhotoUploadResponse } from "../service";
import type { PrivateStorageSigner } from "../storageSigner";

type QueuedRows = unknown[] | ((sql: string, params?: readonly unknown[]) => unknown[]);

class QueueDatabaseClient implements ApiDatabaseMigrationClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  private readonly queuedRows: QueuedRows[];

  constructor(queuedRows: QueuedRows[]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });
    const rows = this.queuedRows.shift();

    return {
      rows: (typeof rows === "function" ? rows(sql, params) : rows ?? []) as Row[]
    };
  }
}

const apiUserRow = {
  id: "user_provider_001",
  auth_provider: "test-provider",
  auth_subject: "provider-subject-001",
  locale: "en-US",
  timezone: "America/New_York",
  created_at: "2026-06-24T09:00:00.000Z",
  updated_at: "2026-06-24T09:00:00.000Z"
};

const petRow = {
  id: "pet_db_001",
  user_id: "user_provider_001",
  name: "Nori",
  species: "dog",
  personality_tags: JSON.stringify(["curious", "affectionate"]),
  talking_style: "gentle",
  favorite_thing: "moss pillows",
  memory_note: null,
  active_generation_job_id: null,
  active_asset_id: null,
  lifecycle_status: "draft",
  original_photo_deleted_at: null,
  created_at: "2026-06-24T09:00:00.000Z",
  updated_at: "2026-06-24T09:00:00.000Z"
};

const updatedPetRow = {
  ...petRow,
  name: "Nori Bean",
  personality_tags: JSON.stringify(["curious"]),
  talking_style: "cheerful",
  favorite_thing: null,
  memory_note: "Likes tiny lanterns.",
  updated_at: "2026-06-24T09:05:00.000Z"
};

const completedGenerationJobRow = {
  id: "gen_db_001",
  user_id: "user_provider_001",
  pet_id: "pet_db_001",
  source_photo_ids: JSON.stringify(["photo_db_001"]),
  optional_photo_ids: JSON.stringify([]),
  status: "completed",
  input_snapshot: JSON.stringify({
    species: "dog",
    petName: "Nori",
    personalityTags: ["curious", "affectionate"],
    talkingStyle: "gentle",
    favoriteThing: "moss pillows"
  }),
  provider: "other",
  cost_units: 0,
  quality: JSON.stringify({
    qualityStatus: "passed",
    qualityScore: 0.94,
    failedChecks: [],
    manualReviewRequired: false,
    retryRecommended: false
  }),
  failure: null,
  completed_at: "2026-06-24T09:30:00.000Z",
  expires_at: null,
  created_at: "2026-06-24T09:10:00.000Z",
  updated_at: "2026-06-24T09:30:00.000Z"
};

const generatedAssetRow = {
  id: "asset_db_idle_001",
  pet_id: "pet_db_001",
  generation_job_id: "gen_db_001",
  state: "idle",
  storage_uri: "s3://tiny-pet-private/assets/pet_db_001/idle.png",
  thumbnail_uri: "s3://tiny-pet-private/assets/pet_db_001/idle-thumb.png",
  width: 256,
  height: 256,
  content_hash: `sha256:${"c".repeat(64)}`,
  mime_type: "image/png",
  storage_class: "private_app_asset",
  version: 1,
  quality_status: "passed",
  created_at: "2026-06-24T09:30:00.000Z",
  updated_at: "2026-06-24T09:30:00.000Z"
};

const activePetRow = {
  ...petRow,
  active_generation_job_id: "gen_db_001",
  active_asset_id: "asset_db_idle_001",
  lifecycle_status: "active",
  updated_at: "2026-06-24T09:35:00.000Z"
};

const careState: CareState = {
  petId: "pet_db_001",
  satiety: 48,
  energy: 74,
  happiness: 70,
  affection: 66,
  gardenHealth: 58,
  cleanliness: 76,
  lastFedAt: "2026-06-24T06:40:00.000Z",
  lastInteractionAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const careStateRow = (state: CareState) => ({
  pet_id: state.petId,
  satiety: state.satiety,
  energy: state.energy,
  happiness: state.happiness,
  affection: state.affection,
  garden_health: state.gardenHealth,
  cleanliness: state.cleanliness,
  last_fed_at: state.lastFedAt ?? null,
  last_interaction_at: state.lastInteractionAt ?? null,
  last_garden_watered_at: state.lastGardenWateredAt ?? null,
  active_walk_id: state.activeWalkId ?? null,
  updated_at: state.updatedAt
});

const careStateRowFromParams = (params: readonly unknown[] | undefined) =>
  careStateRow({
    petId: params?.[0] as string,
    satiety: params?.[1] as number,
    energy: params?.[2] as number,
    happiness: params?.[3] as number,
    affection: params?.[4] as number,
    gardenHealth: params?.[5] as number,
    cleanliness: params?.[6] as number,
    ...(params?.[7] ? { lastFedAt: params[7] as string } : {}),
    ...(params?.[8] ? { lastInteractionAt: params[8] as string } : {}),
    ...(params?.[9] ? { lastGardenWateredAt: params[9] as string } : {}),
    ...(params?.[10] ? { activeWalkId: params[10] as string } : {}),
    updatedAt: params?.[11] as string
  });

const relationshipState: RelationshipState = {
  petId: "pet_db_001",
  bondXp: 66,
  bondLevel: 1,
  totalCareActions: 8,
  totalTalkCount: 2,
  daysTogether: 1,
  lastBondedAt: "2026-06-24T09:00:00.000Z",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const relationshipStateRow = (state: RelationshipState) => ({
  pet_id: state.petId,
  bond_xp: state.bondXp,
  bond_level: state.bondLevel,
  total_care_actions: state.totalCareActions,
  total_talk_count: state.totalTalkCount,
  days_together: state.daysTogether,
  last_bonded_at: state.lastBondedAt ?? null,
  created_at: state.createdAt,
  updated_at: state.updatedAt
});

const relationshipStateRowFromParams = (params: readonly unknown[] | undefined) =>
  relationshipStateRow({
    petId: params?.[0] as string,
    bondXp: params?.[1] as number,
    bondLevel: params?.[2] as number,
    totalCareActions: params?.[3] as number,
    totalTalkCount: params?.[4] as number,
    daysTogether: params?.[5] as number,
    ...(params?.[6] ? { lastBondedAt: params[6] as string } : {}),
    createdAt: params?.[7] as string,
    updatedAt: params?.[8] as string
  });

const creditWallet: CreditWallet = {
  userId: "user_provider_001",
  credits: 0,
  bonusCredits: 25,
  freeChatTickets: 3,
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const creditWalletRow = (wallet: CreditWallet) => ({
  user_id: wallet.userId,
  credits: wallet.credits,
  bonus_credits: wallet.bonusCredits,
  free_chat_tickets: wallet.freeChatTickets,
  updated_at: wallet.updatedAt
});

const creditWalletRowFromParams = (params: readonly unknown[] | undefined) =>
  creditWalletRow({
    userId: params?.[0] as string,
    credits: params?.[1] as number,
    bonusCredits: params?.[2] as number,
    freeChatTickets: params?.[3] as number,
    updatedAt: params?.[4] as string
  });

const itemRow = (item: Item) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  category: item.category,
  rarity: item.rarity,
  visual_key: item.visualKey,
  is_premium: item.isPremium,
  behavior_tags: JSON.stringify(item.behaviorTags),
  placement_slots: JSON.stringify(item.placementSlots),
  created_at: item.createdAt,
  updated_at: item.updatedAt
});

const reactionCatalogVersionRow = (
  rules: ReactionRule[] = starterReactionRules.filter((rule) => rule.locale === "en-US"),
  version = starterReactionCatalogVersion
) => ({
  locale: "en-US",
  version,
  rules: JSON.stringify(rules),
  is_active: true,
  created_at: "2026-06-24T09:00:00.000Z",
  updated_at: "2026-06-24T09:00:00.000Z"
});

const reactionCatalogVersionRowFromParams = (params: readonly unknown[] | undefined) => ({
  locale: params?.[0],
  version: params?.[1],
  rules: params?.[2],
  is_active: params?.[3],
  created_at: params?.[4],
  updated_at: params?.[5]
});

const starterInventory: Inventory = {
  userId: "user_provider_001",
  items: [
    {
      itemId: "item_food_bowl_basic",
      quantity: 1,
      acquiredAt: "2026-06-24T09:00:00.000Z",
      source: "starter"
    },
    {
      itemId: "item_toy_ball_mint",
      quantity: 1,
      acquiredAt: "2026-06-24T09:00:00.000Z",
      source: "starter"
    }
  ],
  placedItems: [
    {
      itemId: "item_food_bowl_basic",
      slot: "pet_corner",
      x: 0.32,
      y: 0.72,
      rotation: 0
    },
    {
      itemId: "item_toy_ball_mint",
      slot: "ground",
      x: 0.68,
      y: 0.78,
      rotation: -8
    }
  ],
  ownedThemeIds: [],
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const inventoryRow = (inventory: Inventory) => ({
  user_id: inventory.userId,
  selected_terrarium_theme_id: inventory.selectedTerrariumThemeId ?? null,
  plant_growth: JSON.stringify(inventory.plantGrowth ?? []),
  updated_at: inventory.updatedAt
});

const inventoryItemRows = (inventory: Inventory) =>
  inventory.items.map((item) => ({
    user_id: inventory.userId,
    item_id: item.itemId,
    quantity: item.quantity,
    acquired_at: item.acquiredAt,
    source: item.source
  }));

const placedItemRows = (inventory: Inventory) =>
  inventory.placedItems.map((item) => ({
    user_id: inventory.userId,
    item_id: item.itemId,
    slot: item.slot,
    x: item.x.toString(),
    y: item.y.toString(),
    rotation: item.rotation.toString()
  }));

const walkSession: WalkSession = {
  id: "walk_db_returned_001",
  userId: "user_provider_001",
  petId: "pet_db_001",
  status: "returned",
  startedAt: "2026-06-24T09:10:00.000Z",
  returnAt: "2026-06-24T09:10:15.000Z",
  rewardItemIds: ["item_flower_pot_sunny"],
  discoveryLine: "A tiny leaf thought of you.",
  energyCost: 12,
  createdAt: "2026-06-24T09:10:00.000Z",
  updatedAt: "2026-06-24T09:10:15.000Z"
};

const placementInventory: Inventory = {
  ...starterInventory,
  items: [
    ...starterInventory.items,
    {
      itemId: "item_flower_pot_sunny",
      quantity: 1,
      acquiredAt: "2026-06-24T09:00:00.000Z",
      source: "starter"
    }
  ]
};

const placedFlowerInventory: Inventory = {
  ...placementInventory,
  placedItems: [
    ...starterInventory.placedItems,
    {
      itemId: "item_flower_pot_sunny",
      slot: "garden",
      x: 0.72,
      y: 0.68,
      rotation: 4
    }
  ],
  updatedAt: "2026-06-24T09:20:00.000Z"
};

const walkRow = (walk: WalkSession) => ({
  id: walk.id,
  user_id: walk.userId,
  pet_id: walk.petId,
  status: walk.status,
  started_at: walk.startedAt,
  return_at: walk.returnAt,
  claimed_at: walk.claimedAt ?? null,
  reward_item_ids: JSON.stringify(walk.rewardItemIds),
  discovery_line: walk.discoveryLine ?? null,
  energy_cost: walk.energyCost,
  created_at: walk.createdAt,
  updated_at: walk.updatedAt
});

const walkRowFromParams = (params: readonly unknown[] | undefined) =>
  walkRow({
    id: params?.[0] as string,
    userId: params?.[1] as string,
    petId: params?.[2] as string,
    status: params?.[3] as WalkSession["status"],
    startedAt: params?.[4] as string,
    returnAt: params?.[5] as string,
    ...(params?.[6] ? { claimedAt: params[6] as string } : {}),
    rewardItemIds: JSON.parse(params?.[7] as string) as string[],
    ...(params?.[8] ? { discoveryLine: params[8] as string } : {}),
    energyCost: params?.[9] as number,
    createdAt: params?.[10] as string,
    updatedAt: params?.[11] as string
  });

const reactionRowFromParams = (params: readonly unknown[] | undefined) => ({
  user_id: params?.[0],
  pet_id: params?.[1],
  rule_id: params?.[2],
  line: params?.[3],
  shown_at: params?.[4]
});

const entitlementRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  user_id: params?.[1],
  key: params?.[2],
  status: params?.[3],
  source: params?.[4],
  product_id: params?.[5],
  starts_at: params?.[6],
  ends_at: params?.[7],
  ledger_entry_id: params?.[8],
  metadata: params?.[9],
  created_at: params?.[10],
  updated_at: params?.[11]
});

const purchaseLedgerRowFromParams = (params: readonly unknown[] | undefined) => ({
  ledger_entry_id: params?.[0],
  user_id: params?.[1],
  platform: params?.[2],
  product_id: params?.[3],
  transaction_id: params?.[4],
  receipt_hash: params?.[5],
  entitlement_id: params?.[6],
  status: params?.[7],
  verified_at: params?.[8],
  restored_at: params?.[9],
  revoked_at: params?.[10],
  revocation_reason: params?.[11]
});

const outboxRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  aggregate_type: params?.[1],
  aggregate_id: params?.[2],
  event_type: params?.[3],
  payload: params?.[4],
  status: "pending",
  created_at: params?.[5],
  processed_at: null,
  failure_code: null
});

const conversationRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  user_id: params?.[1],
  pet_id: params?.[2],
  type: params?.[3],
  status: params?.[4],
  disclosure_accepted_at: params?.[5],
  deleted_at: params?.[6],
  created_at: params?.[7],
  updated_at: params?.[8]
});

const messageRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  conversation_id: params?.[1],
  sender: params?.[2],
  text: params?.[3],
  safety_flags: params?.[4],
  created_at: params?.[5]
});

const generationJobRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  user_id: params?.[1],
  pet_id: params?.[2],
  source_photo_ids: params?.[3],
  optional_photo_ids: params?.[4],
  status: params?.[5],
  input_snapshot: params?.[6],
  provider: params?.[7],
  cost_units: params?.[8],
  quality: params?.[9],
  failure: params?.[10],
  completed_at: params?.[11],
  expires_at: params?.[12],
  created_at: params?.[13],
  updated_at: params?.[14]
});

const generatedAssetRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  pet_id: params?.[1],
  generation_job_id: params?.[2],
  state: params?.[3],
  storage_uri: params?.[4],
  thumbnail_uri: params?.[5],
  width: params?.[6],
  height: params?.[7],
  content_hash: params?.[8],
  mime_type: params?.[9],
  storage_class: params?.[10],
  version: params?.[11],
  quality_status: params?.[12],
  created_at: params?.[13],
  updated_at: params?.[14]
});

const privacyDeletionJobRowFromParams = (params: readonly unknown[] | undefined) => ({
  id: params?.[0],
  user_id: params?.[1],
  scope: params?.[2],
  target_id: params?.[3],
  status: "queued",
  requested_at: params?.[4],
  completed_at: null,
  failure_code: null,
  failure_message_safe: null
});

const sessionVerifier: ApiSessionVerifier = {
  verifySession: async () => ({
    ok: true,
    session: {
      userId: "user_provider_001",
      locale: "en-US",
      timezone: "America/New_York",
      provider: "test-provider",
      subject: "provider-subject-001"
    }
  })
};

const storageSignerCalls: Array<{ photoId: string; maxByteSize: number }> = [];
const readSignerCalls: Array<{ assetId: string; assetUri: string }> = [];
const purchaseVerifierCalls: Array<{
  productId: string;
  transactionId: string;
  userId: string;
  storeVerificationToken: string | undefined;
}> = [];
const privateStorageSigner: PrivateStorageSigner = {
  createOriginalPhotoUpload: async (input) => {
    storageSignerCalls.push({
      photoId: input.photoId,
      maxByteSize: input.maxByteSize
    });

    return {
      ok: true,
      signed: {
        uploadUrl: `https://storage.example.com/uploads/${input.photoId}`,
        uploadMethod: "PUT",
        uploadHeaders: {
          "Content-Type": input.contentType,
          "x-upload-token": "test-upload-token"
        },
        expiresAt: input.expiresAt,
        maxByteSize: input.maxByteSize
      }
    };
  },
  createGeneratedAssetRead: async (input) => {
    readSignerCalls.push({
      assetId: input.assetId,
      assetUri: input.assetUri
    });

    return {
      ok: true,
      signed: {
        signedUrl: `https://storage.example.com/assets/${input.assetId}`,
        expiresAt: input.expiresAt,
        contentType: input.contentType
      }
    };
  }
};

const storePurchaseVerifier: StorePurchaseVerifier = {
  verifyPurchase: async (input) => {
    purchaseVerifierCalls.push({
      productId: input.productId,
      transactionId: input.transactionId,
      userId: input.userId,
      storeVerificationToken: input.storeVerificationToken
    });

    return {
      ok: true,
      purchase: {
        platform: input.platform,
        productId: input.productId,
        transactionId: input.transactionId,
        receiptHash: input.receiptHash,
        verifiedAt: "2026-06-24T09:40:00.000Z",
        environment: "sandbox"
      }
    };
  }
};

describe("Postgres API service", () => {
  it("serves current-user state through the async router with persisted provider identity", async () => {
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [
        {
          live_pet_count: "1",
          active_pet_count: "0",
          active_generation_count: "1"
        }
      ],
      [],
      (_sql, params) => [creditWalletRowFromParams(params)]
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client)
    });
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service,
      sessionVerifier
    });

    const syncResponse = router.handle({
      method: "GET",
      path: "/v1/me",
      headers: {
        authorization: "Bearer provider-token"
      }
    });

    expect(syncResponse.status).toBe(503);
    expect(syncResponse.body).toMatchObject({
      error: {
        code: "async_service_requires_async_handler"
      }
    });

    const response = await router.handleAsync({
      method: "GET",
      path: "/v1/me",
      headers: {
        authorization: "Bearer provider-token"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body as CurrentUserResponse).toEqual({
      userId: "user_provider_001",
      locale: "en-US",
      timezone: "America/New_York",
      onboardingState: "generation_started",
      wallet: creditWallet
    });
    expect(client.queries[0]?.sql).toContain("INSERT INTO public.api_users");
    expect(client.queries[0]?.params).toEqual([
      "user_provider_001",
      "test-provider",
      "provider-subject-001",
      "en-US",
      "America/New_York",
      "2026-06-24T09:00:00.000Z"
    ]);
    expect(client.queries[1]?.sql).toContain("FROM public.pets p");
  });

  it("lists live pets from the Postgres repository bundle", async () => {
    const client = new QueueDatabaseClient([[apiUserRow], [petRow]]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client)
    });
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service,
      sessionVerifier
    });

    const response = await router.handleAsync({
      method: "GET",
      path: "/v1/pets",
      headers: {
        authorization: "Bearer provider-token"
      }
    });

    expect(response.status).toBe(200);
    expect((response.body as ListPetsResponse).pets).toEqual([
      {
        id: "pet_db_001",
        userId: "user_provider_001",
        name: "Nori",
        species: "dog",
        personalityTags: ["curious", "affectionate"],
        talkingStyle: "gentle",
        favoriteThing: "moss pillows",
        lifecycleStatus: "draft",
        createdAt: "2026-06-24T09:00:00.000Z",
        updatedAt: "2026-06-24T09:00:00.000Z"
      }
    ]);
    expect(client.queries[1]?.sql).toContain("WHERE user_id = $1 AND lifecycle_status <> 'deleted'");
  });

  it("creates, updates, and soft-deletes pet profiles through Postgres repositories", async () => {
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [petRow],
      [apiUserRow],
      [petRow],
      [updatedPetRow],
      [apiUserRow],
      [{ id: "pet_db_001" }],
      (_sql, params) => [privacyDeletionJobRowFromParams(params)]
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:05:00.000Z"
    });
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service,
      sessionVerifier
    });
    const headers = {
      authorization: "Bearer provider-token"
    };

    const created = await router.handleAsync({
      method: "POST",
      path: "/v1/pets",
      headers,
      body: {
        name: "  Nori   ",
        species: "dog",
        personalityTags: ["curious", "affectionate"],
        talkingStyle: "gentle",
        favoriteThing: "moss pillows"
      }
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: "pet_db_001",
      name: "Nori"
    });

    const updated = await router.handleAsync({
      method: "PATCH",
      path: "/v1/pets/pet_db_001",
      headers,
      body: {
        name: "Nori Bean",
        personalityTags: ["curious"],
        talkingStyle: "cheerful",
        favoriteThing: "",
        memoryNote: "Likes tiny lanterns."
      }
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: "pet_db_001",
      name: "Nori Bean",
      personalityTags: ["curious"],
      talkingStyle: "cheerful",
      memoryNote: "Likes tiny lanterns."
    });

    const deleted = await router.handleAsync({
      method: "DELETE",
      path: "/v1/pets/pet_db_001",
      headers
    });

    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({
      deletedPetId: "pet_db_001",
      deletedAt: "2026-06-24T09:05:00.000Z"
    });

    expect(client.queries[1]?.sql).toContain("INSERT INTO public.pets");
    expect(client.queries[1]?.params?.[2]).toBe("Nori");
    expect(client.queries[1]?.params?.[4]).toBe(JSON.stringify(["curious", "affectionate"]));
    expect(client.queries[4]?.sql).toContain("INSERT INTO public.pets");
    expect(client.queries[4]?.params?.[2]).toBe("Nori Bean");
    expect(client.queries[4]?.params?.[7]).toBe("Likes tiny lanterns.");
    expect(client.queries[6]?.sql).toContain("SET lifecycle_status = 'deleted'");
    expect(client.queries[7]?.sql).toContain("INSERT INTO public.privacy_deletion_jobs");
    expect(client.queries[7]?.params?.[2]).toBe("pet");
    expect(client.queries[7]?.params?.[3]).toBe("pet_db_001");
  });

  it("persists source-photo metadata and generation jobs through Postgres repositories", async () => {
    storageSignerCalls.length = 0;
    let issuedPhotoRow: Record<string, unknown> | null = null;
    let uploadedPhotoRow: Record<string, unknown> | null = null;
    let generationJobRow: Record<string, unknown> | null = null;
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [petRow],
      (_sql, params) => {
        issuedPhotoRow = {
          id: params?.[0],
          user_id: params?.[1],
          pet_id: params?.[2],
          content_type: params?.[3],
          byte_size: params?.[4],
          status: params?.[5],
          storage_uri: params?.[6],
          expires_at: params?.[7],
          content_hash: params?.[8],
          uploaded_at: params?.[9],
          deleted_at: params?.[10],
          created_at: params?.[11],
          updated_at: params?.[12]
        };

        return [issuedPhotoRow];
      },
      [apiUserRow],
      () => [issuedPhotoRow],
      (_sql, params) => {
        uploadedPhotoRow = {
          ...issuedPhotoRow,
          status: "uploaded",
          content_hash: params?.[2],
          uploaded_at: params?.[3],
          updated_at: params?.[3]
        };

        return [uploadedPhotoRow];
      },
      [apiUserRow],
      [petRow],
      () => [uploadedPhotoRow],
      (_sql, params) => {
        generationJobRow = {
          id: params?.[0],
          user_id: params?.[1],
          pet_id: params?.[2],
          source_photo_ids: params?.[3],
          optional_photo_ids: params?.[4],
          status: params?.[5],
          input_snapshot: params?.[6],
          provider: params?.[7],
          cost_units: params?.[8],
          quality: params?.[9],
          failure: params?.[10],
          completed_at: params?.[11],
          expires_at: params?.[12],
          created_at: params?.[13],
          updated_at: params?.[14]
        };

        return [generationJobRow];
      },
      [apiUserRow],
      () => [generationJobRow],
      [apiUserRow],
      () => [generationJobRow],
      (_sql, params) => {
        generationJobRow = generationJobRowFromParams(params);

        return [generationJobRow];
      }
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:10:00.000Z",
      privateStorageSigner
    });
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service,
      sessionVerifier
    });
    const headers = {
      authorization: "Bearer provider-token"
    };

    const upload = await router.handleAsync({
      method: "POST",
      path: "/v1/photos/upload-url",
      headers,
      body: {
        petId: "pet_db_001",
        contentType: "image/png",
        byteSize: 1_024
      }
    });

    expect(upload.status).toBe(201);
    expect(upload.body as PhotoUploadUrlResponse).toMatchObject({
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": "image/png",
        "x-upload-token": "test-upload-token"
      },
      maxByteSize: 10_485_760
    });
    expect((upload.body as PhotoUploadUrlResponse).uploadUrl).toMatch(/^https:\/\/storage\.example\.com\/uploads\/photo_/);
    expect(storageSignerCalls).toEqual([
      {
        photoId: (upload.body as PhotoUploadUrlResponse).photoId,
        maxByteSize: 10_485_760
      }
    ]);

    const completed = await router.handleAsync({
      method: "POST",
      path: "/v1/photos/complete-upload",
      headers,
      body: {
        photoId: (upload.body as PhotoUploadUrlResponse).photoId,
        contentHash: `sha256:${"a".repeat(64)}`
      }
    });

    expect(completed.status).toBe(200);
    expect((completed.body as CompletePhotoUploadResponse).photo).toMatchObject({
      id: (upload.body as PhotoUploadUrlResponse).photoId,
      status: "uploaded",
      contentHash: `sha256:${"a".repeat(64)}`
    });

    const createdJob = await router.handleAsync({
      method: "POST",
      path: "/v1/generation-jobs",
      headers,
      body: {
        petId: "pet_db_001",
        sourcePhotoIds: [(upload.body as PhotoUploadUrlResponse).photoId],
        optionalPhotoIds: []
      }
    });

    expect(createdJob.status).toBe(201);
    expect(createdJob.body).toMatchObject({
      userId: "user_provider_001",
      petId: "pet_db_001",
      sourcePhotoIds: [(upload.body as PhotoUploadUrlResponse).photoId],
      status: "created",
      provider: "other",
      inputSnapshot: {
        species: "dog",
        petName: "Nori",
        personalityTags: ["curious", "affectionate"],
        talkingStyle: "gentle"
      }
    });

    const jobId = (createdJob.body as { id: string }).id;
    const readJob = await router.handleAsync({
      method: "GET",
      path: `/v1/generation-jobs/${jobId}`,
      headers
    });
    const polledJob = await router.handleAsync({
      method: "POST",
      path: `/v1/generation-jobs/${jobId}/poll`,
      headers
    });

    expect(readJob.status).toBe(200);
    expect(polledJob.status).toBe(200);
    expect((polledJob.body as GenerationPollResponse).assets).toEqual([]);
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.original_photos"))).toBe(true);
    expect(client.queries.some((query) => query.sql.includes("status = 'uploaded'"))).toBe(true);
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.generation_jobs"))).toBe(true);
  });

  it("can disable Postgres mock generation polling so worker-owned jobs do not auto-complete", async () => {
    const createdGenerationJobRow = {
      ...completedGenerationJobRow,
      status: "created",
      completed_at: null,
      updated_at: "2026-06-24T09:10:00.000Z"
    };
    const client = new QueueDatabaseClient([[apiUserRow], [createdGenerationJobRow]]);
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(client),
        allowMockGenerationPolling: false
      }),
      sessionVerifier
    });

    const polled = await router.handleAsync({
      method: "POST",
      path: "/v1/generation-jobs/gen_db_001/poll",
      headers: {
        authorization: "Bearer provider-token"
      }
    });

    expect(polled.status).toBe(200);
    expect(polled.body as GenerationPollResponse).toMatchObject({
      job: {
        id: "gen_db_001",
        status: "created"
      },
      assets: []
    });
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.generation_jobs"))).toBe(false);
    expect(client.queries.some((query) => query.sql.includes("SET status ="))).toBe(false);
  });

  it("routes privacy original-photo and chat-history deletion through Postgres privacy jobs", async () => {
    const deletedOriginalPhotoRow = {
      id: "photo_db_001",
      user_id: "user_provider_001",
      pet_id: "pet_db_001",
      content_type: "image/png",
      byte_size: 1_024,
      status: "deleted",
      storage_uri: "s3://tiny-pet-private/originals/photo_db_001.png",
      expires_at: "2026-06-24T09:25:00.000Z",
      content_hash: `sha256:${"a".repeat(64)}`,
      uploaded_at: "2026-06-24T09:12:00.000Z",
      deleted_at: "2026-06-24T09:50:00.000Z",
      created_at: "2026-06-24T09:10:00.000Z",
      updated_at: "2026-06-24T09:50:00.000Z"
    };
    const photoClient = new QueueDatabaseClient([
      [apiUserRow],
      [activePetRow],
      [deletedOriginalPhotoRow],
      [
        {
          ...activePetRow,
          original_photo_deleted_at: "2026-06-24T09:50:00.000Z",
          updated_at: "2026-06-24T09:50:00.000Z"
        }
      ],
      (_sql, params) => [privacyDeletionJobRowFromParams(params)]
    ]);
    const photoRouter = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(photoClient),
        now: () => "2026-06-24T09:50:00.000Z"
      }),
      sessionVerifier
    });
    const headers = {
      authorization: "Bearer provider-token"
    };

    const photoDeletion = await photoRouter.handleAsync({
      method: "DELETE",
      path: "/v1/privacy/original-photos",
      headers,
      body: {
        petId: "pet_db_001"
      }
    });

    expect(photoDeletion.status).toBe(200);
    expect(photoDeletion.body as DeleteOriginalPhotosResponse).toEqual({
      deletedPhotoIds: ["photo_db_001"],
      deletedAt: "2026-06-24T09:50:00.000Z"
    });
    expect(photoClient.queries[2]?.sql).toContain("UPDATE public.original_photos");
    expect(photoClient.queries[3]?.sql).toContain("INSERT INTO public.pets");
    expect(photoClient.queries[3]?.params?.[11]).toBe("2026-06-24T09:50:00.000Z");
    expect(photoClient.queries[4]?.sql).toContain("INSERT INTO public.privacy_deletion_jobs");
    expect(photoClient.queries[4]?.params?.[2]).toBe("original_photos");
    expect(photoClient.queries[4]?.params?.[3]).toBe("pet_db_001");

    const chatClient = new QueueDatabaseClient([
      [apiUserRow],
      [{ id: "conv_db_001" }],
      [{ id: "msg_db_user_001" }, { id: "msg_db_pet_001" }],
      (_sql, params) => [privacyDeletionJobRowFromParams(params)]
    ]);
    const chatRouter = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(chatClient),
        now: () => "2026-06-24T09:55:00.000Z"
      }),
      sessionVerifier
    });

    const chatDeletion = await chatRouter.handleAsync({
      method: "DELETE",
      path: "/v1/privacy/chat-history",
      headers
    });

    expect(chatDeletion.status).toBe(200);
    expect(chatDeletion.body as DeleteChatHistoryResponse).toEqual({
      deletedConversationIds: ["conv_db_001"],
      deletedMessageIds: ["msg_db_user_001", "msg_db_pet_001"],
      deletedAt: "2026-06-24T09:55:00.000Z"
    });
    expect(chatClient.queries[1]?.sql).toContain("UPDATE public.conversations");
    expect(chatClient.queries[2]?.sql).toContain("DELETE FROM public.conversation_messages");
    expect(chatClient.queries[3]?.sql).toContain("INSERT INTO public.privacy_deletion_jobs");
    expect(chatClient.queries[3]?.params?.[2]).toBe("chat_history");
    expect(chatClient.queries[3]?.params?.[3]).toBeNull();
  });

  it("persists generation lifecycle completion, quality failure, and retry through Postgres repositories", async () => {
    const pendingQuality = {
      qualityStatus: "pending",
      failedChecks: [],
      manualReviewRequired: false,
      retryRecommended: false
    };
    const activeGenerationJobRow = {
      ...completedGenerationJobRow,
      status: "quality_checking",
      quality: JSON.stringify(pendingQuality),
      failure: null,
      completed_at: null,
      updated_at: "2026-06-24T09:45:00.000Z"
    };
    const completionClient = new QueueDatabaseClient([
      [apiUserRow],
      [activeGenerationJobRow],
      [],
      ...generatedAssetStates.map(() => (_sql: string, params?: readonly unknown[]) => [generatedAssetRowFromParams(params)]),
      (_sql, params) => [generationJobRowFromParams(params)]
    ]);
    const completionService = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(completionClient),
      now: () => "2026-06-24T09:50:00.000Z"
    });

    const completed = await completionService.completeMockGenerationJob(
      { userId: "user_provider_001" },
      "gen_db_001"
    );

    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      throw new Error(completed.error.messageSafe);
    }
    expect(completed.data.job.status).toBe("completed");
    expect(completed.data.job.completedAt).toBe("2026-06-24T09:50:00.000Z");
    expect(completed.data.assets.map((asset) => asset.state)).toEqual([...generatedAssetStates]);
    expect(completed.data.assets.every((asset) => asset.generationJobId === "gen_db_001")).toBe(true);
    expect(completionClient.queries[3]?.sql).toContain("INSERT INTO public.generated_assets");
    expect(completionClient.queries[3 + generatedAssetStates.length - 1]?.sql).toContain("INSERT INTO public.generated_assets");
    expect(completionClient.queries[3 + generatedAssetStates.length]?.sql).toContain("INSERT INTO public.generation_jobs");
    expect(completionClient.queries[3 + generatedAssetStates.length]?.params?.[5]).toBe("completed");
    expect(JSON.parse(completionClient.queries[3 + generatedAssetStates.length]?.params?.[9] as string)).toMatchObject({
      qualityStatus: "passed",
      retryRecommended: false
    });
    expect(completionClient.queries[3 + generatedAssetStates.length]?.params?.[11]).toBe("2026-06-24T09:50:00.000Z");

    let failedJobRow: Record<string, unknown> | null = null;
    const retryClient = new QueueDatabaseClient([
      [apiUserRow],
      [activeGenerationJobRow],
      (_sql, params) => {
        failedJobRow = generationJobRowFromParams(params);

        return [failedJobRow];
      },
      [apiUserRow],
      () => (failedJobRow ? [failedJobRow] : []),
      (_sql, params) => [generationJobRowFromParams(params)]
    ]);
    const retryService = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(retryClient),
      now: () => "2026-06-24T09:55:00.000Z"
    });

    const failed = await retryService.failGenerationJobForQualityGate(
      { userId: "user_provider_001" },
      "gen_db_001",
      ["pet_not_clear"]
    );

    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      throw new Error(failed.error.messageSafe);
    }
    expect(failed.data.status).toBe("failed");
    expect(failed.data.failure?.retryable).toBe(true);
    expect(failed.data.quality.failedChecks).toEqual(["pet_not_clear"]);
    expect(retryClient.queries[2]?.sql).toContain("INSERT INTO public.generation_jobs");
    expect(retryClient.queries[2]?.params?.[5]).toBe("failed");

    const retried = await retryService.retryGenerationJob(
      { userId: "user_provider_001" },
      "gen_db_001"
    );

    expect(retried.ok).toBe(true);
    if (!retried.ok) {
      throw new Error(retried.error.messageSafe);
    }
    expect(retried.data.job.status).toBe("created");
    expect(retried.data.job.failure).toBeUndefined();
    expect(retried.data.job.quality).toMatchObject({
      qualityStatus: "pending",
      failedChecks: [],
      retryRecommended: false
    });
    expect(retryClient.queries[5]?.sql).toContain("INSERT INTO public.generation_jobs");
    expect(retryClient.queries[5]?.params?.[5]).toBe("created");
    expect(retryClient.queries[5]?.params?.[10]).toBeNull();
  });

  it("persists worker-completed generated asset metadata through Postgres repositories", async () => {
    const workerGenerationJobRow = {
      ...completedGenerationJobRow,
      status: "uploading_assets",
      quality: JSON.stringify({
        qualityStatus: "pending",
        failedChecks: [],
        manualReviewRequired: false,
        retryRecommended: false
      }),
      failure: null,
      completed_at: null,
      updated_at: "2026-06-24T09:45:00.000Z"
    };
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [workerGenerationJobRow],
      (_sql, params) => [generationJobRowFromParams(params)],
      (_sql, params) => [generatedAssetRowFromParams(params)]
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:50:00.000Z"
    });

    const completed = await service.completeGenerationJob(
      { userId: "user_provider_001" },
      {
        jobId: "gen_db_001",
        provider: "openai",
        costUnits: 18,
        quality: {
          qualityStatus: "passed",
          qualityScore: 0.97,
          failedChecks: [],
          manualReviewRequired: false,
          retryRecommended: false
        },
        completedAt: "2026-06-24T09:51:00.000Z",
        assets: [
          {
            id: "asset_worker_idle_001",
            state: "idle",
            uri: "s3://tiny-pet-private/generated/pet_db_001/gen_db_001/idle.png",
            thumbnailUri: "s3://tiny-pet-private/generated/pet_db_001/gen_db_001/idle-thumb.png",
            width: 512,
            height: 512,
            contentHash: `sha256:${"d".repeat(64)}`,
            mimeType: "image/png",
            version: 3
          }
        ]
      }
    );

    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      throw new Error(completed.error.messageSafe);
    }
    expect(completed.data.job.status).toBe("completed");
    expect(completed.data.job.provider).toBe("openai");
    expect(completed.data.job.costUnits).toBe(18);
    expect(completed.data.assets).toEqual([
      {
        id: "asset_worker_idle_001",
        petId: "pet_db_001",
        generationJobId: "gen_db_001",
        state: "idle",
        uri: "s3://tiny-pet-private/generated/pet_db_001/gen_db_001/idle.png",
        thumbnailUri: "s3://tiny-pet-private/generated/pet_db_001/gen_db_001/idle-thumb.png",
        width: 512,
        height: 512,
        contentHash: `sha256:${"d".repeat(64)}`,
        mimeType: "image/png",
        storageClass: "private_app_asset",
        version: 3,
        qualityStatus: "passed",
        createdAt: "2026-06-24T09:51:00.000Z",
        updatedAt: "2026-06-24T09:51:00.000Z"
      }
    ]);
    expect(client.queries[2]?.sql).toContain("INSERT INTO public.generation_jobs");
    expect(client.queries[2]?.params?.[5]).toBe("completed");
    expect(client.queries[2]?.params?.[7]).toBe("openai");
    expect(client.queries[2]?.params?.[8]).toBe(18);
    expect(client.queries[3]?.sql).toContain("INSERT INTO public.generated_assets");
    expect(client.queries[3]?.params?.[4]).toBe("s3://tiny-pet-private/generated/pet_db_001/gen_db_001/idle.png");
  });

  it("issues generated asset read URLs and accepts completed generation jobs through Postgres repositories", async () => {
    readSignerCalls.length = 0;
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [generatedAssetRow],
      [apiUserRow],
      [completedGenerationJobRow],
      [apiUserRow],
      [petRow],
      [generatedAssetRow],
      [activePetRow]
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:35:00.000Z",
      privateStorageSigner
    });
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service,
      sessionVerifier
    });
    const headers = {
      authorization: "Bearer provider-token"
    };

    const readUrl = await router.handleAsync({
      method: "GET",
      path: "/v1/assets/asset_db_idle_001/signed-url",
      headers
    });

    expect(readUrl.status).toBe(200);
    expect(readUrl.body as GeneratedAssetSignedUrlResponse).toEqual({
      assetId: "asset_db_idle_001",
      petId: "pet_db_001",
      signedUrl: "https://storage.example.com/assets/asset_db_idle_001",
      expiresAt: "2026-06-24T09:45:00.000Z",
      contentType: "image/png",
      storageClass: "private_app_asset"
    });
    expect(readSignerCalls).toEqual([
      {
        assetId: "asset_db_idle_001",
        assetUri: "s3://tiny-pet-private/assets/pet_db_001/idle.png"
      }
    ]);

    const accepted = await router.handleAsync({
      method: "POST",
      path: "/v1/generation-jobs/gen_db_001/accept",
      headers,
      body: {
        acceptedAssetIds: ["asset_db_idle_001", "asset_db_idle_001"]
      }
    });

    expect(accepted.status).toBe(200);
    expect(accepted.body as AcceptGenerationJobResponse).toMatchObject({
      pet: {
        id: "pet_db_001",
        lifecycleStatus: "active",
        activeGenerationJobId: "gen_db_001",
        activeAssetId: "asset_db_idle_001"
      },
      assets: [
        {
          id: "asset_db_idle_001",
          generationJobId: "gen_db_001",
          qualityStatus: "passed"
        }
      ]
    });
    expect(client.queries[1]?.sql).toContain("FROM public.generated_assets ga");
    expect(client.queries[6]?.sql).toContain("FROM public.generated_assets ga");
    expect(client.queries[7]?.sql).toContain("INSERT INTO public.pets");
    expect(client.queries[7]?.params?.[8]).toBe("gen_db_001");
    expect(client.queries[7]?.params?.[9]).toBe("asset_db_idle_001");
    expect(client.queries[7]?.params?.[10]).toBe("active");
  });

  it("stores category-only generation issue reports through Postgres repositories", async () => {
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [activePetRow],
      [apiUserRow],
      [completedGenerationJobRow],
      (_sql, params) => [
        {
          id: params?.[0],
          pet_id: params?.[2],
          generation_job_id: params?.[3],
          category: params?.[4],
          reported_at: params?.[5]
        }
      ]
    ]);
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(client),
        now: () => "2026-06-24T09:40:00.000Z"
      }),
      sessionVerifier
    });

    const report = await router.handleAsync({
      method: "POST",
      path: "/v1/generation-issue-reports",
      headers: {
        authorization: "Bearer provider-token"
      },
      body: {
        petId: "pet_db_001",
        generationJobId: "gen_db_001",
        category: "unsafe_or_scary"
      }
    });

    expect(report.status).toBe(201);
    expect(report.body as GenerationIssueReportResponse).toMatchObject({
      petId: "pet_db_001",
      generationJobId: "gen_db_001",
      category: "unsafe_or_scary",
      reportedAt: "2026-06-24T09:40:00.000Z"
    });
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.generation_issue_reports"))).toBe(true);
    expect(client.queries.at(-1)?.params?.slice(1)).toEqual([
      "user_provider_001",
      "pet_db_001",
      "gen_db_001",
      "unsafe_or_scary",
      "2026-06-24T09:40:00.000Z"
    ]);
    expect(JSON.stringify(client.queries.at(-1)?.params)).not.toMatch(/photo|image|message|prompt/i);
  });

  it("serves daily loop catalog, care action, and walk routes through Postgres repositories", async () => {
    const catalogClient = new QueueDatabaseClient([
      [apiUserRow],
      [],
      ...mockItems.map((item) => [itemRow(item)]),
      [apiUserRow],
      [],
      [],
      (_sql, params) => [reactionCatalogVersionRowFromParams(params)]
    ]);
    const catalogRouter = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(catalogClient)
      }),
      sessionVerifier
    });
    const headers = {
      authorization: "Bearer provider-token"
    };

    const itemCatalog = await catalogRouter.handleAsync({
      method: "GET",
      path: "/v1/catalog/items",
      headers
    });
    const reactionCatalog = await catalogRouter.handleAsync({
      method: "GET",
      path: "/v1/reaction-catalog",
      headers
    });

    expect(itemCatalog.status).toBe(200);
    expect(new Set((itemCatalog.body as ItemCatalogResponse).items.map((item) => item.id))).toEqual(
      new Set(mockItems.map((item) => item.id))
    );
    expect(reactionCatalog.status).toBe(200);
    expect(reactionCatalog.body as ReactionCatalogResponse).toMatchObject({
      locale: "en-US",
      version: "starter-2026-06-24"
    });
    expect(catalogClient.queries.some((query) => query.sql.includes("INSERT INTO public.items"))).toBe(true);

    const careClient = new QueueDatabaseClient([
      [apiUserRow],
      [activePetRow],
      [careStateRow(careState)],
      [relationshipStateRow(relationshipState)],
      (_sql, params) => [careStateRowFromParams(params)],
      (_sql, params) => [relationshipStateRowFromParams(params)],
      [reactionCatalogVersionRow()],
      [],
      (_sql, params) => [reactionRowFromParams(params)]
    ]);
    const careRouter = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(careClient)
      }),
      sessionVerifier
    });
    const careAction = await careRouter.handleAsync({
      method: "POST",
      path: "/v1/pets/pet_db_001/care-actions",
      headers,
      body: {
        action: "feed",
        occurredAt: "2026-06-24T09:05:00.000Z"
      }
    });

    expect(careAction.status).toBe(200);
    expect(careAction.body as CareActionResponse).toMatchObject({
      careState: {
        petId: "pet_db_001",
        satiety: 76,
        lastFedAt: "2026-06-24T09:05:00.000Z"
      },
      relationshipState: {
        petId: "pet_db_001",
        bondXp: 67
      },
      reaction: {
        category: "fed_recent",
        animation: "happy"
      },
      reward: null
    });
    expect(careClient.queries.some((query) => query.sql.includes("INSERT INTO public.care_states"))).toBe(true);
    expect(careClient.queries.some((query) => query.sql.includes("INSERT INTO public.recent_reactions"))).toBe(true);

    const walkClient = new QueueDatabaseClient([
      [apiUserRow],
      [activePetRow],
      [],
      [careStateRow(careState)],
      [relationshipStateRow(relationshipState)],
      (_sql, params) => [walkRowFromParams(params)],
      (_sql, params) => [careStateRowFromParams(params)],
      (_sql, params) => [relationshipStateRowFromParams(params)],
      [reactionCatalogVersionRow()],
      [],
      (_sql, params) => [reactionRowFromParams(params)]
    ]);
    const walkRouter = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(walkClient),
        now: () => "2026-06-24T09:10:00.000Z"
      }),
      sessionVerifier
    });
    const startedWalk = await walkRouter.handleAsync({
      method: "POST",
      path: "/v1/pets/pet_db_001/walks",
      headers
    });

    expect(startedWalk.status).toBe(201);
    expect(startedWalk.body as StartWalkResponse).toMatchObject({
      walk: {
        userId: "user_provider_001",
        petId: "pet_db_001",
        status: "walking",
        returnAt: "2026-06-24T09:10:15.000Z"
      },
      careState: {
        activeWalkId: (startedWalk.body as StartWalkResponse).walk.id
      },
      relationshipState: {
        bondXp: 68
      },
      reaction: {
        category: "walk_start"
      }
    });
    expect(walkClient.queries.some((query) => query.sql.includes("INSERT INTO public.walk_sessions"))).toBe(true);

    const claimClient = new QueueDatabaseClient([
      [apiUserRow],
      [walkRow(walkSession)],
      [activePetRow],
      [inventoryRow(starterInventory)],
      inventoryItemRows(starterInventory),
      placedItemRows(starterInventory),
      [careStateRow({ ...careState, activeWalkId: walkSession.id })],
      [relationshipStateRow(relationshipState)],
      mockItems.map(itemRow),
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      (_sql, params) => [careStateRowFromParams(params)],
      (_sql, params) => [walkRowFromParams(params)],
      [reactionCatalogVersionRow()],
      [],
      (_sql, params) => [reactionRowFromParams(params)]
    ]);
    const claimRouter = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(claimClient),
        now: () => "2026-06-24T09:20:00.000Z"
      }),
      sessionVerifier
    });
    const claimedWalk = await claimRouter.handleAsync({
      method: "POST",
      path: "/v1/walks/walk_db_returned_001/claim",
      headers
    });

    expect(claimedWalk.status).toBe(200);
    expect(claimedWalk.body as ClaimWalkResponse).toMatchObject({
      walk: {
        id: "walk_db_returned_001",
        status: "claimed",
        claimedAt: "2026-06-24T09:20:00.000Z"
      },
      reaction: {
        category: "new_item",
        animation: "idle_happy"
      }
    });
    expect((claimedWalk.body as ClaimWalkResponse).inventory.items.find((item) => item.itemId === "item_flower_pot_sunny")).toMatchObject({
      quantity: 1,
      source: "walk_reward"
    });
    expect(
      (claimedWalk.body as ClaimWalkResponse).inventory.placedItems.some((item) => item.itemId === "item_flower_pot_sunny")
    ).toBe(true);
    expect(claimClient.queries.some((query) => query.sql.includes("DELETE FROM public.inventory_items"))).toBe(true);
    expect(claimClient.queries.some((query) => query.sql.includes("status = EXCLUDED.status"))).toBe(true);

    const placementClient = new QueueDatabaseClient([
      [apiUserRow],
      [inventoryRow(placementInventory)],
      inventoryItemRows(placementInventory),
      placedItemRows(placementInventory),
      mockItems.map(itemRow),
      ...Array.from({ length: 9 }, () => []),
      [apiUserRow],
      [inventoryRow(placedFlowerInventory)],
      inventoryItemRows(placedFlowerInventory),
      placedItemRows(placedFlowerInventory),
      ...Array.from({ length: 8 }, () => [])
    ]);
    const placementRouter = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(placementClient),
        now: () => "2026-06-24T09:20:00.000Z"
      }),
      sessionVerifier
    });
    const placedInventoryResponse = await placementRouter.handleAsync({
      method: "POST",
      path: "/v1/inventory/placements",
      headers,
      body: {
        itemId: "item_flower_pot_sunny"
      }
    });
    const removedInventoryResponse = await placementRouter.handleAsync({
      method: "DELETE",
      path: "/v1/inventory/placements/item_flower_pot_sunny",
      headers
    });

    expect(placedInventoryResponse.status).toBe(200);
    expect((placedInventoryResponse.body as InventoryPlacementResponse).inventory.placedItems).toContainEqual(
      expect.objectContaining({ itemId: "item_flower_pot_sunny", slot: "garden" })
    );
    expect(removedInventoryResponse.status).toBe(200);
    expect(
      (removedInventoryResponse.body as InventoryPlacementResponse).inventory.placedItems.some(
        (item) => item.itemId === "item_flower_pot_sunny"
      )
    ).toBe(false);
    expect(placementClient.queries.filter((query) => query.sql.includes("DELETE FROM public.placed_items"))).toHaveLength(2);

    const purchaseClient = new QueueDatabaseClient([
      [apiUserRow],
      mockItems.map(itemRow),
      [creditWalletRow(creditWallet)],
      [inventoryRow(starterInventory)],
      inventoryItemRows(starterInventory),
      placedItemRows(starterInventory),
      (_sql, params) => [creditWalletRowFromParams(params)],
      [],
      [],
      [],
      [],
      [],
      []
    ]);
    const purchaseService = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(purchaseClient),
      now: () => "2026-06-24T09:25:00.000Z"
    });

    const purchased = await purchaseService.purchaseInventoryItem(
      {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York",
        authProvider: "test-provider",
        authSubject: "provider-subject-001"
      },
      {
        itemId: "item_stepping_stone_path"
      }
    );

    expect(purchased).toMatchObject({
      ok: true,
      data: {
        item: {
          id: "item_stepping_stone_path"
        },
        creditCost: 3,
        wallet: {
          bonusCredits: creditWallet.bonusCredits - 3
        },
        inventory: {
          items: expect.arrayContaining([
            expect.objectContaining({
              itemId: "item_stepping_stone_path",
              quantity: 1,
              source: "purchase"
            })
          ])
        }
      }
    });
    expect(purchaseClient.queries.some((query) => query.sql.includes("INSERT INTO public.credit_wallets"))).toBe(true);
    expect(purchaseClient.queries.some((query) => query.sql.includes("INSERT INTO public.inventory_items"))).toBe(true);
  });

  it("serves the active Postgres reaction catalog version without reseeding starter rules", async () => {
    const activeRule: ReactionRule = {
      id: "en_active_catalog_test_001",
      locale: "en-US",
      category: "greeting_morning",
      conditions: {
        timeBucket: "morning"
      },
      lines: ["Versioned catalog hello."],
      animation: "idle",
      priority: 33,
      cooldownHours: 1,
      safetyLevel: "safe"
    };
    const client = new QueueDatabaseClient([[apiUserRow], [reactionCatalogVersionRow([activeRule], "ops-2026-06-25")]]);
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(client)
      }),
      sessionVerifier
    });

    const response = await router.handleAsync({
      method: "GET",
      path: "/v1/reaction-catalog",
      headers: {
        authorization: "Bearer provider-token"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body as ReactionCatalogResponse).toMatchObject({
      locale: "en-US",
      version: "ops-2026-06-25",
      rules: [
        {
          id: "en_active_catalog_test_001",
          lines: ["Versioned catalog hello."]
        }
      ]
    });
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.reaction_catalog_versions"))).toBe(false);
  });

  it("verifies purchases and runs premium chat through Postgres commerce and chat repositories", async () => {
    purchaseVerifierCalls.length = 0;
    let entitlementRow: Record<string, unknown> | null = null;
    let conversationRow: Record<string, unknown> | null = null;
    let userMessageRow: Record<string, unknown> | null = null;
    let petMessageRow: Record<string, unknown> | null = null;
    let purchaseLedgerRow: Record<string, unknown> | null = null;
    const existingThreadMessageRow = {
      id: "msg_pg_existing_001",
      conversation_id: "conv_pg_existing_001",
      sender: "pet_ai",
      text: "I saved a warm spot by the moss.",
      safety_flags: JSON.stringify([]),
      created_at: "2026-06-24T09:39:00.000Z"
    };
    const storeVerificationToken = "google-play-token.production.001";
    const premiumChatProviderCalls: Array<Parameters<PremiumChatProvider["generateReply"]>[0]> = [];
    const premiumChatProvider: PremiumChatProvider = {
      generateReply: async (input) => {
        premiumChatProviderCalls.push(input);

        return {
          text: "Nori nudges a tiny lantern closer. I heard you, and I am sitting right here in the moss.",
          safetyFlags: ["provider_warm_reply"]
        };
      }
    };
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [apiUserRow],
      [],
      (_sql, params) => {
        entitlementRow = entitlementRowFromParams(params);

        return [entitlementRow];
      },
      (_sql, params) => {
        purchaseLedgerRow = purchaseLedgerRowFromParams(params);

        return [purchaseLedgerRow];
      },
      [apiUserRow],
      () => (entitlementRow ? [entitlementRow] : []),
      [apiUserRow],
      [activePetRow],
      [creditWalletRow(creditWallet)],
      [{ active: true }],
      (_sql, params) => {
        conversationRow = conversationRowFromParams(params);

        return [conversationRow];
      },
      [apiUserRow],
      () => (conversationRow ? [conversationRow] : []),
      [activePetRow],
      [existingThreadMessageRow],
      [creditWalletRow(creditWallet)],
      [{ active: true }],
      [],
      (_sql, params) => {
        userMessageRow = messageRowFromParams(params);

        return [userMessageRow];
      },
      (_sql, params) => {
        petMessageRow = messageRowFromParams(params);

        return [petMessageRow];
      },
      () => (conversationRow ? [{ ...conversationRow, updated_at: "2026-06-24T09:40:00.000Z" }] : []),
      [apiUserRow],
      () => (conversationRow ? [conversationRow] : []),
      () => [userMessageRow, petMessageRow].filter(Boolean),
      [apiUserRow],
      () => (conversationRow ? [{ ...conversationRow, status: "deleted", deleted_at: "2026-06-24T09:40:00.000Z" }] : []),
      () => [{ id: userMessageRow?.id }, { id: petMessageRow?.id }]
    ]);
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(client),
        now: () => "2026-06-24T09:40:00.000Z",
        purchaseVerifier: storePurchaseVerifier,
        premiumChatProvider
      }),
      sessionVerifier
    });
    const headers = {
      authorization: "Bearer provider-token"
    };
    const products = await router.handleAsync({
      method: "GET",
      path: "/v1/commerce/products",
      headers
    });
    const purchase = await router.handleAsync({
      method: "POST",
      path: "/v1/commerce/purchases/verify",
      headers,
      body: {
        platform: "ios",
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_premium_001",
        receiptHash: `sha256:${"d".repeat(64)}`,
        storeVerificationToken
      }
    });
    const entitlements = await router.handleAsync({
      method: "GET",
      path: "/v1/entitlements",
      headers
    });
    const conversation = await router.handleAsync({
      method: "POST",
      path: "/v1/conversations",
      headers,
      body: {
        petId: "pet_db_001",
        disclosureAccepted: true
      }
    });
    const message = await router.handleAsync({
      method: "POST",
      path: `/v1/conversations/${(conversation.body as CreateConversationResponse).conversation.id}/messages`,
      headers,
      body: {
        text: "  Hello   tiny friend  "
      }
    });
    const thread = await router.handleAsync({
      method: "GET",
      path: `/v1/conversations/${(conversation.body as CreateConversationResponse).conversation.id}`,
      headers
    });
    const deleted = await router.handleAsync({
      method: "DELETE",
      path: `/v1/conversations/${(conversation.body as CreateConversationResponse).conversation.id}`,
      headers
    });

    expect(products.status).toBe(200);
    expect((products.body as CommerceProductsResponse).products.map((product) => product.productId)).toContain(
      "premium_chat_monthly"
    );
    expect(purchase.status).toBe(201);
    expect(purchase.body as PurchaseVerificationResponse).toMatchObject({
      serverVerified: true,
      entitlements: [
        {
          key: "premium_chat",
          status: "active",
          source: "purchase",
          metadata: {
            serverVerified: true,
            storeEnvironment: "sandbox"
          }
        }
      ]
    });
    expect(purchaseVerifierCalls).toEqual([
      {
        productId: "premium_chat_monthly",
        transactionId: "ios_txn_premium_001",
        userId: "user_provider_001",
        storeVerificationToken
      }
    ]);
    expect(JSON.stringify(purchaseLedgerRow)).not.toContain(storeVerificationToken);
    expect(entitlements.status).toBe(200);
    expect((entitlements.body as EntitlementsResponse).entitlements).toHaveLength(1);
    expect(conversation.status).toBe(201);
    expect(conversation.body as CreateConversationResponse).toMatchObject({
      conversation: {
        userId: "user_provider_001",
        petId: "pet_db_001",
        type: "premium_ai_chat",
        status: "open",
        disclosureAcceptedAt: "2026-06-24T09:40:00.000Z"
      }
    });
    expect(message.status).toBe(200);
    expect(message.body as SendConversationMessageResponse).toMatchObject({
      userMessage: {
        sender: "user",
        text: "Hello tiny friend",
        safetyFlags: []
      },
      petMessage: {
        sender: "pet_ai",
        text: "Nori nudges a tiny lantern closer. I heard you, and I am sitting right here in the moss.",
        safetyFlags: ["provider_warm_reply"]
      },
      safetyFlags: ["provider_warm_reply"],
      wallet: creditWallet,
      walletSpend: {
        freeChatTicketsSpent: 0,
        bonusCreditsSpent: 0,
        creditsSpent: 0
      }
    });
    expect(premiumChatProviderCalls).toHaveLength(1);
    expect(premiumChatProviderCalls[0]).toMatchObject({
      auth: {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York"
      },
      pet: {
        id: "pet_db_001",
        name: "Nori"
      },
      userText: "Hello tiny friend",
      safetyFlags: [],
      recentMessages: [
        {
          id: "msg_pg_existing_001",
          conversationId: "conv_pg_existing_001",
          sender: "pet_ai",
          text: "I saved a warm spot by the moss.",
          safetyFlags: [],
          createdAt: "2026-06-24T09:39:00.000Z"
        }
      ]
    });
    expect(thread.status).toBe(200);
    expect((thread.body as ConversationThreadResponse).messages.map((threadMessage) => threadMessage.sender)).toEqual([
      "user",
      "pet_ai"
    ]);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toMatchObject({
      deletedMessageIds: [(message.body as SendConversationMessageResponse).userMessage.id, (message.body as SendConversationMessageResponse).petMessage.id],
      deletedAt: "2026-06-24T09:40:00.000Z"
    });
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.entitlements"))).toBe(true);
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.purchase_ledger"))).toBe(true);
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.conversations"))).toBe(true);
    expect(client.queries.filter((query) => query.sql.includes("INSERT INTO public.conversation_messages"))).toHaveLength(2);
  });

  it("fails closed before storing messages when the premium chat provider is unavailable", async () => {
    const conversationRow = conversationRowFromParams([
      "conv_pg_chat_001",
      "user_provider_001",
      "pet_db_001",
      "premium_ai_chat",
      "open",
      "2026-06-24T09:40:00.000Z",
      null,
      "2026-06-24T09:40:00.000Z",
      "2026-06-24T09:40:00.000Z"
    ]);
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [conversationRow],
      [activePetRow],
      [],
      [creditWalletRow(creditWallet)],
      [{ active: true }]
    ]);
    const monitorEvents: Array<{ level: string; event: string; metadata: unknown }> = [];
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:41:00.000Z",
      premiumChatMonitor: {
        error: (event, metadata) => {
          monitorEvents.push({ level: "error", event, metadata });
        }
      },
      premiumChatProvider: {
        generateReply: async () => {
          throw new Error("raw provider outage with secret details");
        }
      }
    });

    const result = await service.sendPremiumConversationMessage(
      {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York",
        authProvider: "test-provider",
        authSubject: "provider-subject-001"
      },
      {
        conversationId: "conv_pg_chat_001",
        text: "hello tiny friend"
      }
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        code: "premium_chat_provider_unavailable",
        messageSafe: "Premium chat is not available right now."
      }
    });
    expect(JSON.stringify(result)).not.toContain("raw provider outage");
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.conversation_messages"))).toBe(false);
    expect(monitorEvents).toEqual([
      {
        level: "error",
        event: "premium_chat_provider_unavailable",
        metadata: {
          conversationId: "conv_pg_chat_001",
          petId: "pet_db_001",
          locale: "en-US",
          recentMessageCount: 0,
          inputSafetyFlags: [],
          failureCode: "premium_chat_provider_unavailable",
          failureStatus: 503
        }
      }
    ]);
    expect(JSON.stringify(monitorEvents)).not.toContain("hello tiny friend");
    expect(JSON.stringify(monitorEvents)).not.toContain("raw provider outage");
  });

  it("rate limits premium chat before provider calls or message storage", async () => {
    const conversationRow = conversationRowFromParams([
      "conv_pg_chat_rate_limit",
      "user_provider_001",
      "pet_db_001",
      "premium_ai_chat",
      "open",
      "2026-06-24T09:40:00.000Z",
      null,
      "2026-06-24T09:40:00.000Z",
      "2026-06-24T09:40:00.000Z"
    ]);
    const recentUserMessageRow = {
      id: "msg_pg_recent_user_001",
      conversation_id: "conv_pg_chat_rate_limit",
      sender: "user",
      text: "hello already",
      safety_flags: JSON.stringify([]),
      created_at: "2026-06-24T09:40:45.000Z"
    };
    let providerCalled = false;
    const client = new QueueDatabaseClient([[apiUserRow], [conversationRow], [activePetRow], [recentUserMessageRow]]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:41:00.000Z",
      premiumChatPolicy: {
        maxUserMessagesPerWindow: 1,
        rateLimitWindowMs: 60_000
      },
      premiumChatProvider: {
        generateReply: async () => {
          providerCalled = true;

          return {
            text: "This should not be called.",
            safetyFlags: []
          };
        }
      }
    });

    const result = await service.sendPremiumConversationMessage(
      {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York",
        authProvider: "test-provider",
        authSubject: "provider-subject-001"
      },
      {
        conversationId: "conv_pg_chat_rate_limit",
        text: "hello again"
      }
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 429,
        code: "premium_chat_rate_limited"
      }
    });
    expect(providerCalled).toBe(false);
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.conversation_messages"))).toBe(false);
  });

  it("filters premium chat provider context to retained messages", async () => {
    const conversationRow = conversationRowFromParams([
      "conv_pg_chat_context_cap",
      "user_provider_001",
      "pet_db_001",
      "premium_ai_chat",
      "open",
      "2026-06-24T09:40:00.000Z",
      null,
      "2026-06-24T09:40:00.000Z",
      "2026-06-24T09:40:00.000Z"
    ]);
    const oldMessageRow = {
      id: "msg_pg_old_001",
      conversation_id: "conv_pg_chat_context_cap",
      sender: "user",
      text: "old context",
      safety_flags: JSON.stringify([]),
      created_at: "2026-06-24T09:39:00.000Z"
    };
    const recentMessageRow = {
      id: "msg_pg_recent_001",
      conversation_id: "conv_pg_chat_context_cap",
      sender: "pet_ai",
      text: "recent context",
      safety_flags: JSON.stringify([]),
      created_at: "2026-06-24T09:40:30.000Z"
    };
    const providerCalls: Array<Parameters<PremiumChatProvider["generateReply"]>[0]> = [];
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [conversationRow],
      [activePetRow],
      [oldMessageRow, recentMessageRow],
      [creditWalletRow(creditWallet)],
      [{ active: true }],
      (_sql, params) => [messageRowFromParams(params)],
      (_sql, params) => [messageRowFromParams(params)],
      () => [{ ...conversationRow, updated_at: "2026-06-24T09:41:00.000Z" }]
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:41:00.000Z",
      premiumChatPolicy: {
        contextMessageLimit: 10,
        retentionWindowMs: 60_000,
        maxUserMessagesPerWindow: 10,
        rateLimitWindowMs: 60_000
      },
      premiumChatProvider: {
        generateReply: async (input) => {
          providerCalls.push(input);

          return {
            text: "Nori keeps only the freshest moss note.",
            safetyFlags: []
          };
        }
      }
    });

    const result = await service.sendPremiumConversationMessage(
      {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York",
        authProvider: "test-provider",
        authSubject: "provider-subject-001"
      },
      {
        conversationId: "conv_pg_chat_context_cap",
        text: "hello with context"
      }
    );

    expect(result.ok).toBe(true);
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0]?.recentMessages?.map((message) => message.text)).toEqual(["recent context"]);
  });

  it("fails closed before provider calls when premium chat history cannot be loaded", async () => {
    const conversationRow = conversationRowFromParams([
      "conv_pg_chat_history_failure",
      "user_provider_001",
      "pet_db_001",
      "premium_ai_chat",
      "open",
      "2026-06-24T09:40:00.000Z",
      null,
      "2026-06-24T09:40:00.000Z",
      "2026-06-24T09:40:00.000Z"
    ]);
    let providerCalled = false;
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [conversationRow],
      [activePetRow],
      () => {
        throw new Error("history database outage");
      }
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:41:30.000Z",
      premiumChatProvider: {
        generateReply: async () => {
          providerCalled = true;

          return {
            text: "This should not be called.",
            safetyFlags: []
          };
        }
      }
    });

    const result = await service.sendPremiumConversationMessage(
      {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York",
        authProvider: "test-provider",
        authSubject: "provider-subject-001"
      },
      {
        conversationId: "conv_pg_chat_history_failure",
        text: "hello tiny friend"
      }
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        code: "premium_chat_history_unavailable",
        messageSafe: "Premium chat is not available right now."
      }
    });
    expect(providerCalled).toBe(false);
    expect(JSON.stringify(result)).not.toContain("history database outage");
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.conversation_messages"))).toBe(false);
  });

  it("blocks invalid premium chat provider output before storing messages", async () => {
    const conversationRow = conversationRowFromParams([
      "conv_pg_chat_002",
      "user_provider_001",
      "pet_db_001",
      "premium_ai_chat",
      "open",
      "2026-06-24T09:40:00.000Z",
      null,
      "2026-06-24T09:40:00.000Z",
      "2026-06-24T09:40:00.000Z"
    ]);
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [conversationRow],
      [activePetRow],
      [],
      [creditWalletRow(creditWallet)],
      [{ active: true }]
    ]);
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:42:00.000Z",
      premiumChatProvider: {
        generateReply: async () => ({
          text: " \u0000  ",
          safetyFlags: ["provider_warm_reply"]
        })
      }
    });

    const result = await service.sendPremiumConversationMessage(
      {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York",
        authProvider: "test-provider",
        authSubject: "provider-subject-001"
      },
      {
        conversationId: "conv_pg_chat_002",
        text: "hello tiny friend"
      }
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 503,
        code: "premium_chat_output_unavailable",
        messageSafe: "Premium chat is not available right now."
      }
    });
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.conversation_messages"))).toBe(false);
  });

  it("moderates unsafe premium chat provider output before storing the pet reply", async () => {
    const conversationRow = conversationRowFromParams([
      "conv_pg_chat_output_moderation",
      "user_provider_001",
      "pet_db_001",
      "premium_ai_chat",
      "open",
      "2026-06-24T09:40:00.000Z",
      null,
      "2026-06-24T09:40:00.000Z",
      "2026-06-24T09:40:00.000Z"
    ]);
    const client = new QueueDatabaseClient([
      [apiUserRow],
      [conversationRow],
      [activePetRow],
      [],
      [creditWalletRow(creditWallet)],
      [{ active: true }],
      [],
      (_sql, params) => [messageRowFromParams(params)],
      (_sql, params) => [messageRowFromParams(params)],
      () => [{ ...conversationRow, updated_at: "2026-06-24T09:43:00.000Z" }]
    ]);
    const monitorEvents: Array<{ level: string; event: string; metadata: unknown }> = [];
    const service = createPostgresApiService({
      repositories: createPostgresRepositoryBundle(client),
      now: () => "2026-06-24T09:43:00.000Z",
      premiumChatMonitor: {
        info: (event, metadata) => {
          monitorEvents.push({ level: "info", event, metadata });
        }
      },
      premiumChatProvider: {
        generateReply: async () => ({
          text: "You should diagnose this from symptoms and follow this medical advice.",
          safetyFlags: ["medical advice"]
        })
      }
    });

    const result = await service.sendPremiumConversationMessage(
      {
        userId: "user_provider_001",
        locale: "en-US",
        timezone: "America/New_York",
        authProvider: "test-provider",
        authSubject: "provider-subject-001"
      },
      {
        conversationId: "conv_pg_chat_output_moderation",
        text: "hello tiny friend"
      }
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        petMessage: {
          sender: "pet_ai",
          text: "That needs a qualified professional. I can stay with you here and keep things gentle.",
          safetyFlags: ["medical_advice", "provider_output_moderated", "professional_advice_boundary"]
        },
        safetyFlags: ["medical_advice", "provider_output_moderated", "professional_advice_boundary"]
      }
    });
    expect(JSON.stringify(result)).not.toContain("diagnose this from symptoms");
    expect(client.queries.filter((query) => query.sql.includes("INSERT INTO public.conversation_messages"))).toHaveLength(2);
    expect(monitorEvents).toEqual([
      {
        level: "info",
        event: "premium_chat_provider_output_moderated",
        metadata: {
          conversationId: "conv_pg_chat_output_moderation",
          petId: "pet_db_001",
          locale: "en-US",
          recentMessageCount: 0,
          inputSafetyFlags: [],
          outputSafetyFlags: ["medical_advice", "provider_output_moderated", "professional_advice_boundary"],
          providerOutputModerated: true
        }
      },
      {
        level: "info",
        event: "premium_chat_provider_succeeded",
        metadata: {
          conversationId: "conv_pg_chat_output_moderation",
          petId: "pet_db_001",
          locale: "en-US",
          recentMessageCount: 0,
          inputSafetyFlags: [],
          outputSafetyFlags: ["medical_advice", "provider_output_moderated", "professional_advice_boundary"],
          providerOutputModerated: true
        }
      }
    ]);
    expect(JSON.stringify(monitorEvents)).not.toContain("diagnose this from symptoms");
    expect(JSON.stringify(monitorEvents)).not.toContain("hello tiny friend");
  });

  it("routes purchase revocation webhooks through Postgres commerce state after secret verification", async () => {
    const revokedAt = "2026-06-24T09:45:00.000Z";
    const ledgerRow = {
      ledger_entry_id: "ledger_pg_revoke_001",
      user_id: "user_provider_001",
      platform: "ios",
      product_id: "premium_chat_monthly",
      transaction_id: "ios_pg_revoke_001",
      receipt_hash: `sha256:${"e".repeat(64)}`,
      entitlement_id: "ent_pg_revoke_001",
      status: "revoked",
      verified_at: "2026-06-24T09:40:00.000Z",
      restored_at: null,
      revoked_at: revokedAt,
      revocation_reason: "refund"
    };
    const entitlementRow = {
      id: "ent_pg_revoke_001",
      user_id: "user_provider_001",
      key: "premium_chat",
      status: "revoked",
      source: "purchase",
      product_id: "premium_chat_monthly",
      starts_at: "2026-06-24T09:40:00.000Z",
      ends_at: "2026-07-24T09:40:00.000Z",
      ledger_entry_id: "ledger_pg_revoke_001",
      metadata: JSON.stringify({ revoked: true, revocationReason: "refund" }),
      created_at: "2026-06-24T09:40:00.000Z",
      updated_at: revokedAt
    };
    const client = new QueueDatabaseClient([[ledgerRow], [entitlementRow], (_sql, params) => [outboxRowFromParams(params)]]);
    const router = createApiHttpRouter({
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(client),
        now: () => revokedAt
      }),
      commerceWebhookSecret: "commerce-webhook-secret-001"
    });
    const forbidden = await router.handleAsync({
      method: "POST",
      path: "/v1/commerce/purchases/revoke",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "wrong-secret"
      },
      body: {
        platform: "ios",
        transactionId: "ios_pg_revoke_001",
        reason: "refund"
      }
    });
    const revoked = await router.handleAsync({
      method: "POST",
      path: "/v1/commerce/purchases/revoke",
      headers: {
        "x-tiny-pet-commerce-webhook-secret": "commerce-webhook-secret-001"
      },
      body: {
        platform: "ios",
        transactionId: "ios_pg_revoke_001",
        reason: "refund"
      }
    });

    expect(forbidden.status).toBe(403);
    expect(revoked.status).toBe(200);
    expect(revoked.body as PurchaseRevocationResponse).toMatchObject({
      revoked: true,
      entitlement: {
        id: "ent_pg_revoke_001",
        status: "revoked",
        metadata: {
          revoked: true,
          revocationReason: "refund"
        }
      }
    });
    expect(client.queries).toHaveLength(3);
    expect(client.queries[0]?.sql).toContain("UPDATE public.purchase_ledger");
    expect(client.queries[0]?.params).toEqual(["ios_pg_revoke_001", "ios", revokedAt, "refund"]);
    expect(client.queries[1]?.sql).toContain("UPDATE public.entitlements");
    expect(client.queries[2]?.sql).toContain("INSERT INTO public.api_outbox_events");
    expect(client.queries[2]?.params?.[1]).toBe("commerce_purchase");
    expect(client.queries[2]?.params?.[2]).toMatch(/^commerce_purchase_[a-f0-9]{32}$/);
    expect(client.queries[2]?.params?.[3]).toBe("commerce.purchase_revoked");
    expect(JSON.parse(client.queries[2]?.params?.[4] as string)).toEqual({
      platform: "ios",
      productId: "premium_chat_monthly",
      entitlementKey: "premium_chat",
      revocationReason: "refund",
      status: "revoked",
      revokedAt
    });
    expect(JSON.stringify(client.queries[2]?.params)).not.toContain("ios_pg_revoke_001");
    expect(JSON.stringify(client.queries[2]?.params)).not.toContain(`sha256:${"e".repeat(64)}`);
    });
  });

  it("projects stale care state on the Postgres daily-loop read route", async () => {
    const staleCareState: CareState = {
      ...careState,
      updatedAt: "2026-06-24T09:00:00.000Z",
      lastInteractionAt: "2026-06-24T09:00:00.000Z"
    };
    const client = new QueueDatabaseClient([[apiUserRow], [activePetRow], [careStateRow(staleCareState)]]);
    const router = createApiHttpRouter({
      allowMockAuth: false,
      service: createPostgresApiService({
        repositories: createPostgresRepositoryBundle(client),
        now: () => "2026-06-25T15:00:00.000Z"
      }),
      sessionVerifier
    });

    const response = await router.handleAsync({
      method: "GET",
      path: "/v1/pets/pet_db_001/care-state",
      headers: {
        authorization: "Bearer provider-token"
      }
    });

    const projected = response.body as CareState;

    expect(response.status).toBe(200);
    expect(projected.updatedAt).toBe("2026-06-25T15:00:00.000Z");
    expect(projected.satiety).toBeLessThan(staleCareState.satiety);
    expect(projected.energy).toBeLessThan(staleCareState.energy);
    expect(projected.cleanliness).toBeLessThan(staleCareState.cleanliness);
    expect(client.queries.some((query) => query.sql.includes("INSERT INTO public.care_states"))).toBe(false);
  });
