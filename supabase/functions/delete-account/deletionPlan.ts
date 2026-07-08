// Pure storage-deletion logic for the delete-account Edge Function (see
// index.ts). Split out from index.ts the same way chromakey.ts is split out
// from generate-avatar/index.ts: this file has zero npm: imports and never
// touches Deno.serve, so `deno test deletionPlan_test.ts` can exercise it
// directly without spinning up an HTTP listener or a real Supabase project.
//
// Storage layout (see supabase/migrations/0001_init.sql and
// 0005_pet_namespace.sql): a user's objects in the private `pet-media`
// bucket live under two top-level prefixes --
//   original-photos/{user_id}/{...}
//   avatars/{user_id}/{job_id}/{state}.png
//     (or, pet-namespaced: avatars/{user_id}/{pet_id}/{job_id}/{state}.png)
// Both are recursively deleted here. Neither prefix is covered by the
// auth.users FK cascade that every Postgres table in this project uses (see
// index.ts's CASCADED_TABLES doc comment) -- Supabase Storage objects are
// not foreign-keyed to auth.users, so deleting the auth user never touches
// them. Explicit recursive deletion is the only way to actually remove them.

// ---------------------------------------------------------------------------
// Storage client shape
//
// Deliberately a narrow structural subset of @supabase/storage-js's
// StorageFileApi (list/remove) rather than importing the real type, so this
// module stays npm:-import-free (see module doc comment above) and the test
// file can pass in a trivial in-memory fake.
// ---------------------------------------------------------------------------

/**
 * Mirrors @supabase/storage-js's FileObject shape closely enough for our
 * purposes: `id` is null for a folder placeholder entry and a real string
 * for an actual file (confirmed against node_modules/@supabase/storage-js's
 * FileObject type doc comment: "Unique identifier for the file (null for
 * folders)", and its StorageFileApi.list() usage example, which branches on
 * exactly this field the same way deleteStoragePrefixRecursive below does).
 */
export interface StorageEntry {
  name: string;
  id: string | null;
}

export interface StorageListResult {
  data: StorageEntry[] | null;
  error: { message: string } | null;
}

export interface StorageRemoveResult {
  data: unknown;
  error: { message: string } | null;
}

export interface StorageBucketLike {
  list(path: string, options?: { limit?: number; offset?: number }): Promise<StorageListResult>;
  remove(paths: string[]): Promise<StorageRemoveResult>;
}

// Matches @supabase/storage-js's own list() page size default (see
// DEFAULT_SEARCH_OPTIONS in node_modules/@supabase/storage-js's
// StorageFileApi.ts) -- kept explicit here rather than omitted so pagination
// below is correct regardless of what the client library's own default
// happens to be.
const LIST_PAGE_SIZE = 100;

// Caps how many paths go into a single remove() call. A user's pet-media
// footprint is small in practice (one source photo at a time, a handful of
// generated states per job), so this is defense-in-depth against a
// pathological case rather than something expected to ever trigger.
const REMOVE_BATCH_SIZE = 100;

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const listAllEntries = async (
  storage: StorageBucketLike,
  prefix: string
): Promise<{ entries: StorageEntry[]; error: string | null }> => {
  const entries: StorageEntry[] = [];
  let offset = 0;

  // Loop until a page comes back short of LIST_PAGE_SIZE (the standard
  // "that was the last page" signal), rather than relying on a total count
  // up front -- list() doesn't report one.
  for (;;) {
    const { data, error } = await storage.list(prefix, { limit: LIST_PAGE_SIZE, offset });

    if (error) {
      return { entries, error: error.message };
    }

    if (!data || data.length === 0) {
      break;
    }

    entries.push(...data);

    if (data.length < LIST_PAGE_SIZE) {
      break;
    }

    offset += LIST_PAGE_SIZE;
  }

  return { entries, error: null };
};

export interface RecursiveDeleteOutcome {
  deletedCount: number;
  errors: string[];
}

/**
 * Recursively deletes every object under `prefix` (a "folder", in Supabase
 * Storage's list()-based sense -- see StorageEntry's doc comment). Best-
 * effort throughout: a list() or remove() failure at any level is recorded
 * in `errors` and the walk continues into sibling entries rather than
 * aborting, so one bad path segment can't hide the rest of the user's data
 * from deletion. Idempotent -- an already-empty (or nonexistent) prefix
 * simply lists zero entries and returns `{ deletedCount: 0, errors: [] }`,
 * so a retried call after a partial failure is always safe to re-run.
 */
export const deleteStoragePrefixRecursive = async (
  storage: StorageBucketLike,
  prefix: string
): Promise<RecursiveDeleteOutcome> => {
  const normalizedPrefix = prefix.replace(/\/+$/, "");
  const { entries, error } = await listAllEntries(storage, normalizedPrefix);
  const errors: string[] = [];

  if (error) {
    errors.push(`list "${normalizedPrefix}" failed: ${error}`);
    return { deletedCount: 0, errors };
  }

  let deletedCount = 0;
  const filePaths: string[] = [];

  for (const entry of entries) {
    const entryPath = `${normalizedPrefix}/${entry.name}`;

    if (entry.id === null) {
      // Folder placeholder -- recurse into it. Its own files are removed
      // (and counted) inside the recursive call, not here.
      const nested = await deleteStoragePrefixRecursive(storage, entryPath);
      deletedCount += nested.deletedCount;
      errors.push(...nested.errors);
    } else {
      filePaths.push(entryPath);
    }
  }

  for (const batch of chunk(filePaths, REMOVE_BATCH_SIZE)) {
    const { error: removeError } = await storage.remove(batch);

    if (removeError) {
      errors.push(`remove under "${normalizedPrefix}" failed: ${removeError.message}`);
    } else {
      deletedCount += batch.length;
    }
  }

  return { deletedCount, errors };
};

/** Storage prefix for a user's uploaded source photos -- see 0001_init.sql. */
export const originalPhotosPrefixFor = (userId: string): string => `original-photos/${userId}`;

/** Storage prefix for a user's generated avatar assets -- see 0001_init.sql/0005_pet_namespace.sql. */
export const avatarsPrefixFor = (userId: string): string => `avatars/${userId}`;
