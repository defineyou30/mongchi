import { describe, expect, it } from "vitest";

import {
  createAlertingOperationalLogger,
  createApiNodeRequestLogger,
  createHttpOperationalAlertSink,
  createJsonLineOperationalLogger,
  createPremiumChatMonitor,
  evaluateOperationalAlert,
  sanitizeOperationalMetadata
} from "../operationalLogger";

describe("operational logger", () => {
  it("writes bounded JSON lines and redacts sensitive metadata keys", () => {
    const lines: string[] = [];
    const logger = createJsonLineOperationalLogger({
      serviceName: "tiny-pet-test",
      now: () => "2026-06-24T09:00:00.000Z",
      write: (line) => {
        lines.push(line);
      }
    });

    logger.info?.("runtime_event", {
      requestId: "req_001",
      authToken: "raw-token",
      signedUrl: "https://storage.example.test/private.png?X-Amz-Signature=raw-signature",
      text: "raw message text",
      nested: {
        providerApiKey: "sk-secret",
        password: "raw-password",
        ok: true
      },
      error: new Error("raw database password")
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toEqual({
      timestamp: "2026-06-24T09:00:00.000Z",
      level: "info",
      serviceName: "tiny-pet-test",
      event: "runtime_event",
      metadata: {
        requestId: "req_001",
        authToken: "[redacted]",
        signedUrl: "[redacted]",
        text: "[redacted]",
        nested: {
          providerApiKey: "[redacted]",
          password: "[redacted]",
          ok: true
        },
        error: {
          name: "Error"
        }
      }
    });
    expect(lines.join("\n")).not.toContain("raw-token");
    expect(lines.join("\n")).not.toContain("sk-secret");
    expect(lines.join("\n")).not.toContain("raw-signature");
    expect(lines.join("\n")).not.toContain("raw message text");
    expect(lines.join("\n")).not.toContain("raw-password");
    expect(lines.join("\n")).not.toContain("database password");
  });

  it("adapts request and premium chat monitor events onto the same logger", () => {
    const events: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const logger = {
      info: (event: string, metadata: Record<string, unknown>) => {
        events.push({ event, metadata: sanitizeOperationalMetadata(metadata) });
      }
    };
    const requestLogger = createApiNodeRequestLogger(logger);
    const premiumChatMonitor = createPremiumChatMonitor(logger);

    requestLogger({
      requestId: "req_001",
      method: "GET",
      path: "/v1/me",
      status: 200,
      durationMs: 12,
      rateLimited: false
    });
    premiumChatMonitor.info?.("premium_chat_provider_succeeded", {
      conversationId: "conv_001",
      petId: "pet_001",
      locale: "en-US",
      recentMessageCount: 0,
      inputSafetyFlags: [],
      outputSafetyFlags: []
    });

    expect(events.map((event) => event.event)).toEqual(["api_request_finished", "premium_chat_provider_succeeded"]);
  });

  it("evaluates operational alert categories for production monitoring signals", () => {
    expect(
      evaluateOperationalAlert("info", "api_request_finished", {
        status: 503,
        path: "/v1/me"
      })
    ).toMatchObject({
      severity: "critical",
      category: "api_errors",
      alertId: "api_errors:api_request_finished"
    });
    expect(
      evaluateOperationalAlert("info", "generation_worker_batch_finished", {
        completedJobs: 2,
        failedJobs: 1
      })
    ).toMatchObject({
      severity: "warning",
      category: "generation_failure_rate"
    });
    expect(
      evaluateOperationalAlert("error", "store_purchase_verifier_rejected", {
        httpStatus: 503,
        operation: "verify_purchase"
      })
    ).toMatchObject({
      severity: "critical",
      category: "purchase_verification"
    });
    expect(
      evaluateOperationalAlert("error", "commerce_store_webhook_rejected", {
        status: 422,
        reason: "invalid_payload",
        purchaseToken: "raw-store-token"
      })
    ).toMatchObject({
      severity: "warning",
      category: "store_webhook",
      sourceMetadata: {
        purchaseToken: "[redacted]"
      }
    });
    expect(
      evaluateOperationalAlert("info", "generation_worker_batch_finished", {
        completedJobs: 1,
        failedJobs: 0,
        costUnits: 1001
      })
    ).toMatchObject({
      severity: "warning",
      category: "cost_spike"
    });
  });

  it("emits sanitized alert events through the operational logger wrapper", () => {
    const events: Array<{ level: string; event: string; metadata: Record<string, unknown> }> = [];
    const logger = createAlertingOperationalLogger(
      {
        info: (event, metadata) => events.push({ level: "info", event, metadata: sanitizeOperationalMetadata(metadata) }),
        error: (event, metadata) => events.push({ level: "error", event, metadata: sanitizeOperationalMetadata(metadata) })
      },
      {
        policy: {
          maxCostUnitsPerEvent: 10
        }
      }
    );

    logger.info?.("generation_worker_batch_finished", {
      completedJobs: 1,
      failedJobs: 0,
      costUnits: 42,
      providerApiKey: "sk-secret",
      text: "raw chat text"
    });

    expect(events.map((event) => `${event.level}:${event.event}`)).toEqual([
      "info:generation_worker_batch_finished",
      "error:operational_alert_triggered"
    ]);
    expect(events[1]?.metadata).toMatchObject({
      severity: "warning",
      category: "cost_spike",
      event: "generation_worker_batch_finished",
      sourceMetadata: {
        costUnits: 42,
        providerApiKey: "[redacted]",
        text: "[redacted]"
      }
    });
    expect(JSON.stringify(events)).not.toContain("sk-secret");
    expect(JSON.stringify(events)).not.toContain("raw chat text");
  });

  it("dispatches sanitized operational alerts to an injected sink without blocking logging", async () => {
    const sentAlerts: unknown[] = [];
    const events: Array<{ level: string; event: string; metadata: Record<string, unknown> }> = [];
    const logger = createAlertingOperationalLogger(
      {
        info: (event, metadata) => events.push({ level: "info", event, metadata: sanitizeOperationalMetadata(metadata) }),
        error: (event, metadata) => events.push({ level: "error", event, metadata: sanitizeOperationalMetadata(metadata) })
      },
      {
        alertSink: {
          sendAlert: async (alert) => {
            sentAlerts.push(alert);
          }
        }
      }
    );

    logger.error?.("commerce_store_webhook_rejected", {
      status: 422,
      purchaseToken: "raw-store-token",
      receiptHash: "raw-receipt-hash"
    });
    await Promise.resolve();

    expect(events.map((event) => event.event)).toEqual(["commerce_store_webhook_rejected", "operational_alert_triggered"]);
    expect(sentAlerts).toHaveLength(1);
    expect(sentAlerts[0]).toMatchObject({
      category: "store_webhook",
      sourceMetadata: {
        purchaseToken: "[redacted]",
        receiptHash: "[redacted]"
      }
    });
    expect(JSON.stringify(sentAlerts)).not.toContain("raw-store-token");
    expect(JSON.stringify(sentAlerts)).not.toContain("raw-receipt-hash");
  });

  it("posts operational alerts to a webhook sink with server-only authorization", async () => {
    const requests: Array<{ url: string; init: { headers: Record<string, string>; body: string } }> = [];
    const sink = createHttpOperationalAlertSink({
      endpoint: "https://alerts.mongchi.app/hooks/",
      bearerToken: "alert-webhook-secret",
      fetch: async (url, init) => {
        requests.push({
          url,
          init: {
            headers: init.headers,
            body: init.body
          }
        });

        return { ok: true, status: 202 };
      }
    });

    await sink.sendAlert({
      alertId: "store_webhook:commerce_store_webhook_rejected",
      severity: "warning",
      category: "store_webhook",
      event: "commerce_store_webhook_rejected",
      messageSafe: "Commerce store webhook was rejected.",
      sourceLevel: "error",
      sourceMetadata: {
        status: 422,
        token: "raw-token"
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://alerts.mongchi.app/hooks");
    expect(requests[0]?.init.headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer alert-webhook-secret"
    });
    expect(JSON.parse(requests[0]?.init.body ?? "{}")).toMatchObject({
      alertId: "store_webhook:commerce_store_webhook_rejected",
      sourceMetadata: {
        token: "[redacted]"
      }
    });
    expect(requests[0]?.init.body).not.toContain("raw-token");
  });
});
