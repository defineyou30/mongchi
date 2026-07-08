import { describe, expect, it } from "vitest";

import {
  bumpCareStats,
  bumpPlayXpCounter,
  bumpTalkXpCounter,
  bumpTreatXpCounter,
  createInitialCareStats,
  getCompanionHabitHints,
  getFavoriteCareAction,
  getFavoriteTreatItemId,
  getItemUsageCount,
  isFavoriteTreatItem,
  isFirstTimeTreatItem,
  shouldGrantPlayBondXp,
  shouldGrantTalkBondXp,
  shouldGrantTreatBondXp,
  PLAY_BOND_XP_DAILY_CAP,
  TALK_BOND_XP_DAILY_CAP,
  TREAT_BOND_XP_DAILY_CAP
} from "../index";

describe("bumpCareStats", () => {
  it("counts actions and total care actions", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "feed");

    expect(stats.actionCounts.play).toBe(2);
    expect(stats.actionCounts.feed).toBe(1);
    expect(stats.totalCareActions).toBe(3);
  });

  it("tracks walkCount only for walk actions", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "walk");
    stats = bumpCareStats(stats, "walk");
    stats = bumpCareStats(stats, "feed");

    expect(stats.walkCount).toBe(2);
  });

  it("tracks treat item counts only when action is treat and an itemId is given", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");
    stats = bumpCareStats(stats, "treat", "item_milk_pup_cup");
    stats = bumpCareStats(stats, "feed", "item_apple_biscuit");

    expect(stats.treatItemCounts.item_apple_biscuit).toBe(2);
    expect(stats.treatItemCounts.item_milk_pup_cup).toBe(1);
  });

  it("does not mutate the input stats object", () => {
    const stats = createInitialCareStats();
    const next = bumpCareStats(stats, "play");

    expect(stats.actionCounts.play).toBeUndefined();
    expect(next).not.toBe(stats);
  });

  it("tracks per-item usage counts only when a usedItemId is given, independent of treatItemId", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "play", undefined, "item_plush_toy_buddy");
    stats = bumpCareStats(stats, "play", undefined, "item_plush_toy_buddy");
    stats = bumpCareStats(stats, "affection", undefined, "item_cushion_rose");
    stats = bumpCareStats(stats, "play");

    expect(getItemUsageCount(stats, "item_plush_toy_buddy")).toBe(2);
    expect(getItemUsageCount(stats, "item_cushion_rose")).toBe(1);
    expect(getItemUsageCount(stats, "item_toy_ball_mint")).toBe(0);
  });
});

describe("getItemUsageCount", () => {
  it("returns 0 for a brand-new stats snapshot", () => {
    expect(getItemUsageCount(createInitialCareStats(), "item_plush_toy_buddy")).toBe(0);
  });
});

describe("getFavoriteCareAction", () => {
  it("returns null when there are no actions yet", () => {
    expect(getFavoriteCareAction(createInitialCareStats())).toBeNull();
  });

  it("returns the action with the highest count", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "feed");

    expect(getFavoriteCareAction(stats)).toBe("play");
  });

  it("returns null on a tie", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "feed");

    expect(getFavoriteCareAction(stats)).toBeNull();
  });
});

describe("getFavoriteTreatItemId", () => {
  it("returns null when no treats have been given", () => {
    expect(getFavoriteTreatItemId(createInitialCareStats())).toBeNull();
  });

  it("returns the most-gifted treat item id", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");
    stats = bumpCareStats(stats, "treat", "item_milk_pup_cup");

    expect(getFavoriteTreatItemId(stats)).toBe("item_apple_biscuit");
  });
});

