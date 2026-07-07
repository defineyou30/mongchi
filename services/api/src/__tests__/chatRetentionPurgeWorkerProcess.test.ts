import { describe, expect, it } from "vitest";

import type { ChatRetentionPurgeRepository } from "../chatRetentionPurgeWorker";
import { runChatRetentionPurgeWorkerProcess } from "../chatRetentionPurgeWorkerProcess";

const createRepository = (batches: string[][], calls: string[] = []): ChatRetentionPurgeRepository => {
  const queue = [...batches];

  return {
    purgeExpiredMessages: async (deletedBefore, batchSize) => {
      calls.push(`purge:${deletedBefore}:${batchSize}`);

      return {
        deletedBefore,
        deletedMessageIds: queue.shift() ?? []
      };
    }
  };
};

describe("chat retention purge worker process runner", () => {
  it("runs one purge batch by default", async () => {
    const calls: string[] = [];
    const result = await runChatRetentionPurgeWorkerProcess({
      repository: createRepository([["msg_old_001"]], calls),
      retentionWindowMs: 60_000,
      batchSize: 1,
      now: () => "2026-06-24T09:41:00.000Z"
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      purgedRuns: 1,
      deletedMessages: 1,
      idleRuns: 0,
      lastRun: {
        status: "purged"
      }
    });
    expect(calls).toEqual(["purge:2026-06-24T09:40:00.000Z:1"]);
  });

  it("polls until an idle batch and waits between non-idle batches", async () => {
    const sleepDurations: number[] = [];
    const result = await runChatRetentionPurgeWorkerProcess({
      repository: createRepository([["msg_old_001"], []]),
      retentionWindowMs: 60_000,
      mode: "poll",
      pollIntervalMs: 250,
      sleep: async (durationMs) => {
        sleepDurations.push(durationMs);
      },
      now: () => "2026-06-24T09:41:00.000Z"
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 2,
      purgedRuns: 1,
      deletedMessages: 1,
      idleRuns: 1,
      lastRun: {
        status: "idle"
      }
    });
    expect(sleepDurations).toEqual([250]);
  });

  it("returns a safe process failure when the repository throws", async () => {
    const errorEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const repository: ChatRetentionPurgeRepository = {
      purgeExpiredMessages: async () => {
        throw new Error("raw database password should not leak");
      }
    };
    const result = await runChatRetentionPurgeWorkerProcess({
      repository,
      logger: {
        error: (event, metadata) => {
          errorEvents.push({ event, metadata });
        }
      }
    });

    expect(result).toEqual({
      status: "failed",
      runs: 0,
      purgedRuns: 0,
      deletedMessages: 0,
      idleRuns: 0,
      failureCode: "chat_retention_purge_worker_process_failed",
      failureMessageSafe: "Chat retention purge worker process could not run. Check worker deployment logs."
    });
    expect(JSON.stringify(result)).not.toContain("database password");
    expect(errorEvents).toEqual([
      {
        event: "chat_retention_purge_worker_process_failed",
        metadata: {
          runs: 0,
          failureCode: "chat_retention_purge_worker_process_failed"
        }
      }
    ]);
  });
});
