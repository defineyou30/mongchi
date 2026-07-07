import { describe, expect, it } from "vitest";

import type { ApiOutboxEventRecord, ApiOutboxRepository, EnqueueApiOutboxEventInput } from "../postgresOutboxRepository";
import {
  createOperationalLoggerApiOutboxEventSink,
  runNextApiOutboxEvent
} from "../outboxWorker";

const createEvent = (overrides: Partial<ApiOutboxEventRecord> = {}): ApiOutboxEventRecord => ({
  id: "outbox_event_001",
  aggregateType: "privacy_deletion_job",
  aggregateId: "privacy_job_001",
  eventType: "privacy_deletion.completed",
  payload: {
    jobId: "privacy_job_001"
  },
  status: "processing",
  createdAt: "2026-06-24T09:00:00.000Z",
  ...overrides
});

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
        ...createEvent({ id }),
        status: "processed",
        processedAt
      };
    },
    markEventFailed: async (id, failureCode, processedAt) => {
      calls.push(`failed:${id}:${failureCode}:${processedAt}`);

      return {
        ...createEvent({ id }),
        status: "failed",
        processedAt,
        failureCode
      };
    }
  };
};

describe("API outbox worker", () => {
  it("delivers a claimed event and marks it processed", async () => {
    const calls: string[] = [];
    const deliveredEventIds: string[] = [];
    const result = await runNextApiOutboxEvent({
      repository: createRepository([createEvent()], calls),
      sink: {
        deliverApiOutboxEvent: async ({ event }) => {
          deliveredEventIds.push(event.id);

          return { ok: true };
        }
      },
      now: () => "2026-06-24T09:05:00.000Z"
    });

    expect(result).toMatchObject({
      status: "delivered",
      event: {
        id: "outbox_event_001",
        status: "processed",
        processedAt: "2026-06-24T09:05:00.000Z"
      }
    });
    expect(deliveredEventIds).toEqual(["outbox_event_001"]);
    expect(calls).toEqual(["claim", "processed:outbox_event_001:2026-06-24T09:05:00.000Z"]);
  });

  it("marks an event failed with safe retry metadata when the sink rejects it", async () => {
    const calls: string[] = [];
    const result = await runNextApiOutboxEvent({
      repository: createRepository([createEvent()], calls),
      sink: {
        deliverApiOutboxEvent: async () => ({
          ok: false,
          failureCode: "bad raw failure code"
        })
      },
      now: () => "2026-06-24T09:06:00.000Z"
    });

    expect(result).toMatchObject({
      status: "failed",
      event: {
        id: "outbox_event_001",
        status: "failed",
        processedAt: "2026-06-24T09:06:00.000Z",
        failureCode: "api_outbox_delivery_failed"
      }
    });
    expect(calls).toEqual(["claim", "failed:outbox_event_001:api_outbox_delivery_failed:2026-06-24T09:06:00.000Z"]);
  });

  it("uses a safe failure code when the sink throws", async () => {
    const result = await runNextApiOutboxEvent({
      repository: createRepository([createEvent()]),
      sink: {
        deliverApiOutboxEvent: async () => {
          throw new Error("raw webhook token should not leak");
        }
      }
    });

    expect(result).toMatchObject({
      status: "failed",
      event: {
        failureCode: "api_outbox_sink_failed"
      }
    });
    expect(JSON.stringify(result)).not.toContain("webhook token");
  });

  it("routes domain failure events through the operational logger without raw payload text", async () => {
    const logEvents: Array<{ level: "info" | "error"; event: string; metadata: Record<string, unknown> }> = [];
    const sink = createOperationalLoggerApiOutboxEventSink({
      info: (event, metadata) => {
        logEvents.push({ level: "info", event, metadata });
      },
      error: (event, metadata) => {
        logEvents.push({ level: "error", event, metadata });
      }
    });

    await sink.deliverApiOutboxEvent({
      event: createEvent({
        eventType: "privacy_deletion.completed",
        payload: {
          jobId: "privacy_job_001",
          messageText: "raw user text",
          signedUrl: "https://storage.example.test/private?X-Amz-Signature=raw"
        }
      })
    });
    await sink.deliverApiOutboxEvent({
      event: createEvent({
        id: "outbox_event_002",
        eventType: "privacy_deletion.failed",
        payload: {
          jobId: "privacy_job_002",
          failureCode: "storage_deletion_request_failed"
        }
      })
    });

    expect(logEvents).toEqual([
      {
        level: "info",
        event: "api_outbox_domain_event_delivered",
        metadata: {
          eventId: "outbox_event_001",
          aggregateType: "privacy_deletion_job",
          aggregateId: "privacy_job_001",
          eventType: "privacy_deletion.completed",
          payload: {
            jobId: "privacy_job_001",
            messageText: "[redacted]",
            signedUrl: "[redacted]"
          }
        }
      },
      {
        level: "error",
        event: "api_outbox_domain_event_failed",
        metadata: {
          eventId: "outbox_event_002",
          aggregateType: "privacy_deletion_job",
          aggregateId: "privacy_job_001",
          eventType: "privacy_deletion.failed",
          payload: {
            jobId: "privacy_job_002",
            failureCode: "storage_deletion_request_failed"
          }
        }
      }
    ]);
    expect(JSON.stringify(logEvents)).not.toContain("raw user text");
    expect(JSON.stringify(logEvents)).not.toContain("X-Amz-Signature");
  });
});
