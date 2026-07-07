import type { ApiNodeRequestLogEvent, ApiNodeRequestLogger } from "./nodeServer";
import type { PremiumChatMonitor } from "./premiumChatMonitoring";

export type OperationalLogLevel = "info" | "error";

export interface OperationalLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

export interface JsonLineOperationalLoggerOptions {
  serviceName?: string;
  now?: () => string;
  write?: (line: string) => void;
}

export type OperationalAlertSeverity = "warning" | "critical";

export type OperationalAlertCategory =
  | "api_errors"
  | "cost_spike"
  | "deletion_failures"
  | "generation_failure_rate"
  | "outbox_delivery"
  | "premium_chat_provider"
  | "purchase_verification"
  | "store_webhook"
  | "runtime_failure";

export interface OperationalAlert {
  alertId: string;
  severity: OperationalAlertSeverity;
  category: OperationalAlertCategory;
  event: string;
  messageSafe: string;
  sourceLevel: OperationalLogLevel;
  sourceMetadata: Record<string, unknown>;
}

export interface OperationalAlertSink {
  sendAlert: (alert: OperationalAlert) => void | Promise<void>;
}

export type OperationalAlertHttpFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number }>;

export interface HttpOperationalAlertSinkOptions {
  endpoint: string;
  bearerToken?: string;
  timeoutMs?: number;
  fetch?: OperationalAlertHttpFetch;
}

export interface OperationalAlertPolicy {
  maxGenerationFailedJobsPerRun: number;
  maxCostUnitsPerEvent: number;
}

export interface OperationalAlertingLoggerOptions {
  policy?: Partial<OperationalAlertPolicy>;
  alertEventName?: string;
  alertSink?: OperationalAlertSink;
}

const defaultServiceName = "mongchi";
const maxStringLength = 300;
const maxArrayItems = 50;
const maxDepth = 6;
const defaultAlertPolicy: OperationalAlertPolicy = {
  maxGenerationFailedJobsPerRun: 0,
  maxCostUnitsPerEvent: 1000
};
const unsafeKeyPatterns = [
  /authorization/i,
  /cookie/i,
  /credential/i,
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /receipt/i,
  /store[_-]?verification/i,
  /photo[_-]?uri/i,
  /source[_-]?photo/i,
  /image[_-]?uri/i,
  /storage[_-]?uri/i,
  /signed[_-]?(url|uri)/i,
  /upload[_-]?(url|uri)/i,
  /read[_-]?(url|uri)/i,
  /raw/i,
  /^text$/i,
  /user[_-]?text/i,
  /reply[_-]?text/i,
  /message[_-]?text/i,
  /provider[_-]?output/i,
  /prompt/i
];

const isUnsafeKey = (key: string): boolean => unsafeKeyPatterns.some((pattern) => pattern.test(key));

const truncateString = (value: string): string => (value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value);

const defaultOperationalAlertFetch = (async (url, init) => {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Global fetch is not available for operational alert delivery.");
  }

  return globalThis.fetch(url, init);
}) satisfies OperationalAlertHttpFetch;

const sanitizeValue = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value ?? null;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "symbol" || typeof value === "function") {
    return String(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name
    };
  }

  if (depth >= maxDepth) {
    return "[truncated]";
  }

  if (seen.has(value)) {
    return "[circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, maxArrayItems).map((item) => sanitizeValue(item, depth + 1, seen));
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((metadata, [key, entryValue]) => {
    metadata[key] = isUnsafeKey(key) ? "[redacted]" : sanitizeValue(entryValue, depth + 1, seen);

    return metadata;
  }, {});
};

export const sanitizeOperationalMetadata = (metadata: Record<string, unknown>): Record<string, unknown> =>
  sanitizeValue(metadata, 0, new WeakSet<object>()) as Record<string, unknown>;

export const createJsonLineOperationalLogger = ({
  serviceName = defaultServiceName,
  now = () => new Date().toISOString(),
  write = (line) => console.log(line)
}: JsonLineOperationalLoggerOptions = {}): OperationalLogger => {
  const log = (level: OperationalLogLevel, event: string, metadata: Record<string, unknown>) => {
    try {
      write(
        JSON.stringify({
          timestamp: now(),
          level,
          serviceName,
          event,
          metadata: sanitizeOperationalMetadata(metadata)
        })
      );
    } catch {
      // Operational logging must never block runtime behavior.
    }
  };

  return {
    info: (event, metadata) => log("info", event, metadata),
    error: (event, metadata) => log("error", event, metadata)
  };
};

