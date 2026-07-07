import { describe, expect, it } from "vitest";

import type { ApiOutboxEventSink } from "../outboxWorker";
import { runApiOutboxWorkerProcess } from "../outboxWorkerProcess";
import type { ApiOutboxEventRecord, ApiOutboxRepository, EnqueueApiOutboxEventInput } from "../postgresOutboxRepository";

const event: ApiOutboxEventRecord = {
  id: "outbox_process_001",
  aggregateType: "privacy_deletion_job",
  aggregateId: "privacy_job_001",
  eventType: "privacy_deletion.completed",
  payload: {
    jobId: "privacy_job_001"
  },
  status: "processing",
  createdAt: "2026-06-24T09:00:00.000Z"
};

const createRepository = (
  events: Array<ApiOutboxEventRecord | null>,
  calls: string[] = []
): ApiOutboxRepository => {
  const queue = [...events];

  return {
    enqueueEvent: async (input: EnqueueApiOutboxEventInput) => ({
      id: "outbox_event_enqueued",
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      status: "pending",
      createdAt: "2026-06-24T09:00:00.000Z"
    }),
    claimNextPendingEvent: async () => {
      calls.push("claim");

      return queue.shift() ?? null;
    },
    markEventProcessed: async (id, processedAt) => {
      calls.push(`processed:${id}:${processedAt}`);

      return {
        ...event,
        id,
        status: "processed",
        processedAt
      };
    },
    markEventFailed: async (id, failureCode, processedAt) => {
      calls.push(`failed:${id}:${failureCode}:${processedAt}`);

      return {
        ...event,
        id,
        status: "failed",
        processedAt,
        failureCode
      };
    }
  };
};

const createSink = (calls: string[] = [], result: Awaited<ReturnType<ApiOutboxEventSink["deliverApiOutboxEvent"]>> = { ok: true }) => ({
  deliverApiOutboxEvent: async ({ event: deliveredEvent }: { event: ApiOutboxEventRecord }) => {
    calls.push(`deliver:${deliveredEvent.id}`);

    return result;
  }
});

describe("API outbox worker process runner", () => {
  it("runs one outbox event by default", async () => {
    const calls: string[] = [];
    const result = await runApiOutboxWorkerProcess({
      repository: createRepository([event], calls),
      sink: createSink(calls),
      now: () => "2026-06-24T09:05:00.000Z"
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      deliveredEvents: 1,
      failedEvents: 0,
      idleRuns: 0,
      lastRun: {
        status: "delivered"
      }
    });
    expect(calls).toEqual([
      "claim",
      "deliver:outbox_process_001",
      "processed:outbox_process_001:2026-06-24T09:05:00.000Z"
    ]);
  });

  it("polls until idle and waits between non-idle runs", async () => {
    const sleepDurations: number[] = [];
    const result = await runApiOutboxWorkerProcess({
      repository: createRepository([event, null]),
      sink: createSink(),
      mode: "poll",
      pollIntervalMs: 250,
      sleep: async (durationMs) => {
        sleepDurations.push(durationMs);
      }
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 2,
      deliveredEvents: 1,
      failedEvents: 0,
      idleRuns: 1,
      lastRun: {
        status: "idle"
      }
    });
    expect(sleepDurations).toEqual([250]);
  });

  it("can stop after a failed outbox event", async () => {
    const result = await runApiOutboxWorkerProcess({
      repository: createRepository([event, event]),
      sink: createSink([], {
        ok: false,
        failureCode: "api_outbox_sink_rejected"
      }),
      mode: "poll",
      stopProcessOnFailure: true
    });

    expect(result).toMatchObject({
      status: "completed",
      runs: 1,
      deliveredEvents: 0,
      failedEvents: 1,
      idleRuns: 0,
      lastRun: {
        status: "failed"
      }
    });
  });

  it("returns a safe process failure when claiming throws", async () => {
    const errorEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const repository: ApiOutboxRepository = {
      enqueueEvent: async () => {
        throw new Error("unused");
      },
      claimNextPendingEvent: async () => {
        throw new Error("raw database password should not leak");
      },
      markEventProcessed: async () => null,
      markEventFailed: async () => null
    };
    const result = await runApiOutboxWorkerProcess({
      repository,
      sink: createSink(),
      logger: {
        error: (event, metadata) => {
          errorEvents.push({ event, metadata });
        }
      }
    });

    expect(result).toEqual({
      status: "failed",
      runs: 0,
      deliveredEvents: 0,
      failedEvents: 0,
      idleRuns: 0,
      failureCode: "api_outbox_worker_process_failed",
      failureMessageSafe: "API outbox worker process could not run. Check worker deployment logs."
    });
    expect(JSON.stringify(result)).not.toContain("database password");
    expect(errorEvents).toEqual([
      {
        event: "api_outbox_worker_process_failed",
        metadata: {
          runs: 0,
          failureCode: "api_outbox_worker_process_failed"
        }
      }
    ]);
  });
});
