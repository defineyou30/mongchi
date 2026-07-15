import type { PrototypeSessionState } from "./prototypeSession";
import type { ParseSessionBackupResult } from "./sessionBackup";
import { parseSessionBackup } from "./sessionBackup";
import type { PersistedSessionEnvelope } from "./sessionMigrations";
import { createPersistedSessionEnvelope } from "./sessionMigrations";

/**
 * Server-side session snapshot (account recovery stack, package A). Reuses
 * `sessionBackup.ts`'s serialize/migrate/validate pipeline wholesale --
 * a snapshot is just a backup envelope that gets written to
 * `public.session_snapshots` via the `upsert_session_snapshot` RPC (see
 * supabase/migrations/0025_session_snapshots.sql) instead of shared out as a
 * file. The one thing a snapshot must NOT carry is the user's device-local
 * photo: `selectedPhotoUri` is a local file:// path (meaningless, and
 * potentially stale/sensitive, on any other device or after reinstall), so
 * it -- along with the byteSize/mimeType/source that describe it -- is
 * stripped before the envelope is built. `selectedMockPhoto` and
 * `consentAccepted` are left untouched: they describe onboarding progress,
 * not a device-local file reference.
 */

/** A session snapshot is the same envelope shape a local backup uses -- one less shape to keep in sync. */
export type SessionSnapshotEnvelope = PersistedSessionEnvelope;

/**
 * Clears the device-local photo reference out of a session state before it
 * is persisted server-side. Every other field (including the rest of
 * `photo`) is passed through unchanged.
 */
export const sanitizeSessionStateForSnapshot = (state: PrototypeSessionState): PrototypeSessionState => ({
  ...state,
  photo: {
    ...state.photo,
    selectedPhotoUri: null,
    byteSize: null,
    mimeType: null,
    source: "none"
  }
});

/**
 * Sanitizes the given session state and wraps it into the versioned
 * envelope that should be sent to `upsert_session_snapshot`'s `p_payload`
 * argument.
 */
export const createSessionSnapshotEnvelope = (state: PrototypeSessionState): SessionSnapshotEnvelope =>
  createPersistedSessionEnvelope(sanitizeSessionStateForSnapshot(state));

export type ParseSessionSnapshotResult = ParseSessionBackupResult;

/**
 * Parses a snapshot payload read back from `public.session_snapshots`
 * (already JSON-decoded by the Postgres/Supabase client, i.e. a plain
 * object rather than a JSON string) through the exact same
 * parse -> migrate -> validate pipeline `parseSessionBackup` uses for a
 * device-local backup file. `payload` is re-serialized to text first only
 * because that pipeline's entry point is text -- no behavior differs from
 * a local backup restore.
 */
export const parseSessionSnapshotEnvelope = (payload: unknown): ParseSessionSnapshotResult =>
  parseSessionBackup(JSON.stringify(payload ?? null));
