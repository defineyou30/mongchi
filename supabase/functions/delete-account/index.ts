// Mongchi delete-account Edge Function.
//
// Closes docs/readiness-diagnosis.md's "서버 측 데이터 삭제 경로가 프로덕션
// 구성에서 도달 불가" high-priority gap: before this function existed,
// Settings' "Delete pet data (Reset)" only wiped the local AsyncStorage
// session -- every server-side trace (uploaded/generated images in the
// pet-media bucket, generation_jobs/generated_assets/generation_quota/
// generation_rate_limits/credit_wallets/credit_ledger/pet_slots rows, and
// the anonymous auth user itself) survived indefinitely. That fails both
// Apple's account-deletion requirement and GDPR/CCPA's right to erasure.
//
// Auth pattern mirrors generate-avatar/index.ts exactly: the caller's JWT
// (anon key + Bearer token) identifies the user via a short-lived
// `authClient`, then a separate service_role `admin` client does the actual
// privileged work.
//
// Deletion plan (see deletionPlan.ts for the storage half's pure logic):
//
//   1. Snapshot per-table row counts for the caller, purely for the summary
//      returned to the client -- best-effort, never blocks the rest of the
//      flow.
//   2. Recursively delete `original-photos/{user_id}/` and
//      `avatars/{user_id}/` from the private `pet-media` bucket. Best-effort:
//      a failure here is recorded in the response but never aborts the
//      remaining steps (a user's photo/avatar data being stuck is not a
//      reason to also leave their auth account and table rows behind).
//   3. Delete the auth user via admin.auth.admin.deleteUser. This is the
//      step that actually removes every row in CASCADED_TABLES below --
//      every one of those tables' `user_id` column is declared
//      `REFERENCES auth.users(id) ON DELETE CASCADE` (verified by reading
//      supabase/migrations/0001_init.sql, 0002_rate_limit.sql,
//      0004_credit_ledger.sql, and 0005_pet_namespace.sql -- see
//      CASCADED_TABLES' doc comment below), so Postgres cascades the delete
//      automatically. No separate per-table DELETE statement is needed (or
//      issued) for correctness; step 1's counts are read-only.
//
// The whole flow is idempotent and tolerant of partial failure: re-invoking
// after a failed step 2 or 3 simply re-attempts whatever didn't finish (an
// already-empty storage prefix lists zero entries and is a no-op; an
// already-deleted auth user makes THIS function's own auth check at the top
// fail with 401, which the client is expected to treat as "already gone,
// nothing left to retry" -- see apps/mobile's supabaseAccountDeletion.ts).
//
// Response contract: once the caller is authenticated, this always answers
// 200 with `{ ok, summary }` -- `ok` is true only when every step fully
// succeeded; a partial failure is reported in `summary` rather than as an
// HTTP error status, so the client can always read what happened instead of
// just "the request failed". See docs/legal/privacy-policy.md §8.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { avatarsPrefixFor, deleteStoragePrefixRecursive, originalPhotosPrefixFor } from "./deletionPlan.ts";
import type { RecursiveDeleteOutcome } from "./deletionPlan.ts";

const BUCKET = "pet-media";

// Every one of these tables has a `user_id UUID REFERENCES auth.users(id)
// ON DELETE CASCADE` column (see the migration files named alongside each
// entry below), so admin.auth.admin.deleteUser(userId) below deletes every
// row here automatically at the Postgres level. Listed here only so step 1
// can read pre-deletion counts for the response summary -- this array never
// drives a DELETE statement.
const CASCADED_TABLES = [
  "generation_jobs", // 0001_init.sql
  "generated_assets", // 0001_init.sql (also job_id -> generation_jobs ON DELETE CASCADE)
  "generation_quota", // 0001_init.sql
  "generation_rate_limits", // 0002_rate_limit.sql
  "credit_wallets", // 0004_credit_ledger.sql
  "credit_ledger", // 0004_credit_ledger.sql
  "pet_slots", // 0005_pet_namespace.sql
  "conversations", // 0006_conversations.sql (conversation_messages cascade from conversation_id -> conversations)
  "conversation_messages" // 0006_conversations.sql (also user_id -> auth.users ON DELETE CASCADE)
] as const;

type CascadedTable = (typeof CASCADED_TABLES)[number];

interface DeleteAccountSummary {
  userId: string;
  storage: {
    originalPhotos: RecursiveDeleteOutcome;
    avatars: RecursiveDeleteOutcome;
  };
  // Pre-deletion row counts, read for diagnostics only -- see CASCADED_TABLES
  // doc comment. `null` for a table means the count query itself failed
  // (logged server-side); it does not mean the table was skipped.
  tableCounts: Record<CascadedTable, number | null>;
  authUserDeleted: boolean;
  authDeleteError: string | null;
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const countRowsForUser = async (admin: SupabaseClient, table: CascadedTable, userId: string): Promise<number | null> => {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);

  if (error) {
    console.error(`[delete-account] row count failed for ${table}:`, error.message);
    return null;
  }

  return count ?? 0;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  // 1. Identify the caller (including anonymous auth users) from their JWT.
  // Mirrors generate-avatar/index.ts's HTTP handler exactly.
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  // 2. Pre-deletion table row counts, for the response summary only -- see
  // CASCADED_TABLES' doc comment. Run concurrently since these are
  // independent reads.
  const tableCountEntries = await Promise.all(
    CASCADED_TABLES.map(async (table): Promise<[CascadedTable, number | null]> => [table, await countRowsForUser(admin, table, userId)])
  );
  const tableCounts = Object.fromEntries(tableCountEntries) as Record<CascadedTable, number | null>;

  // 3. Storage: recursively delete both prefixes. Best-effort -- a failure
  // here is recorded but never blocks step 4 below (see module doc comment).
  const storageBucket = admin.storage.from(BUCKET);
  const originalPhotosOutcome = await deleteStoragePrefixRecursive(storageBucket, originalPhotosPrefixFor(userId));
  const avatarsOutcome = await deleteStoragePrefixRecursive(storageBucket, avatarsPrefixFor(userId));

  // 4. Delete the auth user. Cascades every CASCADED_TABLES row via FK
  // ON DELETE CASCADE (see module doc comment) -- this is the step that
  // actually removes them, not step 2 above.
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  const authUserDeleted = !deleteUserError;

  if (deleteUserError) {
    console.error("[delete-account] admin.auth.admin.deleteUser failed:", deleteUserError.message);
  }

  const storageErrors = [...originalPhotosOutcome.errors, ...avatarsOutcome.errors];
  const ok = authUserDeleted && storageErrors.length === 0;

  const summary: DeleteAccountSummary = {
    userId,
    storage: {
      originalPhotos: originalPhotosOutcome,
      avatars: avatarsOutcome
    },
    tableCounts,
    authUserDeleted,
    authDeleteError: deleteUserError?.message ?? null
  };

  // Always 200 past this point -- see module doc comment's "Response
  // contract" section. The client reads `ok`/`summary` to decide how to
  // react, rather than branching on HTTP status.
  return jsonResponse({ ok, summary }, 200);
});
