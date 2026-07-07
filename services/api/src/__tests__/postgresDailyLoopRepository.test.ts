import { describe, expect, it } from "vitest";

import type { CareState, CreditWallet, Inventory, Item, ReactionRule, RelationshipState, WalkSession } from "@mongchi/shared";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresDailyLoopRepository } from "../postgresDailyLoopRepository";
import type { RecentReactionRecord } from "../service";

class QueueDatabaseClient implements ApiDatabaseMigrationClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][];

  constructor(queuedRows: unknown[][]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });

    return {
      rows: (this.queuedRows.shift() ?? []) as Row[]
    };
  }
}

const careState: CareState = {
  petId: "pet_miso_001",
  satiety: 72,
  energy: 58,
  happiness: 83,
  affection: 76,
  gardenHealth: 64,
  cleanliness: 88,
  lastFedAt: "2026-06-24T09:00:00.000Z",
  lastInteractionAt: "2026-06-24T09:10:00.000Z",
  lastGardenWateredAt: "2026-06-24T09:15:00.000Z",
  activeWalkId: "walk_miso_001",
  updatedAt: "2026-06-24T09:20:00.000Z"
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

const toyBall: Item = {
  id: "item_toy_ball",
  name: "Tiny Ball",
  description: "A bright garden ball for playful pets.",
  category: "toy",
  rarity: "common",
  visualKey: "toy-ball-v2",
  isPremium: false,
  behaviorTags: ["play", "happiness"],
  placementSlots: ["ground", "garden"],
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const itemRow = (item: Item) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  category: item.category,
  rarity: item.rarity,
  visual_key: item.visualKey,
  is_premium: item.isPremium,
  behavior_tags: JSON.stringify(item.behaviorTags),
  placement_slots: item.placementSlots,
  created_at: item.createdAt,
  updated_at: item.updatedAt
});

const reactionRule: ReactionRule = {
  id: "en_test_greeting_001",
  locale: "en-US",
  category: "greeting_morning",
  conditions: {
    timeBucket: "morning"
  },
  lines: ["A tiny hello."],
  animation: "idle",
  priority: 10,
  cooldownHours: 1,
  safetyLevel: "safe"
};

const reactionCatalogVersion = {
  locale: "en-US" as const,
  version: "test-2026-06-25",
  rules: [reactionRule],
  isActive: true,
  createdAt: "2026-06-25T09:00:00.000Z",
  updatedAt: "2026-06-25T09:00:00.000Z"
};

const reactionCatalogVersionRow = (catalog: typeof reactionCatalogVersion) => ({
  locale: catalog.locale,
  version: catalog.version,
  rules: JSON.stringify(catalog.rules),
  is_active: catalog.isActive,
  created_at: catalog.createdAt,
  updated_at: catalog.updatedAt
});

const inventory: Inventory = {
  userId: "user_demo_001",
  items: [
    {
      itemId: "item_toy_ball",
      quantity: 1,
      acquiredAt: "2026-06-24T08:00:00.000Z",
      source: "starter"
    },
    {
      itemId: "item_lantern",
      quantity: 2,
      acquiredAt: "2026-06-24T09:30:00.000Z",
      source: "walk_reward"
    }
  ],
  selectedTerrariumThemeId: "item_theme_sky",
  ownedThemeIds: [],
  placedItems: [
    {
      itemId: "item_lantern",
      slot: "wall",
      x: 0.82,
      y: 0.28,
      rotation: -6
    }
  ],
  plantGrowth: [
    {
      itemId: "item_flower_pot_sunny",
      stageIndex: 1,
      waterPoints: 0,
      lastWateredAt: "2026-06-24T09:20:00.000Z",
      updatedAt: "2026-06-24T09:20:00.000Z"
    }
  ],
  updatedAt: "2026-06-24T09:30:00.000Z"
};

const inventoryRow = (currentInventory: Inventory) => ({
  user_id: currentInventory.userId,
  selected_terrarium_theme_id: currentInventory.selectedTerrariumThemeId ?? null,
  plant_growth: JSON.stringify(currentInventory.plantGrowth ?? []),
  updated_at: currentInventory.updatedAt
});

