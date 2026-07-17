-- Daily ops report storage summary: adds a "용량" (capacity) line to the
-- daily Slack report -- current database size (pg_database_size) and total
-- Supabase Storage usage (sum of storage.objects.metadata->>'size' across
-- every bucket), bundled as a single JSONB payload.
--
-- Companion to supabase/functions/daily-ops-report/index.ts's
-- fetchStorageSummary, which calls this RPC and renders the result as the
-- final line of the Slack message. Both numbers are current-instant totals,
-- not yesterday-scoped like every other metric this report emits -- unlike
-- 0029_daily_ops_report_schedule.sql's two RPCs, there is no
-- p_start/p_end window here.
--
-- SECURITY DEFINER, service_role-only (REVOKE/GRANT below), mirroring
-- 0029's daily_ops_credit_ledger_summary RPC idiom exactly: LANGUAGE
-- plpgsql, STABLE, SET search_path = public, pg_temp, and one JSONB payload
-- bundling both numbers so a single try/catch in the Edge Function blanks
-- both as "?" together on failure (same reasoning as that RPC's own header
-- comment -- one data source, one failure mode). Wrapping in
-- SECURITY DEFINER also sidesteps needing to grant service_role any extra
-- catalog-read privilege beyond what it already has for calling this
-- function: pg_database_size() and storage.objects both stay readable
-- through the function owner's (the migration role's) existing access,
-- regardless of what service_role itself is separately granted.
BEGIN;

CREATE OR REPLACE FUNCTION public.daily_ops_storage_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_db_bytes BIGINT;
  v_storage_bytes BIGINT;
BEGIN
  SELECT pg_database_size(current_database())
  INTO v_db_bytes;

  SELECT COALESCE(sum((metadata->>'size')::BIGINT), 0)
  INTO v_storage_bytes
  FROM storage.objects;

  RETURN jsonb_build_object(
    'db_bytes', v_db_bytes,
    'storage_bytes', v_storage_bytes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.daily_ops_storage_summary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_ops_storage_summary()
  TO service_role;

COMMIT;
