import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

import {
  acceptPrototypeGeneratedPet,
  advancePrototypeGeneration,
  canContinuePetSetup,
  canContinuePhotoStep,
  canCreatePet,
  applyPrototypeTheme,
  clearPendingExpressionPackJob,
  confirmPrototypeExpressionPackPurchase,
  recordExpressionPackJobStart,
  recordExpressionPackUnlock,
  createPersistedSessionEnvelope,
  isValidPrototypeSessionShape,
  runSessionMigrations,
  purchasePrototypeThemeBundle,
  claimPrototypeWalkReward,
  completePrototypeWalkEarlyWithCredit,
  createInitialPrototypeSession,
  createInitialPetBundle,
  deletePrototypeChatHistory,
  deletePrototypeOriginalPhoto,
  FIRST_PET_ID,
  getActivePetBundle,
  getActivePrototypePet,
  getBondProgressValue,
  getCareSatisfactionSummary,
  getCreditItemPrice,
  getExpressionPackById,
  getGenerationAttemptKey,
  getMonotonicGenerationProgress,
  getPrototypeGenerationPollSnapshot,
  getSpendableCreditBalance,
  makeMockGeneratedAsset,
  mergePrototypeGeneratedAssets,
  normalizeRestoredGeneration,
  normalizeRestoredPetSetupDraft,
  parseSessionBackup,
  pollPrototypeGenerationJob,
  performPrototypeCareAction,
  projectCareStateForTime,
  purchasePrototypeInventoryItem,
  refreshPrototypeWalk,
  reportPrototypeGenerationIssue,
  retryPrototypeGeneration,
  serializeSessionBackup,
  setPrototypeConsentAccepted,
  setPrototypeMockPhotoSelected,
  setPrototypeSelectedPhotoUri,
  setPrototypeWeatherCondition,
  setPrototypeWeatherEnabled,
  startPrototypeGeneration,
  togglePrototypePersonalityTag,
  updatePrototypeDraft,
  validatePrototypeExpressionPackPurchase,
  withActivePetBundle
} from "@mongchi/shared";
import type {
  CareActionType,
  CareSatisfactionSummary,
  CommerceProduct,
  CreditWallet,
  Entitlement,
  GeneratedAsset,
  GeneratedAssetId,
  GenerationIssueCategory,
  Inventory,
  Item,
  ItemId,
  PersonalityTag,
  PetBundle,
  PetSetupDraft,
  PrototypeSessionState,
  RestorePurchasesRequest,
  WeatherCondition,
  WalkSession
} from "@mongchi/shared";
import { homeWalkDurationMs } from "../terrarium/terrariumHomeInteractionContract";
import type { MobileApiError } from "../../shared/api";
import { reporter } from "../../shared/errors/reporter";

import {
  acceptApiGeneratedPet,
  createConfiguredGenerationApiClient,
  pollApiGenerationFlow,
  retryApiGenerationFlow,
  startApiGenerationFlow
} from "./apiGenerationSession";
import { createAsyncActionGuard } from "./asyncActionGuard";
import { hasActiveGenerationJob } from "./generationJobGuards";
import { getSupabaseClient } from "./supabaseClient";
import { deleteSupabaseAccountData } from "./supabaseAccountDeletion";
import {
  hydrateServerCreditBalance,
  pollSupabaseExpressionPackFlow,
  pollSupabaseGenerationFlow,
  retrySupabaseGenerationFlow,
  startSupabaseExpressionPackFlow,
  startSupabaseGenerationFlow
} from "./supabaseGenerationSession";
import {
  claimApiDailyLoopWalkReward,
  createConfiguredDailyLoopApiClient,
  loadApiDailyLoopState,
  performApiDailyLoopCareAction,
  refreshApiWalkLocally
} from "./apiDailyLoopSession";
import type { TerrariumRuntimeMode } from "./apiDailyLoopSession";
import {
  resolveGeneratedAssetReadUrl,
  shouldRefreshGeneratedAssetReadUrl
} from "./generatedAssetReadUrl";
import type { GeneratedAssetReadUrlCacheEntry } from "./generatedAssetReadUrl";
import { buildGeneratedAssetUriMap } from "./generatedAssetUriMap";
import {
  buildStoreRestorePurchasesRequest,
  buildStorePurchaseVerificationRequest,
  getNativePurchasePlatform,
  isNativeStoreCheckoutEnabled,
  startNativeStorePurchaseConnection
} from "./nativeStorePurchases";
import type { NativeStorePurchaseConnection } from "./nativeStorePurchases";
import { createQaScreenSession, getConfiguredQaScreenPreset, getQaScreenApiState } from "./qaScreenSession";
import { getRuntimeActiveEntitlements, getRuntimeCatalogItems } from "./runtimePresentationData";
import { createStoreScreenshotSession, getConfiguredStoreScreenshotPreset } from "./storeScreenshotSession";
import {
  refreshApproximateLocationWeather,
  type LocationWeatherRefreshStatus
} from "./locationWeatherSession";
import {
  clearCareActionCooldowns,
  readCareActionCooldowns,
  writeCareActionCooldowns
} from "./careActionCooldownSession";
import type { Purchase } from "expo-iap";

type RestorePurchasesResult =
  | {
      ok: true;
      mode: TerrariumRuntimeMode;
      restoredCount: number;
      serverVerified: boolean;
    }
  | {
      ok: false;
      messageSafe: string;
    };

type PurchaseProductResult =
  | {
      ok: true;
      mode: TerrariumRuntimeMode;
      messageSafe: string;
    }
  | {
      ok: false;
      messageSafe: string;
    };

type PurchaseCatalogItemResult =
  | {
      ok: true;
      mode: TerrariumRuntimeMode;
      messageSafe: string;
      placed: boolean;
    }
  | {
      ok: false;
      messageSafe: string;
    };

export type PurchaseExpressionPackResult =
  | { ok: true; messageSafe: string }
  | { ok: false; messageSafe: string };

/**
 * resetSession's result. `ok` mirrors the pre-existing boolean contract:
 * false only when the legacy api-mode block (services/api's deletePrivacyPet)
 * fails and aborts before any local wipe happens -- callers should not
 * navigate away in that case, same as before this type existed. `true`
 * means the local device reset happened (as it unconditionally does once
 * that legacy block is past); `serverDeleteWarning`, when present, means the
 * Supabase-backed delete-account call (see supabaseAccountDeletion.ts)
 * could not confirm full server-side deletion and the caller should surface
 * a warm "try again later" notice -- see resetSession's doc comment.
 */
export type ResetSessionResult = { ok: boolean; serverDeleteWarning?: string };

/** "Back up your friend": hands back the exact JSON text to share/save. Pure read of the current in-memory session -- never touches storage. */
export type ExportSessionBackupResult = { ok: true; backupText: string } | { ok: false; messageSafe: string };

export type ImportSessionBackupResult =
  | { ok: true }
  | { ok: false; reason: "empty_input" | "invalid_json" | "unmigratable_version" | "invalid_shape"; messageSafe: string };

/** Per-pack lifecycle for the friend page's pose gallery -- "pending" covers both the job-start call and the poll loop that follows it. */
export type ExpressionPackPurchaseStatus = "pending" | "failed";

export interface ExpressionPackPurchaseState {
  status: ExpressionPackPurchaseStatus;
  failureMessageSafe?: string;
}

interface TerrariumSessionContextValue extends PrototypeSessionState, PetBundle {
  activePet: ReturnType<typeof getActivePrototypePet>;
  catalogItems: Item[];
  careCooldownUntilByAction: Partial<Record<CareActionType, number>>;
  canContinuePetSetup: boolean;
  canContinuePhotoStep: boolean;
  canCreatePet: boolean;
  satisfactionScore: number;
  satisfactionSummary: CareSatisfactionSummary;
  bondProgress: number;
  creditBalance: number;
  generationProgress: number;
  generationPollSnapshot: ReturnType<typeof getPrototypeGenerationPollSnapshot>;
  generatedAssetUriById: Partial<Record<GeneratedAssetId, string>>;
  commerceProducts: CommerceProduct[];
  activeEntitlements: Entitlement[];
  entitlementsCount: number;
  hasPremiumChatEntitlement: boolean;
  isHydrated: boolean;
  runtimeMode: TerrariumRuntimeMode;
  apiSyncStatus: "idle" | "syncing" | "ready" | "error";
  apiErrorMessage: string | null;
  nativeCheckoutReady: boolean;
  purchaseInProgressProductId: string | null;
  purchaseStatusMessage: string | null;
  devStoreUnlocked: boolean;
  weatherLocationStatus: LocationWeatherRefreshStatus;
  weatherLocationMessage: string | null;
  updateDraft: (patch: Partial<PetSetupDraft>) => void;
  togglePersonalityTag: (tag: PersonalityTag) => void;
  setMockPhotoSelected: (selected: boolean) => void;
  setSelectedPhotoUri: (
    uri: string,
    source: "library" | "camera",
    metadata?: { byteSize?: number | null; mimeType?: string | null }
  ) => void;
  setConsentAccepted: (accepted: boolean) => void;
  startMockGeneration: () => void;
  advanceMockGeneration: () => void;
  pollMockGeneration: (options?: { force?: boolean }) => void;
  retryMockGeneration: () => void;
  acceptGeneratedPet: () => void;
  performCareAction: (action: CareActionType, itemId?: ItemId) => void;
  setCareActionCooldown: (action: CareActionType, cooldownUntil: number) => void;
  setWeatherScenesEnabled: (enabled: boolean) => void;
  setManualWeatherCondition: (condition: WeatherCondition) => void;
  refreshWeatherFromApproximateLocation: () => Promise<boolean>;
  refreshWalk: () => void;
  claimWalkReward: () => void;
  /** Spends 1 credit to bring the pet home early. Returns false (no-op) if the wallet balance is insufficient. */
  completeWalkEarly: () => boolean;
  applyTheme: (themeId: ItemId) => PurchaseCatalogItemResult;
  purchaseThemeBundle: (bundleId: string) => PurchaseCatalogItemResult;
  /** Per-pack id status for the friend page's pose gallery (pending job-start/poll, or a warm failure message). Absent = not currently purchasing. */
  expressionPackPurchaseStatusById: Partial<Record<string, ExpressionPackPurchaseState>>;
  /** Starts (or confirms failure fast for) an expression pack purchase -- see purchaseExpressionPack's doc comment for the full state machine. */
  purchaseExpressionPack: (packId: string) => Promise<PurchaseExpressionPackResult>;
  reportGenerationIssue: (category: GenerationIssueCategory) => void;
  deleteOriginalPhoto: () => void;
  deleteChatHistory: () => void;
  purchaseCatalogItem: (itemId: ItemId) => Promise<PurchaseCatalogItemResult>;
  purchaseProduct: (product: CommerceProduct) => Promise<PurchaseProductResult>;
  restorePurchases: () => Promise<RestorePurchasesResult>;
  syncWallet: (wallet: CreditWallet) => void;
  /** Refreshes wallet.credits from the server (credit_wallets via get_credit_balance) -- see hydrateCreditBalance's doc comment. No-op without a Supabase client or on a failed fetch. */
  hydrateCreditBalance: () => Promise<void>;
  resetSession: () => Promise<ResetSessionResult>;
  /** Serializes the current session as shareable backup text (see ExportSessionBackupResult's doc comment). */
  exportSessionBackup: () => ExportSessionBackupResult;
  /** Validates, migrates, and restores a pasted backup (see ImportSessionBackupResult's doc comment). */
  importSessionBackup: (backupText: string) => Promise<ImportSessionBackupResult>;
}

