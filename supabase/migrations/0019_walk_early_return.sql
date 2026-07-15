-- Server-authoritative 1-credit purchase for bringing an active local walk
-- home immediately. The current Supabase runtime keeps walk timing on-device,
-- while credit_wallets is authoritative on the server, so this RPC owns only
-- the economic transaction. The mobile client changes the matching walk to
-- `returned` only after this call succeeds.

BEGIN;

CREATE OR REPLACE FUNCTION public.purchase_walk_early_return(p_walk_id TEXT)
RETURNS TABLE (
  outcome TEXT,
  balance INTEGER,
  charged_credit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_balance INTEGER;
  v_credit_cost INTEGER := 1;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'purchase_walk_early_return: authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_walk_id IS NULL
    OR btrim(p_walk_id) = ''
    OR char_length(p_walk_id) > 128
    OR p_walk_id !~ '^walk_[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'purchase_walk_early_return: invalid walk id' USING ERRCODE = '22023';
  END IF;

  -- Serialize retries for this user's walk before consume_credits checks its
  -- ledger idempotency key. This avoids a concurrent duplicate request ever
  -- surfacing as a unique-index error to the client.
  PERFORM pg_advisory_xact_lock(hashtext('walk-early:' || v_user::TEXT || ':' || p_walk_id));

  v_balance := public.consume_credits(
    v_user,
    v_credit_cost,
    'consume_walk_early_return',
    'walk',
    p_walk_id,
    jsonb_build_object('walk_id', p_walk_id, 'credit_cost', v_credit_cost)
  );

  IF v_balance = -1 THEN
    SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0)
      INTO v_balance;

    RETURN QUERY SELECT 'insufficient_credits'::TEXT, v_balance, 0;
    RETURN;
  END IF;

  -- consume_credits returns the historical balance_after for an idempotent
  -- replay. Read the wallet once more so the client always receives the
  -- current authoritative balance even if other purchases happened later.
  SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0)
    INTO v_balance;

  RETURN QUERY SELECT 'completed'::TEXT, v_balance, v_credit_cost;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_walk_early_return(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_walk_early_return(TEXT) TO authenticated;

COMMIT;