describe("isFavoriteTreatItem", () => {
  it("returns false for a brand-new stats snapshot", () => {
    expect(isFavoriteTreatItem(createInitialCareStats(), "item_apple_biscuit")).toBe(false);
  });

  it("returns false on a treat item's very first gift (pre-gift stats snapshot has count 0)", () => {
    // performPrototypeCareAction calls this with the stats snapshot from
    // *before* the current gift is bumped -- a first-ever gift should never
    // already read as the favorite.
    const stats = createInitialCareStats();

    expect(isFavoriteTreatItem(stats, "item_apple_biscuit")).toBe(false);
  });

  it("returns true once an item is the sole most-gifted treat", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");
    stats = bumpCareStats(stats, "treat", "item_milk_pup_cup");

    expect(isFavoriteTreatItem(stats, "item_apple_biscuit")).toBe(true);
    expect(isFavoriteTreatItem(stats, "item_milk_pup_cup")).toBe(false);
  });

  it("on a tie, only the first-counted item (getFavoriteTreatItemId's own tie-break) reads as favorite", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");
    stats = bumpCareStats(stats, "treat", "item_milk_pup_cup");

    expect(getFavoriteTreatItemId(stats)).toBe("item_apple_biscuit");
    expect(isFavoriteTreatItem(stats, "item_apple_biscuit")).toBe(true);
    expect(isFavoriteTreatItem(stats, "item_milk_pup_cup")).toBe(false);
  });
});

describe("isFirstTimeTreatItem", () => {
  it("returns true for an item never given before", () => {
    expect(isFirstTimeTreatItem(createInitialCareStats(), "item_apple_biscuit")).toBe(true);
  });

  it("returns false once an item has been given at least once", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");

    expect(isFirstTimeTreatItem(stats, "item_apple_biscuit")).toBe(false);
  });

  it("stays true for a different, still-untried item even after another treat was given", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "treat", "item_apple_biscuit");

    expect(isFirstTimeTreatItem(stats, "item_milk_pup_cup")).toBe(true);
  });
});

describe("getCompanionHabitHints", () => {
  it("returns no hints for a fresh companion", () => {
    expect(getCompanionHabitHints(createInitialCareStats())).toEqual([]);
  });

  it("derives loves_playtime when play is the favorite action", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "feed");

    expect(getCompanionHabitHints(stats)).toContain("loves_playtime");
  });

  it("derives cuddle_bug when affection is the favorite action", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "affection");
    stats = bumpCareStats(stats, "affection");
    stats = bumpCareStats(stats, "feed");

    expect(getCompanionHabitHints(stats)).toContain("cuddle_bug");
  });

  it("derives trail_buddy once walkCount reaches 10, independent of favorite action", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < 10; i += 1) {
      stats = bumpCareStats(stats, "walk");
    }

    expect(getCompanionHabitHints(stats)).toContain("trail_buddy");
  });

  it("does not derive trail_buddy below the walk threshold", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < 9; i += 1) {
      stats = bumpCareStats(stats, "walk");
    }

    expect(getCompanionHabitHints(stats)).not.toContain("trail_buddy");
  });

  it("can return multiple hints at once", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < 10; i += 1) {
      stats = bumpCareStats(stats, "walk");
    }

    stats = bumpCareStats(stats, "walk");
    stats = bumpCareStats(stats, "walk");

    expect(getCompanionHabitHints(stats)).toEqual(expect.arrayContaining(["trail_buddy"]));
  });
});

