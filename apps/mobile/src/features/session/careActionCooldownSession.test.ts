import { describe, expect, it } from "vitest";

import type { CareActionCooldownStorage } from "./careActionCooldownSession";
import {
  CARE_ACTION_COOLDOWN_STORAGE_KEY,
  clearCareActionCooldowns,
  parseCareActionCooldowns,
  readCareActionCooldowns,
  writeCareActionCooldowns
} from "./careActionCooldownSession";

const createMemoryStorage = (): CareActionCooldownStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    }
  };
};

describe("care action cooldown session storage", () => {
  it("keeps only known future action cooldowns", () => {
    expect(
      parseCareActionCooldowns(
        {
          feed: 1200,
          play: 900,
          unknown: 2000,
          talk: "soon"
        },
        1000
      )
    ).toEqual({
      feed: 1200
    });
  });

  it("round-trips cooldowns so route reloads do not reset action timers", async () => {
    const storage = createMemoryStorage();

    await writeCareActionCooldowns(
      storage,
      {
        feed: 1_000_000,
        walk: 2_000_000
      },
      500_000
    );

    await expect(readCareActionCooldowns(storage, 500_000)).resolves.toEqual({
      feed: 1_000_000,
      walk: 2_000_000
    });
  });

  it("removes expired or invalid cooldown payloads", async () => {
    const storage = createMemoryStorage();

    await storage.setItem(
      CARE_ACTION_COOLDOWN_STORAGE_KEY,
      JSON.stringify({
        feed: 100,
        play: 200
      })
    );

    await expect(readCareActionCooldowns(storage, 300)).resolves.toEqual({});
    expect(storage.values.has(CARE_ACTION_COOLDOWN_STORAGE_KEY)).toBe(false);

    await storage.setItem(CARE_ACTION_COOLDOWN_STORAGE_KEY, "{bad json");
    await expect(readCareActionCooldowns(storage, 300)).resolves.toEqual({});
    expect(storage.values.has(CARE_ACTION_COOLDOWN_STORAGE_KEY)).toBe(false);
  });

  it("clears cooldowns when the user resets the session", async () => {
    const storage = createMemoryStorage();

    await writeCareActionCooldowns(storage, { affection: 10_000 }, 1_000);
    await clearCareActionCooldowns(storage);

    expect(storage.values.has(CARE_ACTION_COOLDOWN_STORAGE_KEY)).toBe(false);
  });
});
