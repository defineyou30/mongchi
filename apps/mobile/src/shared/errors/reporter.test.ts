import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearErrorLog, createLocalReporter, ERROR_LOG_STORAGE_KEY, readErrorLog } from "./reporter";
import type { ErrorLogStorage } from "./reporter";

const createMemoryStorage = (): ErrorLogStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    }
  };
};

describe("reporter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("captureError", () => {
    it("appends an error entry to the ring buffer", async () => {
      const storage = createMemoryStorage();
      const reporter = createLocalReporter(storage);

      reporter.captureError(new Error("boom"), { source: "test" });

      // captureError fires the storage write without awaiting it internally.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const log = await readErrorLog(storage);
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        message: "boom",
        level: "error",
        context: { source: "test" }
      });
      expect(log[0]?.stack).toBeDefined();
      expect(log[0]?.timestamp).toEqual(expect.any(String));
    });

    it("handles non-Error values", async () => {
      const storage = createMemoryStorage();
      const reporter = createLocalReporter(storage);

      reporter.captureError("a plain string error");
      await new Promise((resolve) => setTimeout(resolve, 0));

      const log = await readErrorLog(storage);
      expect(log[0]?.message).toBe("a plain string error");
    });

    it("logs to console in dev", () => {
      const devGlobal = globalThis as unknown as { __DEV__: boolean | undefined };
      const originalDev = devGlobal.__DEV__;
      devGlobal.__DEV__ = true;
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const storage = createMemoryStorage();
      const reporter = createLocalReporter(storage);
      reporter.captureError(new Error("dev boom"));

      expect(consoleSpy).toHaveBeenCalled();
      devGlobal.__DEV__ = originalDev;
    });
  });

  describe("captureMessage", () => {
    it("appends a message entry to the ring buffer", async () => {
      const storage = createMemoryStorage();
      const reporter = createLocalReporter(storage);

      reporter.captureMessage("generation failed", { jobId: "job_1" });
      await new Promise((resolve) => setTimeout(resolve, 0));

      const log = await readErrorLog(storage);
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        message: "generation failed",
        level: "message",
        context: { jobId: "job_1" }
      });
    });
  });

  describe("ring buffer cap", () => {
    it("keeps only the most recent 20 entries, newest first", async () => {
      const storage = createMemoryStorage();
      const reporter = createLocalReporter(storage);

      for (let i = 0; i < 25; i += 1) {
        reporter.captureMessage(`message ${i}`);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const log = await readErrorLog(storage);
      expect(log).toHaveLength(20);
      expect(log[0]?.message).toBe("message 24");
      expect(log[19]?.message).toBe("message 5");
    });
  });

  describe("readErrorLog", () => {
    it("returns an empty array when nothing is stored", async () => {
      const storage = createMemoryStorage();
      await expect(readErrorLog(storage)).resolves.toEqual([]);
    });

    it("returns an empty array when the stored value is malformed JSON", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(ERROR_LOG_STORAGE_KEY, "not-json{");

      await expect(readErrorLog(storage)).resolves.toEqual([]);
    });

    it("returns an empty array when storage throws", async () => {
      const storage: ErrorLogStorage = {
        getItem: async () => {
          throw new Error("storage unavailable");
        },
        setItem: async () => {}
      };

      await expect(readErrorLog(storage)).resolves.toEqual([]);
    });

    it("filters out malformed entries", async () => {
      const storage = createMemoryStorage();
      await storage.setItem(
        ERROR_LOG_STORAGE_KEY,
        JSON.stringify([{ timestamp: "2026-01-01", message: "ok", level: "error" }, { garbage: true }])
      );

      const log = await readErrorLog(storage);
      expect(log).toHaveLength(1);
      expect(log[0]?.message).toBe("ok");
    });
  });

  describe("clearErrorLog", () => {
    it("empties the ring buffer", async () => {
      const storage = createMemoryStorage();
      const reporter = createLocalReporter(storage);

      reporter.captureMessage("something");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(await readErrorLog(storage)).toHaveLength(1);

      await clearErrorLog(storage);
      expect(await readErrorLog(storage)).toHaveLength(0);
    });

    it("does not throw when storage fails", async () => {
      const storage: ErrorLogStorage = {
        getItem: async () => null,
        setItem: async () => {
          throw new Error("storage unavailable");
        }
      };

      await expect(clearErrorLog(storage)).resolves.toBeUndefined();
    });
  });

  describe("captureError storage failure", () => {
    it("never throws even if the storage write fails", async () => {
      const storage: ErrorLogStorage = {
        getItem: async () => null,
        setItem: async () => {
          throw new Error("storage unavailable");
        }
      };
      const reporter = createLocalReporter(storage);

      expect(() => reporter.captureError(new Error("boom"))).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
