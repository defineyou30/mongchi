import { describe, expect, it } from "vitest";

import {
  bondLevelRewardCredits,
  careStreakRewardCredits,
  collectionCompleteRewardCredits,
  dequeueRewardClaim,
  emptyRewardClaimQueue,
  enqueueRewardClaim,
  getCreditRewardAmount,
  getCrossedBondCreditRewardKeys,
  getCrossedCareStreakRewardKeys,
  getLetterMonthRewardKey,
  peekRewardClaim,
  settlementMissionRewardKeys
} from "../index";
import type { RewardClaimQueueItem } from "../index";

describe("getCreditRewardAmount", () => {
  it("resolves every settlement mission key to 1 credit", () => {
    for (const key of Object.values(settlementMissionRewardKeys)) {
      expect(getCreditRewardAmount(key)).toBe(1);
    }
  });

  it("resolves care-streak milestone keys to their budgeted amount", () => {
    expect(getCreditRewardAmount("streak_3")).toBe(2);
    expect(getCreditRewardAmount("streak_7")).toBe(3);
    expect(getCreditRewardAmount("streak_14")).toBe(5);
    expect(getCreditRewardAmount("streak_30")).toBe(8);
    expect(careStreakRewardCredits).toEqual({ 3: 2, 7: 3, 14: 5, 30: 8 });
  });

  it("resolves collection_complete to the new lowered server amount", () => {
    expect(getCreditRewardAmount("collection_complete")).toBe(10);
    expect(collectionCompleteRewardCredits).toBe(10);
  });

  it("resolves bond_5 and bond_10 unchanged from the existing local amounts", () => {
    expect(getCreditRewardAmount("bond_5")).toBe(5);
    expect(getCreditRewardAmount("bond_10")).toBe(10);
    expect(bondLevelRewardCredits).toEqual({ 5: 5, 10: 10 });
  });

  it("resolves any letter_month_<N> key to 5 credits", () => {
    expect(getCreditRewardAmount(getLetterMonthRewardKey(1))).toBe(5);
    expect(getCreditRewardAmount("letter_month_2")).toBe(5);
    expect(getCreditRewardAmount("letter_month_12")).toBe(5);
  });

  it("returns null for a streak length, bond level, or key outside the whitelist", () => {
    expect(getCreditRewardAmount("streak_4")).toBeNull();
    expect(getCreditRewardAmount("bond_2")).toBeNull();
    expect(getCreditRewardAmount("letter_month_0")).toBeNull();
    expect(getCreditRewardAmount("letter_month_abc")).toBeNull();
    expect(getCreditRewardAmount("not_a_real_reward")).toBeNull();
  });
});

describe("getLetterMonthRewardKey", () => {
  it("formats a positive month index", () => {
    expect(getLetterMonthRewardKey(1)).toBe("letter_month_1");
    expect(getLetterMonthRewardKey(6)).toBe("letter_month_6");
  });

  it("throws for a non-positive or non-integer month index", () => {
    expect(() => getLetterMonthRewardKey(0)).toThrow();
    expect(() => getLetterMonthRewardKey(-1)).toThrow();
    expect(() => getLetterMonthRewardKey(1.5)).toThrow();
  });
});

describe("getCrossedCareStreakRewardKeys", () => {
  it("returns nothing when the streak did not advance", () => {
    expect(getCrossedCareStreakRewardKeys(3, 3)).toEqual([]);
    expect(getCrossedCareStreakRewardKeys(5, 2)).toEqual([]);
  });

  it("returns the single milestone crossed by a normal +1 day advance", () => {
    expect(getCrossedCareStreakRewardKeys(2, 3)).toEqual(["streak_3"]);
    expect(getCrossedCareStreakRewardKeys(6, 7)).toEqual(["streak_7"]);
  });

  it("returns every milestone crossed in a single jump (grace-covered catch-up)", () => {
    expect(getCrossedCareStreakRewardKeys(2, 8)).toEqual(["streak_3", "streak_7"]);
  });

  it("never re-fires a milestone already passed before this transition", () => {
    expect(getCrossedCareStreakRewardKeys(4, 5)).toEqual([]);
    expect(getCrossedCareStreakRewardKeys(10, 12)).toEqual([]);
  });
});

