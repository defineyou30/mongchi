import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { MockApiServiceSnapshot, OriginalPhotoRecord, PurchaseLedgerRecord, RecentReactionRecord } from "./service";

import type {
  CareState,
  Conversation,
  ConversationMessage,
  Entitlement,
  GeneratedAsset,
  GenerationJob,
  Inventory,
  Item,
  PetProfile,
  UserId,
  WalkSession
} from "@mongchi/shared";

export interface ApiSnapshotPersistenceStatement {
  sql: string;
  params?: readonly unknown[];
}

export interface MockApiServiceSnapshotPersistenceOptions {
  defaultLocale?: string;
  defaultTimezone?: string;
  persistedAt?: string;
  replaceExisting?: boolean;
  userAuthProvider?: string;
}

export type ApiSnapshotRepositoryClient = ApiDatabaseMigrationClient;

const clearSnapshotTablesSql = [
  "DELETE FROM public.purchase_ledger",
  "DELETE FROM public.entitlements",
  "DELETE FROM public.conversation_messages",
  "DELETE FROM public.conversations",
  "DELETE FROM public.recent_reactions",
  "DELETE FROM public.relationship_states",
  "DELETE FROM public.care_states",
  "DELETE FROM public.walk_sessions",
  "DELETE FROM public.placed_items",
  "DELETE FROM public.inventory_items",
  "DELETE FROM public.inventories",
  "DELETE FROM public.credit_wallets",
  "DELETE FROM public.generated_assets",
  "DELETE FROM public.generation_jobs",
  "DELETE FROM public.original_photos",
  "DELETE FROM public.pets",
  "DELETE FROM public.items",
  "DELETE FROM public.api_users"
] as const;

const statement = (sql: string, params?: readonly unknown[]): ApiSnapshotPersistenceStatement =>
  params ? { sql, params } : { sql };

const json = (value: unknown): string => JSON.stringify(value);

export const collectMockApiServiceSnapshotUserIds = (snapshot: MockApiServiceSnapshot): UserId[] => {
  const userIds = new Set<UserId>();

  for (const pet of snapshot.pets) {
    userIds.add(pet.userId);
  }

  for (const photo of snapshot.photos) {
    userIds.add(photo.userId);
  }

  for (const generationJob of snapshot.generationJobs) {
    userIds.add(generationJob.userId);
  }

  for (const inventory of snapshot.inventories) {
    userIds.add(inventory.userId);
  }

  for (const walkSession of snapshot.walkSessions) {
    userIds.add(walkSession.userId);
  }

  for (const reaction of snapshot.recentReactions) {
    userIds.add(reaction.userId);
  }

  for (const entitlement of snapshot.entitlements) {
    userIds.add(entitlement.userId);
  }

  for (const purchase of snapshot.purchaseLedger) {
    userIds.add(purchase.userId);
  }

  for (const conversation of snapshot.conversations) {
    userIds.add(conversation.userId);
  }

  return [...userIds].sort();
};

const createUserStatement = (
  userId: UserId,
  options: Required<Pick<MockApiServiceSnapshotPersistenceOptions, "defaultLocale" | "defaultTimezone" | "persistedAt" | "userAuthProvider">>
) =>
  statement(
    `
INSERT INTO public.api_users (id, auth_provider, auth_subject, locale, timezone, created_at, updated_at)
VALUES ($1, $2, $1, $3, $4, $5, $5)
ON CONFLICT (id) DO UPDATE
SET locale = EXCLUDED.locale,
    timezone = EXCLUDED.timezone,
    updated_at = EXCLUDED.updated_at
`,
    [userId, options.userAuthProvider, options.defaultLocale, options.defaultTimezone, options.persistedAt]
  );

