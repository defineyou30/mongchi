import { describe, expect, it } from "vitest";

import {
  createQaScreenSession,
  getQaScreenApiState,
  normalizeQaScreenPreset,
  qaScreenPresetRoutes,
  qaScreenPresets
} from "./qaScreenSession";

describe("QA screen session presets", () => {
  it("keeps QA presets separate from store screenshot presets", () => {
    expect(qaScreenPresets).toEqual(["settings-privacy-error", "settings-privacy-progress"]);
    expect(qaScreenPresetRoutes).toEqual({
      "settings-privacy-error": "/settings",
      "settings-privacy-progress": "/settings"
    });
  });

  it("normalizes canonical names and QA aliases", () => {
    expect(normalizeQaScreenPreset("settings-privacy-error")).toBe("settings-privacy-error");
    expect(normalizeQaScreenPreset("SETTINGS_ERROR")).toBe("settings-privacy-error");
    expect(normalizeQaScreenPreset("privacy-error")).toBe("settings-privacy-error");
    expect(normalizeQaScreenPreset("SETTINGS_PRIVACY_SYNCING")).toBe("settings-privacy-progress");
    expect(normalizeQaScreenPreset("privacy-progress")).toBe("settings-privacy-progress");
    expect(normalizeQaScreenPreset("unknown")).toBeNull();
  });

  it("creates a settings-ready accepted pet state", () => {
    const errorState = createQaScreenSession("settings-privacy-error", "2026-06-24T09:00:00.000Z");
    const progressState = createQaScreenSession("settings-privacy-progress", "2026-06-24T09:00:00.000Z");

    for (const state of [errorState, progressState]) {
      expect(state.petProfile?.name).toBe("Miso");
      expect(state.acceptedAsset?.state).toBe("idle");
      expect(state.photo.selectedMockPhoto).toBe(true);
      expect(state.photo.consentAccepted).toBe(true);
    }
  });

  it("provides deterministic privacy API status copy", () => {
    expect(getQaScreenApiState("settings-privacy-error")).toEqual({
      status: "error",
      message: "Original photo deletion could not finish. Try again."
    });
    expect(getQaScreenApiState("settings-privacy-progress")).toEqual({
      status: "syncing",
      message: null
    });
    expect(getQaScreenApiState(null)).toBeNull();
  });
});
