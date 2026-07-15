import * as Sentry from "@sentry/react-native";

import { scrubAnonymousUserId, scrubBreadcrumbMessage, scrubDataRecord } from "./sentryScrubbing";

// Crash reporting only. This file is the one place in the app allowed to
// import @sentry/react-native -- it fails to even parse under vitest's
// transform (native-module/Flow-ish syntax that only Metro's bundler
// understands), so nothing reachable from a test file may import it. See
// sentryScrubbing.ts for the redaction logic itself, kept import-free and
// fully unit tested; this file only wires that logic into Sentry.init.

// Public DSN (safe to ship in the client bundle -- it can only submit
// events, never read project data). Org "mongchi", project "mongchi".
const SENTRY_DSN = "https://b03834f66b96d7cd4fb91c605becdb07@o4511739887812608.ingest.us.sentry.io/4511739906424832";

const isDevEnvironment = (): boolean => Boolean((globalThis as { __DEV__?: boolean }).__DEV__);

let initialized = false;

/**
 * Crash-only Sentry setup -- no performance tracing (tracesSampleRate: 0),
 * no session replay (never enabled below; nothing in this file turns it on),
 * and no PII (sendDefaultPii: false, plus this module's own beforeSend/
 * beforeBreadcrumb scrubbing on top of Sentry's defaults). Disabled entirely
 * under __DEV__ so local development never sends events to the live
 * project. Idempotent -- safe to call more than once (e.g. fast refresh);
 * only the first call takes effect.
 */
export const initSentryMonitoring = (): void => {
  if (initialized) {
    return;
  }

  initialized = true;

  const devEnvironment = isDevEnvironment();

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: !devEnvironment,
    environment: devEnvironment ? "development" : "production",
    // Crash reporting only -- no performance monitoring.
    tracesSampleRate: 0,
    // Session Replay is never enabled -- no replaysSessionSampleRate/
    // replaysOnErrorSampleRate set, and no Sentry.replayIntegration() added.
    sendDefaultPii: false,
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.data) {
        breadcrumb.data = scrubDataRecord(breadcrumb.data);
      }

      const scrubbedMessage = scrubBreadcrumbMessage(breadcrumb.message);

      if (scrubbedMessage !== undefined) {
        breadcrumb.message = scrubbedMessage;
      }

      return breadcrumb;
    },
    beforeSend: (event) => {
      const currentUser = event.user;

      if (currentUser) {
        // Sentry's User.id can be string | number -- normalize to a string
        // before truncating to the first 8 characters.
        const rawUserId = currentUser.id;
        const scrubbedUserId = scrubAnonymousUserId(
          typeof rawUserId === "string" ? rawUserId : rawUserId != null ? String(rawUserId) : null
        );

        if (scrubbedUserId !== undefined) {
          event.user = { ...currentUser, id: scrubbedUserId };
        }
      }

      if (event.extra) {
        event.extra = scrubDataRecord(event.extra);
      }

      return event;
    }
  });
};

/**
 * Reports a handled (non-fatal) error to Sentry -- for a caught exception
 * worth knowing about in a crash dashboard, distinct from the app's own
 * local reporter (shared/errors/reporter.ts), which stays the default for
 * every existing call site. context goes through the same beforeSend
 * scrubbing as everything else (set via Sentry.setContext, since
 * captureException's own `extra` also flows through beforeSend's `extra`
 * scrubbing above).
 */
export const recordHandledError = (error: unknown, context?: Record<string, unknown>): void => {
  Sentry.captureException(error, context ? { extra: context } : undefined);
};

export { Sentry };
