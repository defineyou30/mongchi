import { applyLocalCareAction } from "../care/localCare";
import type {
  ActiveCareBuff,
  WalkCollectionState,
  CareActionType,
  CareActionReward,
  CareState,
  CareStats,
  CareStreakState,
  CreditWallet,
  ExpressionPack,
  GeneratedAsset,
  GenerationJobStatus,
  Inventory,
  InventoryEntry,
  InventorySource,
  ItemId,
  MemoryEntry,
  PersonalityTag,
  PetId,
  PetProfile,
  PetSpecies,
  RecentReaction,
  RelationshipState,
  SelectedReaction,
  TalkingStyle,
  WeatherCondition,
  WeatherContext,
  WeatherSettings,
  WalkSession
} from "../domain";
import {
  DAILY_FREE_CHAT_TICKETS,
  addActiveCareBuff,
  applyRelationshipCareAction,
  bondLevelRewards,
  bumpCareStats,
  bumpPlayXpCounter,
  bumpTalkXpCounter,
  bumpTreatXpCounter,
  canSpendCredits,
  careBuffTemplatesByItem,
  createInitialCareStats,
  getCrossedBondLevels,
  getExpressionPackById,
  getThemeBundleById,
  grantCreditWalletValue,
  isWalkCollectionComplete,
  addToWalkCollection,
  recordPetMemory,
  rollWalkCollectible,
  WALK_COLLECTION_COMPLETE_CREDITS,
  consumeActionBuffUses,
  createInitialCareStreak,
  createManualWeatherContext,
  consumeInventoryItem,
  defaultWeatherContext,
  defaultWeatherSettings,
  didStreakJustUseGrace,
  getBondXpForCareAction,
  getBondXpMultiplier,
  getCreditItemPrice,
  getAvailableTreatItemId,
  getCareStreakSnackReward,
  getLocalDayKey,
  getStreakGraceReturnLine,
  grantRelationshipBondXp,
  pruneActiveCareBuffs,
  shouldGrantPlayBondXp,
  shouldGrantTalkBondXp,
  shouldGrantTreatBondXp,
  spendCredits,
  updateCareStreakOnCare
} from "../domain";
import { makeMockGeneratedAssetsForPet, mockCareState, mockCreditWallet, mockInventory, mockItems, mockRelationshipState, starterReactionRules } from "../mock/mockData";
import { selectLocalReaction } from "../reactions/localReactionEngine";

export interface PetSetupDraft {
  name: string;
  species: PetSpecies;
  personalityTags: PersonalityTag[];
  talkingStyle: TalkingStyle;
  favoriteThing: string;
  /** A tiny first memory with the pet, captured during setup. Optional -- seeds a future memory album. */
  firstMemory?: string;
}

export interface MockPhotoState {
  selectedMockPhoto: boolean;
  selectedPhotoUri: string | null;
  byteSize?: number | null;
  mimeType?: string | null;
  source: "none" | "sample" | "library" | "camera";
  consentAccepted: boolean;
}

export interface MockGenerationState {
  status: GenerationJobStatus;
  currentStepIndex: number;
  retryCount: number;
  pollAttemptCount?: number | undefined;
  startedAt?: string;
  lastPolledAt?: string | undefined;
  nextPollAfter?: string | undefined;
  completedAt?: string;
  failedAt?: string;
  failureCode?: string;
  failureMessageSafe?: string;
}

export interface PrototypeGenerationPollSnapshot {
  jobId: string;
  status: GenerationJobStatus;
  currentStepIndex: number;
  progress: number;
  completed: boolean;
  failed: boolean;
  pollAttemptCount: number;
  lastPolledAt: string | null;
  nextPollAfter: string | null;
  failureMessageSafe: string | null;
}

export type GenerationIssueCategory = "wrong_pet" | "unsafe_or_scary" | "poor_quality";

export interface GenerationIssueReport {
  category: GenerationIssueCategory;
  petId: PetProfile["id"];
  generationStatus: GenerationJobStatus;
  reportedAt: string;
}

export interface PrototypeWeatherState {
  settings: WeatherSettings;
  context: WeatherContext;
  updatedAt: string;
}

/**
 * Everything that belongs to one pet. Shared top-level fields (wallet/
 * inventory/weatherState/careStreak/walkCollection/activeBuffs/
 * lastTicketRefillDayKey/firstRewardClaimedAt) live outside the bundle --
 * see the "multi-pet W1" design doc (docs/multi-pet-w1-design.md) for the
 * per-field placement rationale. W1 always has exactly one bundle
 * (INV-1); the bundle/activePetId plumbing exists so a second pet can be
 * added later (W3+) without another state-shape migration.
 */
export interface PetBundle {
  petProfile: PetProfile | null;
  acceptedAsset: GeneratedAsset | null;
  acceptedAssets: GeneratedAsset[];
  careState: CareState;
  relationshipState: RelationshipState;
  currentReaction: SelectedReaction | null;
  lastCareReward: CareActionReward | null;
  recentReactions: RecentReaction[];
  activeWalk: WalkSession | null;
  lastWalkDiscovery: { collectibleId: string; isNew: boolean; collectionCompleted: boolean } | null;
  generationIssueReport: GenerationIssueReport | null;
  /** Timeline of remembered moments -- the foundation the album/home-episode/chat-memory/monthly-letter waves build on. */
  memories: MemoryEntry[];
  /** Accumulated care-pattern counters used to derive per-owner "habits" for future dialogue branching. */
  careStats: CareStats;
}

/** The first (and, until W3, only) pet's id -- kept stable across the v6 -> v7 migration lift (INV-3). */
export const FIRST_PET_ID: PetId = "pet_local_001";

export interface PrototypeSessionState {
  draft: PetSetupDraft;
  photo: MockPhotoState;
  generation: MockGenerationState;
  pets: Record<PetId, PetBundle>;
  activePetId: PetId;
  wallet: CreditWallet;
  inventory: Inventory;
  weatherState: PrototypeWeatherState;
  originalPhotoDeletedAt: string | null;
  chatHistoryDeletedAt: string | null;
  firstRewardClaimedAt: string | null;
  careStreak: CareStreakState;
  lastTicketRefillDayKey: string | null;
  activeBuffs: ActiveCareBuff[];
  walkCollection: WalkCollectionState;
}

/**
 * Reads the currently-active pet's bundle. `state.pets[state.activePetId]`
 * is guaranteed defined by INV-2 (activePetId is always a valid key of
 * pets) for any state produced by createInitialPrototypeSession or restored
 * through mergeRestoredSession, both of which establish the invariant at
 * their respective construction boundaries -- the non-null assertion here
 * is the lens's half of that contract, not an unchecked assumption.
 */
export const getActivePetBundle = (state: PrototypeSessionState): PetBundle => state.pets[state.activePetId]!;

/** Reads a specific pet's bundle, or undefined if no pet with that id exists. */
export const getPetBundle = (state: PrototypeSessionState, petId: PetId): PetBundle | undefined => state.pets[petId];

/**
 * Rewrites the active pet's bundle by merging in the Partial<PetBundle>
 * `fn` returns, leaving every other bundle and all shared top-level fields
 * untouched. This is the only sanctioned way to update per-pet fields --
 * having `fn` return a partial patch (rather than a whole new bundle) lets
 * call sites that touch several per-pet fields at once (e.g.
 * performPrototypeCareAction) stay a single call.
 */
export const withActivePetBundle = (
  state: PrototypeSessionState,
  fn: (bundle: PetBundle) => Partial<PetBundle>
): PrototypeSessionState => {
  const current = state.pets[state.activePetId]!;
  const patch = fn(current);

  return {
    ...state,
    pets: {
      ...state.pets,
      [state.activePetId]: { ...current, ...patch }
    }
  };
};

/**
 * Derives the "one sprite to show" from a bundle: the explicit
 * acceptedAsset if set, otherwise the idle-state asset, otherwise whatever
 * is first in acceptedAssets. Exported for future call sites (W5 plans to
 * retire the acceptedAsset field in favor of always deriving it) -- W1
 * itself keeps acceptedAsset as a real, independently-written field and
 * does not yet route any call site through this selector.
 */
export const selectPrimaryAsset = (bundle: PetBundle): GeneratedAsset | null =>
  bundle.acceptedAsset ?? bundle.acceptedAssets.find((asset) => asset.state === "idle") ?? bundle.acceptedAssets[0] ?? null;

