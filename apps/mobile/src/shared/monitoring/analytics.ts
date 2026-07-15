import PostHog from "posthog-react-native";

import { setMobileAnalyticsSink } from "../analytics/mobileAnalytics";

// PostHog forwarding for recordMobileEvent. This file is the one place in
// the app allowed to import posthog-react-native -- it fails to even parse
// under vitest's transform (non-standard syntax only Metro's bundler
// understands), so nothing reachable from a test file may import it.
// mobileAnalytics.ts (and its whitelist) stay free of this SDK by design --
// see mobileAnalytics.ts's header comment; this module just registers
// itself as that adapter's sink once the client is ready.

const POSTHOG_API_KEY = "phc_mbmkd92Ja2sTfsJMYHFnL8qzwvSLx6U7HEpAmFFEmDUv";
const POSTHOG_HOST = "https://us.i.posthog.com";

const isDevEnvironment = (): boolean => Boolean((globalThis as { __DEV__?: boolean }).__DEV__);

let client: PostHog | null = null;
let initialized = false;

/**
 * Initializes a manual PostHog client -- deliberately not PostHogProvider,
 * since screen/touch autocapture is a PostHogProvider-only feature (see
 * posthog-react-native's PostHogProvider autocapture prop): using the plain
 * client keeps autocapture off by construction, nothing to separately
 * disable. Session replay is never enabled. disableGeoip drops
 * location-from-IP enrichment, matching this app's no-location-retention
 * stance for analytics too. captureAppLifecycleEvents is on -- a simple
 * install/open/foreground retention signal, no free-form properties.
 * Distinct id is PostHog's own anonymous device id: identify() is never
 * called anywhere in this app, so no Supabase uid ever reaches PostHog.
 * Opted out entirely under __DEV__ so local development never ships events
 * to the live project. Idempotent -- safe to call more than once.
 */
export const initAnalyticsMonitoring = (): void => {
  if (initialized) {
    return;
  }

  initialized = true;

  client = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    captureAppLifecycleEvents: true,
    enableSessionReplay: false,
    disableGeoip: true
  });

  if (isDevEnvironment()) {
    void client.optOut();
  }

  setMobileAnalyticsSink((name, properties) => {
    client?.capture(name, properties);
  });
};
