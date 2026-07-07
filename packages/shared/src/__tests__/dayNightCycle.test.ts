import { describe, expect, it } from "vitest";

import {
  AUTONOMOUS_BEHAVIOR_MAX_INTERVAL_MS,
  AUTONOMOUS_BEHAVIOR_MIN_INTERVAL_MS,
  BUTTERFLY_TAP_LINES,
  BUTTERFLY_VISIT_CHANCE,
  getAutonomousBehaviorIntervalMs,
  isNightHour,
  isNightTime,
  pickAutonomousBehavior,
  pickButterflyTapLine,
  shouldShowMorningStretch,
  shouldSpawnButterflyVisit
} from "../index";

/** Builds an ISO string whose *local* hour is `hour` -- isNightTime re-derives the hour via `new Date(iso).getHours()`, so round-tripping through setHours keeps this independent of the test runner's timezone. */
const isoAtLocalHour = (hour: number): string => {
  const date = new Date("2026-06-24T00:00:00.000Z");
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

describe("isNightHour", () => {
  it("is night starting at the 10pm boundary (matches bgmAssets.ts's isDaytimeHour boundary)", () => {
    expect(isNightHour(22)).toBe(true);
    expect(isNightHour(23)).toBe(true);
  });

  it("is night through midnight up to (not including) 6am", () => {
    expect(isNightHour(0)).toBe(true);
    expect(isNightHour(5)).toBe(true);
  });

  it("is day from 6am up to (not including) 10pm", () => {
    expect(isNightHour(6)).toBe(false);
    expect(isNightHour(12)).toBe(false);
    expect(isNightHour(21)).toBe(false);
  });
});

describe("isNightTime", () => {
  it("reads the local hour off the given ISO timestamp", () => {
    expect(isNightTime(isoAtLocalHour(23))).toBe(true);
    expect(isNightTime(isoAtLocalHour(3))).toBe(true);
    expect(isNightTime(isoAtLocalHour(9))).toBe(false);
    expect(isNightTime(isoAtLocalHour(21))).toBe(false);
  });
});

describe("shouldShowMorningStretch", () => {
  it("is false with no prior visit (first-ever session)", () => {
    expect(shouldShowMorningStretch(null, isoAtLocalHour(7))).toBe(false);
  });

  it("is true when the owner was last here at night and it is now day", () => {
    expect(shouldShowMorningStretch(isoAtLocalHour(23), isoAtLocalHour(7))).toBe(true);
  });

  it("is false when the owner was last here during the day", () => {
    expect(shouldShowMorningStretch(isoAtLocalHour(9), isoAtLocalHour(14))).toBe(false);
  });

  it("is false when both visits fall inside the night window", () => {
    expect(shouldShowMorningStretch(isoAtLocalHour(23), isoAtLocalHour(2))).toBe(false);
  });
});

describe("pickAutonomousBehavior", () => {
  it("only ever returns expressions the free tier or a gracefully-falling-back paid pack already ships", () => {
    const allowedExpressions = new Set(["idle", "happy", "sleep", "curious", "play"]);

    for (let roll = 0; roll <= 1; roll += 0.05) {
      const pick = pickAutonomousBehavior(roll);
      expect(allowedExpressions.has(pick.expression)).toBe(true);
      expect(["shift", "bounce", "flip", "none"]).toContain(pick.motion);
    }
  });

  it("clamps out-of-range rolls instead of throwing or returning undefined", () => {
    expect(pickAutonomousBehavior(-1).expression).toBeTruthy();
    expect(pickAutonomousBehavior(2).expression).toBeTruthy();
  });

  it("is deterministic for a given roll", () => {
    expect(pickAutonomousBehavior(0.42)).toEqual(pickAutonomousBehavior(0.42));
  });
});

describe("getAutonomousBehaviorIntervalMs", () => {
  it("stays within the documented 40-90s window", () => {
    for (let roll = 0; roll <= 1; roll += 0.1) {
      const ms = getAutonomousBehaviorIntervalMs(roll);
      expect(ms).toBeGreaterThanOrEqual(AUTONOMOUS_BEHAVIOR_MIN_INTERVAL_MS);
      expect(ms).toBeLessThanOrEqual(AUTONOMOUS_BEHAVIOR_MAX_INTERVAL_MS);
    }
  });

  it("maps roll 0 and 1 to the exact min/max bounds", () => {
    expect(getAutonomousBehaviorIntervalMs(0)).toBe(AUTONOMOUS_BEHAVIOR_MIN_INTERVAL_MS);
    expect(getAutonomousBehaviorIntervalMs(1)).toBe(AUTONOMOUS_BEHAVIOR_MAX_INTERVAL_MS);
  });
});

describe("shouldSpawnButterflyVisit", () => {
  it("never spawns at night regardless of the roll", () => {
    expect(shouldSpawnButterflyVisit(0, false)).toBe(false);
    expect(shouldSpawnButterflyVisit(0.01, false)).toBe(false);
  });

  it("spawns during the day only when the roll lands under the configured chance", () => {
    expect(shouldSpawnButterflyVisit(0, true)).toBe(true);
    expect(shouldSpawnButterflyVisit(BUTTERFLY_VISIT_CHANCE - 0.01, true)).toBe(true);
    expect(shouldSpawnButterflyVisit(BUTTERFLY_VISIT_CHANCE, true)).toBe(false);
    expect(shouldSpawnButterflyVisit(0.99, true)).toBe(false);
  });
});

describe("pickButterflyTapLine", () => {
  it("always returns one of the authored tap lines", () => {
    for (let roll = 0; roll <= 1; roll += 0.1) {
      expect(BUTTERFLY_TAP_LINES).toContain(pickButterflyTapLine(roll));
    }
  });
});