const STORAGE_KEY = "mongchi/prototype-session-v1";
// Destination for the raw payload when restore ultimately fails (parse error,
// unmigratable version, or invalid shape after migration) — deletion is a
// last resort, so the original data is moved here instead of discarded.
const CORRUPT_SESSION_BACKUP_KEY = `${STORAGE_KEY}.corrupt-backup`;
// Snapshot of the session immediately before a user-initiated backup
// import overwrites it — lets "Restore from backup" be undone by re-running
// import against this key's contents if the pasted backup turns out to be
// the wrong one. Distinct from CORRUPT_SESSION_BACKUP_KEY (that one is for
// data the app itself couldn't make sense of on cold start).
const PRE_IMPORT_SNAPSHOT_KEY = `${STORAGE_KEY}.pre-import-snapshot`;
const DEVELOPMENT_STORE_CREDIT_BALANCE = 9999;
// How often a pending expression-pack job is re-polled -- fast enough to
// feel responsive for a soft-progress purchase UX, without hammering the
// generation_jobs table. The interval that uses this only runs while at
// least one pack purchase is pending.
const EXPRESSION_PACK_POLL_INTERVAL_MS = 2500;

const nowIso = () => new Date().toISOString();

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isDevelopmentStoreUnlockEnabled = () =>
  process.env.EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE === "true" ||
  (process.env.NODE_ENV === "development" && process.env.EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE !== "false");

const getDevelopmentWalletForPurchase = (wallet: CreditWallet, minimumCreditBalance: number, updatedAt: string): CreditWallet => {
  const balance = getSpendableCreditBalance(wallet);

  if (balance >= minimumCreditBalance) {
    return wallet;
  }

  return {
    ...wallet,
    bonusCredits: wallet.bonusCredits + minimumCreditBalance - balance,
    updatedAt
  };
};

const withDevelopmentPurchaseWallet = (
  state: PrototypeSessionState,
  minimumCreditBalance: number,
  updatedAt: string
): PrototypeSessionState => ({
  ...state,
  wallet: getDevelopmentWalletForPurchase(state.wallet, minimumCreditBalance, updatedAt)
});

const getDevelopmentStoreEntitlements = (userId: CreditWallet["userId"], now: string): Entitlement[] => [
  {
    id: "ent_dev_premium_chat",
    userId,
    key: "premium_chat",
    status: "active",
    source: "admin_grant",
    startsAt: now,
    ledgerEntryId: "ledger_dev_premium_chat",
    metadata: { developmentUnlock: true },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "ent_dev_extra_pet_slot",
    userId,
    key: "extra_pet_slot",
    status: "active",
    source: "admin_grant",
    startsAt: now,
    ledgerEntryId: "ledger_dev_extra_pet_slot",
    metadata: { developmentUnlock: true },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "ent_dev_regeneration_credit",
    userId,
    key: "regeneration_credit",
    status: "active",
    source: "admin_grant",
    startsAt: now,
    ledgerEntryId: "ledger_dev_regeneration_credit",
    metadata: { developmentUnlock: true },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "ent_dev_theme_pack",
    userId,
    key: "theme_pack",
    status: "active",
    source: "admin_grant",
    startsAt: now,
    ledgerEntryId: "ledger_dev_theme_pack",
    metadata: { developmentUnlock: true },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "ent_dev_item_pack",
    userId,
    key: "item_pack",
    status: "active",
    source: "admin_grant",
    startsAt: now,
    ledgerEntryId: "ledger_dev_item_pack",
    metadata: { developmentUnlock: true },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "ent_dev_treat_pack",
    userId,
    key: "treat_pack",
    status: "active",
    source: "admin_grant",
    startsAt: now,
    ledgerEntryId: "ledger_dev_treat_pack",
    metadata: { developmentUnlock: true },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "ent_dev_subscription_plus",
    userId,
    key: "subscription_plus",
    status: "active",
    source: "admin_grant",
    startsAt: now,
    ledgerEntryId: "ledger_dev_subscription_plus",
    metadata: { developmentUnlock: true },
    createdAt: now,
    updatedAt: now
  }
];

const mergeEntitlements = (current: Entitlement[], incoming: Entitlement[]): Entitlement[] => {
  const merged = new Map(current.map((entitlement) => [entitlement.id, entitlement]));

  for (const entitlement of incoming) {
    merged.set(entitlement.id, entitlement);
  }

  return [...merged.values()];
};

const mergePlantGrowthEntries = (
  currentEntries: NonNullable<Inventory["plantGrowth"]> = [],
  incomingEntries: NonNullable<Inventory["plantGrowth"]> = []
): NonNullable<Inventory["plantGrowth"]> => {
  const merged = new Map(currentEntries.map((entry) => [entry.itemId, entry]));

  for (const entry of incomingEntries) {
    merged.set(entry.itemId, entry);
  }

  return [...merged.values()];
};

const preserveInventoryPlantGrowth = (currentInventory: Inventory, incomingInventory: Inventory): Inventory => ({
  ...incomingInventory,
  plantGrowth: mergePlantGrowthEntries(currentInventory.plantGrowth ?? [], incomingInventory.plantGrowth ?? [])
});

// Lenient per-bundle shape merge: fills in any missing/partial PetBundle
// fields from a freshly created bundle so an older or slightly malformed
// save's pet still hydrates instead of failing outright. Mirrors the
// acceptedAsset(s)-derived-from-either-shape leniency the old flat-state
// merge used to apply at the top level.
const mergeRestoredPetBundle = (fallback: PetBundle, restored: Record<string, unknown>): PetBundle => {
  const acceptedAssets = Array.isArray(restored.acceptedAssets)
    ? (restored.acceptedAssets as GeneratedAsset[])
    : restored.acceptedAsset
      ? [restored.acceptedAsset as GeneratedAsset]
      : fallback.acceptedAssets;

  return {
    ...fallback,
    ...restored,
    acceptedAssets,
    relationshipState: isObject(restored.relationshipState)
      ? (restored.relationshipState as unknown as PetBundle["relationshipState"])
      : {
          ...fallback.relationshipState,
          petId: isObject(restored.petProfile) && typeof restored.petProfile.id === "string" ? restored.petProfile.id : fallback.relationshipState.petId
        },
    lastCareReward: (restored.lastCareReward as PetBundle["lastCareReward"] | undefined) ?? null,
    generationIssueReport: (restored.generationIssueReport as PetBundle["generationIssueReport"] | undefined) ?? null
  } as PetBundle;
};

// Lenient shape merge: given a validated (post-migration) raw payload, fills
// in any missing/partial nested fields from a freshly created session so
// older or slightly malformed saves still hydrate instead of failing outright.
const mergeRestoredSession = (value: Record<string, unknown>): PrototypeSessionState => {
  const restored = value as unknown as PrototypeSessionState & {
    pets?: unknown;
    activePetId?: unknown;
  };
  const fallback = createInitialPrototypeSession(nowIso());
  const restoredInventory = isObject(restored.inventory)
    ? {
        ...fallback.inventory,
        ...restored.inventory,
        plantGrowth: Array.isArray(restored.inventory.plantGrowth) ? restored.inventory.plantGrowth : (fallback.inventory.plantGrowth ?? [])
      }
    : {
        ...fallback.inventory,
        plantGrowth: fallback.inventory.plantGrowth ?? []
      };

  // Bundle/activePetId normalization (design doc pitfall 3): a corrupted or
  // partial save might be missing `pets` entirely, have an empty `pets`, or
  // have an `activePetId` that doesn't point at any key in `pets`. Any of
  // these would make getActivePetBundle crash on every subsequent read, so
  // this is the one place that re-establishes INV-2 (activePetId is always
  // a valid key of pets) at the restore boundary.
  const restoredPetsRaw = (isObject(restored.pets) ? restored.pets : {}) as Record<string, unknown>;
  const restoredPetIds = Object.keys(restoredPetsRaw);
  const activePetId =
    typeof restored.activePetId === "string" && restoredPetIds.includes(restored.activePetId)
      ? restored.activePetId
      : (restoredPetIds[0] ?? FIRST_PET_ID);
  const pets: PrototypeSessionState["pets"] =
    restoredPetIds.length > 0
      ? Object.fromEntries(
          restoredPetIds.map((petId) => [
            petId,
            mergeRestoredPetBundle(createInitialPetBundle(nowIso(), petId), restoredPetsRaw[petId] as Record<string, unknown>)
          ])
        )
      : { [activePetId]: createInitialPetBundle(nowIso(), activePetId) };

  const merged: PrototypeSessionState = {
    ...fallback,
    ...restored,
    draft: normalizeRestoredPetSetupDraft(restored.draft),
    pets,
    activePetId,
    inventory: restoredInventory,
    wallet: restored.wallet ?? fallback.wallet,
    weatherState: restored.weatherState ?? fallback.weatherState
  };

  // Restore-time normalization (design audit invariant I6): a session
  // persisted while a generation job was actively mid-flight (app killed
  // between poll ticks) or stranded at "completed" with no assets yet
  // signed would otherwise permanently block both auto-start (which treats
  // any non-terminal status as "already active") and manual retry, with no
  // poller left running to ever move it forward. See
  // normalizeRestoredGeneration for the exact repair rules.
  return normalizeRestoredGeneration(merged, nowIso());
};

