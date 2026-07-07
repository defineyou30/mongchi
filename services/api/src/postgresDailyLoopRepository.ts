import type {
  CareState,
  CreditWallet,
  Inventory,
  InventoryEntry,
  InventorySource,
  Item,
  ItemCategory,
  ItemId,
  ItemRarity,
  ISODateTime,
  Locale,
  PetId,
  PlacedItem,
  PlacementSlot,
  ReactionRule,
  RelationshipState,
  UserId,
  WalkSession,
  WalkSessionId,
  WalkStatus
} from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { RecentReactionRecord } from "./service";

interface CareStateRow {
  pet_id: string;
  satiety: number;
  energy: number;
  happiness: number;
  affection: number;
  garden_health: number;
  cleanliness: number;
  last_fed_at: Date | string | null;
  last_interaction_at: Date | string | null;
  last_garden_watered_at: Date | string | null;
  active_walk_id: string | null;
  updated_at: Date | string;
}

interface ItemRow {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  visual_key: string;
  is_premium: boolean;
  behavior_tags: unknown;
  placement_slots: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ReactionCatalogVersionRow {
  locale: Locale;
  version: string;
  rules: unknown;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface InventoryRow {
  user_id: string;
  selected_terrarium_theme_id: string | null;
  plant_growth: unknown;
  updated_at: Date | string;
}

interface RelationshipStateRow {
  pet_id: string;
  bond_xp: number;
  bond_level: number;
  total_care_actions: number;
  total_talk_count: number;
  days_together: number;
  last_bonded_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CreditWalletRow {
  user_id: string;
  credits: number;
  bonus_credits: number;
  free_chat_tickets: number;
  updated_at: Date | string;
}

interface InventoryItemRow {
  user_id: string;
  item_id: string;
  quantity: number;
  acquired_at: Date | string;
  source: InventorySource;
}

interface PlacedItemRow {
  user_id: string;
  item_id: string;
  slot: PlacementSlot;
  x: number | string;
  y: number | string;
  rotation: number | string;
}

interface WalkSessionRow {
  id: string;
  user_id: string;
  pet_id: string;
  status: WalkStatus;
  started_at: Date | string;
  return_at: Date | string;
  claimed_at: Date | string | null;
  reward_item_ids: unknown;
  discovery_line: string | null;
  energy_cost: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RecentReactionRow {
  user_id: string;
  pet_id: string;
  rule_id: string;
  line: string;
  shown_at: Date | string;
}

const toIso = (value: Date | string): ISODateTime => (value instanceof Date ? value.toISOString() : value);
const nullableIso = (value: Date | string | null): ISODateTime | undefined => (value ? toIso(value) : undefined);

const parseJsonArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
  }

  return [];
};

const numberFromNumeric = (value: number | string): number => (typeof value === "number" ? value : Number.parseFloat(value));

const copyInventory = (inventory: Inventory): Inventory => ({
  userId: inventory.userId,
  items: inventory.items.map((item) => ({ ...item })),
  ...(inventory.selectedTerrariumThemeId ? { selectedTerrariumThemeId: inventory.selectedTerrariumThemeId } : {}),
  ownedThemeIds: [...(inventory.ownedThemeIds ?? [])],
  placedItems: inventory.placedItems.map((item) => ({ ...item })),
  plantGrowth: inventory.plantGrowth?.map((entry) => ({ ...entry })) ?? [],
  updatedAt: inventory.updatedAt
});

const mapCareStateRow = (row: CareStateRow): CareState => {
  const lastFedAt = nullableIso(row.last_fed_at);
  const lastInteractionAt = nullableIso(row.last_interaction_at);
  const lastGardenWateredAt = nullableIso(row.last_garden_watered_at);

  return {
    petId: row.pet_id,
    satiety: row.satiety,
    energy: row.energy,
    happiness: row.happiness,
    affection: row.affection,
    gardenHealth: row.garden_health,
    cleanliness: row.cleanliness,
    ...(lastFedAt ? { lastFedAt } : {}),
    ...(lastInteractionAt ? { lastInteractionAt } : {}),
    ...(lastGardenWateredAt ? { lastGardenWateredAt } : {}),
    ...(row.active_walk_id ? { activeWalkId: row.active_walk_id as WalkSessionId } : {}),
    updatedAt: toIso(row.updated_at)
  };
};

const mapItemRow = (row: ItemRow): Item => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  rarity: row.rarity,
  visualKey: row.visual_key,
  isPremium: row.is_premium,
  behaviorTags: parseJsonArray<string>(row.behavior_tags),
  placementSlots: parseJsonArray<PlacementSlot>(row.placement_slots),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

export interface ReactionCatalogVersionRecord {
  locale: Locale;
  version: string;
  rules: ReactionRule[];
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

const mapReactionCatalogVersionRow = (row: ReactionCatalogVersionRow): ReactionCatalogVersionRecord => ({
  locale: row.locale,
  version: row.version,
  rules: parseJsonArray<ReactionRule>(row.rules),
  isActive: row.is_active,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const mapInventoryEntryRow = (row: InventoryItemRow): InventoryEntry => ({
  itemId: row.item_id,
  quantity: row.quantity,
  acquiredAt: toIso(row.acquired_at),
  source: row.source
});

const mapPlacedItemRow = (row: PlacedItemRow): PlacedItem => ({
  itemId: row.item_id,
  slot: row.slot,
  x: numberFromNumeric(row.x),
  y: numberFromNumeric(row.y),
  rotation: numberFromNumeric(row.rotation)
});

const mapInventoryRows = (
  inventoryRow: InventoryRow,
  itemRows: readonly InventoryItemRow[],
  placedRows: readonly PlacedItemRow[]
): Inventory => ({
  userId: inventoryRow.user_id,
  items: itemRows.map(mapInventoryEntryRow),
  ...(inventoryRow.selected_terrarium_theme_id
    ? { selectedTerrariumThemeId: inventoryRow.selected_terrarium_theme_id as ItemId }
    : {}),
  ownedThemeIds: [],
  placedItems: placedRows.map(mapPlacedItemRow),
  plantGrowth: parseJsonArray<NonNullable<Inventory["plantGrowth"]>[number]>(inventoryRow.plant_growth),
  updatedAt: toIso(inventoryRow.updated_at)
});

const mapRelationshipStateRow = (row: RelationshipStateRow): RelationshipState => {
  const lastBondedAt = nullableIso(row.last_bonded_at);

  return {
    petId: row.pet_id,
    bondXp: row.bond_xp,
    bondLevel: row.bond_level,
    totalCareActions: row.total_care_actions,
    totalTalkCount: row.total_talk_count,
    daysTogether: row.days_together,
    ...(lastBondedAt ? { lastBondedAt } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

const mapCreditWalletRow = (row: CreditWalletRow): CreditWallet => ({
  userId: row.user_id,
  credits: row.credits,
  bonusCredits: row.bonus_credits,
  freeChatTickets: row.free_chat_tickets,
  updatedAt: toIso(row.updated_at)
});

const mapWalkSessionRow = (row: WalkSessionRow): WalkSession => {
  const claimedAt = nullableIso(row.claimed_at);

  return {
    id: row.id as WalkSessionId,
    userId: row.user_id,
    petId: row.pet_id,
    status: row.status,
    startedAt: toIso(row.started_at),
    returnAt: toIso(row.return_at),
    ...(claimedAt ? { claimedAt } : {}),
    rewardItemIds: parseJsonArray<ItemId>(row.reward_item_ids),
    ...(row.discovery_line ? { discoveryLine: row.discovery_line } : {}),
    energyCost: row.energy_cost,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

const mapRecentReactionRow = (row: RecentReactionRow): RecentReactionRecord => ({
  userId: row.user_id,
  petId: row.pet_id,
  ruleId: row.rule_id,
  line: row.line,
  shownAt: toIso(row.shown_at)
});

const careStateSelectColumns = `
  pet_id,
  satiety,
  energy,
  happiness,
  affection,
  garden_health,
  cleanliness,
  last_fed_at,
  last_interaction_at,
  last_garden_watered_at,
  active_walk_id,
  updated_at
`;

const itemSelectColumns = `
  id,
  name,
  description,
  category,
  rarity,
  visual_key,
  is_premium,
  behavior_tags,
  placement_slots,
  created_at,
  updated_at
`;

const reactionCatalogVersionSelectColumns = `
  locale,
  version,
  rules,
  is_active,
  created_at,
  updated_at
`;

const inventorySelectColumns = `
  user_id,
  selected_terrarium_theme_id,
  plant_growth,
  updated_at
`;

const relationshipStateSelectColumns = `
  pet_id,
  bond_xp,
  bond_level,
  total_care_actions,
  total_talk_count,
  days_together,
  last_bonded_at,
  created_at,
  updated_at
`;

const creditWalletSelectColumns = `
  user_id,
  credits,
  bonus_credits,
  free_chat_tickets,
  updated_at
`;

const inventoryItemSelectColumns = `
  user_id,
  item_id,
  quantity,
  acquired_at,
  source
`;

const placedItemSelectColumns = `
  user_id,
  item_id,
  slot,
  x,
  y,
  rotation
`;

const walkSessionSelectColumns = `
  id,
  user_id,
  pet_id,
  status,
  started_at,
  return_at,
  claimed_at,
  reward_item_ids,
  discovery_line,
  energy_cost,
  created_at,
  updated_at
`;

const recentReactionSelectColumns = `
  user_id,
  pet_id,
  rule_id,
  line,
  shown_at
`;

export const createPostgresDailyLoopRepository = (client: ApiDatabaseMigrationClient) => ({
  upsertCareState: async (careState: CareState): Promise<CareState> => {
    const result = await client.query<CareStateRow>(
      `
INSERT INTO public.care_states (
  pet_id,
  satiety,
  energy,
  happiness,
  affection,
  garden_health,
  cleanliness,
  last_fed_at,
  last_interaction_at,
  last_garden_watered_at,
  active_walk_id,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (pet_id) DO UPDATE
SET satiety = EXCLUDED.satiety,
    energy = EXCLUDED.energy,
    happiness = EXCLUDED.happiness,
    affection = EXCLUDED.affection,
    garden_health = EXCLUDED.garden_health,
    cleanliness = EXCLUDED.cleanliness,
    last_fed_at = EXCLUDED.last_fed_at,
    last_interaction_at = EXCLUDED.last_interaction_at,
    last_garden_watered_at = EXCLUDED.last_garden_watered_at,
    active_walk_id = EXCLUDED.active_walk_id,
    updated_at = EXCLUDED.updated_at
RETURNING ${careStateSelectColumns}
`,
      [
        careState.petId,
        careState.satiety,
        careState.energy,
        careState.happiness,
        careState.affection,
        careState.gardenHealth,
        careState.cleanliness,
        careState.lastFedAt ?? null,
        careState.lastInteractionAt ?? null,
        careState.lastGardenWateredAt ?? null,
        careState.activeWalkId ?? null,
        careState.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert care state.");
    }

    return mapCareStateRow(row);
  },

  findCareState: async (petId: PetId): Promise<CareState | null> => {
    const result = await client.query<CareStateRow>(
      `
SELECT ${careStateSelectColumns}
FROM public.care_states
WHERE pet_id = $1
`,
      [petId]
    );

    return result.rows[0] ? mapCareStateRow(result.rows[0]) : null;
  },

  upsertRelationshipState: async (relationshipState: RelationshipState): Promise<RelationshipState> => {
    const result = await client.query<RelationshipStateRow>(
      `
INSERT INTO public.relationship_states (
  pet_id,
  bond_xp,
  bond_level,
  total_care_actions,
  total_talk_count,
  days_together,
  last_bonded_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (pet_id) DO UPDATE
SET bond_xp = EXCLUDED.bond_xp,
    bond_level = EXCLUDED.bond_level,
    total_care_actions = EXCLUDED.total_care_actions,
    total_talk_count = EXCLUDED.total_talk_count,
    days_together = EXCLUDED.days_together,
    last_bonded_at = EXCLUDED.last_bonded_at,
    updated_at = EXCLUDED.updated_at
RETURNING ${relationshipStateSelectColumns}
`,
      [
        relationshipState.petId,
        relationshipState.bondXp,
        relationshipState.bondLevel,
        relationshipState.totalCareActions,
        relationshipState.totalTalkCount,
        relationshipState.daysTogether,
        relationshipState.lastBondedAt ?? null,
        relationshipState.createdAt,
        relationshipState.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert relationship state.");
    }

    return mapRelationshipStateRow(row);
  },

  findRelationshipState: async (petId: PetId): Promise<RelationshipState | null> => {
    const result = await client.query<RelationshipStateRow>(
      `
SELECT ${relationshipStateSelectColumns}
FROM public.relationship_states
WHERE pet_id = $1
`,
      [petId]
    );

    return result.rows[0] ? mapRelationshipStateRow(result.rows[0]) : null;
  },

  upsertCreditWallet: async (wallet: CreditWallet): Promise<CreditWallet> => {
    const result = await client.query<CreditWalletRow>(
      `
INSERT INTO public.credit_wallets (
  user_id,
  credits,
  bonus_credits,
  free_chat_tickets,
  updated_at
)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id) DO UPDATE
SET credits = EXCLUDED.credits,
    bonus_credits = EXCLUDED.bonus_credits,
    free_chat_tickets = EXCLUDED.free_chat_tickets,
    updated_at = EXCLUDED.updated_at
RETURNING ${creditWalletSelectColumns}
`,
      [wallet.userId, wallet.credits, wallet.bonusCredits, wallet.freeChatTickets, wallet.updatedAt]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert credit wallet.");
    }

    return mapCreditWalletRow(row);
  },

  findCreditWallet: async (userId: UserId): Promise<CreditWallet | null> => {
    const result = await client.query<CreditWalletRow>(
      `
SELECT ${creditWalletSelectColumns}
FROM public.credit_wallets
WHERE user_id = $1
`,
      [userId]
    );

    return result.rows[0] ? mapCreditWalletRow(result.rows[0]) : null;
  },

  upsertItem: async (item: Item): Promise<Item> => {
    const result = await client.query<ItemRow>(
      `
INSERT INTO public.items (
  id,
  name,
  description,
  category,
  rarity,
  visual_key,
  is_premium,
  behavior_tags,
  placement_slots,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    visual_key = EXCLUDED.visual_key,
    is_premium = EXCLUDED.is_premium,
    behavior_tags = EXCLUDED.behavior_tags,
    placement_slots = EXCLUDED.placement_slots,
    updated_at = EXCLUDED.updated_at
RETURNING ${itemSelectColumns}
`,
      [
        item.id,
        item.name,
        item.description,
        item.category,
        item.rarity,
        item.visualKey,
        item.isPremium,
        JSON.stringify(item.behaviorTags),
        JSON.stringify(item.placementSlots),
        item.createdAt,
        item.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert item.");
    }

    return mapItemRow(row);
  },

  listItems: async (): Promise<Item[]> => {
    const result = await client.query<ItemRow>(
      `
SELECT ${itemSelectColumns}
FROM public.items
ORDER BY category ASC, rarity ASC, name ASC, id ASC
`
    );

    return result.rows.map(mapItemRow);
  },

  upsertReactionCatalogVersion: async (catalog: ReactionCatalogVersionRecord): Promise<ReactionCatalogVersionRecord> => {
    if (catalog.isActive) {
      await client.query(
        `
UPDATE public.reaction_catalog_versions
SET is_active = false,
    updated_at = $3
WHERE locale = $1
  AND version <> $2
  AND is_active = true
`,
        [catalog.locale, catalog.version, catalog.updatedAt]
      );
    }

    const result = await client.query<ReactionCatalogVersionRow>(
      `
INSERT INTO public.reaction_catalog_versions (
  locale,
  version,
  rules,
  is_active,
  created_at,
  updated_at
)
VALUES ($1, $2, $3::jsonb, $4, $5, $6)
ON CONFLICT (locale, version) DO UPDATE
SET rules = EXCLUDED.rules,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at
RETURNING ${reactionCatalogVersionSelectColumns}
`,
      [
        catalog.locale,
        catalog.version,
        JSON.stringify(catalog.rules),
        catalog.isActive,
        catalog.createdAt,
        catalog.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert reaction catalog version.");
    }

    return mapReactionCatalogVersionRow(row);
  },

  findActiveReactionCatalogVersion: async (locale: Locale): Promise<ReactionCatalogVersionRecord | null> => {
    const result = await client.query<ReactionCatalogVersionRow>(
      `
SELECT ${reactionCatalogVersionSelectColumns}
FROM public.reaction_catalog_versions
WHERE locale = $1
  AND is_active = true
ORDER BY updated_at DESC, version DESC
LIMIT 1
`,
      [locale]
    );

    return result.rows[0] ? mapReactionCatalogVersionRow(result.rows[0]) : null;
  },

  upsertInventory: async (inventory: Inventory): Promise<Inventory> => {
    await client.query(
      `
INSERT INTO public.inventories (
  user_id,
  selected_terrarium_theme_id,
  plant_growth,
  updated_at
)
VALUES ($1, $2, $3::jsonb, $4)
ON CONFLICT (user_id) DO UPDATE
SET selected_terrarium_theme_id = EXCLUDED.selected_terrarium_theme_id,
    plant_growth = EXCLUDED.plant_growth,
    updated_at = EXCLUDED.updated_at
`,
      [inventory.userId, inventory.selectedTerrariumThemeId ?? null, JSON.stringify(inventory.plantGrowth ?? []), inventory.updatedAt]
    );

    // Upsert on (user_id, item_id) instead of delete-then-insert so two
    // concurrent upserts for a brand-new user (e.g. a racing ensureInventory
    // check-then-act) converge on one row per item instead of each inserting
    // its own copy of the starter grant.
    const keptItemIds = inventory.items.map((item) => item.itemId);

    await client.query(
      keptItemIds.length > 0
        ? "DELETE FROM public.inventory_items WHERE user_id = $1 AND item_id <> ALL($2::text[])"
        : "DELETE FROM public.inventory_items WHERE user_id = $1",
      keptItemIds.length > 0 ? [inventory.userId, keptItemIds] : [inventory.userId]
    );

    for (const item of inventory.items) {
      await client.query(
        `
INSERT INTO public.inventory_items (
  user_id,
  item_id,
  quantity,
  acquired_at,
  source
)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, item_id) DO UPDATE
SET quantity = EXCLUDED.quantity,
    acquired_at = EXCLUDED.acquired_at,
    source = EXCLUDED.source
`,
        [inventory.userId, item.itemId, item.quantity, item.acquiredAt, item.source]
      );
    }

    await client.query("DELETE FROM public.placed_items WHERE user_id = $1", [inventory.userId]);

    for (const item of inventory.placedItems) {
      await client.query(
        `
INSERT INTO public.placed_items (
  user_id,
  item_id,
  slot,
  x,
  y,
  rotation
)
VALUES ($1, $2, $3, $4, $5, $6)
`,
        [inventory.userId, item.itemId, item.slot, item.x, item.y, item.rotation]
      );
    }

    return copyInventory(inventory);
  },

  findInventory: async (userId: UserId): Promise<Inventory | null> => {
    const inventoryResult = await client.query<InventoryRow>(
      `
SELECT ${inventorySelectColumns}
FROM public.inventories
WHERE user_id = $1
`,
      [userId]
    );
    const inventoryRow = inventoryResult.rows[0];

    if (!inventoryRow) {
      return null;
    }

    const itemsResult = await client.query<InventoryItemRow>(
      `
SELECT ${inventoryItemSelectColumns}
FROM public.inventory_items
WHERE user_id = $1
ORDER BY acquired_at ASC, item_id ASC, source ASC
`,
      [userId]
    );
    const placedResult = await client.query<PlacedItemRow>(
      `
SELECT ${placedItemSelectColumns}
FROM public.placed_items
WHERE user_id = $1
ORDER BY slot ASC, item_id ASC
`,
      [userId]
    );

    return mapInventoryRows(inventoryRow, itemsResult.rows, placedResult.rows);
  },

  upsertWalkSession: async (walk: WalkSession): Promise<WalkSession> => {
    const result = await client.query<WalkSessionRow>(
      `
INSERT INTO public.walk_sessions (
  id,
  user_id,
  pet_id,
  status,
  started_at,
  return_at,
  claimed_at,
  reward_item_ids,
  discovery_line,
  energy_cost,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    pet_id = EXCLUDED.pet_id,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    return_at = EXCLUDED.return_at,
    claimed_at = EXCLUDED.claimed_at,
    reward_item_ids = EXCLUDED.reward_item_ids,
    discovery_line = EXCLUDED.discovery_line,
    energy_cost = EXCLUDED.energy_cost,
    updated_at = EXCLUDED.updated_at
RETURNING ${walkSessionSelectColumns}
`,
      [
        walk.id,
        walk.userId,
        walk.petId,
        walk.status,
        walk.startedAt,
        walk.returnAt,
        walk.claimedAt ?? null,
        JSON.stringify(walk.rewardItemIds),
        walk.discoveryLine ?? null,
        walk.energyCost,
        walk.createdAt,
        walk.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert walk session.");
    }

    return mapWalkSessionRow(row);
  },

  findActiveWalkForPet: async (userId: UserId, petId: PetId): Promise<WalkSession | null> => {
    const result = await client.query<WalkSessionRow>(
      `
SELECT ${walkSessionSelectColumns}
FROM public.walk_sessions
WHERE user_id = $1
  AND pet_id = $2
  AND status IN ('walking', 'returned')
ORDER BY started_at DESC, id DESC
LIMIT 1
`,
      [userId, petId]
    );

    return result.rows[0] ? mapWalkSessionRow(result.rows[0]) : null;
  },

  findWalkSession: async (userId: UserId, walkId: WalkSessionId): Promise<WalkSession | null> => {
    const result = await client.query<WalkSessionRow>(
      `
SELECT ${walkSessionSelectColumns}
FROM public.walk_sessions
WHERE user_id = $1 AND id = $2
`,
      [userId, walkId]
    );

    return result.rows[0] ? mapWalkSessionRow(result.rows[0]) : null;
  },

  upsertRecentReaction: async (reaction: RecentReactionRecord): Promise<RecentReactionRecord> => {
    const result = await client.query<RecentReactionRow>(
      `
INSERT INTO public.recent_reactions (
  user_id,
  pet_id,
  rule_id,
  line,
  shown_at
)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, pet_id, rule_id, shown_at) DO UPDATE
SET line = EXCLUDED.line
RETURNING ${recentReactionSelectColumns}
`,
      [reaction.userId, reaction.petId, reaction.ruleId, reaction.line, reaction.shownAt]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert recent reaction.");
    }

    return mapRecentReactionRow(row);
  },

  listRecentReactionsForPet: async (
    userId: UserId,
    petId: PetId,
    limit: number = 12
  ): Promise<RecentReactionRecord[]> => {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const result = await client.query<RecentReactionRow>(
      `
SELECT ${recentReactionSelectColumns}
FROM public.recent_reactions
WHERE user_id = $1 AND pet_id = $2
ORDER BY shown_at DESC, rule_id ASC
LIMIT $3
`,
      [userId, petId, safeLimit]
    );

    return result.rows.map(mapRecentReactionRow);
  }
});
