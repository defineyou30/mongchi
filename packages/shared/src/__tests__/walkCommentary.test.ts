import { describe, expect, it } from "vitest";

import {
  WALK_COMMENTARY_LINE_COUNT,
  WALK_COMMENTARY_MAX_INTERVAL_MS,
  WALK_COMMENTARY_MIN_INTERVAL_MS,
  formatWalkCommentaryLine,
  getWalkCommentaryIntervalMs,
  getWalkCommentaryStage,
  getWalkProgress,
  pickWalkCommentaryLine,
  pickWalkCommentaryLineForElapsed
} from "../domain/walkCommentary";

describe("getWalkProgress", () => {
  it("returns a 0..1 fraction of elapsed over duration", () => {
    expect(getWalkProgress(0, 180_000)).toBe(0);
    expect(getWalkProgress(90_000, 180_000)).toBeCloseTo(0.5, 5);
    expect(getWalkProgress(180_000, 180_000)).toBe(1);
  });

  it("clamps beyond the walk duration instead of exceeding 1", () => {
    expect(getWalkProgress(250_000, 180_000)).toBe(1);
  });

  it("never goes negative for a negative elapsed value", () => {
    expect(getWalkProgress(-500, 180_000)).toBe(0);
  });

  it("defensively returns 1 for a zero or negative duration", () => {
    expect(getWalkProgress(1000, 0)).toBe(1);
    expect(getWalkProgress(1000, -100)).toBe(1);
  });
});

describe("getWalkCommentaryStage", () => {
  it("splits the walk into three even thirds", () => {
    expect(getWalkCommentaryStage(0)).toBe("early");
    expect(getWalkCommentaryStage(0.2)).toBe("early");
    expect(getWalkCommentaryStage(0.34)).toBe("mid");
    expect(getWalkCommentaryStage(0.5)).toBe("mid");
    expect(getWalkCommentaryStage(0.67)).toBe("late");
    expect(getWalkCommentaryStage(1)).toBe("late");
  });

  it("clamps out-of-range progress instead of throwing", () => {
    expect(getWalkCommentaryStage(-1)).toBe("early");
    expect(getWalkCommentaryStage(5)).toBe("late");
  });
});

describe("formatWalkCommentaryLine", () => {
  it("substitutes the pet name into the {petName} token", () => {
    expect(formatWalkCommentaryLine("{petName} is sniffing around.", "Mong")).toBe("Mong is sniffing around.");
  });

  it("falls back to a neutral label for a blank pet name", () => {
    expect(formatWalkCommentaryLine("{petName} is home.", "   ")).toBe("Your pet is home.");
  });

  it("leaves lines with no token untouched", () => {
    expect(formatWalkCommentaryLine("Made a friend. It's a leaf.", "Mong")).toBe("Made a friend. It's a leaf.");
  });
});

describe("pickWalkCommentaryLine", () => {
  it("always returns a non-empty line for every stage across the full roll range", () => {
    const stages: Array<"early" | "mid" | "late"> = ["early", "mid", "late"];

    for (const stage of stages) {
      for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
        const line = pickWalkCommentaryLine(stage, roll, "Mong");

        expect(typeof line).toBe("string");
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toContain("{petName}");
      }
    }
  });

  it("is deterministic for a given stage + roll + name", () => {
    expect(pickWalkCommentaryLine("mid", 0.4, "Mong")).toBe(pickWalkCommentaryLine("mid", 0.4, "Mong"));
  });

  it("clamps rolls outside 0..1 instead of throwing or going out of bounds", () => {
    expect(() => pickWalkCommentaryLine("early", -1, "Mong")).not.toThrow();
    expect(() => pickWalkCommentaryLine("late", 2, "Mong")).not.toThrow();
  });
});

describe("pickWalkCommentaryLineForElapsed", () => {
  it("resolves the stage from elapsed/duration before picking a line", () => {
    const early = pickWalkCommentaryLineForElapsed(0, 180_000, 0, "Mong");
    const late = pickWalkCommentaryLineForElapsed(179_000, 180_000, 0, "Mong");

    expect(early).not.toBe(late);
  });
});

describe("WALK_COMMENTARY_LINE_COUNT", () => {
  it("keeps the combined pool within the 8-10 line design target", () => {
    expect(WALK_COMMENTARY_LINE_COUNT).toBeGreaterThanOrEqual(8);
    expect(WALK_COMMENTARY_LINE_COUNT).toBeLessThanOrEqual(10);
  });
});

describe("getWalkCommentaryIntervalMs", () => {
  it("maps a 0..1 roll to the 40-60s window", () => {
    expect(getWalkCommentaryIntervalMs(0)).toBe(WALK_COMMENTARY_MIN_INTERVAL_MS);
    expect(getWalkCommentaryIntervalMs(1)).toBe(WALK_COMMENTARY_MAX_INTERVAL_MS);

    const mid = getWalkCommentaryIntervalMs(0.5);

    expect(mid).toBeGreaterThan(WALK_COMMENTARY_MIN_INTERVAL_MS);
    expect(mid).toBeLessThan(WALK_COMMENTARY_MAX_INTERVAL_MS);
  });

  it("clamps rolls outside 0..1", () => {
    expect(getWalkCommentaryIntervalMs(-5)).toBe(WALK_COMMENTARY_MIN_INTERVAL_MS);
    expect(getWalkCommentaryIntervalMs(5)).toBe(WALK_COMMENTARY_MAX_INTERVAL_MS);
  });
});