describe("daily bond-XP farming caps (treat/talk)", () => {
  const day1 = "2026-06-24T09:00:00.000Z";
  const day1Later = "2026-06-24T12:00:00.000Z";
  // A full 48h later so the "new day" assertion holds regardless of the test
  // runner's local timezone offset (getLocalDayKey uses device-local days).
  const day2 = "2026-06-26T09:00:00.000Z";

  it("grants treat bond XP for a fresh save with no counters yet", () => {
    expect(shouldGrantTreatBondXp(createInitialCareStats(), day1)).toBe(true);
  });

  it("stops granting treat bond XP once the daily cap is reached", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < TREAT_BOND_XP_DAILY_CAP; i += 1) {
      expect(shouldGrantTreatBondXp(stats, day1)).toBe(true);
      stats = bumpTreatXpCounter(stats, day1);
    }

    expect(shouldGrantTreatBondXp(stats, day1)).toBe(false);
  });

  it("resets the treat cap on a new local day", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < TREAT_BOND_XP_DAILY_CAP; i += 1) {
      stats = bumpTreatXpCounter(stats, day1Later);
    }

    expect(shouldGrantTreatBondXp(stats, day1Later)).toBe(false);
    expect(shouldGrantTreatBondXp(stats, day2)).toBe(true);
  });

  it("keeps counting uses past the cap without re-unlocking XP mid-day", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < TREAT_BOND_XP_DAILY_CAP + 5; i += 1) {
      stats = bumpTreatXpCounter(stats, day1);
    }

    expect(stats.treatXpCountToday).toBe(TREAT_BOND_XP_DAILY_CAP + 5);
    expect(shouldGrantTreatBondXp(stats, day1)).toBe(false);
  });

  it("stops granting talk bond XP once its (higher) daily cap is reached", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < TALK_BOND_XP_DAILY_CAP; i += 1) {
      expect(shouldGrantTalkBondXp(stats, day1)).toBe(true);
      stats = bumpTalkXpCounter(stats, day1);
    }

    expect(shouldGrantTalkBondXp(stats, day1)).toBe(false);
  });

  it("tracks treat and talk daily counters independently", () => {
    let stats = createInitialCareStats();
    stats = bumpTreatXpCounter(stats, day1);
    stats = bumpTreatXpCounter(stats, day1);

    expect(stats.treatXpCountToday).toBe(2);
    expect(stats.talkXpCountToday ?? 0).toBe(0);
    expect(shouldGrantTalkBondXp(stats, day1)).toBe(true);
  });

  it("treats an existing save without the optional counters as having granted no XP yet today (no migration needed)", () => {
    const legacyStats = createInitialCareStats();

    expect(legacyStats.treatXpDayKey).toBeUndefined();
    expect(legacyStats.treatXpCountToday).toBeUndefined();
    expect(shouldGrantTreatBondXp(legacyStats, day1)).toBe(true);
    expect(shouldGrantTalkBondXp(legacyStats, day1)).toBe(true);
  });
});

describe("daily bond-XP farming cap (play)", () => {
  const day1 = "2026-06-24T09:00:00.000Z";
  const day1Later = "2026-06-24T12:00:00.000Z";
  // A full 48h later so the "new day" assertion holds regardless of the test
  // runner's local timezone offset (getLocalDayKey uses device-local days).
  const day2 = "2026-06-26T09:00:00.000Z";

  it("grants play bond XP for a fresh save with no counters yet", () => {
    expect(shouldGrantPlayBondXp(createInitialCareStats(), day1)).toBe(true);
  });

  it("stops granting play bond XP once the daily cap is reached", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < PLAY_BOND_XP_DAILY_CAP; i += 1) {
      expect(shouldGrantPlayBondXp(stats, day1)).toBe(true);
      stats = bumpPlayXpCounter(stats, day1);
    }

    expect(shouldGrantPlayBondXp(stats, day1)).toBe(false);
  });

  it("resets the play cap on a new local day", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < PLAY_BOND_XP_DAILY_CAP; i += 1) {
      stats = bumpPlayXpCounter(stats, day1Later);
    }

    expect(shouldGrantPlayBondXp(stats, day1Later)).toBe(false);
    expect(shouldGrantPlayBondXp(stats, day2)).toBe(true);
  });

  it("keeps counting uses past the cap without re-unlocking XP mid-day", () => {
    let stats = createInitialCareStats();

    for (let i = 0; i < PLAY_BOND_XP_DAILY_CAP + 5; i += 1) {
      stats = bumpPlayXpCounter(stats, day1);
    }

    expect(stats.playXpCountToday).toBe(PLAY_BOND_XP_DAILY_CAP + 5);
    expect(shouldGrantPlayBondXp(stats, day1)).toBe(false);
  });

  it("tracks the play daily counter independently from treat/talk", () => {
    let stats = createInitialCareStats();
    stats = bumpPlayXpCounter(stats, day1);
    stats = bumpPlayXpCounter(stats, day1);

    expect(stats.playXpCountToday).toBe(2);
    expect(stats.treatXpCountToday ?? 0).toBe(0);
    expect(stats.talkXpCountToday ?? 0).toBe(0);
  });

  it("treats an existing save without the optional counter as having granted no play XP yet today (no migration needed)", () => {
    const legacyStats = createInitialCareStats();

    expect(legacyStats.playXpDayKey).toBeUndefined();
    expect(legacyStats.playXpCountToday).toBeUndefined();
    expect(shouldGrantPlayBondXp(legacyStats, day1)).toBe(true);
  });
});
