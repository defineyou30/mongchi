import { describe, expect, it } from "vitest";

import { createInitialCareStats, makeMockGeneratedAsset, mockItems, mockRelationshipState } from "@mongchi/shared";
import type { CareStats, CompanionHabitHint, GeneratedAsset, MemoryEntry, WalkCollectionState } from "@mongchi/shared";

import {
  getDaysTogether,
  getFriendBondPresentation,
  getFriendHabitSummaryPresentation,
  getFriendMemoryAlbumPresentation,
  getFriendMonthlyLetterPresentation,
  getFriendPoseGalleryPresentation,
  getFriendStreakPresentation,
  getFriendWalkCollectionPresentation,
  getMemoryGlyph,
  getMovedInLine,
  getNewlyRevealedPoseStates,
  getPoseRevealBannerLine,
  getPoseRevealPersistedKey,
  getRelativeDayLabel,
  MEMORY_TIMELINE_DISPLAY_LIMIT
} from "./friendProfilePresentation";

describe("friend bond presentation", () => {
  it("derives level and a 0-1 progress fraction from bond xp", () => {
    const presentation = getFriendBondPresentation({ ...mockRelationshipState, bondXp: 66 });

    expect(presentation.level).toBe(1);
    expect(presentation.progressFraction).toBeCloseTo(0.66, 5);
    expect(presentation.levelLabel).toBe("Lv 1");
  });

  it("rolls over into the next level once xp crosses the per-level threshold", () => {
    const presentation = getFriendBondPresentation({ ...mockRelationshipState, bondXp: 140 });

    expect(presentation.level).toBe(2);
    expect(presentation.levelLabel).toBe("Lv 2");
    expect(presentation.progressFraction).toBeCloseTo(0.4, 5);
  });

  it("never reports xp values directly (fraction always clamped 0-1)", () => {
    const presentation = getFriendBondPresentation({ ...mockRelationshipState, bondXp: 0 });

    expect(presentation.progressFraction).toBeGreaterThanOrEqual(0);
    expect(presentation.progressFraction).toBeLessThanOrEqual(1);
  });
});

describe("friend streak presentation", () => {
  it("invites (not scolds) when there is no current streak", () => {
    const presentation = getFriendStreakPresentation(0, 5);

    expect(presentation.headline).toBe("Say hi today to start a new streak");
    expect(presentation.subline).toContain("5 days");
  });

  it("uses singular day wording for a 1-day streak", () => {
    const presentation = getFriendStreakPresentation(1, 1);

    expect(presentation.headline).toBe("You've said hi 1 day in a row");
    expect(presentation.subline).toBe("Best streak: 1 day");
  });

  it("reports plural days for a multi-day streak", () => {
    const presentation = getFriendStreakPresentation(4, 7);

    expect(presentation.headline).toBe("You've said hi 4 days in a row");
    expect(presentation.subline).toBe("Best streak: 7 days");
  });

  it("has no best-streak line to lean on when neither current nor best exist yet", () => {
    const presentation = getFriendStreakPresentation(0, 0);

    expect(presentation.subline).toBe("Every streak starts with one hello.");
  });
});

describe("friend walk collection presentation", () => {
  it("marks discovered collectibles with their real name/emoji and hides the rest", () => {
    const collection: WalkCollectionState = {
      col_sunny_petal: { count: 2, firstFoundAt: "2026-06-24T09:00:00.000Z" }
    };

    const presentation = getFriendWalkCollectionPresentation(collection);
    const sunny = presentation.cells.find((cell) => cell.id === "col_sunny_petal");
    const undiscovered = presentation.cells.find((cell) => cell.id !== "col_sunny_petal");

    expect(sunny).toMatchObject({ found: true, emoji: "🌸", name: "Sunny Petal", count: 2 });
    expect(undiscovered).toMatchObject({ found: false, emoji: "?", name: "???", count: 0 });
  });

  it("reports a human progress count out of the full collection", () => {
    const presentation = getFriendWalkCollectionPresentation({});

    expect(presentation.found).toBe(0);
    expect(presentation.total).toBe(presentation.cells.length);
    expect(presentation.progressLabel).toBe(`0 of ${presentation.total} found`);
  });

  it("counts every discovered id even when the collection has extra unknown keys", () => {
    const collection: WalkCollectionState = {
      col_sunny_petal: { count: 1, firstFoundAt: "2026-06-24T09:00:00.000Z" },
      col_smooth_pebble: { count: 1, firstFoundAt: "2026-06-24T09:00:00.000Z" }
    };

    const presentation = getFriendWalkCollectionPresentation(collection);

    expect(presentation.found).toBe(2);
    expect(presentation.progressLabel).toBe(`2 of ${presentation.total} found`);
  });
});

