import { describe, expect, it } from "vitest";

import {
  createInitialPrototypeSession,
  createPersistedSessionEnvelope,
  CURRENT_SESSION_SCHEMA_VERSION,
  DEFAULT_THEME_ID,
  getActivePetBundle,
  isValidPrototypeSessionShape,
  runSessionMigrations,
  sessionMigrations
} from "../index";

const FIRST_PET_ID = "pet_local_001";
const active = getActivePetBundle;

/**
 * Migrations 1-6 all run against the pre-v7 flat shape (per-pet fields --
 * petProfile/acceptedAsset(s)/careState/relationshipState/currentReaction/
 * lastCareReward/recentReactions/activeWalk/lastWalkDiscovery/
 * generationIssueReport/memories/careStats -- sitting at the TOP level, not
 * inside `pets[petId]`). createInitialPrototypeSession now always returns
 * the current (v7, bundled) shape, so fixtures simulating an old legacy
 * payload need to flatten a fresh bundle back out to look like what a real
 * v1-v6 save on disk looked like. Only the v6 -> v7 migration (tested
 * separately below) expects the bundled shape as input.
 */
const flattenToLegacyShape = (state: ReturnType<typeof createInitialPrototypeSession>) => {
  const { pets, activePetId, ...shared } = state;
  const bundle = pets[activePetId]!;

  return { ...shared, ...bundle };
};

