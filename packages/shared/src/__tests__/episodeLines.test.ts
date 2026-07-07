import { describe, expect, it } from "vitest";

import { createInitialCareStats, bumpCareStats } from "../index";
import type { MemoryEntry } from "../index";
import { selectEpisodeLine } from "../episodes/episodeLines";

const now = "2026-06-24T09:00:00.000Z";

const makeMemory = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: "mem_test",
  type: "first_find",
  occurredAt: now,
  line: "I brought back my very first walk find.",
  ...overrides
});

describe("selectEpisodeLine", () => {
  it("recalls a recent milestone memory within the 48h lookback window", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [makeMemory({ occurredAt: "2026-06-23T12:00:00.000Z" })],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "clear" },
      now
    });

    expect(episode).not.toBeNull();
    expect(episode?.source).toBe("memory");
    expect(episode?.key).toBe("memory:mem_test");
    expect(episode?.line.toLowerCase()).toMatch(/find|found/);
  });

  it("ignores memories older than the 48h lookback window", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [makeMemory({ occurredAt: "2026-06-20T12:00:00.000Z" })],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "clear" },
      now
    });

    expect(episode?.source).not.toBe("memory");
  });

  it("ignores non-milestone memory types (e.g. moved_in, theme_applied)", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [makeMemory({ type: "theme_applied", occurredAt: "2026-06-24T08:00:00.000Z" })],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "clear" },
      now
    });

    expect(episode?.source).not.toBe("memory");
  });

  it("skips a memory recall line already present in recentShownKeys and falls through", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [makeMemory({ occurredAt: "2026-06-23T12:00:00.000Z" })],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "clear" },
      now,
      recentShownKeys: ["memory:mem_test"]
    });

    expect(episode?.key).not.toBe("memory:mem_test");
  });

  it("falls back to a habit line when there is no recent memory but a clear favorite action", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "play");
    stats = bumpCareStats(stats, "play");

    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [],
      careStats: stats,
      streak: 0,
      bondLevel: 1,
      weather: { condition: "clear" },
      now
    });

    expect(episode?.source).toBe("habit");
    expect(episode?.key).toBe("habit:loves_playtime");
    expect(episode?.line.toLowerCase()).toMatch(/play/);
  });

  it("falls back to a weather-shift line when weather changed since yesterday and no memory/habit applies", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "rain" },
      previousWeatherCondition: "clear",
      now
    });

    expect(episode?.source).toBe("weather_shift");
    expect(episode?.line.toLowerCase()).toMatch(/rain/);
  });

  it("returns null when weather is unchanged and there is no memory or habit", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "clear" },
      previousWeatherCondition: "clear",
      now
    });

    expect(episode).toBeNull();
  });

  it("returns null when previousWeatherCondition is unknown, even if weather is set", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "rain" },
      now
    });

    expect(episode).toBeNull();
  });

  it("dedupes the same weather-shift key on the same day when passed in recentShownKeys", () => {
    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "rain" },
      previousWeatherCondition: "clear",
      now,
      recentShownKeys: [`weather_shift:rain:${now.slice(0, 10)}`]
    });

    expect(episode).toBeNull();
  });

  it("fills {petName} placeholders in the selected line", () => {
    const episode = selectEpisodeLine({
      petName: "Poko",
      memories: [],
      careStats: createInitialCareStats(),
      streak: 0,
      bondLevel: 1,
      weather: { condition: "snow" },
      previousWeatherCondition: "cold",
      now
    });

    expect(episode?.line).not.toContain("{petName}");
  });

  it("prioritizes a memory recall over a habit hint when both are available", () => {
    let stats = createInitialCareStats();
    stats = bumpCareStats(stats, "feed");
    stats = bumpCareStats(stats, "feed");

    const episode = selectEpisodeLine({
      petName: "Miso",
      memories: [makeMemory({ type: "streak_milestone", occurredAt: "2026-06-24T01:00:00.000Z", refs: { streakCount: 7 } })],
      careStats: stats,
      streak: 7,
      bondLevel: 2,
      weather: { condition: "clear" },
      now
    });

    expect(episode?.source).toBe("memory");
  });
});
