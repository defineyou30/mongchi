import type { ItemId } from "./common";

/**
 * Client-side mirror of 0023_credit_reward_claims.sql's server whitelist
 * (2026-07-15 faucet budget -- see docs/game-economy-bm-proposal.md). This is
 * the single source of truth the mobile app reads from for: the amount shown
 * on a reward-claim card, and the amount granted in the offline/dev fallback
 * path (no Supabase client) when the server RPC can't be reached. The server
 * migration's CASE statement is hand-kept in sync with this map -- there is
 * no code generation between them, so a future change to either MUST update
 * both.
 *
 * `bond_5`/`bond_10`/`collection_complete` are special: packages/shared's own
 * pure reducers (bondRewards.ts's bondLevelRewards, prototypeSession.ts's
 * claimPrototypeWalkReward) already grant these amounts straight into the
 * client-local wallet.bonusCredits bucket, unconditionally, regardless of
 * whether a server session exists -- that behavior is untouched by this
 * module (see bondRewards.test.ts's existing assertions). The app layer is
 * responsible for reconciling the two: when a Supabase session exists, it
 * subtracts the locally-granted bonusCredits amount back out and replaces it
 * with a server-claimed `credits` amount (see
 * apps/mobile/src/features/session/TerrariumSessionProvider.tsx's
 * claimQueuedCreditReward), so the credit is never double-counted and always
 * ends up spendable through the live shop's server-authoritative balance.
 * `collection_complete`'s local fallback amount is intentionally different
 * (walkCollection.ts's WALK_COLLECTION_COMPLETE_CREDITS stays 20) -- the
 * server budget of 10 here is a deliberate lowering that only applies once a
 * reward is actually claimed through the server.
 *
 * Reward keys are plain strings rather than a closed union: most are fixed
 * literals (see settlementMissionRewardKeys, "streak_<N>", "bond_<N>",
 * "collection_complete"), but letter_month_<N> is open-ended (N grows every
 * month a pet stays with its owner), so a closed union would either exclude
 * it or collapse to `string` anyway.
 */
const SETTLEMENT_MISSION_REWARD_CREDITS = 1;
const LETTER_MONTH_REWARD_CREDITS = 5;

/** One-time "moving in" settlement missions -- +1 credit each, see 0023's header comment. */
export const settlementMissionRewardKeys = {
  firstFeed: "settle_first_feed",
  firstPlay: "settle_first_play",
  firstChatHello: "settle_first_chat_hello",
  firstWalk: "settle_first_walk",
  firstPhoto: "settle_first_photo"
} as const;

/** One-time care-streak length milestones -- distinct from careStreak's recurring every-3rd/7th-day snack item reward. */
export const careStreakRewardCredits: Readonly<Record<number, number>> = {
  3: 2,
  7: 3,
  14: 5,
  30: 8
};

/** Bond level credit rewards, mirroring bondRewards.ts's bondLevelRewards (kept in sync manually -- see this module's header comment). */
export const bondLevelRewardCredits: Readonly<Record<number, number>> = {
  5: 5,
  10: 10
};

/** Server-claimed amount for completing the walk journal (see this module's header comment for why this differs from the offline-fallback amount). */
export const collectionCompleteRewardCredits = 10;

/** letter_month_<N> reward key for the Nth monthly letter (N >= 1). Throws on a non-positive/non-integer month index -- callers only ever pass a real, already-validated month index. */
export const getLetterMonthRewardKey = (monthIndex: number): string => {
  if (!Number.isInteger(monthIndex) || monthIndex < 1) {
    throw new Error(`getLetterMonthRewardKey: monthIndex must be a positive integer (got ${monthIndex})`);
  }

  return `letter_month_${monthIndex}`;
};

const letterMonthRewardKeyPattern = /^letter_month_([1-9][0-9]*)$/;

/**
 * Resolves the credit amount for any recognized reward key, mirroring
 * 0023_credit_reward_claims.sql's CASE exactly -- returns null for anything
 * outside the whitelist (never a client-invented amount).
 */
export const getCreditRewardAmount = (rewardKey: string): number | null => {
  if (Object.values(settlementMissionRewardKeys).includes(rewardKey as (typeof settlementMissionRewardKeys)[keyof typeof settlementMissionRewardKeys])) {
    return SETTLEMENT_MISSION_REWARD_CREDITS;
  }

  const streakMatch = rewardKey.match(/^streak_(\d+)$/);

  if (streakMatch) {
    return careStreakRewardCredits[Number(streakMatch[1])] ?? null;
  }

  if (rewardKey === "collection_complete") {
    return collectionCompleteRewardCredits;
  }

  const bondMatch = rewardKey.match(/^bond_(\d+)$/);

  if (bondMatch) {
    return bondLevelRewardCredits[Number(bondMatch[1])] ?? null;
  }

  if (letterMonthRewardKeyPattern.test(rewardKey)) {
    return LETTER_MONTH_REWARD_CREDITS;
  }

  return null;
};

