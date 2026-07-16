-- Reinstall-abuse backstop: IP-level daily cap on *new* generation starts.
--
-- Context: deleting and reinstalling the app creates a fresh anonymous
-- Supabase auth user, which resets every account-scoped guard this project
-- already has (generation_quota's free allowance, the starter credit grant
-- via grant_starter_credits_on_generation_completion in
-- 0026_adjust_starter_grant_to_five.sql, generation_rate_limits' burst
-- window in 0002_rate_limit.sql). None of those guards survive a reinstall
-- because they are all keyed by user_id. This migration adds one guard that
-- does survive it: a coarse, IP-scoped daily cap on how many new
-- generations can be *started*, checked as a backstop alongside (not
-- instead of) the existing per-user quota and rate limit -- a legitimate
-- household or shared network sharing one IP is expected to occasionally
-- approach it, so the cap (10/day) is deliberately generous, not a tight
-- per-request throttle.
--
-- Privacy: the raw request IP is never persisted or logged anywhere. Only a
-- SHA-256 hash of `${GENERATION_IP_SALT}:${ip}` (computed in
-- generate-avatar's Edge Function via its existing sha256Hex helper) is
-- written to generation_ip_throttle.ip_hash -- the CHECK constraint below
-- enforces the 64-hex-char shape so this table can never silently end up
-- holding a raw address even if a future edit to the Edge Function forgot
-- to hash first. GENERATION_IP_SALT is a server-only secret (Supabase Edge
-- Function env); if it is unset, the Edge Function skips this check
-- entirely (fails open) rather than either blocking every generation or
-- hashing with a predictable/empty salt.
--
-- RPC register_generation_start_for_ip is service_role-only (0007/0013-style
-- auth.role() forbidden guard + REVOKE/GRANT), mirrors
-- 0024_support_feedback.sql's advisory-lock-before-write idiom, and returns
-- a soft jsonb outcome ('ok'/'throttled') rather than raising -- same
-- soft-failure shape as 0024's rate_limited / 0025's too_large|stale,
-- since being throttled is an expected, non-alarming outcome, not a server
-- error.
--
-- Cleanup mirrors 0018_chat_day_pass.sql's guarded pg_cron schedule (skips
-- with a NOTICE, does not fail the migration, if pg_cron is not installed)
-- rather than 0002_rate_limit.sql's older probabilistic-delete-on-write
-- approach, since this project already has a live pg_cron schedule to
-- mirror.

BEGIN;

-- ---------------------------------------------------------------------------
-- generation_ip_throttle
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.generation_ip_throttle (
  ip_hash TEXT NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  day DATE NOT NULL,
  started_count INTEGER NOT NULL DEFAULT 0 CHECK (started_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, day)
);

CREATE INDEX IF NOT EXISTS generation_ip_throttle_day_idx
  ON public.generation_ip_throttle(day);

-- RLS enabled with no policies at all -- there is no user context to scope a
-- policy to (ip_hash is not tied to any auth.users row), so, same as
-- 0024_support_feedback.sql, every access must go through
-- register_generation_start_for_ip (SECURITY DEFINER, service_role-only) or
-- a direct service_role connection. No client of any kind can read or write
-- this table.
ALTER TABLE public.generation_ip_throttle ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RPC: register_generation_start_for_ip
--
-- Atomically increments today's started_count for p_ip_hash and returns
-- {"outcome":"ok","count":n} -- unless today's count is already at the daily
-- cap (10), in which case it returns {"outcome":"throttled"} without
-- incrementing further. service_role-only: called from generate-avatar's
-- Edge Function immediately before create_generation_job /
-- create_expression_pack_job, with an IP address hashed server-side (see
-- this migration's header comment) -- never callable by authenticated/anon
-- clients directly, since p_ip_hash is not scoped to the caller's own
-- identity the way every other authenticated-callable RPC in this project
-- is.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_generation_start_for_ip(
  p_ip_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE := current_date;
  v_count INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'register_generation_start_for_ip: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'register_generation_start_for_ip: invalid ip hash' USING ERRCODE = '22023';
  END IF;

  -- Serializes concurrent generation starts from the same IP around the
  -- upsert below, same reasoning as 0024_support_feedback.sql's advisory
  -- lock before its rate-limit count -- otherwise a burst of concurrent
  -- calls for the same IP could all read/write the same pre-increment row
  -- and all slip past the daily cap.
  PERFORM pg_advisory_xact_lock(hashtext('generation-ip:' || p_ip_hash));

  -- v_count is left NULL by the ON CONFLICT ... WHERE guard when today's row
  -- is already at the cap (matching 0025_session_snapshots.sql's
  -- monotonic-guard idiom: a WHERE clause that fails on conflict means the
  -- row is not updated and RETURNING produces nothing, so INTO leaves the
  -- target variable at its prior NULL rather than setting it). A brand-new
  -- day's first row always inserts cleanly (no conflict to guard), so it is
  -- never affected by the cap check below.
  INSERT INTO public.generation_ip_throttle (ip_hash, day, started_count)
  VALUES (p_ip_hash, v_today, 1)
  ON CONFLICT (ip_hash, day) DO UPDATE SET
    started_count = public.generation_ip_throttle.started_count + 1,
    updated_at = now()
  WHERE public.generation_ip_throttle.started_count < 10
  RETURNING started_count INTO v_count;

  IF v_count IS NULL THEN
    RETURN jsonb_build_object('outcome', 'throttled');
  END IF;

  RETURN jsonb_build_object('outcome', 'ok', 'count', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_generation_start_for_ip(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_generation_start_for_ip(TEXT)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Cleanup: purge_expired_generation_ip_throttle + pg_cron schedule
--
-- Rows are only ever queried by (ip_hash, day = current_date), so anything
-- more than a few days old is dead weight. Deletes rows older than 7 days --
-- comfortably past the daily cap's own 1-day window, so there is no risk of
-- purging a row a legitimate retry might still need. Mirrors
-- 0018_chat_day_pass.sql's guarded pg_cron schedule exactly: skips with a
-- NOTICE (rather than failing the migration) if pg_cron is not installed in
-- this environment.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_expired_generation_ip_throttle()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.generation_ip_throttle
  WHERE day < current_date - 7;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_generation_ip_throttle()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_generation_ip_throttle()
  TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge_expired_generation_ip_throttle_daily',
      '15 3 * * *',
      $cron$SELECT public.purge_expired_generation_ip_throttle();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed -- skipping purge_expired_generation_ip_throttle_daily schedule (0028_generation_ip_throttle.sql). Schedule it manually once pg_cron is available.';
  END IF;
END;
$$;

COMMIT;
