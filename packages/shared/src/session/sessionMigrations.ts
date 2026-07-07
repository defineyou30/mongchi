import { DEFAULT_THEME_ID } from "../domain/themeBundles";
import type { PrototypeSessionState } from "./prototypeSession";

/**
 * Persistence envelope written to AsyncStorage. We keep `schemaVersion`
 * outside of `PrototypeSessionState` itself so the many call sites that
 * build/patch session state in-memory (factories, reducers, tests) never
 * need to know or carry a version number — only the persistence boundary
 * (provider save/restore) deals with the envelope.
 */
export interface PersistedSessionEnvelope {
  schemaVersion: number;
  state: PrototypeSessionState;
}

/**
 * Bump whenever a shape change to `PrototypeSessionState` requires a
 * migration step to keep existing local saves loadable. Register the
 * matching vN -> vN+1 function in `sessionMigrations` below.
 */
export const CURRENT_SESSION_SCHEMA_VERSION = 6;

/**
 * Plant/pot catalog items removed from the garden concept. Any owned,
 * placed, or growth-tracked copies left over in a v1 save are stripped by
 * the v1 -> v2 migration below. `plants.ts` (the growth domain logic) stays
 * in the codebase dormant — only the concrete catalog items are retired.
 */
const RETIRED_PLANT_ITEM_IDS = new Set(["item_flower_pot_sunny", "item_leafy_plant_clover", "item_seasonal_flowers_spring"]);

/**
 * Retired placed-decor catalog item ids (the decor categories they used to
 * belong to: house, plant, light, path, reward, premiumDecor, seasonalDecor,
 * lantern, terrain, terrarium_shell, water/watering-can). The v2 -> v3
 * migration below strips any owned copies of these from `inventory.items` —
 * the home garden background is now a finished illustration and no longer
 * supports placed decor at all. A persisted inventory entry only carries an
 * itemId (no category), so this is an explicit id denylist rather than a
 * category filter. Consumable/equip categories (food, treat, toy, bed,
 * theme) are untouched and stay owned. `item_flower_pot_sunny`,
 * `item_leafy_plant_clover`, and `item_seasonal_flowers_spring` are already
 * covered by RETIRED_PLANT_ITEM_IDS above and are not repeated here.
 */
const RETIRED_PLACEMENT_DECOR_ITEM_IDS = new Set([
  "item_doghouse_sunny",
  "item_lantern_glow",
  "item_watering_can_mint",
  "item_gift_ribbon",
  "item_small_lamp_glow",
  "item_pond_tile_lily",
  "item_stepping_stone_path",
  "item_reward_pouch_sunny",
  "item_coin_sun",
  "item_gem_pink",
  "item_crystal_charm_premium"
]);

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object";

/**
 * Merges duplicate `inventory.items` rows that share an itemId into one
 * entry (quantities summed, earliest `acquiredAt` kept, `starter` source
 * preferred over granted sources) and drops any retired plant/pot items —
 * from `items`, `placedItems`, and `plantGrowth` alike.
 */
