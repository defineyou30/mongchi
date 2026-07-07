import { describe, expect, it } from "vitest";

import {
  createInitialPrototypeSession,
  createPersistedSessionEnvelope,
  CURRENT_SESSION_SCHEMA_VERSION,
  getActivePetBundle,
  parseSessionBackup,
  performPrototypeCareAction,
  serializeSessionBackup
} from "../index";

const NOW = "2026-06-24T09:00:00.000Z";

describe("session backup export/import", () => {
  it("round-trips a current-shape session through serialize -> parse with no data loss", () => {
    const withCare = performPrototypeCareAction(createInitialPrototypeSession(NOW), "talk", NOW);
    const envelope = createPersistedSessionEnvelope(withCare);

    const backupText = serializeSessionBackup(envelope);
    const result = parseSessionBackup(backupText);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.envelope.schemaVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(result.envelope.state).toEqual(envelope.state);
    expect(getActivePetBundle(result.envelope.state).careStats.actionCounts.talk).toBe(1);
  });

  it("migrates a backup written at an older schema version forward to the current version", () => {
    const state = createInitialPrototypeSession(NOW);
    // Simulate a v6 (pre multi-pet-bundle) backup: flatten the single pet's
    // bundle back to the top level and drop the `pets`/`activePetId` wrapper,
    // exactly like a real save written before the v6 -> v7 migration existed.
    const { pets, activePetId, ...shared } = state;
    const bundle = pets[activePetId]!;
    const legacyState = { ...shared, ...bundle };
    const legacyBackupText = serializeSessionBackup({ schemaVersion: 6, state: legacyState as never });

    const result = parseSessionBackup(legacyBackupText);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.envelope.schemaVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    // The v6 -> v7 migration should have re-bundled the flat fields under pets[activePetId].
    expect(result.envelope.state.pets).toBeDefined();
    expect(typeof result.envelope.state.activePetId).toBe("string");
    expect(getActivePetBundle(result.envelope.state).petProfile).toEqual(bundle.petProfile);
  });

  it("rejects empty input without throwing", () => {
    expect(parseSessionBackup("")).toEqual({ ok: false, reason: "empty_input" });
    expect(parseSessionBackup("   \n  ")).toEqual({ ok: false, reason: "empty_input" });
  });

  it("rejects malformed JSON", () => {
    const result = parseSessionBackup("{not valid json");

    expect(result).toEqual({ ok: false, reason: "invalid_json" });
  });

  it("rejects a payload from a schema version newer than this build understands", () => {
    const state = createInitialPrototypeSession(NOW);
    const futureBackupText = serializeSessionBackup({
      schemaVersion: CURRENT_SESSION_SCHEMA_VERSION + 1,
      state
    });

    const result = parseSessionBackup(futureBackupText);

    expect(result).toEqual({ ok: false, reason: "unmigratable_version" });
  });

  it("rejects a structurally invalid payload (missing required top-level sections) after migration", () => {
    const truncated = serializeSessionBackup({
      schemaVersion: CURRENT_SESSION_SCHEMA_VERSION,
      state: { draft: {} } as never
    });

    const result = parseSessionBackup(truncated);

    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects a backup that is valid JSON but not an object at all", () => {
    expect(parseSessionBackup("42")).toEqual({ ok: false, reason: "invalid_shape" });
    expect(parseSessionBackup('"just a string"')).toEqual({ ok: false, reason: "invalid_shape" });
    expect(parseSessionBackup("null")).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("preserves the caller's original data on failure -- parseSessionBackup never mutates or discards its input", () => {
    const state = createInitialPrototypeSession(NOW);
    const goodBackupText = serializeSessionBackup(createPersistedSessionEnvelope(state));

    const badResult = parseSessionBackup("garbage");
    expect(badResult.ok).toBe(false);

    // A prior failed parse must not affect a subsequent good parse -- there's
    // no shared mutable state inside the module.
    const goodResult = parseSessionBackup(goodBackupText);
    expect(goodResult.ok).toBe(true);
  });
});
