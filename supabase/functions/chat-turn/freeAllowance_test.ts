import { assertEquals } from "jsr:@std/assert@1";

import {
  computeFreeChatTurnsRemaining,
  DEFAULT_STARTER_FREE_REMAINING,
  getUtcDateKey,
  isDailyFreeChatAvailable
} from "./freeAllowance.ts";

Deno.test("getUtcDateKey takes the UTC calendar date from an ISO instant", () => {
  assertEquals(getUtcDateKey("2026-07-14T00:00:00.000Z"), "2026-07-14");
  assertEquals(getUtcDateKey("2026-07-14T23:59:59.999Z"), "2026-07-14");
});

Deno.test("isDailyFreeChatAvailable is available when the daily free chat has never been used", () => {
  assertEquals(isDailyFreeChatAvailable(null, "2026-07-14T12:00:00.000Z"), true);
});

Deno.test("isDailyFreeChatAvailable is unavailable once used on today's UTC date", () => {
  assertEquals(isDailyFreeChatAvailable("2026-07-14", "2026-07-14T12:00:00.000Z"), false);
});

Deno.test("isDailyFreeChatAvailable is available again once the UTC date has rolled over", () => {
  assertEquals(isDailyFreeChatAvailable("2026-07-13", "2026-07-14T00:00:00.000Z"), true);
});

Deno.test("isDailyFreeChatAvailable matches reserve_chat_turn's current_date gate at a UTC day boundary", () => {
  // 2026-07-14T23:30 Pacific local time == 2026-07-15T06:30 UTC -- a client
  // that compared local calendar dates instead of UTC ones would disagree
  // with the server here.
  const lateEveningUtcInstant = "2026-07-15T06:30:00.000Z";

  assertEquals(isDailyFreeChatAvailable("2026-07-15", lateEveningUtcInstant), false);
  assertEquals(isDailyFreeChatAvailable("2026-07-14", lateEveningUtcInstant), true);
});

Deno.test("computeFreeChatTurnsRemaining adds today's daily free turn on top of the starter allowance", () => {
  assertEquals(
    computeFreeChatTurnsRemaining({ starterFreeRemaining: 3, dailyFreeOn: null }, "2026-07-14T09:00:00.000Z"),
    4
  );
});

Deno.test("computeFreeChatTurnsRemaining matches the 0014 migration's default row (starter 3 + daily 1 = 4)", () => {
  assertEquals(
    computeFreeChatTurnsRemaining(
      { starterFreeRemaining: DEFAULT_STARTER_FREE_REMAINING, dailyFreeOn: null },
      "2026-07-14T09:00:00.000Z"
    ),
    4
  );
});

Deno.test("computeFreeChatTurnsRemaining drops the daily turn once used today, keeping the starter remainder", () => {
  assertEquals(
    computeFreeChatTurnsRemaining({ starterFreeRemaining: 2, dailyFreeOn: "2026-07-14" }, "2026-07-14T09:00:00.000Z"),
    2
  );
});

Deno.test("computeFreeChatTurnsRemaining counts only the daily turn once the starter allowance is exhausted", () => {
  assertEquals(
    computeFreeChatTurnsRemaining({ starterFreeRemaining: 0, dailyFreeOn: null }, "2026-07-14T09:00:00.000Z"),
    1
  );
});

Deno.test("computeFreeChatTurnsRemaining is zero once both the starter allowance and today's daily turn are spent", () => {
  assertEquals(
    computeFreeChatTurnsRemaining({ starterFreeRemaining: 0, dailyFreeOn: "2026-07-14" }, "2026-07-14T09:00:00.000Z"),
    0
  );
});

Deno.test("computeFreeChatTurnsRemaining never goes negative even if starterFreeRemaining is corrupt", () => {
  assertEquals(
    computeFreeChatTurnsRemaining({ starterFreeRemaining: -5, dailyFreeOn: "2026-07-14" }, "2026-07-14T09:00:00.000Z"),
    0
  );
});