export const generationSteps = [
  "Preparing photo",
  "Finding little details",
  "Creating companion",
  "Polishing tiny world",
  "Moving in"
] as const;

export const generationStepStatuses: readonly GenerationJobStatus[] = [
  "preprocessing",
  "safety_checking",
  "generating",
  "quality_checking",
  "completed"
];

export const initialDraft: PetSetupDraft = {
  name: "",
  species: "dog",
  personalityTags: ["affectionate"],
  talkingStyle: "gentle",
  favoriteThing: ""
};

export const initialGeneration: MockGenerationState = {
  status: "created",
  currentStepIndex: 0,
  retryCount: 0
};

const FALLBACK_NOW = "2026-06-24T09:00:00.000Z";
const DEFAULT_PROTOTYPE_LOCALE = "en-US";
const DEFAULT_WALK_DURATION_MS = 15_000;
const DEFAULT_GENERATION_POLL_INTERVAL_MS = 900;
const WALK_REWARD_ITEM_ID: ItemId = "item_sweet_potato_chew";
const fallbackAssetKeyBySpecies: Record<PetSpecies, string> = {
  dog: "miso",
  cat: "luna"
};

const addMs = (timestamp: string, durationMs: number): string =>
  new Date(new Date(timestamp).getTime() + durationMs).toISOString();

const createInitialWeatherState = (now: string): PrototypeWeatherState => ({
  settings: defaultWeatherSettings,
  context: {
    ...defaultWeatherContext,
    fetchedAt: now
  },
  updatedAt: now
});

const weatherTemperatureByCondition: Record<WeatherCondition, number> = {
  clear: 22,
  partly_cloudy: 21,
  cloudy: 19,
  rain: 17,
  storm: 16,
  snow: -1,
  fog: 12,
  wind: 14,
  hot: 31,
  cold: 2
};

const getWalkDiscoveryLineForWeather = (weather: WeatherContext): string => {
  switch (weather.condition) {
    case "rain":
    case "storm":
      return "I found a shiny leaf near a rainy little path.";
    case "snow":
    case "cold":
      return "I found a tiny cold sparkle on the path.";
    case "wind":
      return "A little wind ribbon followed me home.";
    case "hot":
      return "I found a sunny petal that wanted shade.";
    default:
      return "A tiny leaf thought of you.";
  }
};

const getWalkRewardItemIdForWeather = (weather: WeatherContext): ItemId => {
  switch (weather.condition) {
    case "rain":
    case "storm":
      return "item_chicken_jerky";
    case "snow":
    case "cold":
      return "item_bone_biscuit";
    case "wind":
      return "item_tuna_crunch";
    case "hot":
      return "item_treat_plate_biscuit";
    default:
      return WALK_REWARD_ITEM_ID;
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days elapsed between `createdAt` and `now` -- used to detect days-together milestones. */
const getDaysTogether = (createdAt: string, now: string): number => {
  const createdMs = new Date(createdAt).getTime();
  const nowMs = new Date(now).getTime();

  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowMs - createdMs) / DAY_MS));
};

const DAYS_TOGETHER_MILESTONES = [7, 14, 30] as const;

/**
 * If `now` has just crossed a 7/14/30-day milestone since `petProfile.createdAt`
 * (relative to the days-together value already recorded in memories), records a
 * "days_milestone" entry. Safe to call on every care action / session refresh --
 * dedupe in recordPetMemory means a milestone already logged is a no-op, and
 * this only ever checks forward from the highest days-together value already
 * seen so it never re-fires for a day that already passed.
 */
const recordDaysTogetherMilestoneIfCrossed = (
  memories: MemoryEntry[],
  createdAt: string,
  now: string
): MemoryEntry[] => {
  const daysTogether = getDaysTogether(createdAt, now);
  const highestRecorded = memories
    .filter((entry) => entry.type === "days_milestone")
    .reduce((max, entry) => Math.max(max, entry.refs?.daysTogether ?? 0), 0);
  const crossedMilestone = DAYS_TOGETHER_MILESTONES.find(
    (milestone) => daysTogether >= milestone && milestone > highestRecorded
  );

  if (!crossedMilestone) {
    return memories;
  }

  return recordPetMemory(memories, {
    id: `mem_days_${crossedMilestone}`,
    type: "days_milestone",
    occurredAt: now,
    line: `${crossedMilestone} days since I moved in. Every one of them has been good.`,
    refs: { daysTogether: crossedMilestone }
  });
};

/** Builds a fresh, empty PetBundle for a not-yet-created pet (seeded mock care/relationship state, no assets/memories yet). */
export const createInitialPetBundle = (now: string = FALLBACK_NOW, petId: PetId = FIRST_PET_ID): PetBundle => ({
  petProfile: null,
  acceptedAsset: null,
  acceptedAssets: [],
  careState: {
    ...mockCareState,
    petId,
    updatedAt: now
  },
  relationshipState: {
    ...mockRelationshipState,
    petId,
    updatedAt: now
  },
  currentReaction: null,
  lastCareReward: null,
  recentReactions: [],
  activeWalk: null,
  lastWalkDiscovery: null,
  generationIssueReport: null,
  memories: [],
  careStats: createInitialCareStats()
});

export const createInitialPrototypeSession = (now: string = FALLBACK_NOW): PrototypeSessionState => ({
  draft: initialDraft,
  photo: {
    selectedMockPhoto: false,
    selectedPhotoUri: null,
    byteSize: null,
    mimeType: null,
    source: "none",
    consentAccepted: false
  },
  generation: initialGeneration,
  pets: {
    [FIRST_PET_ID]: createInitialPetBundle(now, FIRST_PET_ID)
  },
  activePetId: FIRST_PET_ID,
  wallet: {
    ...mockCreditWallet,
    updatedAt: now
  },
  inventory: {
    ...mockInventory,
    updatedAt: now
  },
  weatherState: createInitialWeatherState(now),
  originalPhotoDeletedAt: null,
  chatHistoryDeletedAt: null,
  firstRewardClaimedAt: null,
  careStreak: createInitialCareStreak(now),
  lastTicketRefillDayKey: null,
  activeBuffs: [],
  walkCollection: {}
});

/**
 * Grants the daily free chat tickets once per local day. Tickets top up to the
 * daily allowance instead of stacking, so hoarding is impossible.
 */
export const applyPrototypeDailyTicketRefill = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  const todayKey = getLocalDayKey(now);

  if (state.lastTicketRefillDayKey === todayKey) {
    return state;
  }

  return {
    ...state,
    wallet: {
      ...state.wallet,
      freeChatTickets: Math.max(state.wallet.freeChatTickets, DAILY_FREE_CHAT_TICKETS),
      updatedAt: now
    },
    lastTicketRefillDayKey: todayKey
  };
};

type ReactionAssetPreference =
  | SelectedReaction["animation"]
  | GeneratedAsset["state"]
  | Pick<SelectedReaction, "animation" | "category">
  | null
  | undefined;

const assetStateForReactionCategory = (category?: SelectedReaction["category"] | null): GeneratedAsset["state"] | null => {
  switch (category) {
    case "hungry_low":
      return "hungry";
    case "walk_return_common":
    case "walk_return_rare":
      return "walk_return";
    case "treat_common":
    case "treat_special":
      return "treat_reaction";
    case "premium_chat_teaser":
      return "chat_portrait";
    case "greeting_afternoon":
      return "curious";
    case "generation_reveal":
    case "new_item":
      return "celebrate";
    case "garden_needs_water":
    case "garden_watered":
      return "garden_help";
    case "rested":
      return "sleep";
    default:
      return null;
  }
};

export const assetStateForReactionAnimation = (
  animation?: SelectedReaction["animation"] | GeneratedAsset["state"] | null
): GeneratedAsset["state"] => {
  switch (animation) {
    case "base":
    case "celebrate":
    case "chat_portrait":
    case "curious":
    case "garden_help":
    case "hungry":
    case "seasonal":
    case "sleep":
    case "treat_reaction":
    case "walk_return":
    case "sad":
    case "sick":
    case "messy":
      return animation;
    case "happy":
    case "idle_happy":
      return "happy";
    case "treat":
      return "treat_reaction";
    case "sleepy":
      return "sleep";
    case "play":
      return "play";
    case "idle":
    case "walk_out":
    default:
      return "idle";
  }
};

