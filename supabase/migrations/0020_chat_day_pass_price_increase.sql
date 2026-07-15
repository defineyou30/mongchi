-- Mongchi pricing pass (2026-07): raises the chat "day pass" from 3 to 5
-- credits, matching the client-side mirror bump in
-- packages/shared/src/domain/wallet.ts's chatDayPassCreditCost.
--
-- This is a CREATE OR REPLACE of the full purchase_chat_day_pass function
-- body from 0018_chat_day_pass.sql with only v_cost changed -- 0018 itself
-- is left untouched (per the "never edit a landed migration" rule). Every
-- other behavior (idempotent debit via consume_credits, already_active
-- refusal, 24h rolling window activation, service_role-only access) is
-- unchanged; see 0018_chat_day_pass.sql's own doc comment on this RPC for
-- the full reasoning.

BEGIN;

CREATE OR REPLACE FUNCTION public.purchase_chat_day_pass(
  p_user UUID,
  p_request_id TEXT
)
RETURNS TABLE (
  outcome TEXT,
  day_pass_expires_at TIMESTAMPTZ,
  balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cost CONSTANT INTEGER := 5;
  v_access public.chat_access%ROWTYPE;
  v_balance INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'purchase_chat_day_pass: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR btrim(p_request_id) = '' OR char_length(p_request_id) > 128 THEN
    RAISE EXCEPTION 'purchase_chat_day_pass: invalid input' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('chat-user:' || p_user::text));

  INSERT INTO public.chat_access (user_id)
  VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_access
  FROM public.chat_access
  WHERE user_id = p_user
  FOR UPDATE;

  IF v_access.day_pass_expires_at IS NOT NULL AND v_access.day_pass_expires_at > now() THEN
    RETURN QUERY SELECT 'already_active'::TEXT, v_access.day_pass_expires_at,
      COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0);
    RETURN;
  END IF;

  v_balance := public.consume_credits(
    p_user,
    v_cost,
    'consume_chat_day_pass',
    'credit_request',
    p_request_id,
    jsonb_build_object('request_id', p_request_id)
  );

  IF v_balance = -1 THEN
    RETURN QUERY SELECT 'insufficient_credits'::TEXT, NULL::TIMESTAMPTZ,
      COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0);
    RETURN;
  END IF;

  UPDATE public.chat_access
  SET day_pass_expires_at = now() + interval '24 hours', updated_at = now()
  WHERE user_id = p_user
  RETURNING * INTO v_access;

  RETURN QUERY SELECT 'purchased'::TEXT, v_access.day_pass_expires_at, v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_chat_day_pass(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_chat_day_pass(UUID, TEXT)
  TO service_role;

COMMIT;