const migrateInventoryToV2 = (inventoryValue: unknown): unknown => {
  if (!isRecord(inventoryValue)) {
    return inventoryValue;
  }

  const items = Array.isArray(inventoryValue.items) ? inventoryValue.items : [];
  const mergedByItemId = new Map<string, Record<string, unknown>>();

  for (const rawEntry of items) {
    if (!isRecord(rawEntry) || typeof rawEntry.itemId !== "string") {
      continue;
    }

    if (RETIRED_PLANT_ITEM_IDS.has(rawEntry.itemId)) {
      continue;
    }

    const quantity = typeof rawEntry.quantity === "number" ? rawEntry.quantity : 0;
    const existing = mergedByItemId.get(rawEntry.itemId);

    if (!existing) {
      mergedByItemId.set(rawEntry.itemId, { ...rawEntry, quantity });
      continue;
    }

    const existingQuantity = typeof existing.quantity === "number" ? existing.quantity : 0;
    const existingIsStarter = existing.source === "starter";
    const entryIsStarter = rawEntry.source === "starter";
    const existingAcquiredAt = typeof existing.acquiredAt === "string" ? existing.acquiredAt : "";
    const entryAcquiredAt = typeof rawEntry.acquiredAt === "string" ? rawEntry.acquiredAt : "";
    // Prefer the starter-sourced row's identity (source/acquiredAt) when one
    // of the duplicates was a starter grant; otherwise keep whichever row
    // was acquired first.
    const keepEntryIdentity = existingIsStarter
      ? false
      : entryIsStarter || (entryAcquiredAt !== "" && (existingAcquiredAt === "" || entryAcquiredAt < existingAcquiredAt));

    mergedByItemId.set(rawEntry.itemId, {
      ...(keepEntryIdentity ? rawEntry : existing),
      quantity: existingQuantity + quantity
    });
  }

  const placedItems = Array.isArray(inventoryValue.placedItems)
    ? inventoryValue.placedItems.filter(
        (placedItem) => !isRecord(placedItem) || typeof placedItem.itemId !== "string" || !RETIRED_PLANT_ITEM_IDS.has(placedItem.itemId)
      )
    : inventoryValue.placedItems;

  const plantGrowth = Array.isArray(inventoryValue.plantGrowth)
    ? inventoryValue.plantGrowth.filter(
        (entry) => !isRecord(entry) || typeof entry.itemId !== "string" || !RETIRED_PLANT_ITEM_IDS.has(entry.itemId)
      )
    : inventoryValue.plantGrowth;

  return {
    ...inventoryValue,
    items: [...mergedByItemId.values()],
    placedItems,
    plantGrowth
  };
};

/**
 * Removes all placed-decor and plant-growth state: `inventory.placedItems`
 * and `inventory.plantGrowth` are dropped entirely (the home garden
 * background no longer supports placed decor — only the starter
 * bowl/toy-ball fixed scene dressing remains, which is not
 * inventory-driven) and any owned copies of retired placement-only decor
 * categories are stripped from `inventory.items`. Consumable/equip items
 * (food, treat, toy, bed, theme) are left untouched.
 */
const migrateInventoryToV3 = (inventoryValue: unknown): unknown => {
  if (!isRecord(inventoryValue)) {
    return inventoryValue;
  }

  const items = Array.isArray(inventoryValue.items) ? inventoryValue.items : [];
  const nextItems = items.filter(
    (rawEntry) => !isRecord(rawEntry) || typeof rawEntry.itemId !== "string" || !RETIRED_PLACEMENT_DECOR_ITEM_IDS.has(rawEntry.itemId)
  );

  const { placedItems: _placedItems, plantGrowth: _plantGrowth, ...rest } = inventoryValue;

  return {
    ...rest,
    items: nextItems
  };
};

/**
 * Sequential migrations keyed by the version they migrate FROM.
 * `sessionMigrations[0]` takes v0 (legacy, unversioned) data to v1, and so on.
 * Each function receives the raw (unknown-shaped) persisted payload and
 * returns the next version's raw payload — validation happens separately,
 * after all migrations have run.
 */
