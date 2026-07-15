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
  createSessionSnapshotEnvelope,
  isValidPrototypeSessionShape,
  runSessionMigrations,
  purchasePrototypeThemeBundle,
  claimPrototypeWalkReward,
  completePrototypeWalkEarly,
  completePrototypeWalkEarlyWithCredit,
  createInitialPrototypeSession,
  createInitialPetBundle,
  deletePrototypeChatHistory,
  deletePrototypeOriginalPhoto,
  dequeueRewardClaim,
  emptyRewardClaimQueue,
  enqueueRewardClaim,
  FIRST_PET_ID,
  getActivePetBundle,
  getActivePrototypePet,
  getBondProgressValue,
  getCareSatisfactionSummary,
  getCreditItemPrice,
  getCreditRewardAmount,
  getExpressionPackById,
  getGenerationAttemptKey,
  getMonotonicGenerationProgress,
  getPrototypeGenerationPollSnapshot,
  getSpendableCreditBalance,
  grantCreditWalletValue,
  grantPrototypeEventItem,
  isNightTime,
  makeMockGeneratedAsset,
  mergePrototypeGeneratedAssets,
  normalizeRestoredGeneration,
  normalizeRestoredPetSetupDraft,
  parseSessionBackup,
  parseSessionSnapshotEnvelope,
  peekRewardClaim,
  pollPrototypeGenerationJob,
  performPrototypeCareAction,
  projectCareStateForTime,
  purchasePrototypeInventoryItem,
  recordCreditItemPurchase,
  recordThemeBundlePurchase,
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
  unlockPrototypeStarterPosesForCareAction,
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
  RewardClaimCopyCategory,
  RewardClaimQueueItem,
  RewardClaimQueueState,
  WeatherCondition,
  WalkSession
} from "@mongchi/shared";
import { homeWalkDurationMs } from "../terrarium/terrariumHomeInteractionContract";
import type { MobileApiError } from "../../shared/api";
import { reporter } from "../../shared/errors/reporter";
import { getActiveAppLocale, getActiveTimeZone } from "../../localization/config";
import { ensureAudioSettingsHydrated, isDaytimeNow, playBgmForThemeAndTimeOfDay } from "../../shared/audio";

import {
  acceptApiGeneratedPet,
  createConfiguredGenerationApiClient,
  pollApiGenerationFlow,
  retryApiGenerationFlow,
  startApiGenerationFlow
} from "./apiGenerationSession";
import { createAsyncActionGuard } from "./asyncActionGuard";
import { requestAppleCredential } from "./appleAuthSession";
import { clearAvatarGenerationRequestId, getOrCreateAvatarGenerationRequestId, rotateAvatarGenerationRequestId } from "./avatarGenerationRequestIdStore";
import { getDevelopmentStoreCreditPresentation, getExpressionPackValidationWallet } from "./developmentStoreCredits";
import { createExpressionPackPurchaseCoordinator } from "./expressionPackPurchaseCoordinator";
import { clearExpressionPackRequestId, getOrCreateExpressionPackRequestId, rotateExpressionPackRequestId } from "./expressionPackRequestIdStore";
import { hasActiveGenerationJob } from "./generationJobGuards";
import { ensureLocalGeneratedAssets } from "./localGeneratedAssetStore";
import { deleteOriginalPhotoFile } from "./originalPhotoFileDeletion";
import { getSupabaseClient } from "./supabaseClient";
import { deleteSupabaseAccountData } from "./supabaseAccountDeletion";
import { getAccountIdentitySummary, linkAppleIdentity, recoverWithAppleIdentity } from "./supabaseAccountLinkSession";
import type { AccountIdentitySummary } from "./supabaseAccountLinkSession";
import { downloadSessionSnapshot, uploadSessionSnapshot } from "./supabaseSessionSnapshotSession";
import { deleteSupabaseChatHistory } from "./supabasePremiumChatSession";
import {
  hydrateServerCreditBalance,
  pollSupabaseExpressionPackFlow,
  pollSupabaseGenerationFlow,
  resyncGeneratedAssetsFromServer,
  retrySupabaseGenerationFlow,
  startSupabaseExpressionPackFlow,
  startSupabaseGenerationFlow,
  unlockSupabaseSleepPoseForNightVisit,
  unlockSupabaseStarterPosesForCareAction
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
  isRenderableGeneratedAssetUri,
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
import { claimSupabaseCreditReward } from "./supabaseRewardSession";
import { purchaseSupabaseInventoryItem, purchaseSupabaseThemeBundle } from "./supabaseShopSession";
import { submitSupportFeedbackToSupabase } from "./supabaseSupportSession";
import { purchaseSupabaseWalkEarlyReturn } from "./supabaseWalkSession";
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
  | { ok: true; messageSafe: string; started: boolean }
  | { ok: false; messageSafe: string };

export type CompleteWalkEarlyResult =
  | { ok: true }
  | { ok: false; reason: "insufficient_balance" | "no_active_walk" | "request_failed" | "unavailable" };

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

/**
 * linkAppleAccount's result. `unavailable`/`canceled`/`failed` pass straight
 * through from appleAuthSession.ts's requestAppleCredential (the native
 * prompt itself never ran or was dismissed); `identity_already_linked`/
 * `linking_disabled`/`request_failed` pass straight through from
 * supabaseAccountLinkSession.ts's linkAppleIdentity (the prompt completed
 * but the server-side link failed). Copy for each reason is Settings'
 * responsibility -- this type only carries the branch.
 */
export type LinkAppleAccountResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unavailable" | "canceled" | "failed" | "identity_already_linked" | "linking_disabled" | "request_failed";
    };

/**
 * recoverAccountWithApple's result. `restored: true` means a server-side
 * snapshot existed and this device's local garden was replaced with it;
 * `restored: false` means the Apple identity recovery itself succeeded (this
 * device is now signed into the recovered account) but there was no usable
 * snapshot to restore, so the local garden was left untouched -- either way
 * credit balance is rehydrated from the (now different) account. `ok: false`
 * only covers a failure before the account swap itself (credential request
 * or recoverWithAppleIdentity) -- see this callback's doc comment below.
 */