export const assetStateForReaction = (reaction?: Pick<SelectedReaction, "animation" | "category"> | null): GeneratedAsset["state"] =>
  assetStateForReactionCategory(reaction?.category) ?? assetStateForReactionAnimation(reaction?.animation);

const resolveReactionAssetState = (preference?: ReactionAssetPreference): GeneratedAsset["state"] => {
  if (preference && typeof preference === "object") {
    return assetStateForReaction(preference);
  }

  return assetStateForReactionAnimation(preference);
};

// Newer expression states may not exist yet for older generations; fall back to the
// closest existing expression before giving up.
const assetStateFallbackChain: Partial<Record<GeneratedAsset["state"], GeneratedAsset["state"][]>> = {
  sad: ["hungry", "sleep"],
  sick: ["sad", "sleep", "hungry"],
  messy: ["walk_return", "idle"]
};

export const selectGeneratedAssetForReaction = (
  assets: readonly GeneratedAsset[],
  fallback: GeneratedAsset | null,
  preference?: ReactionAssetPreference
): GeneratedAsset | null => {
  const preferredState = resolveReactionAssetState(preference);
  const candidateStates = [preferredState, ...(assetStateFallbackChain[preferredState] ?? [])];

  for (const state of candidateStates) {
    const match = assets.find((asset) => asset.state === state);

    if (match) {
      return match;
    }
  }

  return fallback ?? assets.find((asset) => asset.state === "idle") ?? assets[0] ?? null;
};

export const buildPrototypePetProfile = (
  draft: PetSetupDraft,
  now: string = FALLBACK_NOW,
  existing?: PetProfile | null
): PetProfile => {
  const trimmedName = draft.name.trim() || "Miso";
  const assetKey = fallbackAssetKeyBySpecies[draft.species] ?? fallbackAssetKeyBySpecies.dog;
  const base: PetProfile = {
    id: existing?.id ?? "pet_local_001",
    userId: "user_demo_001",
    name: trimmedName,
    species: draft.species,
    personalityTags: draft.personalityTags.length > 0 ? draft.personalityTags : ["affectionate"],
    talkingStyle: draft.talkingStyle,
    lifecycleStatus: existing?.lifecycleStatus ?? "active",
    activeGenerationJobId: "gen_local_001",
    activeAssetId: `asset_${assetKey}_idle_001`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const favoriteThing = draft.favoriteThing.trim();
  const firstMemory = draft.firstMemory?.trim();
  const withFavoriteThing = favoriteThing ? { ...base, favoriteThing } : base;

  // The setup screen's optional "first tiny memory" input seeds
  // PetProfile.memoryNote, the same field the premium chat provider already
  // reads as a personal detail -- no separate storage needed.
  return firstMemory ? { ...withFavoriteThing, memoryNote: firstMemory } : withFavoriteThing;
};

export const getActivePrototypePet = (state: PrototypeSessionState, now: string = FALLBACK_NOW): PetProfile =>
  getActivePetBundle(state).petProfile ?? buildPrototypePetProfile(state.draft, now);

export const canContinuePetSetup = (state: PrototypeSessionState): boolean =>
  state.draft.name.trim().length >= 2 && state.draft.personalityTags.length > 0 && state.draft.talkingStyle.length > 0;

export const canContinuePhotoStep = (state: PrototypeSessionState): boolean =>
  (state.photo.selectedMockPhoto || !!state.photo.selectedPhotoUri) && state.photo.consentAccepted;

export const canCreatePet = (state: PrototypeSessionState): boolean =>
  canContinuePetSetup(state) && canContinuePhotoStep(state);

export const setPrototypeWeatherEnabled = (
  state: PrototypeSessionState,
  enabled: boolean,
  now: string = FALLBACK_NOW
): PrototypeSessionState => ({
  ...state,
  weatherState: {
    ...state.weatherState,
    settings: {
      ...state.weatherState.settings,
      enabled,
      lastExplainedAt: state.weatherState.settings.lastExplainedAt ?? now
    },
    updatedAt: now
  }
});

export const setPrototypeWeatherCondition = (
  state: PrototypeSessionState,
  condition: WeatherCondition,
  now: string = FALLBACK_NOW
): PrototypeSessionState => ({
  ...state,
  weatherState: {
    settings: {
      ...state.weatherState.settings,
      enabled: true
    },
    context: createManualWeatherContext(condition, now, {
      temperatureC: weatherTemperatureByCondition[condition],
      regionLabel: state.weatherState.settings.manualCity ?? "Tiny Garden"
    }),
    updatedAt: now
  }
});

export const getGenerationProgress = (state: PrototypeSessionState): number =>
  Math.round(((state.generation.currentStepIndex + 1) / generationSteps.length) * 100);

/**
 * Identifies one generation *attempt* for gauge-tracking purposes: a fresh
 * job id or a bumped retryCount both mean "this is a new attempt, the
 * progress gauge may legitimately start over from 0". Anything else (e.g. a
 * poll response landing out of order) must never move the displayed gauge
 * backward -- see getMonotonicGenerationProgress below.
 */
export const getGenerationAttemptKey = (state: PrototypeSessionState): string =>
  `${getActivePrototypePet(state).activeGenerationJobId ?? "none"}:${state.generation.retryCount}`;

/**
 * A user-reported bug: the generation screen's progress gauge appeared to
 * move backward and forward instead of steadily climbing, because polling
 * can (rarely) observe a server status that maps to an earlier step than one
 * already shown -- e.g. a stale/duplicate poll response arriving after a
 * newer one. The domain state itself stays a faithful mirror of the last
 * poll (so retries/diagnostics aren't lied to), but the *displayed* gauge
 * should only ever climb within a single attempt. Callers keep track of the
 * highest progress value seen for the current getGenerationAttemptKey and
 * pass it in here; a lower incoming reading is clamped up to it.
 */
export const getMonotonicGenerationProgress = (state: PrototypeSessionState, previousMaxProgress: number): number =>
  Math.max(getGenerationProgress(state), previousMaxProgress);

export const getPrototypeGenerationPollSnapshot = (state: PrototypeSessionState): PrototypeGenerationPollSnapshot => ({
  jobId: getActivePrototypePet(state).activeGenerationJobId ?? "gen_local_001",
  status: state.generation.status,
  currentStepIndex: state.generation.currentStepIndex,
  progress: getGenerationProgress(state),
  completed: state.generation.status === "completed",
  failed: state.generation.status === "failed",
  pollAttemptCount: state.generation.pollAttemptCount ?? 0,
  lastPolledAt: state.generation.lastPolledAt ?? null,
  nextPollAfter: state.generation.nextPollAfter ?? null,
  failureMessageSafe: state.generation.failureMessageSafe ?? null
});

// Statuses that mean "a pipeline attempt is actively mid-flight, waiting on
// polling to move it forward" -- everything between the initial "created"
// placeholder and a terminal outcome. Restoring a session frozen in one of
// these statuses (e.g. the app was killed mid-generation) leaves it stuck
// forever: nothing will ever poll it again (the poller only runs while
// GenerationScreen is mounted and the in-memory retry timers are gone), yet
// shouldAutoStartGeneration/hasActiveGenerationJob both treat a non-terminal
// status as "already has an active job" and refuse to start a fresh one. See
// normalizeRestoredGeneration below, which breaks that deadlock on restore.
const inFlightGenerationStatuses = new Set<GenerationJobStatus>([
  "queued",
  "claimed",
  "validating",
  "preprocessing",
  "safety_checking",
  "generating",
  "postprocessing",
  "quality_checking",
  "uploading_assets"
]);

/**
 * Restore-time normalization for a persisted session's generation state
 * (invariant I6 in the generation-flow design audit). Two cases repair a
 * session that was frozen mid-flight when the app was last closed:
 *
 *  1. status is one of inFlightGenerationStatuses -- there is no live poller
 *     to ever move this forward again, so it is downgraded to a failed job
 *     with a dedicated "generation_interrupted" failure code and a warm,
 *     specific retry prompt. This also un-sticks
 *     shouldAutoStartGeneration/hasActiveGenerationJob, which otherwise treat
 *     any non-terminal status as still active and refuse to ever start a new
 *     attempt.
 *  2. status is "completed" but acceptedAssets came back empty (e.g. the
 *     session was persisted between the server flipping the job to
 *     "completed" and the client's poll response populating
 *     acceptedAsset/acceptedAssets) -- there is nothing to reveal/accept, so
 *     this is also downgraded to the same interrupted-failure shape rather
 *     than leaving PetRevealScreen stranded with no asset to show.
 *
 * Both branches are no-ops for a session in any other state (created,
 * already-failed, already-cancelled/expired, or genuinely completed with
 * assets in hand), so this is safe to run unconditionally on every restore.
 */
export const normalizeRestoredGeneration = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  const { status } = state.generation;
  const isStrandedInFlight = inFlightGenerationStatuses.has(status);
  const isStrandedCompletion = status === "completed" && getActivePetBundle(state).acceptedAssets.length === 0;

  if (!isStrandedInFlight && !isStrandedCompletion) {
    return state;
  }

  return {
    ...state,
    generation: {
      ...state.generation,
      status: "failed",
      failedAt: now,
      lastPolledAt: now,
      nextPollAfter: undefined,
      failureCode: "generation_interrupted",
      failureMessageSafe: "We lost track while your friend was moving in. Let's try once more."
    }
  };
};