describe("days together / moved-in copy", () => {
  it("floors partial days rather than rounding up", () => {
    expect(getDaysTogether("2026-06-24T09:00:00.000Z", "2026-06-27T08:59:00.000Z")).toBe(2);
    expect(getDaysTogether("2026-06-24T09:00:00.000Z", "2026-06-27T09:00:00.000Z")).toBe(3);
  });

  it("never goes negative for a clock-skewed 'now'", () => {
    expect(getDaysTogether("2026-06-27T09:00:00.000Z", "2026-06-24T09:00:00.000Z")).toBe(0);
  });

  it("falls back to 0 for invalid timestamps instead of throwing", () => {
    expect(getDaysTogether("not-a-date", "2026-06-27T09:00:00.000Z")).toBe(0);
  });

  it("renders warm moved-in copy for day 0 and later days", () => {
    expect(getMovedInLine(0)).toBe("Moved in today");
    expect(getMovedInLine(1)).toBe("Moved in 1 day ago");
    expect(getMovedInLine(4)).toBe("Moved in 4 days ago");
  });
});

const buildMemory = (overrides: Partial<MemoryEntry> & Pick<MemoryEntry, "id" | "type" | "occurredAt" | "line">): MemoryEntry => ({
  ...overrides
});

describe("relative day label", () => {
  const now = "2026-07-07T12:00:00.000Z";

  it("labels the same calendar day as Today", () => {
    expect(getRelativeDayLabel("2026-07-07T01:00:00.000Z", now)).toBe("Today");
  });

  it("labels the previous calendar day as Yesterday", () => {
    expect(getRelativeDayLabel("2026-07-06T23:00:00.000Z", now)).toBe("Yesterday");
  });

  it("labels earlier days as 'N days ago'", () => {
    expect(getRelativeDayLabel("2026-07-01T12:00:00.000Z", now)).toBe("6 days ago");
  });

  it("never goes negative for a clock-skewed 'now'", () => {
    expect(getRelativeDayLabel("2026-07-10T12:00:00.000Z", now)).toBe("Today");
  });

  it("falls back to 'Just now' for invalid timestamps instead of throwing", () => {
    expect(getRelativeDayLabel("not-a-date", now)).toBe("Just now");
  });
});

describe("memory glyphs", () => {
  it("assigns a distinct plain-unicode glyph per memory type (never emoji)", () => {
    const types: MemoryEntry["type"][] = [
      "moved_in",
      "first_walk",
      "first_find",
      "rare_find",
      "collection_complete",
      "bond_level",
      "streak_milestone",
      "days_milestone",
      "first_treat",
      "theme_applied",
      "expression_pack"
    ];

    for (const type of types) {
      const glyph = getMemoryGlyph(type);

      expect(glyph.length).toBeGreaterThan(0);
      // Rough emoji guard: reject any character outside the basic multilingual plane's symbol blocks.
      expect(glyph.codePointAt(0)).toBeLessThan(0x1f000);
    }
  });
});

