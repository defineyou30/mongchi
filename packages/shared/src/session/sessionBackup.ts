import type { PersistedSessionEnvelope } from "./sessionMigrations";
import { isValidPrototypeSessionShape, runSessionMigrations } from "./sessionMigrations";

/**
 * Minimal, out-of-box safety net for a user's device-local garden (see
 * docs/readiness-diagnosis.md item 4 -- pet/memories/credits currently live
 * in a single AsyncStorage key with no server backup). This module is
 * deliberately just a JSON round-trip over the existing persistence
 * envelope: exportSessionEnvelope hands back exactly what's on disk
 * (schemaVersion + state, see createPersistedSessionEnvelope in
 * sessionMigrations.ts) and importSessionEnvelope replays the same
 * parse -> migrate -> validate pipeline the app already uses on cold start
 * (restoreSession in TerrariumSessionProvider.tsx), so a backup written on
 * an older app version still imports cleanly on a newer one via the normal
 * migration chain. Nothing here talks to AsyncStorage directly -- callers
 * own persistence (see importSessionResult's doc comment) so this stays
 * pure and unit-testable.
 */

/** A backup file is just the persistence envelope, serialized. No separate wrapper format -- one less shape to keep in sync. */
export type SessionBackupPayload = PersistedSessionEnvelope;

/**
 * Wraps a persistence envelope into the exact JSON string that should be
 * shared out as a backup file. Kept as a tiny pure function (rather than
 * inlining `JSON.stringify` at call sites) so the pretty-printing choice
 * lives in one place -- 2-space indent makes a pasted-back-in backup
 * readable if a user opens it in Notes/Mail before restoring.
 */
export const serializeSessionBackup = (envelope: SessionBackupPayload): string => JSON.stringify(envelope, null, 2);

export type ParseSessionBackupResult =
  | { ok: true; envelope: SessionBackupPayload }
  | { ok: false; reason: "empty_input" | "invalid_json" | "unmigratable_version" | "invalid_shape" };

/**
 * Parses, migrates, and shallow-validates a candidate backup JSON string --
 * the read-only half of import. Deliberately does NOT touch storage: the
 * caller (the mobile provider) decides when/whether to snapshot the current
 * session and commit the result, so a bad backup can never partially
 * clobber existing data. See TerrariumSessionProvider.tsx's restoreSession
 * for the sibling pipeline this mirrors on normal app cold start.
 */
export const parseSessionBackup = (rawText: string): ParseSessionBackupResult => {
  const trimmed = rawText.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "empty_input" };
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const migrationResult = runSessionMigrations(parsedJson);

  if (!migrationResult.ok) {
    return { ok: false, reason: "unmigratable_version" };
  }

  if (!isValidPrototypeSessionShape(migrationResult.state)) {
    return { ok: false, reason: "invalid_shape" };
  }

  // runSessionMigrations returns the bare (unwrapped) state; re-wrap it as a
  // current-version envelope so callers always get back the same shape
  // exportSessionEnvelope produces, regardless of what version the backup
  // text was originally written at.
  return {
    ok: true,
    envelope: {
      schemaVersion: migrationResult.toVersion,
      state: migrationResult.state as unknown as PersistedSessionEnvelope["state"]
    }
  };
};