export const updatePrototypeDraft = (
  state: PrototypeSessionState,
  patch: Partial<PetSetupDraft>
): PrototypeSessionState => ({
  ...state,
  draft: {
    ...state.draft,
    ...patch
  }
});

export const togglePrototypePersonalityTag = (
  state: PrototypeSessionState,
  tag: PersonalityTag
): PrototypeSessionState => {
  const exists = state.draft.personalityTags.includes(tag);
  const nextTags = exists
    ? state.draft.personalityTags.filter((currentTag) => currentTag !== tag)
    : [...state.draft.personalityTags, tag];

  return updatePrototypeDraft(state, {
    personalityTags: nextTags
  });
};

export const setPrototypeMockPhotoSelected = (
  state: PrototypeSessionState,
  selectedMockPhoto: boolean
): PrototypeSessionState => ({
  ...state,
  photo: {
    ...state.photo,
    selectedMockPhoto,
    selectedPhotoUri: null,
    byteSize: selectedMockPhoto ? 4096 : null,
    mimeType: selectedMockPhoto ? "image/png" : null,
    source: selectedMockPhoto ? "sample" : "none"
  }
});

export const setPrototypeSelectedPhotoUri = (
  state: PrototypeSessionState,
  selectedPhotoUri: string,
  source: "library" | "camera" = "library",
  metadata: { byteSize?: number | null; mimeType?: string | null } = {}
): PrototypeSessionState => ({
  ...state,
  photo: {
    ...state.photo,
    selectedMockPhoto: false,
    selectedPhotoUri,
    byteSize: metadata.byteSize ?? null,
    mimeType: metadata.mimeType ?? null,
    source
  }
});

export const setPrototypeConsentAccepted = (
  state: PrototypeSessionState,
  consentAccepted: boolean
): PrototypeSessionState => ({
  ...state,
  photo: {
    ...state.photo,
    consentAccepted
  }
});

export const startPrototypeGeneration = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => ({
  ...state,
  generation: {
    retryCount: state.generation.retryCount,
    pollAttemptCount: 0,
    status: "preprocessing",
    currentStepIndex: 0,
    startedAt: now,
    lastPolledAt: now,
    nextPollAfter: addMs(now, DEFAULT_GENERATION_POLL_INTERVAL_MS)
  }
});

export const advancePrototypeGeneration = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  if (state.generation.status === "completed" || state.generation.status === "failed") {
    return state;
  }

  const currentIndex = state.generation.status === "created" ? -1 : state.generation.currentStepIndex;
  const nextStepIndex = Math.min(currentIndex + 1, generationSteps.length - 1);
  const status = generationStepStatuses[nextStepIndex] ?? "generating";
  const generation: MockGenerationState = {
    retryCount: state.generation.retryCount,
    pollAttemptCount: state.generation.pollAttemptCount,
    status,
    currentStepIndex: nextStepIndex,
    startedAt: state.generation.startedAt ?? now
  };

  if (status === "completed") {
    generation.completedAt = now;
  }

  return {
    ...state,
    generation
  };
};

export const failPrototypeGeneration = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW,
  failureCode = "mock_quality_gate_failed"
): PrototypeSessionState => ({
  ...state,
  generation: {
    ...state.generation,
    status: "failed",
    failedAt: now,
    lastPolledAt: now,
    nextPollAfter: undefined,
    failureCode,
    failureMessageSafe: `The tiny door got stuck. Let's try creating ${getActivePrototypePet(state, now).name} again.`
  }
});

export const retryPrototypeGeneration = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => ({
  ...state,
  generation: {
    retryCount: state.generation.retryCount + 1,
    pollAttemptCount: 0,
    status: "preprocessing",
    currentStepIndex: 0,
    startedAt: now,
    lastPolledAt: now,
    nextPollAfter: addMs(now, DEFAULT_GENERATION_POLL_INTERVAL_MS)
  }
});

export const pollPrototypeGenerationJob = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW,
  options: { force?: boolean; pollIntervalMs?: number } = {}
): PrototypeSessionState => {
  if (state.generation.status === "failed" || state.generation.status === "completed") {
    return {
      ...state,
      generation: {
        ...state.generation,
        lastPolledAt: now,
        nextPollAfter: undefined
      }
    };
  }

  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_GENERATION_POLL_INTERVAL_MS;
  const currentGeneration =
    state.generation.status === "created" ? startPrototypeGeneration(state, now).generation : state.generation;
  const nextPollAt = currentGeneration.nextPollAfter ? new Date(currentGeneration.nextPollAfter).getTime() : 0;
  const shouldAdvance = options.force || !nextPollAt || new Date(now).getTime() >= nextPollAt;

  if (!shouldAdvance) {
    return {
      ...state,
      generation: {
        ...currentGeneration,
        lastPolledAt: now
      }
    };
  }

  const advanced = advancePrototypeGeneration(
    {
      ...state,
      generation: currentGeneration
    },
    now
  );
  const terminal = advanced.generation.status === "completed" || advanced.generation.status === "failed";

  return {
    ...advanced,
    generation: {
      ...advanced.generation,
      pollAttemptCount: (state.generation.pollAttemptCount ?? 0) + 1,
      lastPolledAt: now,
      nextPollAfter: terminal ? undefined : addMs(now, pollIntervalMs)
    }
  };
};

const appendReaction = (
  bundle: PetBundle,
  reaction: SelectedReaction,
  shownAt: string
): Pick<PetBundle, "currentReaction" | "recentReactions"> => ({
  currentReaction: reaction,
  recentReactions: [
    {
      ruleId: reaction.ruleId,
      line: reaction.line,
      shownAt
    },
    ...bundle.recentReactions
  ].slice(0, 12)
});

export interface AcceptPrototypeGeneratedPetOptions {
  /**
   * When true, keeps the already-populated state.acceptedAsset/
   * acceptedAssets (e.g. real signed Supabase asset URLs from a completed
   * server-backed generation job) instead of overwriting them with local
   * mock placeholder assets. The local-mock flow (no Supabase/API runtime
   * configured) still wants makeMockGeneratedAssetsForPet's placeholders, so
   * this defaults to false and must be opted into by server-backed callers.
   */
  preserveAssets?: boolean;
}

export const acceptPrototypeGeneratedPet = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW,
  options: AcceptPrototypeGeneratedPetOptions = {}
): PrototypeSessionState => {
  const bundle = getActivePetBundle(state);
  const pet = buildPrototypePetProfile(state.draft, now, bundle.petProfile);
  const careState: CareState = {
    ...bundle.careState,
    petId: pet.id,
    updatedAt: now
  };
  const relationshipState: RelationshipState = {
    ...bundle.relationshipState,
    petId: pet.id,
    updatedAt: now
  };
  const selectedReaction = selectLocalReaction(starterReactionRules, {
    locale: DEFAULT_PROTOTYPE_LOCALE,
    now,
    pet,
    careState,
    weather: state.weatherState.context,
    eventContext: "generation_reveal",
    recentReactions: bundle.recentReactions
  });
  const acceptedAssets = options.preserveAssets
    ? bundle.acceptedAssets
    : makeMockGeneratedAssetsForPet({
        petId: pet.id,
        generationJobId: pet.activeGenerationJobId ?? "gen_local_001",
        species: pet.species
      });
  const acceptedAsset = options.preserveAssets ? bundle.acceptedAsset : (acceptedAssets[0] ?? null);
  const firstMemoryNote = pet.memoryNote?.trim();
  const memories = recordPetMemory(bundle.memories, {
    id: "mem_moved_in",
    type: "moved_in",
    occurredAt: now,
    line: "The day I moved into the garden.",
    ...(firstMemoryNote ? { refs: { note: firstMemoryNote } } : {})
  });

  return withActivePetBundle(state, () => ({
    petProfile: pet,
    acceptedAsset,
    acceptedAssets,
    careState,
    relationshipState,
    memories,
    ...appendReaction(bundle, selectedReaction, now)
  }));
};

