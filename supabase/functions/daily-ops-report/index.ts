// Mongchi daily-ops-report Edge Function.
//
// Sends one Slack message per day (09:00 KST) summarizing the previous KST
// calendar day's activity: new pets ("입주"), generation success/failure,
// new signups, payments, day passes, credit consumption, chat turns, and
// support/feedback submissions. Invoked by
// supabase/migrations/0029_daily_ops_report_schedule.sql's pg_cron schedule
// (via invoke_daily_ops_report(), a pg_net POST -- see that migration's
// header comment), not by any client.
//
// Auth: POST only, and the caller must present the exact SUPPORT_NOTIFY_SECRET
// value (Edge Function secret) in the X-Support-Notify-Secret header --
// deliberately the SAME secret and header support-feedback-notify/index.ts
// uses (shared operational secret, not a second one to provision), same
// constant-time comparison idiom (mirrors revenuecat-credit-webhook's
// constantTimeEqual exactly). Deploy this function with
// `supabase functions deploy daily-ops-report --no-verify-jwt`, matching
// revenuecat-credit-webhook's deploy command -- the caller is pg_cron/pg_net,
// which never presents a Supabase JWT.
//
// Env-gated no-op: if SLACK_SUPPORT_WEBHOOK_URL is not set, this function
// still verifies the secret, then returns 200 without querying the database
// at all or attempting any Slack call -- same reasoning as support-feedback-
// notify's no-op gate (harmless to deploy/schedule before the Slack webhook
// URL exists).
//
// Resilience: each metric is fetched by its own small function with its own
// try/catch. A single failing query (missing table, transient network
// error, etc.) turns into `null` for just that number -- rendered as "?" in
// the Slack text -- rather than aborting the whole report. See
// buildSlackText's `fmt` helper.
//
// Privacy: only aggregate counts/sums ever reach Slack. No user id, email,
// message body, or any other per-row content is read out of any query
// result here -- every metric function below selects/returns nothing but
// numbers.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPPORT_NOTIFY_SECRET_HEADER = "X-Support-Notify-Secret";
const SLACK_REQUEST_TIMEOUT_MS = 8_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type TopConsumptionReason = {
  readonly reason: string;
  readonly amount: number;
};

type DailyOpsMetrics = {
  readonly moveIns: number | null;
  readonly generationSuccess: number | null;
  readonly generationFailure: number | null;
  readonly newSignups: number | null;
  readonly paymentCount: number | null;
  readonly paymentCredits: number | null;
  readonly dayPassCount: number | null;
  readonly consumptionTotal: number | null;
  readonly topConsumptionReasons: readonly TopConsumptionReason[] | null;
  readonly chatTurns: number | null;
  readonly feedbackCount: number | null;
};

type ReportWindow = {
  readonly startIso: string;
  readonly endIso: string;
  readonly dateLabel: string;
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

// Mirrors support-feedback-notify/index.ts's constantTimeEqual exactly (in
// turn mirroring revenuecat-credit-webhook/index.ts) -- same XOR-accumulate
// idiom over both byte lengths, so a mismatch never short-circuits early.
const constantTimeEqual = (left: string, right: string): boolean => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let mismatch = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
};

// "어제" (yesterday), KST, computed with a fixed UTC+9 offset -- no timezone
// database/Intl lookups, per this project's design decision (KST never
// observes DST, so a fixed offset is always correct). `now` is the instant
// the function was invoked (00:00 UTC when triggered by the cron schedule,
// i.e. 09:00 KST) -- the reported window is always "the KST calendar day
// that just ended", regardless of exactly when within that 09:00 KST minute
// the request actually lands.
const computeYesterdayKstWindow = (now: Date): ReportWindow => {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstTodayStartWall = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  const kstYesterdayStartWall = kstTodayStartWall - DAY_MS;

  // kstYesterdayStartWall's UTC-getters below read back the intended KST
  // calendar date/weekday directly (it was built from KST wall-clock
  // fields), even though the Date instance itself represents a different
  // real instant.
  const weekday = KOREAN_WEEKDAYS[new Date(kstYesterdayStartWall).getUTCDay()];
  const month = new Date(kstYesterdayStartWall).getUTCMonth() + 1;
  const day = new Date(kstYesterdayStartWall).getUTCDate();

  return {
    startIso: new Date(kstYesterdayStartWall - KST_OFFSET_MS).toISOString(),
    endIso: new Date(kstTodayStartWall - KST_OFFSET_MS).toISOString(),
    dateLabel: `${month}/${day} (${weekday})`
  };
};

const logQueryFailure = (metric: string, detail: unknown): void => {
  console.error(`[daily-ops-report] ${metric} failed:`, detail);
};

