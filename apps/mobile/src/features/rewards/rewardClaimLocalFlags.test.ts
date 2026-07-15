import { beforeEach, describe, expect, it, vi } from "vitest";

const { getItem, setItem } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn()
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (...args: unknown[]) => getItem(...args),
    setItem: (...args: unknown[]) => setItem(...args)
  }
}));

import { hasQueuedRewardLocally, markRewardQueuedLocally } from "./rewardClaimLocalFlags";

describe("hasQueuedRewardLocally", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
  });

  it("returns false when nothing has ever been persisted", async () => {
    getItem.mockResolvedValueOnce(null);

    await expect(hasQueuedRewardLocally("settle_first_chat_hello")).resolves.toBe(false);
  });

  it("returns true when the key was persisted before", async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(["settle_first_chat_hello"]));

    await expect(hasQueuedRewardLocally("settle_first_chat_hello")).resolves.toBe(true);
  });

  it("returns false for a different key than the one persisted", async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(["settle_first_photo"]));

    await expect(hasQueuedRewardLocally("settle_first_chat_hello")).resolves.toBe(false);
  });

  it("fails safe (false) on malformed storage content", async () => {
    getItem.mockResolvedValueOnce("not json");

    await expect(hasQueuedRewardLocally("settle_first_chat_hello")).resolves.toBe(false);
  });

  it("fails safe (false) when storage throws", async () => {
    getItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(hasQueuedRewardLocally("settle_first_chat_hello")).resolves.toBe(false);
  });
});

describe("markRewardQueuedLocally", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
  });

  it("persists a new key alongside any existing ones", async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(["settle_first_photo"]));
    setItem.mockResolvedValueOnce(undefined);

    await markRewardQueuedLocally("settle_first_chat_hello");

    expect(setItem).toHaveBeenCalledWith(
      "mongchi.rewards.queuedKeys.v1",
      JSON.stringify(["settle_first_photo", "settle_first_chat_hello"])
    );
  });

  it("is a no-op when the key is already persisted", async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(["settle_first_chat_hello"]));

    await markRewardQueuedLocally("settle_first_chat_hello");

    expect(setItem).not.toHaveBeenCalled();
  });

  it("never throws when storage fails", async () => {
    getItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(markRewardQueuedLocally("settle_first_chat_hello")).resolves.toBeUndefined();
  });
});