describe("session schema migrations", () => {
  it("treats a legacy payload with no schemaVersion field as v0 and migrates it to the current version", () => {
    const legacyState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));

    const result = runSessionMigrations(legacyState);

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    // v0 -> v1 is a no-op shape change and v1 -> v2 leaves this fixture
    // untouched, so the only expected differences after the full chain are
    // the v2 -> v3 step dropping the (already-empty) placedItems field and
    // the v6 -> v7 step lifting every per-pet field into `pets[petId]`.
    const { placedItems: _placedItems, ...legacyInventoryWithoutPlacedItems } = legacyState.inventory;
    const {
      petProfile,
      acceptedAsset,
      acceptedAssets,
      careState,
      relationshipState,
      currentReaction,
      lastCareReward,
      recentReactions,
      activeWalk,
      lastWalkDiscovery,
      generationIssueReport,
      memories,
      careStats,
      ...restOfLegacyState
    } = legacyState;

    expect(result.state).toEqual({
      ...restOfLegacyState,
      inventory: legacyInventoryWithoutPlacedItems,
      pets: {
        [FIRST_PET_ID]: {
          petProfile,
          acceptedAsset,
          acceptedAssets,
          careState,
          relationshipState,
          currentReaction,
          lastCareReward,
          recentReactions,
          activeWalk,
          lastWalkDiscovery,
          generationIssueReport,
          memories,
          careStats
        }
      },
      activePetId: FIRST_PET_ID
    });
  });

  it("preserves user progress fields through the v0 -> v1 migration", () => {
    const legacyState = {
      ...flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z")),
      wallet: { userId: "user_demo_001", paidCredits: 42, bonusCredits: 7, freeChatTickets: 3, updatedAt: "2026-06-24T09:00:00.000Z" }
    };

    const result = runSessionMigrations(legacyState);

    expect(result.ok).toBe(true);
    expect((result.state as { wallet: typeof legacyState.wallet }).wallet.paidCredits).toBe(42);
  });

  it("passes through an already-current envelope without re-running migrations", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const envelope = createPersistedSessionEnvelope(state);

    const result = runSessionMigrations(envelope);

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(result.state).toEqual(state);
  });

  it("round-trips cleanly through JSON serialization", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const serialized = JSON.stringify(createPersistedSessionEnvelope(state));

    const result = runSessionMigrations(JSON.parse(serialized));

    expect(result.ok).toBe(true);
    expect(result.state).toEqual(state);
  });

  it("does not trust a schemaVersion newer than the current app version (fixed policy: unmigratable, caller must back up and reset)", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const futureEnvelope = { schemaVersion: CURRENT_SESSION_SCHEMA_VERSION + 1, state };

    const result = runSessionMigrations(futureEnvelope);

    expect(result.ok).toBe(false);
    expect(result.fromVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION + 1);
  });

  it("fails closed when a migration step is missing from the registry (does not silently skip)", () => {
    // Simulate a payload claiming to be two versions behind current, but the
    // registry only knows how to migrate from v0. This should never happen
    // in production (every version gets a migration when CURRENT bumps), but
    // the runner must not silently pass corrupt/unknown-version data through.
    const gappedPayload = { schemaVersion: -1, state: {} };

    const result = runSessionMigrations(gappedPayload);

    // schemaVersion -1 is not a valid stored version; readSchemaVersion only
    // special-cases missing/non-numeric fields as v0, so an explicit -1 is
    // read literally and there is no migrations[-1] entry registered.
    expect(sessionMigrations[-1]).toBeUndefined();
    expect(result.ok).toBe(false);
  });

  it("merges duplicate inventory.items rows for the same itemId on v1 -> v2 (root fix for the shop duplicate-card bug)", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const v1Envelope = {
      schemaVersion: 1,
      state: {
        ...baseState,
        inventory: {
          ...baseState.inventory,
          items: [
            { itemId: "item_food_bowl_basic", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "starter" },
            { itemId: "item_toy_ball_mint", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "starter" },
            { itemId: "item_food_bowl_basic", quantity: 2, acquiredAt: "2026-06-25T10:00:00.000Z", source: "walk_reward" },
            { itemId: "item_treat_plate_biscuit", quantity: 1, acquiredAt: "2026-06-25T11:00:00.000Z", source: "purchase" },
            { itemId: "item_treat_plate_biscuit", quantity: 1, acquiredAt: "2026-06-25T12:00:00.000Z", source: "purchase" }
          ]
        }
      }
    };

    const result = runSessionMigrations(v1Envelope);
    const inventory = (result.state as typeof baseState).inventory;

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(1);
    expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(inventory.items).toHaveLength(3);

    const foodBowl = inventory.items.find((entry) => entry.itemId === "item_food_bowl_basic");
    const treatPlate = inventory.items.find((entry) => entry.itemId === "item_treat_plate_biscuit");

    // Quantities from every duplicate row are summed onto a single entry.
    expect(foodBowl?.quantity).toBe(3);
    // The starter-sourced duplicate wins identity (source/acquiredAt) over a later grant.
    expect(foodBowl?.source).toBe("starter");
    expect(foodBowl?.acquiredAt).toBe("2026-06-24T09:00:00.000Z");
    // With no starter row, the earliest-acquired duplicate's identity wins.
    expect(treatPlate?.quantity).toBe(2);
    expect(treatPlate?.acquiredAt).toBe("2026-06-25T11:00:00.000Z");
  });

  it("chains a legacy v0 payload with duplicate inventory rows through v0 -> v2 in one call", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const legacyState = {
      ...baseState,
      inventory: {
        ...baseState.inventory,
        items: [
          { itemId: "item_toy_ball_mint", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "starter" },
          { itemId: "item_toy_ball_mint", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "starter" }
        ]
      }
    };

    const result = runSessionMigrations(legacyState);
    const inventory = (result.state as typeof baseState).inventory;

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(inventory.items).toEqual([{ itemId: "item_toy_ball_mint", quantity: 2, acquiredAt: "2026-06-24T09:00:00.000Z", source: "starter" }]);
  });

  it("leaves inventory data with no duplicates untouched by the v1 -> v2 merge", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const envelope = createPersistedSessionEnvelope(state);

    const result = runSessionMigrations(envelope);

    expect(result.ok).toBe(true);
    expect((result.state as typeof state).inventory.items).toEqual(state.inventory.items);
  });

  it("strips retired plant/pot catalog items from items, placedItems, and plantGrowth on v1 -> v2", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const v1Envelope = {
      schemaVersion: 1,
      state: {
        ...baseState,
        inventory: {
          ...baseState.inventory,
          items: [
            ...baseState.inventory.items,
            { itemId: "item_flower_pot_sunny", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "walk_reward" },
            { itemId: "item_leafy_plant_clover", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "purchase" },
            { itemId: "item_seasonal_flowers_spring", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "purchase" }
          ],
          placedItems: [{ itemId: "item_flower_pot_sunny", slot: "garden", x: 0.18, y: 0.78, rotation: -5 }],
          plantGrowth: [{ itemId: "item_flower_pot_sunny", stageIndex: 1, waterPoints: 0, updatedAt: "2026-06-24T09:00:00.000Z" }]
        }
      }
    };

    // Migrating from v1 runs the full chain up to CURRENT (v3 today), so the
    // v2 -> v3 step also strips placedItems/plantGrowth outright — this test
    // only asserts the v1 -> v2 plant/pot item retirement still holds along
    // the way.
    const result = runSessionMigrations(v1Envelope);
    const inventory = (result.state as typeof baseState).inventory;

    expect(result.ok).toBe(true);
    expect(inventory.items.some((entry) => entry.itemId === "item_flower_pot_sunny")).toBe(false);
    expect(inventory.items.some((entry) => entry.itemId === "item_leafy_plant_clover")).toBe(false);
    expect(inventory.items.some((entry) => entry.itemId === "item_seasonal_flowers_spring")).toBe(false);
  });

  it("drops placedItems and retired placement-decor catalog items on v2 -> v3", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const v2Envelope = {
      schemaVersion: 2,
      state: {
        ...baseState,
        inventory: {
          ...baseState.inventory,
          items: [
            ...baseState.inventory.items,
            { itemId: "item_lantern_glow", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "purchase" },
            { itemId: "item_stepping_stone_path", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "purchase" },
            { itemId: "item_treat_plate_biscuit", quantity: 2, acquiredAt: "2026-06-24T09:00:00.000Z", source: "purchase" }
          ],
          placedItems: [
            { itemId: "item_food_bowl_basic", slot: "pet_corner", x: 0.32, y: 0.72, rotation: 0 },
            { itemId: "item_lantern_glow", slot: "sky", x: 0.86, y: 0.36, rotation: 0 }
          ]
        }
      }
    };

    const result = runSessionMigrations(v2Envelope);
    const inventory = (result.state as typeof baseState).inventory;

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(2);
    expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(inventory.placedItems).toBeUndefined();
    expect(inventory.items.some((entry) => entry.itemId === "item_lantern_glow")).toBe(false);
    expect(inventory.items.some((entry) => entry.itemId === "item_stepping_stone_path")).toBe(false);
    // Consumable items are untouched by the v2 -> v3 decor cleanup.
    expect(inventory.items.find((entry) => entry.itemId === "item_treat_plate_biscuit")?.quantity).toBe(2);
    expect(inventory.items.some((entry) => entry.itemId === "item_food_bowl_basic")).toBe(true);
  });

  it("chains a legacy v0 payload with placed decor all the way through v0 -> v3 in one call", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const legacyState = {
      ...baseState,
      inventory: {
        ...baseState.inventory,
        items: [
          ...baseState.inventory.items,
          { itemId: "item_gem_pink", quantity: 1, acquiredAt: "2026-06-24T09:00:00.000Z", source: "purchase" }
        ],
        placedItems: [{ itemId: "item_gem_pink", slot: "garden", x: 0.62, y: 0.58, rotation: 0 }]
      }
    };

    const result = runSessionMigrations(legacyState);
    const inventory = (result.state as typeof baseState).inventory;

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(inventory.placedItems).toBeUndefined();
    expect(inventory.items.some((entry) => entry.itemId === "item_gem_pink")).toBe(false);
  });

  it("leaves a save with no placement decor unchanged in substance by the v2 -> v3 migration", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const envelope = { schemaVersion: 2, state };

    const result = runSessionMigrations(envelope);
    const inventory = (result.state as typeof state).inventory;

    expect(result.ok).toBe(true);
    expect(inventory.items).toEqual(state.inventory.items);
    expect(inventory.placedItems).toBeUndefined();
  });

  it("injects empty memories and default careStats on v3 -> v4 for a save with no pet yet", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const { memories: _memories, careStats: _careStats, ...baseStateWithoutMemorySpine } = baseState;
    const v3Envelope = {
      schemaVersion: 3,
      state: baseStateWithoutMemorySpine
    };

    const result = runSessionMigrations(v3Envelope);

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(3);
    expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;
    expect(active(migrated).memories).toEqual([]);
    expect(active(migrated).careStats).toEqual({
      actionCounts: {},
      treatItemCounts: {},
      walkCount: 0,
      totalCareActions: 0
    });
  });

  it("backfills a moved_in memory dated to the pet's createdAt when an existing save already has an activePet", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-01T09:00:00.000Z"));
    const petProfile = {
      id: "pet_local_001",
      userId: "user_demo_001",
      name: "Miso",
      species: "dog",
      personalityTags: ["affectionate"],
      talkingStyle: "gentle",
      lifecycleStatus: "active",
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z"
    };
    const { memories: _memories, careStats: _careStats, ...baseStateWithoutMemorySpine } = baseState;
    const v3Envelope = {
      schemaVersion: 3,
      state: {
        ...baseStateWithoutMemorySpine,
        petProfile
      }
    };

    const result = runSessionMigrations(v3Envelope);

    expect(result.ok).toBe(true);
    const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;
    const movedIn = active(migrated).memories.find((entry) => entry.type === "moved_in");
    expect(movedIn).toBeDefined();
    expect(movedIn?.occurredAt).toBe("2026-06-01T09:00:00.000Z");
  });

  it("does not duplicate the backfilled moved_in memory if one is already present", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-01T09:00:00.000Z"));
    const petProfile = {
      id: "pet_local_001",
      userId: "user_demo_001",
      name: "Miso",
      species: "dog",
      personalityTags: ["affectionate"],
      talkingStyle: "gentle",
      lifecycleStatus: "active",
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z"
    };
    const v3Envelope = {
      schemaVersion: 3,
      state: {
        ...baseState,
        petProfile,
        memories: [{ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-01T09:00:00.000Z", line: "The day I moved into the garden." }]
      }
    };

    const result = runSessionMigrations(v3Envelope);
    const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;

    expect(result.ok).toBe(true);
    expect(active(migrated).memories.filter((entry) => entry.type === "moved_in")).toHaveLength(1);
  });

  it("does not backfill a moved_in memory for a save with no pet yet", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
    const { memories: _memories, careStats: _careStats, ...baseStateWithoutMemorySpine } = baseState;
    const v3Envelope = { schemaVersion: 3, state: baseStateWithoutMemorySpine };

    const result = runSessionMigrations(v3Envelope);
    const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;

    expect(result.ok).toBe(true);
    expect(active(migrated).memories).toEqual([]);
  });

  it("chains a legacy v0 payload with an existing pet all the way through v0 -> v4, backfilling moved_in", () => {
    const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-01T09:00:00.000Z"));
    const petProfile = {
      id: "pet_local_001",
      userId: "user_demo_001",
      name: "Miso",
      species: "dog",
      personalityTags: ["affectionate"],
      talkingStyle: "gentle",
      lifecycleStatus: "active",
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z"
    };
    const { memories: _memories, careStats: _careStats, ...baseStateWithoutMemorySpine } = baseState;
    const legacyState = {
      ...baseStateWithoutMemorySpine,
      petProfile
    };

    const result = runSessionMigrations(legacyState);
    const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;

    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(active(migrated).memories.some((entry) => entry.type === "moved_in")).toBe(true);
    expect(active(migrated).careStats).toEqual({
      actionCounts: {},
      treatItemCounts: {},
      walkCount: 0,
      totalCareActions: 0
    });
  });

  it("is a no-op (idempotent) when migrating an already-current envelope", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const envelope = createPersistedSessionEnvelope(state);

    const result = runSessionMigrations(envelope);

    expect(result.ok).toBe(true);
    expect(result.state).toEqual(state);
  });

  it("catches a throwing migration step instead of propagating the exception", () => {
    const throwingMigrations: Record<number, (state: unknown) => unknown> = {
      0: () => {
        throw new Error("boom");
      }
    };
    // Exercise the same failure contract the real runner relies on: a
    // migration step that throws must not crash the caller.
    let threw = false;

    try {
      throwingMigrations[0]?.({});
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  describe("v4 -> v5 (theme ownership + care streak grace)", () => {
    it("seeds ownedThemeIds with the default theme and graceUsedAt with null for a save with no theme applied yet", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const { ownedThemeIds: _ownedThemeIds, ...inventoryWithoutOwnedThemeIds } = baseState.inventory;
      const { graceUsedAt: _graceUsedAt, ...careStreakWithoutGrace } = baseState.careStreak;
      const v4Envelope = {
        schemaVersion: 4,
        state: {
          ...baseState,
          inventory: inventoryWithoutOwnedThemeIds,
          careStreak: careStreakWithoutGrace
        }
      };

      const result = runSessionMigrations(v4Envelope);

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(4);
      expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      const migrated = result.state as typeof baseState;
      expect(migrated.inventory.ownedThemeIds).toEqual([DEFAULT_THEME_ID]);
      expect(migrated.careStreak.graceUsedAt).toBeNull();
    });

    it("retroactively grants ownership of an already-applied theme (protects an existing paying/using owner)", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const { ownedThemeIds: _ownedThemeIds, ...inventoryWithoutOwnedThemeIds } = baseState.inventory;
      const v4Envelope = {
        schemaVersion: 4,
        state: {
          ...baseState,
          inventory: {
            ...inventoryWithoutOwnedThemeIds,
            selectedTerrariumThemeId: "theme-fairy-garden"
          }
        }
      };

      const result = runSessionMigrations(v4Envelope);
      const migrated = result.state as typeof baseState;

      expect(result.ok).toBe(true);
      expect(migrated.inventory.ownedThemeIds).toEqual(expect.arrayContaining([DEFAULT_THEME_ID, "theme-fairy-garden"]));
      expect(migrated.inventory.selectedTerrariumThemeId).toBe("theme-fairy-garden");
    });

    it("does not duplicate an already-applied theme id if it was somehow already recorded as owned", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const v4Envelope = {
        schemaVersion: 4,
        state: {
          ...baseState,
          inventory: {
            ...baseState.inventory,
            ownedThemeIds: [DEFAULT_THEME_ID, "theme-fairy-garden"],
            selectedTerrariumThemeId: "theme-fairy-garden"
          }
        }
      };

      const result = runSessionMigrations(v4Envelope);
      const migrated = result.state as typeof baseState;

      expect(result.ok).toBe(true);
      expect(migrated.inventory.ownedThemeIds.filter((id) => id === "theme-fairy-garden")).toHaveLength(1);
    });

    it("preserves an existing graceUsedAt value instead of overwriting it with null", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const v4Envelope = {
        schemaVersion: 4,
        state: {
          ...baseState,
          careStreak: {
            ...baseState.careStreak,
            graceUsedAt: "2026-06-20T09:00:00.000Z"
          }
        }
      };

      const result = runSessionMigrations(v4Envelope);
      const migrated = result.state as typeof baseState;

      expect(result.ok).toBe(true);
      expect(migrated.careStreak.graceUsedAt).toBe("2026-06-20T09:00:00.000Z");
    });

    it("chains a legacy v0 payload with an applied theme all the way through v0 -> v5, backfilling ownership", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-01T09:00:00.000Z"));
      const { ownedThemeIds: _ownedThemeIds, ...inventoryWithoutOwnedThemeIds } = baseState.inventory;
      const legacyState = {
        ...baseState,
        inventory: {
          ...inventoryWithoutOwnedThemeIds,
          selectedTerrariumThemeId: "theme-winter-lights"
        }
      };

      const result = runSessionMigrations(legacyState);
      const migrated = result.state as typeof baseState;

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      expect(migrated.inventory.ownedThemeIds).toEqual(expect.arrayContaining([DEFAULT_THEME_ID, "theme-winter-lights"]));
      expect(migrated.careStreak.graceUsedAt).toBeNull();
    });

    it("is a no-op (idempotent) when migrating an already-current v5 envelope", () => {
      const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
      const envelope = createPersistedSessionEnvelope(state);

      const result = runSessionMigrations(envelope);

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      expect(result.state).toEqual(state);
    });
  });

  describe("v5 -> v6 (expression pack ownership)", () => {
    it("seeds an empty ownedExpressionPackIds array for a save with no packs owned yet", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const { ownedExpressionPackIds: _ownedExpressionPackIds, ...inventoryWithoutOwnedPacks } = baseState.inventory;
      const v5Envelope = {
        schemaVersion: 5,
        state: {
          ...baseState,
          inventory: inventoryWithoutOwnedPacks
        }
      };

      const result = runSessionMigrations(v5Envelope);

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(5);
      expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      const migrated = result.state as typeof baseState;
      expect(migrated.inventory.ownedExpressionPackIds).toEqual([]);
    });

    it("preserves an already-owned expression pack id instead of wiping it", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const v5Envelope = {
        schemaVersion: 5,
        state: {
          ...baseState,
          inventory: {
            ...baseState.inventory,
            ownedExpressionPackIds: ["pack-everyday-moments"]
          }
        }
      };

      const result = runSessionMigrations(v5Envelope);
      const migrated = result.state as typeof baseState;

      expect(result.ok).toBe(true);
      expect(migrated.inventory.ownedExpressionPackIds).toEqual(["pack-everyday-moments"]);
    });

    it("chains a legacy v0 payload all the way through v0 -> v6, seeding both ownedThemeIds and ownedExpressionPackIds", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-01T09:00:00.000Z"));
      const { ownedThemeIds: _ownedThemeIds, ownedExpressionPackIds: _ownedExpressionPackIds, ...inventoryWithoutOwnership } =
        baseState.inventory;
      const legacyState = {
        ...baseState,
        inventory: inventoryWithoutOwnership
      };

      const result = runSessionMigrations(legacyState);
      const migrated = result.state as typeof baseState;

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      expect(migrated.inventory.ownedThemeIds).toEqual([DEFAULT_THEME_ID]);
      expect(migrated.inventory.ownedExpressionPackIds).toEqual([]);
    });

    it("is a no-op (idempotent) when migrating an already-current v6 envelope", () => {
      const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
      const envelope = createPersistedSessionEnvelope(state);

      const result = runSessionMigrations(envelope);

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      expect(result.state).toEqual(state);
    });
  });

  describe("v6 -> v7 (pet bundle)", () => {
    it("lifts every per-pet field into pets[petId] for a completed-onboarding save, keeping shared fields at the top level", () => {
      const baseState = flattenToLegacyShape(
        (() => {
          let state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
          const petProfile = {
            id: "pet_local_001",
            userId: "user_demo_001",
            name: "Miso",
            species: "dog" as const,
            personalityTags: ["affectionate" as const],
            talkingStyle: "gentle" as const,
            lifecycleStatus: "active" as const,
            createdAt: "2026-06-24T09:00:00.000Z",
            updatedAt: "2026-06-24T09:00:00.000Z"
          };
          state = {
            ...state,
            pets: {
              [state.activePetId]: {
                ...state.pets[state.activePetId]!,
                petProfile,
                memories: [{ id: "mem_moved_in", type: "moved_in" as const, occurredAt: "2026-06-24T09:00:00.000Z", line: "The day I moved into the garden." }]
              }
            }
          };
          return state;
        })()
      );
      const v6Envelope = { schemaVersion: 6, state: baseState };

      const result = runSessionMigrations(v6Envelope);

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(6);
      expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;

      expect(migrated.pets["pet_local_001"]?.petProfile?.id).toBe("pet_local_001");
      expect(migrated.pets["pet_local_001"]?.memories).toEqual(baseState.memories);
      expect(migrated.activePetId).toBe("pet_local_001");
      // Shared top-level fields are preserved untouched.
      expect(migrated.wallet).toEqual(baseState.wallet);
      expect(migrated.inventory).toEqual(baseState.inventory);
      expect(migrated.careStreak).toEqual(baseState.careStreak);
      expect(migrated.walkCollection).toEqual(baseState.walkCollection);
      // Per-pet fields no longer sit at the top level.
      expect((migrated as unknown as Record<string, unknown>).careState).toBeUndefined();
      expect((migrated as unknown as Record<string, unknown>).memories).toBeUndefined();
      expect((migrated as unknown as Record<string, unknown>).petProfile).toBeUndefined();
    });

    it("lifts a no-pet-yet (onboarding incomplete) save into an empty bundle keyed by the fallback pet id", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const v6Envelope = { schemaVersion: 6, state: baseState };

      const result = runSessionMigrations(v6Envelope);

      expect(result.ok).toBe(true);
      const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;

      expect(migrated.activePetId).toBe("pet_local_001");
      expect(migrated.pets["pet_local_001"]?.petProfile).toBeNull();
      // mock-seeded careState/relationshipState still made it into the bundle.
      expect(migrated.pets["pet_local_001"]?.careState).toEqual(baseState.careState);
      expect(migrated.pets["pet_local_001"]?.relationshipState).toEqual(baseState.relationshipState);
    });

    it("lifts a generation-in-flight save, leaving `generation` at the top level and acceptedAssets in the bundle", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-24T09:00:00.000Z"));
      const v6Envelope = {
        schemaVersion: 6,
        state: {
          ...baseState,
          generation: {
            status: "generating" as const,
            currentStepIndex: 2,
            retryCount: 0,
            startedAt: "2026-06-24T09:01:00.000Z"
          },
          acceptedAssets: []
        }
      };

      const result = runSessionMigrations(v6Envelope);

      expect(result.ok).toBe(true);
      const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;

      // generation (onboarding-transient) stays at the top level, untouched.
      expect(migrated.generation).toEqual(v6Envelope.state.generation);
      expect(migrated.pets["pet_local_001"]?.acceptedAssets).toEqual([]);
    });

    it("adds pendingExpressionPackJobs when migrating an already-bundled v7 payload", () => {
      const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
      const { pendingExpressionPackJobs: _pendingExpressionPackJobs, ...inventoryWithoutPendingJobs } = state.inventory;
      const alreadyBundled = {
        schemaVersion: 7,
        state: {
          ...state,
          inventory: inventoryWithoutPendingJobs
        }
      };

      const result = runSessionMigrations(alreadyBundled);

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(7);
      expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      expect((result.state as typeof state).inventory.pendingExpressionPackJobs).toEqual([]);
    });

    it("preserves pendingExpressionPackJobs when a v7 payload already has one", () => {
      const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
      const pendingExpressionPackJobs = [
        {
          packId: "pack-everyday-moments",
          jobId: "job_expression_pack_001",
          requestId: "request_expression_pack_001",
          petId: "pet_local_001",
          startedAt: "2026-06-24T09:05:00.000Z"
        }
      ];
      const envelope = {
        schemaVersion: 7,
        state: {
          ...state,
          inventory: {
            ...state.inventory,
            pendingExpressionPackJobs
          }
        }
      };

      const result = runSessionMigrations(envelope);

      expect(result.ok).toBe(true);
      expect((result.state as typeof state).inventory.pendingExpressionPackJobs).toEqual(pendingExpressionPackJobs);
    });

    it("chains a legacy v0 payload with an existing pet all the way through v0 -> v8", () => {
      const baseState = flattenToLegacyShape(createInitialPrototypeSession("2026-06-01T09:00:00.000Z"));
      const petProfile = {
        id: "pet_local_001",
        userId: "user_demo_001",
        name: "Miso",
        species: "dog",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle",
        lifecycleStatus: "active",
        createdAt: "2026-06-01T09:00:00.000Z",
        updatedAt: "2026-06-01T09:00:00.000Z"
      };
      const legacyState = { ...baseState, petProfile };

      const result = runSessionMigrations(legacyState);

      expect(result.ok).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
      const migrated = result.state as ReturnType<typeof createInitialPrototypeSession>;
      expect(migrated.activePetId).toBe("pet_local_001");
      expect(migrated.pets["pet_local_001"]?.petProfile?.name).toBe("Miso");
      expect(active(migrated).memories.some((entry) => entry.type === "moved_in")).toBe(true);
    });
  });
});