/** Care-streak lengths that carry a one-time credit reward (see careStreakRewardCredits). */
const CARE_STREAK_REWARD_LENGTHS: readonly number[] = [3, 7, 14, 30];

/**
 * Which streak_<N> reward keys were newly crossed going from
 * previousStreakCount to nextStreakCount (both CareStreakState.current
 * readings) -- e.g. previous 2 -> next 3 crosses streak_3; previous 2 -> next
 * 8 (a multi-day catch-up, unlikely but possible after a grace-covered gap)
 * crosses both streak_3 and streak_7. Never re-fires a length the streak
 * already passed before this transition, and never fires on a streak that
 * reset downward.
 */
export const getCrossedCareStreakRewardKeys = (previousStreakCount: number, nextStreakCount: number): string[] => {
  if (nextStreakCount <= previousStreakCount) {
    return [];
  }

  return CARE_STREAK_REWARD_LENGTHS.filter(
    (length) => length > previousStreakCount && length <= nextStreakCount
  ).map((length) => `streak_${length}`);
};

/**
 * Which bond_<N> credit reward keys were newly crossed going from
 * previousLevel to nextLevel -- only levels present in bondLevelRewardCredits
 * (5 and 10) ever produce a key; every other crossed level returns nothing
 * here (it may still carry an item/celebration reward, just not a credit one).
 */
export const getCrossedBondCreditRewardKeys = (previousLevel: number, nextLevel: number): string[] => {
  if (nextLevel <= previousLevel) {
    return [];
  }

  return Object.keys(bondLevelRewardCredits)
    .map(Number)
    .filter((level) => level > previousLevel && level <= nextLevel)
    .sort((a, b) => a - b)
    .map((level) => `bond_${level}`);
};

/** Broad category driving a reward-claim card's copy/art (see rewardClaimPresentation.ts in the mobile app). */
export type RewardClaimCopyCategory = "settlement" | "streak" | "letter" | "collection" | "bond" | "daily_treat";

export type RewardClaimKind = "credit" | "treat";

export interface RewardClaimQueueItem {
  /** Unique within a single queue -- for credit rewards this is the rewardKey itself; for the local-only daily treat it's a date-scoped dedupe key. */
  readonly id: string;
  readonly kind: RewardClaimKind;
  readonly rewardKey: string;
  readonly copyCategory: RewardClaimCopyCategory;
  /** Credit amount to display/grant (kind: "credit" only). */
  readonly amount?: number;
  /** Treat item to grant (kind: "treat" only). */
  readonly itemId?: ItemId;
  /**
   * True when packages/shared's own reducer already granted this amount into
   * wallet.bonusCredits as a side effect of the care/walk action that
   * triggered this reward (bond_5, bond_10, collection_complete) -- the app
   * layer's claim handler needs this to know whether "claiming" online means
   * reconciling an already-granted local amount (subtract bonusCredits, add
   * server credits) versus granting fresh (settlement/streak/letter, where
   * nothing was granted until the claim itself).
   */
  readonly alreadyGrantedLocally?: boolean;
  /**
   * Only meaningful when alreadyGrantedLocally is true: the exact amount the
   * shared reducer already added to wallet.bonusCredits, to subtract back out
   * once an online claim replaces it with server credits. Usually equal to
   * `amount` (bond_5/bond_10, where the local and server amounts match) but
   * NOT for collection_complete, whose local fallback grant
   * (WALK_COLLECTION_COMPLETE_CREDITS, 20) is intentionally larger than the
   * new server-claimed amount (collectionCompleteRewardCredits, 10) -- see
   * this module's header comment.
   */
  readonly localGrantAmountToReconcile?: number;
}

export interface RewardClaimQueueState {
  readonly items: readonly RewardClaimQueueItem[];
  /** Ids ever added to this queue (including already-dequeued ones), so a later duplicate enqueue is a no-op instead of showing the same reward twice in one session. */
  readonly seenIds: readonly string[];
}

export const emptyRewardClaimQueue: RewardClaimQueueState = { items: [], seenIds: [] };

/** Adds `item` to the back of the queue unless its id was already seen (queued before, this session) -- pure, dedupes by id, never reorders existing items. */
export const enqueueRewardClaim = (state: RewardClaimQueueState, item: RewardClaimQueueItem): RewardClaimQueueState => {
  if (state.seenIds.includes(item.id)) {
    return state;
  }

  return {
    items: [...state.items, item],
    seenIds: [...state.seenIds, item.id]
  };
};

/** The item that should be shown right now, or null when the queue is empty. Never mutates the queue -- pair with dequeueRewardClaim once the item has been claimed/dismissed. */
export const peekRewardClaim = (state: RewardClaimQueueState): RewardClaimQueueItem | null => state.items[0] ?? null;

/** Drops the front item (a no-op returning the same state when the queue is already empty). */
export const dequeueRewardClaim = (state: RewardClaimQueueState): RewardClaimQueueState => {
  if (state.items.length === 0) {
    return state;
  }

  return {
    ...state,
    items: state.items.slice(1)
  };
};
