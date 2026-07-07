import { beforeEach, describe, expect, it } from "vitest";

import {
  FONT_PAIR_STORAGE_KEY,
  defaultFontPairId,
  fontPairFamilies,
  fontPairIds,
  fontPairLabels,
  getActiveFontPairId,
  isFontPairId,
  readStoredFontPairId,
  setActiveFontPairId,
  writeStoredFontPairId
} from "./fontPair";
import type { FontPairStorage } from "./fontPair";

const createMemoryStorage = (): FontPairStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    }
  };
};

describe("fontPair", () => {
  beforeEach(() => {
    // Reset module-level active pair between tests since it's a shared singleton.
    setActiveFontPairId(defaultFontPairId);
  });

  describe("isFontPairId", () => {
    it("accepts known pair ids", () => {
      expect(isFontPairId("A")).toBe(true);
      expect(isFontPairId("B")).toBe(true);
    });

    it("rejects unknown values", () => {
      expect(isFontPairId("C")).toBe(false);
      expect(isFontPairId(null)).toBe(false);
      expect(isFontPairId(undefined)).toBe(false);
      expect(isFontPairId("")).toBe(false);
    });
  });

  describe("readStoredFontPairId / writeStoredFontPairId", () => {
    it("round-trips a stored pair id", async () => {
      const storage = createMemoryStorage();

      await writeStoredFontPairId("B", storage);

      expect(storage.values.get(FONT_PAIR_STORAGE_KEY)).toBe("B");
      await expect(readStoredFontPairId(storage)).resolves.toBe("B");
    });

    it("falls back to the default pair when nothing is stored", async () => {
      const storage = createMemoryStorage();

      await expect(readStoredFontPairId(storage)).resolves.toBe(defaultFontPairId);
    });

    it("falls back to the default pair when the stored value is invalid", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(FONT_PAIR_STORAGE_KEY, "not-a-pair");

      await expect(readStoredFontPairId(storage)).resolves.toBe(defaultFontPairId);
    });

    it("falls back to the default pair when storage throws", async () => {
      const storage: FontPairStorage = {
        getItem: async () => {
          throw new Error("storage unavailable");
        },
        setItem: async () => {}
      };

      await expect(readStoredFontPairId(storage)).resolves.toBe(defaultFontPairId);
    });
  });

  describe("getActiveFontPairId / setActiveFontPairId", () => {
    it("starts at the default pair", () => {
      expect(getActiveFontPairId()).toBe(defaultFontPairId);
    });

    it("updates the active pair", () => {
      setActiveFontPairId("B");

      expect(getActiveFontPairId()).toBe("B");
    });

    it("is idempotent when set to the same pair id already active", () => {
      setActiveFontPairId("B");
      setActiveFontPairId("B");

      expect(getActiveFontPairId()).toBe("B");
    });
  });

  describe("fontPairFamilies", () => {
    it("defines a display and body face for every declared pair id", () => {
      for (const pairId of fontPairIds) {
        expect(fontPairFamilies[pairId].display).toBeTruthy();
        expect(fontPairFamilies[pairId].body).toBeTruthy();
      }
    });

    it("uses distinct families between pair A and pair B", () => {
      expect(fontPairFamilies.A.display).not.toBe(fontPairFamilies.B.display);
      expect(fontPairFamilies.A.body).not.toBe(fontPairFamilies.B.body);
    });

    it("has a human label for every pair", () => {
      for (const pairId of fontPairIds) {
        expect(fontPairLabels[pairId]).toBeTruthy();
      }
    });
  });
});
