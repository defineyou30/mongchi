import { describe, expect, it } from "vitest";

import type { ChatRetentionPurgeRepository } from "../chatRetentionPurgeWorker";
import {
  computeChatRetentionPurgeCutoff,
  resolveChatRetentionPurgeBatchSize,
  resolveChatRetentionWindowMs,
  runNextChatRetentionPurge
} from "../chatRetentionPurgeWorker";

describe("chat retention purge worker", () => {
  it("computes the retention cutoff and purges one bounded batch", async () => {
    const calls: Array<{ deletedBefore: string; batchSize: number }> = [];
    const repository: ChatRetentionPurgeRepository = {
      purgeExpiredMessages: async (deletedBefore, batchSize) => {
        calls.push({ deletedBefore, batchSize });

        return {
          deletedBefore,
          deletedMessageIds: ["msg_old_001", "msg_old_002"]
        };
      }
    };

    const result = await runNextChatRetentionPurge({
      repository,
      retentionWindowMs: 60_000,
      batchSize: 2,
      now: () => "2026-06-24T09:41:00.000Z"
    });

    expect(result).toEqual({
      status: "purged",
      deletedBefore: "2026-06-24T09:40:00.000Z",
      deletedMessageIds: ["msg_old_001", "msg_old_002"],
      deletedCount: 2
    });
    expect(calls).toEqual([
      {
        deletedBefore: "2026-06-24T09:40:00.000Z",
        batchSize: 2
      }
    ]);
  });

  it("returns idle when no expired messages were deleted", async () => {
    const repository: ChatRetentionPurgeRepository = {
      purgeExpiredMessages: async (deletedBefore) => ({
        deletedBefore,
        deletedMessageIds: []
      })
    };

    await expect(
      runNextChatRetentionPurge({
        repository,
        retentionWindowMs: 60_000,
        now: () => "2026-06-24T09:41:00.000Z"
      })
    ).resolves.toMatchObject({
      status: "idle",
      deletedCount: 0
    });
  });

  it("normalizes unsafe runtime values to conservative defaults", () => {
    expect(resolveChatRetentionPurgeBatchSize(0)).toBe(500);
    expect(resolveChatRetentionPurgeBatchSize(10_001)).toBe(500);
    expect(resolveChatRetentionPurgeBatchSize(250)).toBe(250);
    expect(resolveChatRetentionWindowMs(0)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(resolveChatRetentionWindowMs(60_000)).toBe(60_000);
    expect(computeChatRetentionPurgeCutoff("2026-06-24T09:41:00.000Z", 60_000)).toBe("2026-06-24T09:40:00.000Z");
    expect(() => computeChatRetentionPurgeCutoff("bad timestamp", 60_000)).toThrow("Invalid chat retention purge timestamp.");
  });
});