// Restore pipeline: (a) the caller has already JSON.parsed the stored string,
// (b) apply sequential schema migrations from whatever version was stored up
// to CURRENT_SESSION_SCHEMA_VERSION, (c) shallow-validate the migrated shape.
// Deletion is a last resort — see the corrupt-backup handling in the
// hydration effect below, which only runs once this returns null.
const restoreSession = (rawValue: unknown): PrototypeSessionState | null => {
  const migrationResult = runSessionMigrations(rawValue);

  if (!migrationResult.ok) {
    return null;
  }

  if (!isValidPrototypeSessionShape(migrationResult.state)) {
    return null;
  }

  return mergeRestoredSession(migrationResult.state);
};

const TerrariumSessionContext = createContext<TerrariumSessionContextValue | null>(null);

export function TerrariumSessionProvider({ children }: { children: ReactNode }) {
  const [storeScreenshotPreset] = useState(() => getConfiguredStoreScreenshotPreset());
  const [qaScreenPreset] = useState(() => getConfiguredQaScreenPreset());
  const [state, setState] = useState<PrototypeSessionState>(() =>
    storeScreenshotPreset
      ? createStoreScreenshotSession(storeScreenshotPreset, nowIso())
      : qaScreenPreset
        ? createQaScreenSession(qaScreenPreset, nowIso())
        : createInitialPrototypeSession(nowIso())
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [apiRuntime] = useState(() => createConfiguredDailyLoopApiClient());
  const [generationApiRuntime] = useState(() => createConfiguredGenerationApiClient());
  const [apiCatalogItems, setApiCatalogItems] = useState<Item[] | null>(null);
  const [apiCommerceProducts, setApiCommerceProducts] = useState<CommerceProduct[] | null>(null);
  const [apiEntitlements, setApiEntitlements] = useState<Entitlement[] | null>(null);
  const [generatedAssetReadUrls, setGeneratedAssetReadUrls] = useState<Partial<Record<GeneratedAssetId, GeneratedAssetReadUrlCacheEntry>>>({});
  const nativeStoreConnection = useRef<NativeStorePurchaseConnection | null>(null);
  const [nativeCheckoutReady, setNativeCheckoutReady] = useState(false);
  const [purchaseInProgressProductId, setPurchaseInProgressProductId] = useState<string | null>(null);
  const [purchaseStatusMessage, setPurchaseStatusMessage] = useState<string | null>(null);
  const [weatherLocationStatus, setWeatherLocationStatus] = useState<LocationWeatherRefreshStatus>("idle");
  const [weatherLocationMessage, setWeatherLocationMessage] = useState<string | null>(null);
  const [sessionClock, setSessionClock] = useState(() => Date.now());
  const [careCooldownUntilByAction, setCareCooldownUntilByAction] = useState<Partial<Record<CareActionType, number>>>({});
  // Expression pack purchases: keyed by packId so the friend page's pose
  // gallery can show per-pack progress/failure independent of any other UI.
  const [expressionPackPurchaseStatusById, setExpressionPackPurchaseStatusById] = useState<
    Partial<Record<string, ExpressionPackPurchaseState>>
  >({});
  // Job ids currently being polled, keyed by packId -- read by the polling
  // effect below so it keeps running across re-renders/navigation (the
  // effect lives in the provider, not in any one screen).
  const [expressionPackJobIdByPackId, setExpressionPackJobIdByPackId] = useState<Partial<Record<string, string>>>({});
  const expressionPackPollGuard = useRef(createAsyncActionGuard());
  const expressionPackInFlightPackIdsRef = useRef<Set<string>>(new Set());
  // In-flight guards for the generation start/poll/retry flows. These calls
  // are triggered both from explicit user taps and from effects (see
  // GenerationScreen's poll interval and mount-triggered start), so a guard
  // held in a ref (rather than component state, which only updates on the
  // next render) is needed to prevent duplicate network calls — e.g. rapid
  // double-taps on "Try again" invoking generate-avatar more than once
  // before the first call's state update lands.
  const generationStartGuard = useRef(createAsyncActionGuard());
  const generationPollGuard = useRef(createAsyncActionGuard());
  const generationRetryGuard = useRef(createAsyncActionGuard());
  // Display-only gauge memory: the generation progress bar must never appear
  // to move backward, even though the underlying poll response occasionally
  // does (an out-of-order/stale poll landing after a newer one). Keyed on
  // getGenerationAttemptKey so a genuinely new attempt (fresh job or retry)
  // still resets the gauge to 0 instead of getting stuck at the previous
  // attempt's high point.
  const generationProgressGaugeRef = useRef<{ attemptKey: string; maxProgress: number }>({
    attemptKey: "",
    maxProgress: 0
  });
  const [initialQaApiState] = useState(() => getQaScreenApiState(qaScreenPreset));
  const [apiSyncStatus, setApiSyncStatus] = useState<"idle" | "syncing" | "ready" | "error">(
    initialQaApiState?.status ?? (apiRuntime.error || generationApiRuntime.error ? "error" : "idle")
  );
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(
    initialQaApiState?.message ?? apiRuntime.error?.messageSafe ?? generationApiRuntime.error?.messageSafe ?? null
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (storeScreenshotPreset) {
        if (!cancelled) {
          setState(createStoreScreenshotSession(storeScreenshotPreset, nowIso()));
          setIsHydrated(true);
        }
        return;
      }

      if (qaScreenPreset) {
        if (!cancelled) {
          setState(createQaScreenSession(qaScreenPreset, nowIso()));
          setIsHydrated(true);
        }
        return;
      }

      try {
        const [stored, storedCooldowns] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          readCareActionCooldowns(AsyncStorage, Date.now())
        ]);

        if (stored) {
          // Pipeline: (a) parse, (b) migrate, (c) validate. Deletion is a
          // last resort: if any step fails, back the raw payload up under a
          // separate key instead of silently discarding a user's progress.
          let parsedJson: unknown;
          let parseFailed = false;

          try {
            parsedJson = JSON.parse(stored);
          } catch {
            parseFailed = true;
          }

          const restored = parseFailed ? null : restoreSession(parsedJson);

          if (restored) {
            if (!cancelled) {
              setState(restored);
            }
          } else {
            reporter.captureMessage("session restore: corrupt/unmigratable session backed up", {
              parseFailed
            });
            await AsyncStorage.setItem(CORRUPT_SESSION_BACKUP_KEY, stored);
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }

        if (!cancelled) {
          setCareCooldownUntilByAction(storedCooldowns);
        }
      } catch (cause) {
        // Unexpected failure reading storage itself (not a parse/shape
        // failure) — leave the stored session untouched so a transient
        // AsyncStorage error can't wipe local progress; the app continues
        // with a fresh in-memory session for this run.
        reporter.captureMessage("session restore: unexpected storage read failure", {
          cause: cause instanceof Error ? cause.message : String(cause)
        });
        if (!cancelled) {
          await clearCareActionCooldowns(AsyncStorage);
        }
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [qaScreenPreset, storeScreenshotPreset]);

  useEffect(() => {
    if (!isHydrated || storeScreenshotPreset || qaScreenPreset) {
      return;
    }

    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(createPersistedSessionEnvelope(state)));
  }, [isHydrated, qaScreenPreset, state, storeScreenshotPreset]);

  useEffect(() => {
    if (!isHydrated || storeScreenshotPreset || qaScreenPreset) {
      return;
    }

    void writeCareActionCooldowns(AsyncStorage, careCooldownUntilByAction, Date.now());
  }, [careCooldownUntilByAction, isHydrated, qaScreenPreset, storeScreenshotPreset]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionClock(Date.now());
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const now = sessionClock;

    setCareCooldownUntilByAction((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, cooldownUntil]) => cooldownUntil > now)) as Partial<
        Record<CareActionType, number>
      >;

      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [sessionClock]);

  const activePet = useMemo(() => getActivePrototypePet(state, nowIso()), [state]);
  // The one compatibility seam that lets the rest of this provider (and
  // every UI component below it) keep reading per-pet fields
  // (careState/relationshipState/acceptedAsset(s)/activeWalk/etc.) as if
  // they were still top-level PrototypeSessionState fields, even though W1
  // moved them into state.pets[activePetId]. See docs/multi-pet-w1-design.md
  // section 3. UI components are never touched by W1 -- this is the only
  // place that bridges old shape <-> new shape.
  const activeBundle = useMemo(() => getActivePetBundle(state), [state]);
  const catalogItems = useMemo(() => getRuntimeCatalogItems(apiRuntime.mode, apiCatalogItems), [apiCatalogItems, apiRuntime.mode]);
  const activeGeneratedAssetId = activeBundle.acceptedAsset?.id ?? activePet.activeAssetId ?? null;
  const generatedAssetIdsToResolve = useMemo(
    () =>
      Array.from(
        new Set(
          [activeGeneratedAssetId, ...activeBundle.acceptedAssets.map((asset) => asset.id)].filter(
            (assetId): assetId is GeneratedAssetId => typeof assetId === "string" && assetId.length > 0
          )
        )
      ),
    [activeGeneratedAssetId, activeBundle.acceptedAssets]
  );

  // apiDailyLoopSession.ts/apiGenerationSession.ts/supabaseGenerationSession.ts
  // (W1 leaves these files untouched, see docs/multi-pet-w1-design.md section
  // 3.3/4.4) return Partial<PrototypeSessionState> patches that still use the
  // pre-W1 flat per-pet keys (careState/relationshipState/petProfile/
  // acceptedAsset(s)/activeWalk/currentReaction/lastCareReward/
  // generationIssueReport) -- this adapter routes those keys into the active
  // bundle instead of setting them as (now-nonexistent) top-level fields,
  // while shared keys (wallet/inventory/etc.) still land at the top level.
  const PET_BUNDLE_PATCH_KEYS = [
    "petProfile",
    "acceptedAsset",
    "acceptedAssets",
    "careState",
    "relationshipState",
    "currentReaction",
    "lastCareReward",
    "recentReactions",
    "activeWalk",
    "lastWalkDiscovery",
    "generationIssueReport",
    "memories",
    "careStats"
  ] as const;

  const applyApiStatePatch = useCallback((patch: Partial<PrototypeSessionState> & Partial<PetBundle>) => {
    setState((current) => {
      const bundlePatch: Partial<PetBundle> = {};
      const topPatch: Record<string, unknown> = {};

      for (const [key, fieldValue] of Object.entries(patch)) {
        if ((PET_BUNDLE_PATCH_KEYS as readonly string[]).includes(key)) {
          (bundlePatch as Record<string, unknown>)[key] = fieldValue;
        } else {
          topPatch[key] = fieldValue;
        }
      }

      const next = { ...current, ...topPatch } as PrototypeSessionState;

      return Object.keys(bundlePatch).length > 0 ? withActivePetBundle(next, () => bundlePatch) : next;
    });
  }, []);

  // Legacy flat-state view for the external session helper modules
  // (apiDailyLoopSession.ts/apiGenerationSession.ts/supabaseGenerationSession.ts)
  // that still read `state.petProfile`/`state.careState`/`state.activeWalk`/
  // etc. directly as top-level PrototypeSessionState fields -- those files
  // are explicitly out of scope for W1 (see docs/multi-pet-w1-design.md
  // sections 3.3/4.4), so this reconstructs the shape they expect from the
  // current active bundle instead of editing every read site in those files.
  const legacyFlatState = useMemo(
    () => ({ ...state, ...activeBundle }) as PrototypeSessionState & PetBundle,
    [state, activeBundle]
  );

  const setApiError = useCallback((error: MobileApiError) => {
    setApiSyncStatus("error");
    setApiErrorMessage(error.messageSafe);
  }, []);

  const setPurchaseError = useCallback((messageSafe: string) => {
    setPurchaseInProgressProductId(null);
    setPurchaseStatusMessage(messageSafe);
    setApiSyncStatus("error");
    setApiErrorMessage(messageSafe);
  }, []);

  const handleNativePurchase = useCallback(
    async (purchase: Purchase) => {
      if (apiRuntime.mode !== "api") {
        setPurchaseError("Checkout confirmation is required before purchases can unlock.");
        return;
      }

      const platform = getNativePurchasePlatform();

      if (!platform) {
        setPurchaseError("Purchases can only be verified on iOS or Android.");
        return;
      }

      const product = apiCommerceProducts?.find((candidate) => candidate.productId === purchase.productId);

      if (!product) {
        setPurchaseError("This item is not available in the current store catalog.");
        return;
      }

      setApiSyncStatus("syncing");
      setPurchaseStatusMessage("Verifying purchase.");

      const verification = await buildStorePurchaseVerificationRequest(platform, product, purchase);

      if (!verification.ok) {
        setPurchaseError(verification.messageSafe);
        return;
      }

      const result = await apiRuntime.client.verifyPurchase(verification.request);

      if (!result.ok) {
        setApiError(result.error);
        setPurchaseInProgressProductId(null);
        setPurchaseStatusMessage(result.error.messageSafe);
        return;
      }

      setApiEntitlements((current) => mergeEntitlements(current ?? [], result.data.entitlements));
      if (result.data.wallet) {
        setState((current) => ({
          ...current,
          wallet: result.data.wallet as CreditWallet
        }));
      }

      try {
        await nativeStoreConnection.current?.finishPurchase(purchase, product.grantType === "consumable");
      } catch {
        setPurchaseStatusMessage("Purchase was verified, but the store transaction still needs to finish.");
        setPurchaseInProgressProductId(null);
        setApiSyncStatus("ready");
        return;
      }

      setPurchaseInProgressProductId(null);
      setPurchaseStatusMessage("Purchase verified.");
      setApiSyncStatus("ready");
    },
    [apiCommerceProducts, apiRuntime, setApiError, setPurchaseError]
  );

  const setApiGenerationError = useCallback(
    (error: MobileApiError) => {
      setApiError(error);
      setState((current) => ({
        ...current,
        generation: {
          ...current.generation,
          status: "failed",
          failedAt: nowIso(),
          nextPollAfter: undefined,
          failureCode: error.code,
          failureMessageSafe: error.messageSafe
        }
      }));
    },
    [setApiError]
  );

  useEffect(() => {
    if (!isHydrated || apiRuntime.mode !== "api") {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      const result = await loadApiDailyLoopState(apiRuntime.client);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setApiError(result.error);
        return;
      }

      setApiCatalogItems(result.data.catalogItems);
      setApiCommerceProducts(result.data.state.commerceProducts);
      setApiEntitlements(result.data.state.entitlements);
      setState((current) => {
        const inventory = result.data.state.inventory
          ? preserveInventoryPlantGrowth(current.inventory, result.data.state.inventory)
          : current.inventory;

        const withTop: PrototypeSessionState = {
          ...current,
          ...(result.data.state.wallet ? { wallet: result.data.state.wallet } : {}),
          inventory
        };

        return withActivePetBundle(withTop, () => ({
          ...(result.data.state.petProfile ? { petProfile: result.data.state.petProfile } : {}),
          ...(result.data.state.careState ? { careState: result.data.state.careState } : {}),
          ...(result.data.state.relationshipState ? { relationshipState: result.data.state.relationshipState } : {}),
          activeWalk: result.data.state.activeWalk,
          currentReaction: result.data.state.currentReaction
        }));
      });
      setApiSyncStatus("ready");
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [apiRuntime, isHydrated, setApiError]);

  useEffect(() => {
    if (generatedAssetIdsToResolve.length === 0 || apiRuntime.mode !== "api") {
      return;
    }

    let cancelled = false;
    const assetIdsToRefresh = generatedAssetIdsToResolve.filter((assetId) => shouldRefreshGeneratedAssetReadUrl(generatedAssetReadUrls[assetId]));

    if (assetIdsToRefresh.length === 0) {
      return;
    }

    void Promise.all(assetIdsToRefresh.map((assetId) => resolveGeneratedAssetReadUrl(apiRuntime.client, assetId))).then((results) => {
      if (cancelled) {
        return;
      }

      const entries = results.flatMap((result) => (result.ok && result.entry ? [result.entry] : []));

      if (entries.length === 0) {
        return;
      }

      setGeneratedAssetReadUrls((current) => {
        const next = { ...current };

        for (const entry of entries) {
          next[entry.assetId] = entry;
        }

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [apiRuntime, generatedAssetIdsToResolve, generatedAssetReadUrls]);

  const updateDraft = useCallback((patch: Partial<PetSetupDraft>) => {
    setState((current) => updatePrototypeDraft(current, patch));
  }, []);

  const togglePersonalityTag = useCallback((tag: PersonalityTag) => {
    setState((current) => togglePrototypePersonalityTag(current, tag));
  }, []);

  const setMockPhotoSelected = useCallback((selected: boolean) => {
    setState((current) => setPrototypeMockPhotoSelected(current, selected));
  }, []);

  const setSelectedPhotoUri = useCallback(
    (uri: string, source: "library" | "camera", metadata?: { byteSize?: number | null; mimeType?: string | null }) => {
      setState((current) => setPrototypeSelectedPhotoUri(current, uri, source, metadata));
    },
    []
  );

  const setConsentAccepted = useCallback((accepted: boolean) => {
    setState((current) => setPrototypeConsentAccepted(current, accepted));
  }, []);

  const startMockGeneration = useCallback(() => {
    if (!canCreatePet(state)) {
      return;
    }

    if (hasActiveGenerationJob(activeBundle.petProfile?.activeGenerationJobId, state.generation.status)) {
      return;
    }

    const startedAt = nowIso();
    const supabaseClient = getSupabaseClient();

    if (supabaseClient) {
      generationStartGuard.current.run(async () => {
        setApiSyncStatus("syncing");
        setApiErrorMessage(null);

        const result = await startSupabaseGenerationFlow(supabaseClient, legacyFlatState, startedAt);

        if (!result.ok) {
          setApiGenerationError(result.error);
          return;
        }

        applyApiStatePatch(result.data);
        setApiSyncStatus("ready");
      });
      return;
    }

    if (generationApiRuntime.mode !== "api") {
      setState((current) => startPrototypeGeneration(current, startedAt));
      return;
    }

    generationStartGuard.current.run(async () => {
      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      const result = await startApiGenerationFlow(generationApiRuntime.client, legacyFlatState, startedAt);

      if (!result.ok) {
        setApiGenerationError(result.error);
        return;
      }

      applyApiStatePatch(result.data);
      setApiSyncStatus("ready");
    });
  }, [activeBundle, applyApiStatePatch, generationApiRuntime, legacyFlatState, setApiGenerationError, state]);

  const advanceMockGeneration = useCallback(() => {
    setState((current) => advancePrototypeGeneration(current, nowIso()));
  }, []);

  const pollMockGeneration = useCallback(
    (options?: { force?: boolean }) => {
      if (!activeBundle.petProfile?.activeGenerationJobId) {
        return;
      }

      const polledAt = nowIso();
      const nextPollAt = state.generation.nextPollAfter ? new Date(state.generation.nextPollAfter).getTime() : 0;
      const supabaseClient = getSupabaseClient();

      if (supabaseClient) {
        if (!options?.force && nextPollAt && Date.now() < nextPollAt) {
          return;
        }

        generationPollGuard.current.run(async () => {
          setApiSyncStatus("syncing");
          setApiErrorMessage(null);

          const result = await pollSupabaseGenerationFlow(supabaseClient, legacyFlatState, polledAt);

          if (!result.ok) {
            setApiGenerationError(result.error);
            return;
          }

          applyApiStatePatch(result.data);
          setApiSyncStatus("ready");
        });
        return;
      }

      if (generationApiRuntime.mode !== "api") {
        setState((current) => pollPrototypeGenerationJob(current, polledAt, options));
        return;
      }

      if (!options?.force && nextPollAt && Date.now() < nextPollAt) {
        return;
      }

      generationPollGuard.current.run(async () => {
        setApiSyncStatus("syncing");
        setApiErrorMessage(null);

        const result = await pollApiGenerationFlow(generationApiRuntime.client, legacyFlatState, polledAt);

        if (!result.ok) {
          setApiGenerationError(result.error);
          return;
        }

        applyApiStatePatch(result.data);
        setApiSyncStatus("ready");
      });
    },
    [applyApiStatePatch, generationApiRuntime, legacyFlatState, setApiGenerationError, state]
  );

  const retryMockGeneration = useCallback(() => {
    const retriedAt = nowIso();
    const supabaseClient = getSupabaseClient();

    if (supabaseClient) {
      generationRetryGuard.current.run(async () => {
        setApiSyncStatus("syncing");
        setApiErrorMessage(null);

        const result = await retrySupabaseGenerationFlow(supabaseClient, legacyFlatState, retriedAt);

        if (!result.ok) {
          setApiGenerationError(result.error);
          return;
        }

        applyApiStatePatch(result.data);
        setApiSyncStatus("ready");
      });
      return;
    }

    if (generationApiRuntime.mode !== "api") {
      setState((current) => retryPrototypeGeneration(current, retriedAt));
      return;
    }

    generationRetryGuard.current.run(async () => {
      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      const result = await retryApiGenerationFlow(generationApiRuntime.client, legacyFlatState, retriedAt);

      if (!result.ok) {
        setApiGenerationError(result.error);
        return;
      }

      applyApiStatePatch(result.data);
      setApiSyncStatus("ready");
    });
  }, [applyApiStatePatch, generationApiRuntime, legacyFlatState, setApiGenerationError, state]);

  const acceptGeneratedPet = useCallback(() => {
    // Critical: Supabase-mode already has the real generated assets (signed
    // storage URLs from pollSupabaseGenerationFlow) sitting in
    // state.acceptedAsset/acceptedAssets by the time this is called --
    // acceptPrototypeGeneratedPet must NOT overwrite them with
    // makeMockGeneratedAssetsForPet's local placeholders, which is what the
    // default (non-preserveAssets) call below does. preserveAssets: true
    // keeps whatever real assets are already in state.
    if (getSupabaseClient()) {
      setState((current) => acceptPrototypeGeneratedPet(current, nowIso(), { preserveAssets: true }));
      return;
    }

    if (generationApiRuntime.mode !== "api") {
      setState((current) => acceptPrototypeGeneratedPet(current, nowIso()));
      return;
    }

    setApiSyncStatus("syncing");
    setApiErrorMessage(null);

    void acceptApiGeneratedPet(generationApiRuntime.client, legacyFlatState).then((result) => {
      if (!result.ok) {
        setApiError(result.error);
        return;
      }

      applyApiStatePatch(result.data);
      setApiSyncStatus("ready");
    });
  }, [applyApiStatePatch, generationApiRuntime, legacyFlatState, setApiError, state]);

  const performCareAction = useCallback(
    (action: CareActionType, itemId?: ItemId) => {
      const occurredAt = nowIso();

      if (apiRuntime.mode !== "api") {
        setState((current) => performPrototypeCareAction(current, action, occurredAt, itemId, { walkDurationMs: homeWalkDurationMs }));
        return;
      }

      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      void performApiDailyLoopCareAction(apiRuntime.client, legacyFlatState, catalogItems, activePet.id, action, occurredAt, itemId).then(
        (result) => {
          if (!result.ok) {
            setApiError(result.error);
            return;
          }

          applyApiStatePatch(result.data);
          setApiSyncStatus("ready");
        }
      );
    },
    [activePet.id, apiRuntime, applyApiStatePatch, catalogItems, legacyFlatState, setApiError]
  );

  const setCareActionCooldown = useCallback((action: CareActionType, cooldownUntil: number) => {
    setCareCooldownUntilByAction((current) => ({
      ...current,
      [action]: cooldownUntil
    }));
  }, []);

  const setWeatherScenesEnabled = useCallback((enabled: boolean) => {
    setState((current) => setPrototypeWeatherEnabled(current, enabled, nowIso()));
  }, []);

  const setManualWeatherCondition = useCallback((condition: WeatherCondition) => {
    setState((current) => setPrototypeWeatherCondition(current, condition, nowIso()));
  }, []);

  const refreshWeatherFromApproximateLocation = useCallback(async (): Promise<boolean> => {
    const requestedAt = nowIso();
    setWeatherLocationStatus("requesting");
    setWeatherLocationMessage("Checking approximate local weather.");

    const result = await refreshApproximateLocationWeather({
      runtimeMode: apiRuntime.mode,
      client: apiRuntime.client,
      locale: "en-US",
      requestedAt
    });

    if (!result.ok) {
      setWeatherLocationStatus(result.status);
      setWeatherLocationMessage(result.messageSafe);
      return false;
    }

    setState((current) => ({
      ...current,
      weatherState: {
        settings: {
          ...current.weatherState.settings,
          enabled: true,
          useApproximateLocation: true,
          lastExplainedAt: requestedAt
        },
        context: result.weather,
        updatedAt: requestedAt
      }
    }));
    setWeatherLocationStatus("ready");
    setWeatherLocationMessage(result.messageSafe);

    return true;
  }, [apiRuntime]);

  const refreshWalk = useCallback(() => {
    const refreshedAt = nowIso();

    if (apiRuntime.mode !== "api") {
      setState((current) => refreshPrototypeWalk(current, refreshedAt));
      return;
    }

    setState((current) =>
      withActivePetBundle(current, (bundle) => ({
        activeWalk: refreshApiWalkLocally(bundle.activeWalk, refreshedAt)
      }))
    );
  }, [apiRuntime]);

  /** Spends 1 credit to bring the pet home early; leaves state untouched (and returns false) if the balance is insufficient. */
  const completeWalkEarly = useCallback(() => {
    if (apiRuntime.mode !== "api") {
      const result = completePrototypeWalkEarlyWithCredit(state, nowIso());

      if (!result.ok) {
        return false;
      }

      setState(result.state);
      return true;
    }

    return false;
  }, [apiRuntime, state]);

  const claimWalkReward = useCallback(() => {
    if (apiRuntime.mode !== "api") {
      setState((current) => claimPrototypeWalkReward(current, nowIso()));
      return;
    }

    if (!activeBundle.activeWalk) {
      return;
    }

    setApiSyncStatus("syncing");
    setApiErrorMessage(null);

    void claimApiDailyLoopWalkReward(apiRuntime.client, legacyFlatState, activeBundle.activeWalk.id, activePet.id).then((result) => {
      if (!result.ok) {
        setApiError(result.error);
        return;
      }

      applyApiStatePatch(result.data);
      setApiSyncStatus("ready");
    });
  }, [activeBundle.activeWalk, activePet.id, apiRuntime, applyApiStatePatch, legacyFlatState, setApiError]);

  const purchaseThemeBundle = useCallback(
    (bundleId: string): PurchaseCatalogItemResult => {
      if (apiRuntime.mode === "api") {
        return { ok: false, messageSafe: "Theme bundles are coming to the live store soon." };
      }

      const devStoreUnlocked = isDevelopmentStoreUnlockEnabled();
      const purchasedAt = nowIso();
      const result = purchasePrototypeThemeBundle(
        devStoreUnlocked ? withDevelopmentPurchaseWallet(state, DEVELOPMENT_STORE_CREDIT_BALANCE, purchasedAt) : state,
        bundleId,
        purchasedAt
      );

      if (!result.ok) {
        return {
          ok: false,
          messageSafe: result.reason === "insufficient_credits" ? "Not enough credits for this set." : "This set is not available."
        };
      }

      setState(result.state);

      return {
        ok: true,
        mode: apiRuntime.mode,
        messageSafe: result.alreadyOwned ? "Theme applied to the garden!" : "New theme unlocked and applied to the garden!",
        placed: true
      };
    },
    [apiRuntime, state]
  );

  /**
   * Applies a theme the player already owns (or the always-free default) for
   * free -- refuses an unowned theme id instead of silently applying it, so
   * this can never be used as a free-purchase bypass (see purchaseThemeBundle
   * for the only path that grants new ownership).
   */
  const applyTheme = useCallback(
    (themeId: ItemId): PurchaseCatalogItemResult => {
      const result = applyPrototypeTheme(state, themeId, nowIso());

      if (!result.ok) {
        return { ok: false, messageSafe: "Unlock this theme first." };
      }

      setState(result.state);

      return { ok: true, mode: apiRuntime.mode, messageSafe: "Theme applied to the garden!", placed: true };
    },
    [apiRuntime.mode, state]
  );

  const setExpressionPackPending = useCallback((packId: string) => {
    expressionPackInFlightPackIdsRef.current.add(packId);
    setExpressionPackPurchaseStatusById((current) => ({ ...current, [packId]: { status: "pending" } }));
  }, []);

  const setExpressionPackFailed = useCallback((packId: string, failureMessageSafe: string) => {
    reporter.captureMessage("expressionPack: purchase/generation failed", { packId, failureMessageSafe });
    setExpressionPackPurchaseStatusById((current) => ({
      ...current,
      [packId]: { status: "failed", failureMessageSafe }
    }));
    setExpressionPackJobIdByPackId((current) => {
      const { [packId]: _removed, ...rest } = current;
      return rest;
    });
    expressionPackInFlightPackIdsRef.current.delete(packId);
  }, []);

  const clearExpressionPackStatus = useCallback((packId: string) => {
    setExpressionPackPurchaseStatusById((current) => {
      const { [packId]: _removed, ...rest } = current;
      return rest;
    });
    setExpressionPackJobIdByPackId((current) => {
      const { [packId]: _removed, ...rest } = current;
      return rest;
    });
    expressionPackInFlightPackIdsRef.current.delete(packId);
  }, []);

  useEffect(() => {
    const pendingJobs = state.inventory.pendingExpressionPackJobs ?? [];

    if (pendingJobs.length === 0) {
      return;
    }

    setExpressionPackPurchaseStatusById((current) => {
      const next = { ...current };

      for (const job of pendingJobs) {
        next[job.packId] = { status: "pending" };
        expressionPackInFlightPackIdsRef.current.add(job.packId);
      }

      return next;
    });

    setExpressionPackJobIdByPackId((current) => {
      const next = { ...current };

      for (const job of pendingJobs) {
        next[job.packId] = job.jobId;
      }

      return next;
    });
  }, [state.inventory.pendingExpressionPackJobs]);

  const purchaseExpressionPack = useCallback(
    async (packId: string): Promise<PurchaseExpressionPackResult> => {
      const alreadyPending = (state.inventory.pendingExpressionPackJobs ?? []).some((job) => job.packId === packId);
      const existingStatus = expressionPackPurchaseStatusById[packId]?.status;

      if (expressionPackInFlightPackIdsRef.current.has(packId) || existingStatus === "pending" || alreadyPending) {
        return { ok: true, messageSafe: "New moments are already on their way..." };
      }

      const devStoreUnlocked = isDevelopmentStoreUnlockEnabled();
      const purchasedAt = nowIso();
      const validationState = devStoreUnlocked
        ? withDevelopmentPurchaseWallet(state, DEVELOPMENT_STORE_CREDIT_BALANCE, purchasedAt)
        : state;
      const validation = validatePrototypeExpressionPackPurchase(validationState, packId);

      if (!validation.ok) {
        const messageSafe =
          validation.reason === "already_owned"
            ? "You already have these expressions!"
            : validation.reason === "already_pending"
              ? "New moments are already on their way..."
            : validation.reason === "insufficient_credits"
              ? "Not enough credits for this pack yet."
              : "This pack is not available.";

        return { ok: false, messageSafe };
      }

      const pack = validation.pack;
      setExpressionPackPending(pack.id);

      const supabaseClient = getSupabaseClient();

      if (!supabaseClient) {
        // Local/dev fallback: no live backend to poll, so confirm the
        // purchase and merge in mock assets for the pack's states right
        // away -- this is what lets the dev-unlocked wallet path exercise
        // the full purchase -> gallery flow in the simulator. There is no
        // server here, so the local-wallet-spending confirm is correct in
        // this branch only (see confirmPrototypeExpressionPackPurchase's
        // doc comment) -- production never reaches this branch
        // (EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE-gated dev builds only).
        const confirmed = confirmPrototypeExpressionPackPurchase(validationState, pack.id, purchasedAt);

        if (!confirmed.ok) {
          setExpressionPackFailed(pack.id, "Not enough credits for this pack yet.");
          return { ok: false, messageSafe: "Not enough credits for this pack yet." };
        }

        const pet = getActivePrototypePet(confirmed.state, purchasedAt);
        const mockAssets = pack.states.map((packState) =>
          makeMockGeneratedAsset(packState, {
            petId: pet.id,
            generationJobId: `gen_expression_pack_${pack.id}`,
            species: pet.species
          })
        );

        setState(mergePrototypeGeneratedAssets(confirmed.state, mockAssets));
        clearExpressionPackStatus(pack.id);

        return { ok: true, messageSafe: `New moments unlocked: ${pack.nameEn}!` };
      }

      // Credit Phase 1c (docs/credit-phase1-design.md §6.3/§6.4): expression
      // packs are a paid, server-debited generation now, so this purchase is
      // never optimistic. request_id is minted fresh per purchase *attempt*
      // (not per retry within the same attempt -- startSupabaseExpressionPackFlow
      // sends it as-is) and is the idempotency key the Edge Function's
      // consume_credits call keys its ledger row on, so a dropped response
      // followed by this same call retrying never double-charges.
      const requestId = Crypto.randomUUID();
      const started = await startSupabaseExpressionPackFlow(supabaseClient, legacyFlatState, pack.id, pack.states, requestId);

      if (!started.ok) {
        // insufficient_credits (402, server-authoritative -- the local
        // preflight check above only rejects fast on a *known-stale* local
        // cache) and any network/offline failure both land here: nothing
        // was charged, so just surface the message and let the player
        // retry -- no local wallet mutation to roll back, no pending job to
        // strand. "insufficient_credits" already carries P11's warm,
        // non-guilt tone (see failureMessages.insufficientCredits in
        // generate-avatar/index.ts): "You're out of credits for this one.
        // Grab more and let's try again soon."
        setExpressionPackFailed(pack.id, started.error.messageSafe);
        return { ok: false, messageSafe: started.error.messageSafe };
      }

      const pet = getActivePrototypePet(state, purchasedAt);
      const recorded = recordExpressionPackJobStart(
        state,
        {
          packId: pack.id,
          jobId: started.data.jobId,
          requestId,
          petId: pet.id,
          startedAt: purchasedAt
        },
        purchasedAt
      );

      if (!recorded.ok) {
        setExpressionPackFailed(pack.id, "Something went sideways starting these new expressions. Try again soon.");
        return { ok: false, messageSafe: "Something went sideways starting these new expressions. Try again soon." };
      }

      setState(recorded.state);
      setExpressionPackJobIdByPackId((current) => ({ ...current, [pack.id]: started.data.jobId }));

      // Best-effort: sync the local credits cache to the server's post-debit
      // balance now that the charge is confirmed. Never blocks the purchase
      // result on this -- a failed hydrate just means the cached balance
      // stays stale until the next hydrate point (design doc §6.2/§6.4:
      // "hydrate failure -> last cache + quiet retry", no error surfaced).
      void hydrateServerCreditBalance(supabaseClient).then((hydrated) => {
        if (!hydrated.ok) {
          return;
        }

        setState((current) => ({
          ...current,
          wallet: { ...current.wallet, credits: hydrated.credits, updatedAt: nowIso() }
        }));
      });

      return { ok: true, messageSafe: "New moments are on their way..." };
    },
    [
      clearExpressionPackStatus,
      expressionPackPurchaseStatusById,
      legacyFlatState,
      setExpressionPackFailed,
      setExpressionPackPending,
      state
    ]
  );

  // Keeps polling every pending expression-pack job even if the friend page
  // (or wherever purchaseExpressionPack was called from) is no longer
  // mounted -- this effect owns its own interval (rather than piggybacking on
  // the 30s sessionClock tick, which is too coarse for a purchase-progress
  // UX) so navigating home never stalls a pack that's already mid-generation.
  // Only runs while at least one pack purchase is pending, so it never adds
  // background work to the common case of no active purchase.
  useEffect(() => {
    const pendingJobsByPackId = new Map((state.inventory.pendingExpressionPackJobs ?? []).map((job) => [job.packId, job]));
    const pendingEntries = Object.entries(expressionPackJobIdByPackId).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    );

    if (pendingEntries.length === 0) {
      return;
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return;
    }

    const pollOnce = () => {
      expressionPackPollGuard.current.run(async () => {
        const polledAt = nowIso();

        for (const [packId, jobId] of pendingEntries) {
          const petId = pendingJobsByPackId.get(packId)?.petId ?? getActivePrototypePet(state, polledAt).id;
          const result = await pollSupabaseExpressionPackFlow(supabaseClient, jobId, petId, polledAt);

          if (!result.ok) {
            // Transient poll failure -- leave the job pending, try again next tick.
            continue;
          }

          if (result.data.status === "failed") {
            setState((current) => clearPendingExpressionPackJob(current, packId, polledAt));
            setExpressionPackFailed(
              packId,
              result.data.failureMessageSafe ?? "The tiny door got stuck. Let's try adding these expressions again."
            );
            continue;
          }

          if (result.data.status === "completed") {
            setState((current) => {
              const withAssets = mergePrototypeGeneratedAssets(current, result.data.assets);
              const unlocked = recordExpressionPackUnlock(withAssets, packId, polledAt);
              return clearPendingExpressionPackJob(unlocked.ok ? unlocked.state : withAssets, packId, polledAt);
            });
            clearExpressionPackStatus(packId);
          }
        }
      });
    };

    const interval = setInterval(pollOnce, EXPRESSION_PACK_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [clearExpressionPackStatus, expressionPackJobIdByPackId, setExpressionPackFailed, state]);

  const purchaseCatalogItem = useCallback(
    async (itemId: ItemId): Promise<PurchaseCatalogItemResult> => {
      const price = getCreditItemPrice(itemId);
      const devStoreUnlocked = isDevelopmentStoreUnlockEnabled();

      if (!price) {
        return {
          ok: false,
          messageSafe: "This item is not available for credits yet."
        };
      }

      const purchasedAt = nowIso();

      if (apiRuntime.mode !== "api") {
        if (!devStoreUnlocked && getSpendableCreditBalance(state.wallet) < price.creditCost) {
          return {
            ok: false,
            messageSafe: "Not enough credits for this item."
          };
        }

        setState((current) =>
          purchasePrototypeInventoryItem(
            devStoreUnlocked
              ? withDevelopmentPurchaseWallet(current, DEVELOPMENT_STORE_CREDIT_BALANCE, purchasedAt)
              : current,
            itemId,
            purchasedAt
          )
        );

        return {
          ok: true,
          mode: "local",
          messageSafe: devStoreUnlocked ? "Development store unlock is active." : `Used ${price.creditCost} credits.`,
          placed: false
        };
      }

      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      const result = await apiRuntime.client.purchaseInventoryItem({ itemId });

      if (!result.ok) {
        setApiError(result.error);

        return {
          ok: false,
          messageSafe: result.error.messageSafe
        };
      }

      setState((current) => ({
        ...current,
        wallet: result.data.wallet,
        inventory: preserveInventoryPlantGrowth(current.inventory, result.data.inventory)
      }));
      setApiSyncStatus("ready");

      return {
        ok: true,
        mode: "api",
        messageSafe: `Used ${result.data.creditCost} credits.`,
        placed: false
      };
    },
    [apiRuntime, setApiError, state.wallet]
  );

  const reportGenerationIssue = useCallback((category: GenerationIssueCategory) => {
    const reportedAt = nowIso();

    setState((current) => reportPrototypeGenerationIssue(current, category, reportedAt));

    if (apiRuntime.mode !== "api") {
      return;
    }

    setApiSyncStatus("syncing");
    setApiErrorMessage(null);

    void apiRuntime.client
      .reportGenerationIssue({
        petId: activePet.id,
        ...(activePet.activeGenerationJobId ? { generationJobId: activePet.activeGenerationJobId } : {}),
        category
      })
      .then((result) => {
        if (!result.ok) {
          setApiError(result.error);
          return;
        }

        setApiSyncStatus("ready");
      });
  }, [activePet.activeGenerationJobId, activePet.id, apiRuntime, setApiError]);

  const deleteOriginalPhoto = useCallback(() => {
    const deletedAt = nowIso();

    if (apiRuntime.mode !== "api") {
      setState((current) => deletePrototypeOriginalPhoto(current, deletedAt));
      return;
    }

    setApiSyncStatus("syncing");
    setApiErrorMessage(null);

    void apiRuntime.client.deleteOriginalPhotos({ petId: activePet.id }).then((result) => {
      if (!result.ok) {
        setApiError(result.error);
        return;
      }

      setState((current) => deletePrototypeOriginalPhoto(current, result.data.deletedAt));
      setApiSyncStatus("ready");
    });
  }, [activePet.id, apiRuntime, setApiError]);

  const deleteChatHistory = useCallback(() => {
    const deletedAt = nowIso();

    if (apiRuntime.mode !== "api") {
      setState((current) => deletePrototypeChatHistory(current, deletedAt));
      return;
    }

    setApiSyncStatus("syncing");
    setApiErrorMessage(null);

    void apiRuntime.client.deleteChatHistory().then((result) => {
      if (!result.ok) {
        setApiError(result.error);
        return;
      }

      setState((current) => deletePrototypeChatHistory(current, result.data.deletedAt));
      setApiSyncStatus("ready");
    });
  }, [apiRuntime, setApiError]);

  useEffect(() => {
    let cancelled = false;

    if (apiRuntime.mode !== "api" || !isNativeStoreCheckoutEnabled()) {
      setNativeCheckoutReady(false);
      return;
    }

    void startNativeStorePurchaseConnection({
      onPurchase: (purchase) => {
        void handleNativePurchase(purchase);
      },
      onError: setPurchaseError
    }).then((result) => {
      if (cancelled) {
        if (result.ok) {
          void result.connection.close();
        }
        return;
      }

      if (!result.ok) {
        nativeStoreConnection.current = null;
        setNativeCheckoutReady(false);
        setPurchaseStatusMessage(result.messageSafe);
        return;
      }

      nativeStoreConnection.current = result.connection;
      setNativeCheckoutReady(true);
      setPurchaseStatusMessage(null);
    });

    return () => {
      cancelled = true;
      const connection = nativeStoreConnection.current;
      nativeStoreConnection.current = null;
      setNativeCheckoutReady(false);

      if (connection) {
        void connection.close();
      }
    };
  }, [apiRuntime.mode, handleNativePurchase, setPurchaseError]);

  const purchaseProduct = useCallback(
    async (product: CommerceProduct): Promise<PurchaseProductResult> => {
      if (apiRuntime.mode !== "api") {
        return {
          ok: false,
          messageSafe: "Store checkout is unavailable right now."
        };
      }

      if (!getNativePurchasePlatform()) {
        return {
          ok: false,
          messageSafe: "Checkout is only available on iOS or Android."
        };
      }

      if (!isNativeStoreCheckoutEnabled()) {
        return {
          ok: false,
          messageSafe: "Store checkout is unavailable right now."
        };
      }

      const connection = nativeStoreConnection.current;

      if (!nativeCheckoutReady || !connection) {
        return {
          ok: false,
          messageSafe: purchaseStatusMessage ?? "Store checkout is still connecting."
        };
      }

      setPurchaseInProgressProductId(product.productId);
      setPurchaseStatusMessage("Opening secure checkout.");
      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      try {
        await connection.requestPurchase(product);
      } catch (error) {
        const messageSafe = error instanceof Error ? error.message : "Store checkout could not be started.";
        setPurchaseError(messageSafe);

        return {
          ok: false,
          messageSafe
        };
      }

      return {
        ok: true,
        mode: "api",
        messageSafe: "Checkout started."
      };
    },
    [apiRuntime.mode, nativeCheckoutReady, purchaseStatusMessage, setPurchaseError]
  );

  const restorePurchases = useCallback(async (): Promise<RestorePurchasesResult> => {
    if (apiRuntime.mode !== "api") {
      return {
        ok: true,
        mode: "local",
        restoredCount: 0,
        serverVerified: false
      };
    }

    const platform = getNativePurchasePlatform();

    if (!platform) {
      return {
        ok: false,
        messageSafe: "Purchases can only be restored on iOS or Android."
      };
    }

    setApiSyncStatus("syncing");
    setApiErrorMessage(null);
    setPurchaseStatusMessage("Checking store purchases.");

    let restoreRequest: RestorePurchasesRequest = {
      platform,
      transactionIds: []
    };

    if (isNativeStoreCheckoutEnabled()) {
      const connection = nativeStoreConnection.current;

      if (!nativeCheckoutReady || !connection) {
        const messageSafe = purchaseStatusMessage ?? "Store checkout is still connecting.";
        setApiSyncStatus("ready");
        setPurchaseStatusMessage(messageSafe);

        return {
          ok: false,
          messageSafe
        };
      }

      try {
        const storePurchases = await connection.restorePurchases();
        const restorePayload = await buildStoreRestorePurchasesRequest(platform, apiCommerceProducts ?? [], storePurchases);
        restoreRequest = restorePayload.request;
        setPurchaseStatusMessage(
          restorePayload.eligibleCount > 0 ? "Verifying restored purchases." : "No store purchases found."
        );
      } catch (error) {
        const messageSafe = error instanceof Error ? error.message : "Store purchases could not be restored.";
        setPurchaseError(messageSafe);

        return {
          ok: false,
          messageSafe
        };
      }
    }

    const result = await apiRuntime.client.restorePurchases(restoreRequest);

    if (!result.ok) {
      setApiError(result.error);
      return {
        ok: false,
        messageSafe: result.error.messageSafe
      };
    }

    setApiEntitlements((current) => mergeEntitlements(current ?? [], result.data.entitlements));
    if (result.data.wallet) {
      setState((current) => ({
        ...current,
        wallet: result.data.wallet as CreditWallet
      }));
    }
    setApiSyncStatus("ready");
    setPurchaseStatusMessage("Purchases restored.");

    return {
      ok: true,
      mode: "api",
      restoredCount: result.data.entitlements.length,
      serverVerified: result.data.serverVerified
    };
  }, [apiRuntime, apiCommerceProducts, nativeCheckoutReady, purchaseStatusMessage, setApiError, setPurchaseError]);

  const resetSession = useCallback(async (): Promise<ResetSessionResult> => {
    if (apiRuntime.mode === "api" && activeBundle.petProfile?.id) {
      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      const result = await apiRuntime.client.deletePrivacyPet(activeBundle.petProfile.id);

      if (!result.ok) {
        setApiError(result.error);
        return { ok: false };
      }

      setApiSyncStatus("ready");
    }

    // Supabase-backed generation flow (see supabaseGenerationSession.ts):
    // when this device holds a live anonymous Supabase auth session, ask
    // the delete-account Edge Function to erase every server-side trace --
    // pet-media storage, generation_jobs/generated_assets/generation_quota/
    // credit_wallets/credit_ledger/pet_slots rows, and the anonymous auth
    // user itself (see supabase/functions/delete-account/index.ts) -- before
    // wiping the local session below. Unlike the api-mode block above, a
    // failure here never blocks the local reset: the device-local data is
    // the user's to clear regardless of server reachability, and the local
    // reset only ever promised to remove "this device's" setup/care state.
    let serverDeleteWarning: string | undefined;
    const supabaseClient = getSupabaseClient();

    if (supabaseClient) {
      const { data: sessionData } = await supabaseClient.auth.getSession();

      if (sessionData.session) {
        setApiSyncStatus("syncing");
        setApiErrorMessage(null);

        const deletion = await deleteSupabaseAccountData(supabaseClient);

        if (deletion.ok || deletion.reason === "unauthorized") {
          // Either genuinely deleted server-side, or the session was
          // already stale/pointing at an account with nothing left to
          // delete -- either way there's nothing to retry, so drop the
          // local Supabase session instead of keeping a dead JWT around.
          await supabaseClient.auth.signOut().catch(() => {});
        } else {
          // Real transient failure (offline, 5xx, unexpected throw, or a
          // partial server-side failure -- see deleteSupabaseAccountData's
          // doc comment). Keep the session alive so a later retry from
          // Settings can still reach the same account.
          serverDeleteWarning =
            "This device is reset, but we couldn't finish deleting your data from our servers. Please try again later from Settings once you're back online.";
        }

        setApiSyncStatus("ready");
      }
    }

    const initialState = createInitialPrototypeSession(nowIso());
    setState(initialState);
    setCareCooldownUntilByAction({});
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(createPersistedSessionEnvelope(initialState))),
      clearCareActionCooldowns(AsyncStorage),
      AsyncStorage.removeItem(CORRUPT_SESSION_BACKUP_KEY)
    ]);

    return { ok: true, ...(serverDeleteWarning ? { serverDeleteWarning } : {}) };
  }, [apiRuntime, activeBundle.petProfile?.id, setApiError]);

  /**
   * "Back up your friend": serializes the current in-memory session as the
   * same versioned envelope that's already written to AsyncStorage on every
   * change (see the persistence effect above), so a share/export always
   * reflects exactly what would be restored on next app launch. No signed
   * asset URLs or auth tokens are added -- state.acceptedAsset(s) only ever
   * carries whatever URL/id shape is already sitting in session state
   * (a short-lived signed Supabase URL in server-backed runtime mode, or a
   * local mock placeholder in local/dev mode), so this exports nothing more
   * sensitive than what's already on-device.
   */
  const exportSessionBackup = useCallback((): ExportSessionBackupResult => {
    try {
      return { ok: true, backupText: serializeSessionBackup(createPersistedSessionEnvelope(state)) };
    } catch {
      return { ok: false, messageSafe: "Couldn't put together a backup right now. Please try again." };
    }
  }, [state]);

  /**
   * "Restore from backup": validates+migrates the pasted text (via the same
   * parse -> migrate -> validate pipeline restoreSession uses on cold start)
   * before touching anything. Atomic from the caller's point of view --
   * either every step below succeeds and the new session is committed, or
   * nothing changes and the existing in-memory/on-disk session is left
   * exactly as it was. The current session is snapshotted to
   * PRE_IMPORT_SNAPSHOT_KEY right before the overwrite so a wrong-file
   * import is still recoverable.
   */
  const importSessionBackup = useCallback(
    async (backupText: string): Promise<ImportSessionBackupResult> => {
      const parsed = parseSessionBackup(backupText);

      if (!parsed.ok) {
        const messageSafe =
          parsed.reason === "empty_input"
            ? "Paste your backup text first."
            : parsed.reason === "invalid_json"
              ? "This doesn't look like a valid backup file. Nothing was changed."
              : parsed.reason === "unmigratable_version"
                ? "This backup is from a newer app version and can't be restored here yet. Nothing was changed."
                : "This backup looks incomplete. Nothing was changed.";

        return { ok: false, reason: parsed.reason, messageSafe };
      }

      const restoredState = mergeRestoredSession(parsed.envelope.state as unknown as Record<string, unknown>);

      try {
        // Snapshot first: if the write below is interrupted, the pre-import
        // session is still recoverable from PRE_IMPORT_SNAPSHOT_KEY.
        await AsyncStorage.setItem(PRE_IMPORT_SNAPSHOT_KEY, JSON.stringify(createPersistedSessionEnvelope(state)));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(createPersistedSessionEnvelope(restoredState)));
      } catch {
        return {
          ok: false,
          reason: "invalid_shape",
          messageSafe: "Couldn't save the restored garden to this device. Nothing was changed."
        };
      }

      setState(restoredState);
      setCareCooldownUntilByAction({});

      return { ok: true };
    },
    [state]
  );

  const syncWallet = useCallback((wallet: CreditWallet) => {
    setState((current) => ({
      ...current,
      wallet
    }));
  }, []);

  // Credit Phase 1c (docs/credit-phase1-design.md §6.2): refreshes
  // wallet.credits from credit_wallets (server truth) via the
  // get_credit_balance RPC. Deliberately narrow -- only ever patches
  // `credits`, never `bonusCredits` (that stays purely local/play-earned)
  // or any other wallet field. Callers decide *when* to call this: app
  // foreground resume, shop/friend-page (expression pack gallery) entry,
  // and right after a purchase/generation completes -- never on a
  // per-second clock (that would add a home-screen re-render cost, see
  // readiness-diagnosis). A no-op (not an error) when there's no Supabase
  // client (dev/local mode) or the RPC call fails -- the caller just keeps
  // showing the last cached balance, consistent with "hydrate failure ->
  // last cache + quiet retry, no banner spam" from §6.4.
  const hydrateCreditBalance = useCallback(async (): Promise<void> => {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return;
    }

    const hydrated = await hydrateServerCreditBalance(supabaseClient);

    if (!hydrated.ok) {
      return;
    }

    setState((current) => ({
      ...current,
      wallet: { ...current.wallet, credits: hydrated.credits, updatedAt: nowIso() }
    }));
  }, []);

  // Credit Phase 1c trigger point (a): app foreground resume (design doc
  // §6.2). Only fires on background/inactive -> active transitions, not on
  // the initial mount's "active" state (AppState's listener only reports
  // *changes*, so this never double-hydrates alongside a screen's own
  // mount-time hydrate).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void hydrateCreditBalance();
      }
    });

    return () => subscription.remove();
  }, [hydrateCreditBalance]);

  const devStoreUnlocked = isDevelopmentStoreUnlockEnabled();
  const activeEntitlements = useMemo(() => {
    const runtimeEntitlements = getRuntimeActiveEntitlements(apiRuntime.mode, apiEntitlements);

    if (!devStoreUnlocked) {
      return runtimeEntitlements;
    }

    return mergeEntitlements(runtimeEntitlements, getDevelopmentStoreEntitlements(state.wallet.userId, nowIso()));
  }, [apiEntitlements, apiRuntime.mode, devStoreUnlocked, state.wallet.userId]);
  const generatedAssetUriById = useMemo(
    () => buildGeneratedAssetUriMap(generatedAssetReadUrls, activeBundle.acceptedAsset, activeBundle.acceptedAssets),
    [generatedAssetReadUrls, activeBundle.acceptedAsset, activeBundle.acceptedAssets]
  );

  const sessionNow = useMemo(() => nowIso(), [sessionClock, activeBundle.careState]);
  const projectedCareState = projectCareStateForTime(activeBundle.careState, sessionNow, state.activeBuffs ?? []);
  const satisfactionSummary = getCareSatisfactionSummary(projectedCareState, sessionNow);

  const attemptKey = getGenerationAttemptKey(state);

  if (generationProgressGaugeRef.current.attemptKey !== attemptKey) {
    generationProgressGaugeRef.current = { attemptKey, maxProgress: 0 };
  }

  const generationProgress = getMonotonicGenerationProgress(state, generationProgressGaugeRef.current.maxProgress);
  generationProgressGaugeRef.current.maxProgress = generationProgress;

  const value: TerrariumSessionContextValue = {
    ...state,
    // Restores per-pet fields (careState/relationshipState/petProfile/
    // acceptedAsset(s)/activeWalk/currentReaction/lastCareReward/
    // recentReactions/lastWalkDiscovery/generationIssueReport/memories/
    // careStats) to the top level for UI consumers -- see the activeBundle
    // comment above and docs/multi-pet-w1-design.md section 3. Must come
    // after ...state (so it doesn't get clobbered by state.pets) and before
    // the careState: projectedCareState override below (so the time
    // projection isn't itself overwritten by the raw bundle value).
    ...activeBundle,
    careState: projectedCareState,
    activePet,
    catalogItems,
    careCooldownUntilByAction,
    canContinuePetSetup: canContinuePetSetup(state),
    canContinuePhotoStep: canContinuePhotoStep(state),
    canCreatePet: canCreatePet(state),
    satisfactionScore: satisfactionSummary.score,
    satisfactionSummary,
    bondProgress: getBondProgressValue(activeBundle.relationshipState),
    creditBalance: devStoreUnlocked
      ? Math.max(DEVELOPMENT_STORE_CREDIT_BALANCE, getSpendableCreditBalance(state.wallet))
      : getSpendableCreditBalance(state.wallet),
    generationProgress,
    generationPollSnapshot: getPrototypeGenerationPollSnapshot(state),
    generatedAssetUriById,
    commerceProducts: apiCommerceProducts ?? [],
    activeEntitlements,
    entitlementsCount: activeEntitlements.length,
    hasPremiumChatEntitlement:
      activeEntitlements.some((entitlement) => entitlement.key === "premium_chat"),
    isHydrated,
    runtimeMode: apiRuntime.mode,
    apiSyncStatus,
    apiErrorMessage,
    nativeCheckoutReady,
    purchaseInProgressProductId,
    purchaseStatusMessage,
    devStoreUnlocked,
    weatherLocationStatus,
    weatherLocationMessage,
    updateDraft,
    togglePersonalityTag,
    setMockPhotoSelected,
    setSelectedPhotoUri,
    setConsentAccepted,
    startMockGeneration,
    advanceMockGeneration,
    pollMockGeneration,
    retryMockGeneration,
    acceptGeneratedPet,
    performCareAction,
    setCareActionCooldown,
    setWeatherScenesEnabled,
    setManualWeatherCondition,
    refreshWeatherFromApproximateLocation,
    refreshWalk,
    claimWalkReward,
    completeWalkEarly,
    applyTheme,
    purchaseThemeBundle,
    expressionPackPurchaseStatusById,
    purchaseExpressionPack,
    reportGenerationIssue,
    deleteOriginalPhoto,
    deleteChatHistory,
    purchaseCatalogItem,
    purchaseProduct,
    restorePurchases,
    syncWallet,
    hydrateCreditBalance,
    resetSession,
    exportSessionBackup,
    importSessionBackup
  };

  return <TerrariumSessionContext.Provider value={value}>{children}</TerrariumSessionContext.Provider>;
}

export function useTerrariumSession() {
  const context = useContext(TerrariumSessionContext);

  if (!context) {
    throw new Error("useTerrariumSession must be used inside TerrariumSessionProvider");
  }

  return context;
}

export type { WalkSession };
