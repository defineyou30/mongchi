import { describe, expect, it } from "vitest";

import {
  clearExpressionPackRequestId,
  getOrCreateExpressionPackRequestId,
  rotateExpressionPackRequestId
} from "./expressionPackRequestIdStore";
import type { ExpressionPackRequestIdStorage } from "./expressionPackRequestIdStore";

const createStorage = (): ExpressionPackRequestIdStorage => {
  const values = new Map<string, string>();

  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    }
  };
};

describe("expression pack request id storage", () => {
  it("reuses the persisted request id after a simulated app restart", async () => {
    const storage = createStorage();

    expect(await getOrCreateExpressionPackRequestId(storage, "pet-a", "pack-a", () => "request-1"))
      .toEqual({ ok: true, requestId: "request-1" });
    expect(await getOrCreateExpressionPackRequestId(storage, "pet-a", "pack-a", () => "request-2"))
      .toEqual({ ok: true, requestId: "request-1" });
  });

  it("creates a fresh request id only after the previous attempt is cleared", async () => {
    const storage = createStorage();

    await getOrCreateExpressionPackRequestId(storage, "pet-a", "pack-a", () => "request-1");
    await clearExpressionPackRequestId(storage, "pet-a", "pack-a");

    expect(await getOrCreateExpressionPackRequestId(storage, "pet-a", "pack-a", () => "request-2"))
      .toEqual({ ok: true, requestId: "request-2" });
  });

  it("replaces a conflicted request id before the next attempt", async () => {
    const storage = createStorage();

    await getOrCreateExpressionPackRequestId(storage, "pet-a", "pack-a", () => "request-1");
    await rotateExpressionPackRequestId(storage, "pet-a", "pack-a", "request-2");

    expect(await getOrCreateExpressionPackRequestId(storage, "pet-a", "pack-a", () => "request-3"))
      .toEqual({ ok: true, requestId: "request-2" });
  });
});
