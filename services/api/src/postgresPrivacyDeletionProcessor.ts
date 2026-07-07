import type { ISODateTime, PetId, UserId } from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { PrivateStorageObjectDeleter } from "./privateStorageDeletion";
import { uniqueStorageUris } from "./privateStorageDeletion";
import type { PrivacyDeletionProcessor, PrivacyDeletionProcessorResult } from "./privacyDeletionWorker";

export interface PostgresPrivacyDeletionProcessorOptions {
  client: ApiDatabaseMigrationClient;
  privateStorageDeleter?: PrivateStorageObjectDeleter;
  now?: () => ISODateTime;
  logger?: PrivacyDeletionProcessorLogger;
}

export interface PrivacyDeletionProcessorLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

interface StorageUriRow {
  storage_uri: string | null;
  thumbnail_uri?: string | null;
}

interface DeletedIdRow {
  id: string;
}

const DEFAULT_NOW = "2026-06-24T09:00:00.000Z";

const ok = (): PrivacyDeletionProcessorResult => ({ ok: true });

const fail = (
  failureCode: string,
  failureMessageSafe = "Privacy deletion is queued for retry."
): PrivacyDeletionProcessorResult => ({
  ok: false,
  failureCode,
  failureMessageSafe
});

export const createPostgresPrivacyDeletionProcessor = ({
  client,
  privateStorageDeleter,
  now = () => DEFAULT_NOW,
  logger
}: PostgresPrivacyDeletionProcessorOptions): PrivacyDeletionProcessor => {
  const emit = (level: "info" | "error", event: string, metadata: Record<string, unknown>): void => {
    try {
      logger?.[level]?.(event, metadata);
    } catch {
      // Audit telemetry must never block privacy deletion progress.
    }
  };

  const deletePrivateStorageObjects = async (uris: readonly string[]): Promise<PrivacyDeletionProcessorResult> => {
    const uniqueUris = uniqueStorageUris(uris);

    if (uniqueUris.length === 0) {
      return ok();
    }

    if (!privateStorageDeleter) {
      return fail("storage_deletion_unavailable", "Private storage deletion is queued for retry.");
    }

    const result = await privateStorageDeleter.deleteObjects({ uris: uniqueUris });

    return result.ok ? ok() : fail(result.failureCode, result.failureMessageSafe);
  };

  const listOriginalPhotoStorageUris = async (userId: UserId, petId: PetId): Promise<string[]> => {
    const result = await client.query<StorageUriRow>(
      `
SELECT storage_uri
FROM public.original_photos
WHERE user_id = $1 AND pet_id = $2
ORDER BY created_at ASC, id ASC
`,
      [userId, petId]
    );

    return uniqueStorageUris(result.rows.map((row) => row.storage_uri));
  };

  const listGeneratedAssetStorageUris = async (userId: UserId, petId: PetId): Promise<string[]> => {
    const result = await client.query<StorageUriRow>(
      `
SELECT ga.storage_uri, ga.thumbnail_uri
FROM public.generated_assets ga
JOIN public.pets p ON p.id = ga.pet_id
WHERE p.user_id = $1 AND ga.pet_id = $2
ORDER BY ga.created_at ASC, ga.id ASC
`,
      [userId, petId]
    );

    return uniqueStorageUris(result.rows.flatMap((row) => [row.storage_uri, row.thumbnail_uri]));
  };

  return {
    deleteOriginalPhotos: async ({ job, petId }): Promise<PrivacyDeletionProcessorResult> => {
      const startedAt = Date.now();
      const storageUris = await listOriginalPhotoStorageUris(job.userId, petId);
      const storageDeletion = await deletePrivateStorageObjects(storageUris);

      if (!storageDeletion.ok) {
        emit("error", "privacy_deletion_processor_failed", {
          jobId: job.id,
          scope: job.scope,
          storageObjectCount: uniqueStorageUris(storageUris).length,
          durationMs: Math.max(0, Date.now() - startedAt),
          failureCode: storageDeletion.failureCode
        });

        return storageDeletion;
      }

      const deletedPhotos = await client.query<DeletedIdRow>(
        `
DELETE FROM public.original_photos
WHERE user_id = $1 AND pet_id = $2
RETURNING id
`,
        [job.userId, petId]
      );
      await client.query(
        `
UPDATE public.pets
SET original_photo_deleted_at = COALESCE(original_photo_deleted_at, $3),
    updated_at = $3
WHERE user_id = $1 AND id = $2
`,
        [job.userId, petId, now()]
      );
      emit("info", "privacy_deletion_processor_completed", {
        jobId: job.id,
        scope: job.scope,
        storageObjectCount: uniqueStorageUris(storageUris).length,
        deletedOriginalPhotoCount: deletedPhotos.rows.length,
        durationMs: Math.max(0, Date.now() - startedAt)
      });

      return ok();
    },

    deleteChatHistory: async ({ job }): Promise<PrivacyDeletionProcessorResult> => {
      const startedAt = Date.now();
      const deletedConversations = await client.query<DeletedIdRow>(
        `
DELETE FROM public.conversations
WHERE user_id = $1
RETURNING id
`,
        [job.userId]
      );
      emit("info", "privacy_deletion_processor_completed", {
        jobId: job.id,
        scope: job.scope,
        deletedConversationCount: deletedConversations.rows.length,
        durationMs: Math.max(0, Date.now() - startedAt)
      });

      return ok();
    },

    deletePet: async ({ job, petId }): Promise<PrivacyDeletionProcessorResult> => {
      const startedAt = Date.now();
      const [originalPhotoUris, generatedAssetUris] = await Promise.all([
        listOriginalPhotoStorageUris(job.userId, petId),
        listGeneratedAssetStorageUris(job.userId, petId)
      ]);
      const storageDeletion = await deletePrivateStorageObjects([...originalPhotoUris, ...generatedAssetUris]);

      if (!storageDeletion.ok) {
        emit("error", "privacy_deletion_processor_failed", {
          jobId: job.id,
          scope: job.scope,
          storageObjectCount: uniqueStorageUris([...originalPhotoUris, ...generatedAssetUris]).length,
          durationMs: Math.max(0, Date.now() - startedAt),
          failureCode: storageDeletion.failureCode
        });

        return storageDeletion;
      }

      const deletedPets = await client.query<DeletedIdRow>(
        `
DELETE FROM public.pets
WHERE user_id = $1 AND id = $2
RETURNING id
`,
        [job.userId, petId]
      );
      emit("info", "privacy_deletion_processor_completed", {
        jobId: job.id,
        scope: job.scope,
        storageObjectCount: uniqueStorageUris([...originalPhotoUris, ...generatedAssetUris]).length,
        deletedPetCount: deletedPets.rows.length,
        durationMs: Math.max(0, Date.now() - startedAt)
      });

      return ok();
    }
  };
};
