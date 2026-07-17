#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/0028_support_feedback_notify.sql"),
  "utf8"
);
const edgeFunction = fs.readFileSync(
  path.join(root, "supabase/functions/support-feedback-notify/index.ts"),
  "utf8"
);

// Trigger function: SECURITY DEFINER, pinned search_path, calls pg_net's
// async net.http_post at the hardcoded project function URL (not a
// hardcoded URL -- only the secret comes from Supabase Vault).
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.notify_support_feedback/);
assert.match(migration, /RETURNS TRIGGER/);
assert.match(migration, /SECURITY DEFINER/);
assert.match(migration, /SET search_path = public, pg_temp/);
assert.match(
  migration,
  /url := 'https:\/\/cxusiexdwgpfcpirefro\.supabase\.co\/functions\/v1\/support-feedback-notify'/
);
assert.match(
  migration,
  /vault\.decrypted_secrets WHERE name = 'support_notify_secret'/
);
assert.match(migration, /'X-Support-Notify-Secret'/);

// Payload: only category/subcategory/message/locale/platform -- never
// user_id or contact.
assert.match(migration, /'category', NEW\.category/);
assert.match(migration, /'subcategory', NEW\.subcategory/);
assert.match(migration, /'message', NEW\.message/);
assert.match(migration, /'locale', NEW\.locale/);
assert.match(migration, /'platform', NEW\.platform/);
// Comments may reference these column names to explain why they're
// excluded -- what must never appear is either one actually keyed into the
// jsonb payload sent to the Edge Function.
assert.doesNotMatch(migration, /'contact', NEW\.contact/);
assert.doesNotMatch(migration, /'user_id', NEW\.user_id/);

// INSERT-non-blocking guard: the entire net.http_post call is wrapped in a
// BEGIN/EXCEPTION WHEN OTHERS that swallows every error before RETURN NEW.
assert.match(migration, /BEGIN\s+PERFORM net\.http_post\(/);
assert.match(migration, /EXCEPTION WHEN OTHERS THEN\s+-- Never let a notification failure block/);
assert.match(migration, /RETURN NEW;/);

// pg_net availability guard: mirrors 0027_generation_ip_throttle.sql's
// pg_cron guard exactly -- create the trigger only if pg_net is installed,
// otherwise NOTICE and skip (never fail the migration).
assert.match(migration, /IF EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_net'\) THEN/);
assert.match(migration, /CREATE TRIGGER support_feedback_notify_trigger/);
assert.match(migration, /AFTER INSERT ON public\.support_feedback/);
assert.match(migration, /EXECUTE FUNCTION public\.notify_support_feedback\(\)/);
assert.match(migration, /pg_net extension not installed/);

// Edge Function: secret verification via the same constant-time compare
// idiom as revenuecat-credit-webhook, mirrored (not imported from a shared
// module -- this project has no shared Edge Function helpers directory).
assert.match(edgeFunction, /const SUPPORT_NOTIFY_SECRET_HEADER = "X-Support-Notify-Secret"/);
assert.match(edgeFunction, /const constantTimeEqual = \(left: string, right: string\): boolean => \{/);
assert.match(edgeFunction, /Deno\.env\.get\("SUPPORT_NOTIFY_SECRET"\)/);
assert.match(edgeFunction, /if \(!notifySecret\) \{\s*return jsonResponse\(\{ error: "server_misconfigured" \}, 500\);/);
assert.match(edgeFunction, /if \(!constantTimeEqual\(receivedSecret, notifySecret\)\) \{\s*return jsonResponse\(\{ error: "unauthorized" \}, 401\);/);

// No-op gate: env-gated on SLACK_SUPPORT_WEBHOOK_URL -- missing means a
// harmless 200 no-op, never an error, and never a Slack call attempt.
assert.match(edgeFunction, /Deno\.env\.get\("SLACK_SUPPORT_WEBHOOK_URL"\)/);
assert.match(
  edgeFunction,
  /if \(!slackWebhookUrl\) \{[\s\S]{0,120}return jsonResponse\(\{ ok: true, ignored: "slack_not_configured" \}, 200\);/
);

// Category emoji mapping matches the design: generation_issue/feedback/support.
assert.match(edgeFunction, /generation_issue: "🐛"/);
assert.match(edgeFunction, /feedback: "💬"/);
assert.match(edgeFunction, /support: "🆘"/);

// Message truncation to 500 chars before it ever reaches Slack.
assert.match(edgeFunction, /const MAX_SLACK_MESSAGE_LENGTH = 500/);

// Contact not sent: the request-body parser never reads a contact or
// user_id field, so there is no code path that could forward either to
// Slack even if a caller included them.
assert.match(
  edgeFunction,
  /return \{\s*category: typeof value\.category === "string" \? value\.category : null,\s*subcategory: typeof value\.subcategory === "string" \? value\.subcategory : null,\s*message: typeof value\.message === "string" \? value\.message : null,\s*locale: typeof value\.locale === "string" \? value\.locale : null,\s*platform: typeof value\.platform === "string" \? value\.platform : null\s*\};/
);
assert.doesNotMatch(edgeFunction, /value\.contact/);
assert.doesNotMatch(edgeFunction, /value\.user_id/);

process.stdout.write("Support feedback notify contract passed.\n");
