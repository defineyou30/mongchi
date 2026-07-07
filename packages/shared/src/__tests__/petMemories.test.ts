import { describe, expect, it } from "vitest";

import { getPetMemoryHighlights, getRecentPetMemories, MAX_STORED_MEMORIES, recordPetMemory } from "../index";
import type { MemoryEntry } from "../index";

const now = "2026-06-24T09:00:00.000Z";

const makeEntry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: "mem_test",
  type: "first_walk",
  occurredAt: now,
  line: "I came back from my very first walk with you.",
  ...overrides
});

describe("recordPetMemory", () => {
  it("appends a new memory", () => {
    const memories = recordPetMemory([], makeEntry());

    expect(memories).toHaveLength(1);
    expect(memories[0]?.type).toBe("first_walk");
  });

  it("does not duplicate one-time-ever milestones of the same type", () => {
    let memories = recordPetMemory([], makeEntry({ id: "mem_1" }));
    memories = recordPetMemory(memories, makeEntry({ id: "mem_2", occurredAt: "2026-06-25T09:00:00.000Z" }));

    expect(memories).toHaveLength(1);
    expect(memories[0]?.id).toBe("mem_1");
  });

  it("allows a new bond_level memory per distinct level but blocks a repeat of the same level", () => {
    let memories = recordPetMemory(
      [],
      makeEntry({ id: "mem_bond_2", type: "bond_level", refs: { bondLevel: 2 } })
    );
    memories = recordPetMemory(memories, makeEntry({ id: "mem_bond_3", type: "bond_level", refs: { bondLevel: 3 } }));
    memories = recordPetMemory(memories, makeEntry({ id: "mem_bond_2_dup", type: "bond_level", refs: { bondLevel: 2 } }));

    expect(memories).toHaveLength(2);
    expect(memories.map((entry) => entry.refs?.bondLevel).sort()).toEqual([2, 3]);
  });

  it("allows a new streak_milestone memory per distinct streak count", () => {
    let memories = recordPetMemory(
      [],
      makeEntry({ id: "mem_streak_7", type: "streak_milestone", refs: { streakCount: 7 } })
    );
    memories = recordPetMemory(
      memories,
      makeEntry({ id: "mem_streak_14", type: "streak_milestone", refs: { streakCount: 14 } })
    );

    expect(memories).toHaveLength(2);
  });

  it("allows repeated rare_find entries (each rare find is its own moment)", () => {
    let memories = recordPetMemory(
      [],
      makeEntry({ id: "mem_rare_1", type: "rare_find", refs: { collectibleId: "col_rainbow_shard" } })
    );
    memories = recordPetMemory(
      memories,
      makeEntry({ id: "mem_rare_2", type: "rare_find", refs: { collectibleId: "col_rainbow_shard" }, occurredAt: "2026-07-01T09:00:00.000Z" })
    );

    expect(memories).toHaveLength(2);
  });

  it("allows a new theme_applied memory per distinct theme id", () => {
    let memories = recordPetMemory(
      [],
      makeEntry({ id: "mem_theme_a", type: "theme_applied", refs: { itemId: "theme_beach" } })
    );
    memories = recordPetMemory(
      memories,
      makeEntry({ id: "mem_theme_a_dup", type: "theme_applied", refs: { itemId: "theme_beach" } })
    );
    memories = recordPetMemory(
      memories,
      makeEntry({ id: "mem_theme_b", type: "theme_applied", refs: { itemId: "theme_forest" } })
    );

    expect(memories).toHaveLength(2);
  });

  it("caps stored memories at MAX_STORED_MEMORIES, evicting the oldest first", () => {
    let memories: MemoryEntry[] = [];

    for (let i = 0; i < MAX_STORED_MEMORIES; i += 1) {
      memories = recordPetMemory(
        memories,
        makeEntry({
          id: `mem_bond_${i}`,
          type: "bond_level",
          refs: { bondLevel: i },
          occurredAt: new Date(new Date(now).getTime() + i * 1000).toISOString()
        })
      );
    }

    expect(memories).toHaveLength(MAX_STORED_MEMORIES);

    // One more pushes past the cap -- the oldest entry (bondLevel 0) should be evicted.
    memories = recordPetMemory(
      memories,
      makeEntry({
        id: "mem_bond_overflow",
        type: "bond_level",
        refs: { bondLevel: MAX_STORED_MEMORIES },
        occurredAt: new Date(new Date(now).getTime() + MAX_STORED_MEMORIES * 1000).toISOString()
      })
    );

    expect(memories).toHaveLength(MAX_STORED_MEMORIES);
    expect(memories.some((entry) => entry.refs?.bondLevel === 0)).toBe(false);
    expect(memories.some((entry) => entry.refs?.bondLevel === MAX_STORED_MEMORIES)).toBe(true);
  });

  it("preserves a permanent moved_in milestone even when the cap is exceeded", () => {
    let memories: MemoryEntry[] = recordPetMemory([], makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: now }));

    for (let i = 0; i < MAX_STORED_MEMORIES + 5; i += 1) {
      memories = recordPetMemory(
        memories,
        makeEntry({
          id: `mem_bond_${i}`,
          type: "bond_level",
          refs: { bondLevel: i },
          occurredAt: new Date(new Date(now).getTime() + (i + 1) * 1000).toISOString()
        })
      );
    }

    expect(memories.length).toBeLessThanOrEqual(MAX_STORED_MEMORIES);
    expect(memories.some((entry) => entry.type === "moved_in")).toBe(true);
  });
});

describe("getRecentPetMemories", () => {
  it("returns the n most recent memories, newest first", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_a", occurredAt: "2026-06-20T09:00:00.000Z" }),
      makeEntry({ id: "mem_b", occurredAt: "2026-06-24T09:00:00.000Z" }),
      makeEntry({ id: "mem_c", occurredAt: "2026-06-22T09:00:00.000Z" })
    ];

    const recent = getRecentPetMemories(memories, 2);

    expect(recent.map((entry) => entry.id)).toEqual(["mem_b", "mem_c"]);
  });

  it("returns an empty array when n is 0 or memories is empty", () => {
    expect(getRecentPetMemories([], 5)).toEqual([]);
    expect(getRecentPetMemories([makeEntry()], 0)).toEqual([]);
  });
});

describe("getPetMemoryHighlights", () => {
  it("prioritizes milestone types over routine ones", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_first_walk", type: "first_walk", occurredAt: "2026-06-20T09:00:00.000Z" }),
      makeEntry({ id: "mem_moved_in", type: "moved_in", occurredAt: "2026-06-01T09:00:00.000Z" }),
      makeEntry({ id: "mem_theme", type: "theme_applied", occurredAt: "2026-06-22T09:00:00.000Z" }),
      makeEntry({ id: "mem_bond", type: "bond_level", occurredAt: "2026-06-21T09:00:00.000Z", refs: { bondLevel: 2 } })
    ];

    const highlights = getPetMemoryHighlights(memories, 3);

    expect(highlights.map((entry) => entry.id)).toEqual(["mem_moved_in", "mem_bond", "mem_first_walk"]);
  });

  it("respects the limit parameter", () => {
    const memories: MemoryEntry[] = [
      makeEntry({ id: "mem_1", type: "moved_in" }),
      makeEntry({ id: "mem_2", type: "bond_level", refs: { bondLevel: 2 } }),
      makeEntry({ id: "mem_3", type: "streak_milestone", refs: { streakCount: 7 } })
    ];

    expect(getPetMemoryHighlights(memories, 1)).toHaveLength(1);
  });
});
