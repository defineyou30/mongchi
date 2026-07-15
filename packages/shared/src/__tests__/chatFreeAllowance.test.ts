import { describe, expect, it } from "vitest";

import {
  computeFreeChatTurnsRemaining,
  DEFAULT_STARTER_FREE_REMAINING,
  getUtcDateKey,
  isDailyFreeChatAvailable
} from "../index";

describe("getUtcDateKey", () => {
  it("takes the UTC calendar date from an ISO instant, not the local one", () => {
    expect(getUtcDateKey("2026-07-14T00:00:00.000Z")).toBe("2026-07-14");
    expect(getUtcDateKey("2026-07-14T23:59:59.999Z")).toBe("2026-07-14");
  });
});

describe("isDailyFreeChatAvailable", () => {
  it("is available when the daily free chat has never been used", () => {
    expect(isDailyFreeChatAvailable(null, "2026-07-14T12:00:00.000Z")).toBe(true);
  });

  it("is unavailable once it has been used on today's UTC date", () => {
    expect(isDailyFreeChatAvailable("2026-07-14", "2026-07-14T12:00:00.000Z")).toBe(false);
  });

  it("is available again once the UTC date has rolled over", () => {
    expect(isDailyFreeChatAvailable("2026-07-13", "2026-07-14T00:00:00.000Z")).toBe(true);
  });

  // Timezone-boundary regression: a device several hours behind/ahead of UTC
  // could disagree with the server about "today" if this ever compared local
  // calendar dates instead of UTC ones (see this module's doc comment). Late
  // evening in UTC-8 (e.g. 6pm Pacific) is already the next UTC calendar day.
  it("matches the server's UTC day boundary even when local evening has already rolled into the next UTC day", () => {
    // 2026-07-14T23:30 Pacific local time == 2026-07-15T06:30 UTC.
    const lateEveningUtcInstant = "2026-07-15T06:30:00.000Z";

    expect(isDailyFreeChatAvailable("2026-07-15", lateEveningUtcInstant)).toBe(false);
    expect(isDailyFreeChatAvailable("2026-07-14", lateEveningUtcInstant)).toBe(true);
  });
});

describe("computeFreeChatTurnsRemaining", () => {
  it("adds today's daily free turn on top of the starter allowance when both are available", () => {
    expect(
      computeFreeChatTurnsRemaining({ starterFreeRemaining: 3, dailyFreeOn: null }, "2026-07-14T09:00:00.000Z")
    ).toBe(4);
  });

  it("matches the 0014 migration's default row for a brand-new user (starter 3 + daily 1 = 4)", () => {
    expect(
      computeFreeChatTurnsRemaining(
        { starterFreeRemaining: DEFAULT_STARTER_FREE_REMAINING, dailyFreeOn: null },
        "2026-07-14T09:00:00.000Z"
      )
    ).toBe(4);
  });

  it("drops the daily turn once it has been used today, keeping the starter remainder", () => {
    expect(
      computeFreeChatTurnsRemaining({ starterFreeRemaining: 2, dailyFreeOn: "2026-07-14" }, "2026-07-14T09:00:00.000Z")
    ).toBe(2);
  });

  it("counts only the daily turn once the starter allowance is exhausted", () => {
    expect(
      computeFreeChatTurnsRemaining({ starterFreeRemaining: 0, dailyFreeOn: null }, "2026-07-14T09:00:00.000Z")
    ).toBe(1);
  });

  it("is zero once both the starter allowance and today's daily turn are spent", () => {
    expect(
      computeFreeChatTurnsRemaining({ starterFreeRemaining: 0, dailyFreeOn: "2026-07-14" }, "2026-07-14T09:00:00.000Z")
    ).toBe(0);
  });

  it("never goes negative even if starterFreeRemaining is corrupt", () => {
    expect(
      computeFreeChatTurnsRemaining({ starterFreeRemaining: -5, dailyFreeOn: "2026-07-14" }, "2026-07-14T09:00:00.000Z")
    ).toBe(0);
  });
});