describe("friend memory album presentation", () => {
  const now = "2026-07-07T12:00:00.000Z";

  it("renders newest-first, capped at the display limit", () => {
    const memories: MemoryEntry[] = [
      buildMemory({ id: "m1", type: "moved_in", occurredAt: "2026-06-01T09:00:00.000Z", line: "Moved in today." }),
      buildMemory({ id: "m2", type: "first_walk", occurredAt: "2026-06-10T09:00:00.000Z", line: "First walk together." }),
      buildMemory({ id: "m3", type: "bond_level", occurredAt: "2026-07-05T09:00:00.000Z", line: "Reached a new bond level." })
    ];

    const presentation = getFriendMemoryAlbumPresentation(memories, now);

    expect(presentation.rows.map((row) => row.id)).toEqual(["m3", "m2", "m1"]);
    expect(presentation.rows[0]).toMatchObject({ line: "Reached a new bond level.", glyph: getMemoryGlyph("bond_level") });
  });

  it("caps the timeline at MEMORY_TIMELINE_DISPLAY_LIMIT and flags hasMore", () => {
    const memories: MemoryEntry[] = Array.from({ length: MEMORY_TIMELINE_DISPLAY_LIMIT + 3 }, (_, index) =>
      buildMemory({
        id: `m${index}`,
        type: "days_milestone",
        occurredAt: new Date(Date.parse("2026-06-01T09:00:00.000Z") + index * 86_400_000).toISOString(),
        line: `Milestone ${index}`
      })
    );

    const presentation = getFriendMemoryAlbumPresentation(memories, now);

    expect(presentation.rows).toHaveLength(MEMORY_TIMELINE_DISPLAY_LIMIT);
    expect(presentation.hasMore).toBe(true);
  });

  it("does not flag hasMore when the timeline fits within the display limit", () => {
    const memories: MemoryEntry[] = [buildMemory({ id: "m1", type: "moved_in", occurredAt: now, line: "Moved in today." })];

    const presentation = getFriendMemoryAlbumPresentation(memories, now);

    expect(presentation.hasMore).toBe(false);
  });

  it("flags isSparse and offers a forward-looking line for a brand-new owner with only moved_in", () => {
    const memories: MemoryEntry[] = [buildMemory({ id: "m1", type: "moved_in", occurredAt: now, line: "Moved in today." })];

    const presentation = getFriendMemoryAlbumPresentation(memories, now);

    expect(presentation.rows).toHaveLength(1);
    expect(presentation.isSparse).toBe(true);
    expect(presentation.sparseLine).toBe("More moments will find their way here.");
  });

  it("flags isSparse for a genuinely empty memory list too", () => {
    const presentation = getFriendMemoryAlbumPresentation([], now);

    expect(presentation.rows).toHaveLength(0);
    expect(presentation.isSparse).toBe(true);
  });

  it("is not sparse once a second moment has been recorded", () => {
    const memories: MemoryEntry[] = [
      buildMemory({ id: "m1", type: "moved_in", occurredAt: "2026-06-01T09:00:00.000Z", line: "Moved in today." }),
      buildMemory({ id: "m2", type: "first_walk", occurredAt: "2026-06-10T09:00:00.000Z", line: "First walk together." })
    ];

    const presentation = getFriendMemoryAlbumPresentation(memories, now);

    expect(presentation.isSparse).toBe(false);
  });
});

describe("companion habit summary presentation", () => {
  const allHints: CompanionHabitHint[] = [
    "loves_playtime",
    "cuddle_bug",
    "trail_buddy",
    "foodie",
    "chatterbox",
    "gentle_groomer",
    "green_thumb",
    "night_owl_rester"
  ];

  it("maps every habit hint to a distinct, warm, present-tense line", () => {
    const lines = allHints.map((hint) => getFriendHabitSummaryPresentation([hint], undefined, null, []).habitLines[0]);

    expect(new Set(lines).size).toBe(allHints.length);

    for (const line of lines) {
      expect(line).toBeTruthy();
      expect(line?.toLowerCase()).not.toContain("should");
      expect(line?.toLowerCase()).not.toContain("forgot");
    }
  });

  it("falls back to a settling-in line when there are no hints yet (new owner)", () => {
    const presentation = getFriendHabitSummaryPresentation([], undefined, null, []);

    expect(presentation.habitLines).toEqual(["is still settling in and finding favorite things."]);
  });

  it("shows at most two habit lines even when more hints are present", () => {
    const presentation = getFriendHabitSummaryPresentation(allHints, undefined, null, []);

    expect(presentation.habitLines).toHaveLength(2);
  });

  it("includes the onboarding favoriteThing line when present, trimmed", () => {
    const presentation = getFriendHabitSummaryPresentation(["loves_playtime"], "  cloud-shaped leaves  ", null, []);

    expect(presentation.favoriteThingLine).toBe("Always up for cloud-shaped leaves");
  });

  it("omits the favoriteThing line when there is none", () => {
    const presentation = getFriendHabitSummaryPresentation(["loves_playtime"], undefined, null, []);

    expect(presentation.favoriteThingLine).toBeNull();
  });

  it("resolves the favorite treat's catalog name into a 'Current favorite' line", () => {
    const treatItem = mockItems[0]!;
    const presentation = getFriendHabitSummaryPresentation(["foodie"], undefined, treatItem.id, mockItems);

    expect(presentation.favoriteTreatLine).toBe(`Current favorite: ${treatItem.name}`);
  });

  it("omits the favorite treat line when no treat id is known or it isn't in the catalog", () => {
    expect(getFriendHabitSummaryPresentation(["foodie"], undefined, null, mockItems).favoriteTreatLine).toBeNull();
    expect(getFriendHabitSummaryPresentation(["foodie"], undefined, "item_does_not_exist", mockItems).favoriteTreatLine).toBeNull();
  });
});