const createItemStatement = (item: Item) =>
  statement(
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
`,
    [
      item.id,
      item.name,
      item.description,
      item.category,
      item.rarity,
      item.visualKey,
      item.isPremium,
      json(item.behaviorTags),
      json(item.placementSlots),
      item.createdAt,
      item.updatedAt
    ]
  );

const createPetInsertStatement = (pet: PetProfile) =>
  statement(
    `
INSERT INTO public.pets (
  id,
  user_id,
  name,
  species,
  personality_tags,
  talking_style,
  favorite_thing,
  memory_note,
  active_generation_job_id,
  active_asset_id,
  lifecycle_status,
  original_photo_deleted_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NULL, NULL, $9, $10, $11, $12)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    species = EXCLUDED.species,
    personality_tags = EXCLUDED.personality_tags,
    talking_style = EXCLUDED.talking_style,
    favorite_thing = EXCLUDED.favorite_thing,
    memory_note = EXCLUDED.memory_note,
    lifecycle_status = EXCLUDED.lifecycle_status,
    original_photo_deleted_at = EXCLUDED.original_photo_deleted_at,
    updated_at = EXCLUDED.updated_at
`,
    [
      pet.id,
      pet.userId,
      pet.name,
      pet.species,
      json(pet.personalityTags),
      pet.talkingStyle,
      pet.favoriteThing ?? null,
      pet.memoryNote ?? null,
      pet.lifecycleStatus,
      pet.originalPhotoDeletedAt ?? null,
      pet.createdAt,
      pet.updatedAt
    ]
  );

const createPetActiveReferencesStatement = (pet: PetProfile) =>
  statement(
    `
UPDATE public.pets
SET active_generation_job_id = CASE
      WHEN EXISTS (SELECT 1 FROM public.generation_jobs WHERE id = $2) THEN $2
      ELSE NULL
    END,
    active_asset_id = CASE
      WHEN EXISTS (SELECT 1 FROM public.generated_assets WHERE id = $3) THEN $3
      ELSE NULL
    END,
    updated_at = $4
WHERE id = $1
`,
    [pet.id, pet.activeGenerationJobId ?? null, pet.activeAssetId ?? null, pet.updatedAt]
  );

const createPhotoStatement = (photo: OriginalPhotoRecord) =>
  statement(
    `
INSERT INTO public.original_photos (
  id,
  user_id,
  pet_id,
  content_type,
  byte_size,
  status,
  storage_uri,
  expires_at,
  content_hash,
  uploaded_at,
  deleted_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    storage_uri = EXCLUDED.storage_uri,
    content_hash = EXCLUDED.content_hash,
    uploaded_at = EXCLUDED.uploaded_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = EXCLUDED.updated_at
`,
    [
      photo.id,
      photo.userId,
      photo.petId,
      photo.contentType,
      photo.byteSize,
      photo.status,
      photo.uploadUrl,
      photo.expiresAt,
      photo.contentHash ?? null,
      photo.uploadedAt ?? null,
      photo.deletedAt ?? null,
      photo.createdAt,
      photo.updatedAt
    ]
  );

const createGenerationJobStatement = (job: GenerationJob) =>
  statement(
    `
INSERT INTO public.generation_jobs (
  id,
  user_id,
  pet_id,
  source_photo_ids,
  optional_photo_ids,
  status,
  input_snapshot,
  provider,
  cost_units,
  quality,
  failure,
  completed_at,
  expires_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    source_photo_ids = EXCLUDED.source_photo_ids,
    optional_photo_ids = EXCLUDED.optional_photo_ids,
    input_snapshot = EXCLUDED.input_snapshot,
    provider = EXCLUDED.provider,
    cost_units = EXCLUDED.cost_units,
    quality = EXCLUDED.quality,
    failure = EXCLUDED.failure,
    completed_at = EXCLUDED.completed_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at
`,
    [
      job.id,
      job.userId,
      job.petId,
      json(job.sourcePhotoIds),
      json(job.optionalPhotoIds),
      job.status,
      json(job.inputSnapshot),
      job.provider,
      job.costUnits,
      json(job.quality),
      job.failure ? json(job.failure) : null,
      job.completedAt ?? null,
      job.expiresAt ?? null,
      job.createdAt,
      job.updatedAt
    ]
  );

const createGeneratedAssetStatement = (asset: GeneratedAsset) =>
  statement(
    `
INSERT INTO public.generated_assets (
  id,
  pet_id,
  generation_job_id,
  state,
  storage_uri,
  thumbnail_uri,
  width,
  height,
  content_hash,
  mime_type,
  storage_class,
  version,
  quality_status,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT (id) DO UPDATE
SET state = EXCLUDED.state,
    storage_uri = EXCLUDED.storage_uri,
    thumbnail_uri = EXCLUDED.thumbnail_uri,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    content_hash = EXCLUDED.content_hash,
    mime_type = EXCLUDED.mime_type,
    storage_class = EXCLUDED.storage_class,
    version = EXCLUDED.version,
    quality_status = EXCLUDED.quality_status,
    updated_at = EXCLUDED.updated_at
`,
    [
      asset.id,
      asset.petId,
      asset.generationJobId,
      asset.state,
      asset.uri,
      asset.thumbnailUri ?? null,
      asset.width,
      asset.height,
      asset.contentHash,
      asset.mimeType,
      asset.storageClass,
      asset.version,
      asset.qualityStatus,
      asset.createdAt,
      asset.updatedAt
    ]
  );

const createWalkSessionStatement = (walk: WalkSession) =>
  statement(
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
SET status = EXCLUDED.status,
    claimed_at = EXCLUDED.claimed_at,
    reward_item_ids = EXCLUDED.reward_item_ids,
    discovery_line = EXCLUDED.discovery_line,
    energy_cost = EXCLUDED.energy_cost,
    updated_at = EXCLUDED.updated_at
`,
    [
      walk.id,
      walk.userId,
      walk.petId,
      walk.status,
      walk.startedAt,
      walk.returnAt,
      walk.claimedAt ?? null,
      json(walk.rewardItemIds),
      walk.discoveryLine ?? null,
      walk.energyCost,
      walk.createdAt,
      walk.updatedAt
    ]
  );

const createCareStateStatement = (careState: CareState) =>
  statement(
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

const createInventoryStatement = (inventory: Inventory) =>
  statement(
    `
INSERT INTO public.inventories (user_id, selected_terrarium_theme_id, plant_growth, updated_at)
VALUES ($1, $2, $3::jsonb, $4)
ON CONFLICT (user_id) DO UPDATE
SET selected_terrarium_theme_id = EXCLUDED.selected_terrarium_theme_id,
    plant_growth = EXCLUDED.plant_growth,
    updated_at = EXCLUDED.updated_at
`,
    [inventory.userId, inventory.selectedTerrariumThemeId ?? null, json(inventory.plantGrowth ?? []), inventory.updatedAt]
  );

const createRelationshipStateStatement = (relationshipState: MockApiServiceSnapshot["relationshipStates"][number]) =>
  statement(
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

const createCreditWalletStatement = (wallet: MockApiServiceSnapshot["wallets"][number]) =>
  statement(
    `
INSERT INTO public.credit_wallets (user_id, credits, bonus_credits, free_chat_tickets, updated_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id) DO UPDATE
SET credits = EXCLUDED.credits,
    bonus_credits = EXCLUDED.bonus_credits,
    free_chat_tickets = EXCLUDED.free_chat_tickets,
    updated_at = EXCLUDED.updated_at
`,
    [wallet.userId, wallet.credits, wallet.bonusCredits, wallet.freeChatTickets, wallet.updatedAt]
  );

const createInventoryEntryStatement = (inventory: Inventory, entry: Inventory["items"][number]) =>
  statement(
    `
INSERT INTO public.inventory_items (user_id, item_id, quantity, acquired_at, source)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, item_id) DO UPDATE
SET quantity = EXCLUDED.quantity,
    acquired_at = EXCLUDED.acquired_at,
    source = EXCLUDED.source
`,
    [inventory.userId, entry.itemId, entry.quantity, entry.acquiredAt, entry.source]
  );

const createPlacedItemStatement = (inventory: Inventory, placedItem: Inventory["placedItems"][number]) =>
  statement(
    `
INSERT INTO public.placed_items (user_id, item_id, slot, x, y, rotation)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, item_id, slot) DO UPDATE
SET x = EXCLUDED.x,
    y = EXCLUDED.y,
    rotation = EXCLUDED.rotation
`,
    [inventory.userId, placedItem.itemId, placedItem.slot, placedItem.x, placedItem.y, placedItem.rotation]
  );

const createRecentReactionStatement = (reaction: RecentReactionRecord) =>
  statement(
    `
INSERT INTO public.recent_reactions (user_id, pet_id, rule_id, line, shown_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, pet_id, rule_id, shown_at) DO UPDATE
SET line = EXCLUDED.line
`,
    [reaction.userId, reaction.petId, reaction.ruleId, reaction.line, reaction.shownAt]
  );

const createConversationStatement = (conversation: Conversation) =>
  statement(
    `
INSERT INTO public.conversations (
  id,
  user_id,
  pet_id,
  type,
  status,
  disclosure_accepted_at,
  deleted_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    disclosure_accepted_at = EXCLUDED.disclosure_accepted_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = EXCLUDED.updated_at
`,
    [
      conversation.id,
      conversation.userId,
      conversation.petId,
      conversation.type,
      conversation.status,
      conversation.disclosureAcceptedAt ?? null,
      conversation.deletedAt ?? null,
      conversation.createdAt,
      conversation.updatedAt
    ]
  );

const createConversationMessageStatement = (message: ConversationMessage) =>
  statement(
    `
INSERT INTO public.conversation_messages (id, conversation_id, sender, text, safety_flags, created_at)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (id) DO UPDATE
SET text = EXCLUDED.text,
    safety_flags = EXCLUDED.safety_flags
`,
    [message.id, message.conversationId, message.sender, message.text, json(message.safetyFlags), message.createdAt]
  );

const createEntitlementStatement = (entitlement: Entitlement) =>
  statement(
    `
INSERT INTO public.entitlements (
  id,
  user_id,
  key,
  status,
  source,
  product_id,
  starts_at,
  ends_at,
  ledger_entry_id,
  metadata,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    product_id = EXCLUDED.product_id,
    ends_at = EXCLUDED.ends_at,
    ledger_entry_id = EXCLUDED.ledger_entry_id,
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at
`,
    [
      entitlement.id,
      entitlement.userId,
      entitlement.key,
      entitlement.status,
      entitlement.source,
      entitlement.productId ?? null,
      entitlement.startsAt,
      entitlement.endsAt ?? null,
      entitlement.ledgerEntryId,
      json(entitlement.metadata),
      entitlement.createdAt,
      entitlement.updatedAt
    ]
  );

const createPurchaseLedgerStatement = (purchase: PurchaseLedgerRecord) =>
  statement(
    `
INSERT INTO public.purchase_ledger (
  ledger_entry_id,
  user_id,
  platform,
  product_id,
  transaction_id,
  receipt_hash,
  entitlement_id,
  status,
  verified_at,
  restored_at,
  revoked_at,
  revocation_reason
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (ledger_entry_id) DO UPDATE
SET status = EXCLUDED.status,
    restored_at = EXCLUDED.restored_at,
    revoked_at = EXCLUDED.revoked_at,
    revocation_reason = EXCLUDED.revocation_reason
`,
    [
      purchase.ledgerEntryId,
      purchase.userId,
      purchase.platform,
      purchase.productId,
      purchase.transactionId,
      purchase.receiptHash,
      purchase.entitlementId,
      purchase.status,
      purchase.verifiedAt,
      purchase.restoredAt ?? null,
      purchase.revokedAt ?? null,
      purchase.revocationReason ?? null
    ]
  );

export const createMockApiServiceSnapshotPersistencePlan = (
  snapshot: MockApiServiceSnapshot,
  options: MockApiServiceSnapshotPersistenceOptions = {}
): ApiSnapshotPersistenceStatement[] => {
  const persistedAt = options.persistedAt ?? new Date().toISOString();
  const resolvedOptions = {
    defaultLocale: options.defaultLocale ?? "ko-KR",
    defaultTimezone: options.defaultTimezone ?? "Asia/Seoul",
    persistedAt,
    userAuthProvider: options.userAuthProvider ?? "snapshot"
  };
  const statements: ApiSnapshotPersistenceStatement[] = [];

  if (options.replaceExisting ?? true) {
    statements.push(...clearSnapshotTablesSql.map((sql) => statement(sql)));
  }

  for (const userId of collectMockApiServiceSnapshotUserIds(snapshot)) {
    statements.push(createUserStatement(userId, resolvedOptions));
  }

  statements.push(...snapshot.itemCatalog.map(createItemStatement));
  statements.push(...snapshot.pets.map(createPetInsertStatement));
  statements.push(...snapshot.photos.map(createPhotoStatement));
  statements.push(...snapshot.generationJobs.map(createGenerationJobStatement));
  statements.push(...snapshot.generatedAssets.map(createGeneratedAssetStatement));
  statements.push(...snapshot.pets.map(createPetActiveReferencesStatement));
  statements.push(...snapshot.walkSessions.map(createWalkSessionStatement));
  statements.push(...snapshot.careStates.map(createCareStateStatement));
  statements.push(...snapshot.relationshipStates.map(createRelationshipStateStatement));
  statements.push(...snapshot.wallets.map(createCreditWalletStatement));

  for (const inventory of snapshot.inventories) {
    statements.push(createInventoryStatement(inventory));
    statements.push(...inventory.items.map((entry) => createInventoryEntryStatement(inventory, entry)));
    statements.push(...inventory.placedItems.map((placedItem) => createPlacedItemStatement(inventory, placedItem)));
  }

  statements.push(...snapshot.recentReactions.map(createRecentReactionStatement));
  statements.push(...snapshot.conversations.map(createConversationStatement));
  statements.push(...snapshot.conversationMessages.map(createConversationMessageStatement));
  statements.push(...snapshot.entitlements.map(createEntitlementStatement));
  statements.push(...snapshot.purchaseLedger.map(createPurchaseLedgerStatement));

  return statements;
};

export const persistMockApiServiceSnapshot = async (
  client: ApiSnapshotRepositoryClient,
  snapshot: MockApiServiceSnapshot,
  options: MockApiServiceSnapshotPersistenceOptions = {}
): Promise<void> => {
  const statements = createMockApiServiceSnapshotPersistencePlan(snapshot, options);

  await client.query("BEGIN");

  try {
    for (const currentStatement of statements) {
      await client.query(currentStatement.sql, currentStatement.params);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};