const applyBondLevelRewards = (
  current: { wallet: CreditWallet; inventory: Inventory; memories: MemoryEntry[] },
  previousLevel: number,
  nextLevel: number,
  now: string
): { wallet: CreditWallet; inventory: Inventory; memories: MemoryEntry[]; celebrationReaction: SelectedReaction | null } => {
  if (nextLevel <= previousLevel) {
    return { ...current, celebrationReaction: null };
  }

  let wallet = current.wallet;
  let inventory = current.inventory;
  let memories = current.memories;
  let celebrationLine: string | null = null;

  for (const level of getCrossedBondLevels(previousLevel, nextLevel)) {
    const reward = bondLevelRewards[level];

    memories = recordPetMemory(memories, {
      id: `mem_bond_level_${level}`,
      type: "bond_level",
      occurredAt: now,
      line: `Our bond reached a new level. I feel it every day.`,
      refs: { bondLevel: level }
    });

    if (!reward) {
      continue;
    }

    if (reward.wallet) {
      wallet = grantCreditWalletValue(wallet, reward.wallet, now);
    }

    for (const item of reward.items ?? []) {
      for (let grant = 0; grant < item.quantity; grant += 1) {
        inventory = grantInventoryItem(inventory, item.itemId, now, "event");
      }
    }

    celebrationLine = DEFAULT_PROTOTYPE_LOCALE.startsWith("ko") ? reward.celebrationKo : reward.celebrationEn;
  }

  return {
    wallet,
    inventory,
    memories,
    celebrationReaction: {
      ruleId: `bond_level_up_${nextLevel}`,
      category: "affection_high",
      line:
        celebrationLine ??
        (DEFAULT_PROTOTYPE_LOCALE.startsWith("ko")
          ? `우리 유대가 레벨 ${nextLevel}이 됐어! 고마워.`
          : `Our bond reached level ${nextLevel}! Thank you for all the little moments.`),
      animation: "celebrate",
      priority: 100
    }
  };
};

/**
 * Grants the 3-day / 7-day streak snack into the inventory, once per streak
 * step (called only when the streak actually advanced this turn). Returns a
 * celebration reaction alongside the updated inventory so the loop can
 * surface it, but bond level-ups still take priority for the shared reaction
 * slot -- streak snacks are a nice-to-notice, not the emotional peak.
 */
// Streak lengths worth remembering as their own milestone entry, distinct
// from the every-3rd/7th-day snack cadence handled by getCareStreakSnackReward.
const STREAK_MEMORY_MILESTONES = new Set([7, 14, 30]);

const applyCareStreakSnackReward = (
  inventory: Inventory,
  memories: MemoryEntry[],
  previousStreak: CareStreakState,
  nextStreak: CareStreakState,
  now: string,
  petName: string
): { inventory: Inventory; memories: MemoryEntry[]; celebrationReaction: SelectedReaction | null } => {
  if (nextStreak.current === previousStreak.current) {
    return { inventory, memories, celebrationReaction: null };
  }

  const nextMemories = STREAK_MEMORY_MILESTONES.has(nextStreak.current)
    ? recordPetMemory(memories, {
        id: `mem_streak_${nextStreak.current}`,
        type: "streak_milestone",
        occurredAt: now,
        line: `${nextStreak.current} days in a row together. I look forward to seeing you.`,
        refs: { streakCount: nextStreak.current }
      })
    : memories;

  // A returning session where the one-day grace just kicked in gets a warm,
  // one-time "welcome back" callout instead of (or alongside) the usual snack
  // line -- this is the only surface for the grace, so it takes priority over
  // the plain snack celebration when both would fire on the same turn.
  const graceJustUsed = didStreakJustUseGrace(previousStreak, nextStreak);
  const reward = getCareStreakSnackReward(nextStreak.current);
  const nextInventory = reward ? grantInventoryItem(inventory, reward.itemId, now, "streak_reward") : inventory;

  if (graceJustUsed) {
    return {
      inventory: nextInventory,
      memories: nextMemories,
      celebrationReaction: {
        ruleId: "care_streak_grace_return",
        category: "treat_common",
        line: getStreakGraceReturnLine(petName),
        animation: "happy",
        priority: 95
      }
    };
  }

  if (!reward) {
    return { inventory, memories: nextMemories, celebrationReaction: null };
  }

  const line = reward.special
    ? DEFAULT_PROTOTYPE_LOCALE.startsWith("ko")
      ? `${nextStreak.current}일 연속이야! 특별한 간식을 아껴뒀어.`
      : `${nextStreak.current} days together — Mong saved you a special snack.`
    : DEFAULT_PROTOTYPE_LOCALE.startsWith("ko")
      ? `${nextStreak.current}일 연속이야! 작은 간식을 챙겨왔어.`
      : `${nextStreak.current} days together — Mong saved you a snack.`;

  return {
    inventory: nextInventory,
    memories: nextMemories,
    celebrationReaction: {
      ruleId: `care_streak_snack_${nextStreak.current}`,
      category: "treat_common",
      line,
      animation: "treat",
      priority: 90
    }
  };
};

