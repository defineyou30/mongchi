import { describe, expect, it } from "vitest";

import {
  createInitialPrototypeSession,
  createPersistedSessionEnvelope,
  createSessionSnapshotEnvelope,
  CURRENT_SESSION_SCHEMA_VERSION,
  getActivePetBundle,
  parseSessionSnapshotEnvelope,
  performPrototypeCareAction,
  sanitizeSessionStateForSnapshot,
  serializeSessionBackup
} from "../index";

const NOW = "2026-06-24T09:00:00.000Z";

describe("sanitizeSessionStateForSnapshot", () => {
  it("clears the device-local photo reference and leaves every other field untouched", () => {
    const state = createInitialPrototypeSession(NOW);
    const withPhoto = {
      ...state,
      photo: {
        selectedMockPhoto: true,
        selectedPhotoUri: "file:///var/mobile/Containers/Data/tmp/photo123.jpg",
        byteSize: 204800,
        mimeType: "image/jpeg",
        source: "library" as const,
        consentAccepted: true
      }
    };

    const sanitized = sanitizeSessionStateForSnapshot(withPhoto);

    expect(sanitized.photo).toEqual({
      selectedMockPhoto: true,
      selectedPhotoUri: null,
      byteSize: null,
      mimeType: null,
      source: "none",
      consentAccepted: true
    });

    // Every other top-level field is passed through unchanged (deep equal).
    const { photo: _sanitizedPhoto, ...restSanitized } = sanitized;
    const { photo: _originalPhoto, ...restOriginal } = withPhoto;
    expect(restSanitized).toEqual(restOriginal);
  });

  it("is a no-op for a session that never selected a device photo", () => {
    const state = createInitialPrototypeSession(NOW);

    expect(sanitizeSessionStateForSnapshot(state)).toEqual(state);
  });
});

describe("createSessionSnapshotEnvelope / parseSessionSnapshotEnvelope", () => {
  it("round-trips a current-shape session with the photo reference stripped", () => {
    const withCare = performPrototypeCareAction(createInitialPrototypeSession(NOW), "talk", NOW);
    const stateWithPhoto = {
      ...withCare,
      photo: {
        ...withCare.photo,
        selectedMockPhoto: true,
        selectedPhotoUri: "file:///tmp/photo.jpg",
        byteSize: 12345,
        mimeType: "image/png",
        source: "camera" as const
      }
    };

    const envelope = createSessionSnapshotEnvelope(stateWithPhoto);

    expect(envelope.schemaVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(envelope.state.photo.selectedPhotoUri).toBeNull();
    expect(envelope.state.photo.source).toBe("none");

    // Simulate what the RPC/client round trip does: the payload is stored as
    // jsonb and read back already-decoded as a plain object (not a string).
    const decodedPayload: unknown = JSON.parse(JSON.stringify(envelope));
    const result = parseSessionSnapshotEnvelope(decodedPayload);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.envelope.schemaVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(result.envelope.state).toEqual(envelope.state);
    expect(getActivePetBundle(result.envelope.state).careStats.actionCounts.talk).toBe(1);
  });

  it("migrates an older-schema snapshot payload forward to the current version", () => {
    const state = createInitialPrototypeSession(NOW);
    // Simulate a v6 (pre multi-pet-bundle) snapshot payload, mirroring
    // sessionBackup.test.ts's legacy-shape fixture.
    const { pets, activePetId, ...shared } = state;
    const bundle = pets[activePetId]!;
    const legacyState = { ...shared, ...bundle };
    const legacyPayload: unknown = JSON.parse(
      serializeSessionBackup({ schemaVersion: 6, state: legacyState as never })
    );

    const result = parseSessionSnapshotEnvelope(legacyPayload);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.envelope.schemaVersion).toBe(CURRENT_SESSION_SCHEMA_VERSION);
    expect(result.envelope.state.pets).toBeDefined();
    expect(getActivePetBundle(result.envelope.state).petProfile).toEqual(bundle.petProfile);
  });

  it("fails with a reason for an invalid payload shape, without throwing", () => {
    expect(parseSessionSnapshotEnvelope({ draft: {} })).toEqual({ ok: false, reason: "invalid_shape" });
    expect(parseSessionSnapshotEnvelope(null)).toEqual({ ok: false, reason: "invalid_shape" });
    expect(parseSessionSnapshotEnvelope(undefined)).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects a payload from a schema version newer than this build understands", () => {
    const state = createInitialPrototypeSession(NOW);
    const futurePayload: unknown = JSON.parse(
      serializeSessionBackup({ schemaVersion: CURRENT_SESSION_SCHEMA_VERSION + 1, state })
    );

    expect(parseSessionSnapshotEnvelope(futurePayload)).toEqual({ ok: false, reason: "unmigratable_version" });
  });

  it("produces the same envelope createPersistedSessionEnvelope would for an already-sanitized state", () => {
    const state = createInitialPrototypeSession(NOW);

    expect(createSessionSnapshotEnvelope(state)).toEqual(createPersistedSessionEnvelope(state));
  });
});
