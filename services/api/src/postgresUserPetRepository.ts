import type {
  GeneratedAssetId,
  GenerationJobId,
  ISODateTime,
  Locale,
  PetId,
  PetLifecycleStatus,
  PetProfile,
  PetSpecies,
  PersonalityTag,
  TalkingStyle,
  UserId
} from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { CurrentUserResponse } from "./contracts";

export interface ApiUserRecord {
  id: UserId;
  authProvider: string;
  authSubject: string;
  locale: Locale;
  timezone: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface ApiUserRow {
  id: string;
  auth_provider: string;
  auth_subject: string;
  locale: Locale;
  timezone: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PetRow {
  id: string;
  user_id: string;
  name: string;
  species: PetSpecies;
  personality_tags: unknown;
  talking_style: TalkingStyle;
  favorite_thing: string | null;
  memory_note: string | null;
  active_generation_job_id: string | null;
  active_asset_id: string | null;
  lifecycle_status: PetLifecycleStatus;
  original_photo_deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface OnboardingStateRow {
  live_pet_count: number | string;
  active_pet_count: number | string;
  active_generation_count: number | string;
}

export interface UpsertApiUserInput {
  id: UserId;
  authProvider: string;
  authSubject: string;
  locale: Locale;
  timezone: string;
  now: ISODateTime;
}

export interface UpsertPetProfileInput {
  pet: PetProfile;
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

const numberFromCount = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10);
  }

  return 0;
};

const mapUserRow = (row: ApiUserRow): ApiUserRecord => ({
  id: row.id,
  authProvider: row.auth_provider,
  authSubject: row.auth_subject,
  locale: row.locale,
  timezone: row.timezone,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const mapPetRow = (row: PetRow): PetProfile => {
  const originalPhotoDeletedAt = nullableIso(row.original_photo_deleted_at);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    species: row.species,
    personalityTags: parseJsonArray<PersonalityTag>(row.personality_tags),
    talkingStyle: row.talking_style,
    ...(row.favorite_thing ? { favoriteThing: row.favorite_thing } : {}),
    ...(row.memory_note ? { memoryNote: row.memory_note } : {}),
    ...(row.active_generation_job_id ? { activeGenerationJobId: row.active_generation_job_id as GenerationJobId } : {}),
    ...(row.active_asset_id ? { activeAssetId: row.active_asset_id as GeneratedAssetId } : {}),
    lifecycleStatus: row.lifecycle_status,
    ...(originalPhotoDeletedAt ? { originalPhotoDeletedAt } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

const livePetWhere = "user_id = $1 AND lifecycle_status <> 'deleted'";

export const createPostgresUserPetRepository = (client: ApiDatabaseMigrationClient) => ({
  upsertUser: async (input: UpsertApiUserInput): Promise<ApiUserRecord> => {
    const result = await client.query<ApiUserRow>(
      `
INSERT INTO public.api_users (id, auth_provider, auth_subject, locale, timezone, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $6)
ON CONFLICT (id) DO UPDATE
SET auth_provider = EXCLUDED.auth_provider,
    auth_subject = EXCLUDED.auth_subject,
    locale = EXCLUDED.locale,
    timezone = EXCLUDED.timezone,
    updated_at = EXCLUDED.updated_at
RETURNING id, auth_provider, auth_subject, locale, timezone, created_at, updated_at
`,
      [input.id, input.authProvider, input.authSubject, input.locale, input.timezone, input.now]
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert API user.");
    }

    return mapUserRow(row);
  },

  findUserById: async (userId: UserId): Promise<ApiUserRecord | null> => {
    const result = await client.query<ApiUserRow>(
      `
SELECT id, auth_provider, auth_subject, locale, timezone, created_at, updated_at
FROM public.api_users
WHERE id = $1
`,
      [userId]
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  },

  upsertPet: async ({ pet }: UpsertPetProfileInput): Promise<PetProfile> => {
    const result = await client.query<PetRow>(
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
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    species = EXCLUDED.species,
    personality_tags = EXCLUDED.personality_tags,
    talking_style = EXCLUDED.talking_style,
    favorite_thing = EXCLUDED.favorite_thing,
    memory_note = EXCLUDED.memory_note,
    active_generation_job_id = EXCLUDED.active_generation_job_id,
    active_asset_id = EXCLUDED.active_asset_id,
    lifecycle_status = EXCLUDED.lifecycle_status,
    original_photo_deleted_at = EXCLUDED.original_photo_deleted_at,
    updated_at = EXCLUDED.updated_at
RETURNING
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
`,
      [
        pet.id,
        pet.userId,
        pet.name,
        pet.species,
        JSON.stringify(pet.personalityTags),
        pet.talkingStyle,
        pet.favoriteThing ?? null,
        pet.memoryNote ?? null,
        pet.activeGenerationJobId ?? null,
        pet.activeAssetId ?? null,
        pet.lifecycleStatus,
        pet.originalPhotoDeletedAt ?? null,
        pet.createdAt,
        pet.updatedAt
      ]
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert pet profile.");
    }

    return mapPetRow(row);
  },

  listLivePetsByUserId: async (userId: UserId): Promise<PetProfile[]> => {
    const result = await client.query<PetRow>(
      `
SELECT
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
FROM public.pets
WHERE ${livePetWhere}
ORDER BY created_at ASC, id ASC
`,
      [userId]
    );

    return result.rows.map(mapPetRow);
  },

  findOwnedLivePet: async (userId: UserId, petId: PetId): Promise<PetProfile | null> => {
    const result = await client.query<PetRow>(
      `
SELECT
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
FROM public.pets
WHERE id = $2 AND ${livePetWhere}
`,
      [userId, petId]
    );

    return result.rows[0] ? mapPetRow(result.rows[0]) : null;
  },

  softDeletePet: async (userId: UserId, petId: PetId, deletedAt: ISODateTime): Promise<boolean> => {
    const result = await client.query<{ id: string }>(
      `
UPDATE public.pets
SET lifecycle_status = 'deleted',
    updated_at = $3
WHERE id = $2 AND ${livePetWhere}
RETURNING id
`,
      [userId, petId, deletedAt]
    );

    return result.rows.length > 0;
  },

  getCurrentUserOnboardingState: async (
    userId: UserId,
    locale: Locale,
    timezone: string
  ): Promise<Omit<CurrentUserResponse, "wallet">> => {
    const result = await client.query<OnboardingStateRow>(
      `
SELECT
  COUNT(*) FILTER (WHERE p.lifecycle_status <> 'deleted') AS live_pet_count,
  COUNT(*) FILTER (WHERE p.lifecycle_status = 'active' AND p.active_asset_id IS NOT NULL) AS active_pet_count,
  (
    SELECT COUNT(*)
    FROM public.generation_jobs gj
    WHERE gj.user_id = $1
      AND gj.status NOT IN ('completed', 'failed', 'cancelled', 'expired')
  ) AS active_generation_count
FROM public.pets p
WHERE p.user_id = $1
`,
      [userId]
    );
    const row = result.rows[0];
    const livePetCount = numberFromCount(row?.live_pet_count);
    const activePetCount = numberFromCount(row?.active_pet_count);
    const activeGenerationCount = numberFromCount(row?.active_generation_count);
    const onboardingState: CurrentUserResponse["onboardingState"] =
      activePetCount > 0
        ? "pet_active"
        : activeGenerationCount > 0
          ? "generation_started"
          : livePetCount > 0
            ? "pet_created"
            : "new";

    return {
      userId,
      locale,
      timezone,
      onboardingState
    };
  }
});