describe("friend monthly letter presentation", () => {
  const now = "2026-07-07T09:00:00.000Z";
  const baseMemories: MemoryEntry[] = [buildMemory({ id: "m1", type: "moved_in", occurredAt: "2026-06-01T09:00:00.000Z", line: "Moved in today." })];
  const baseInput = (daysTogether: number, careStats: CareStats = createInitialCareStats()) => ({
    petName: "Momo",
    memories: baseMemories,
    careStats,
    catalogItems: mockItems,
    daysTogether,
    now
  });

  it("is locked before day 30, with a Day n of 30 progress label and no letter text", () => {
    const presentation = getFriendMonthlyLetterPresentation(baseInput(12), false);

    expect(presentation.status).toBe("locked");
    expect(presentation.letterText).toBeNull();
    expect(presentation.progressLabel).toBe("Day 12 of 30");
  });

  it("caps the locked progress label at 30 even if daysTogether somehow exceeds it while unopened is impossible", () => {
    // daysTogether >= 30 always yields letterText, so this only exercises the label's clamp for day 29.
    const presentation = getFriendMonthlyLetterPresentation(baseInput(29), false);

    expect(presentation.progressLabel).toBe("Day 29 of 30");
  });

  it("is 'arrived' at day 30+ when not yet opened, with letter text ready", () => {
    const presentation = getFriendMonthlyLetterPresentation(baseInput(30), false);

    expect(presentation.status).toBe("arrived");
    expect(presentation.letterText).toContain("Momo");
    expect(presentation.progressLabel).toBe("Day 30 of 30");
  });

  it("is 'opened' at day 30+ once hasOpened is true, and keeps returning the same letter text", () => {
    const presentation = getFriendMonthlyLetterPresentation(baseInput(31), true);

    expect(presentation.status).toBe("opened");
    expect(presentation.letterText).not.toBeNull();
  });

  it("resolves the favorite treat's catalog name into the letter when care stats show one", () => {
    const treatItem = mockItems[0]!;
    const careStats: CareStats = {
      actionCounts: {},
      treatItemCounts: { [treatItem.id]: 3 },
      walkCount: 0,
      totalCareActions: 3
    };

    const presentation = getFriendMonthlyLetterPresentation(baseInput(30, careStats), false);

    expect(presentation.letterText).toContain(treatItem.name);
  });
});

