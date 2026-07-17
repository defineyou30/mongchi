#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0029_daily_ops_report_schedule.sql"), "utf8");
const edgeFunction = fs.readFileSync(path.join(root, "supabase/functions/daily-ops-report/index.ts"), "utf8");

// ---------------------------------------------------------------------------
// Secret verification: reuses support-feedback-notify's exact secret/header/
// comparison idiom -- same operational secret shared across both functions,
// not a second one to provision.
// ---------------------------------------------------------------------------

assert.match(edgeFunction, /const SUPPORT_NOTIFY_SECRET_HEADER = "X-Support-Notify-Secret"/);
assert.match(edgeFunction, /const constantTimeEqual = \(left: string, right: string\): boolean => \{/);
assert.match(edgeFunction, /Deno\.env\.get\("SUPPORT_NOTIFY_SECRET"\)/);
assert.match(edgeFunction, /if \(!notifySecret\) \{\s*return jsonResponse\(\{ error: "server_misconfigured" \}, 500\);/);
assert.match(edgeFunction, /if \(!constantTimeEqual\(receivedSecret, notifySecret\)\) \{\s*return jsonResponse\(\{ error: "unauthorized" \}, 401\);/);
assert.match(edgeFunction, /req\.method !== "POST"/);

// ---------------------------------------------------------------------------
// No-op gate: SLACK_SUPPORT_WEBHOOK_URL missing -> 200 no-op, BEFORE any
// database query -- the admin client/gatherMetrics call must appear later in
// the file than the no-op return, so a misconfigured deploy never touches
// the database at all.
// ---------------------------------------------------------------------------

assert.match(edgeFunction, /Deno\.env\.get\("SLACK_SUPPORT_WEBHOOK_URL"\)/);
assert.match(
  edgeFunction,
  /if \(!slackWebhookUrl\) \{[\s\S]{0,260}return jsonResponse\(\{ ok: true, ignored: "slack_not_configured" \}, 200\);/
);

const noOpReturnIndex = edgeFunction.indexOf('ignored: "slack_not_configured"');
const gatherMetricsCallIndex = edgeFunction.indexOf("await gatherMetrics(admin, window)");
assert.ok(noOpReturnIndex > 0, "no-op return must exist");
assert.ok(gatherMetricsCallIndex > 0, "gatherMetrics call must exist");
assert.ok(
  noOpReturnIndex < gatherMetricsCallIndex,
  "the Slack no-op gate must return before any metrics are gathered from the database"
);

// ---------------------------------------------------------------------------
// KST date math: fixed UTC+9 offset, no timezone database/Intl lookups.
// ---------------------------------------------------------------------------

assert.match(edgeFunction, /const KST_OFFSET_MS = 9 \* 60 \* 60 \* 1000/);
assert.match(edgeFunction, /const DAY_MS = 24 \* 60 \* 60 \* 1000/);
assert.match(edgeFunction, /const KOREAN_WEEKDAYS = \["일", "월", "화", "수", "목", "금", "토"\]/);
assert.match(edgeFunction, /const computeYesterdayKstWindow = \(now: Date\): ReportWindow => \{/);
assert.match(edgeFunction, /Date\.UTC\(kstNow\.getUTCFullYear\(\), kstNow\.getUTCMonth\(\), kstNow\.getUTCDate\(\)\)/);
assert.match(edgeFunction, /const kstYesterdayStartWall = kstTodayStartWall - DAY_MS/);

// Independent re-implementation of the same fixed-offset arithmetic (not
// imported from the Deno source -- this project's static tests are plain
// Node scripts and cannot execute `npm:`/`Deno.*` Edge Function code
// directly), verified against known instants including a year boundary.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const computeYesterdayKstWindow = (now) => {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstTodayStartWall = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  const kstYesterdayStartWall = kstTodayStartWall - DAY_MS;
  const weekday = KOREAN_WEEKDAYS[new Date(kstYesterdayStartWall).getUTCDay()];
  const month = new Date(kstYesterdayStartWall).getUTCMonth() + 1;
  const day = new Date(kstYesterdayStartWall).getUTCDate();

  return {
    startIso: new Date(kstYesterdayStartWall - KST_OFFSET_MS).toISOString(),
    endIso: new Date(kstTodayStartWall - KST_OFFSET_MS).toISOString(),
    dateLabel: `${month}/${day} (${weekday})`
  };
};

// Cron fires at 00:00 UTC = 09:00 KST -- "yesterday" is the KST calendar day
// that just ended (2026-07-16), expressed as the UTC instant range
// [2026-07-15T15:00Z, 2026-07-16T15:00Z).
const midnightUtcCase = computeYesterdayKstWindow(new Date("2026-07-17T00:00:00.000Z"));
assert.equal(midnightUtcCase.startIso, "2026-07-15T15:00:00.000Z");
assert.equal(midnightUtcCase.endIso, "2026-07-16T15:00:00.000Z");
assert.equal(midnightUtcCase.dateLabel, "7/16 (목)");

// A few seconds of cron/network jitter after the scheduled instant must not
// change which KST day is reported.
const jitterCase = computeYesterdayKstWindow(new Date("2026-07-17T00:00:07.000Z"));
assert.equal(jitterCase.startIso, midnightUtcCase.startIso);
assert.equal(jitterCase.endIso, midnightUtcCase.endIso);

// Year boundary: 2026-01-01T00:00Z is 2026-01-01 09:00 KST, so "yesterday"
// must roll back into the prior year (2025-12-31), not wrap incorrectly.
const yearBoundaryCase = computeYesterdayKstWindow(new Date("2026-01-01T00:00:00.000Z"));
assert.equal(yearBoundaryCase.startIso, "2025-12-30T15:00:00.000Z");
assert.equal(yearBoundaryCase.endIso, "2025-12-31T15:00:00.000Z");
assert.equal(yearBoundaryCase.dateLabel, "12/31 (수)");

// ---------------------------------------------------------------------------
// Metric queries: each wrapped in its own try/catch, so one failing query
// never blanks out the rest of the report (renders "?" for just that
// number instead).
// ---------------------------------------------------------------------------

assert.match(edgeFunction, /const fmt = \(value: number \| null\): string => \(value === null \? "\?" : String\(value\)\)/);

// 신규 입주: original_photo_path IS NOT NULL is the exact "brought a new pet
// to life" condition 0005_pet_namespace.sql's reserve_pet_generation_slot
// already established -- there is no job_type column in this schema.
assert.match(edgeFunction, /const countMoveIns = async/);
assert.match(edgeFunction, /\.eq\("status", "completed"\)\s*\.not\("original_photo_path", "is", null\)\s*\.gte\("completed_at", window\.startIso\)\s*\.lt\("completed_at", window\.endIso\)/);

// 생성 성공/실패: success by completed_at, failure by updated_at (completed_at
// is never set on the failure path -- see 0013_generation_job_durability.sql).
assert.match(edgeFunction, /const countGenerationSuccess = async/);
assert.match(edgeFunction, /const countGenerationFailure = async/);
assert.match(edgeFunction, /\.eq\("status", "failed"\)\s*\.gte\("updated_at", window\.startIso\)\s*\.lt\("updated_at", window\.endIso\)/);

// 신규가입: via the count_new_auth_users RPC (auth.users is not a
// PostgREST-exposed public-schema table).
assert.match(edgeFunction, /const countNewSignups = async/);
assert.match(edgeFunction, /admin\.rpc\("count_new_auth_users", \{\s*p_start: window\.startIso,\s*p_end: window\.endIso\s*\}\)/);

// 채팅 N턴: sender = 'user' only (not pet_ai/system messages).
assert.match(edgeFunction, /const countChatTurns = async/);
assert.match(edgeFunction, /\.from\("conversation_messages"\)/);
assert.match(edgeFunction, /\.eq\("sender", "user"\)/);

// 피드백 N건: total across every category, no per-row content read.
assert.match(edgeFunction, /const countFeedback = async/);
assert.match(edgeFunction, /\.from\("support_feedback"\)/);

// 결제/데이패스/크레딧 소비: bundled via daily_ops_credit_ledger_summary RPC.
assert.match(edgeFunction, /const fetchCreditLedgerSummary = async/);
assert.match(edgeFunction, /admin\.rpc\("daily_ops_credit_ledger_summary", \{\s*p_start: window\.startIso,\s*p_end: window\.endIso\s*\}\)/);

// Slack text: the 4-line template given by design, verbatim structure.
assert.match(edgeFunction, /`🌱 \[Mongchi\] \$\{window\.dateLabel\} 일일 리포트`/);
assert.match(
  edgeFunction,
  /`입주 \$\{fmt\(metrics\.moveIns\)\} · 생성 ✓\$\{fmt\(metrics\.generationSuccess\)\} ✗\$\{fmt\(metrics\.generationFailure\)\} · 신규가입 \$\{fmt\(metrics\.newSignups\)\}`/
);
assert.match(
  edgeFunction,
  /`결제 \$\{fmt\(metrics\.paymentCount\)\}건 \(\+\$\{fmt\(metrics\.paymentCredits\)\}cr\) · 데이패스 \$\{fmt\(metrics\.dayPassCount\)\} · 크레딧 소비 \$\{fmt\(metrics\.consumptionTotal\)\}`/
);
assert.match(
  edgeFunction,
  /`채팅 \$\{fmt\(metrics\.chatTurns\)\}턴 · 피드백 \$\{fmt\(metrics\.feedbackCount\)\}건`/
);

// ---------------------------------------------------------------------------
// Privacy: only aggregate counts/sums ever reach Slack or a console.* call --
// no user id, email, message body, or contact info is ever read.
// ---------------------------------------------------------------------------

for (const forbidden of ["user_id", "\"email\"", "\"message\"", "\"contact\"", ".auth.admin.listUsers"]) {
  assert.doesNotMatch(edgeFunction, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

// ---------------------------------------------------------------------------
// Migration: supporting indexes for the new date-range-only (no user_id)
// query patterns this report introduces.
// ---------------------------------------------------------------------------

assert.match(migration, /CREATE INDEX IF NOT EXISTS generation_jobs_completed_at_idx\s*ON public\.generation_jobs\(completed_at\)\s*WHERE completed_at IS NOT NULL/);
assert.match(migration, /CREATE INDEX IF NOT EXISTS generation_jobs_failed_updated_at_idx\s*ON public\.generation_jobs\(updated_at\)\s*WHERE status = 'failed'/);
assert.match(migration, /CREATE INDEX IF NOT EXISTS credit_ledger_created_idx\s*ON public\.credit_ledger\(created_at\)/);

// ---------------------------------------------------------------------------
// RPC: count_new_auth_users -- service_role-only, reads auth.users directly.
// ---------------------------------------------------------------------------

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.count_new_auth_users\(\s*p_start TIMESTAMPTZ,\s*p_end   TIMESTAMPTZ\s*\)/);
assert.match(migration, /RETURNS INTEGER/);
assert.match(migration, /FROM auth\.users\s*WHERE created_at >= p_start AND created_at < p_end/);
assert.match(
  migration,
  /REVOKE EXECUTE ON FUNCTION public\.count_new_auth_users\(TIMESTAMPTZ, TIMESTAMPTZ\)\s*FROM PUBLIC, anon, authenticated;/
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.count_new_auth_users\(TIMESTAMPTZ, TIMESTAMPTZ\)\s*TO service_role;/
);

// ---------------------------------------------------------------------------
// RPC: daily_ops_credit_ledger_summary -- service_role-only, bundles
// payment/day-pass/consumption aggregates.
//
// Reason strings verified against the actual schema (0004_credit_ledger.sql,
// 0018_chat_day_pass.sql, 0020_chat_day_pass_price_increase.sql,
// revenuecat-credit-webhook/index.ts): purchased credit packs post as
// 'grant_purchase' with ref_type 'iap_transaction' -- NOT 'iap_credit_pack',
// which does not exist anywhere in this schema. Day passes post as
// 'consume_chat_day_pass'.
// ---------------------------------------------------------------------------

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.daily_ops_credit_ledger_summary\(\s*p_start TIMESTAMPTZ,\s*p_end   TIMESTAMPTZ\s*\)/);
assert.match(migration, /RETURNS JSONB/);
assert.match(migration, /WHERE reason = 'grant_purchase'\s*AND ref_type = 'iap_transaction'/);
assert.match(migration, /WHERE reason = 'consume_chat_day_pass'/);
assert.match(migration, /WHERE delta < 0\s*AND created_at >= p_start AND created_at < p_end;\s*\n\s*SELECT COALESCE\(jsonb_agg/);
assert.match(migration, /GROUP BY reason\s*ORDER BY sum\(-delta\) DESC\s*LIMIT 2/);
// 'iap_credit_pack' is mentioned only in prose (explaining why it's the
// WRONG reason string, since it doesn't exist anywhere in this schema) --
// it must never appear as an actual filter condition.
assert.doesNotMatch(migration, /reason\s*=\s*'iap_credit_pack'/);
assert.match(
  migration,
  /REVOKE EXECUTE ON FUNCTION public\.daily_ops_credit_ledger_summary\(TIMESTAMPTZ, TIMESTAMPTZ\)\s*FROM PUBLIC, anon, authenticated;/
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.daily_ops_credit_ledger_summary\(TIMESTAMPTZ, TIMESTAMPTZ\)\s*TO service_role;/
);

// ---------------------------------------------------------------------------
// invoke_daily_ops_report(): mirrors 0028_support_feedback_notify.sql's
// notify_support_feedback() -- SECURITY DEFINER, pinned search_path, pg_net
// call wrapped in its own error-swallowing BEGIN/EXCEPTION, same hardcoded
// project URL / vault-secret split, SAME vault secret name as 0028 (reused,
// not a second one).
// ---------------------------------------------------------------------------

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.invoke_daily_ops_report\(\)/);
assert.match(migration, /RETURNS VOID/);
assert.match(migration, /url := 'https:\/\/cxusiexdwgpfcpirefro\.supabase\.co\/functions\/v1\/daily-ops-report'/);
assert.match(migration, /vault\.decrypted_secrets WHERE name = 'support_notify_secret'/);
assert.match(migration, /'X-Support-Notify-Secret'/);
assert.match(migration, /body := '\{\}'::jsonb/);
assert.match(migration, /BEGIN\s+PERFORM net\.http_post\(/);
assert.match(migration, /EXCEPTION WHEN OTHERS THEN\s*\n\s*-- Never let a report-send failure raise/);

// ---------------------------------------------------------------------------
// pg_cron schedule: guarded exactly like 0018_chat_day_pass.sql /
// 0027_generation_ip_throttle.sql -- skip with a NOTICE, never fail the
// migration, if pg_cron is not installed (confirmed not installed on
// production as of this migration).
// ---------------------------------------------------------------------------

assert.match(migration, /IF EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'\) THEN/);
assert.match(migration, /PERFORM cron\.schedule\(\s*'daily_ops_report_send',\s*'0 0 \* \* \*',\s*\$cron\$SELECT public\.invoke_daily_ops_report\(\);\$cron\$\s*\)/);
assert.match(migration, /pg_cron extension not installed -- skipping daily_ops_report_send schedule/);

// Function definitions are unconditional (not inside the pg_cron guard) --
// only the schedule *registration* is guarded, so enabling pg_cron later
// needs no migration re-run. Verified by position: both CREATE FUNCTION
// statements must appear before the guarded DO block registering the
// schedule.
const scheduleGuardIndex = migration.indexOf("IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')");
const invokeFunctionIndex = migration.indexOf("CREATE OR REPLACE FUNCTION public.invoke_daily_ops_report()");
assert.ok(invokeFunctionIndex > 0 && scheduleGuardIndex > 0);
assert.ok(
  invokeFunctionIndex < scheduleGuardIndex,
  "invoke_daily_ops_report() must be defined unconditionally, before the guarded pg_cron registration"
);

// Manual re-registration command documented in a comment (not just inside a
// runtime string), so an operator can copy-paste it directly once pg_cron
// becomes available.
assert.match(
  migration,
  /SELECT cron\.schedule\('daily_ops_report_send', '0 0 \* \* \*', \$\$SELECT public\.invoke_daily_ops_report\(\);\$\$\);/
);

process.stdout.write("Daily ops report contract passed.\n");
