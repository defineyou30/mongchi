import { describe, expect, it } from "vitest";

import {
  createInitialPrototypeSession,
  getActivePetBundle,
  mockCareState,
  mockCreditWallet,
  mockInventory,
  mockItems,
  mockPetProfile,
  mockRelationshipState
} from "@mongchi/shared";
import type {
  CareActionRequest,
  CareActionType,
  CareState,
  CommerceProductsResponse,
  Inventory,
  Item,
  ListPetsResponse,
  SelectedReaction,
  WalkSession
} from "@mongchi/shared";

import type { MobileApiResult } from "../../shared/api";
import {
  claimApiDailyLoopWalkReward,
  createConfiguredDailyLoopApiClient,
  loadApiDailyLoopState,
  performApiDailyLoopCareAction,
  refreshApiWalkLocally
} from "./apiDailyLoopSession";
import type { DailyLoopApiClient } from "./apiDailyLoopSession";

const ok = <T>(data: T, status = 200): MobileApiResult<T> => ({
  ok: true,
  status,
  data
});

const apiError = <T>(code: string): MobileApiResult<T> => ({
  ok: false,
  error: {
    status: 500,
    code,
    messageSafe: "Request failed.",
    retryable: true
  }
});

// apiDailyLoopSession.ts's helpers read per-pet fields (relationshipState/
// inventory-adjacent care fields) directly off their `currentState`
// parameter -- in production that parameter is
// TerrariumSessionProvider's `legacyFlatState` (the active bundle
// flattened back onto the top level), not the raw PrototypeSessionState.
// Tests that call these helpers directly need the same flattening.
const toLegacyFlatState = <T extends ReturnType<typeof createInitialPrototypeSession>>(state: T) => ({
  ...state,
  ...getActivePetBundle(state)
});

const reaction: SelectedReaction = {
  ruleId: "ko_fed_recent_001",
  category: "fed_recent",
  line: "맛있었어.",
  animation: "happy",
  priority: 80
};

