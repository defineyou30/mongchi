-- Mongchi Supabase backend: generation rate limiting.
--
-- Scope: a generation_rate_limits event-log table (one row per
-- generate-avatar attempt) plus a check_generation_rate_limit RPC that the
-- generate-avatar Edge Function calls immediately before consuming quota.
-- This is a short-window abuse/burst guard (e.g. 3 attempts per 5 minutes),
-- separate from and in addition to generation_quota's longer-lived
-- free/paid allowance -- quota tracks "how many you're allowed total",
-- this tracks "how fast you're allowed to burn through them".

BEGIN;

-- ---------------------------------------------------------------------------
-- generation_rate_limits
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.generation_rate_limits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_rate_limits_user_created_idx
  ON public.generation_rate_limits(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RPC: check_generation_rate_limit
--
-- Atomically checks whether p_user has made fewer than p_max attempts within
-- the trailing p_window_seconds, and if so records this attempt and returns
-- true. Returns false (without recording anything) once the window's cap is
-- already reached, so a caller who is rate-limited does not also consume a
-- slot they'll never use. SECURITY DEFINER so it can run under the caller's
-- JWT while still writing to a table with no direct insert policy for
-- authenticated users (writes only ever happen through this RPC or the
-- Edge Function's service_role key).
--
-- Housekeeping: old rows are pruned probabilistically on a small fraction of
-- calls (5%) rather than via a scheduled job, so the table doesn't grow
-- unbounded without requiring a separate cron setup. For higher-volume
-- production traffic, prefer replacing this with a scheduled `pg_cron` job
-- (e.g. `DELETE FROM generation_rate_limits WHERE created_at < now() -
-- interval '1 hour'` on an hourly schedule) instead of relying on the
-- probabilistic delete below.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_generation_rate_limit(
  p_user UUID,
  p_window_seconds INTEGER,
  p_max INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ := now() - make_interval(secs => p_window_seconds);
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.generation_rate_limits
  WHERE user_id = p_user
    AND created_at >= v_window_start;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.generation_rate_limits (user_id)
  VALUES (p_user);

  -- Probabilistic cleanup of stale rows well outside any realistic rate
  -- limit window, so the table stays small without a dedicated cron job.
  -- TODO(ops): switch to a scheduled pg_cron job for this cleanup once one
  -- is set up for the project (see comment above).
  IF random() < 0.05 THEN
    DELETE FROM public.generation_rate_limits
    WHERE created_at < now() - interval '1 hour';
  END IF;

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Read-only policy for the owning user, matching generation_jobs/
-- generated_assets/generation_quota in 0001_init.sql. All writes happen
-- through check_generation_rate_limit (SECURITY DEFINER) or the Edge
-- Function's service_role key.
-- ---------------------------------------------------------------------------

ALTER TABLE public.generation_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY generation_rate_limits_select_own
  ON public.generation_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

COMMIT;
