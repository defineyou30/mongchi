import { describe, expect, it, vi } from "vitest";

import { clearAvatarGenerationRequestId, getOrCreateAvatarGenerationRequestId, rotateAvatarGenerationRequestId } from "./avatarGenerationRequestIdStore";

const createStorage = () => {
  const values = new Map<string, string>();

  return {
    values,
    storage: {
      getItem: vi.fn(async (key: string) => values.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        values.delete(key);
      })
    }
  };
};

describe("avatar generation request id storage", () => {
  it("reuses the durable request id for the same pet photo", async () => {
    const { storage } = createStorage();
    const createRequestId = vi.fn().mockReturnValueOnce("request-1").mockReturnValueOnce("request-2");

    const first = await getOrCreateAvatarGenerationRequestId(storage, "pet-1", "photo-a", createRequestId);
    const retry = await getOrCreateAvatarGenerationRequestId(storage, "pet-1", "photo-a", createRequestId);

    expect(first).toEqual({ ok: true, requestId: "request-1" });
    expect(retry).toEqual({ ok: true, requestId: "request-1" });
    expect(createRequestId).toHaveBeenCalledTimes(1);
  });

  it("rotates the request id when the selected photo changes", async () => {
    const { storage } = createStorage();
    const createRequestId = vi.fn().mockReturnValueOnce("request-1").mockReturnValueOnce("request-2");

    await getOrCreateAvatarGenerationRequestId(storage, "pet-1", "photo-a", createRequestId);
    const changed = await getOrCreateAvatarGenerationRequestId(storage, "pet-1", "photo-b", createRequestId);

    expect(changed).toEqual({ ok: true, requestId: "request-2" });
  });

  it("clears a terminal request", async () => {
    const { storage, values } = createStorage();
    await getOrCreateAvatarGenerationRequestId(storage, "pet-1", "photo-a", () => "request-1");

    await expect(clearAvatarGenerationRequestId(storage, "pet-1")).resolves.toBe(true);
    expect(values.size).toBe(0);
  });

  it("rotates a refunded request without changing its photo fingerprint", async () => {
    const { storage } = createStorage();
    await getOrCreateAvatarGenerationRequestId(storage, "pet-1", "photo-a", () => "request-1");

    await expect(rotateAvatarGenerationRequestId(storage, "pet-1", "photo-a", "request-2")).resolves.toBe(true);
    await expect(getOrCreateAvatarGenerationRequestId(storage, "pet-1", "photo-a", () => "request-3"))
      .resolves.toEqual({ ok: true, requestId: "request-2" });
  });
});
