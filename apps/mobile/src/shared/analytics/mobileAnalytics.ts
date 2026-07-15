import { createSafeAnalyticsEvent } from "@mongchi/shared";
import type { SafeAnalyticsEvent, SafeAnalyticsEventName, SafeAnalyticsProperties } from "@mongchi/shared";

import { reporter } from "../errors/reporter";
import { assertWhitelistedAnalyticsProperties } from "./mobileAnalyticsWhitelist";

export type MobileAnalyticsSink = (name: SafeAnalyticsEventName, properties: SafeAnalyticsProperties) => void;

let analyticsSink: MobileAnalyticsSink | null = null;

/**
 * Registers the live analytics destination (PostHog capture) once the client
 * has finished initializing -- see shared/monitoring/analytics.ts, wired from
 * app/_layout.tsx. Kept as an injectable seam, rather than importing
 * posthog-react-native directly in this file, so recordMobileEvent -- and
 * every call site that uses it -- stays a plain function vitest can import
 * and test directly: posthog-react-native (like @sentry/react-native) fails
 * to even parse under vitest's transform, so nothing reachable from a test
 * file may import it. With no sink registered (tests, or before init
 * completes), recordMobileEvent still validates and returns the event; it
 * just has nowhere to send it.
 */
export const setMobileAnalyticsSink = (sink: MobileAnalyticsSink | null): void => {
  analyticsSink = sink;
};

/**
 * Fire-and-forget: a forbidden key pattern (safeAnalytics.ts), a
 * non-whitelisted property (mobileAnalyticsWhitelist.ts), or a sink failure
 * must never escape into the calling screen's event handler and break the
 * UI. Every failure mode is swallowed here and surfaced only through the
 * reporter's dev console + ring buffer.
 */
export const recordMobileEvent = (
  name: SafeAnalyticsEventName,
  properties: SafeAnalyticsProperties = {}
): SafeAnalyticsEvent => {
  try {
    const event = createSafeAnalyticsEvent(name, properties);

    assertWhitelistedAnalyticsProperties(name, properties);
    analyticsSink?.(name, properties);

    return event;
  } catch (cause) {
    reporter.captureMessage("analytics: dropped event", {
      name,
      cause: cause instanceof Error ? cause.message : String(cause)
    });

    return { name, properties, createdAt: new Date().toISOString() };
  }
};
