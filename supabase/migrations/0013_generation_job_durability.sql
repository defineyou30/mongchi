BEGIN;

DROP POLICY IF EXISTS pet_media_update_own_original_photo ON storage.objects;

CREATE POLICY pet_media_update_own_original_photo
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'pet-media'
    AND (storage.foldername(name))[1] = 'original-photos'
    AND auth.uid()::text = (storage.foldername(name))[2]
  )
  WITH CHECK (
    bucket_id = 'pet-media'
    AND (storage.foldername(name))[1] = 'original-photos'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS funding_kind TEXT,
  ADD COLUMN IF NOT EXISTS funding_ref TEXT,
  ADD COLUMN IF NOT EXISTS funding_amount INTEGER,
  ADD COLUMN IF NOT EXISTS funding_refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS product_key TEXT,
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_cleanup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_cleanup_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleanup_target_status TEXT;

ALTER TABLE public.generation_jobs
  DROP CONSTRAINT IF EXISTS generation_jobs_status_check,
  ADD CONSTRAINT generation_jobs_status_check CHECK (
    status IN (
      'created',
      'safety_checking',
      'generating',
      'quality_checking',
      'uploading_assets',
      'cleanup_pending',
      'completed',
      'failed'
    )
  ),
  DROP CONSTRAINT IF EXISTS generation_jobs_cleanup_target_status_check,
  ADD CONSTRAINT generation_jobs_cleanup_target_status_check CHECK (
    cleanup_target_status IS NULL OR cleanup_target_status IN ('completed', 'failed')
  );

ALTER TABLE public.generated_assets
  ADD COLUMN IF NOT EXISTS attempt_token UUID;

ALTER TABLE public.generation_jobs
  DROP CONSTRAINT IF EXISTS generation_jobs_funding_kind_check,
  ADD CONSTRAINT generation_jobs_funding_kind_check CHECK (
    funding_kind IS NULL OR funding_kind IN (
      'credits',
      'generation_quota_free',
      'pet_slot'
    )
  ),
  DROP CONSTRAINT IF EXISTS generation_jobs_funding_amount_check,
  ADD CONSTRAINT generation_jobs_funding_amount_check CHECK (
    funding_amount IS NULL OR funding_amount > 0
  );

UPDATE public.generation_jobs
SET request_id = credit_ref
WHERE request_id IS NULL AND credit_ref IS NOT NULL;

UPDATE public.generation_jobs
SET product_key = CASE required_states
  WHEN ARRAY['curious', 'play', 'hungry']::TEXT[] THEN 'pack-everyday-moments'
  WHEN ARRAY['treat_reaction', 'walk_return', 'chat_portrait']::TEXT[] THEN 'pack-care-reactions'
  WHEN ARRAY['celebrate', 'garden_help', 'seasonal']::TEXT[] THEN 'pack-special-days'
  WHEN ARRAY['sad', 'sick', 'messy']::TEXT[] THEN 'pack-tender-care'
  ELSE NULL
END
WHERE product_key IS NULL
  AND source_asset_path IS NOT NULL
  AND status <> 'failed';

UPDATE public.generation_jobs job
SET
  funding_kind = 'credits',
  funding_ref = job.credit_ref,
  request_id = job.credit_ref,
  funding_amount = (
    SELECT -ledger.delta
    FROM public.credit_ledger ledger
    WHERE ledger.user_id = job.user_id
      AND ledger.reason = 'consume_expression_pack'
      AND ledger.ref_type = 'credit_request'
      AND ledger.ref_id = job.credit_ref
    ORDER BY ledger.created_at DESC
    LIMIT 1
  )
WHERE job.funding_kind IS NULL
  AND job.credit_ref IS NOT NULL
  AND job.status NOT IN ('completed', 'failed')
  AND EXISTS (
    SELECT 1
    FROM public.credit_ledger ledger
    WHERE ledger.user_id = job.user_id
      AND ledger.reason = 'consume_expression_pack'
      AND ledger.ref_type = 'credit_request'
      AND ledger.ref_id = job.credit_ref
  );

DO $$
DECLARE
  v_ambiguous_jobs BIGINT;
BEGIN
  SELECT count(*) INTO v_ambiguous_jobs
  FROM public.generation_jobs job
  WHERE job.funding_kind IS NULL
    AND job.status NOT IN ('completed', 'failed');

  IF v_ambiguous_jobs > 0 THEN
    RAISE EXCEPTION
      'generation durability migration found % active jobs with ambiguous legacy funding; finish or reconcile them before retrying',
      v_ambiguous_jobs
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE public.generation_jobs
  DROP CONSTRAINT IF EXISTS generation_jobs_active_funding_check,
  ADD CONSTRAINT generation_jobs_active_funding_check CHECK (
    status IN ('completed', 'failed')
    OR (
      funding_kind IS NOT NULL
      AND funding_ref IS NOT NULL
      AND funding_amount IS NOT NULL
      AND request_id IS NOT NULL
      AND (funding_kind <> 'credits' OR product_key IS NOT NULL)
    )
  );

DO $$
DECLARE
  v_duplicate_count BIGINT;
BEGIN
  SELECT count(*) INTO v_duplicate_count
  FROM (
    SELECT job_id, state
    FROM public.generated_assets
    GROUP BY job_id, state
    HAVING count(*) > 1
  ) duplicates;

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION
      'generation durability migration found % duplicate generated asset keys; reconcile them before retrying',
      v_duplicate_count
      USING ERRCODE = '23505';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS generated_assets_job_state_idx
  ON public.generated_assets(job_id, state);

CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_user_request_idx
  ON public.generation_jobs(user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_active_product_idx
  ON public.generation_jobs(user_id, COALESCE(pet_id, ''), product_key)
  WHERE product_key IS NOT NULL AND status <> 'failed';

CREATE INDEX IF NOT EXISTS generation_jobs_reclaim_idx
  ON public.generation_jobs(status, lease_expires_at)
  WHERE status NOT IN ('completed', 'failed');

DROP FUNCTION IF EXISTS public.create_expression_pack_job(UUID, INTEGER, TEXT, JSONB, TEXT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.create_expression_pack_job(
  p_user UUID,
  p_cost INTEGER,
  p_request_id TEXT,
  p_product_key TEXT,
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
    OR p_product_key IS NULL OR btrim(p_product_key) = ''
    OR p_source_asset_path IS NULL OR btrim(p_source_asset_path) = ''
    OR cardinality(p_required_states) = 0 THEN
    RAISE EXCEPTION 'create_expression_pack_job: invalid input' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user::TEXT || ':' || COALESCE(p_pet_id, '') || ':' || p_product_key));

  SELECT * INTO v_existing_job
  FROM public.generation_jobs
  WHERE user_id = p_user
    AND pet_id IS NOT DISTINCT FROM p_pet_id
    AND product_key = p_product_key
    AND status <> 'failed';

  IF FOUND THEN
    SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = p_user), 0)
      INTO v_balance;
    RETURN QUERY SELECT 'existing'::TEXT, v_existing_job.id, v_balance;
    RETURN;
  END IF;

  SELECT * INTO v_existing_job
  FROM public.generation_jobs
  WHERE user_id = p_user AND request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_job.status = 'failed' THEN
      SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = p_user), 0)
        INTO v_balance;
      RETURN QUERY SELECT 'refunded_request'::TEXT, NULL::UUID, v_balance;
    ELSIF v_existing_job.source_asset_path IS NOT DISTINCT FROM p_source_asset_path
      AND v_existing_job.pet_id IS NOT DISTINCT FROM p_pet_id
      AND v_existing_job.required_states = p_required_states THEN
      SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = p_user), 0)
        INTO v_balance;
      RETURN QUERY SELECT 'existing'::TEXT, v_existing_job.id, v_balance;
    ELSE
      RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID, NULL::INTEGER;
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.credit_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT wallet.balance INTO v_balance
  FROM public.credit_wallets wallet
  WHERE wallet.user_id = p_user
  FOR UPDATE;

  SELECT ledger.balance_after INTO v_existing_debit
  FROM public.credit_ledger ledger
  WHERE ledger.user_id = p_user
    AND ledger.reason = 'consume_expression_pack'
    AND ledger.ref_type = 'credit_request'
    AND ledger.ref_id = p_request_id;

  SELECT EXISTS (
    SELECT 1 FROM public.credit_ledger ledger
    WHERE ledger.user_id = p_user
      AND ledger.reason = 'refund_generation'
      AND ledger.ref_type = 'credit_request'
      AND ledger.ref_id = p_request_id
  ) INTO v_refunded;

  IF v_existing_debit IS NOT NULL AND v_refunded THEN
    RETURN QUERY SELECT 'refunded_request'::TEXT, NULL::UUID, v_balance;
    RETURN;
  END IF;

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

  v_job_id := gen_random_uuid();
  INSERT INTO public.generation_jobs (
    id,
    user_id,
    status,
    input_snapshot,
    original_photo_path,
    source_asset_path,
    required_states,
    credit_ref,
    request_id,
    product_key,
    pet_id,
    funding_kind,
    funding_ref,
    funding_amount
  ) VALUES (
    v_job_id,
    p_user,
    'created',
    p_input_snapshot,
    NULL,
    p_source_asset_path,
    p_required_states,
    p_request_id,
    p_request_id,
    p_product_key,
    p_pet_id,
    'credits',
    p_request_id,
    p_cost
  );

  RETURN QUERY SELECT 'created'::TEXT, v_job_id, v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_generation_job(
  p_user UUID,
  p_request_id TEXT,
  p_input_snapshot JSONB,
  p_original_photo_path TEXT,
  p_pet_id TEXT DEFAULT NULL,
  p_required_states TEXT[] DEFAULT ARRAY['idle', 'happy', 'sleep']::TEXT[]
)
RETURNS TABLE (
  outcome TEXT,
  job_id UUID,
  stored_original_photo_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id UUID := gen_random_uuid();
  v_completed_count INTEGER;
  v_pet_already_completed BOOLEAN;
  v_extra_slots INTEGER;
  v_bundle_available BOOLEAN;
  v_free_used INTEGER;
  v_free_limit INTEGER;
  v_funding_kind TEXT;
  v_existing_job public.generation_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_generation_job: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR btrim(p_request_id) = ''
    OR p_original_photo_path IS NULL OR btrim(p_original_photo_path) = ''
    OR cardinality(p_required_states) = 0 THEN
    RAISE EXCEPTION 'create_generation_job: invalid input' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user::TEXT));

  SELECT * INTO v_existing_job
  FROM public.generation_jobs
  WHERE user_id = p_user AND request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_job.status = 'failed' THEN
      RETURN QUERY SELECT 'refunded_request'::TEXT, NULL::UUID, NULL::TEXT;
    ELSIF v_existing_job.pet_id IS NOT DISTINCT FROM p_pet_id
      AND v_existing_job.required_states = p_required_states
      AND v_existing_job.product_key IS NULL THEN
      IF v_existing_job.status = 'completed'
        AND v_existing_job.original_photo_path IS NOT DISTINCT FROM p_original_photo_path THEN
        UPDATE public.generation_jobs
        SET
          status = 'cleanup_pending',
          cleanup_target_status = 'completed',
          source_cleanup_completed_at = NULL,
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = now()
        WHERE id = v_existing_job.id;
      END IF;
      RETURN QUERY SELECT 'existing'::TEXT, v_existing_job.id, v_existing_job.original_photo_path;
    ELSE
      RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID, NULL::TEXT;
    END IF;
    RETURN;
  END IF;

  SELECT count(DISTINCT COALESCE(job.pet_id, '')) INTO v_completed_count
  FROM public.generation_jobs job
  WHERE job.user_id = p_user
    AND job.status = 'completed'
    AND job.original_photo_path IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM public.generation_jobs job
    WHERE job.user_id = p_user
      AND job.status = 'completed'
      AND job.original_photo_path IS NOT NULL
      AND job.pet_id IS NOT DISTINCT FROM p_pet_id
  ) INTO v_pet_already_completed;

  IF NOT v_pet_already_completed AND v_completed_count > 0 THEN
    INSERT INTO public.pet_slots (user_id) VALUES (p_user)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT slots.extra_slots, slots.bundled_generation_available
      INTO v_extra_slots, v_bundle_available
    FROM public.pet_slots slots
    WHERE slots.user_id = p_user
    FOR UPDATE;

    IF v_completed_count >= (1 + v_extra_slots) OR NOT v_bundle_available THEN
      RETURN QUERY SELECT 'pet_slot_required'::TEXT, NULL::UUID, NULL::TEXT;
      RETURN;
    END IF;

    UPDATE public.pet_slots
    SET bundled_generation_available = false, updated_at = now()
    WHERE user_id = p_user;
    v_funding_kind := 'pet_slot';
  ELSE
    INSERT INTO public.generation_quota (user_id) VALUES (p_user)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT quota.free_used, quota.free_limit
      INTO v_free_used, v_free_limit
    FROM public.generation_quota quota
    WHERE quota.user_id = p_user
    FOR UPDATE;

    IF v_free_used < v_free_limit THEN
      UPDATE public.generation_quota
      SET free_used = free_used + 1, updated_at = now()
      WHERE user_id = p_user;
      v_funding_kind := 'generation_quota_free';
    ELSE
      RETURN QUERY SELECT 'quota_exhausted'::TEXT, NULL::UUID, NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.generation_jobs (
    id,
    user_id,
    status,
    input_snapshot,
    required_states,
    original_photo_path,
    request_id,
    pet_id,
    funding_kind,
    funding_ref,
    funding_amount
  ) VALUES (
    v_job_id,
    p_user,
    'created',
    p_input_snapshot,
    p_required_states,
    p_original_photo_path,
    p_request_id,
    p_pet_id,
    v_funding_kind,
    v_job_id::TEXT,
    1
  );

  RETURN QUERY SELECT 'created'::TEXT, v_job_id, p_original_photo_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_generation_job(
  p_user UUID,
  p_job_id UUID,
  p_lease_seconds INTEGER DEFAULT 420,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS TABLE (
  job_id UUID,
  user_id UUID,
  status TEXT,
  input_snapshot JSONB,
  required_states TEXT[],
  original_photo_path TEXT,
  source_asset_path TEXT,
  credit_ref TEXT,
  pet_id TEXT,
  lease_token UUID,
  attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'claim_generation_job: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_lease_seconds < 30 OR p_lease_seconds > 900 OR p_max_attempts < 1 OR p_max_attempts > 5 THEN
    RAISE EXCEPTION 'claim_generation_job: invalid lease' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.generation_jobs job
  SET
    status = CASE WHEN job.status = 'cleanup_pending' THEN 'cleanup_pending' ELSE 'created' END,
    lease_token = gen_random_uuid(),
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = CASE
      WHEN job.status = 'cleanup_pending' THEN job.attempt_count
      WHEN job.attempt_count <= p_max_attempts THEN job.attempt_count + 1
      ELSE job.attempt_count
    END,
    source_cleanup_attempt_count = job.source_cleanup_attempt_count + CASE WHEN job.status = 'cleanup_pending' THEN 1 ELSE 0 END,
    failure_code = NULL,
    failure_message_safe = NULL,
    updated_at = now()
  WHERE job.id = p_job_id
    AND job.user_id = p_user
    AND (
      (job.status = 'created' AND (job.lease_expires_at IS NULL OR job.lease_expires_at < now()))
      OR (
        job.status IN ('safety_checking', 'generating', 'quality_checking', 'uploading_assets')
        AND (job.lease_expires_at IS NULL OR job.lease_expires_at < now())
      )
      OR (job.status = 'cleanup_pending' AND (job.lease_expires_at IS NULL OR job.lease_expires_at < now()))
    )
  RETURNING
    job.id,
    job.user_id,
    job.status,
    job.input_snapshot,
    job.required_states,
    job.original_photo_path,
    job.source_asset_path,
    job.credit_ref,
    job.pet_id,
    job.lease_token,
    job.attempt_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_generation_job(
  p_job_id UUID,
  p_lease_token UUID,
  p_status TEXT,
  p_quality JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'advance_generation_job: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('safety_checking', 'generating', 'quality_checking', 'uploading_assets') THEN
    RAISE EXCEPTION 'advance_generation_job: invalid status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.generation_jobs
  SET
    status = p_status,
    quality = COALESCE(p_quality, quality),
    lease_expires_at = now() + interval '420 seconds',
    updated_at = now()
  WHERE id = p_job_id
    AND lease_token = p_lease_token
    AND lease_expires_at > now()
    AND status NOT IN ('completed', 'failed');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_generation_job(
  p_job_id UUID,
  p_lease_token UUID,
  p_quality JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'complete_generation_job: forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_job
  FROM public.generation_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_job.status IN ('completed', 'failed')
    OR v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at <= now()
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT required.state
    FROM unnest(v_job.required_states) AS required(state)
    EXCEPT
    SELECT asset.state
    FROM public.generated_assets asset
    WHERE asset.job_id = p_job_id
      AND asset.attempt_token = p_lease_token
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.generation_jobs
  SET
    status = CASE WHEN v_job.original_photo_path IS NULL THEN 'completed' ELSE 'cleanup_pending' END,
    completed_at = CASE WHEN v_job.original_photo_path IS NULL THEN now() ELSE NULL END,
    cleanup_target_status = CASE WHEN v_job.original_photo_path IS NULL THEN NULL ELSE 'completed' END,
    quality = p_quality,
    lease_token = CASE WHEN v_job.original_photo_path IS NULL THEN NULL ELSE lease_token END,
    lease_expires_at = CASE WHEN v_job.original_photo_path IS NULL THEN NULL ELSE now() + interval '420 seconds' END,
    updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_generation_asset(
  p_job_id UUID,
  p_lease_token UUID,
  p_state TEXT,
  p_storage_path TEXT,
  p_width INTEGER,
  p_height INTEGER,
  p_content_hash TEXT,
  p_unlocked_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'record_generation_asset: forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_job
  FROM public.generation_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_job.status <> 'uploading_assets'
    OR v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at <= now()
  THEN
    RETURN false;
  END IF;

  INSERT INTO public.generated_assets (
    job_id,
    user_id,
    pet_id,
    state,
    storage_path,
    width,
    height,
    content_hash,
    unlocked_at,
    attempt_token
  ) VALUES (
    v_job.id,
    v_job.user_id,
    v_job.pet_id,
    p_state,
    p_storage_path,
    p_width,
    p_height,
    p_content_hash,
    p_unlocked_at,
    p_lease_token
  )
  ON CONFLICT (job_id, state) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    content_hash = EXCLUDED.content_hash,
    unlocked_at = EXCLUDED.unlocked_at,
    attempt_token = EXCLUDED.attempt_token;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_generation_source_cleanup(
  p_job_id UUID,
  p_lease_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
  v_updated INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'finalize_generation_source_cleanup: forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_job
  FROM public.generation_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_job.status <> 'cleanup_pending'
    OR v_job.cleanup_target_status NOT IN ('completed', 'failed')
    OR v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at <= now()
  THEN
    RETURN false;
  END IF;

  UPDATE public.generation_jobs
  SET
    status = v_job.cleanup_target_status,
    completed_at = CASE WHEN v_job.cleanup_target_status = 'completed' THEN now() ELSE completed_at END,
    source_cleanup_completed_at = now(),
    cleanup_target_status = NULL,
    lease_token = NULL,
    lease_expires_at = NULL,
    updated_at = now()
  WHERE id = p_job_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_generation_job(
  p_job_id UUID,
  p_lease_token UUID,
  p_failure_code TEXT,
  p_failure_message_safe TEXT,
  p_quality JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
  v_balance INTEGER;
  v_debit INTEGER;
  v_refunded BOOLEAN;
  v_updated INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'fail_generation_job: forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_job
  FROM public.generation_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fail_generation_job: job not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.status = 'completed' THEN
    RETURN 'already_completed';
  END IF;

  IF v_job.status = 'cleanup_pending' AND v_job.cleanup_target_status = 'completed' THEN
    RETURN 'already_completed';
  END IF;

  IF v_job.status = 'cleanup_pending' AND v_job.cleanup_target_status = 'failed' THEN
    RETURN 'already_failed';
  END IF;

  IF v_job.status = 'failed' THEN
    RETURN 'already_failed';
  END IF;

  IF v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at <= now()
  THEN
    RETURN 'lease_lost';
  END IF;

  IF v_job.funding_refunded_at IS NULL THEN
    CASE v_job.funding_kind
      WHEN 'credits' THEN
        PERFORM pg_advisory_xact_lock(hashtext(v_job.user_id::TEXT || ':' || v_job.funding_ref));
        INSERT INTO public.credit_wallets (user_id) VALUES (v_job.user_id)
          ON CONFLICT (user_id) DO NOTHING;
        SELECT wallet.balance INTO v_balance
        FROM public.credit_wallets wallet
        WHERE wallet.user_id = v_job.user_id
        FOR UPDATE;

        SELECT EXISTS (
          SELECT 1
          FROM public.credit_ledger ledger
          WHERE ledger.user_id = v_job.user_id
            AND ledger.reason = 'refund_generation'
            AND ledger.ref_type = 'credit_request'
            AND ledger.ref_id = v_job.funding_ref
        ) INTO v_refunded;

        IF NOT v_refunded THEN
          SELECT -ledger.delta INTO v_debit
          FROM public.credit_ledger ledger
          WHERE ledger.user_id = v_job.user_id
            AND ledger.reason = 'consume_expression_pack'
            AND ledger.ref_type = 'credit_request'
            AND ledger.ref_id = v_job.funding_ref
          FOR UPDATE;

          IF v_debit IS NULL OR v_debit IS DISTINCT FROM v_job.funding_amount THEN
            RAISE EXCEPTION 'fail_generation_job: funding ledger mismatch' USING ERRCODE = 'P0001';
          END IF;

          v_balance := v_balance + v_job.funding_amount;
          UPDATE public.credit_wallets
          SET balance = v_balance, updated_at = now()
          WHERE user_id = v_job.user_id;

          INSERT INTO public.credit_ledger (
            user_id, delta, balance_after, reason, ref_type, ref_id
          ) VALUES (
            v_job.user_id,
            v_job.funding_amount,
            v_balance,
            'refund_generation',
            'credit_request',
            v_job.funding_ref
          );
        END IF;
      WHEN 'generation_quota_free' THEN
        UPDATE public.generation_quota
        SET free_used = GREATEST(free_used - v_job.funding_amount, 0), updated_at = now()
        WHERE user_id = v_job.user_id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        IF v_updated <> 1 THEN
          RAISE EXCEPTION 'fail_generation_job: free quota row missing' USING ERRCODE = 'P0002';
        END IF;
      WHEN 'pet_slot' THEN
        UPDATE public.pet_slots
        SET bundled_generation_available = true, updated_at = now()
        WHERE user_id = v_job.user_id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        IF v_updated <> 1 THEN
          RAISE EXCEPTION 'fail_generation_job: pet slot row missing' USING ERRCODE = 'P0002';
        END IF;
      ELSE
        RAISE EXCEPTION 'fail_generation_job: funding metadata missing' USING ERRCODE = 'P0001';
    END CASE;
  END IF;

  UPDATE public.generation_jobs
  SET
    status = CASE WHEN v_job.original_photo_path IS NULL THEN 'failed' ELSE 'cleanup_pending' END,
    failure_code = p_failure_code,
    failure_message_safe = p_failure_message_safe,
    quality = COALESCE(p_quality, quality),
    funding_refunded_at = COALESCE(funding_refunded_at, now()),
    cleanup_target_status = CASE WHEN v_job.original_photo_path IS NULL THEN NULL ELSE 'failed' END,
    lease_token = CASE WHEN v_job.original_photo_path IS NULL THEN NULL ELSE lease_token END,
    lease_expires_at = CASE WHEN v_job.original_photo_path IS NULL THEN NULL ELSE now() + interval '420 seconds' END,
    updated_at = now()
  WHERE id = p_job_id;

  RETURN CASE WHEN v_job.original_photo_path IS NULL THEN 'failed' ELSE 'cleanup_pending' END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_expression_pack_job(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_expression_pack_job(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, TEXT[], TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_generation_job(UUID, TEXT, JSONB, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_generation_job(UUID, TEXT, JSONB, TEXT, TEXT, TEXT[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_generation_job(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_job(UUID, UUID, INTEGER, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION public.advance_generation_job(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_generation_job(UUID, UUID, TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_generation_job(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_generation_job(UUID, UUID, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_generation_asset(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_generation_asset(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_generation_source_cleanup(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_generation_source_cleanup(UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_generation_job(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_generation_job(UUID, UUID, TEXT, TEXT, JSONB) TO service_role;

COMMIT;