// "신규 입주": generation_jobs that finished as a from-photo (not expression
// pack) generation yesterday. original_photo_path IS NOT NULL is the exact
// column/condition 0005_pet_namespace.sql's reserve_pet_generation_slot
// already uses to mean "brought a new pet to life" -- there is no
// job_type column in this schema. completed_at is reliable here: it is set
// exactly once, at the moment a job's status finally becomes 'completed'
// (see 0013_generation_job_durability.sql's complete_generation_job /
// finalize_generation_source_cleanup), and never for a job that ends
// 'failed'.
const countMoveIns = async (admin: SupabaseClient, window: ReportWindow): Promise<number | null> => {
  try {
    const { count, error } = await admin
      .from("generation_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .not("original_photo_path", "is", null)
      .gte("completed_at", window.startIso)
      .lt("completed_at", window.endIso);

    if (error) {
      logQueryFailure("countMoveIns", error.message);
      return null;
    }

    return count ?? 0;
  } catch (error) {
    logQueryFailure("countMoveIns", error);
    return null;
  }
};

// "생성 성공": every generation_jobs row (from-photo or expression pack
// alike) that reached 'completed' yesterday.
const countGenerationSuccess = async (admin: SupabaseClient, window: ReportWindow): Promise<number | null> => {
  try {
    const { count, error } = await admin
      .from("generation_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", window.startIso)
      .lt("completed_at", window.endIso);

    if (error) {
      logQueryFailure("countGenerationSuccess", error.message);
      return null;
    }

    return count ?? 0;
  } catch (error) {
    logQueryFailure("countGenerationSuccess", error);
    return null;
  }
};

// "생성 실패": completed_at is never set on the failure path (see
// countMoveIns' doc comment), so failures are bucketed by updated_at
// instead -- reliably bumped at the exact moment a job's status finally
// becomes 'failed', whether directly (non-photo jobs) or via
// finalize_generation_source_cleanup (photo jobs, after 'cleanup_pending').
const countGenerationFailure = async (admin: SupabaseClient, window: ReportWindow): Promise<number | null> => {
  try {
    const { count, error } = await admin
      .from("generation_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("updated_at", window.startIso)
      .lt("updated_at", window.endIso);

    if (error) {
      logQueryFailure("countGenerationFailure", error.message);
      return null;
    }

    return count ?? 0;
  } catch (error) {
    logQueryFailure("countGenerationFailure", error);
    return null;
  }
};

// "신규가입": auth.users is not a public-schema/PostgREST-exposed table, so
// this goes through the count_new_auth_users RPC added in
// 0029_daily_ops_report_schedule.sql (service_role-only).
const countNewSignups = async (admin: SupabaseClient, window: ReportWindow): Promise<number | null> => {
  try {
    const { data, error } = await admin.rpc("count_new_auth_users", {
      p_start: window.startIso,
      p_end: window.endIso
    });

    if (error) {
      logQueryFailure("countNewSignups", error.message);
      return null;
    }

    return typeof data === "number" ? data : null;
  } catch (error) {
    logQueryFailure("countNewSignups", error);
    return null;
  }
};

// "채팅 N턴": conversation_messages rows sent BY the user yesterday (not
// pet_ai replies or system messages).
const countChatTurns = async (admin: SupabaseClient, window: ReportWindow): Promise<number | null> => {
  try {
    const { count, error } = await admin
      .from("conversation_messages")
      .select("*", { count: "exact", head: true })
      .eq("sender", "user")
      .gte("created_at", window.startIso)
      .lt("created_at", window.endIso);

    if (error) {
      logQueryFailure("countChatTurns", error.message);
      return null;
    }

    return count ?? 0;
  } catch (error) {
    logQueryFailure("countChatTurns", error);
    return null;
  }
};

// "피드백 N건": total support_feedback submissions yesterday, across every
// category (generation_issue/feedback/support) -- the Slack template has no
// per-category slot, only a total.
const countFeedback = async (admin: SupabaseClient, window: ReportWindow): Promise<number | null> => {
  try {
    const { count, error } = await admin
      .from("support_feedback")
      .select("*", { count: "exact", head: true })
      .gte("created_at", window.startIso)
      .lt("created_at", window.endIso);

    if (error) {
      logQueryFailure("countFeedback", error.message);
      return null;
    }

    return count ?? 0;
  } catch (error) {
    logQueryFailure("countFeedback", error);
    return null;
  }
};

type CreditLedgerSummaryRow = {
  readonly payment_count: number;
  readonly payment_credits: number;
  readonly day_pass_count: number;
  readonly consumption_total: number;
  readonly top_consumption_reasons: readonly TopConsumptionReason[];
};

const isCreditLedgerSummaryRow = (value: unknown): value is CreditLedgerSummaryRow =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).payment_count === "number" &&
  typeof (value as Record<string, unknown>).payment_credits === "number" &&
  typeof (value as Record<string, unknown>).day_pass_count === "number" &&
  typeof (value as Record<string, unknown>).consumption_total === "number" &&
  Array.isArray((value as Record<string, unknown>).top_consumption_reasons);

// "결제" / "데이패스" / "크레딧 소비": one RPC call
// (daily_ops_credit_ledger_summary, added in
// 0029_daily_ops_report_schedule.sql) bundling all three credit_ledger-
// derived data points -- they share one table and one created_at-range
// scan, so a single try/catch here covers all of them together (a failure
// blanks all three as "?", not each individually, since they are one data
// source).
const fetchCreditLedgerSummary = async (
  admin: SupabaseClient,
  window: ReportWindow
): Promise<CreditLedgerSummaryRow | null> => {
  try {
    const { data, error } = await admin.rpc("daily_ops_credit_ledger_summary", {
      p_start: window.startIso,
      p_end: window.endIso
    });

    if (error) {
      logQueryFailure("fetchCreditLedgerSummary", error.message);
      return null;
    }

    return isCreditLedgerSummaryRow(data) ? data : null;
  } catch (error) {
    logQueryFailure("fetchCreditLedgerSummary", error);
    return null;
  }
};

const gatherMetrics = async (admin: SupabaseClient, window: ReportWindow): Promise<DailyOpsMetrics> => {
  const [moveIns, generationSuccess, generationFailure, newSignups, chatTurns, feedbackCount, creditLedgerSummary] =
    await Promise.all([
      countMoveIns(admin, window),
      countGenerationSuccess(admin, window),
      countGenerationFailure(admin, window),
      countNewSignups(admin, window),
      countChatTurns(admin, window),
      countFeedback(admin, window),
      fetchCreditLedgerSummary(admin, window)
    ]);

  return {
    moveIns,
    generationSuccess,
    generationFailure,
    newSignups,
    paymentCount: creditLedgerSummary?.payment_count ?? null,
    paymentCredits: creditLedgerSummary?.payment_credits ?? null,
    dayPassCount: creditLedgerSummary?.day_pass_count ?? null,
    consumptionTotal: creditLedgerSummary?.consumption_total ?? null,
    topConsumptionReasons: creditLedgerSummary?.top_consumption_reasons ?? null,
    chatTurns,
    feedbackCount
  };
};

// Renders a metric as its value, or "?" when that metric's query failed --
// never throws, never omits the line (a missing number is always visible as
// "?", not silently dropped).
const fmt = (value: number | null): string => (value === null ? "?" : String(value));

const buildSlackText = (window: ReportWindow, metrics: DailyOpsMetrics): string => {
  const lines = [
    `🌱 [Mongchi] ${window.dateLabel} 일일 리포트`,
    `입주 ${fmt(metrics.moveIns)} · 생성 ✓${fmt(metrics.generationSuccess)} ✗${fmt(metrics.generationFailure)} · 신규가입 ${fmt(metrics.newSignups)}`,
    `결제 ${fmt(metrics.paymentCount)}건 (+${fmt(metrics.paymentCredits)}cr) · 데이패스 ${fmt(metrics.dayPassCount)} · 크레딧 소비 ${fmt(metrics.consumptionTotal)}`,
    `채팅 ${fmt(metrics.chatTurns)}턴 · 피드백 ${fmt(metrics.feedbackCount)}건`
  ];

  // Additive beyond the core 4-line template: surfaces the top-2 credit
  // consumption reasons the design also asked this report to compute.
  // Omitted entirely on a day with zero credit consumption (nothing to
  // report) or if the summary RPC failed (topConsumptionReasons is null,
  // already reflected as "?" on the line above -- no point repeating that).
  if (metrics.topConsumptionReasons && metrics.topConsumptionReasons.length > 0) {
    const topLine = metrics.topConsumptionReasons.map((entry) => `${entry.reason} ${entry.amount}`).join(" · ");
    lines.push(`소비 상위: ${topLine}`);
  }

  return lines.join("\n");
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const notifySecret = Deno.env.get("SUPPORT_NOTIFY_SECRET");

  if (!notifySecret) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const receivedSecret = req.headers.get(SUPPORT_NOTIFY_SECRET_HEADER) ?? "";

  if (!constantTimeEqual(receivedSecret, notifySecret)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const slackWebhookUrl = Deno.env.get("SLACK_SUPPORT_WEBHOOK_URL");

  if (!slackWebhookUrl) {
    // Env-gated no-op -- see this file's module doc comment. Returns before
    // touching the database at all: there is no point aggregating a report
    // nothing will ever read.
    return jsonResponse({ ok: true, ignored: "slack_not_configured" }, 200);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const window = computeYesterdayKstWindow(new Date());
  const metrics = await gatherMetrics(admin, window);
  const text = buildSlackText(window, metrics);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SLACK_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });

    if (!response.ok) return jsonResponse({ ok: false, error: "slack_request_failed" }, 502);

    return jsonResponse({ ok: true }, 200);
  } catch {
    // Network failure or timeout (AbortError).
    return jsonResponse({ ok: false, error: "slack_request_failed" }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
