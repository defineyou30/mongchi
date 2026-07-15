BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  starter_free_remaining INTEGER NOT NULL DEFAULT 3 CHECK (starter_free_remaining >= 0),
  daily_free_on DATE,
  plus_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_user_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_turn_requests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'completed', 'failed_refunded')),
  charge_kind TEXT NOT NULL CHECK (charge_kind IN ('plus', 'starter_free', 'daily_free', 'credit')),
  charged_credit INTEGER NOT NULL DEFAULT 0 CHECK (charged_credit >= 0),
  credit_ref TEXT,
  balance_after INTEGER NOT NULL DEFAULT 0 CHECK (balance_after >= 0),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  response_payload JSONB,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS chat_turn_requests_user_created_idx
  ON public.chat_turn_requests(user_id, created_at DESC);

ALTER TABLE public.chat_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_user_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_turn_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_access_select_own ON public.chat_access;
CREATE POLICY chat_access_select_own
  ON public.chat_access
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.reserve_chat_turn(
  p_user UUID,
  p_request_id TEXT,
  p_conversation_id UUID,
  p_pet_id TEXT,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_requests INTEGER DEFAULT 10,
  p_credit_cost INTEGER DEFAULT 1
)
RETURNS TABLE (
  outcome TEXT,
  charge_kind TEXT,
  balance INTEGER,
  free_turns_remaining INTEGER,
  retry_after_seconds INTEGER,
  response_payload JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.chat_turn_requests%ROWTYPE;
  v_access public.chat_access%ROWTYPE;
  v_rate public.chat_user_rate_limits%ROWTYPE;
  v_balance INTEGER;
  v_attempt INTEGER := 1;
  v_charge_kind TEXT;
  v_credit_ref TEXT;
  v_retry_after INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'reserve_chat_turn: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR btrim(p_request_id) = '' OR char_length(p_request_id) > 128
    OR p_pet_id IS NULL OR btrim(p_pet_id) = ''
    OR p_window_seconds <= 0 OR p_max_requests <= 0 OR p_credit_cost <= 0 THEN
    RAISE EXCEPTION 'reserve_chat_turn: invalid input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.user_id = p_user
      AND c.pet_id = p_pet_id
      AND c.status = 'open'
      AND c.type = 'premium_ai_chat'
  ) THEN
    RAISE EXCEPTION 'reserve_chat_turn: conversation not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('chat-user:' || p_user::text));

  SELECT * INTO v_existing
  FROM public.chat_turn_requests
  WHERE user_id = p_user AND request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.conversation_id IS DISTINCT FROM p_conversation_id
      OR v_existing.pet_id IS DISTINCT FROM p_pet_id THEN
      RETURN QUERY SELECT 'conflict'::TEXT, NULL::TEXT, v_existing.balance_after,
        NULL::INTEGER, NULL::INTEGER, NULL::JSONB;
      RETURN;
    END IF;

    IF v_existing.status = 'completed' THEN
      SELECT * INTO v_access FROM public.chat_access WHERE user_id = p_user;
      RETURN QUERY SELECT 'replay'::TEXT, v_existing.charge_kind,
        v_existing.balance_after, COALESCE(v_access.starter_free_remaining, 0),
        0, v_existing.response_payload;
      RETURN;
    END IF;

    IF v_existing.status = 'reserved' THEN
      RETURN QUERY SELECT 'in_progress'::TEXT, v_existing.charge_kind,
        v_existing.balance_after, NULL::INTEGER, 15, NULL::JSONB;
      RETURN;
    END IF;

    v_attempt := v_existing.attempt_count + 1;
  END IF;

  INSERT INTO public.chat_user_rate_limits (user_id, request_count)
  VALUES (p_user, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_rate
  FROM public.chat_user_rate_limits
  WHERE user_id = p_user
  FOR UPDATE;

  IF v_rate.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.chat_user_rate_limits
    SET window_started_at = now(), request_count = 0, updated_at = now()
    WHERE user_id = p_user
    RETURNING * INTO v_rate;
  END IF;

  IF v_rate.request_count >= p_max_requests THEN
    v_retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_rate.window_started_at + make_interval(secs => p_window_seconds) - now())))::INTEGER
    );
    RETURN QUERY SELECT 'rate_limited'::TEXT, NULL::TEXT,
      COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0),
      NULL::INTEGER, v_retry_after, NULL::JSONB;
    RETURN;
  END IF;

  UPDATE public.chat_user_rate_limits
  SET request_count = request_count + 1, updated_at = now()
  WHERE user_id = p_user;

  INSERT INTO public.chat_access (user_id)
  VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_access
  FROM public.chat_access
  WHERE user_id = p_user
  FOR UPDATE;

  SELECT COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0)
    INTO v_balance;

  IF v_access.plus_expires_at IS NOT NULL AND v_access.plus_expires_at > now() THEN
    v_charge_kind := 'plus';
  ELSIF v_access.starter_free_remaining > 0 THEN
    v_charge_kind := 'starter_free';
    UPDATE public.chat_access
    SET starter_free_remaining = starter_free_remaining - 1, updated_at = now()
    WHERE user_id = p_user
    RETURNING * INTO v_access;
  ELSIF v_access.daily_free_on IS DISTINCT FROM current_date THEN
    v_charge_kind := 'daily_free';
    UPDATE public.chat_access
    SET daily_free_on = current_date, updated_at = now()
    WHERE user_id = p_user
    RETURNING * INTO v_access;
  ELSE
    v_charge_kind := 'credit';
    v_credit_ref := p_request_id || ':' || v_attempt::TEXT;
    v_balance := public.consume_credits(
      p_user,
      p_credit_cost,
      'consume_premium_chat',
      'chat_request',
      v_credit_ref,
      jsonb_build_object('request_id', p_request_id, 'attempt', v_attempt)
    );

    IF v_balance = -1 THEN
      RETURN QUERY SELECT 'insufficient_credits'::TEXT, NULL::TEXT,
        COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0),
        v_access.starter_free_remaining, 0, NULL::JSONB;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.chat_turn_requests (
    user_id,
    request_id,
    conversation_id,
    pet_id,
    status,
    charge_kind,
    charged_credit,
    credit_ref,
    balance_after,
    attempt_count
  ) VALUES (
    p_user,
    p_request_id,
    p_conversation_id,
    p_pet_id,
    'reserved',
    v_charge_kind,
    CASE WHEN v_charge_kind = 'credit' THEN p_credit_cost ELSE 0 END,
    v_credit_ref,
    v_balance,
    v_attempt
  )
  ON CONFLICT (user_id, request_id) DO UPDATE
  SET status = 'reserved',
      charge_kind = EXCLUDED.charge_kind,
      charged_credit = EXCLUDED.charged_credit,
      credit_ref = EXCLUDED.credit_ref,
      balance_after = EXCLUDED.balance_after,
      attempt_count = EXCLUDED.attempt_count,
      response_payload = NULL,
      failure_code = NULL,
      updated_at = now();

  RETURN QUERY SELECT 'reserved'::TEXT, v_charge_kind, v_balance,
    v_access.starter_free_remaining, 0, NULL::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_chat_turn(
  p_user UUID,
  p_request_id TEXT,
  p_conversation_id UUID,
  p_user_text TEXT,
  p_user_safety_flags JSONB,
  p_pet_text TEXT,
  p_pet_safety_flags JSONB,
  p_response_base JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.chat_turn_requests%ROWTYPE;
  v_user_message public.conversation_messages%ROWTYPE;
  v_pet_message public.conversation_messages%ROWTYPE;
  v_response_payload JSONB;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'complete_chat_turn: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_response_base IS NULL OR jsonb_typeof(p_response_base) <> 'object'
    OR p_user_text IS NULL OR btrim(p_user_text) = ''
    OR p_pet_text IS NULL OR btrim(p_pet_text) = ''
    OR jsonb_typeof(p_user_safety_flags) <> 'array'
    OR jsonb_typeof(p_pet_safety_flags) <> 'array' THEN
    RAISE EXCEPTION 'complete_chat_turn: invalid response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request
  FROM public.chat_turn_requests
  WHERE user_id = p_user AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'reserved'
    OR v_request.conversation_id IS DISTINCT FROM p_conversation_id THEN
    RAISE EXCEPTION 'complete_chat_turn: reservation not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.user_id = p_user
      AND c.pet_id = v_request.pet_id
      AND c.status = 'open'
      AND c.type = 'premium_ai_chat'
  ) THEN
    RAISE EXCEPTION 'complete_chat_turn: conversation not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.conversation_messages (
    conversation_id, user_id, sender, text, safety_flags
  ) VALUES (
    p_conversation_id, p_user, 'user', p_user_text, p_user_safety_flags
  ) RETURNING * INTO v_user_message;

  INSERT INTO public.conversation_messages (
    conversation_id, user_id, sender, text, safety_flags
  ) VALUES (
    p_conversation_id, p_user, 'pet_ai', p_pet_text, p_pet_safety_flags
  ) RETURNING * INTO v_pet_message;

  v_response_payload := p_response_base || jsonb_build_object(
    'userMessage', jsonb_build_object(
      'id', v_user_message.id,
      'conversationId', v_user_message.conversation_id,
      'sender', v_user_message.sender,
      'text', v_user_message.text,
      'safetyFlags', v_user_message.safety_flags,
      'createdAt', v_user_message.created_at
    ),
    'petMessage', jsonb_build_object(
      'id', v_pet_message.id,
      'conversationId', v_pet_message.conversation_id,
      'sender', v_pet_message.sender,
      'text', v_pet_message.text,
      'safetyFlags', v_pet_message.safety_flags,
      'createdAt', v_pet_message.created_at
    )
  );

  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = p_conversation_id AND user_id = p_user;

  UPDATE public.chat_turn_requests
  SET status = 'completed', response_payload = v_response_payload, updated_at = now()
  WHERE user_id = p_user AND request_id = p_request_id AND status = 'reserved';

  RETURN v_response_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_chat_turn(
  p_user UUID,
  p_request_id TEXT,
  p_failure_code TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.chat_turn_requests%ROWTYPE;
  v_access public.chat_access%ROWTYPE;
  v_balance INTEGER;
  v_consumed INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'fail_chat_turn: forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('chat-user:' || p_user::text));

  SELECT * INTO v_request
  FROM public.chat_turn_requests
  WHERE user_id = p_user AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'reserved' THEN
    RETURN COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0);
  END IF;

  IF v_request.charge_kind = 'credit' AND v_request.credit_ref IS NOT NULL THEN
    SELECT -cl.delta INTO v_consumed
    FROM public.credit_ledger cl
    WHERE cl.user_id = p_user
      AND cl.reason = 'consume_premium_chat'
      AND cl.ref_type = 'chat_request'
      AND cl.ref_id = v_request.credit_ref
    LIMIT 1;

    IF v_consumed IS NOT NULL AND v_consumed > 0 AND NOT EXISTS (
      SELECT 1 FROM public.credit_ledger cl
      WHERE cl.user_id = p_user
        AND cl.reason = 'refund_premium_chat'
        AND cl.ref_type = 'chat_request'
        AND cl.ref_id = v_request.credit_ref
    ) THEN
      UPDATE public.credit_wallets
      SET balance = balance + v_consumed, updated_at = now()
      WHERE user_id = p_user
      RETURNING balance INTO v_balance;

      INSERT INTO public.credit_ledger (
        user_id, delta, balance_after, reason, ref_type, ref_id, metadata
      ) VALUES (
        p_user,
        v_consumed,
        v_balance,
        'refund_premium_chat',
        'chat_request',
        v_request.credit_ref,
        jsonb_build_object('request_id', p_request_id, 'failure_code', p_failure_code)
      );
    END IF;
  ELSIF v_request.charge_kind = 'starter_free' THEN
    UPDATE public.chat_access
    SET starter_free_remaining = starter_free_remaining + 1, updated_at = now()
    WHERE user_id = p_user;
  ELSIF v_request.charge_kind = 'daily_free' THEN
    SELECT * INTO v_access FROM public.chat_access WHERE user_id = p_user FOR UPDATE;
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_turn_requests ctr
      WHERE ctr.user_id = p_user
        AND ctr.request_id <> p_request_id
        AND ctr.status = 'completed'
        AND ctr.charge_kind = 'daily_free'
        AND ctr.created_at::DATE = current_date
    ) THEN
      UPDATE public.chat_access
      SET daily_free_on = NULL, updated_at = now()
      WHERE user_id = p_user AND daily_free_on = current_date;
    END IF;
  END IF;

  SELECT COALESCE((SELECT cw.balance FROM public.credit_wallets cw WHERE cw.user_id = p_user), 0)
    INTO v_balance;

  UPDATE public.chat_turn_requests
  SET status = 'failed_refunded',
      charged_credit = 0,
      balance_after = v_balance,
      failure_code = left(COALESCE(p_failure_code, 'unknown_failure'), 80),
      updated_at = now()
  WHERE user_id = p_user AND request_id = p_request_id;

  RETURN v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_chat_turn(UUID, TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_chat_turn(UUID, TEXT, UUID, TEXT, JSONB, TEXT, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_chat_turn(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_chat_turn(UUID, TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_chat_turn(UUID, TEXT, UUID, TEXT, JSONB, TEXT, JSONB, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_chat_turn(UUID, TEXT, TEXT)
  TO service_role;

COMMIT;
