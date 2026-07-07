import { describe, expect, it } from "vitest";

import {
  createManualWeatherContext,
  mockCareState,
  selectPetPushNotificationCandidates,
  selectReturnReminderCandidates
} from "../index";

describe("pet push notification engine", () => {
  it("prioritizes urgent meal reminders when satiety is low and meal time is stale", () => {
    const candidates = selectPetPushNotificationCandidates({
      petName: "Miso",
      now: "2026-06-24T13:00:00.000Z",
      careState: {
        ...mockCareState,
        satiety: 22,
        lastFedAt: "2026-06-24T06:30:00.000Z"
      }
    });

    expect(candidates[0]).toMatchObject({
      key: "meal_urgent",
      priority: 5,
      suggestedAction: "feed"
    });
  });

  it("uses hot weather to raise water reminders before the meter becomes critical", () => {
    const candidates = selectPetPushNotificationCandidates({
      petName: "Miso",
      now: "2026-06-24T13:00:00.000Z",
      weather: createManualWeatherContext("hot", "2026-06-24T13:00:00.000Z"),
      careState: {
        ...mockCareState,
        satiety: 80,
        gardenHealth: 60
      }
    });

    expect(candidates.some((candidate) => candidate.key === "thirst_hot_weather")).toBe(true);
    expect(candidates.find((candidate) => candidate.key === "thirst_hot_weather")?.body).toContain("water bowl");
    expect(candidates.find((candidate) => candidate.key === "thirst_hot_weather")?.body).not.toContain("garden");
  });

  it("does not send soft play nudges during quiet night hours", () => {
    const candidates = selectPetPushNotificationCandidates({
      petName: "Miso",
      now: "2026-06-24T23:00:00.000+09:00",
      careState: {
        ...mockCareState,
        satiety: 85,
        happiness: 35,
        affection: 80,
        energy: 85,
        gardenHealth: 85
      }
    });

    expect(candidates.some((candidate) => candidate.key === "bored_play")).toBe(false);
  });

  it("respects per-notification throttle windows", () => {
    const candidates = selectPetPushNotificationCandidates({
      petName: "Miso",
      now: "2026-06-24T13:00:00.000Z",
      careState: {
        ...mockCareState,
        satiety: 22,
        lastFedAt: "2026-06-24T06:30:00.000Z"
      },
      lastSentAtByKey: {
        meal_urgent: "2026-06-24T12:30:00.000Z"
      }
    });

    expect(candidates.some((candidate) => candidate.key === "meal_urgent")).toBe(false);
  });
});

describe("pet return reminder win-back ladder", () => {
  it("always returns exactly a +1 day and a +3 day candidate, in that order", () => {
    const candidates = selectReturnReminderCandidates({ petName: "Miso" });

    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.key)).toEqual(["return_after_1_day", "return_after_3_days"]);
    expect(candidates.map((candidate) => candidate.daysAfterLastSession)).toEqual([1, 3]);
  });

  it("never guilt-trips - copy stays warm with no streak-loss or nagging language", () => {
    const candidates = selectReturnReminderCandidates({ petName: "Miso" });

    for (const candidate of candidates) {
      expect(candidate.title.length).toBeGreaterThan(0);
      expect(candidate.body.length).toBeGreaterThan(0);
      expect(candidate.body.toLowerCase()).not.toMatch(/miss you|lonely|abandoned|forgot|sad|streak/);
    }
  });

  it("falls back to a default pet name label when petName is blank", () => {
    const candidates = selectReturnReminderCandidates({ petName: "   " });

    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) => candidate.title.length > 0 && candidate.body.length > 0)).toBe(true);
  });

  it("is deterministic for the same petName/seed pairing", () => {
    const first = selectReturnReminderCandidates({ petName: "Miso", seed: "2026-07-03T09:00:00.000Z" });
    const second = selectReturnReminderCandidates({ petName: "Miso", seed: "2026-07-03T09:00:00.000Z" });

    expect(first).toEqual(second);
  });

  it("can vary copy across different seeds while keeping the same keys and day offsets", () => {
    const seeds = ["2026-07-01T09:00:00.000Z", "2026-07-02T09:00:00.000Z", "2026-07-03T09:00:00.000Z", "2026-07-04T09:00:00.000Z"];
    const results = seeds.map((seed) => selectReturnReminderCandidates({ petName: "Miso", seed }));

    for (const candidates of results) {
      expect(candidates.map((candidate) => candidate.key)).toEqual(["return_after_1_day", "return_after_3_days"]);
    }

    const oneDayTitles = new Set(results.map((candidates) => candidates[0]!.title));

    expect(oneDayTitles.size).toBeGreaterThan(1);
  });

  describe("streak-protective +1 day copy", () => {
    it("uses the generic copy when the streak is below the protective threshold", () => {
      const withNoStreak = selectReturnReminderCandidates({ petName: "Miso", seed: "seed-a" });
      const withShortStreak = selectReturnReminderCandidates({ petName: "Miso", seed: "seed-a", careStreakCurrent: 2 });

      expect(withShortStreak[0]!.title).toBe(withNoStreak[0]!.title);
      expect(withShortStreak[0]!.body).toBe(withNoStreak[0]!.body);
    });

    it("switches the +1 day reminder to streak-protective copy once the streak reaches 3", () => {
      const generic = selectReturnReminderCandidates({ petName: "Miso", seed: "seed-a" });
      const protective = selectReturnReminderCandidates({ petName: "Miso", seed: "seed-a", careStreakCurrent: 3 });

      expect(protective[0]!.title).not.toBe(generic[0]!.title);
      // The +3 day reminder is unaffected by streak state -- only the +1 day copy branches.
      expect(protective[1]).toEqual(generic[1]);
    });

    it("never phrases the streak-protective copy as a threat or countdown", () => {
      const protective = selectReturnReminderCandidates({ petName: "Miso", seed: "seed-a", careStreakCurrent: 5 });
      const oneDayReminder = protective[0]!;

      const combined = `${oneDayReminder.title} ${oneDayReminder.body}`.toLowerCase();
      expect(combined).not.toMatch(/will be lost|will lose|expire|running out|last chance|before it/);
    });

    it("stays deterministic for the same petName/seed/streak combination", () => {
      const first = selectReturnReminderCandidates({ petName: "Miso", seed: "seed-b", careStreakCurrent: 4 });
      const second = selectReturnReminderCandidates({ petName: "Miso", seed: "seed-b", careStreakCurrent: 4 });

      expect(first).toEqual(second);
    });
  });
});
