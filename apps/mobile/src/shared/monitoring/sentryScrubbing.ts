/**
 * Pure Sentry event/breadcrumb redaction. sentry.ts wires these in as
 * beforeSend/beforeBreadcrumb, but the redaction logic itself lives here,
 * with zero @sentry/react-native import, so it can be unit tested directly:
 * @sentry/react-native (like posthog-react-native) fails to even parse under
 * vitest's transform (native/Flow-ish syntax), so anything reachable from a
 * test file must stay free of that import -- see sentry.ts's header comment
 * for the full story.
 *
 * Privacy stance mirrors the app's own promise to users (no location/photo
 * retention, no chat-content collection -- see this repo's monitoring task
 * notes): a crash report may carry a stack trace and a coarse breadcrumb
 * trail, but never a photo uri, a chat/message/text body, a local file://
 * path, or a real account id -- only the first 8 characters of the local
 * anonymous id, as a de-duplication hint, never a lookup key.
 */

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN = /uri|photo|message|text/i;
const FILE_URI_PATTERN = /file:\/\/\S*/gi;
const ANONYMOUS_USER_ID_VISIBLE_LENGTH = 8;

/**
 * Keeps only the first 8 characters of a local anonymous id. A de-dup hint
 * for Sentry's own grouping/tagging, never enough of the id to reconstruct
 * or look up the real value elsewhere. Returns undefined for a missing id
 * rather than an empty/placeholder string, so callers can tell "no id" apart
 * from "id present but scrubbed to nothing".
 */
export const scrubAnonymousUserId = (userId: string | null | undefined): string | undefined =>
  userId ? userId.slice(0, ANONYMOUS_USER_ID_VISIBLE_LENGTH) : undefined;

const scrubStringValue = (value: string): string => (FILE_URI_PATTERN.test(value) ? REDACTED : value);

const scrubUnknownValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return scrubStringValue(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknownValue(item));
  }

  if (value !== null && typeof value === "object") {
    return scrubDataRecord(value as Record<string, unknown>);
  }

  return value;
};

/**
 * Deep-scrubs a plain data/extra record (an event's `extra`, or a
 * breadcrumb's `data`): a key matching uri/photo/message/text
 * (case-insensitive substring, e.g. "photoUri", "messageText", "textDraft")
 * has its whole value redacted, regardless of type. Every other string value
 * keeps its shape but has any file:// uri found inside it redacted too, so a
 * stray local path can never leak through an innocuously-named key. Nested
 * objects/arrays are scrubbed recursively.
 */
export const scrubDataRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    scrubbed[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : scrubUnknownValue(value);
  }

  return scrubbed;
};

/**
 * Same file://-redaction rule as scrubDataRecord's string values, applied to
 * a breadcrumb's own top-level `message` (where a "console" category
 * breadcrumb's logged line lands, rather than in `data`). Returns undefined
 * unchanged so callers can skip reassigning when there was no message.
 */
export const scrubBreadcrumbMessage = (message: string | undefined): string | undefined =>
  message === undefined ? undefined : scrubStringValue(message);