export type RecoverAccountWithAppleResult =
  | { ok: true; restored: boolean }
  | { ok: false; reason: "unavailable" | "canceled" | "failed" | "request_failed" };

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
  expressionPackCreditBalance: number;
  paidWalkEarlyReturnAvailable: boolean;
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
  devStoreCreditsAvailable: boolean;
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
  completeWalkEarly: () => Promise<CompleteWalkEarlyResult>;
  applyTheme: (themeId: ItemId) => PurchaseCatalogItemResult;
  purchaseThemeBundle: (bundleId: string) => Promise<PurchaseCatalogItemResult>;
  /** Per-pack id status for the friend page's pose gallery (pending job-start/poll, or a warm failure message). Absent = not currently purchasing. */
  expressionPackPurchaseStatusById: Partial<Record<string, ExpressionPackPurchaseState>>;
  /** Starts (or confirms failure fast for) an expression pack purchase -- see purchaseExpressionPack's doc comment for the full state machine. */
  purchaseExpressionPack: (packId: string) => Promise<PurchaseExpressionPackResult>;
  reportGenerationIssue: (category: GenerationIssueCategory) => void;
  /** SupportScreen's free-text feedback box -- fire-and-forget, same soft-success UX as reportGenerationIssue (see submitSupportFeedback's doc comment). */
  submitSupportFeedback: (input: { message: string; contact?: string }) => void;
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
  /** Whether this device's Supabase session already carries a linked Apple identity -- see getAccountIdentitySummary's doc comment. `{ linked: false }` until the bootstrap fetch below resolves (or there's no Supabase client at all). */
  accountIdentity: AccountIdentitySummary;
  /** Links Sign in with Apple to this device's current session and uploads an immediate server-side snapshot -- see LinkAppleAccountResult's doc comment. */
  linkAppleAccount: () => Promise<LinkAppleAccountResult>;
  /** Signs this device into the Apple identity's owning account and restores its snapshot if one exists -- see RecoverAccountWithAppleResult's doc comment. */
  recoverAccountWithApple: () => Promise<RecoverAccountWithAppleResult>;
  /** The reward-claim card that should be showing right now, or null -- see RewardClaimOverlay (mounted once near the app root). */
  pendingRewardClaim: RewardClaimQueueItem | null;
  /**
   * Queues a credit reward for the owner to tap "Receive" on. `alreadyGrantedLocally`
   * (bond_5/bond_10/collection_complete only) marks that packages/shared's own
   * reducer already added this amount to wallet.bonusCredits as a side effect
   * of the action that triggered it -- claimPendingReward reconciles that on a
   * successful online claim. `localGrantAmountToReconcile` overrides how much
   * to subtract back out when it differs from the displayed/claimed amount
   * (only collection_complete: locally granted 20, claims 10 -- see
   * creditRewards.ts's header comment). A rewardKey already queued or already
   * locally claimed this session is a no-op.
   */
  enqueueCreditRewardClaim: (
    rewardKey: string,
    copyCategory: RewardClaimCopyCategory,
    options?: { alreadyGrantedLocally?: boolean; localGrantAmountToReconcile?: number }
  ) => void;
  /** Grants the daily care treat item immediately (local-only, no server call) and queues its celebration card. `dedupeKey` should be date-scoped (see getDailyTreatRewardKey) so today's treat is never queued twice. */
  enqueueDailyTreatRewardClaim: (dedupeKey: string, itemId: ItemId) => void;
  /** Performs the actual claim for the reward-claim overlay's "Receive" tap -- RPC for a not-yet-granted credit reward, a wallet reconciliation for one packages/shared already granted locally, or an immediate ok for a treat (already granted at enqueue time). */
  claimPendingReward: (item: RewardClaimQueueItem) => Promise<{ ok: boolean }>;
  /** Pops `item` off the front of the queue once its claim animation has finished, revealing the next queued reward (if any). */
  dismissPendingReward: (item: RewardClaimQueueItem) => void;
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

// Caps how many times the one-time generated_assets resync (see
// resyncGeneratedAssetsFromServer's doc comment) retries after an ok:false
// attempt (session not ready yet, transient query error) before giving up
// for the rest of this app session -- bounds the cold-boot-session-race
// retry (next render / app foreground resume) so a persistently offline or
// broken device doesn't retry forever.
const GENERATED_ASSET_RESYNC_MAX_ATTEMPTS = 3;

// Same shape of cap as GENERATED_ASSET_RESYNC_MAX_ATTEMPTS above, but for
// attemptSleepPoseNightUnlock's ok:false retries (session not ready yet,
// transient query error) -- bounds a persistently offline/broken device to a
// handful of tries per app session instead of retrying forever on every
// 30s sessionClock tick through the whole night window.
const SLEEP_POSE_NIGHT_UNLOCK_MAX_ATTEMPTS = 5;

