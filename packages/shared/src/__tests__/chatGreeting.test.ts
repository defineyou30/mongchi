import { describe, expect, it } from "vitest";

import { buildChatGreetingLine, createInitialCareStats } from "../index";
import type { CareStats, MemoryEntry } from "../index";

const now = "2026-06-24T09:00:00.000Z";

const makeMemory = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: "mem_test",
  type: "bond_level",
  occurredAt: now,
  line: "Our bond reached a new level.",
  ...overrides
});

const makeCareStats = (overrides: Partial<CareStats> = {}): CareStats => ({
  ...createInitialCareStats(),
  ...overrides
});

describe("buildChatGreetingLine", () => {
  it("leads with a milestone memory from the last 48 hours over anything else", () => {
    const memories: MemoryEntry[] = [
      makeMemory({ id: "mem_bond_3", type: "bond_level", occurredAt: "2026-06-23T09:00:00.000Z" })
    ];
    const careStats = makeCareStats({ actionCounts: { clean: 5 }, totalCareActions: 5 });

    const line = buildChatGreetingLine({
      petName: "Miso",
      memories,
      careStats,
      careState: { lastInteractionAt: now, updatedAt: now },
      now
    });

    expect(line).toMatch(/bond|close/i);
  });

  it("ignores a milestone memory older than the 48 hour window", () => {
    const memories: MemoryEntry[] = [
      makeMemory({ id: "mem_old", type: "bond_level", occurredAt: "2026-06-20T09:00:00.000Z" })
    ];
    const careStats = makeCareStats({ actionCounts: { clean: 3 }, totalCareActions: 3 });

    const line = buildChatGreetingLine({
      petName: "Miso",
      memories,
      careStats,
      careState: { lastInteractionAt: now, updatedAt: now },
      now
    });

    expect(line).toBe("You gave me the good brushes today.");
  });

  it("mentions today's care action when care happened today and no recent milestone exists", () => {
    const careStats = makeCareStats({ actionCounts: { clean: 4, feed: 1 }, totalCareActions: 5 });

    const line = buildChatGreetingLine({
      petName: "Miso",
      memories: [],
      careStats,
      careState: { lastInteractionAt: "2026-06-24T08:30:00.000Z", updatedAt: now },
      now
    });

    expect(line).toBe("You gave me the good brushes today.");
  });

  it("falls back to the all-time favorite care action when no care happened today", () => {
    const careStats = makeCareStats({ actionCounts: { walk: 6 }, totalCareActions: 6, walkCount: 6 });

    const line = buildChatGreetingLine({
      petName: "Miso",
      memories: [],
      careStats,
      careState: { lastInteractionAt: "2026-06-20T08:30:00.000Z", updatedAt: now },
      now
    });

    expect(line).toBe("I always look forward to our walks with you.");
  });

  it("uses a default warm hello when there is no memory, no care today, and no favorite habit", () => {
    const careStats = makeCareStats();

    const line = buildChatGreetingLine({
      petName: "Miso",
      memories: [],
      careStats,
      careState: undefined,
      now
    });

    expect(["Hi. I'm glad you're here.", "I was hoping you'd come by.", "There you are. I've been waiting."]).toContain(line);
  });

  it("is deterministic for the same inputs", () => {
    const memories: MemoryEntry[] = [makeMemory({ id: "mem_1" })];
    const careStats = makeCareStats({ actionCounts: { play: 2 }, totalCareActions: 2 });
    const input = {
      petName: "Miso",
      memories,
      careStats,
      careState: { lastInteractionAt: now, updatedAt: now },
      now
    };

    const first = buildChatGreetingLine(input);
    const second = buildChatGreetingLine(input);

    expect(first).toBe(second);
  });

  it("does not treat a tie between care actions as a favorite, falling back past the tie", () => {
    const careStats = makeCareStats({ actionCounts: { walk: 3, feed: 3 }, totalCareActions: 6 });

    const line = buildChatGreetingLine({
      petName: "Miso",
      memories: [],
      careStats,
      careState: { lastInteractionAt: "2026-06-20T08:30:00.000Z", updatedAt: now },
      now
    });

    expect(["Hi. I'm glad you're here.", "I was hoping you'd come by.", "There you are. I've been waiting."]).toContain(line);
  });

  it("does not surface a non-milestone memory type (e.g. moved_in) as the greeting driver", () => {
    const memories: MemoryEntry[] = [
      makeMemory({ id: "mem_move", type: "moved_in", occurredAt: now, line: "The day I moved into the garden." })
    ];
    const careStats = makeCareStats({ actionCounts: { affection: 4 }, totalCareActions: 4 });

    const line = buildChatGreetingLine({
      petName: "Miso",
      memories,
      careStats,
      careState: { lastInteractionAt: now, updatedAt: now },
      now
    });

    expect(line).toBe("You gave me the gentle pets today.");
  });
});