const relationshipState: RelationshipState = {
  petId: careState.petId,
  bondXp: 124,
  bondLevel: 2,
  totalCareActions: 18,
  totalTalkCount: 4,
  daysTogether: 3,
  lastBondedAt: "2026-06-24T09:24:00.000Z",
  createdAt: "2026-06-22T09:00:00.000Z",
  updatedAt: "2026-06-24T09:24:00.000Z"
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

const creditWallet: CreditWallet = {
  userId: inventory.userId,
  credits: 10,
  bonusCredits: 25,
  freeChatTickets: 2,
  updatedAt: "2026-06-24T09:25:00.000Z"
};

const creditWalletRow = (wallet: CreditWallet) => ({
  user_id: wallet.userId,
  credits: wallet.credits,
  bonus_credits: wallet.bonusCredits,
  free_chat_tickets: wallet.freeChatTickets,
  updated_at: wallet.updatedAt
});

const inventoryItemRows = (currentInventory: Inventory) =>
  currentInventory.items.map((item) => ({
    user_id: currentInventory.userId,
    item_id: item.itemId,
    quantity: item.quantity,
    acquired_at: item.acquiredAt,
    source: item.source
  }));

const placedItemRows = (currentInventory: Inventory) =>
  currentInventory.placedItems.map((item) => ({
    user_id: currentInventory.userId,
    item_id: item.itemId,
    slot: item.slot,
    x: item.x.toFixed(2),
    y: item.y.toFixed(2),
    rotation: item.rotation.toString()
  }));

const walk: WalkSession = {
  id: "walk_miso_001",
  userId: inventory.userId,
  petId: careState.petId,
  status: "returned",
  startedAt: "2026-06-24T09:00:00.000Z",
  returnAt: "2026-06-24T09:30:00.000Z",
  rewardItemIds: ["item_lantern"],
  discoveryLine: "작은 잎사귀가 네 생각을 했대.",
  energyCost: 12,
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:30:00.000Z"
};

const walkRow = (currentWalk: WalkSession) => ({
  id: currentWalk.id,
  user_id: currentWalk.userId,
  pet_id: currentWalk.petId,
  status: currentWalk.status,
  started_at: currentWalk.startedAt,
  return_at: currentWalk.returnAt,
  claimed_at: currentWalk.claimedAt ?? null,
  reward_item_ids: JSON.stringify(currentWalk.rewardItemIds),
  discovery_line: currentWalk.discoveryLine ?? null,
  energy_cost: currentWalk.energyCost,
  created_at: currentWalk.createdAt,
  updated_at: currentWalk.updatedAt
});

const recentReaction: RecentReactionRecord = {
  userId: inventory.userId,
  petId: careState.petId,
  ruleId: "walk_return_common_ko_001",
  line: "꽃잎 길에서 반짝이는 선물을 찾았어.",
  shownAt: "2026-06-24T09:31:00.000Z"
};

const reactionRow = (reaction: RecentReactionRecord) => ({
  user_id: reaction.userId,
  pet_id: reaction.petId,
  rule_id: reaction.ruleId,
  line: reaction.line,
  shown_at: reaction.shownAt
});

describe("Postgres daily loop repository", () => {
  it("upserts and reads care state with optional timestamps and active walk id", async () => {
    const client = new QueueDatabaseClient([[careStateRow(careState)], [careStateRow(careState)]]);
    const repository = createPostgresDailyLoopRepository(client);

    await expect(repository.upsertCareState(careState)).resolves.toEqual(careState);
    await expect(repository.findCareState(careState.petId)).resolves.toEqual(careState);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.care_states");
    expect(client.queries[0]?.sql).not.toContain(careState.petId);
    expect(client.queries[0]?.params).toEqual([
      careState.petId,
      careState.satiety,
      careState.energy,
      careState.happiness,
      careState.affection,
      careState.gardenHealth,
      careState.cleanliness,
      careState.lastFedAt,
      careState.lastInteractionAt,
      careState.lastGardenWateredAt,
      careState.activeWalkId,
      careState.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("WHERE pet_id = $1");
  });

  it("upserts and reads relationship state and credit wallet rows", async () => {
    const client = new QueueDatabaseClient([
      [relationshipStateRow(relationshipState)],
      [relationshipStateRow(relationshipState)],
      [creditWalletRow(creditWallet)],
      [creditWalletRow(creditWallet)]
    ]);
    const repository = createPostgresDailyLoopRepository(client);

    await expect(repository.upsertRelationshipState(relationshipState)).resolves.toEqual(relationshipState);
    await expect(repository.findRelationshipState(relationshipState.petId)).resolves.toEqual(relationshipState);
    await expect(repository.upsertCreditWallet(creditWallet)).resolves.toEqual(creditWallet);
    await expect(repository.findCreditWallet(creditWallet.userId)).resolves.toEqual(creditWallet);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.relationship_states");
    expect(client.queries[0]?.params).toEqual([
      relationshipState.petId,
      relationshipState.bondXp,
      relationshipState.bondLevel,
      relationshipState.totalCareActions,
      relationshipState.totalTalkCount,
      relationshipState.daysTogether,
      relationshipState.lastBondedAt,
      relationshipState.createdAt,
      relationshipState.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("FROM public.relationship_states");
    expect(client.queries[2]?.sql).toContain("INSERT INTO public.credit_wallets");
    expect(client.queries[2]?.params).toEqual([
      creditWallet.userId,
      creditWallet.credits,
      creditWallet.bonusCredits,
      creditWallet.freeChatTickets,
      creditWallet.updatedAt
    ]);
    expect(client.queries[3]?.sql).toContain("FROM public.credit_wallets");
  });

  it("upserts and lists item catalog rows with JSON arrays", async () => {
    const client = new QueueDatabaseClient([[itemRow(toyBall)], [itemRow(toyBall)]]);
    const repository = createPostgresDailyLoopRepository(client);

    await expect(repository.upsertItem(toyBall)).resolves.toEqual(toyBall);
    await expect(repository.listItems()).resolves.toEqual([toyBall]);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.items");
    expect(client.queries[0]?.params).toEqual([
      toyBall.id,
      toyBall.name,
      toyBall.description,
      toyBall.category,
      toyBall.rarity,
      toyBall.visualKey,
      toyBall.isPremium,
      JSON.stringify(toyBall.behaviorTags),
      JSON.stringify(toyBall.placementSlots),
      toyBall.createdAt,
      toyBall.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("ORDER BY category ASC");
  });

  it("upserts and finds the active reaction catalog version", async () => {
    const client = new QueueDatabaseClient([
      [],
      [reactionCatalogVersionRow(reactionCatalogVersion)],
      [reactionCatalogVersionRow(reactionCatalogVersion)]
    ]);
    const repository = createPostgresDailyLoopRepository(client);

    await expect(repository.upsertReactionCatalogVersion(reactionCatalogVersion)).resolves.toEqual(reactionCatalogVersion);
    await expect(repository.findActiveReactionCatalogVersion("en-US")).resolves.toEqual(reactionCatalogVersion);

    expect(client.queries[0]?.sql).toContain("UPDATE public.reaction_catalog_versions");
    expect(client.queries[0]?.params).toEqual([
      reactionCatalogVersion.locale,
      reactionCatalogVersion.version,
      reactionCatalogVersion.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("INSERT INTO public.reaction_catalog_versions");
    expect(client.queries[1]?.params).toEqual([
      reactionCatalogVersion.locale,
      reactionCatalogVersion.version,
      JSON.stringify(reactionCatalogVersion.rules),
      true,
      reactionCatalogVersion.createdAt,
      reactionCatalogVersion.updatedAt
    ]);
    expect(client.queries[2]?.sql).toContain("WHERE locale = $1");
    expect(client.queries[2]?.sql).toContain("is_active = true");
  });

  it("replaces inventory child rows and reads a combined inventory snapshot", async () => {
    const client = new QueueDatabaseClient([
      [],
      [],
      [],
      [],
      [],
      [],
      [inventoryRow(inventory)],
      [inventoryItemRows(inventory)[0], inventoryItemRows(inventory)[1]],
      placedItemRows(inventory)
    ]);
    const repository = createPostgresDailyLoopRepository(client);

    await expect(repository.upsertInventory(inventory)).resolves.toEqual(inventory);
    await expect(repository.findInventory(inventory.userId)).resolves.toEqual(inventory);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.inventories");
    expect(client.queries[0]?.params).toEqual([
      inventory.userId,
      inventory.selectedTerrariumThemeId,
      JSON.stringify(inventory.plantGrowth ?? []),
      inventory.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("DELETE FROM public.inventory_items");
    expect(client.queries[1]?.sql).toContain("item_id <> ALL($2::text[])");
    expect(client.queries[1]?.params).toEqual([inventory.userId, inventory.items.map((item) => item.itemId)]);
    expect(client.queries[2]?.sql).toContain("INSERT INTO public.inventory_items");
    expect(client.queries[2]?.sql).toContain("ON CONFLICT (user_id, item_id) DO UPDATE");
    expect(client.queries[2]?.params).toEqual([
      inventory.userId,
      inventory.items[0]!.itemId,
      inventory.items[0]!.quantity,
      inventory.items[0]!.acquiredAt,
      inventory.items[0]!.source
    ]);
    expect(client.queries[4]?.sql).toContain("DELETE FROM public.placed_items");
    expect(client.queries[5]?.sql).toContain("INSERT INTO public.placed_items");
    expect(client.queries[5]?.params).toEqual([
      inventory.userId,
      inventory.placedItems[0]!.itemId,
      inventory.placedItems[0]!.slot,
      inventory.placedItems[0]!.x,
      inventory.placedItems[0]!.y,
      inventory.placedItems[0]!.rotation
    ]);
    expect(client.queries[6]?.sql).toContain("FROM public.inventories");
    expect(client.queries[7]?.sql).toContain("FROM public.inventory_items");
    expect(client.queries[8]?.sql).toContain("FROM public.placed_items");
  });

  it("upserts and reads walk sessions by active pet and id", async () => {
    const claimedWalk: WalkSession = {
      ...walk,
      status: "claimed",
      claimedAt: "2026-06-24T09:32:00.000Z",
      updatedAt: "2026-06-24T09:32:00.000Z"
    };
    const client = new QueueDatabaseClient([[walkRow(walk)], [walkRow(walk)], [walkRow(claimedWalk)]]);
    const repository = createPostgresDailyLoopRepository(client);

    await expect(repository.upsertWalkSession(walk)).resolves.toEqual(walk);
    await expect(repository.findActiveWalkForPet(walk.userId, walk.petId)).resolves.toEqual(walk);
    await expect(repository.findWalkSession(walk.userId, walk.id)).resolves.toEqual(claimedWalk);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.walk_sessions");
    expect(client.queries[0]?.params).toEqual([
      walk.id,
      walk.userId,
      walk.petId,
      walk.status,
      walk.startedAt,
      walk.returnAt,
      null,
      JSON.stringify(walk.rewardItemIds),
      walk.discoveryLine,
      walk.energyCost,
      walk.createdAt,
      walk.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("status IN ('walking', 'returned')");
    expect(client.queries[2]?.sql).toContain("WHERE user_id = $1 AND id = $2");
  });

  it("upserts and lists recent reactions with a bounded limit", async () => {
    const client = new QueueDatabaseClient([[reactionRow(recentReaction)], [reactionRow(recentReaction)]]);
    const repository = createPostgresDailyLoopRepository(client);

    await expect(repository.upsertRecentReaction(recentReaction)).resolves.toEqual(recentReaction);
    await expect(repository.listRecentReactionsForPet(recentReaction.userId, recentReaction.petId, 5)).resolves.toEqual([
      recentReaction
    ]);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.recent_reactions");
    expect(client.queries[0]?.params).toEqual([
      recentReaction.userId,
      recentReaction.petId,
      recentReaction.ruleId,
      recentReaction.line,
      recentReaction.shownAt
    ]);
    expect(client.queries[1]?.sql).toContain("ORDER BY shown_at DESC");
    expect(client.queries[1]?.params).toEqual([recentReaction.userId, recentReaction.petId, 5]);
  });
});