const normalizeWebhookEndpoint = (endpoint: string): string => {
  const trimmed = endpoint.trim();

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "https:") {
      throw new Error("Operational alert webhook endpoint must be an https URL.");
    }

    return trimmed.replace(/\/+$/g, "");
  } catch {
    throw new Error("Operational alert webhook endpoint must be an https URL.");
  }
};

const normalizeWebhookTimeoutMs = (timeoutMs: number | undefined): number => {
  if (timeoutMs === undefined) {
    return 5_000;
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30_000) {
    throw new Error("Operational alert webhook timeout must be between 500 and 30000 milliseconds.");
  }

  return timeoutMs;
};

export const createHttpOperationalAlertSink = ({
  endpoint,
  bearerToken,
  timeoutMs,
  fetch = defaultOperationalAlertFetch
}: HttpOperationalAlertSinkOptions): OperationalAlertSink => {
  const normalizedEndpoint = normalizeWebhookEndpoint(endpoint);
  const normalizedTimeoutMs = normalizeWebhookTimeoutMs(timeoutMs);
  const trimmedBearerToken = bearerToken?.trim();

  return {
    sendAlert: async (alert) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), normalizedTimeoutMs);

      try {
        const response = await fetch(normalizedEndpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(trimmedBearerToken ? { authorization: `Bearer ${trimmedBearerToken}` } : {})
          },
          body: JSON.stringify(sanitizeOperationalMetadata(alert as unknown as Record<string, unknown>)),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Operational alert webhook delivery failed with status ${response.status}.`);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  };
};

const readFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const resolveAlertPolicy = (policy: Partial<OperationalAlertPolicy> | undefined): OperationalAlertPolicy => ({
  ...defaultAlertPolicy,
  ...(policy ?? {})
});

const makeAlert = ({
  severity,
  category,
  event,
  sourceLevel,
  messageSafe,
  metadata
}: {
  severity: OperationalAlertSeverity;
  category: OperationalAlertCategory;
  event: string;
  sourceLevel: OperationalLogLevel;
  messageSafe: string;
  metadata: Record<string, unknown>;
}): OperationalAlert => ({
  alertId: `${category}:${event}`,
  severity,
  category,
  event,
  sourceLevel,
  messageSafe,
  sourceMetadata: sanitizeOperationalMetadata(metadata)
});

export const evaluateOperationalAlert = (
  sourceLevel: OperationalLogLevel,
  event: string,
  metadata: Record<string, unknown>,
  policyInput?: Partial<OperationalAlertPolicy>
): OperationalAlert | null => {
  const policy = resolveAlertPolicy(policyInput);
  const status = readFiniteNumber(metadata.status);
  const httpStatus = readFiniteNumber(metadata.httpStatus);
  const failedJobs = readFiniteNumber(metadata.failedJobs);
  const failedEvents = readFiniteNumber(metadata.failedEvents);
  const costUnits = readFiniteNumber(metadata.costUnits);

  if (event === "api_request_finished" && status !== null && status >= 500) {
    return makeAlert({
      severity: "critical",
      category: "api_errors",
      event,
      sourceLevel,
      messageSafe: "API request returned a server error.",
      metadata
    });
  }

  if (event === "generation_worker_process_failed") {
    return makeAlert({
      severity: "critical",
      category: "generation_failure_rate",
      event,
      sourceLevel,
      messageSafe: "Generation worker process failed.",
      metadata
    });
  }

  if (event === "generation_worker_batch_finished" && failedJobs !== null && failedJobs > policy.maxGenerationFailedJobsPerRun) {
    return makeAlert({
      severity: "warning",
      category: "generation_failure_rate",
      event,
      sourceLevel,
      messageSafe: "Generation worker completed a batch with failed jobs.",
      metadata
    });
  }

  if (event === "store_purchase_verifier_transport_failed") {
    return makeAlert({
      severity: "critical",
      category: "purchase_verification",
      event,
      sourceLevel,
      messageSafe: "Store purchase verifier transport failed.",
      metadata
    });
  }

  if (event === "store_purchase_verifier_rejected" && httpStatus !== null && httpStatus >= 500) {
    return makeAlert({
      severity: "critical",
      category: "purchase_verification",
      event,
      sourceLevel,
      messageSafe: "Store purchase verifier returned a server error.",
      metadata
    });
  }

  if (event === "commerce_store_webhook_rejected") {
    return makeAlert({
      severity: status !== null && status >= 500 ? "critical" : "warning",
      category: "store_webhook",
      event,
      sourceLevel,
      messageSafe: "Commerce store webhook was rejected.",
      metadata
    });
  }

  if (event === "privacy_deletion_worker_process_failed" || event === "privacy_deletion_worker_run_finished" && metadata.status === "failed") {
    return makeAlert({
      severity: "critical",
      category: "deletion_failures",
      event,
      sourceLevel,
      messageSafe: "Privacy deletion worker reported a failure.",
      metadata
    });
  }

  if (
    event === "api_outbox_worker_process_failed" ||
    event === "api_outbox_domain_event_failed" ||
    (event === "api_outbox_worker_run_finished" && failedEvents !== null && failedEvents > 0)
  ) {
    return makeAlert({
      severity: "warning",
      category: "outbox_delivery",
      event,
      sourceLevel,
      messageSafe: "API outbox delivery reported a failure.",
      metadata
    });
  }

  if (event === "premium_chat_provider_unavailable" || event === "premium_chat_provider_output_rejected") {
    return makeAlert({
      severity: "warning",
      category: "premium_chat_provider",
      event,
      sourceLevel,
      messageSafe: "Premium chat provider reported an unavailable or rejected response.",
      metadata
    });
  }

  if (event === "api_runtime_command_failed" || event === "chat_retention_purge_worker_process_failed") {
    return makeAlert({
      severity: "critical",
      category: "runtime_failure",
      event,
      sourceLevel,
      messageSafe: "Runtime command reported a process failure.",
      metadata
    });
  }

  if (costUnits !== null && costUnits > policy.maxCostUnitsPerEvent) {
    return makeAlert({
      severity: "warning",
      category: "cost_spike",
      event,
      sourceLevel,
      messageSafe: "Operational event reported cost units above the configured alert threshold.",
      metadata
    });
  }

  return null;
};

export const createAlertingOperationalLogger = (
  logger: OperationalLogger,
  { policy, alertEventName = "operational_alert_triggered", alertSink }: OperationalAlertingLoggerOptions = {}
): OperationalLogger => {
  const log = (level: OperationalLogLevel, event: string, metadata: Record<string, unknown>) => {
    logger[level]?.(event, metadata);

    const alert = evaluateOperationalAlert(level, event, metadata, policy);

    if (alert) {
      logger.error?.(alertEventName, alert as unknown as Record<string, unknown>);

      try {
        const delivery = alertSink?.sendAlert(alert);

        if (delivery && typeof delivery.then === "function") {
          delivery.catch(() => {
            logger.error?.("operational_alert_delivery_failed", {
              alertId: alert.alertId,
              category: alert.category,
              severity: alert.severity
            });
          });
        }
      } catch {
        logger.error?.("operational_alert_delivery_failed", {
          alertId: alert.alertId,
          category: alert.category,
          severity: alert.severity
        });
      }
    }
  };

  return {
    info: (event, metadata) => log("info", event, metadata),
    error: (event, metadata) => log("error", event, metadata)
  };
};

export const createApiNodeRequestLogger = (logger: OperationalLogger): ApiNodeRequestLogger => (event: ApiNodeRequestLogEvent) => {
  logger.info?.("api_request_finished", event as unknown as Record<string, unknown>);
};

export const createPremiumChatMonitor = (logger: OperationalLogger): PremiumChatMonitor => ({
  info: (event, metadata) => logger.info?.(event, metadata as unknown as Record<string, unknown>),
  error: (event, metadata) => logger.error?.(event, metadata as unknown as Record<string, unknown>)
});
