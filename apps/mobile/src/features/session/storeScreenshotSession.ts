import {
  acceptPrototypeGeneratedPet,
  createInitialPrototypeSession,
  generationSteps,
  makeMockGeneratedAssetsForPet,
  mergePrototypeGeneratedAssets,
  setPrototypeConsentAccepted,
  setPrototypeMockPhotoSelected,
  setPrototypeWeatherCondition,
  setPrototypeWeatherEnabled,
  startPrototypeWalk,
  updatePrototypeDraft
} from "@mongchi/shared";
import type { PetSetupDraft, PrototypeSessionState, WeatherCondition } from "@mongchi/shared";

export const storeScreenshotPresets = [
  "welcome",
  "photo-upload",
  "pet-setup",
  "hatching",
  "pet-reveal",
  "terrarium",
  "terrarium-walk",
  "terrarium-walk-empty",
  "chat",
  "shop"
] as const;

export type StoreScreenshotPreset = (typeof storeScreenshotPresets)[number];

export const storeScreenshotPresetRoutes: Record<StoreScreenshotPreset, string> = {
  welcome: "/welcome",
  "pet-setup": "/pet-setup",
  "photo-upload": "/photo-upload",
  hatching: "/generation",
  "pet-reveal": "/pet-reveal",
  terrarium: "/terrarium",
  "terrarium-walk": "/terrarium",
  "terrarium-walk-empty": "/terrarium",
  chat: "/chat",
  shop: "/shop"
};

const presetAliases: Record<string, StoreScreenshotPreset> = {
  welcome: "welcome",
  onboarding: "welcome",
  "pet-setup": "pet-setup",
  setup: "pet-setup",
  "photo-upload": "photo-upload",
  photo: "photo-upload",
  hatching: "hatching",
  hatch: "hatching",
  generation: "hatching",
  "pet-reveal": "pet-reveal",
  reveal: "pet-reveal",
  terrarium: "terrarium",
  "main-terrarium": "terrarium",
  "terrarium-walk": "terrarium-walk",
  walk: "terrarium-walk",
  "terrarium-walk-empty": "terrarium-walk-empty",
  "walk-empty": "terrarium-walk-empty",
  chat: "chat",
  "ai-chat": "chat",
  "premium-bond": "chat",
  shop: "shop"
};

const screenshotDraft: PetSetupDraft = {
  name: "Miso",
  species: "dog",
  personalityTags: ["curious", "affectionate"],
  talkingStyle: "gentle",
  favoriteThing: "cloud-shaped leaves"
};

const normalizePresetKey = (value: string): string => value.trim().toLowerCase().replace(/_/g, "-");

const weatherScreenshotConditions = new Set<WeatherCondition>([
  "clear",
  "partly_cloudy",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "fog",
  "wind",
  "hot",
  "cold"
]);

const getConfiguredStoreScreenshotWeatherCondition = (): WeatherCondition | null => {
  const configured =
    typeof process === "undefined" ? null : process.env?.EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_WEATHER_CONDITION;
  const condition = configured?.trim().toLowerCase().replace(/-/g, "_") as WeatherCondition | undefined;

  return condition && weatherScreenshotConditions.has(condition) ? condition : null;
};

const addMs = (timestamp: string, durationMs: number): string =>
  new Date(new Date(timestamp).getTime() + durationMs).toISOString();

const withDraft = (state: PrototypeSessionState): PrototypeSessionState => updatePrototypeDraft(state, screenshotDraft);

const withSelectedPhoto = (state: PrototypeSessionState): PrototypeSessionState =>
  setPrototypeConsentAccepted(setPrototypeMockPhotoSelected(state, true), true);

const withCompletedGeneration = (state: PrototypeSessionState, now: string): PrototypeSessionState => ({
  ...state,
  generation: {
    retryCount: 0,
    pollAttemptCount: generationSteps.length,
    status: "completed",
    currentStepIndex: generationSteps.length - 1,
    startedAt: addMs(now, -20_000),
    lastPolledAt: now,
    completedAt: now
  }
});

const withHatchingGeneration = (state: PrototypeSessionState, now: string): PrototypeSessionState => ({
  ...state,
  generation: {
    retryCount: 0,
    pollAttemptCount: 2,
    status: "generating",
    currentStepIndex: 2,
    startedAt: addMs(now, -8_000),
    lastPolledAt: now,
    nextPollAfter: addMs(now, 60 * 60 * 1000)
  }
});

const withAcceptedPet = (state: PrototypeSessionState, now: string): PrototypeSessionState => {
  const accepted = acceptPrototypeGeneratedPet(withCompletedGeneration(state, now), now);
  const pet = accepted.pets[accepted.activePetId]?.petProfile;

  if (!pet) {
    return accepted;
  }

  return mergePrototypeGeneratedAssets(
    accepted,
    makeMockGeneratedAssetsForPet({
      petId: pet.id,
      generationJobId: pet.activeGenerationJobId ?? "gen_store_screenshot_001",
      species: pet.species
    })
  );
};

const withOptionalWeather = (state: PrototypeSessionState, now: string): PrototypeSessionState => {
  const condition = getConfiguredStoreScreenshotWeatherCondition();

  return condition ? setPrototypeWeatherCondition(setPrototypeWeatherEnabled(state, true, now), condition, now) : state;
};

const withWalkingPet = (state: PrototypeSessionState, now: string, credits: number): PrototypeSessionState =>
  startPrototypeWalk(
    {
      ...state,
      wallet: {
        ...state.wallet,
        credits,
        bonusCredits: 0,
        updatedAt: now
      }
    },
    now,
    3 * 60 * 1000
  );

export const normalizeStoreScreenshotPreset = (value: string | null | undefined): StoreScreenshotPreset | null => {
  if (!value) {
    return null;
  }

  return presetAliases[normalizePresetKey(value)] ?? null;
};

export const getConfiguredStoreScreenshotPreset = (): StoreScreenshotPreset | null =>
  normalizeStoreScreenshotPreset(
    typeof process === "undefined" ? null : process.env?.EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET
  );

export const getConfiguredStoreScreenshotPresetRoute = (): string | null => {
  const preset = getConfiguredStoreScreenshotPreset();

  return preset ? storeScreenshotPresetRoutes[preset] : null;
};

export const createStoreScreenshotSession = (
  preset: StoreScreenshotPreset,
  now: string = "2026-06-24T09:00:00.000Z"
): PrototypeSessionState => {
  const setupState = withDraft(createInitialPrototypeSession(now));
  const photoState = withSelectedPhoto(setupState);

  switch (preset) {
    case "welcome":
      return createInitialPrototypeSession(now);
    case "photo-upload":
      return photoState;
    case "pet-setup":
      return photoState;
    case "hatching":
      return withHatchingGeneration(photoState, now);
    case "pet-reveal":
      return withCompletedGeneration(photoState, now);
    case "terrarium":
    case "chat":
    case "shop":
      return withOptionalWeather(withAcceptedPet(photoState, now), now);
    case "terrarium-walk":
      return withWalkingPet(withAcceptedPet(photoState, now), now, 12);
    case "terrarium-walk-empty":
      return withWalkingPet(withAcceptedPet(photoState, now), now, 0);
  }
};
