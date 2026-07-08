// Unit tests for the pure storage-deletion logic in deletionPlan.ts.
//
// Uses a small in-memory fake of the Supabase Storage list()/remove() shape
// (see StorageBucketLike) instead of a real bucket -- there is no local
// Supabase/Docker available in this environment, and the goal here is to
// pin down deleteStoragePrefixRecursive's own control flow (pagination,
// folder-vs-file discrimination, error propagation, idempotency), not
// Supabase Storage's server behavior. Run with: deno test deletionPlan_test.ts
//
// Mirrors chromakey_test.ts's pattern of testing pure logic in isolation
// from index.ts, so this never triggers index.ts's top-level Deno.serve(...).

import { assertEquals } from "jsr:@std/assert@1";
import {
  avatarsPrefixFor,
  deleteStoragePrefixRecursive,
  originalPhotosPrefixFor
} from "./deletionPlan.ts";
import type { StorageBucketLike, StorageEntry } from "./deletionPlan.ts";

/**
 * In-memory fake bucket: `files` is a flat set of full object paths (e.g.
 * "avatars/user1/job1/idle.png"). list(prefix) synthesizes the same
 * file-vs-folder shape Supabase Storage's real list() returns (id === null
 * for a folder placeholder, a string id for a file) by looking at what's
 * immediately under `prefix` among the flat path set -- exactly how the
 * real bucket's list() is documented to behave (see deletionPlan.ts's
 * StorageEntry doc comment).
 */
const createFakeBucket = (
  initialFiles: string[],
  options?: { listError?: string; removeError?: string; pageSize?: number }
): { bucket: StorageBucketLike; files: Set<string>; listCalls: string[]; removeCalls: string[][] } => {
  const files = new Set(initialFiles);
  const listCalls: string[] = [];
  const removeCalls: string[][] = [];
  const pageSize = options?.pageSize;

  const bucket: StorageBucketLike = {
    list: (path: string, listOptions) => {
      listCalls.push(path);

      if (options?.listError) {
        return Promise.resolve({ data: null, error: { message: options.listError } });
      }

      const normalizedPath = path.replace(/\/+$/, "");
      const childNames = new Map<string, boolean>(); // name -> isFile

      for (const filePath of files) {
        if (!filePath.startsWith(`${normalizedPath}/`)) {
          continue;
        }

        const rest = filePath.slice(normalizedPath.length + 1);
        const slashIndex = rest.indexOf("/");

        if (slashIndex === -1) {
          childNames.set(rest, true);
        } else {
          childNames.set(rest.slice(0, slashIndex), false);
        }
      }

      const allEntries: StorageEntry[] = Array.from(childNames.entries()).map(([name, isFile]) => ({
        name,
        id: isFile ? `id-${normalizedPath}/${name}` : null
      }));
      // Stable order so pagination slicing below is deterministic.
      allEntries.sort((a, b) => a.name.localeCompare(b.name));

      const limit = listOptions?.limit ?? pageSize ?? allEntries.length;
      const offset = listOptions?.offset ?? 0;

      return Promise.resolve({ data: allEntries.slice(offset, offset + limit), error: null });
    },
    remove: (paths: string[]) => {
      removeCalls.push(paths);

      if (options?.removeError) {
        return Promise.resolve({ data: null, error: { message: options.removeError } });
      }

      for (const path of paths) {
        files.delete(path);
      }

      return Promise.resolve({ data: paths.map((name) => ({ name, id: `removed-${name}` })), error: null });
    }
  };

  return { bucket, files, listCalls, removeCalls };
};

Deno.test("originalPhotosPrefixFor / avatarsPrefixFor build the documented storage prefixes", () => {
  assertEquals(originalPhotosPrefixFor("user-1"), "original-photos/user-1");
  assertEquals(avatarsPrefixFor("user-1"), "avatars/user-1");
});

Deno.test("deleteStoragePrefixRecursive: empty prefix deletes nothing and reports no errors", async () => {
  const { bucket, removeCalls } = createFakeBucket([]);

  const outcome = await deleteStoragePrefixRecursive(bucket, "original-photos/user-1");

  assertEquals(outcome, { deletedCount: 0, errors: [] });
  assertEquals(removeCalls.length, 0);
});

