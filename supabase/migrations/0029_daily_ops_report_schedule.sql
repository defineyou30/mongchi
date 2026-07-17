-- Daily ops report: schedules a once-a-day Slack summary of the previous
-- KST calendar day's activity (new pets, generation success/failure, new
-- signups, payments, day passes, credit consumption, chat turns, feedback).
--
-- Companion to supabase/functions/daily-ops-report/index.ts, which does all
-- the actual aggregation (via its service_role client, one independent
-- try/catch per data source so a single failing query never blanks out the
-- rest of the report) and Slack formatting. This migration only adds:
--
--   1. Two read-only SECURITY DEFINER RPCs the Edge Function calls for the
--      two data sources it cannot reach through a plain PostgREST
--      `.from(table)` query:
--        - count_new_auth_users: auth.users is not a `public`-schema table
--          PostgREST exposes, so counting new signups needs a function that
--          can read it directly (the same well-established pattern as this
--          project's own auth-schema triggers, e.g.
--          0016_credit_store_foundation.sql's grant_starter_credits_on_
--          generation_completion, and the standard Supabase
--          handle_new_user()-style idiom generally).
--        - daily_ops_credit_ledger_summary: bundles the payment / day-pass /
--          credit-consumption numbers, which all need SUM(delta) aggregates
--          that are safer computed in one SQL pass than relied on via
--          PostgREST's optional (and not guaranteed-enabled on every
--          project) aggregate-select syntax.
--      generation_jobs/conversation_messages/support_feedback counts are
--      plain public-schema tables the service_role client already queries
--      directly elsewhere in this project (see delete-account/index.ts's
--      countRowsForUser), so they need no new RPC.
--
--   2. invoke_daily_ops_report(): a thin SECURITY DEFINER wrapper, mirroring
--      0028_support_feedback_notify.sql's notify_support_feedback() almost
--      exactly (same pg_net call shape, same hardcoded-URL/vault-secret
--      split, same BEGIN/EXCEPTION WHEN OTHERS -> NULL swallow so a Slack or
--      network hiccup can never propagate into the caller), except it is
--      invoked by a pg_cron schedule instead of an AFTER INSERT trigger, so
--      it carries no NEW row and posts an empty JSON body -- the Edge
--      Function computes "yesterday" itself from its own current time (UTC+9
--      fixed offset), not from anything passed in the request.
--
--      Reuses the *same* Vault secret (`support_notify_secret`) and Edge
--      Function header (`X-Support-Notify-Secret`) as support-feedback-
--      notify, per design: this is the same operational secret, shared
--      across both internal notification functions, not a new one an
--      operator has to separately provision.
--
--   3. The pg_cron schedule itself, registering invoke_daily_ops_report() to
--      run at '0 0 * * *' (00:00 UTC = 09:00 KST) daily.
--
-- ⚠️ pg_cron confirmed NOT installed on production as of this migration (see
-- 0027_generation_ip_throttle.sql's identical caveat) -- the schedule
-- registration below is guarded exactly like 0018_chat_day_pass.sql's and
-- 0027's: skip with a NOTICE, never fail the migration, if the pg_cron
-- extension is missing. The function definitions above it (both RPCs and
-- invoke_daily_ops_report) are created unconditionally either way, so once
-- pg_cron is enabled in this project, registering the schedule needs no
-- migration re-run -- just the one-line command in the comment above the
-- guarded block below.
--
-- Indexes: generation_jobs and credit_ledger currently only have
-- (user_id, created_at) / (user_id, created_at) composite indexes. This
-- report's queries filter by completed_at/updated_at/created_at alone (no
-- user_id), which would otherwise force a sequential scan on every run.
-- Three narrow, purpose-matched indexes are added below (partial where the
-- report's own filters make that possible), mirroring
-- 0006_conversations.sql's conversation_messages_created_idx, added for
-- exactly the same "date-range scan with no user_id" reason.

BEGIN;

-- ---------------------------------------------------------------------------
-- Supporting indexes
-- ---------------------------------------------------------------------------

-- Backs both the "신규 입주" (completed_at + original_photo_path IS NOT NULL)
-- and "생성 성공" (completed_at alone) queries below. Partial or not: the
-- generation success count doesn't filter on original_photo_path, so this
-- can't be narrowed further than "completed_at IS NOT NULL" -- see
-- 0013_generation_job_durability.sql's complete_generation_job /
-- finalize_generation_source_cleanup for why completed_at is reliably set
-- exactly once, at final completion, for every job that ever reaches
-- 'completed' (and never set for a job that ends 'failed').
CREATE INDEX IF NOT EXISTS generation_jobs_completed_at_idx
  ON public.generation_jobs(completed_at)
  WHERE completed_at IS NOT NULL;

-- Backs "생성 실패": completed_at is never set on the failure path (see
-- comment above), so failures are counted by updated_at instead -- which is
-- reliably bumped at the exact moment a job's status finally becomes
-- 'failed' (both directly in fail_generation_job for non-photo jobs, and via
-- finalize_generation_source_cleanup for photo jobs that first pass through
-- 'cleanup_pending'). Partial on status = 'failed' so this index stays small
-- and untouched by the much higher-churn in-flight status updates.
CREATE INDEX IF NOT EXISTS generation_jobs_failed_updated_at_idx
  ON public.generation_jobs(updated_at)
  WHERE status = 'failed';

-- Backs every credit_ledger query in daily_ops_credit_ledger_summary below
-- (payments, day passes, credit consumption) -- all are plain
-- created_at-range scans with no user_id filter, unlike every existing
-- credit_ledger query in this project so far.
CREATE INDEX IF NOT EXISTS credit_ledger_created_idx
  ON public.credit_ledger(created_at);

-- ---------------------------------------------------------------------------
-- RPC: count_new_auth_users
--
-- service_role-only (see REVOKE/GRANT below), read-only, STABLE. Mirrors
-- get_credit_balance's LANGUAGE sql STABLE SECURITY DEFINER shape
-- (0004_credit_ledger.sql) -- a single-statement read needs nothing heavier
-- than plpgsql would offer. auth.users has no RLS policy of its own that
-- would matter here: this function runs as its owner (the migration role),
-- which already has the same auth-schema read access every existing
-- auth-schema trigger in this project relies on (e.g. grant_starter_credits_
-- on_generation_completion in 0016_credit_store_foundation.sql).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.count_new_auth_users(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::INTEGER
  FROM auth.users
  WHERE created_at >= p_start AND created_at < p_end;
$$;

REVOKE EXECUTE ON FUNCTION public.count_new_auth_users(TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_new_auth_users(TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: daily_ops_credit_ledger_summary
--
-- service_role-only, read-only, STABLE. Bundles every credit_ledger-derived
-- number the report needs into one JSONB payload -- 결제 (grant_purchase /
-- iap_transaction count + credited amount), 데이 패스 (consume_chat_day_pass
-- count -- reason string confirmed against 0018_chat_day_pass.sql /
-- 0020_chat_day_pass_price_increase.sql's purchase_chat_day_pass RPC; note
-- this is NOT 'iap_credit_pack' -- that reason string does not exist
-- anywhere in this schema, purchased credit packs post as 'grant_purchase'
-- via revenuecat-credit-webhook/index.ts), and 크레딧 소비 (sum of every
-- negative-delta row regardless of reason, plus its top 2 reasons by amount
-- -- deliberately not reason-filtered beyond delta < 0, since "total credits
-- spent yesterday" is meant to include consume_chat_day_pass alongside
-- consume_premium_chat/consume_shop_item/etc., not exclude it).
--
-- All three sub-aggregates are independent SELECT ... INTO statements rather
-- than one combined query, so a NULL-producing edge case in one (e.g. no
-- matching rows -- COALESCE'd to 0 below) can never affect another.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.daily_ops_credit_ledger_summary(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_count INTEGER;
  v_payment_credits INTEGER;
  v_day_pass_count INTEGER;
  v_consumption_total INTEGER;
  v_top_reasons JSONB;
BEGIN
  SELECT count(*), COALESCE(sum(delta), 0)
  INTO v_payment_count, v_payment_credits
  FROM public.credit_ledger
  WHERE reason = 'grant_purchase'
    AND ref_type = 'iap_transaction'
    AND created_at >= p_start AND created_at < p_end;

  SELECT count(*)
  INTO v_day_pass_count
  FROM public.credit_ledger
  WHERE reason = 'consume_chat_day_pass'
    AND created_at >= p_start AND created_at < p_end;

  SELECT COALESCE(sum(-delta), 0)
  INTO v_consumption_total
  FROM public.credit_ledger
  WHERE delta < 0
    AND created_at >= p_start AND created_at < p_end;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', top.reason, 'amount', top.amount)), '[]'::jsonb)
  INTO v_top_reasons
  FROM (
    SELECT reason, sum(-delta) AS amount
    FROM public.credit_ledger
    WHERE delta < 0
      AND created_at >= p_start AND created_at < p_end
    GROUP BY reason
    ORDER BY sum(-delta) DESC
    LIMIT 2
  ) top;

  RETURN jsonb_build_object(
    'payment_count', v_payment_count,
    'payment_credits', v_payment_credits,
    'day_pass_count', v_day_pass_count,
    'consumption_total', v_consumption_total,
    'top_consumption_reasons', v_top_reasons
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.daily_ops_credit_ledger_summary(TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_ops_credit_ledger_summary(TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

-- ---------------------------------------------------------------------------
-- invoke_daily_ops_report(): pg_cron -> Edge Function bridge.
--
-- Mirrors 0028_support_feedback_notify.sql's notify_support_feedback()
-- almost exactly: SECURITY DEFINER, pinned search_path, the entire
-- net.http_post call wrapped in its own BEGIN/EXCEPTION WHEN OTHERS -> NULL
-- so a pg_net hiccup (or pg_net simply not being installed -- calling a
-- nonexistent net.http_post raises undefined_function, which this same
-- handler swallows) can never fail the caller. Differences from
-- notify_support_feedback: this is invoked by a pg_cron schedule, not an
-- AFTER INSERT trigger, so there is no NEW row to read -- the request body
-- is an empty JSON object, since the Edge Function determines "yesterday"
-- from its own clock (fixed UTC+9 offset), not from anything posted here.
--
-- Secret handoff is identical to 0028's: the Edge Function URL is a
-- non-secret, project-pinned constant; the X-Support-Notify-Secret header
-- value comes from the SAME Supabase Vault entry
-- (`support_notify_secret`) support-feedback-notify already reads --
-- deliberately reused, not a second secret an operator has to separately
-- provision (see this migration's header comment).
--
-- No REVOKE/GRANT here, matching notify_support_feedback's precedent exactly
-- -- this function only ever fires a POST to this project's own Edge
-- Function endpoint (itself secret-gated), so a client invoking it directly
-- can at most trigger a duplicate report send, not read or write any data.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invoke_daily_ops_report()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://cxusiexdwgpfcpirefro.supabase.co/functions/v1/daily-ops-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Support-Notify-Secret', COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'support_notify_secret' LIMIT 1),
          ''
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let a report-send failure raise out of the cron job -- see this
    -- function's doc comment.
    NULL;
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- Schedule: daily_ops_report_send
--
-- '0 0 * * *' = 00:00 UTC = 09:00 KST daily, matching the design's "매일
-- 09:00 KST" requirement via a fixed UTC+9 offset (pg_cron itself always
-- runs in UTC).
--
-- ⚠️ pg_cron confirmed NOT installed on production as of this migration --
-- guarded exactly like 0018_chat_day_pass.sql / 0027_generation_ip_
-- throttle.sql: skip with a NOTICE, never fail the migration, if missing.
--
-- Deliberately separated from invoke_daily_ops_report()'s definition above
-- (created unconditionally) so that once pg_cron is enabled on this project,
-- no migration re-run is needed -- just run once, out of band:
--
--   SELECT cron.schedule('daily_ops_report_send', '0 0 * * *', $$SELECT public.invoke_daily_ops_report();$$);
--
-- cron.schedule(job_name, schedule, command) upserts by job_name (pg_cron
-- >= 1.4), matching 0018's own note on this -- so this block is itself safe
-- to re-run.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily_ops_report_send',
      '0 0 * * *',
      $cron$SELECT public.invoke_daily_ops_report();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed -- skipping daily_ops_report_send schedule (0029_daily_ops_report_schedule.sql). Schedule it manually once pg_cron is available -- see this migration''s header comment above the DO block for the exact command.';
  END IF;
END;
$$;

COMMIT;