// Debounce window for the automatic server-side session-snapshot upload
// effect below -- long enough that a burst of care-action taps only
// produces one upload instead of one per tap, short enough that the
// snapshot is never far behind the real session (and the AppState
// background listener flushes immediately regardless, so this window is
// only ever "how long a snapshot can lag while the app stays foregrounded").
const SNAPSHOT_AUTO_UPLOAD_DEBOUNCE_MS = 15_000;

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
  const [apiRuntime] = useState(() =>
    createConfiguredDailyLoopApiClient(undefined, undefined, getActiveAppLocale, getActiveTimeZone)
  );
  const [generationApiRuntime] = useState(() =>
    createConfiguredGenerationApiClient(undefined, undefined, getActiveAppLocale, getActiveTimeZone)
  );
  const [apiCatalogItems, setApiCatalogItems] = useState<Item[] | null>(null);
  const [apiCommerceProducts, setApiCommerceProducts] = useState<CommerceProduct[] | null>(null);
  const [apiEntitlements, setApiEntitlements] = useState<Entitlement[] | null>(null);
  const [generatedAssetReadUrls, setGeneratedAssetReadUrls] = useState<Partial<Record<GeneratedAssetId, GeneratedAssetReadUrlCacheEntry>>>({});
  // Ids that ensureLocalGeneratedAssets has already copied to a permanent
  // on-device file -- see the local-asset-hydration effect below and
  // generatedAssetUriById's local-uri precedence.
  const [localGeneratedAssetUris, setLocalGeneratedAssetUris] = useState<Partial<Record<GeneratedAssetId, string>>>({});
  const nativeStoreConnection = useRef<NativeStorePurchaseConnection | null>(null);
  const [nativeCheckoutReady, setNativeCheckoutReady] = useState(false);
  const [purchaseInProgressProductId, setPurchaseInProgressProductId] = useState<string | null>(null);
  const [purchaseStatusMessage, setPurchaseStatusMessage] = useState<string | null>(null);
  const [weatherLocationStatus, setWeatherLocationStatus] = useState<LocationWeatherRefreshStatus>("idle");
  const [weatherLocationMessage, setWeatherLocationMessage] = useState<string | null>(null);
  // Account recovery stack, package C: whether this device's Supabase
  // session already carries a linked Apple identity -- see
  // getAccountIdentitySummary's doc comment. Defaults unlinked and is
  // fetched once at bootstrap (see the effect below); linkAppleAccount and
  // recoverAccountWithApple also refresh it after a successful link/recover.
  const [accountIdentity, setAccountIdentity] = useState<AccountIdentitySummary>({ linked: false });
  const [sessionClock, setSessionClock] = useState(() => Date.now());
  const [careCooldownUntilByAction, setCareCooldownUntilByAction] = useState<Partial<Record<CareActionType, number>>>({});
  // Reward-claim overlay queue (RewardClaimOverlay, mounted once near the app
  // root -- see app/_layout.tsx): every credit/treat reward source (settlement
  // missions, care-streak milestones, the monthly letter, the walk journal
  // completing, bond levels, the daily care treat) pushes into this single
  // queue instead of granting silently, so the owner always sees and taps
  // "Receive" before a reward lands. See enqueueCreditRewardClaim/
  // enqueueDailyTreatRewardClaim/claimPendingReward/dismissPendingReward below.
  const [rewardClaimQueue, setRewardClaimQueue] = useState<RewardClaimQueueState>(emptyRewardClaimQueue);
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
  // Guards the one-time full generated_assets resync below. `doneRef` is
  // only ever set on a *definitive* outcome (a completed fetch, even an
  // empty one) -- never synchronously before the async call resolves, and
  // never on an ok:false attempt (session not ready yet, transient query
  // error). A cold-boot race was observed on a real device where the guard
  // used to be consumed before the (unlucky, session-not-ready) attempt even
  // resolved, permanently burning the device's only resync chance even
  // though the very same session became available moments later -- see
  // resyncGeneratedAssetsFromServer's doc comment. `attemptsRef` bounds how
  // many ok:false retries (next render / app foreground resume) are allowed
  // before giving up for the rest of this app session (see
  // GENERATED_ASSET_RESYNC_MAX_ATTEMPTS), and `guard` just prevents two
  // overlapping in-flight attempts.
  const generatedAssetResyncDoneRef = useRef(false);
  const generatedAssetResyncAttemptsRef = useRef(0);
  const generatedAssetResyncGuard = useRef(createAsyncActionGuard());
  // Guards attemptSleepPoseNightUnlock below -- same doneRef/attemptsRef/guard
  // shape as generatedAssetResyncDoneRef just above, for the same reason: a
  // definitive outcome (even an empty unlock) sets doneRef, an ok:false
  // attempt does not (so the next sessionClock tick or hydration retries, up
  // to SLEEP_POSE_NIGHT_UNLOCK_MAX_ATTEMPTS), and guard just prevents two
  // overlapping in-flight RPC calls.
  const sleepPoseNightUnlockDoneRef = useRef(false);
  const sleepPoseNightUnlockAttemptsRef = useRef(0);
  const sleepPoseNightUnlockGuard = useRef(createAsyncActionGuard());
  const expressionPackPurchaseCoordinatorRef = useRef(
    createExpressionPackPurchaseCoordinator(() => Crypto.randomUUID())
  );
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

  // Account recovery stack, package C bootstrap: a single read of whether
  // this device's Supabase session already carries a linked Apple identity,
  // so Settings can render "Apple로 연결" vs. the already-linked status row
  // without waiting on a user action first. Independent of the hydration
  // effect above (accountIdentity is not part of PrototypeSessionState) --
  // runs once per mount, a no-op without a Supabase client.
  useEffect(() => {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return;
    }

    let cancelled = false;

    void getAccountIdentitySummary(supabaseClient).then((summary) => {
      if (!cancelled) {
        setAccountIdentity(summary);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Theme-aware BGM (see bgmAssets.ts's getBgmTrackForTheme and
  // PROVENANCE.md's bgm_theme_* prototypes): whenever the selected garden
  // theme changes -- including once at hydration, since the initial render
  // uses createInitialPrototypeSession's default before AsyncStorage
  // restores the real value -- crossfade BGM into that theme's day track and
  // remember the theme id (module-level in bgmPlayer.ts) so a later plain
  // playBgmForTimeOfDay(isDaytimeNow()) call elsewhere (e.g.
  // TerrariumHomeScreen's own mount effect, which only knows day/night) also
  // resolves to it without needing the theme threaded through again.
  //
  // Bugfix: awaits ensureAudioSettingsHydrated() first, same reasoning as
  // app/_layout.tsx's own startup BGM call -- this effect can fire (at
  // Provider mount, before the user has ever opened Settings) before
  // getActiveAudioSettings() reflects the real persisted Music setting, so
  // calling playBgmForThemeAndTimeOfDay before that would ignore a
  // previously-saved "off" and start playback anyway.
  useEffect(() => {
    let cancelled = false;
    const themeId = state.inventory.selectedTerrariumThemeId;

    void ensureAudioSettingsHydrated().then(() => {
      if (!cancelled) {
        playBgmForThemeAndTimeOfDay(themeId, isDaytimeNow());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [state.inventory.selectedTerrariumThemeId]);

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

  // One-time-ish full resync of this account's own unlocked generated_assets
  // -- see resyncGeneratedAssetsFromServer's doc comment in
  // supabaseGenerationSession.ts for why this exists (expression-pack
  // completions otherwise only ever reach local state through the in-memory
  // poll-and-merge effect further down, which has no way to recover a pack
  // this device never observed completing live). Passes TWO different ids,
  // deliberately not conflated (a real-device bug did exactly that -- see
  // resyncGeneratedAssetsFromServerInner's doc comment): state.activePetId
  // (the pet *bundle key*, e.g. FIRST_PET_ID) decides the server pet_id
  // scope, while activeBundle.petProfile.id (an unrelated per-profile
  // pet_local_<uuid>) only tags the resulting assets, matching every other
  // asset already in acceptedAssets. Purely additive:
  // mergePrototypeGeneratedAssets only ever adds/refreshes per-state
  // entries, so a device that is already fully in sync just merges in the
  // same assets it already had.
  //
  // "One-time-ish" rather than strictly once: an ok:false result (session
  // not ready yet, transient query error) does NOT consume
  // generatedAssetResyncDoneRef, specifically so a cold-boot race where the
  // Supabase client's persisted session hasn't finished restoring by the
  // time this first runs gets another chance on the next natural trigger
  // (this callback's own identity changing, or the app foreground effect
  // below) instead of permanently stranding server-only assets -- see
  // generatedAssetResyncDoneRef's doc comment above for the incident this
  // fixes. GENERATED_ASSET_RESYNC_MAX_ATTEMPTS bounds the retries.
  const attemptGeneratedAssetResync = useCallback(() => {
    if (generatedAssetResyncDoneRef.current || storeScreenshotPreset || qaScreenPreset) {
      return;
    }

    if (generatedAssetResyncAttemptsRef.current >= GENERATED_ASSET_RESYNC_MAX_ATTEMPTS) {
      generatedAssetResyncDoneRef.current = true;
      return;
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient || !activeBundle.petProfile) {
      return;
    }

    const assetPetId = activeBundle.petProfile.id;

    generatedAssetResyncGuard.current.run(async () => {
      generatedAssetResyncAttemptsRef.current += 1;

      const result = await resyncGeneratedAssetsFromServer(supabaseClient, state.activePetId, assetPetId, nowIso());

      if (!result.ok) {
        // Retryable (session not ready yet, transient query error) --
        // doneRef stays false so the next trigger tries again, up to the
        // attempt cap above.
        return;
      }

      generatedAssetResyncDoneRef.current = true;

      if (result.data.assets.length === 0) {
        return;
      }

      setState((current) => mergePrototypeGeneratedAssets(current, result.data.assets));
    });
  }, [activeBundle.petProfile, qaScreenPreset, state.activePetId, storeScreenshotPreset]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    attemptGeneratedAssetResync();
  }, [attemptGeneratedAssetResync, isHydrated]);

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

  // Supabase-mode assets are the only ones backed by real (private,
  // signed-url-only) storage -- mock/bundled/API-mode-preset assets use
  // mock:// or require()'d uris that ensureLocalGeneratedAssets has no
  // business touching, so isRenderableGeneratedAssetUri filters those out
  // before this ever attempts a download. Re-runs whenever the accepted
  // asset list changes (new expression pack merge, starter-pose unlock
  // merge, a fresh idle asset after generation) and skips ids that already
  // resolved to a local file, so a steady state with nothing new to
  // download is a no-op rather than a per-render/per-tick download attempt.
  const generatedAssetsToLocalize = useMemo(() => {
    const seen = new Set<GeneratedAssetId>();
    const assets: GeneratedAsset[] = [];

    for (const asset of [
      ...activeBundle.acceptedAssets,
      ...(activeBundle.acceptedAsset ? [activeBundle.acceptedAsset] : [])
    ]) {
      if (asset?.id && asset.uri && isRenderableGeneratedAssetUri(asset.uri) && !seen.has(asset.id)) {
        seen.add(asset.id);
        assets.push(asset);
      }
    }

    return assets;
  }, [activeBundle.acceptedAsset, activeBundle.acceptedAssets]);

  useEffect(() => {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return;
    }

    const assetsNeedingLocalCopy = generatedAssetsToLocalize.filter((asset) => !localGeneratedAssetUris[asset.id]);

    if (assetsNeedingLocalCopy.length === 0) {
      return;
    }

    let cancelled = false;

    void ensureLocalGeneratedAssets(supabaseClient, assetsNeedingLocalCopy).then((localUriByAssetId) => {
      if (cancelled || Object.keys(localUriByAssetId).length === 0) {
        return;
      }

      setLocalGeneratedAssetUris((current) => ({ ...current, ...localUriByAssetId }));
    });

    return () => {
      cancelled = true;
    };
  }, [generatedAssetsToLocalize, localGeneratedAssetUris]);

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

        const storedRequest = await getOrCreateAvatarGenerationRequestId(
          AsyncStorage,
          activePet.id,
          state.photo.selectedPhotoUri ?? "mock-photo",
          () => Crypto.randomUUID()
        );

        if (!storedRequest.ok) {
          setApiGenerationError({
            status: 0,
            code: "generation_request_storage_failed",
            messageSafe: "Could not safely start this move-in. Try again soon.",
            retryable: true
          });
          return;
        }

        const result = await startSupabaseGenerationFlow(
          supabaseClient,
          legacyFlatState,
          startedAt,
          undefined,
          storedRequest.requestId
        );

        if (!result.ok) {
          if (result.error.code === "idempotency_conflict") {
            await rotateAvatarGenerationRequestId(
              AsyncStorage,
              activePet.id,
              state.photo.selectedPhotoUri ?? "mock-photo",
              Crypto.randomUUID()
            );
          }
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

          const terminalStatus = result.data.generation?.status;

          if (terminalStatus === "completed" || terminalStatus === "failed") {
            await clearAvatarGenerationRequestId(AsyncStorage, activePet.id);
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
          if (result.error.code === "idempotency_conflict") {
            await rotateAvatarGenerationRequestId(
              AsyncStorage,
              activePet.id,
              state.photo.selectedPhotoUri ?? "mock-photo",
              Crypto.randomUUID()
            );
          }
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

        const storedRequest = await getOrCreateAvatarGenerationRequestId(
          AsyncStorage,
          activePet.id,
          state.photo.selectedPhotoUri ?? "mock-photo",
          () => Crypto.randomUUID()
        );

        if (!storedRequest.ok) {
          setApiGenerationError({
            status: 0,
            code: "generation_request_storage_failed",
            messageSafe: "Could not safely retry this move-in. Try again soon.",
            retryable: true
          });
          return;
        }

        const result = await retrySupabaseGenerationFlow(
          supabaseClient,
          legacyFlatState,
          retriedAt,
          undefined,
          storedRequest.requestId
        );

        if (!result.ok) {
          if (result.error.code === "idempotency_conflict") {
            await rotateAvatarGenerationRequestId(
              AsyncStorage,
              activePet.id,
              state.photo.selectedPhotoUri ?? "mock-photo",
              Crypto.randomUUID()
            );
          }
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
      setState((current) => acceptPrototypeGeneratedPet(current, nowIso(), { preserveAssets: true, locale: getActiveAppLocale() }));
      return;
    }

    if (generationApiRuntime.mode !== "api") {
      setState((current) => acceptPrototypeGeneratedPet(current, nowIso(), { locale: getActiveAppLocale() }));
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

  const unlockStarterPosesAfterCare = useCallback(
    (action: CareActionType, occurredAt: string) => {
      const supabaseClient = getSupabaseClient();

      if (!supabaseClient) {
        return;
      }

      void unlockSupabaseStarterPosesForCareAction(supabaseClient, legacyFlatState, action, occurredAt).then((result) => {
        if (!result.ok) {
          reporter.captureMessage("starterPose: unlock failed", { action, code: result.error.code });
          return;
        }

        if (result.data.assets.length > 0) {
          setState((current) => mergePrototypeGeneratedAssets(current, result.data.assets));
        }
      });
    },
    [legacyFlatState]
  );

  // First-night sleep pose unlock (see
  // supabase/migrations/0022_sleep_pose_night_unlock.sql's header comment for
  // why unlockStarterPosesAfterCare's rest-only path above can never reach
  // the sleep asset in practice): the very first time this device reports
  // Home being open during the 22:00-06:00 night window (isNightTime, the
  // same boundary TerrariumHomeScreen's own night-sleep visuals already use),
  // this unlocks the sleep asset server-side and merges it in. From then on,
  // selectGeneratedAssetForReaction's existing "sleep" preference (already
  // wired to isShowingNightSleepPose in TerrariumHomeScreen) picks the real
  // sleep sprite instead of silently falling back to idle -- no home-screen
  // rendering change needed.
  //
  // "One-time-ish" like attemptGeneratedAssetResync above: sleepPoseNight
  // UnlockDoneRef is only set on a *definitive* outcome (including an empty
  // unlock, or acceptedAssets already having a sleep asset), never on an
  // ok:false attempt (session not ready yet, transient query error) -- so the
  // next sessionClock tick (every 30s, see the effect below) or the next
  // hydration retries, up to SLEEP_POSE_NIGHT_UNLOCK_MAX_ATTEMPTS.
  const attemptSleepPoseNightUnlock = useCallback(() => {
    if (sleepPoseNightUnlockDoneRef.current || storeScreenshotPreset || qaScreenPreset) {
      return;
    }

    if (activeBundle.acceptedAssets.some((asset) => asset.state === "sleep")) {
      sleepPoseNightUnlockDoneRef.current = true;
      return;
    }

    if (!isNightTime(nowIso())) {
      return;
    }

    if (sleepPoseNightUnlockAttemptsRef.current >= SLEEP_POSE_NIGHT_UNLOCK_MAX_ATTEMPTS) {
      sleepPoseNightUnlockDoneRef.current = true;
      return;
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return;
    }

    sleepPoseNightUnlockGuard.current.run(async () => {
      sleepPoseNightUnlockAttemptsRef.current += 1;

      const result = await unlockSupabaseSleepPoseForNightVisit(supabaseClient, legacyFlatState, nowIso());

      if (!result.ok) {
        reporter.captureMessage("sleepPose: night unlock failed", { code: result.error.code });
        return;
      }

      sleepPoseNightUnlockDoneRef.current = true;

      if (result.data.assets.length === 0) {
        return;
      }

      setState((current) => mergePrototypeGeneratedAssets(current, result.data.assets));
    });
  }, [activeBundle.acceptedAssets, legacyFlatState, qaScreenPreset, storeScreenshotPreset]);

  // Runs at hydration and again every sessionClock tick (30s, see the
  // existing sessionClock interval above) so a session that was opened
  // during the day still catches the moment it crosses into night, without a
  // dedicated new timer.
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    attemptSleepPoseNightUnlock();
  }, [attemptSleepPoseNightUnlock, isHydrated, sessionClock]);

  const performCareAction = useCallback(
    (action: CareActionType, itemId?: ItemId) => {
      const occurredAt = nowIso();

      if (apiRuntime.mode !== "api") {
        const supabaseClient = getSupabaseClient();

        setState((current) => {
          const cared = performPrototypeCareAction(current, action, occurredAt, itemId, {
            locale: getActiveAppLocale(),
            walkDurationMs: homeWalkDurationMs
          });

          return supabaseClient ? cared : unlockPrototypeStarterPosesForCareAction(cared, action, occurredAt);
        });
        unlockStarterPosesAfterCare(action, occurredAt);
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
          unlockStarterPosesAfterCare(action, occurredAt);
          setApiSyncStatus("ready");
        }
      );
    },
    [activePet.id, apiRuntime, applyApiStatePatch, catalogItems, legacyFlatState, setApiError, unlockStarterPosesAfterCare]
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
      locale: getActiveAppLocale(),
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
      setState((current) => refreshPrototypeWalk(current, refreshedAt, getActiveAppLocale()));
      return;
    }

    setState((current) =>
      withActivePetBundle(current, (bundle) => ({
        activeWalk: refreshApiWalkLocally(bundle.activeWalk, refreshedAt)
      }))
    );
  }, [apiRuntime]);

  const completeWalkEarly = useCallback(async (): Promise<CompleteWalkEarlyResult> => {
    const walk = activeBundle.activeWalk;

    if (!walk || walk.status !== "walking") {
      return { ok: false, reason: "no_active_walk" };
    }

    if (apiRuntime.mode === "api") {
      return { ok: false, reason: "unavailable" };
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      const result = completePrototypeWalkEarlyWithCredit(state, nowIso(), 1, getActiveAppLocale());

      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }

      setState(result.state);
      return { ok: true };
    }

    setApiSyncStatus("syncing");
    setApiErrorMessage(null);

    const purchase = await purchaseSupabaseWalkEarlyReturn(supabaseClient, walk.id);

    if (!purchase.ok) {
      if (purchase.reason === "insufficient_balance") {
        setState((current) => ({
          ...current,
          wallet: { ...current.wallet, credits: purchase.serverBalance, updatedAt: nowIso() }
        }));
        setApiSyncStatus("ready");
        return { ok: false, reason: "insufficient_balance" };
      }

      setApiError(purchase.error);
      return { ok: false, reason: "request_failed" };
    }

    const completedAt = nowIso();
    setState((current) => {
      const currentWalk = getActivePetBundle(current).activeWalk;
      const withServerBalance = {
        ...current,
        wallet: { ...current.wallet, credits: purchase.serverBalance, updatedAt: completedAt }
      };

      if (!currentWalk || currentWalk.id !== walk.id || currentWalk.status !== "walking") {
        return withServerBalance;
      }

      return completePrototypeWalkEarly(withServerBalance, completedAt, getActiveAppLocale());
    });
    setApiSyncStatus("ready");
    return { ok: true };
  }, [activeBundle.activeWalk, apiRuntime.mode, setApiError, state]);

  const claimWalkReward = useCallback(() => {
    if (apiRuntime.mode !== "api") {
      setState((current) => claimPrototypeWalkReward(current, nowIso(), getActiveAppLocale()));
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

  const pendingRewardClaim = useMemo(() => peekRewardClaim(rewardClaimQueue), [rewardClaimQueue]);

  const enqueueCreditRewardClaim = useCallback(
    (
      rewardKey: string,
      copyCategory: RewardClaimCopyCategory,
      options?: { alreadyGrantedLocally?: boolean; localGrantAmountToReconcile?: number }
    ) => {
      const amount = getCreditRewardAmount(rewardKey);

      if (!amount) {
        return;
      }

      setRewardClaimQueue((current) =>
        enqueueRewardClaim(current, {
          id: rewardKey,
          kind: "credit",
          rewardKey,
          copyCategory,
          amount,
          ...(options?.alreadyGrantedLocally ? { alreadyGrantedLocally: true } : {}),
          ...(options?.localGrantAmountToReconcile !== undefined
            ? { localGrantAmountToReconcile: options.localGrantAmountToReconcile }
            : {})
        })
      );
    },
    []
  );

  const enqueueDailyTreatRewardClaim = useCallback((dedupeKey: string, itemId: ItemId) => {
    // Local-only reward -- granted the instant it's earned (no server call,
    // no "unclaimed" window), matching this reward budget's "데일리=간식,
    // 크레딧=기념일" principle. The overlay still queues a claim card so the
    // moment gets the same warm, tap-to-receive presentation as every credit
    // reward; claimPendingReward below just acknowledges it.
    setState((current) => grantPrototypeEventItem(current, itemId, nowIso()));
    setRewardClaimQueue((current) =>
      enqueueRewardClaim(current, {
        id: dedupeKey,
        kind: "treat",
        rewardKey: dedupeKey,
        copyCategory: "daily_treat",
        itemId
      })
    );
  }, []);

  const claimPendingReward = useCallback(async (item: RewardClaimQueueItem): Promise<{ ok: boolean }> => {
    if (item.kind === "treat") {
      // Already granted at enqueue time -- see enqueueDailyTreatRewardClaim.
      return { ok: true };
    }

    const amount = item.amount ?? 0;
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      // Dev/offline fallback: bond_5/bond_10/collection_complete were already
      // granted locally by packages/shared's own reducer the instant the
      // level-up/journal-completion happened, so there's nothing left to
      // grant here -- the tap is just the acknowledgment. Settlement/streak/
      // letter rewards were never granted until now, so grant them locally.
      if (!item.alreadyGrantedLocally) {
        setState((current) => ({ ...current, wallet: grantCreditWalletValue(current.wallet, { bonusCredits: amount }, nowIso()) }));
      }

      return { ok: true };
    }

    const result = await claimSupabaseCreditReward(supabaseClient, item.rewardKey);

    if (!result.ok) {
      return { ok: false };
    }

    setState((current) => ({
      ...current,
      wallet: {
        ...current.wallet,
        credits: result.serverBalance,
        // Reconcile the amount packages/shared's reducer already added to
        // bonusCredits (bond_5/bond_10/collection_complete only) now that the
        // same credits are landing in the server-authoritative `credits`
        // field instead -- see this callback's sibling doc comment on
        // enqueueCreditRewardClaim in the context interface above.
        bonusCredits: item.alreadyGrantedLocally
          ? Math.max(0, current.wallet.bonusCredits - (item.localGrantAmountToReconcile ?? amount))
          : current.wallet.bonusCredits,
        updatedAt: nowIso()
      }
    }));

    return { ok: true };
  }, []);

  const dismissPendingReward = useCallback((item: RewardClaimQueueItem) => {
    setRewardClaimQueue((current) => (peekRewardClaim(current)?.id === item.id ? dequeueRewardClaim(current) : current));
  }, []);

  const purchaseThemeBundle = useCallback(
    async (bundleId: string): Promise<PurchaseCatalogItemResult> => {
      if (apiRuntime.mode === "api") {
        return { ok: false, messageSafe: "Theme bundles are coming to the live store soon." };
      }

      const supabaseClient = getSupabaseClient();

      if (supabaseClient) {
        setApiSyncStatus("syncing");
        setApiErrorMessage(null);

        const requestId = Crypto.randomUUID();
        const purchase = await purchaseSupabaseThemeBundle(supabaseClient, bundleId, requestId);

        if (!purchase.ok) {
          setApiSyncStatus("ready");

          if (purchase.reason === "insufficient_balance") {
            setState((current) => ({
              ...current,
              wallet: { ...current.wallet, credits: purchase.serverBalance, updatedAt: nowIso() }
            }));

            return { ok: false, messageSafe: "Not enough credits for this set." };
          }

          if (purchase.reason === "unknown_item") {
            return { ok: false, messageSafe: "This set is not available." };
          }

          setApiError(purchase.error);
          return { ok: false, messageSafe: purchase.error.messageSafe };
        }

        const grantedAt = nowIso();
        let alreadyOwned = false;

        // The RPC already debited credit_wallets server-side -- grant the
        // local theme via recordThemeBundlePurchase (no wallet spend) and
        // correct wallet.credits to the server's returned balance, rather
        // than also spending locally (see completeWalkEarly's identical
        // serverBalance-correction pattern).
        setState((current) => {
          const withServerBalance = {
            ...current,
            wallet: { ...current.wallet, credits: purchase.serverBalance, updatedAt: grantedAt }
          };
          const granted = recordThemeBundlePurchase(withServerBalance, bundleId, grantedAt, getActiveAppLocale());

          if (!granted.ok) {
            return withServerBalance;
          }

          alreadyOwned = granted.alreadyOwned;
          return granted.state;
        });
        setApiSyncStatus("ready");

        return {
          ok: true,
          mode: apiRuntime.mode,
          messageSafe: alreadyOwned ? "Theme applied to the garden!" : "New theme unlocked and applied to the garden!",
          placed: true
        };
      }

      const devStoreUnlocked = isDevelopmentStoreUnlockEnabled();
      const purchasedAt = nowIso();
      const result = purchasePrototypeThemeBundle(
        devStoreUnlocked ? withDevelopmentPurchaseWallet(state, DEVELOPMENT_STORE_CREDIT_BALANCE, purchasedAt) : state,
        bundleId,
        purchasedAt,
        getActiveAppLocale()
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
    [apiRuntime, setApiError, state]
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
        return { ok: true, messageSafe: "New moments are already on their way...", started: false };
      }

      const devStoreUnlocked = isDevelopmentStoreUnlockEnabled();
      const supabaseClient = getSupabaseClient();
      const purchasedAt = nowIso();
      const hasAuthoritativeWallet = supabaseClient !== null || apiRuntime.mode === "api";
      const { devStoreCreditsAvailable } = getDevelopmentStoreCreditPresentation({
        developmentCreditBalance: DEVELOPMENT_STORE_CREDIT_BALANCE,
        devStoreUnlocked,
        hasServerWallet: hasAuthoritativeWallet,
        serverCreditBalance: state.wallet.credits,
        spendableCreditBalance: getSpendableCreditBalance(state.wallet)
      });
      const validationState = devStoreCreditsAvailable
        ? withDevelopmentPurchaseWallet(state, DEVELOPMENT_STORE_CREDIT_BALANCE, purchasedAt)
        : hasAuthoritativeWallet
          ? {
              ...state,
              wallet: getExpressionPackValidationWallet(state.wallet, true)
            }
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

      if (!supabaseClient && apiRuntime.mode === "api") {
        return { ok: false, messageSafe: "Pose packs are coming to the live store soon." };
      }

      if (!supabaseClient) {
        setExpressionPackPending(pack.id);
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

        return { ok: true, messageSafe: `New moments unlocked: ${pack.nameEn}!`, started: true };
      }

      setExpressionPackPending(pack.id);
      const storedRequest = await getOrCreateExpressionPackRequestId(
        AsyncStorage,
        activePet.id,
        pack.id,
        () => Crypto.randomUUID()
      );

      if (!storedRequest.ok) {
        setExpressionPackFailed(pack.id, "Could not safely start this pose pack. Try again soon.");
        return { ok: false, messageSafe: "Could not safely start this pose pack. Try again soon." };
      }

      const attempt = expressionPackPurchaseCoordinatorRef.current.begin(pack.id, storedRequest.requestId);

      if (!attempt.ok) {
        setExpressionPackFailed(pack.id, "Wait for the current pose pack to start, then try again.");
        return { ok: false, messageSafe: "Wait for the current pose pack to start, then try again." };
      }

      const requestId = attempt.requestId;
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
        const definitiveFailure = started.error.code === "insufficient_credits" || started.error.code === "idempotency_conflict";
        expressionPackPurchaseCoordinatorRef.current.finish(
          pack.id,
          definitiveFailure ? "definitive_failure" : "retryable_failure"
        );

        if (definitiveFailure) {
          let requestIdUpdated: boolean;

          if (started.error.code === "idempotency_conflict") {
            requestIdUpdated = await rotateExpressionPackRequestId(AsyncStorage, activePet.id, pack.id, Crypto.randomUUID());
          } else {
            requestIdUpdated = await clearExpressionPackRequestId(AsyncStorage, activePet.id, pack.id);
          }

          if (!requestIdUpdated) {
            reporter.captureMessage("expressionPack: terminal request id update failed", {
              packId: pack.id,
              outcome: started.error.code
            });
          }
          const hydrated = await hydrateServerCreditBalance(supabaseClient);

          if (hydrated.ok) {
            setState((current) => ({
              ...current,
              wallet: { ...current.wallet, credits: hydrated.credits, updatedAt: nowIso() }
            }));
          }
        }

        setExpressionPackFailed(pack.id, started.error.messageSafe);
        return { ok: false, messageSafe: started.error.messageSafe };
      }

      setState((current) => {
        const pet = getActivePrototypePet(current, purchasedAt);
        const recorded = recordExpressionPackJobStart(
          current,
          {
            packId: pack.id,
            jobId: started.data.jobId,
            requestId,
            petId: pet.id,
            startedAt: purchasedAt
          },
          purchasedAt
        );

        return recorded.ok ? recorded.state : current;
      });
      setExpressionPackJobIdByPackId((current) => ({ ...current, [pack.id]: started.data.jobId }));
      expressionPackPurchaseCoordinatorRef.current.finish(pack.id, "completed");

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

      return { ok: true, messageSafe: "New moments are on their way...", started: true };
    },
    [
      clearExpressionPackStatus,
      activePet.id,
      apiRuntime.mode,
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
            const requestIdCleared = await clearExpressionPackRequestId(AsyncStorage, petId, packId);

            if (!requestIdCleared) {
              reporter.captureMessage("expressionPack: failed request id cleanup failed", { packId });
            }
            setState((current) => clearPendingExpressionPackJob(current, packId, polledAt));
            setExpressionPackFailed(
              packId,
              result.data.failureMessageSafe ?? "The tiny door got stuck. Let's try adding these expressions again."
            );
            void hydrateServerCreditBalance(supabaseClient).then((hydrated) => {
              if (!hydrated.ok) {
                return;
              }

              setState((current) => ({
                ...current,
                wallet: { ...current.wallet, credits: hydrated.credits, updatedAt: nowIso() }
              }));
            });
            continue;
          }

          if (result.data.status === "completed") {
            const requestIdCleared = await clearExpressionPackRequestId(AsyncStorage, petId, packId);

            if (!requestIdCleared) {
              reporter.captureMessage("expressionPack: completed request id cleanup failed", { packId });
            }
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
      const supabaseClient = getSupabaseClient();

      if (!price) {
        return {
          ok: false,
          messageSafe: "This item is not available for credits yet."
        };
      }

      const purchasedAt = nowIso();

      if (apiRuntime.mode !== "api") {
        if (supabaseClient) {
          setApiSyncStatus("syncing");
          setApiErrorMessage(null);

          const requestId = Crypto.randomUUID();
          const purchase = await purchaseSupabaseInventoryItem(supabaseClient, itemId, requestId);

          if (!purchase.ok) {
            setApiSyncStatus("ready");

            if (purchase.reason === "insufficient_balance") {
              setState((current) => ({
                ...current,
                wallet: { ...current.wallet, credits: purchase.serverBalance, updatedAt: nowIso() }
              }));

              return { ok: false, messageSafe: "Not enough credits for this item." };
            }

            if (purchase.reason === "unknown_item") {
              return { ok: false, messageSafe: "This item is not available for credits yet." };
            }

            setApiError(purchase.error);
            return { ok: false, messageSafe: purchase.error.messageSafe };
          }

          const grantedAt = nowIso();

          // The RPC already debited credit_wallets server-side -- grant the
          // local item via recordCreditItemPurchase (no wallet spend) and
          // correct wallet.credits to the server's returned balance, rather
          // than also spending locally, so this can never double-charge (see
          // completeWalkEarly's identical serverBalance-correction pattern).
          setState((current) => {
            const withServerBalance = {
              ...current,
              wallet: { ...current.wallet, credits: purchase.serverBalance, updatedAt: grantedAt }
            };
            const granted = recordCreditItemPurchase(withServerBalance, itemId, grantedAt);

            return granted.ok ? granted.state : withServerBalance;
          });
          setApiSyncStatus("ready");

          return {
            ok: true,
            mode: apiRuntime.mode,
            messageSafe: `Used ${price.creditCost} credits.`,
            placed: false
          };
        }

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

    // Live Supabase collection for the generation-issue report, alongside
    // the local record above -- fire-and-forget, same soft-success shape as
    // submitSupportFeedback below: SupportScreen already shows its "Saved"
    // confirmation from the local state update regardless of this call's
    // outcome, so a network hiccup here must never surface as an error.
    const supabaseClient = getSupabaseClient();

    if (supabaseClient) {
      void submitSupportFeedbackToSupabase(supabaseClient, {
        category: "generation_issue",
        subcategory: category,
        context: {
          category,
          petId: activePet.id,
          ...(activePet.activeGenerationJobId ? { generationJobId: activePet.activeGenerationJobId } : {})
        }
      });
    }

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

  /**
   * SupportScreen's free-text feedback box. Fire-and-forget by design, same
   * as reportGenerationIssue above -- the caller (SupportScreen) shows its
   * warm confirmation and clears the input the moment this is called,
   * without waiting on the network round-trip, so feedback always feels
   * received even on a flaky connection. A no-op without a Supabase client
   * (nothing to send to in local/legacy-api modes).
   */
  const submitSupportFeedback = useCallback((input: { message: string; contact?: string }) => {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return;
    }

    void submitSupportFeedbackToSupabase(supabaseClient, {
      category: "feedback",
      message: input.message,
      ...(input.contact ? { contact: input.contact } : {}),
      context: { petId: activePet.id }
    });
  }, [activePet.id]);

  const deleteOriginalPhoto = useCallback(() => {
    const deletedAt = nowIso();

    // Best-effort, idempotent actual file delete -- fired before the local
    // state clear below, never awaited (a slow or failing filesystem call
    // must not hold up "Delete local photo copy" completing for the user).
    // See deleteOriginalPhotoFile's doc comment: previously this callback
    // only forgot the file's path, it never removed the bytes themselves.
    void deleteOriginalPhotoFile(state.photo.selectedPhotoUri);

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
  }, [activePet.id, apiRuntime, setApiError, state.photo.selectedPhotoUri]);

  const deleteChatHistory = useCallback(() => {
    const deletedAt = nowIso();
    const supabaseClient = getSupabaseClient();

    // Live Supabase conversations/conversation_messages are a separate store
    // from the dead services/api client below (and from local prototype
    // state) -- delete_own_chat_history (0018_chat_day_pass.sql) is the only
    // path that actually reaches them. A failure here is reported honestly
    // (setApiError) rather than quietly falling through to "looks deleted".
    if (supabaseClient) {
      setApiSyncStatus("syncing");
      setApiErrorMessage(null);

      void deleteSupabaseChatHistory(supabaseClient).then((result) => {
        if (!result.ok) {
          setApiError(result.error);
          return;
        }

        setState((current) => deletePrototypeChatHistory(current, deletedAt));
        setApiSyncStatus("ready");
      });

      return;
    }

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

  /**
   * Account recovery stack, package C: "Link Apple ID" from Settings.
   * requestAppleCredential's own reason (unavailable/canceled/failed) passes
   * straight through if the native prompt itself didn't complete -- no
   * Supabase call is ever attempted in that case. Once linkAppleIdentity
   * confirms the link, accountIdentity is refreshed (so Settings can flip
   * from "Link" to the connected status row without waiting for the next
   * app launch) and the current session is uploaded as an immediate
   * server-side snapshot -- see uploadSessionSnapshot's doc comment -- so a
   * device that links and is then lost the same day still has something to
   * recover from. The upload is best-effort: its own failure doesn't turn a
   * successful link into an error (the automatic debounce effect below will
   * pick it up on the next session change regardless).
   */
  const linkAppleAccount = useCallback(async (): Promise<LinkAppleAccountResult> => {
    const credential = await requestAppleCredential();

    if (!credential.ok) {
      return credential;
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return { ok: false, reason: "request_failed" };
    }

    const linked = await linkAppleIdentity(supabaseClient, credential);

    if (!linked.ok) {
      return linked;
    }

    const summary = await getAccountIdentitySummary(supabaseClient);
    setAccountIdentity(summary);

    await uploadSessionSnapshot(supabaseClient, {
      envelope: createSessionSnapshotEnvelope(state),
      clientUpdatedAt: nowIso()
    });

    return { ok: true };
  }, [state]);

  /**
   * Account recovery stack, package C: "Recover garden" from Settings, for a
   * fresh device/reinstall. recoverWithAppleIdentity replaces this device's
   * session with the recovered account's -- once that succeeds there is no
   * "nothing was changed" fallback left (the auth swap already happened), so
   * everything past that point only chooses between restoring the
   * downloaded snapshot (`restored: true`) or leaving this device's local
   * garden as-is (`restored: false`, e.g. a recovered account that linked
   * but never got far enough to upload a snapshot). Either way the
   * (now different) account's credit balance is rehydrated. Reuses
   * mergeRestoredSession/PRE_IMPORT_SNAPSHOT_KEY exactly as
   * importSessionBackup above does, so a wrong-account recovery is just as
   * recoverable as a wrong-file backup import.
   */
  const recoverAccountWithApple = useCallback(async (): Promise<RecoverAccountWithAppleResult> => {
    const credential = await requestAppleCredential();

    if (!credential.ok) {
      return credential;
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return { ok: false, reason: "request_failed" };
    }

    const recovered = await recoverWithAppleIdentity(supabaseClient, credential);

    if (!recovered.ok) {
      return recovered;
    }

    const summary = await getAccountIdentitySummary(supabaseClient);
    setAccountIdentity(summary);

    const downloaded = await downloadSessionSnapshot(supabaseClient);

    if (downloaded.ok && downloaded.snapshot) {
      const parsed = parseSessionSnapshotEnvelope(downloaded.snapshot.payload);

      if (parsed.ok) {
        const restoredState = mergeRestoredSession(parsed.envelope.state as unknown as Record<string, unknown>);

        try {
          // Snapshot first, same reasoning as importSessionBackup above: if
          // the write below is interrupted, the pre-recovery session is
          // still recoverable from PRE_IMPORT_SNAPSHOT_KEY.
          await AsyncStorage.setItem(PRE_IMPORT_SNAPSHOT_KEY, JSON.stringify(createPersistedSessionEnvelope(state)));
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(createPersistedSessionEnvelope(restoredState)));

          setState(restoredState);
          setCareCooldownUntilByAction({});
          generatedAssetResyncDoneRef.current = false;
          generatedAssetResyncAttemptsRef.current = 0;
          attemptGeneratedAssetResync();
          void hydrateCreditBalance();

          return { ok: true, restored: true };
        } catch {
          // Couldn't safely commit the restored garden to this device --
          // fall through to the "keep local, rehydrate credits only" branch
          // below rather than reporting the whole recovery as failed (the
          // account swap itself already succeeded).
        }
      }
    }

    void hydrateCreditBalance();

    return { ok: true, restored: false };
  }, [attemptGeneratedAssetResync, hydrateCreditBalance, state]);

  // Credit Phase 1c trigger point (a): app foreground resume (design doc
  // §6.2). Only fires on background/inactive -> active transitions, not on
  // the initial mount's "active" state (AppState's listener only reports
  // *changes*, so this never double-hydrates alongside a screen's own
  // mount-time hydrate). Also re-attempts the generated_assets resync above
  // -- the same trigger point doubles as the "app foreground resume" retry
  // that attemptGeneratedAssetResync's doc comment calls out for a
  // still-pending (ok:false, not yet given up) resync attempt; a no-op once
  // generatedAssetResyncDoneRef is set or the attempt cap is hit.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void hydrateCreditBalance();
        attemptGeneratedAssetResync();
      }
    });

    return () => subscription.remove();
  }, [attemptGeneratedAssetResync, hydrateCreditBalance]);

  // Account recovery stack, package C: keeps this device's server-side
  // session snapshot (see uploadSessionSnapshot's doc comment) roughly in
  // sync with local play, without uploading on every single state change --
  // a debounce (SNAPSHOT_AUTO_UPLOAD_DEBOUNCE_MS) coalesces a burst of care
  // taps into one upload. Deliberately a separate effect from the
  // AsyncStorage persistence effect near the top of this provider: that one
  // is unconditional (every state change, every device), this one only
  // fires with a live Supabase client AND auth session, on a much longer
  // cadence. Fire-and-forget -- a failed upload (offline, RPC error) is
  // silently dropped; the next session change re-arms the debounce and
  // tries again, so a lost snapshot round-trip is never surfaced to the
  // player. `flushSnapshotUploadRef` is reassigned every render (not inside
  // an effect) so it always closes over the latest state/flags -- the same
  // "always-current callback in a ref" pattern the debounce timer and the
  // AppState background listener below both need, since neither can afford
  // to re-subscribe/re-arm on every keystroke-sized state change.
  const flushSnapshotUploadRef = useRef<() => void>(() => {});
  const snapshotUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  flushSnapshotUploadRef.current = () => {
    if (!isHydrated || storeScreenshotPreset || qaScreenPreset) {
      return;
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      return;
    }

    const envelope = createSessionSnapshotEnvelope(state);

    void supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) {
        return;
      }

      void uploadSessionSnapshot(supabaseClient, { envelope, clientUpdatedAt: nowIso() });
    });
  };

  useEffect(() => {
    if (!isHydrated || storeScreenshotPreset || qaScreenPreset) {
      return;
    }

    if (snapshotUploadTimerRef.current) {
      clearTimeout(snapshotUploadTimerRef.current);
    }

    snapshotUploadTimerRef.current = setTimeout(() => {
      snapshotUploadTimerRef.current = null;
      flushSnapshotUploadRef.current();
    }, SNAPSHOT_AUTO_UPLOAD_DEBOUNCE_MS);

    return () => {
      if (snapshotUploadTimerRef.current) {
        clearTimeout(snapshotUploadTimerRef.current);
        snapshotUploadTimerRef.current = null;
      }
    };
  }, [isHydrated, qaScreenPreset, state, storeScreenshotPreset]);

  // Ignores the debounce timer above and uploads immediately on
  // foreground -> background: the debounce's own setTimeout can be
  // suspended the instant the app backgrounds, so waiting for it to fire
  // naturally would drop the last few seconds of play on a hard background
  // (app switch, device lock) -- see flushSnapshotUploadRef's doc comment.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "background") {
        if (snapshotUploadTimerRef.current) {
          clearTimeout(snapshotUploadTimerRef.current);
          snapshotUploadTimerRef.current = null;
        }

        flushSnapshotUploadRef.current();
      }
    });

    return () => subscription.remove();
  }, []);

  const devStoreUnlocked = isDevelopmentStoreUnlockEnabled();
  const hasAuthoritativeWallet = getSupabaseClient() !== null || apiRuntime.mode === "api";
  const storeCreditPresentation = getDevelopmentStoreCreditPresentation({
    developmentCreditBalance: DEVELOPMENT_STORE_CREDIT_BALANCE,
    devStoreUnlocked,
    hasServerWallet: hasAuthoritativeWallet,
    serverCreditBalance: state.wallet.credits,
    spendableCreditBalance: getSpendableCreditBalance(state.wallet)
  });
  const activeEntitlements = useMemo(() => {
    const runtimeEntitlements = getRuntimeActiveEntitlements(apiRuntime.mode, apiEntitlements);

    if (!devStoreUnlocked) {
      return runtimeEntitlements;
    }

    return mergeEntitlements(runtimeEntitlements, getDevelopmentStoreEntitlements(state.wallet.userId, nowIso()));
  }, [apiEntitlements, apiRuntime.mode, devStoreUnlocked, state.wallet.userId]);
  const generatedAssetUriById = useMemo(
    () =>
      buildGeneratedAssetUriMap(
        generatedAssetReadUrls,
        activeBundle.acceptedAsset,
        activeBundle.acceptedAssets,
        localGeneratedAssetUris
      ),
    [generatedAssetReadUrls, activeBundle.acceptedAsset, activeBundle.acceptedAssets, localGeneratedAssetUris]
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
    creditBalance: storeCreditPresentation.creditBalance,
    expressionPackCreditBalance: storeCreditPresentation.expressionPackCreditBalance,
    paidWalkEarlyReturnAvailable: apiRuntime.mode !== "api",
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
    devStoreCreditsAvailable: storeCreditPresentation.devStoreCreditsAvailable,
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
    submitSupportFeedback,
    deleteOriginalPhoto,
    deleteChatHistory,
    purchaseCatalogItem,
    purchaseProduct,
    restorePurchases,
    syncWallet,
    hydrateCreditBalance,
    resetSession,
    exportSessionBackup,
    importSessionBackup,
    accountIdentity,
    linkAppleAccount,
    recoverAccountWithApple,
    pendingRewardClaim,
    enqueueCreditRewardClaim,
    enqueueDailyTreatRewardClaim,
    claimPendingReward,
    dismissPendingReward
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