Deno.test("deleteStoragePrefixRecursive: deletes flat files directly under the prefix (original-photos layout)", async () => {
  const { bucket, files } = createFakeBucket([
    "original-photos/user-1/photo-abc.jpg",
    "original-photos/user-1/photo-def.jpg",
    // A different user's file must never be touched.
    "original-photos/user-2/photo-xyz.jpg"
  ]);

  const outcome = await deleteStoragePrefixRecursive(bucket, "original-photos/user-1");

  assertEquals(outcome, { deletedCount: 2, errors: [] });
  assertEquals(Array.from(files).sort(), ["original-photos/user-2/photo-xyz.jpg"]);
});

Deno.test("deleteStoragePrefixRecursive: recurses through nested job/state folders (legacy avatars layout)", async () => {
  const { bucket, files } = createFakeBucket([
    "avatars/user-1/job-1/idle.png",
    "avatars/user-1/job-1/happy.png",
    "avatars/user-1/job-2/idle.png"
  ]);

  const outcome = await deleteStoragePrefixRecursive(bucket, "avatars/user-1");

  assertEquals(outcome, { deletedCount: 3, errors: [] });
  assertEquals(files.size, 0);
});

Deno.test("deleteStoragePrefixRecursive: recurses through pet-namespaced job/state folders (0005_pet_namespace.sql layout)", async () => {
  const { bucket, files } = createFakeBucket([
    "avatars/user-1/pet-a/job-1/idle.png",
    "avatars/user-1/pet-a/job-1/happy.png",
    "avatars/user-1/pet-b/job-2/idle.png"
  ]);

  const outcome = await deleteStoragePrefixRecursive(bucket, "avatars/user-1");

  assertEquals(outcome, { deletedCount: 3, errors: [] });
  assertEquals(files.size, 0);
});

Deno.test("deleteStoragePrefixRecursive: paginates past a single list() page", async () => {
  const manyFiles = Array.from({ length: 245 }, (_, index) => `original-photos/user-1/photo-${String(index).padStart(4, "0")}.jpg`);
  const { bucket, files } = createFakeBucket(manyFiles, { pageSize: 100 });

  const outcome = await deleteStoragePrefixRecursive(bucket, "original-photos/user-1");

  assertEquals(outcome.deletedCount, 245);
  assertEquals(outcome.errors, []);
  assertEquals(files.size, 0);
});

Deno.test("deleteStoragePrefixRecursive: a list() failure is recorded and stops that branch without throwing", async () => {
  const { bucket } = createFakeBucket([], { listError: "storage unavailable" });

  const outcome = await deleteStoragePrefixRecursive(bucket, "avatars/user-1");

  assertEquals(outcome.deletedCount, 0);
  assertEquals(outcome.errors.length, 1);
  assertEquals(outcome.errors[0]!.includes("storage unavailable"), true);
});

Deno.test("deleteStoragePrefixRecursive: a remove() failure at one branch does not block a sibling branch's deletion", async () => {
  const { bucket, files } = createFakeBucket(["avatars/user-1/job-1/idle.png", "avatars/user-1/job-2/idle.png"]);

  const realRemove = bucket.remove;
  let call = 0;
  bucket.remove = (paths: string[]) => {
    call += 1;

    if (call === 1) {
      return Promise.resolve({ data: null, error: { message: "remove failed" } });
    }

    return realRemove(paths);
  };

  const outcome = await deleteStoragePrefixRecursive(bucket, "avatars/user-1");

  // One of the two job folders failed to remove; the other still succeeded.
  assertEquals(outcome.deletedCount, 1);
  assertEquals(outcome.errors.length, 1);
  assertEquals(files.size, 1);
});

Deno.test("deleteStoragePrefixRecursive: is idempotent -- a second run against an already-cleared prefix is a clean no-op", async () => {
  const { bucket } = createFakeBucket(["original-photos/user-1/photo-abc.jpg"]);

  const first = await deleteStoragePrefixRecursive(bucket, "original-photos/user-1");
  assertEquals(first, { deletedCount: 1, errors: [] });

  const second = await deleteStoragePrefixRecursive(bucket, "original-photos/user-1");
  assertEquals(second, { deletedCount: 0, errors: [] });
});

Deno.test("deleteStoragePrefixRecursive: tolerates a trailing slash on the prefix", async () => {
  const { bucket, files } = createFakeBucket(["original-photos/user-1/photo-abc.jpg"]);

  const outcome = await deleteStoragePrefixRecursive(bucket, "original-photos/user-1/");

  assertEquals(outcome, { deletedCount: 1, errors: [] });
  assertEquals(files.size, 0);
});