export const sessionMigrations: Record<number, (state: unknown) => unknown> = {
  // v0 (no schemaVersion field, i.e. every save written before this
  // migration framework existed) -> v1: the shape is unchanged, we are only
  // formally introducing the version number. Existing user progress is
  // preserved as-is.
  0: (state: unknown) => state,
  // v1 -> v2: collapses duplicate inventory.items rows for the same itemId
  // (see the mongchi inventory-duplication fix) and retires plant/pot
  // catalog items from any existing save's owned/placed/growth state.
  1: (state: unknown) => {
    if (!isRecord(state)) {
      return state;
    }

    return {
      ...state,
      inventory: migrateInventoryToV2(state.inventory)
    };
  },
  // v2 -> v3: removes the placed-decor system entirely (see mongchi
  // "배치형 소품 시스템 철거 + 상점 재편" wave) — drops `inventory.placedItems`
  // and strips owned copies of retired placement-only decor items.
  2: (state: unknown) => {
    if (!isRecord(state)) {
      return state;
    }

    return {
      ...state,
      inventory: migrateInventoryToV3(state.inventory)
    };
  },
  // v3 -> v4: introduces the memory/event-spine domain (see mongchi "기억/
  // 사건 스파인" wave) — adds `memories: MemoryEntry[]` and `careStats:
  // CareStats`. A save that already has an activePet gets a "moved_in"
  // memory backfilled (dated to the pet's createdAt) so existing owners'
  // albums aren't empty going forward; a save with no pet yet gets an empty
  // memories array, same as a brand new session.
  3: (state: unknown) => {
    if (!isRecord(state)) {
      return state;
    }

    const existingMemories = Array.isArray(state.memories) ? state.memories : [];
    const petProfile = isRecord(state.petProfile) ? state.petProfile : null;
    const petCreatedAt = typeof petProfile?.createdAt === "string" ? petProfile.createdAt : null;
    const alreadyHasMovedIn = existingMemories.some(
      (entry) => isRecord(entry) && entry.type === "moved_in"
    );

    const memories =
      petCreatedAt && !alreadyHasMovedIn
        ? [
            ...existingMemories,
            {
              id: "mem_moved_in",
              type: "moved_in",
              occurredAt: petCreatedAt,
              line: "The day I moved into the garden."
            }
          ]
        : existingMemories;

    return {
      ...state,
      memories,
      careStats: isRecord(state.careStats)
        ? state.careStats
        : {
            actionCounts: {},
            treatItemCounts: {},
            walkCount: 0,
            totalCareActions: 0
          }
    };
  },
  // v4 -> v5: fixes the "테마 BM 결함" (theme purchase double-charge) and adds
  // the care-streak one-day grace (see mongchi retention-gap-analysis.md gaps
  // 3 and 5). Two independent additions bundled into one version bump:
  //
  //  1. `inventory.ownedThemeIds: ItemId[]` -- every save gets the always-free
  //     default theme seeded in. Critically, a save that already has a
  //     `selectedTerrariumThemeId` applied (i.e. an existing owner who
  //     bought/applied a theme under the old no-ownership-tracking behavior)
  //     gets *that* theme id backfilled into ownedThemeIds too -- this is the
  //     retroactive protection so an existing paying/using owner is never
  //     asked to re-pay for a theme they already applied.
  //  2. `careStreak.graceUsedAt: ISODateTime | null` -- defaults to null
  //     (grace never used yet), which is exactly "grace available" for every
  //     existing streak.
  4: (state: unknown) => {
    if (!isRecord(state)) {
      return state;
    }

    const inventory = isRecord(state.inventory) ? state.inventory : {};
    const existingOwnedThemeIds = Array.isArray(inventory.ownedThemeIds) ? inventory.ownedThemeIds : [];
    const selectedThemeId = typeof inventory.selectedTerrariumThemeId === "string" ? inventory.selectedTerrariumThemeId : null;
    const ownedThemeIdsWithDefault = existingOwnedThemeIds.includes(DEFAULT_THEME_ID)
      ? existingOwnedThemeIds
      : [...existingOwnedThemeIds, DEFAULT_THEME_ID];
    // Retroactive protection: an existing save with an already-applied theme
    // (bought under the old no-ownership-tracking flow) gets that theme id
    // backfilled as owned, so it never gets re-charged on the next re-apply.
    const ownedThemeIds =
      selectedThemeId && !ownedThemeIdsWithDefault.includes(selectedThemeId)
        ? [...ownedThemeIdsWithDefault, selectedThemeId]
        : ownedThemeIdsWithDefault;

    const careStreak = isRecord(state.careStreak) ? state.careStreak : {};

    return {
      ...state,
      inventory: {
        ...inventory,
        ownedThemeIds
      },
      careStreak: {
        ...careStreak,
        graceUsedAt: "graceUsedAt" in careStreak ? careStreak.graceUsedAt : null
      }
    };
  },
  // v5 -> v6: adds `inventory.ownedExpressionPackIds: string[]` for the
  // expression pack purchase/gallery wave (see expressionPacks.ts) -- every
  // save gets an empty array seeded in, since no existing save could have
  // owned a pack before this field existed.
  5: (state: unknown) => {
    if (!isRecord(state)) {
      return state;
    }

    const inventory = isRecord(state.inventory) ? state.inventory : {};
    const existingOwnedExpressionPackIds = Array.isArray(inventory.ownedExpressionPackIds)
      ? inventory.ownedExpressionPackIds
      : [];

    return {
      ...state,
      inventory: {
        ...inventory,
        ownedExpressionPackIds: existingOwnedExpressionPackIds
      }
    };
  }
};