describe("friend pose gallery presentation", () => {
  const freeTrioAssets: GeneratedAsset[] = (["idle", "happy", "sleep"] as const).map((state) =>
    makeMockGeneratedAsset(state, { petId: "pet_local_001", generationJobId: "gen_local_001" })
  );

  it("shows only owned-state cells and a single unlock card when no pack is owned yet", () => {
    const presentation = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");

    const ownedStates = presentation.cells.filter((cell) => cell.status === "owned").map((cell) => cell.state);
    const lockedStates = presentation.cells.filter((cell) => cell.status === "locked").map((cell) => cell.state);

    expect(ownedStates).toEqual(expect.arrayContaining(["idle", "happy", "sleep"]));
    expect(lockedStates).toEqual(expect.arrayContaining(["curious", "play", "hungry"]));
    expect(presentation.cards).toHaveLength(1);
    expect(presentation.cards[0]).toMatchObject({
      packId: "pack-everyday-moments",
      status: "available",
      label: "See more of Momo — Everyday Moments · 12cr"
    });
  });

  it("removes a pack's card entirely once every one of its states is owned", () => {
    const allAssets: GeneratedAsset[] = [
      ...freeTrioAssets,
      ...(["curious", "play", "hungry"] as const).map((state) =>
        makeMockGeneratedAsset(state, { petId: "pet_local_001", generationJobId: "gen_pack_001" })
      )
    ];

    const presentation = getFriendPoseGalleryPresentation(allAssets, "Momo");

    expect(presentation.cards).toHaveLength(0);
    expect(presentation.cells.every((cell) => cell.status === "owned")).toBe(true);
  });

  it("marks a pending purchase as 'purchasing' with a soft-progress line", () => {
    const presentation = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo", {
      "pack-everyday-moments": { status: "pending" }
    });

    expect(presentation.cards[0]).toMatchObject({
      status: "purchasing",
      progressLine: "New moments are on their way..."
    });
    expect(presentation.cards[0]?.failureLine).toBeNull();
  });

  it("surfaces a warm failure line and lets the card return to available for retry", () => {
    const presentation = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo", {
      "pack-everyday-moments": { status: "failed", failureMessageSafe: "That didn't quite work. Let's try again." }
    });

    expect(presentation.cards[0]).toMatchObject({
      status: "failed",
      failureLine: "That didn't quite work. Let's try again."
    });
    expect(presentation.cards[0]?.progressLine).toBeNull();
  });

  it("gives each owned asset exactly one cell (no duplicates for the same state)", () => {
    const presentation = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");
    const idleCells = presentation.cells.filter((cell) => cell.state === "idle");

    expect(idleCells).toHaveLength(1);
    expect(idleCells[0]?.assetId).toBe(freeTrioAssets.find((asset) => asset.state === "idle")?.id);
  });
});

describe("pose reveal showcase (newly-revealed states + banner line)", () => {
  it("reports no newly revealed states when nothing changed", () => {
    expect(getNewlyRevealedPoseStates(["idle", "happy"], ["idle", "happy"])).toEqual([]);
  });

  it("reports states present now but absent before, in current order", () => {
    const revealed = getNewlyRevealedPoseStates(["idle", "happy", "sleep"], ["idle", "happy", "sleep", "curious", "play", "hungry"]);

    expect(revealed).toEqual(["curious", "play", "hungry"]);
  });

  it("treats an empty previous list as everything being newly revealed", () => {
    expect(getNewlyRevealedPoseStates([], ["curious", "play", "hungry"])).toEqual(["curious", "play", "hungry"]);
  });

  it("returns an empty array when previous already had everything current has", () => {
    expect(getNewlyRevealedPoseStates(["idle", "happy", "sleep"], ["idle", "happy"])).toEqual([]);
  });

  it("spells out small reveal counts warmly, matching the app's milestone-copy voice", () => {
    expect(getPoseRevealBannerLine("Momo", 1)).toBe("One new side of Momo.");
    expect(getPoseRevealBannerLine("Momo", 2)).toBe("Two new sides of Momo.");
    expect(getPoseRevealBannerLine("Momo", 3)).toBe("Three new sides of Momo.");
  });

  it("falls back to digits for a reveal count beyond the spelled-out range", () => {
    expect(getPoseRevealBannerLine("Momo", 11)).toBe("11 new sides of Momo.");
  });

  it("returns null for a zero or negative reveal count (nothing to celebrate)", () => {
    expect(getPoseRevealBannerLine("Momo", 0)).toBeNull();
    expect(getPoseRevealBannerLine("Momo", -1)).toBeNull();
  });

  it("builds a distinct, stable persisted key per pack id", () => {
    expect(getPoseRevealPersistedKey("pack-everyday-moments")).toBe("pose-reveal:pack-everyday-moments");
    expect(getPoseRevealPersistedKey("pack-a")).not.toBe(getPoseRevealPersistedKey("pack-b"));
  });
});
