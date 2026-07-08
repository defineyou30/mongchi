import type { SupabaseClient } from "@supabase/supabase-js";

export type DeleteSupabaseAccountResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "network_or_server_error" };

/**
 * Calls the `delete-account` Edge Function (supabase/functions/delete-account)
 * to erase every server-side trace of the caller's anonymous account: the
 * pet-media storage folders (original-photos/{userId}/, avatars/{userId}/),
 * every generation_jobs/generated_assets/generation_quota/
 * generation_rate_limits/credit_wallets/credit_ledger/pet_slots row scoped
 * to this user (all FK `ON DELETE CASCADE` off auth.users -- see
 * supabase/migrations/0001_init.sql, 0002_rate_limit.sql,
 * 0004_credit_ledger.sql, 0005_pet_namespace.sql), and finally the
 * anonymous auth user itself. See docs/readiness-diagnosis.md's "서버 측
 * 데이터 삭제 경로" gap for why this exists.
 *
 * Caller contract: only invoke this when a Supabase session already exists
 * (see TerrariumSessionProvider.tsx's resetSession, the only caller today)
 * -- this function never signs the caller in.
 *
 * Result reasons, and how callers are expected to react (see resetSession's
 * doc comment for the actual branching):
 *   - "unauthorized" (HTTP 401): the caller's JWT no longer identifies a
 *     live account -- either it was already deleted by a prior attempt
 *     whose response never made it back to this device, or the session is
 *     otherwise stale. There is nothing left to retry; safe to drop the
 *     local session too.
 *   - "network_or_server_error": offline, a 5xx, an unexpected thrown
 *     error, or a 200 response whose body reports a partial server-side
 *     failure (see delete-account/index.ts's `{ ok, summary }` contract).
 *     A genuine "try again later" case -- the local Supabase session should
 *     be kept so a later retry can still reach the same account.
 */
export const deleteSupabaseAccountData = async (client: SupabaseClient): Promise<DeleteSupabaseAccountResult> => {
  try {
    const invoked = await client.functions.invoke("delete-account", { body: {} });

    if (invoked.error) {
      const context = (invoked.error as { context?: { status?: number } }).context;
      const status = context?.status ?? 0;

      if (status === 401) {
        return { ok: false, reason: "unauthorized" };
      }

      return { ok: false, reason: "network_or_server_error" };
    }

    const body = invoked.data as { ok?: boolean } | null;

    if (body?.ok !== true) {
      return { ok: false, reason: "network_or_server_error" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "network_or_server_error" };
  }
};
