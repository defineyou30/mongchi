BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_user_credit_ref_unique_idx
  ON public.generation_jobs(user_id, credit_ref)
  WHERE credit_ref IS NOT NULL;

REVOKE EXECUTE ON FUNCTION public.consume_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_generation_quota(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_generation_quota(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_generation_rate_limit(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_pet_slot(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_pet_generation_slot(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_pet_generation_slot(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_generation_quota(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_generation_quota(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_generation_rate_limit(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_pet_slot(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_pet_generation_slot(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_pet_generation_slot(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'get_credit_balance: forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE((SELECT balance FROM public.credit_wallets WHERE user_id = p_user), 0)
    INTO v_balance;

  RETURN v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_credit_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(UUID) TO authenticated, service_role;

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
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  SELECT count(*) INTO v_count
  FROM public.generation_rate_limits
  WHERE user_id = p_user
    AND created_at >= v_window_start;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.generation_rate_limits (user_id)
  VALUES (p_user);

  IF random() < 0.05 THEN
    DELETE FROM public.generation_rate_limits
    WHERE created_at < now() - interval '1 hour';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_generation_rate_limit(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_generation_rate_limit(UUID, INTEGER, INTEGER) TO service_role;

COMMIT;
