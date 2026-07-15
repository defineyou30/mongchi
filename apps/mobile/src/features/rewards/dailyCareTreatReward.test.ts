import { describe, expect, it } from "vitest";

import {
  createEmptyDailyCareProgress,
  getDailyTreatRewardKey,
  pickDailyTreatItemId,
  recordCoreCareAction
} from "./dailyCareTreatReward";

// getLocalDayKey buckets by the *device's* local calendar day, so these are
// chosen to stay clear of local-midnight in any real timezone (UTC-12..+14)
// rather than assuming the test runner is UTC.
const day1Morning = "2026-07-15T00:10:00.000Z";
const day1Noon = "2026-07-15T02:00:00.000Z";
const day1Evening = "2026-07-15T10:00:00.000Z";
const day2Morning = "2026-07-16T00:10:00.000Z";

describe("recordCoreCareAction", () => {
  it("does not complete after only one or two of the three core actions", () => {
    let progress = createEmptyDailyCareProgress("2026-07-15");
    let result = recordCoreCareAction(progress, "feed", day1Morning);

    expect(result.justCompletedAllToday).toBe(false);
    progress = result.progress;

    result = recordCoreCareAction(progress, "play", day1Noon);
    expect(result.justCompletedAllToday).toBe(false);
  });

  it("completes exactly when the third distinct core action lands", () => {
    let progress = createEmptyDailyCareProgress("2026-07-15");
    progress = recordCoreCareAction(progress, "feed", day1Morning).progress;
    progress = recordCoreCareAction(progress, "play", day1Noon).progress;

    const result = recordCoreCareAction(progress, "affection", day1Evening);

    expect(result.justCompletedAllToday).toBe(true);
    expect(result.progress.completedActions).toEqual(["feed", "play", "affection"]);
  });

  it("never re-completes the same day even if care actions keep happening", () => {
    let progress = createEmptyDailyCareProgress("2026-07-15");
    progress = recordCoreCareAction(progress, "feed", day1Morning).progress;
    progress = recordCoreCareAction(progress, "play", day1Noon).progress;
    progress = recordCoreCareAction(progress, "affection", day1Evening).progress;

    const result = recordCoreCareAction(progress, "feed", day1Evening);

    expect(result.justCompletedAllToday).toBe(false);
  });

  it("ignores non-core actions (walk/talk/rest/treat/etc.)", () => {
    const progress = createEmptyDailyCareProgress("2026-07-15");
    const result = recordCoreCareAction(progress, "walk", day1Morning);

    expect(result.progress.completedActions).toEqual([]);
    expect(result.justCompletedAllToday).toBe(false);
  });

  it("rolls over to a fresh day, so a new day requires all three again", () => {
    let progress = createEmptyDailyCareProgress("2026-07-15");
    progress = recordCoreCareAction(progress, "feed", day1Morning).progress;
    progress = recordCoreCareAction(progress, "play", day1Noon).progress;
    progress = recordCoreCareAction(progress, "affection", day1Evening).progress;

    // New local day: only one of the three so far, should not complete.
    const result = recordCoreCareAction(progress, "feed", day2Morning);

    expect(result.justCompletedAllToday).toBe(false);
    expect(result.progress.dayKey).toBe("2026-07-16");
    expect(result.progress.completedActions).toEqual(["feed"]);
  });
});

describe("getDailyTreatRewardKey", () => {
  it("is scoped per local day", () => {
    expect(getDailyTreatRewardKey("2026-07-15")).toBe("daily_treat_2026-07-15");
    expect(getDailyTreatRewardKey("2026-07-16")).toBe("daily_treat_2026-07-16");
  });
});

describe("pickDailyTreatItemId", () => {
  it("is deterministic for a given day key", () => {
    const first = pickDailyTreatItemId("2026-07-15");
    const second = pickDailyTreatItemId("2026-07-15");

    expect(first).toBe(second);
  });

  it("can vary across different day keys", () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, index) => pickDailyTreatItemId(`2026-07-${String(index + 1).padStart(2, "0")}`))
    );

    expect(picks.size).toBeGreaterThan(1);
  });

  it("always returns an id from the common treat pool", () => {
    const allowed = new Set([
      "item_apple_biscuit",
      "item_bone_biscuit",
      "item_salmon_bites",
      "item_duck_biscuit",
      "item_berry_yogurt",
      "item_cheese_puff"
    ]);

    for (let index = 0; index < 30; index += 1) {
      expect(allowed.has(pickDailyTreatItemId(`2026-08-${String(index + 1).padStart(2, "0")}`))).toBe(true);
    }
  });
});
