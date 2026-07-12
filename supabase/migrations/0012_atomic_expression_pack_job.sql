BEGIN;

CREATE OR REPLACE FUNCTION public.create_expression_pack_job(
  p_user UUID,
  p_cost INTEGER,
  p_request_id TEXT,
  p_input_snapshot JSONB,
  p_source_asset_path TEXT,
  p_required_states TEXT[],
  p_pet_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  outcome TEXT,
  job_id UUID,
  balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_job public.generation_jobs%ROWTYPE;
  v_balance INTEGER;
  v_existing_debit INTEGER;
  v_refunded BOOLEAN;
  v_job_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_expression_pack_job: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_cost <= 0 OR p_request_id IS NULL OR btrim(p_request_id) = ''
    OR p_source_asset_path IS NULL OR btrim(p_source_asset_path) = ''
    OR cardinality(p_required_states) = 0 THEN
    RAISE EXCEPTION 'create_expression_pack_job: invalid input' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user::text || ':' || p_request_id));

  SELECT * INTO v_existing_job
  FROM public.generation_jobs
  WHERE user_id = p_user AND credit_ref = p_request_id;

  IF FOUND THEN
    IF v_existing_job.source_asset_path IS NOT DISTINCT FROM p_source_asset_path
      AND v_existing_job.pet_id IS NOT DISTINCT FROM p_pet_id
      AND v_existing_job.required_states = p_required_states THEN
      SELECT COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0)
        INTO v_balance;
      RETURN QUERY SELECT 'existing'::TEXT, v_existing_job.id, v_balance;
    ELSE
      RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID, NULL::INTEGER;
    END IF;
    RETURN;
  END IF;

  SELECT cl.balance_after INTO v_existing_debit
  FROM public.credit_ledger cl
  WHERE cl.user_id = p_user
    AND cl.reason = 'consume_expression_pack'
    AND cl.ref_type = 'credit_request'
    AND cl.ref_id = p_request_id;

  SELECT EXISTS (
    SELECT 1 FROM public.credit_ledger cl
    WHERE cl.user_id = p_user
      AND cl.reason = 'refund_generation'
      AND cl.ref_type = 'credit_request'
      AND cl.ref_id = p_request_id
  ) INTO v_refunded;

  IF v_existing_debit IS NOT NULL AND v_refunded THEN
    RETURN QUERY SELECT 'refunded_request'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  INSERT INTO public.credit_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT cw.balance INTO v_balance
  FROM public.credit_wallets cw
  WHERE cw.user_id = p_user
  FOR UPDATE;

  IF v_existing_debit IS NULL THEN
    IF v_balance < p_cost THEN
      RETURN QUERY SELECT 'insufficient_credits'::TEXT, NULL::UUID, v_balance;
      RETURN;
    END IF;

    v_balance := v_balance - p_cost;
    UPDATE public.credit_wallets
      SET balance = v_balance, updated_at = now()
      WHERE user_id = p_user;

    INSERT INTO public.credit_ledger (
      user_id, delta, balance_after, reason, ref_type, ref_id
    ) VALUES (
      p_user, -p_cost, v_balance, 'consume_expression_pack', 'credit_request', p_request_id
    );
  END IF;

  INSERT INTO public.generation_jobs (
    user_id,
    status,
    input_snapshot,
    original_photo_path,
    source_asset_path,
    required_states,
    credit_ref,
    pet_id
  ) VALUES (
    p_user,
    'created',
    p_input_snapshot,
    NULL,
    p_source_asset_path,
    p_required_states,
    p_request_id,
    p_pet_id
  )
  RETURNING id INTO v_job_id;

  RETURN QUERY SELECT 'created'::TEXT, v_job_id, v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_expression_pack_job(UUID, INTEGER, TEXT, JSONB, TEXT, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_expression_pack_job(UUID, INTEGER, TEXT, JSONB, TEXT, TEXT[], TEXT) TO service_role;

COMMIT;