export interface SessionMigrationResult {
  ok: boolean;
  state: unknown;
  fromVersion: number;
  toVersion: number;
}

/**
 * Reads the schemaVersion out of a raw persisted envelope/legacy payload.
 * Anything without a numeric `schemaVersion` field is treated as v0 (the
 * shape written before this framework existed).
 */
export const readSchemaVersion = (value: unknown): number => {
  if (
    value !== null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    typeof (value as { schemaVersion: unknown }).schemaVersion === "number"
  ) {
    return (value as { schemaVersion: number }).schemaVersion;
  }

  return 0;
};

/**
 * Unwraps a raw persisted payload into the bare state shape migrations
 * operate on. v0 payloads (legacy) ARE the state object directly; v1+
 * payloads are wrapped as `{ schemaVersion, state }`.
 */
const unwrapRawState = (value: unknown, version: number): unknown => {
  if (version === 0) {
    return value;
  }

  if (value !== null && typeof value === "object" && "state" in value) {
    return (value as { state: unknown }).state;
  }

  return value;
};

/**
 * Applies every registered migration in order, starting from the version
 * found on the stored payload up to `CURRENT_SESSION_SCHEMA_VERSION`.
 *
 * Policy for a stored version NEWER than `CURRENT_SESSION_SCHEMA_VERSION`
 * (e.g. the user upgraded, schema moved forward, then downgraded/reinstalled
 * an older build): we treat this as unmigratable rather than guessing. A
 * forward schema change may have altered or removed field meaning, so an
 * older build reading it "as-is" risks silent corruption (e.g. a
 * misinterpreted wallet balance) rather than a loud, recoverable failure.
 * We fail the migration (ok: false) so the caller backs up the raw payload
 * and starts a fresh session instead of deleting it outright — no data is
 * lost, but it is not blindly trusted either.
 */
export const runSessionMigrations = (rawValue: unknown): SessionMigrationResult => {
  const fromVersion = readSchemaVersion(rawValue);
  let working = unwrapRawState(rawValue, fromVersion);

  if (fromVersion > CURRENT_SESSION_SCHEMA_VERSION) {
    return {
      ok: false,
      state: working,
      fromVersion,
      toVersion: fromVersion
    };
  }

  for (let version = fromVersion; version < CURRENT_SESSION_SCHEMA_VERSION; version += 1) {
    const migrate = sessionMigrations[version];

    if (!migrate) {
      return {
        ok: false,
        state: working,
        fromVersion,
        toVersion: version
      };
    }

    try {
      working = migrate(working);
    } catch {
      return {
        ok: false,
        state: working,
        fromVersion,
        toVersion: version
      };
    }
  }

  return {
    ok: true,
    state: working,
    fromVersion,
    toVersion: CURRENT_SESSION_SCHEMA_VERSION
  };
};

/**
 * Wraps a current-shape session state into the versioned envelope that
 * should be written to AsyncStorage.
 */
export const createPersistedSessionEnvelope = (state: PrototypeSessionState): PersistedSessionEnvelope => ({
  schemaVersion: CURRENT_SESSION_SCHEMA_VERSION,
  state
});

const REQUIRED_TOP_LEVEL_KEYS = ["draft", "photo", "generation", "careState", "relationshipState", "wallet", "inventory"] as const;

/**
 * Shallow structural check that a migrated payload still looks like a
 * `PrototypeSessionState` before we trust it. Intentionally shallow — the
 * provider's existing restoreSession fallback-merge already tolerates
 * missing/partial nested fields, so this only guards against payloads that
 * are missing entire required sections (e.g. truncated JSON, wrong shape
 * entirely).
 */
export const isValidPrototypeSessionShape = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return REQUIRED_TOP_LEVEL_KEYS.every((key) => {
    const field = candidate[key];

    return field !== null && field !== undefined && typeof field === "object";
  });
};