export const performPrototypeCareAction = (
  state: PrototypeSessionState,
  action: CareActionType,
  now: string = FALLBACK_NOW,
  itemId?: ItemId,
  options?: { walkDurationMs?: number }
): PrototypeSessionState => {
  if (action === "walk") {
    return startPrototypeWalk(state, now, options?.walkDurationMs ?? DEFAULT_WALK_DURATION_MS, itemId);
  }

  const consumableTreatItemId = action === "treat" ? itemId ?? getAvailableTreatItemId(state.inventory, mockItems) : undefined;
  const resolvedActionItemId = action === "treat" ? consumableTreatItemId : itemId;

  if (action === "treat" && !consumableTreatItemId) {
    return withActivePetBundle(state, () => ({
      lastCareReward: null
    }));
  }

  const bundle = getActivePetBundle(state);
  const pet = getActivePrototypePet(state, now);
  const buffsBeforeAction = pruneActiveCareBuffs(state.activeBuffs, now);
  const result = applyLocalCareAction(
    bundle.careState,
    {
      action,
      occurredAt: now,
      ...(resolvedActionItemId ? { itemId: resolvedActionItemId } : {})
    },
    buffsBeforeAction
  );

  // Buff lifecycle: consume one use from action-boost buffs, then let the used
  // item start its own buff (replacing an older instance of the same buff).
  const usedBuffTemplate = resolvedActionItemId ? careBuffTemplatesByItem[resolvedActionItemId] : undefined;
  const buffsAfterUse = consumeActionBuffUses(buffsBeforeAction, action, now);
  const activeBuffs = usedBuffTemplate && resolvedActionItemId
    ? addActiveCareBuff(buffsAfterUse, usedBuffTemplate, resolvedActionItemId, now)
    : buffsAfterUse;
  const buffStarted = usedBuffTemplate !== undefined && !buffsBeforeAction.some((buff) => buff.buffId === usedBuffTemplate.buffId);

  const selectedReaction = selectLocalReaction(starterReactionRules, {
    locale: DEFAULT_PROTOTYPE_LOCALE,
    now,
    pet,
    careState: result.nextState,
    recentAction: action,
    daysAway: 0,
    weather: state.weatherState.context,
    recentReactions: bundle.recentReactions,
    ...(buffStarted ? { eventContext: "buff_started" } : {})
  });

  const consumedInventory = action === "treat" && consumableTreatItemId ? consumeInventoryItem(state.inventory, consumableTreatItemId, now) : null;
  const inventory = consumedInventory?.ok ? consumedInventory.inventory : state.inventory;
  // Daily bond-XP farming caps for treat/talk/play (see mongchi "케어 체감 밸런스"
  // fix, extended to play when purchased toys bypass its cooldown -- see
  // homeCareActionCooldownMs / getHomeCarePressDecision): stat/mood effects
  // always land, but XP stops once the day's cap is hit so a 2-minute treat
  // cooldown, a 30-second talk cooldown, or a toy-bypassed play cooldown
  // can't be farmed for unlimited bond XP. `xpOverride` is left undefined for
  // every other action so their normal XP amount is unaffected.
  const xpOverride =
    action === "treat"
      ? (shouldGrantTreatBondXp(bundle.careStats, now) ? getBondXpForCareAction("treat") : 0)
      : action === "talk"
        ? (shouldGrantTalkBondXp(bundle.careStats, now) ? getBondXpForCareAction("talk") : 0)
        : action === "play"
          ? (shouldGrantPlayBondXp(bundle.careStats, now) ? getBondXpForCareAction("play") : 0)
          : undefined;
  const baseRelationshipState = applyRelationshipCareAction(bundle.relationshipState, action, now, xpOverride);
  const bondMultiplier = getBondXpMultiplier(buffsBeforeAction, now);
  const relationshipState =
    bondMultiplier > 1
      ? grantRelationshipBondXp(baseRelationshipState, Math.round(getBondXpForCareAction(action) * (bondMultiplier - 1)), now)
      : baseRelationshipState;

  const isFirstTreat = action === "treat" && (bundle.careStats.actionCounts.treat ?? 0) === 0;
  const memoriesWithFirstTreat = isFirstTreat
    ? recordPetMemory(bundle.memories, {
        id: "mem_first_treat",
        type: "first_treat",
        occurredAt: now,
        line: "I got my very first treat from you.",
        ...(consumableTreatItemId ? { refs: { itemId: consumableTreatItemId } } : {})
      })
    : bundle.memories;

  const bondReward = applyBondLevelRewards(
    { wallet: state.wallet, inventory, memories: memoriesWithFirstTreat },
    bundle.relationshipState.bondLevel,
    relationshipState.bondLevel,
    now
  );
  const nextCareStreak = updateCareStreakOnCare(state.careStreak, now);
  const streakReward = applyCareStreakSnackReward(bondReward.inventory, bondReward.memories, state.careStreak, nextCareStreak, now, pet.name);
  // A bond level-up is the emotional peak of the loop and outranks everything
  // else; a streak snack still beats the regular action reaction.
  const finalReaction = bondReward.celebrationReaction ?? streakReward.celebrationReaction ?? selectedReaction;
  const bumpedCareStats = bumpCareStats(bundle.careStats, action, consumableTreatItemId ?? undefined);
  const careStats =
    action === "treat"
      ? bumpTreatXpCounter(bumpedCareStats, now)
      : action === "talk"
        ? bumpTalkXpCounter(bumpedCareStats, now)
        : action === "play"
          ? bumpPlayXpCounter(bumpedCareStats, now)
          : bumpedCareStats;
  const memories = recordDaysTogetherMilestoneIfCrossed(streakReward.memories, pet.createdAt, now);

  const nextState: PrototypeSessionState = withActivePetBundle(
    {
      ...state,
      wallet: bondReward.wallet,
      inventory: streakReward.inventory,
      careStreak: nextCareStreak,
      activeBuffs
    },
    () => ({
      careState: result.nextState,
      relationshipState,
      lastCareReward: null,
      careStats,
      memories,
      ...appendReaction(bundle, finalReaction, now)
    })
  );

  return applyPrototypeDailyTicketRefill(nextState, now);
};

export const startPrototypeWalk = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW,
  durationMs: number = DEFAULT_WALK_DURATION_MS,
  itemId?: ItemId
): PrototypeSessionState => {
  const bundle = getActivePetBundle(state);

  if (bundle.activeWalk && bundle.activeWalk.status !== "claimed" && bundle.activeWalk.status !== "expired") {
    return state;
  }

  const pet = getActivePrototypePet(state, now);
  const returnAt = new Date(new Date(now).getTime() + durationMs).toISOString();
  const walk: WalkSession = {
    id: `walk_${new Date(now).getTime()}`,
    userId: pet.userId,
    petId: pet.id,
    status: "walking",
    startedAt: now,
    returnAt,
    rewardItemIds: [getWalkRewardItemIdForWeather(state.weatherState.context)],
    discoveryLine: getWalkDiscoveryLineForWeather(state.weatherState.context),
    energyCost: 12,
    createdAt: now,
    updatedAt: now
  };
  const careResult = applyLocalCareAction(
    bundle.careState,
    {
      action: "walk",
      occurredAt: now,
      ...(itemId ? { itemId } : {})
    },
    pruneActiveCareBuffs(state.activeBuffs, now)
  );
  const selectedReaction = selectLocalReaction(starterReactionRules, {
    locale: DEFAULT_PROTOTYPE_LOCALE,
    now,
    pet,
    careState: careResult.nextState,
    recentAction: "walk",
    walkStatus: "walking",
    weather: state.weatherState.context,
    recentReactions: bundle.recentReactions
  });

  const walkRelationshipState = applyRelationshipCareAction(bundle.relationshipState, "walk", now);
  const walkBondReward = applyBondLevelRewards(
    { wallet: state.wallet, inventory: state.inventory, memories: bundle.memories },
    bundle.relationshipState.bondLevel,
    walkRelationshipState.bondLevel,
    now
  );
  const nextCareStreak = updateCareStreakOnCare(state.careStreak, now);
  const streakReward = applyCareStreakSnackReward(walkBondReward.inventory, walkBondReward.memories, state.careStreak, nextCareStreak, now, pet.name);
  const careStats = bumpCareStats(bundle.careStats, "walk");
  const memories = recordDaysTogetherMilestoneIfCrossed(streakReward.memories, pet.createdAt, now);

  const nextState: PrototypeSessionState = withActivePetBundle(
    {
      ...state,
      wallet: walkBondReward.wallet,
      inventory: streakReward.inventory,
      careStreak: nextCareStreak
    },
    () => ({
      activeWalk: walk,
      careState: {
        ...careResult.nextState,
        activeWalkId: walk.id
      },
      relationshipState: walkRelationshipState,
      careStats,
      memories,
      ...appendReaction(bundle, walkBondReward.celebrationReaction ?? streakReward.celebrationReaction ?? selectedReaction, now)
    })
  );

  return applyPrototypeDailyTicketRefill(nextState, now);
};

export const refreshPrototypeWalk = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  const bundle = getActivePetBundle(state);

  if (!bundle.activeWalk || bundle.activeWalk.status !== "walking") {
    return state;
  }

  if (new Date(now).getTime() < new Date(bundle.activeWalk.returnAt).getTime()) {
    return state;
  }

  const pet = getActivePrototypePet(state, now);
  const careState: CareState = {
    ...bundle.careState,
    happiness: Math.min(100, bundle.careState.happiness + 6),
    updatedAt: now
  };
  const selectedReaction = selectLocalReaction(starterReactionRules, {
    locale: DEFAULT_PROTOTYPE_LOCALE,
    now,
    pet,
    careState,
    walkStatus: "returned",
    weather: state.weatherState.context,
    recentReactions: bundle.recentReactions
  });

  // The walk stays in "returned" until the user greets the pet and claims the
  // discovery via claimPrototypeWalkReward — coming home is a moment, not a tick.
  return withActivePetBundle(state, (currentBundle) => ({
    activeWalk: currentBundle.activeWalk
      ? {
          ...currentBundle.activeWalk,
          status: "returned",
          updatedAt: now
        }
      : currentBundle.activeWalk,
    careState,
    memories: recordDaysTogetherMilestoneIfCrossed(bundle.memories, pet.createdAt, now),
    ...appendReaction(bundle, selectedReaction, now)
  }));
};

/** Rewarded-ad hook: brings a walking pet home immediately. */
export const completePrototypeWalkEarly = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  const bundle = getActivePetBundle(state);

  if (!bundle.activeWalk || bundle.activeWalk.status !== "walking") {
    return state;
  }

  return refreshPrototypeWalk(
    withActivePetBundle(state, (currentBundle) => ({
      activeWalk: currentBundle.activeWalk
        ? {
            ...currentBundle.activeWalk,
            returnAt: now,
            updatedAt: now
          }
        : currentBundle.activeWalk
    })),
    now
  );
};

