import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersistedSessionEnvelope } from "@mongchi/shared";

import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { reporter } from "../../shared/errors/reporter";

/**
 * Account recovery stack, package B: the transport half of server-side
 * session snapshots. packages/shared/src/session/sessionSnapshot.ts (package
 * A) owns building/parsing the envelope; this module only owns getting that
 * envelope to and from `public.session_snapshots` via the
 * `upsert_session_snapshot` RPC and a direct table select (see
 * supabase/migrations/0025_session_snapshots.sql). Never throws -- same
 * try/catch shield as supabaseAccountLinkSession.ts, so callers only ever
 * branch on `ok`.
 */

const sessionSnapshotTimeoutMs = 20_000;

export interface UploadSessionSnapshotInput {
  readonly envelope: PersistedSessionEnvelope;
  readonly clientUpdatedAt: string;
}

export type UploadSessionSnapshotResult =
  | { readonly ok: true; readonly outcome: "saved" | "stale" | "too_large" }
  | { readonly ok: false; readonly reason: "request_failed" };

interface UpsertSessionSnapshotRpcRow {
  outcome: "saved" | "stale" | "too_large";
}

const isUpsertSessionSnapshotRpcRow = (value: unknown): value is UpsertSessionSnapshotRpcRow => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const outcome = (value as Partial<UpsertSessionSnapshotRpcRow>).outcome;

  return outcome === "saved" || outcome === "stale" || outcome === "too_large";
};

/**
 * Uploads the given envelope as this user's single server-side snapshot row.
 * `p_payload` carries the *whole* envelope (schemaVersion + state), not just
 * `state` -- parseSessionSnapshotEnvelope's download-side counterpart feeds
 * the stored payload straight back into the same parse -> migrate -> validate
 * pipeline a local backup restore uses, and that pipeline's entry point
 * expects the envelope shape. `outcome: 'stale'` and `'too_large'` are
 * ordinary, non-alarming results (see the migration's header comment) -- a
 * caller's autosave flow can treat both as "did not save this time" without
 * surfacing an error.
 */
export const uploadSessionSnapshot = async (
  client: SupabaseClient,
  input: UploadSessionSnapshotInput
): Promise<UploadSessionSnapshotResult> => {
  try {
    const response = await withRequestTimeout(
      client.rpc("upsert_session_snapshot", {
        p_schema_version: input.envelope.schemaVersion,
        p_payload: input.envelope,
        p_client_updated_at: input.clientUpdatedAt
      }),
      sessionSnapshotTimeoutMs
    );

    if (response.error || !isUpsertSessionSnapshotRpcRow(response.data)) {
      return { ok: false, reason: "request_failed" };
    }

    return { ok: true, outcome: response.data.outcome };
  } catch (cause) {
    reporter.captureMessage("account: session snapshot upload threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, reason: "request_failed" };
  }
};

export interface DownloadedSessionSnapshot {
  readonly schemaVersion: number;
  readonly payload: unknown;
  readonly clientUpdatedAt: string;
}

export type DownloadSessionSnapshotResult =
  | { readonly ok: true; readonly snapshot: DownloadedSessionSnapshot | null }
  | { readonly ok: false; readonly reason: "request_failed" };

interface SessionSnapshotRow {
  schema_version: number;
  payload: unknown;
  client_updated_at: string;
}

const isSessionSnapshotRow = (value: unknown): value is SessionSnapshotRow => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Partial<SessionSnapshotRow>;

  return typeof row.schema_version === "number" && typeof row.client_updated_at === "string" && "payload" in row;
};

/**
 * Reads this user's server-side session snapshot back, or `snapshot: null`
 * if none has ever been saved (a brand-new account, or an account that
 * linked/recovered but never uploaded) -- `.maybeSingle()` distinguishes "no
 * row" from "query failed" so the caller can tell a fresh account apart from
 * a transient error. Returns the raw `payload` unparsed -- callers are
 * expected to run it through
 * packages/shared/src/session/sessionSnapshot.ts's
 * parseSessionSnapshotEnvelope, the same way a local backup restore does.
 */
export const downloadSessionSnapshot = async (client: SupabaseClient): Promise<DownloadSessionSnapshotResult> => {
  try {
    const response = await withRequestTimeout(
      client.from("session_snapshots").select("schema_version, payload, client_updated_at").maybeSingle(),
      sessionSnapshotTimeoutMs
    );

    if (response.error) {
      return { ok: false, reason: "request_failed" };
    }

    if (!response.data) {
      return { ok: true, snapshot: null };
    }

    if (!isSessionSnapshotRow(response.data)) {
      return { ok: false, reason: "request_failed" };
    }

    return {
      ok: true,
      snapshot: {
        schemaVersion: response.data.schema_version,
        payload: response.data.payload,
        clientUpdatedAt: response.data.client_updated_at
      }
    };
  } catch (cause) {
    reporter.captureMessage("account: session snapshot download threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, reason: "request_failed" };
  }
};
