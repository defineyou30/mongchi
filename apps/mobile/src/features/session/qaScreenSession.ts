import {
  acceptPrototypeGeneratedPet,
  createInitialPrototypeSession,
  setPrototypeConsentAccepted,
  setPrototypeMockPhotoSelected,
  updatePrototypeDraft
} from "@mongchi/shared";
import type { PetSetupDraft, PrototypeSessionState } from "@mongchi/shared";

export const qaScreenPresets = ["settings-privacy-error", "settings-privacy-progress"] as const;

export type QaScreenPreset = (typeof qaScreenPresets)[number];

export const qaScreenPresetRoutes: Record<QaScreenPreset, string> = {
  "settings-privacy-error": "/settings",
  "settings-privacy-progress": "/settings"
};

export type QaScreenApiState = {
  status: "error" | "syncing";
  message: string | null;
};

const qaDraft: PetSetupDraft = {
  name: "Miso",
  species: "dog",
  personalityTags: ["curious", "affectionate"],
  talkingStyle: "gentle",
  favoriteThing: "cloud-shaped leaves"
};

const presetAliases: Record<string, QaScreenPreset> = {
  "settings-privacy-error": "settings-privacy-error",
  "settings-error": "settings-privacy-error",
  "privacy-error": "settings-privacy-error",
  "settings-privacy-progress": "settings-privacy-progress",
  "settings-progress": "settings-privacy-progress",
  "privacy-progress": "settings-privacy-progress",
  "settings-privacy-syncing": "settings-privacy-progress",
  "privacy-syncing": "settings-privacy-progress"
};

const normalizePresetKey = (value: string): string => value.trim().toLowerCase().replace(/_/g, "-");

const withAcceptedPet = (now: string): PrototypeSessionState =>
  acceptPrototypeGeneratedPet(
    setPrototypeConsentAccepted(
      setPrototypeMockPhotoSelected(updatePrototypeDraft(createInitialPrototypeSession(now), qaDraft), true),
      true
    ),
    now
  );

export const normalizeQaScreenPreset = (value: string | null | undefined): QaScreenPreset | null => {
  if (!value) {
    return null;
  }

  return presetAliases[normalizePresetKey(value)] ?? null;
};

// Read as a literal `process.env.EXPO_PUBLIC_...` member access -- a
// computed/optional-chained lookup is never inlined by babel-preset-expo at
// build time and comes back undefined in release bundles (see
// scripts/validate-mobile-env-inlining.mjs).
const QA_SCREEN_PRESET = process.env.EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET;

export const getConfiguredQaScreenPreset = (): QaScreenPreset | null => normalizeQaScreenPreset(QA_SCREEN_PRESET);

export const getConfiguredQaScreenPresetRoute = (): string | null => {
  const preset = getConfiguredQaScreenPreset();

  return preset ? qaScreenPresetRoutes[preset] : null;
};

export const createQaScreenSession = (
  preset: QaScreenPreset,
  now: string = "2026-06-24T09:00:00.000Z"
): PrototypeSessionState => {
  switch (preset) {
    case "settings-privacy-error":
    case "settings-privacy-progress":
      return withAcceptedPet(now);
  }
};

export const getQaScreenApiState = (preset: QaScreenPreset | null): QaScreenApiState | null => {
  switch (preset) {
    case "settings-privacy-error":
      return {
        status: "error",
        message: "Original photo deletion could not finish. Try again."
      };
    case "settings-privacy-progress":
      return {
        status: "syncing",
        message: null
      };
    default:
      return null;
  }
};