export type CompleteWalkEarlyWithCreditResult =
  | { ok: true; state: PrototypeSessionState }
  | { ok: false; reason: "insufficient_balance" | "no_active_walk" };

/**
 * Paid "bring home now" hook: spends credits and completes the walk in one
 * step. Transactional — the walk only completes if the credit spend
 * succeeds, so a failed spend never leaves the pet stuck walking with a
 * silently-lost credit (or vice versa).
 */
export const completePrototypeWalkEarlyWithCredit = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW,
  creditCost: number = 1
): CompleteWalkEarlyWithCreditResult => {
  const bundle = getActivePetBundle(state);

  if (!bundle.activeWalk || bundle.activeWalk.status !== "walking") {
    return { ok: false, reason: "no_active_walk" };
  }

  const walletSpend = spendCredits(state.wallet, creditCost, now);

  if (!walletSpend.ok) {
    return { ok: false, reason: "insufficient_balance" };
  }

  return {
    ok: true,
    state: completePrototypeWalkEarly({ ...state, wallet: walletSpend.wallet }, now)
  };
};

const grantInventoryItem = (
  inventory: Inventory,
  itemId: ItemId,
  now: string,
  source: InventorySource = "walk_reward"
): Inventory => {
  const existing = inventory.items.find((entry) => entry.itemId === itemId);
  const items: InventoryEntry[] = existing
    ? inventory.items.map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity + 1 } : entry))
    : [
        ...inventory.items,
        {
          itemId,
          quantity: 1,
          acquiredAt: now,
          source
        }
      ];

  return {
    ...inventory,
    items,
    updatedAt: now
  };
};

export const purchasePrototypeInventoryItem = (
  state: PrototypeSessionState,
  itemId: ItemId,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  const price = getCreditItemPrice(itemId);

  if (!price) {
    return state;
  }

  const walletSpend = spendCredits(state.wallet, price.creditCost, now);

  if (!walletSpend.ok) {
    return state;
  }

  return {
    ...state,
    wallet: walletSpend.wallet,
    inventory: grantInventoryItem(state.inventory, itemId, now, "purchase")
  };
};

export type PurchaseThemeBundleResult =
  | { ok: true; state: PrototypeSessionState; alreadyOwned: boolean }
  | { ok: false; reason: "bundle_not_found" | "insufficient_credits" };

/**
 * Buys (or, if already owned, simply re-applies for free) a theme: the first
 * purchase spends credits once, records the theme id in
 * inventory.ownedThemeIds, applies the background, and celebrates the
 * makeover. Any later call for an already-owned theme id skips the credit
 * spend entirely and just re-applies the background -- this is the fix for
 * the "same theme, two prices" trust bug: owning a theme should never mean
 * paying for it twice. Themes are background-only — no decor items are
 * granted.
 */
export const purchasePrototypeThemeBundle = (
  state: PrototypeSessionState,
  bundleId: string,
  now: string = FALLBACK_NOW
): PurchaseThemeBundleResult => {
  const themeBundle = getThemeBundleById(bundleId);

  if (!themeBundle) {
    return { ok: false, reason: "bundle_not_found" };
  }

  const alreadyOwned = (state.inventory.ownedThemeIds ?? []).includes(themeBundle.themeId);
  const walletSpend = alreadyOwned ? { ok: true as const, wallet: state.wallet } : spendCredits(state.wallet, themeBundle.creditCost, now);

  if (!walletSpend.ok) {
    return { ok: false, reason: "insufficient_credits" };
  }

  const inventory: Inventory = {
    ...state.inventory,
    selectedTerrariumThemeId: themeBundle.themeId,
    ownedThemeIds: alreadyOwned ? (state.inventory.ownedThemeIds ?? []) : [...(state.inventory.ownedThemeIds ?? []), themeBundle.themeId],
    updatedAt: now
  };

  const petBundle = getActivePetBundle(state);
  const pet = getActivePrototypePet(state, now);
  const selectedReaction = selectLocalReaction(starterReactionRules, {
    locale: DEFAULT_PROTOTYPE_LOCALE,
    now,
    pet,
    careState: petBundle.careState,
    eventContext: "item_placed",
    weather: state.weatherState.context,
    recentReactions: petBundle.recentReactions
  });

  // Only record a new "theme applied" memory the first time this theme is
  // purchased -- re-applying an already-owned theme doesn't need a fresh
  // memory entry every time (recordPetMemory would dedupe by id anyway since
  // the id is stable per themeId, but skip the extra work/celebration line churn).
  const memories = alreadyOwned
    ? petBundle.memories
    : recordPetMemory(petBundle.memories, {
        id: `mem_theme_${themeBundle.themeId}`,
        type: "theme_applied",
        occurredAt: now,
        line: `The garden looks different today. I like this new look on us.`,
        refs: { itemId: themeBundle.themeId }
      });

  return {
    ok: true,
    alreadyOwned,
    state: withActivePetBundle(
      {
        ...state,
        wallet: walletSpend.wallet,
        inventory
      },
      () => ({
        memories,
        ...appendReaction(petBundle, selectedReaction, now)
      })
    )
  };
};

export type ApplyThemeResult =
  | { ok: true; state: PrototypeSessionState }
  | { ok: false; reason: "theme_not_owned" };

/**
 * Applies a theme the player already owns (including the always-free default
 * theme) without touching the wallet. This is the only "free" theme path --
 * unlike the old applyTheme escape hatch it existed to replace, it refuses to
 * apply a theme that was never purchased, so there is no way to reach an
 * owned-but-unpaid state through this function.
 */
export const applyPrototypeTheme = (
  state: PrototypeSessionState,
  themeId: ItemId,
  now: string = FALLBACK_NOW
): ApplyThemeResult => {
  if (!(state.inventory.ownedThemeIds ?? []).includes(themeId)) {
    return { ok: false, reason: "theme_not_owned" };
  }

  return {
    ok: true,
    state: {
      ...state,
      inventory: {
        ...state.inventory,
        selectedTerrariumThemeId: themeId,
        updatedAt: now
      }
    }
  };
};

export type ValidatePrototypeExpressionPackPurchaseResult =
  | { ok: true; pack: ExpressionPack }
  | { ok: false; reason: "pack_not_found" | "already_owned" | "insufficient_credits" };

/**
 * Pre-flight check only -- never mutates the wallet. Expression pack
 * purchases are transactional across an async boundary (the credit charge is
 * only confirmed once the server-side generation job has actually started --
 * see confirmPrototypeExpressionPackPurchase below and
 * supabaseGenerationSession.ts's startSupabaseExpressionPackFlow), so the
 * provider layer calls this first to fail fast (already owned / can't
 * afford) before ever starting a job, without touching the wallet itself.
 */
export const validatePrototypeExpressionPackPurchase = (
  state: PrototypeSessionState,
  packId: string
): ValidatePrototypeExpressionPackPurchaseResult => {
  const pack = getExpressionPackById(packId);

  if (!pack) {
    return { ok: false, reason: "pack_not_found" };
  }

  if ((state.inventory.ownedExpressionPackIds ?? []).includes(pack.id)) {
    return { ok: false, reason: "already_owned" };
  }

  if (!canSpendCredits(state.wallet, pack.creditCost)) {
    return { ok: false, reason: "insufficient_credits" };
  }

  return { ok: true, pack };
};

export type ConfirmPrototypeExpressionPackPurchaseResult =
  | { ok: true; state: PrototypeSessionState }
  | { ok: false; reason: "pack_not_found" | "already_owned" | "insufficient_credits" };

/**
 * Confirms an expression pack purchase: spends credits, records ownership,
 * and leaves a warm "expression_pack" memory -- called only after the
 * provider layer has confirmed the server-side generation job actually
 * started (the "transactional across an async boundary" pattern also used by
 * completePrototypeWalkEarlyWithCredit, except here the thing being gated is
 * a job-start network call rather than a synchronous state change). Re-runs
 * the same ownership/balance checks as validatePrototypeExpressionPackPurchase
 * so a caller can never charge twice for a racing double-confirm.
 */
