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
// Security-critical deletion order (see accountDeletionWorkflow.ts):
//
//   1. Snapshot per-table row counts for the caller, purely for the summary
//      returned to the client -- best-effort, never blocks the rest of the
//      flow.
//   2. Recursively delete `original-photos/{user_id}/` and
//      `avatars/{user_id}/` from the private `pet-media` bucket. Both must
//      succeed before the workflow can continue, otherwise the live auth
//      session is preserved so a later request can retry safely.
//   3. Delete the auth user via admin.auth.admin.deleteUser only after both
//      storage prefixes succeed. This is the
//      step that actually removes every row in CASCADED_TABLES below --
//      every one of those tables' `user_id` column is declared
//      `REFERENCES auth.users(id) ON DELETE CASCADE` (verified by reading
//      supabase/migrations/0001_init.sql, 0002_rate_limit.sql,
//      0004_credit_ledger.sql, and 0005_pet_namespace.sql -- see
//      CASCADED_TABLES' doc comment below), so Postgres cascades the delete
//      automatically. No separate per-table DELETE statement is needed (or
//      issued) for correctness; step 1's counts are read-only.
//
// The whole flow is idempotent and retryable: re-invoking after a failed
// step 2 or 3 simply re-attempts whatever didn't finish (an
// already-empty storage prefix lists zero entries and is a no-op; an
// already-deleted auth user makes THIS function's own auth check at the top
// fail with 401, which the client is expected to treat as "already gone,
// nothing left to retry" -- see apps/mobile's supabaseAccountDeletion.ts).
//
// Response contract: success is HTTP 200; retryable storage/auth failures
// are HTTP 503 with a stable non-sensitive error code.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runAccountDeletionWorkflow } from "./accountDeletionWorkflow.ts";
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

type DeleteAccountSummary = {
  readonly userId: string;
  readonly storage: {
    readonly originalPhotos: RecursiveDeleteOutcome;
    readonly avatars: RecursiveDeleteOutcome;
  };
  // Pre-deletion row counts, read for diagnostics only -- see CASCADED_TABLES
  // doc comment. `null` for a table means the count query itself failed
  // (logged server-side); it does not mean the table was skipped.
  readonly tableCounts: Readonly<Record<CascadedTable, number | null>>;
  readonly authUserDeleted: boolean;
  readonly authDeleteError: string | null;
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const urlForFetchInput = (input: Parameters<typeof fetch>[0]): string => {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return input;
};

const createAdminDeleteResponseDrainingFetch = (adminDeleteUrl: string): typeof fetch =>
  async (input, init) => {
    const response = await fetch(input, init);

    if (urlForFetchInput(input) === adminDeleteUrl && response.status >= 500 && response.status <= 599) {
      // auth-js takes its retryable 5xx path without reading the body. Drain a
      // clone so the original response remains readable to the SDK while Deno
      // can release the underlying fetch resource before the typed error returns.
      await response.clone().arrayBuffer();
    }

    return response;
  };

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
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userId = userData.user.id;

  const adminDeleteUrl = new URL(`/auth/v1/admin/users/${userId}`, supabaseUrl).toString();
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    global: { fetch: createAdminDeleteResponseDrainingFetch(adminDeleteUrl) },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 2. Pre-deletion table row counts, for the response summary only -- see
  // CASCADED_TABLES' doc comment. Run concurrently since these are
  // independent reads.
  const tableCountEntries = await Promise.all(
    CASCADED_TABLES.map(async (table): Promise<[CascadedTable, number | null]> => [table, await countRowsForUser(admin, table, userId)])
  );
  const tableCounts = Object.fromEntries(tableCountEntries) as Record<CascadedTable, number | null>;

  const storageBucket = admin.storage.from(BUCKET);
  const deletion = await runAccountDeletionWorkflow({
    deleteOriginalPhotos: () => deleteStoragePrefixRecursive(storageBucket, originalPhotosPrefixFor(userId)),
    deleteAvatars: () => deleteStoragePrefixRecursive(storageBucket, avatarsPrefixFor(userId)),
    deleteAuthUser: async () => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      return error ? { ok: false } : { ok: true };
    }
  });

  if (!deletion.ok) {
    return jsonResponse({ ok: false, error: { code: deletion.code, retryable: deletion.retryable } }, 503);
  }

  const summary: DeleteAccountSummary = {
    userId,
    storage: {
      originalPhotos: deletion.storage.originalPhotos,
      avatars: deletion.storage.avatars
    },
    tableCounts,
    authUserDeleted: true,
    authDeleteError: null
  };

  return jsonResponse({ ok: true, summary }, 200);
});
