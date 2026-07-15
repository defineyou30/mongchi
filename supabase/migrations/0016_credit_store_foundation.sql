BEGIN;

CREATE OR REPLACE FUNCTION public.revoke_credit_purchase(
  p_user UUID,
  p_transaction_id TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted INTEGER;
  v_balance INTEGER;
  v_removed INTEGER;
BEGIN
  IF p_transaction_id IS NULL OR length(trim(p_transaction_id)) = 0 THEN
    RAISE EXCEPTION 'revoke_credit_purchase: transaction id is required';
  END IF;

  SELECT balance_after INTO v_balance
  FROM public.credit_ledger
  WHERE user_id = p_user
    AND reason = 'chargeback_refund'
    AND ref_type = 'iap_transaction'
    AND ref_id = p_transaction_id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_balance;
  END IF;

  SELECT delta INTO v_granted
  FROM public.credit_ledger
  WHERE user_id = p_user
    AND reason = 'grant_purchase'
    AND ref_type = 'iap_transaction'
    AND ref_id = p_transaction_id
  LIMIT 1;

  IF NOT FOUND OR v_granted IS NULL OR v_granted <= 0 THEN
    SELECT COALESCE(balance, 0) INTO v_balance
    FROM public.credit_wallets
    WHERE user_id = p_user;
    RETURN COALESCE(v_balance, 0);
  END IF;

  INSERT INTO public.credit_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance
  FROM public.credit_wallets
  WHERE user_id = p_user
  FOR UPDATE;

  v_removed := LEAST(v_balance, v_granted);
  v_balance := v_balance - v_removed;

  UPDATE public.credit_wallets
  SET balance = v_balance, updated_at = now()
  WHERE user_id = p_user;

  INSERT INTO public.credit_ledger (
    user_id, delta, balance_after, reason, ref_type, ref_id, metadata
  ) VALUES (
    p_user, -v_removed, v_balance, 'chargeback_refund',
    'iap_transaction', p_transaction_id, p_metadata
  );

  RETURN v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_credit_purchase(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_credit_purchase(UUID, TEXT, JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.grant_starter_credits_on_generation_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_asset_path IS NULL
    AND (
      NEW.status = 'completed'
      OR (NEW.status = 'cleanup_pending' AND NEW.cleanup_target_status = 'completed')
    )
  THEN
    PERFORM public.grant_credits(
      NEW.user_id,
      25,
      'grant_starter',
      'user',
      'starter_v1',
      jsonb_build_object('source', 'generation_completion_trigger', 'job_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_starter_credits_on_generation_completion()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS generation_jobs_grant_starter_credits
  ON public.generation_jobs;
CREATE TRIGGER generation_jobs_grant_starter_credits
  AFTER INSERT OR UPDATE OF status, cleanup_target_status
  ON public.generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_starter_credits_on_generation_completion();

DO $$
DECLARE
  completed_user RECORD;
BEGIN
  FOR completed_user IN
    SELECT DISTINCT user_id
    FROM public.generation_jobs
    WHERE source_asset_path IS NULL
      AND (
        status = 'completed'
        OR (status = 'cleanup_pending' AND cleanup_target_status = 'completed')
      )
  LOOP
    PERFORM public.grant_credits(
      completed_user.user_id,
      25,
      'grant_starter',
      'user',
      'starter_v1',
      jsonb_build_object('source', 'completed_generation_backfill')
    );
  END LOOP;
END;
$$;

COMMIT;
