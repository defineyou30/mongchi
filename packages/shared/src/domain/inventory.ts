import type { AuditTimestamps, ISODateTime, ItemId, UserId } from "./common";
import type { PlantGrowthEntry } from "./plants";
import { getPlantPlacementPresetForItemId } from "./plants";

/**
 * Live catalog categories still reachable from the mobile app: consumables
 * (food/treat), equip-ish comfort items (toy/bed), and backgrounds (theme).
 * The placement-only decor categories (house/plant/light/water/path/reward/
 * premiumDecor/seasonalDecor/lantern/terrain/terrarium_shell) were retired
 * from the mobile app in the "배치형 소품 시스템 철거" wave — the home garden
 * background is a finished illustration and no longer supports placed decor.
 * They stay in this union (rather than being deleted) only because
 * `services/api`'s persisted catalog/placement layer still models them; the
 * mobile app must not reintroduce UI for them.
 */
export type ItemCategory =
  | "food"
  | "toy"
  | "bed"
  | "house"
  | "plant"
  | "light"
  | "water"
  | "path"
  | "reward"
  | "premiumDecor"
  | "seasonalDecor"
  | "lantern"
  | "treat"
  | "terrain"
  | "terrarium_shell"
  | "theme";

export type ItemRarity = "starter" | "common" | "rare" | "seasonal" | "premium";

export type InventorySource = "starter" | "walk_reward" | "purchase" | "event" | "admin_grant" | "streak_reward";

export type PlacementSlot = "ground" | "water" | "wall" | "sky" | "pet_corner" | "garden";

export interface Item extends AuditTimestamps {
  id: ItemId;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  visualKey: string;
  isPremium: boolean;
  behaviorTags: string[];
  placementSlots: PlacementSlot[];
}

export interface InventoryEntry {
  itemId: ItemId;
  quantity: number;
  acquiredAt: ISODateTime;
  source: InventorySource;
}

/**
 * Dormant on the mobile app: no live code path places or removes items
 * anymore (see sessionMigrations v2 -> v3, which strips this from every
 * persisted save). Kept as a concrete type only because `services/api`
 * still persists a `placed_items` table and models this shape — see
 * `packages/shared/src/domain/plants.ts`'s file header for the full
 * rationale. Do not build mobile UI against this again.
 */
export interface PlacedItem {
  itemId: ItemId;
  slot: PlacementSlot;
  x: number;
  y: number;
  rotation: number;
}

export interface Inventory {
  userId: UserId;
  items: InventoryEntry[];
  selectedTerrariumThemeId?: ItemId;
  /**
   * Theme ids the player has purchased (or been granted, e.g. the always-free
   * default theme) -- see themeBundles.ts. Re-selecting an owned theme via
   * applyPrototypeTheme never re-charges credits; only an id absent from this
   * list requires purchasePrototypeThemeBundle to spend credits first.
   */
  ownedThemeIds: ItemId[];
  /**
   * Expression pack ids the player has purchased (see expressionPacks.ts) --
   * purchasePrototypeExpressionPack only confirms a pack's charge once its
   * generation job has actually started successfully, and this list is what
   * the friend page's pose gallery reads to know which pack cards to render
   * as "owned" vs. still for sale. Optional (rather than required, like
   * ownedThemeIds) so services/api's own Inventory row-mapping code -- which
   * doesn't model expression packs yet -- doesn't need updating just to keep
   * compiling; every mobile-side read defaults it to `[]` (see
   * purchasePrototypeExpressionPack and the friend page's pose gallery).
   */
  ownedExpressionPackIds?: string[];
  placedItems: PlacedItem[];
  plantGrowth?: PlantGrowthEntry[];
  updatedAt: ISODateTime;
}

export type HomePlacementLane =
  | "food"
  | "treat"
  | "toy"
  | "bed"
  | "house"
  | "plant"
  | "frontPlant"
  | "sidePlant"
  | "seasonalPlant"
  | "light"
  | "water"
  | "path"
  | "reward"
  | "premium"
  | "theme";

export type ConsumeInventoryItemResult =
  | {
      ok: true;
      inventory: Inventory;
      consumedQuantity: number;
    }
  | {
      ok: false;
      reason: "item_not_found";
    };

export type PlaceInventoryItemResult =
  | {
      ok: true;
      inventory: Inventory;
      placedItem: PlacedItem;
      replacedItemIds: ItemId[];
    }
  | {
      ok: false;
      reason: "item_not_found" | "item_not_owned";
    };

const defaultPlacementByLane: Record<HomePlacementLane, { x: number; y: number; rotation: number }> = {
  bed: { x: 0.28, y: 0.69, rotation: 0 },
  food: { x: 0.32, y: 0.79, rotation: -2 },
  house: { x: 0.2, y: 0.62, rotation: -3 },
  light: { x: 0.86, y: 0.36, rotation: 0 },
  path: { x: 0.5, y: 0.91, rotation: -2 },
  plant: { x: 0.82, y: 0.72, rotation: 5 },
  frontPlant: { x: 0.18, y: 0.78, rotation: -5 },
  sidePlant: { x: 0.82, y: 0.72, rotation: 5 },
  seasonalPlant: { x: 0.62, y: 0.58, rotation: 0 },
  premium: { x: 0.62, y: 0.58, rotation: 0 },
  reward: { x: 0.82, y: 0.84, rotation: 5 },
  theme: { x: 0.5, y: 0.5, rotation: 0 },
  toy: { x: 0.7, y: 0.82, rotation: 7 },
  treat: { x: 0.82, y: 0.84, rotation: 5 },
  water: { x: 0.28, y: 0.9, rotation: -3 }
};

