-- Mongchi Supabase backend: chat "day pass" (Chat Live BM decision --
-- subscription-free single credit economy + a one-off "chatty day pass").
--
-- Note on numbering: this was originally scoped as 0016_chat_day_pass.sql,
-- but 0016/0017 landed first for the credit store foundation
-- (0016_credit_store_foundation.sql, 0017_adjust_starter_credit_grant.sql),
-- so this migration is 0018.
--
-- Scope:
--   1. chat_access.day_pass_expires_at -- a column separate from
--      plus_expires_at (0014_chat_turn_guardrails.sql) so a day pass and any
--      future subscription never share one analytics/refund meaning.
--   2. reserve_chat_turn (0014) judgment order updated to
--      plus -> day_pass -> starter_free -> daily_free -> credit. A turn
--      covered by an active day pass charges nothing and is recorded with
--      charge_kind = 'day_pass'. fail_chat_turn (0014) gets an explicit
--      day_pass no-op branch: there is nothing to refund for a turn that
--      never charged anything.
--   3. RPC purchase_chat_day_pass -- service_role only (0007-style REVOKE/
--      GRANT), atomically debits a server-constant 3 credits via
--      consume_credits (idempotent by p_request_id) and activates a 24-hour
--      *rolling* window (not "until midnight" -- a rolling window means
--      buying in the evening isn't a worse deal than buying in the morning).
--      Refuses (does not extend) a purchase while a pass is already active;
--      see that RPC's own doc comment for why this is also idempotent-safe
--      for a bare retry of the same request.
--   4. RPC delete_own_chat_history -- authenticated-callable (SECURITY
--      DEFINER, auth.uid()-scoped, matching 0015_chat_message_reports.sql's
--      report_chat_message pattern), hard-deletes the caller's own
--      conversation_messages and marks their conversations status='deleted'
--      with the B안 summary columns cleared. This is the server-side half of
--      the mobile "Delete chat history" gap: the current client
--      deleteChatHistory only clears a dead API/local cache and never
--      reaches live conversations/conversation_messages.
--   5. pg_cron schedule for purge_expired_conversation_messages (already
--      defined in 0006_conversations.sql, never scheduled) -- guarded so
--      this migration does not fail outright in an environment without the
--      pg_cron extension.

BEGIN;

-- ---------------------------------------------------------------------------
-- chat_access.day_pass_expires_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_access
  ADD COLUMN IF NOT EXISTS day_pass_expires_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- chat_turn_requests.charge_kind now also accepts 'day_pass'.
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_turn_requests
  DROP CONSTRAINT IF EXISTS chat_turn_requests_charge_kind_check;

ALTER TABLE public.chat_turn_requests
  ADD CONSTRAINT chat_turn_requests_charge_kind_check
  CHECK (charge_kind IN ('plus', 'starter_free', 'daily_free', 'credit', 'day_pass'));

-- ---------------------------------------------------------------------------
-- RPC: reserve_chat_turn (updated judgment order)
--
-- Same signature/return shape as 0014_chat_turn_guardrails.sql -- only the
-- entitlement decision inside the body changes: a day pass now slots in
-- between plus and starter_free, charges nothing, and needs no per-turn
-- column update (unlike starter_free/daily_free, there is no counter to
-- decrement or date to stamp -- the pass is either active or it isn't).
-- ---------------------------------------------------------------------------

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
  ELSIF v_access.day_pass_expires_at IS NOT NULL AND v_access.day_pass_expires_at > now() THEN
    v_charge_kind := 'day_pass';
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

-- ---------------------------------------------------------------------------
-- RPC: fail_chat_turn (day_pass no-op branch)
--
-- Same signature/return shape as 0014. Adds an explicit ELSIF for
-- charge_kind = 'day_pass' that does nothing: a day-pass-covered turn never
-- charged credits or consumed a starter/daily allowance, so there is nothing
-- to restore on failure (matches how a 'plus' turn already falls through
-- with no branch at all -- this one is spelled out for clarity since the day
-- pass is new).
-- ---------------------------------------------------------------------------

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
  ELSIF v_request.charge_kind = 'day_pass' THEN
    -- No-op: a day-pass-covered turn charged nothing (no credit debit, no
    -- starter/daily allowance consumed), so there is nothing to refund here.
    -- The pass itself keeps counting down toward day_pass_expires_at
    -- regardless of individual turn outcomes -- it is time-bounded, not
    -- turn-metered.
    NULL;
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

-- ---------------------------------------------------------------------------
-- RPC: purchase_chat_day_pass
--
-- service_role only. Debits a server-constant 3 credits (never client-
-- supplied -- same "server owns pricing" principle as chat-turn/index.ts's
-- CHAT_TURN_CREDIT_COST) via consume_credits, idempotent on p_request_id, and
-- activates a 24-hour rolling window from the moment of purchase (not
-- "until midnight" -- a rolling window means an evening purchase is never a
-- worse deal than a morning one).
--
-- Refuses a purchase while day_pass_expires_at is already in the future --
-- returns outcome 'already_active' with the existing expiry and current
-- balance rather than extending it or charging again. The mobile client is
-- expected to hide the purchase entry point once a pass is active, but this
-- is the server-side backstop for that (per the BM decision doc's "클라가
-- UI에서 숨기지만 서버도 방어").
--
-- This check runs *before* the consume_credits call and is itself
-- idempotency-safe: because it is gated by the pg_advisory_xact_lock below,
-- a genuine retry of the very request that just activated the pass will see
-- day_pass_expires_at already in the future and report 'already_active'
-- (truthfully -- the pass the caller is retrying for is in fact active)
-- rather than re-running consume_credits at all. consume_credits' own
-- (user, reason, ref_type, ref_id) idempotency guard
-- (0004_credit_ledger.sql) is still in place as defense in depth, but this
-- ordering means it is never actually reached on a retry after success.
--
-- Returns exactly one row: (outcome, day_pass_expires_at, balance).
-- ---------------------------------------------------------------------------

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
  v_cost CONSTANT INTEGER := 3;
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

-- ---------------------------------------------------------------------------
-- RPC: delete_own_chat_history
--
-- authenticated-callable (SECURITY DEFINER, auth.uid()-scoped), matching
-- 0015_chat_message_reports.sql's report_chat_message pattern exactly rather
-- than the service_role-only pattern above: this is a user-initiated
-- self-service action with no server-side charge/entitlement decision, so
-- there is nothing an Edge Function needs to mediate.
--
-- Hard-deletes every conversation_messages row owned by the caller (the
-- privacy-sensitive raw text) and marks every one of the caller's
-- conversations status = 'deleted' with the B안 summary columns
-- (0006_conversations.sql) cleared, so no long-term summary text survives
-- either. Conversations already status = 'deleted' are left alone (no-op)
-- so repeat calls don't keep bumping deleted_at/updated_at.
--
-- This is the server-side half of a gap: the mobile client's existing
-- "Delete chat history" action only clears a dead API/local cache and never
-- reaches these live Supabase tables.
--
-- Returns the number of conversation_messages rows deleted.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_own_chat_history()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_deleted INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'delete_own_chat_history: unauthorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.conversation_messages
  WHERE user_id = v_user;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.conversations
  SET status = 'deleted',
      deleted_at = now(),
      summary = NULL,
      summary_updated_at = NULL,
      summary_msg_count = 0,
      summarized_through = NULL,
      updated_at = now()
  WHERE user_id = v_user
    AND status <> 'deleted';

  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_own_chat_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_chat_history() TO authenticated;

-- ---------------------------------------------------------------------------
-- Retention purge schedule (pg_cron)
--
-- Schedules purge_expired_conversation_messages (defined in
-- 0006_conversations.sql, never previously scheduled) to run once daily at
-- 03:00 UTC. Supabase projects provision the pg_cron extension by default,
-- but this guards against any environment where it isn't installed (e.g. a
-- bare local/CI Postgres without the extension) so this migration never
-- fails outright -- it just logs a notice and skips scheduling.
--
-- cron.schedule(job_name, schedule, command) upserts by job_name (pg_cron
-- >= 1.4: re-running with the same name replaces the existing job and
-- reuses its job id), so this block is itself safe to re-run.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge_expired_conversation_messages_daily',
      '0 3 * * *',
      $cron$SELECT public.purge_expired_conversation_messages();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed -- skipping purge_expired_conversation_messages_daily schedule (0018_chat_day_pass.sql). Schedule it manually once pg_cron is available.';
  END IF;
END;
$$;

COMMIT;