const walk: WalkSession = {
  id: "walk_001",
  userId: mockPetProfile.userId,
  petId: mockPetProfile.id,
  status: "walking",
  startedAt: "2026-06-24T09:00:00.000Z",
  returnAt: "2026-06-24T09:00:15.000Z",
  rewardItemIds: ["item_flower_pot_sunny"],
  energyCost: 12,
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const findMockItem = (itemId: string): Item => {
  const item = mockItems.find((candidate) => candidate.id === itemId) ?? mockItems[0];

  if (!item) {
    throw new Error("Expected mock item catalog to contain at least one item.");
  }

  return item;
};

const createFakeClient = (
  overrides: Partial<DailyLoopApiClient> = {}
): DailyLoopApiClient => ({
  getCurrentUser: async () =>
    ok({
      userId: mockPetProfile.userId,
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      onboardingState: "pet_active",
      wallet: mockCreditWallet
    }),
  listPets: async () => ok<ListPetsResponse>({ pets: [mockPetProfile] }),
  getCareState: async () => ok<CareState>(mockCareState),
  getRelationshipState: async () => ok(mockRelationshipState),
  getInventory: async () => ok<Inventory>(mockInventory),
  getItemCatalog: async () => ok<{ items: Item[] }>({ items: mockItems }),
  getCommerceProducts: async () =>
    ok<CommerceProductsResponse>({
      products: [
        { productId: "premium_chat_monthly", entitlementKey: "premium_chat", grantType: "subscription" },
        { productId: "theme_pack_starter", entitlementKey: "theme_pack", grantType: "durable" }
      ]
    }),
  getEntitlements: async () => ok({ entitlements: [] }),
  verifyPurchase: async () =>
    ok({
      entitlements: [],
      serverVerified: true
    }),
  performCareAction: async (_petId: string, body: CareActionRequest) =>
    ok({
      careState: {
        ...mockCareState,
        satiety: body.action === "feed" ? 76 : mockCareState.satiety,
        updatedAt: body.occurredAt
      },
      relationshipState: {
        ...mockRelationshipState,
        bondXp: mockRelationshipState.bondXp + 9,
        updatedAt: body.occurredAt
      },
      inventory: null,
      reaction,
      reward: null
    }),
  startWalk: async () =>
    ok({
      walk,
      careState: {
        ...mockCareState,
        activeWalkId: walk.id
      },
      relationshipState: {
        ...mockRelationshipState,
        bondXp: mockRelationshipState.bondXp + 2,
        updatedAt: walk.startedAt
      },
      reaction: {
        ...reaction,
        category: "walk_start",
        animation: "walk_out"
      }
    }),
  claimWalkReward: async () =>
    ok({
      walk: {
        ...walk,
        status: "claimed",
        claimedAt: "2026-06-24T09:00:15.000Z",
        updatedAt: "2026-06-24T09:00:15.000Z"
      },
      inventory: {
        ...mockInventory,
        items: [
          ...mockInventory.items,
          {
            itemId: "item_flower_pot_sunny",
            quantity: 1,
            acquiredAt: "2026-06-24T09:00:15.000Z",
            source: "walk_reward"
          }
        ]
      },
      relationshipState: mockRelationshipState,
      reaction: {
        ...reaction,
        category: "new_item",
        animation: "idle_happy"
      }
    }),
  lookupCurrentWeather: async (body) =>
    ok({
      weather: {
        source: "device_location",
        condition: "rain",
        intensity: "normal",
        isDaytime: true,
        fetchedAt: body.requestedAt,
        temperatureC: 17,
        regionLabel: "Approximate local weather"
      },
      cache: {
        key: "weather:37.6:127.0",
        approximateLatitude: body.approximateLatitude,
        approximateLongitude: body.approximateLongitude,
        expiresAt: "2026-06-24T09:30:00.000Z",
        maxAgeSeconds: 1800
      }
    }),
  placeInventoryItem: async () =>
    ok({
      inventory: mockInventory
    }),
  purchaseInventoryItem: async (body) =>
    ok(
      {
        item: findMockItem(body.itemId),
        inventory: {
          ...mockInventory,
          items: [
            ...mockInventory.items,
            {
              itemId: body.itemId,
              quantity: 1,
              acquiredAt: "2026-06-24T09:00:00.000Z",
              source: "purchase"
            }
          ]
        },
        wallet: {
          ...mockCreditWallet,
          bonusCredits: mockCreditWallet.bonusCredits - 3
        },
        walletSpend: {
          freeChatTicketsSpent: 0,
          bonusCreditsSpent: 3,
          creditsSpent: 0
        },
        creditCost: 3
      },
      201
    ),
  removePlacedItem: async () =>
    ok({
      inventory: mockInventory
    }),
  getGeneratedAssetSignedUrl: async (assetId) =>
    ok({
      assetId,
      petId: mockPetProfile.id,
      signedUrl: "mock-signed-read://private/user_demo_001/pet_miso_001/asset_miso_idle_001",
      expiresAt: "2026-06-24T09:15:00.000Z",
      contentType: "image/png",
      storageClass: "private_app_asset"
    }),
  reportGenerationIssue: async (body) =>
    ok({
      reportId: "gen_issue_001",
      petId: body.petId,
      ...(body.generationJobId ? { generationJobId: body.generationJobId } : {}),
      category: body.category,
      reportedAt: "2026-06-24T09:00:00.000Z"
    }),
  deleteOriginalPhotos: async () =>
    ok({
      deletedPhotoIds: ["photo_001"],
      deletedAt: "2026-06-24T09:00:00.000Z"
    }),
  deleteChatHistory: async () =>
    ok({
      deletedConversationIds: ["conv_001"],
      deletedMessageIds: ["msg_001"],
      deletedAt: "2026-06-24T09:00:00.000Z"
    }),
  deletePrivacyPet: async (petId: string) =>
    ok({
      deletedPetId: petId,
      deletedAt: "2026-06-24T09:00:00.000Z"
    }),
  restorePurchases: async () =>
    ok({
      entitlements: [],
      serverVerified: true
    }),
  // Premium chat's createPremiumConversation/getConversationThread/
  // deleteConversation/sendPremiumConversationMessage fakes used to live
  // here -- removed alongside their DailyLoopApiClient methods in Chat Live
  // wave C2 (docs/chat-live-design.md §6.1/§9 risk 5); see
  // supabasePremiumChatSession.test.ts for live chat-turn coverage.
  ...overrides
});

describe("API daily loop session helpers", () => {
  it("keeps local mode when no API base URL is configured and validates configured URLs", () => {
    expect(createConfiguredDailyLoopApiClient(null)).toMatchObject({
      mode: "local",
      error: null,
      client: null
    });
    expect(createConfiguredDailyLoopApiClient("http://api.example.com")).toMatchObject({
      mode: "local",
      error: {
        code: "api_base_url_invalid"
      },
      client: null
    });
    expect(createConfiguredDailyLoopApiClient("http://localhost:8787")).toMatchObject({
      mode: "api",
      error: null
    });
  });

  it("loads pet, care, inventory, and catalog state from the API boundary", async () => {
    const result = await loadApiDailyLoopState(createFakeClient());

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected successful API state load");
    }

    expect(result.data.state.petProfile?.id).toBe(mockPetProfile.id);
    expect(result.data.state.careState?.petId).toBe(mockPetProfile.id);
    expect(result.data.state.relationshipState?.petId).toBe(mockPetProfile.id);
    expect(result.data.state.wallet?.bonusCredits).toBe(mockCreditWallet.bonusCredits);
    expect(result.data.state.inventory?.userId).toBe(mockInventory.userId);
    expect(result.data.state.commerceProducts.map((product) => product.productId)).toContain("premium_chat_monthly");
    expect(result.data.state.entitlements).toEqual([]);
    expect(result.data.catalogItems.map((item) => item.id)).toContain("item_toy_ball_mint");
  });

  it("maps API care and walk actions into prototype session patches", async () => {
    const client = createFakeClient();
    const currentState = {
      ...toLegacyFlatState(createInitialPrototypeSession("2026-06-24T09:00:00.000Z")),
      inventory: {
        ...mockInventory,
        placedItems: [
          {
            itemId: "item_flower_pot_sunny",
            slot: "garden" as const,
            x: 0.5,
            y: 0.5,
            rotation: 0
          }
        ],
        plantGrowth: []
      }
    };
    const feed = await performApiDailyLoopCareAction(
      client,
      currentState,
      mockItems,
      mockPetProfile.id,
      "feed",
      "2026-06-24T09:01:00.000Z"
    );
    const waterGarden = await performApiDailyLoopCareAction(
      client,
      currentState,
      mockItems,
      mockPetProfile.id,
      "water_garden",
      "2026-06-24T09:02:00.000Z"
    );
    const startWalk = await performApiDailyLoopCareAction(
      client,
      currentState,
      mockItems,
      mockPetProfile.id,
      "walk",
      "2026-06-24T09:03:00.000Z"
    );

    expect(feed).toMatchObject({
      ok: true,
      data: {
        careState: {
          satiety: 76
        },
        currentReaction: {
          category: "fed_recent"
        }
      }
    });
    expect(feed.ok ? feed.data.relationshipState?.bondXp : null).toBe(mockRelationshipState.bondXp + 9);
    expect(waterGarden).toMatchObject({
      ok: true,
      data: {
        relationshipState: {
          bondXp: mockRelationshipState.bondXp + 9
        },
        inventory: {
          plantGrowth: [
            expect.objectContaining({
              itemId: "item_flower_pot_sunny",
              stageIndex: 0,
              waterPoints: 1
            })
          ]
        }
      }
    });
    expect(startWalk).toMatchObject({
      ok: true,
      data: {
        activeWalk: {
          id: walk.id,
          status: "walking"
        },
        careState: {
          activeWalkId: walk.id
        },
        currentReaction: {
          category: "walk_start"
        }
      }
    });
    expect(startWalk.ok ? startWalk.data.relationshipState?.bondXp : null).toBe(currentState.relationshipState.bondXp + 2);
  });

  it("keeps bloom reward and wallet updates from API care responses", async () => {
    const client = createFakeClient({
      performCareAction: async (_petId, body) =>
        ok({
          careState: {
            ...mockCareState,
            gardenHealth: 91,
            updatedAt: body.occurredAt
          },
          relationshipState: {
            ...mockRelationshipState,
            bondXp: mockRelationshipState.bondXp + 4,
            updatedAt: body.occurredAt
          },
          inventory: {
            ...mockInventory,
            plantGrowth: [
              {
                itemId: "item_flower_pot_sunny",
                stageIndex: 3,
                waterPoints: 0,
                lastWateredAt: body.occurredAt,
                updatedAt: body.occurredAt
              }
            ],
            updatedAt: body.occurredAt
          },
          wallet: {
            ...mockCreditWallet,
            bonusCredits: mockCreditWallet.bonusCredits + 1,
            updatedAt: body.occurredAt
          },
          reaction,
          reward: {
            type: "plant_bloom",
            itemId: "item_flower_pot_sunny",
            bonusCredits: 1,
            bondXp: 3
          }
        })
    });
    const currentState = toLegacyFlatState(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));

    const result = await performApiDailyLoopCareAction(
      client,
      currentState,
      mockItems,
      mockPetProfile.id,
      "water_garden",
      "2026-06-24T09:02:00.000Z"
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        wallet: {
          bonusCredits: mockCreditWallet.bonusCredits + 1
        },
        lastCareReward: {
          type: "plant_bloom",
          itemId: "item_flower_pot_sunny"
        }
      }
    });
  });

  it("passes consumable treat item ids through the API care action boundary", async () => {
    let receivedBody: CareActionRequest | null = null;
    const currentState = toLegacyFlatState(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const inventory: Inventory = {
      ...mockInventory,
      items: [
        ...mockInventory.items,
        {
          itemId: "item_treat_plate_biscuit",
          quantity: 1,
          acquiredAt: "2026-06-24T09:00:00.000Z",
          source: "purchase"
        }
      ],
      placedItems: [
        ...mockInventory.placedItems,
        {
          itemId: "item_treat_plate_biscuit",
          slot: "pet_corner",
          x: 0.42,
          y: 0.72,
          rotation: 0
        }
      ]
    };
    const client = createFakeClient({
      performCareAction: async (_petId, body) => {
        receivedBody = body;

        return ok({
          careState: {
            ...mockCareState,
            happiness: 88,
            updatedAt: body.occurredAt
          },
          relationshipState: mockRelationshipState,
          inventory: {
            ...inventory,
            items: inventory.items.filter((item) => item.itemId !== "item_treat_plate_biscuit"),
            placedItems: inventory.placedItems.filter((item) => item.itemId !== "item_treat_plate_biscuit"),
            updatedAt: body.occurredAt
          },
          reaction: {
            ...reaction,
            category: "treat_common",
            animation: "treat"
          },
          reward: null
        });
      }
    });

    const result = await performApiDailyLoopCareAction(
      client,
      currentState,
      mockItems,
      mockPetProfile.id,
      "treat",
      "2026-06-24T09:02:00.000Z",
      "item_treat_plate_biscuit"
    );

    expect(receivedBody).toEqual({
      action: "treat",
      itemId: "item_treat_plate_biscuit",
      occurredAt: "2026-06-24T09:02:00.000Z"
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        careState: {
          happiness: 88
        },
        inventory: {
          items: expect.not.arrayContaining([expect.objectContaining({ itemId: "item_treat_plate_biscuit" })]),
          placedItems: expect.not.arrayContaining([expect.objectContaining({ itemId: "item_treat_plate_biscuit" })])
        },
        currentReaction: {
          category: "treat_common",
          animation: "treat"
        }
      }
    });
  });

  it("claims walk rewards and refreshes returned walks without an extra server endpoint", async () => {
    const currentState = {
      ...toLegacyFlatState(createInitialPrototypeSession("2026-06-24T09:00:00.000Z")),
      inventory: {
        ...mockInventory,
        plantGrowth: [
          {
            itemId: "item_flower_pot_sunny",
            stageIndex: 1,
            waterPoints: 0,
            lastWateredAt: "2026-06-24T09:00:00.000Z",
            updatedAt: "2026-06-24T09:00:00.000Z"
          }
        ]
      }
    };
    const claimed = await claimApiDailyLoopWalkReward(createFakeClient(), currentState, walk.id, mockPetProfile.id);

    expect(refreshApiWalkLocally(walk, "2026-06-24T09:00:14.000Z")).toMatchObject({
      status: "walking"
    });
    expect(refreshApiWalkLocally(walk, "2026-06-24T09:00:15.000Z")).toMatchObject({
      status: "returned"
    });
    expect(claimed).toMatchObject({
      ok: true,
      data: {
        activeWalk: null,
        inventory: {
          items: expect.arrayContaining([
            expect.objectContaining({
              itemId: "item_flower_pot_sunny",
              quantity: 1
            })
          ]),
          plantGrowth: [
            expect.objectContaining({
              itemId: "item_flower_pot_sunny",
              stageIndex: 1
            })
          ]
        },
        currentReaction: {
          category: "new_item"
        }
      }
    });
  });

  it("returns safe API errors without applying patches", async () => {
    const result = await loadApiDailyLoopState(
      createFakeClient({
        getInventory: async () => apiError("inventory_failed")
      })
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "inventory_failed",
        retryable: true
      }
    });
  });
});