describe("getCrossedBondCreditRewardKeys", () => {
  it("returns nothing when the level did not advance", () => {
    expect(getCrossedBondCreditRewardKeys(5, 5)).toEqual([]);
    expect(getCrossedBondCreditRewardKeys(6, 4)).toEqual([]);
  });

  it("returns bond_5 only when level 5 is crossed", () => {
    expect(getCrossedBondCreditRewardKeys(4, 5)).toEqual(["bond_5"]);
  });

  it("returns bond_10 only when level 10 is crossed", () => {
    expect(getCrossedBondCreditRewardKeys(9, 10)).toEqual(["bond_10"]);
  });

  it("returns both when a single jump crosses levels 5 and 10", () => {
    expect(getCrossedBondCreditRewardKeys(4, 10)).toEqual(["bond_5", "bond_10"]);
  });

  it("returns nothing for levels without a credit reward (e.g. 2, 3, 4, 7)", () => {
    expect(getCrossedBondCreditRewardKeys(1, 2)).toEqual([]);
    expect(getCrossedBondCreditRewardKeys(6, 7)).toEqual([]);
  });
});

describe("reward claim queue", () => {
  const creditItem: RewardClaimQueueItem = {
    id: "settle_first_feed",
    kind: "credit",
    rewardKey: "settle_first_feed",
    copyCategory: "settlement",
    amount: 1
  };
  const treatItem: RewardClaimQueueItem = {
    id: "daily_treat_2026-07-15",
    kind: "treat",
    rewardKey: "daily_treat_2026-07-15",
    copyCategory: "daily_treat",
    itemId: "item_apple_biscuit"
  };

  it("starts empty", () => {
    expect(peekRewardClaim(emptyRewardClaimQueue)).toBeNull();
  });

  it("adds an item so it can be peeked", () => {
    const next = enqueueRewardClaim(emptyRewardClaimQueue, creditItem);

    expect(peekRewardClaim(next)).toEqual(creditItem);
  });

  it("keeps FIFO order across multiple enqueues", () => {
    let state = enqueueRewardClaim(emptyRewardClaimQueue, creditItem);
    state = enqueueRewardClaim(state, treatItem);

    expect(state.items.map((item) => item.id)).toEqual([creditItem.id, treatItem.id]);
    expect(peekRewardClaim(state)).toEqual(creditItem);
  });

  it("dequeuing advances to the next item", () => {
    let state = enqueueRewardClaim(emptyRewardClaimQueue, creditItem);
    state = enqueueRewardClaim(state, treatItem);
    state = dequeueRewardClaim(state);

    expect(peekRewardClaim(state)).toEqual(treatItem);

    state = dequeueRewardClaim(state);
    expect(peekRewardClaim(state)).toBeNull();
  });

  it("dequeuing an empty queue is a harmless no-op", () => {
    expect(dequeueRewardClaim(emptyRewardClaimQueue)).toEqual(emptyRewardClaimQueue);
  });

  it("never re-queues the same id twice in one session, even after it was dequeued", () => {
    let state = enqueueRewardClaim(emptyRewardClaimQueue, creditItem);
    state = dequeueRewardClaim(state);
    state = enqueueRewardClaim(state, creditItem);

    expect(state.items).toEqual([]);
  });

  it("a duplicate enqueue before the first is claimed still shows the reward only once", () => {
    let state = enqueueRewardClaim(emptyRewardClaimQueue, creditItem);
    state = enqueueRewardClaim(state, creditItem);

    expect(state.items).toHaveLength(1);
  });
});
