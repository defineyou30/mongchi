import type { ISODateTime } from "@mongchi/shared";

import type { OperationalLogger } from "./operationalLogger";
import { sanitizeOperationalMetadata } from "./operationalLogger";
import type { ApiOutboxEventRecord, ApiOutboxRepository } from "./postgresOutboxRepository";

export interface ApiOutboxEventSink {
  deliverApiOutboxEvent: (input: { event: ApiOutboxEventRecord }) => Promise<ApiOutboxEventSinkResult>;
}

export type ApiOutboxEventSinkResult =
  | { ok: true }
  | {
      ok: false;
      failureCode: string;
    };

export interface RunNextApiOutboxEventOptions {
  repository: ApiOutboxRepository;
  sink: ApiOutboxEventSink;
  now?: () => ISODateTime;
}

export type ApiOutboxWorkerRunResult =
  | { status: "idle" }
  | { status: "delivered"; event: ApiOutboxEventRecord }
  | { status: "failed"; event: ApiOutboxEventRecord };

const DEFAULT_NOW = "2026-06-24T09:00:00.000Z";
const failureCodePattern = /^[a-z][a-z0-9_]{2,63}$/;

const safeFailureCode = (failureCode: string): string =>
  failureCodePattern.test(failureCode) ? failureCode : "api_outbox_delivery_failed";

const mapLogMetadata = (event: ApiOutboxEventRecord): Record<string, unknown> =>
  sanitizeOperationalMetadata({
    eventId: event.id,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload
  });

export const createOperationalLoggerApiOutboxEventSink = (logger: OperationalLogger): ApiOutboxEventSink => ({
  deliverApiOutboxEvent: async ({ event }) => {
    const metadata = mapLogMetadata(event);

    if (event.eventType.endsWith(".failed")) {
      logger.error?.("api_outbox_domain_event_failed", metadata);
    } else {
      logger.info?.("api_outbox_domain_event_delivered", metadata);
    }

    return { ok: true };
  }
});

export const runNextApiOutboxEvent = async ({
  repository,
  sink,
  now = () => DEFAULT_NOW
}: RunNextApiOutboxEventOptions): Promise<ApiOutboxWorkerRunResult> => {
  const event = await repository.claimNextPendingEvent();

  if (!event) {
    return { status: "idle" };
  }

  const failEvent = async (failureCode: string): Promise<ApiOutboxWorkerRunResult> => {
    const processedAt = now();
    const safeCode = safeFailureCode(failureCode);
    const failedEvent =
      (await repository.markEventFailed(event.id, safeCode, processedAt)) ?? {
        ...event,
        status: "failed",
        processedAt,
        failureCode: safeCode
      };

    return {
      status: "failed",
      event: failedEvent
    };
  };

  let sinkResult: ApiOutboxEventSinkResult;

  try {
    sinkResult = await sink.deliverApiOutboxEvent({ event });
  } catch {
    return failEvent("api_outbox_sink_failed");
  }

  if (!sinkResult.ok) {
    return failEvent(sinkResult.failureCode);
  }

  const processedAt = now();
  const processedEvent =
    (await repository.markEventProcessed(event.id, processedAt)) ?? {
      ...event,
      status: "processed",
      processedAt
    };

  return {
    status: "delivered",
    event: processedEvent
  };
};