export const getPrimaryPlacementSlot = (item: Item): PlacementSlot => item.placementSlots[0] ?? "ground";

export const getHomePlacementLane = (item: Item): HomePlacementLane => {
  const plantPlacementPreset = getPlantPlacementPresetForItemId(item.id);

  if (plantPlacementPreset) {
    return plantPlacementPreset.placementLane;
  }

  if (item.behaviorTags.includes("treat") || item.category === "treat") {
    return "treat";
  }

  switch (item.category) {
    case "bed":
      return "bed";
    case "food":
      return "food";
    case "house":
      return "house";
    case "lantern":
    case "light":
      return "light";
    case "path":
    case "terrain":
      return "path";
    case "plant":
    case "seasonalDecor":
      return "plant";
    case "premiumDecor":
      return "premium";
    case "reward":
      return "reward";
    case "terrarium_shell":
    case "theme":
      return "theme";
    case "toy":
      return "toy";
    case "water":
      return "water";
  }
};

export const isTreatInventoryItem = (item: Item): boolean => item.category === "treat" || item.behaviorTags.includes("treat");

/**
 * Only scans `inventory.items` — placed decor is retired on the mobile app,
 * so `inventory.placedItems` is always empty there and never consulted here.
 */
export const getAvailableTreatItemId = (inventory: Inventory, catalog: readonly Item[]): ItemId | null => {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  for (const entry of inventory.items) {
    const item = catalogById.get(entry.itemId);

    if (entry.quantity > 0 && item && isTreatInventoryItem(item)) {
      return item.id;
    }
  }

  return null;
};

export const createFixedPlacedItem = (item: Item): PlacedItem => {
  const slot = getPrimaryPlacementSlot(item);
  const base = defaultPlacementByLane[getHomePlacementLane(item)];

  return {
    itemId: item.id,
    slot,
    x: base.x,
    y: base.y,
    rotation: base.rotation
  };
};

/**
 * Dormant on the mobile app (see this file's `PlacedItem` doc comment) —
 * `services/api` is the only remaining caller.
 */
export const placeInventoryItemInFixedSlot = (
  inventory: Inventory,
  catalog: readonly Item[],
  itemId: ItemId,
  placedAt: ISODateTime
): PlaceInventoryItemResult => {
  const catalogItem = catalog.find((item) => item.id === itemId);

  if (!catalogItem) {
    return {
      ok: false,
      reason: "item_not_found"
    };
  }

  const ownedEntry = inventory.items.find((item) => item.itemId === itemId && item.quantity > 0);

  if (!ownedEntry) {
    return {
      ok: false,
      reason: "item_not_owned"
    };
  }

  const placedItem = createFixedPlacedItem(catalogItem);
  const existingSameItem = inventory.placedItems.find((item) => item.itemId === itemId);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const lane = getHomePlacementLane(catalogItem);
  const isSameLane = (placed: PlacedItem) => {
    const existingCatalogItem = catalogById.get(placed.itemId);

    return existingCatalogItem ? getHomePlacementLane(existingCatalogItem) === lane : false;
  };

  if (existingSameItem) {
    return {
      ok: true,
      inventory: {
        ...inventory,
        placedItems: inventory.placedItems.map((item) => (item.itemId === itemId ? placedItem : item)),
        updatedAt: placedAt
      },
      placedItem,
      replacedItemIds: []
    };
  }

  const replacedItems = inventory.placedItems.filter(isSameLane);

  return {
    ok: true,
    inventory: {
      ...inventory,
      placedItems: [...inventory.placedItems.filter((item) => !isSameLane(item)), placedItem],
      updatedAt: placedAt
    },
    placedItem,
    replacedItemIds: replacedItems.map((item) => item.itemId)
  };
};

export const consumeInventoryItem = (
  inventory: Inventory,
  itemId: ItemId,
  consumedAt: ISODateTime,
  quantity: number = 1
): ConsumeInventoryItemResult => {
  const targetQuantity = Math.max(1, Math.floor(quantity));
  const entry = inventory.items.find((item) => item.itemId === itemId && item.quantity > 0);

  if (!entry || entry.quantity < targetQuantity) {
    return {
      ok: false,
      reason: "item_not_found"
    };
  }

  const nextItems = inventory.items
    .map((item) =>
      item.itemId === itemId
        ? {
            ...item,
            quantity: item.quantity - targetQuantity
          }
        : item
    )
    .filter((item) => item.quantity > 0);
  const stillOwned = nextItems.some((item) => item.itemId === itemId);

  return {
    ok: true,
    consumedQuantity: targetQuantity,
    inventory: {
      ...inventory,
      items: nextItems,
      placedItems: stillOwned ? inventory.placedItems : inventory.placedItems.filter((item) => item.itemId !== itemId),
      plantGrowth: inventory.plantGrowth?.map((entry) => ({ ...entry })) ?? [],
      updatedAt: consumedAt
    }
  };
};
