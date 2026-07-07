import { describe, expect, it } from "vitest";

import { buildMonthlyLetter, createInitialCareStats, MONTHLY_LETTER_THRESHOLD_DAYS } from "../index";
import type { CareStats, MemoryEntry } from "../index";

const now = "2026-07-07T09:00:00.000Z";

const makeEntry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: "mem_test",
  type: "first_walk",
  occurredAt: now,
  line: "I came back from my very first walk with you.",
  ...overrides
});

const bumpedCareStats = (): CareStats => ({
  actionCounts: { play: 12, feed: 3 },
  treatItemCounts: { item_apple_slice: 4 },
  walkCount: 2,
  totalCareActions: 15
});

describe("buildMonthlyLetter", () => {
  it("returns null before daysTogether reaches the 30-day threshold", () => {
    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: createInitialCareStats(),
      daysTogether: MONTHLY_LETTER_THRESHOLD_DAYS - 1,
      now
    });

    expect(letter).toBeNull();
  });

  it("produces a letter once daysTogether reaches 30", () => {
    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: createInitialCareStats(),
      daysTogether: MONTHLY_LETTER_THRESHOLD_DAYS,
      now
    });

    expect(letter).not.toBeNull();
    expect(letter).toContain("It's been a whole month since I moved in.");
    expect(letter).toContain("Momo");
  });

  it("weaves memory highlights into the letter body as standalone retrospective sentences", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-07T09:00:00.000Z" }),
      makeEntry({
        id: "mem_bond",
        type: "bond_level",
        occurredAt: "2026-06-20T09:00:00.000Z",
        line: "Our bond reached a new level. I feel it every day.",
        refs: { bondLevel: 3 }
      }),
      makeEntry({
        id: "mem_days_7",
        type: "days_milestone",
        occurredAt: "2026-06-14T09:00:00.000Z",
        line: "7 days since I moved in. Every one of them has been good.",
        refs: { daysTogether: 7 }
      })
    ];

    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories,
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter).toContain("I still remember my first day in the garden.");
    expect(letter).toContain("Somewhere along the way, we became a real team.");
  });

  it("excludes days_milestone memories entirely -- the letter itself is the 30-day retrospective", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-07T09:00:00.000Z" }),
      makeEntry({
        id: "mem_days_7",
        type: "days_milestone",
        occurredAt: "2026-06-14T09:00:00.000Z",
        line: "7 days since I moved in. Every one of them has been good.",
        refs: { daysTogether: 7 }
      }),
      makeEntry({
        id: "mem_days_14",
        type: "days_milestone",
        occurredAt: "2026-06-21T09:00:00.000Z",
        line: "14 days since I moved in. Every one of them has been good.",
        refs: { daysTogether: 14 }
      })
    ];

    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories,
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter).not.toContain("days since I moved in");
    expect(letter).not.toContain("7 days");
    expect(letter).not.toContain("14 days");
  });

  it("never lets 'today' leak into the 30-day retrospective (memory lines are present-tense, the letter is not)", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-07T09:00:00.000Z" }),
      makeEntry({
        id: "mem_bond",
        type: "bond_level",
        occurredAt: "2026-06-20T09:00:00.000Z",
        line: "Our bond reached a new level. I feel it every day.",
        refs: { bondLevel: 3 }
      }),
      makeEntry({
        id: "mem_theme",
        type: "theme_applied",
        occurredAt: "2026-06-22T09:00:00.000Z",
        line: "The garden looks different today. I like this new look on us.",
        refs: { itemId: "theme_meadow" }
      })
    ];

    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories,
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter?.toLowerCase()).not.toContain("today");
  });

  it("never comma-splices former standalone memory lines into a run-on sentence", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-07T09:00:00.000Z" }),
      makeEntry({
        id: "mem_bond",
        type: "bond_level",
        occurredAt: "2026-06-20T09:00:00.000Z",
        line: "Our bond reached a new level. I feel it every day.",
        refs: { bondLevel: 3 }
      }),
      makeEntry({
        id: "mem_streak",
        type: "streak_milestone",
        occurredAt: "2026-06-25T09:00:00.000Z",
        line: "10 days in a row together. I look forward to seeing you.",
        refs: { streakCount: 10 }
      })
    ];

    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories,
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter).not.toContain(", our bond");
    expect(letter).not.toContain(", and our bond");
    // The old implementation comma-spliced highlight clauses after "Looking
    // back, ..." -- that lead-in (and the joiner phrasing) must be gone.
    expect(letter).not.toContain("Looking back,");
    expect(letter).not.toMatch(/,\s+and\s+[a-z]+\s+days?\s+since/);
  });

  it("rounds a single highlight out with the quiet-days fallback (moved_in only)", () => {
    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ id: "mem_moved_in", type: "moved_in" })],
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter).toContain("I still remember my first day in the garden.");
    expect(letter).toContain("Mostly, I remember the quiet, good days.");
  });

  it("uses the quiet-days fallback alone when there are no eligible highlights at all", () => {
    const memories: MemoryEntry[] = [
      makeEntry({
        id: "mem_days_7",
        type: "days_milestone",
        occurredAt: "2026-06-14T09:00:00.000Z",
        line: "7 days since I moved in. Every one of them has been good.",
        refs: { daysTogether: 7 }
      })
    ];

    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories,
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter).toContain("Mostly, I remember the quiet, good days.");
  });

  it("omits the quiet-days fallback once 2 or more highlights are already retold", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-07T09:00:00.000Z" }),
      makeEntry({
        id: "mem_bond",
        type: "bond_level",
        occurredAt: "2026-06-20T09:00:00.000Z",
        line: "Our bond reached a new level. I feel it every day.",
        refs: { bondLevel: 3 }
      })
    ];

    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories,
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter).not.toContain("Mostly, I remember the quiet, good days.");
  });

  it("is deterministic for the same input", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_1", type: "moved_in", occurredAt: "2026-06-07T09:00:00.000Z" }),
      makeEntry({
        id: "mem_2",
        type: "first_find",
        occurredAt: "2026-06-10T09:00:00.000Z",
        line: "I brought back my very first walk find."
      })
    ];
    const careStats = bumpedCareStats();

    const letterA = buildMonthlyLetter({ petName: "Momo", memories, careStats, daysTogether: 32, now });
    const letterB = buildMonthlyLetter({ petName: "Momo", memories, careStats, daysTogether: 32, now });

    expect(letterA).toBe(letterB);
  });

  it("includes a favorite-activity line when care stats show a clear favorite", () => {
    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: bumpedCareStats(),
      daysTogether: 30,
      now
    });

    expect(letter).toContain("our playtime");
  });

  it("includes the favorite treat line only when both a treat name and treat stats are present", () => {
    const withTreat = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: bumpedCareStats(),
      favoriteTreatName: "Apple Slice",
      daysTogether: 30,
      now
    });

    expect(withTreat).toContain("Apple Slice");

    const withoutTreat = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: createInitialCareStats(),
      favoriteTreatName: "Apple Slice",
      daysTogether: 30,
      now
    });

    expect(withoutTreat).not.toContain("Apple Slice");
  });

  it("includes the favoriteThing line only when provided", () => {
    const withFavoriteThing = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: createInitialCareStats(),
      favoriteThing: "sunny window naps",
      daysTogether: 30,
      now
    });

    expect(withFavoriteThing).toContain("sunny window naps");

    const withoutFavoriteThing = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(withoutFavoriteThing).not.toContain("Always up for");
  });

  it("never includes guilt-tripping phrasing", () => {
    const letter = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ type: "moved_in" })],
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    const guiltPhrases = ["you forgot", "you never", "why didn't you", "you should have"];

    guiltPhrases.forEach((phrase) => {
      expect(letter?.toLowerCase()).not.toContain(phrase);
    });
  });

  it("keeps the letter between 5 and 8 sentences for both rich and sparse highlight sets", () => {
    const countSentences = (letter: string): number => letter.split(/(?<=[.!])\s+(?=[A-Z-])/).length;

    const richMemories: MemoryEntry[] = [
      makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-07T09:00:00.000Z" }),
      makeEntry({
        id: "mem_collection",
        type: "collection_complete",
        occurredAt: "2026-06-15T09:00:00.000Z",
        line: "Our walk journal is complete. Every little discovery, all in one place."
      }),
      makeEntry({
        id: "mem_rare",
        type: "rare_find",
        occurredAt: "2026-06-18T09:00:00.000Z",
        line: "I found something rainbow-rare on our walk!"
      }),
      makeEntry({
        id: "mem_bond",
        type: "bond_level",
        occurredAt: "2026-06-20T09:00:00.000Z",
        line: "Our bond reached a new level. I feel it every day.",
        refs: { bondLevel: 3 }
      })
    ];

    const richLetter = buildMonthlyLetter({
      petName: "Momo",
      memories: richMemories,
      careStats: bumpedCareStats(),
      favoriteThing: "sunny window naps",
      favoriteTreatName: "Apple Slice",
      daysTogether: 30,
      now
    });

    const sparseLetter = buildMonthlyLetter({
      petName: "Momo",
      memories: [makeEntry({ id: "mem_moved_in", type: "moved_in" })],
      careStats: createInitialCareStats(),
      daysTogether: 30,
      now
    });

    expect(richLetter).not.toBeNull();
    expect(sparseLetter).not.toBeNull();

    const richCount = countSentences(richLetter!);
    const sparseCount = countSentences(sparseLetter!);

    expect(richCount).toBeGreaterThanOrEqual(5);
    expect(richCount).toBeLessThanOrEqual(8);
    expect(sparseCount).toBeGreaterThanOrEqual(5);
    expect(sparseCount).toBeLessThanOrEqual(8);
  });
});