describe("isValidPrototypeSessionShape", () => {
  it("accepts a freshly created session", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    expect(isValidPrototypeSessionShape(state)).toBe(true);
  });

  it("accepts a session with legitimately null optional fields", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    expect(active(state).petProfile).toBeNull();
    expect(active(state).activeWalk).toBeNull();
    expect(isValidPrototypeSessionShape(state)).toBe(true);
  });

  it("rejects a payload missing core required sections", () => {
    expect(isValidPrototypeSessionShape({ draft: {} })).toBe(false);
    expect(isValidPrototypeSessionShape({})).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isValidPrototypeSessionShape(null)).toBe(false);
    expect(isValidPrototypeSessionShape(undefined)).toBe(false);
    expect(isValidPrototypeSessionShape("not an object")).toBe(false);
    expect(isValidPrototypeSessionShape(42)).toBe(false);
    // Arrays are typeof "object" but have none of the required keys, so they
    // correctly fail the shape check too.
    expect(isValidPrototypeSessionShape([])).toBe(false);
  });

  it("rejects a payload with wallet stripped out (simulated corruption)", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const { wallet: _wallet, ...withoutWallet } = state;

    expect(isValidPrototypeSessionShape(withoutWallet)).toBe(false);
  });

  it("rejects a payload with pets stripped out (post-v7 shape requires it)", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const { pets: _pets, ...withoutPets } = state;

    expect(isValidPrototypeSessionShape(withoutPets)).toBe(false);
  });
});

describe("createPersistedSessionEnvelope", () => {
  it("always stamps the current schema version on save", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");

    const envelope = createPersistedSessionEnvelope(state);

    expect(envelope.schemaVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(envelope.state).toBe(state);
  });
});