export const confirmPrototypeExpressionPackPurchase = (
  state: PrototypeSessionState,
  packId: string,
  now: string = FALLBACK_NOW
): ConfirmPrototypeExpressionPackPurchaseResult => {
  const validation = validatePrototypeExpressionPackPurchase(state, packId);

  if (!validation.ok) {
    return validation;
  }

  const walletSpend = spendCredits(state.wallet, validation.pack.creditCost, now);

  if (!walletSpend.ok) {
    return { ok: false, reason: "insufficient_credits" };
  }

  const inventory: Inventory = {
    ...state.inventory,
    ownedExpressionPackIds: [...(state.inventory.ownedExpressionPackIds ?? []), validation.pack.id],
    updatedAt: now
  };

  const memories = recordPetMemory(getActivePetBundle(state).memories, {
    id: `mem_expression_pack_${validation.pack.id}`,
    type: "expression_pack",
    occurredAt: now,
    line: `I picked up some new little expressions to share with you today.`,
    refs: { itemId: validation.pack.id }
  });

  return {
    ok: true,
    state: withActivePetBundle(
      {
        ...state,
        wallet: walletSpend.wallet,
        inventory
      },
      () => ({ memories })
    )
  };
};

/**
 * Merges newly generated expression-pack assets into acceptedAssets without
 * disturbing the existing free trio (idle/happy/sleep) or any other
 * previously unlocked pack -- an incoming asset replaces an existing one of
 * the same state (e.g. a re-roll), everything else is preserved untouched.
 * selectGeneratedAssetForReaction automatically starts using a merged-in
 * state the next time a matching reaction fires -- no separate "activate"
 * step is needed.
 */
export const mergePrototypeGeneratedAssets = (
  state: PrototypeSessionState,
  newAssets: readonly GeneratedAsset[]
): PrototypeSessionState => {
  if (newAssets.length === 0) {
    return state;
  }

  const bundle = getActivePetBundle(state);
  const byState = new Map(bundle.acceptedAssets.map((asset) => [asset.state, asset]));

  for (const asset of newAssets) {
    byState.set(asset.state, asset);
  }

  const acceptedAssets = [...byState.values()];

  return withActivePetBundle(state, () => ({
    acceptedAssets,
    acceptedAsset: bundle.acceptedAsset ?? acceptedAssets[0] ?? null
  }));
};

const clearCareWalkId = (careState: CareState, now: string): CareState => {
  const { activeWalkId: _activeWalkId, ...withoutWalk } = careState;

  return {
    ...withoutWalk,
    happiness: Math.min(100, careState.happiness + 6),
    updatedAt: now
  };
};

export const claimPrototypeWalkReward = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  const bundle = getActivePetBundle(state);

  if (!bundle.activeWalk || bundle.activeWalk.status !== "returned") {
    return state;
  }

  const pet = getActivePrototypePet(state, now);
  const careState = clearCareWalkId(bundle.careState, now);
  const selectedReaction = selectLocalReaction(starterReactionRules, {
    locale: DEFAULT_PROTOTYPE_LOCALE,
    now,
    pet,
    careState,
    eventContext: "walk_reward_claimed",
    weather: state.weatherState.context,
    recentReactions: bundle.recentReactions
  });
  const rewardItemId = bundle.activeWalk.rewardItemIds[0] ?? WALK_REWARD_ITEM_ID;
  const inventory = grantInventoryItem(state.inventory, rewardItemId, now);

  // Every walk also brings home one collectible for the walk journal.
  const collectible = rollWalkCollectible(state.weatherState.context.condition, bundle.activeWalk.id);
  const collectionUpdate = addToWalkCollection(state.walkCollection, collectible.id, now);
  const collectionCompleted =
    collectionUpdate.isNew && isWalkCollectionComplete(collectionUpdate.collection) && !isWalkCollectionComplete(state.walkCollection);
  const wallet = collectionCompleted
    ? grantCreditWalletValue(state.wallet, { bonusCredits: WALK_COLLECTION_COMPLETE_CREDITS }, now)
    : state.wallet;
  const collectibleName = DEFAULT_PROTOTYPE_LOCALE.startsWith("ko") ? collectible.nameKo : collectible.nameEn;
  const discoveryReaction: SelectedReaction | null = collectionCompleted
    ? {
        ruleId: "walk_collection_complete",
        category: "new_item",
        line: DEFAULT_PROTOTYPE_LOCALE.startsWith("ko")
          ? `도감 완성! 우리가 모은 작은 발견들이 전부 모였어. 정말 대단하지 않아?`
          : `Journal complete! Every little discovery we collected is here. Aren't we amazing?`,
        animation: "celebrate",
        priority: 100
      }
    : collectionUpdate.isNew
      ? {
          ruleId: `walk_discovery_${collectible.id}`,
          category: "new_item",
          line: DEFAULT_PROTOTYPE_LOCALE.startsWith("ko")
            ? `새 발견이야! ${collectibleName}${collectible.rarity === "rare" ? "... 이건 정말 귀한 거야!" : "을(를) 주워왔어."}`
            : `A new find! I brought home a ${collectibleName}${collectible.rarity === "rare" ? "... this one is really special!" : "."}`,
          animation: collectible.rarity === "rare" ? "celebrate" : "walk_return",
          priority: 100
        }
      : null;

  // This walk's careStats.walkCount was already bumped by startPrototypeWalk,
  // so a value of exactly 1 here means the walk being claimed right now was
  // the very first one ever completed.
  const isFirstWalk = bundle.careStats.walkCount === 1;
  let memories = isFirstWalk
    ? recordPetMemory(bundle.memories, {
        id: "mem_first_walk",
        type: "first_walk",
        occurredAt: now,
        line: "I came back from my very first walk with you.",
        refs: { weather: state.weatherState.context.condition }
      })
    : bundle.memories;

  if (collectionUpdate.isNew) {
    memories = recordPetMemory(memories, {
      id: "mem_first_find",
      type: "first_find",
      occurredAt: now,
      line: "I brought back my very first walk find.",
      refs: { collectibleId: collectible.id }
    });
  }

  if (collectible.rarity === "rare") {
    memories = recordPetMemory(memories, {
      id: `mem_rare_find_${collectible.id}_${now}`,
      type: "rare_find",
      occurredAt: now,
      line: "I found something rainbow-rare on our walk!",
      refs: { collectibleId: collectible.id }
    });
  }

  if (collectionCompleted) {
    memories = recordPetMemory(memories, {
      id: "mem_collection_complete",
      type: "collection_complete",
      occurredAt: now,
      line: "Our walk journal is complete. Every little discovery, all in one place.",
      refs: {}
    });
  }

  memories = recordDaysTogetherMilestoneIfCrossed(memories, pet.createdAt, now);

  return withActivePetBundle(
    {
      ...state,
      inventory,
      wallet,
      walkCollection: collectionUpdate.collection
    },
    () => ({
      activeWalk: null,
      careState,
      lastWalkDiscovery: { collectibleId: collectible.id, isNew: collectionUpdate.isNew, collectionCompleted },
      lastCareReward: { type: "item", itemId: rewardItemId, quantity: 1 },
      memories,
      ...appendReaction(bundle, discoveryReaction ?? selectedReaction, now)
    })
  );
};

export const reportPrototypeGenerationIssue = (
  state: PrototypeSessionState,
  category: GenerationIssueCategory,
  now: string = FALLBACK_NOW
): PrototypeSessionState => {
  const pet = getActivePrototypePet(state, now);

  return withActivePetBundle(state, () => ({
    generationIssueReport: {
      category,
      petId: pet.id,
      generationStatus: state.generation.status,
      reportedAt: now
    }
  }));
};

export const deletePrototypeOriginalPhoto = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState =>
  withActivePetBundle(
    {
      ...state,
      originalPhotoDeletedAt: now,
      photo: {
        ...state.photo,
        selectedMockPhoto: false,
        selectedPhotoUri: null,
        byteSize: null,
        mimeType: null,
        source: "none"
      }
    },
    (bundle) => ({
      petProfile: bundle.petProfile ? { ...bundle.petProfile, originalPhotoDeletedAt: now, updatedAt: now } : null
    })
  );

export const deletePrototypeChatHistory = (
  state: PrototypeSessionState,
  now: string = FALLBACK_NOW
): PrototypeSessionState => ({
  ...state,
  chatHistoryDeletedAt: now
});
