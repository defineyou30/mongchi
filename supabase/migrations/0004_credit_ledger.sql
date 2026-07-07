-- Mongchi Supabase backend: server-side credit ledger (Credit Phase 1a).
--
-- Scope: credit_wallets (server-authoritative balance) + credit_ledger
-- (append-only audit log) tables, RLS matching the read-own/write-via-
-- SECURITY-DEFINER-RPC pattern from 0001_init.sql/0002_rate_limit.sql, and
-- four RPCs: consume_credits (atomic, idempotent debit), refund_credits
-- (idempotent credit-back on generation failure), grant_credits (idempotent
-- top-up for admin/migration/future IAP), get_credit_balance (convenience
-- read). Also adds generation_jobs.credit_ref, the idempotency key linking a
-- job to the credit_request ledger entry that funded it (see
-- supabase/functions/generate-avatar/index.ts), and migrates any existing
-- generation_quota.paid_credits balances into credit_wallets.
--
-- Relationship to generation_quota (kept, not replaced): the free first
-- generation (free_used/free_limit) still lives in generation_quota and is
-- still spent via consume_generation_quota -- unchanged by this migration.
-- Paid generation credits (expression packs, and future paid flows) move to
-- credit_wallets/credit_ledger instead of generation_quota.paid_credits,
-- which becomes deprecated (column kept for audit/rollback, no longer
-- written by new code once this migration's backfill below has run).
--
-- See docs/credit-phase1-design.md for the full design rationale.

BEGIN;

-- ---------------------------------------------------------------------------
-- credit_wallets
--
-- Server-authoritative cash-like credit balance, one row per user. Does NOT
-- include the client-local "bonusCredits" bucket (packages/shared/src/domain/
-- wallet.ts) -- that stays client-local/lossy by design. This table only
-- tracks purchased/granted/consumed credits that gate real OpenAI spend.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.credit_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- credit_ledger
--
-- Append-only audit log -- never UPDATE or DELETE a row here. Every balance
-- change writes exactly one ledger row in the same transaction as the
-- credit_wallets update; credit_wallets.balance is a cache of
-- SUM(credit_ledger.delta) for that user. If that invariant is ever
-- violated, treat it as data corruption (ops alert-worthy).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,               -- grant +N, consume -N, refund +N, chargeback -N
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason TEXT NOT NULL,                 -- 'grant_purchase' | 'grant_admin' | 'grant_migration'
                                        -- | 'consume_expression_pack' | 'consume_regeneration'
                                        -- | 'consume_full_set' | 'consume_pet_slot'
                                        -- | 'consume_theme_bundle' | 'refund_generation'
                                        -- | 'chargeback_refund'
  ref_type TEXT,                        -- 'credit_request' | 'iap_transaction' | 'pet_slot' | 'user' | null
  ref_id TEXT,                          -- idempotency key: request_id / store tx id / slot id / user id
  metadata JSONB,                       -- free-form diagnostics (package id, sku, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_ledger_user_created_idx
  ON public.credit_ledger(user_id, created_at DESC);

-- Idempotency guard: the same (user, reason, ref_type, ref_id) combination
-- can only ever post once, so retries can never double-charge or
-- double-refund. Rows with ref_id IS NULL (e.g. pure admin grants with no
-- external reference) are outside this constraint by design.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idempotency_idx
  ON public.credit_ledger(user_id, reason, ref_type, ref_id)
  WHERE ref_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RPC: consume_credits
--
-- Atomically debits p_cost credits from p_user's wallet. Returns the new
-- balance on success, or -1 if the wallet doesn't have enough (callers map
-- -1 to HTTP 402 -- this is a normal "insufficient funds" outcome, not an
-- exception). SELECT ... FOR UPDATE row-locks the wallet row so concurrent
-- requests for the same user serialize instead of racing past the balance
-- check (defends against double-tap/double-submit double-spends). When
-- p_ref_id is supplied, a matching ledger row already existing for
-- (user, reason, ref_type, ref_id) short-circuits to a no-op that just
-- returns the previously recorded balance, so retries of the same logical
-- request never charge twice.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user     UUID,
  p_cost     INTEGER,
  p_reason   TEXT,
  p_ref_type TEXT DEFAULT NULL,
  p_ref_id   TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_existing INTEGER;
BEGIN
  IF p_cost <= 0 THEN
    RAISE EXCEPTION 'consume_credits: p_cost must be positive (got %)', p_cost;
  END IF;

  -- Idempotency: if this exact consumption was already recorded, return the
  -- balance from that time instead of charging again.
  IF p_ref_id IS NOT NULL THEN
    SELECT balance_after INTO v_existing
    FROM public.credit_ledger
    WHERE user_id = p_user AND reason = p_reason
      AND ref_type IS NOT DISTINCT FROM p_ref_type
      AND ref_id = p_ref_id
    LIMIT 1;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Ensure the wallet row exists, then lock it for the rest of this
  -- transaction so concurrent consume/grant/refund calls for the same user
  -- serialize.
  INSERT INTO public.credit_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance
  FROM public.credit_wallets WHERE user_id = p_user
  FOR UPDATE;

  IF v_balance < p_cost THEN
    RETURN -1;                       -- insufficient funds: caller maps to 402
  END IF;

  v_balance := v_balance - p_cost;
  UPDATE public.credit_wallets
    SET balance = v_balance, updated_at = now()
    WHERE user_id = p_user;

  INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, metadata)
    VALUES (p_user, -p_cost, v_balance, p_reason, p_ref_type, p_ref_id, p_metadata);

  RETURN v_balance;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: refund_credits
--
-- Reverses a prior consume_credits debit identified by (p_ref_type, p_ref_id)
-- -- used when the funded generation job subsequently fails. Idempotent: if
-- a 'refund_generation' ledger row already exists for that ref, this is a
-- no-op that returns the current balance rather than refunding twice. Looks
-- up the original consume_% ledger row to know exactly how much to credit
-- back (rather than a hardcoded cost), so it stays correct even if per-flow
-- costs change over time.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user     UUID,
  p_ref_type TEXT,
  p_ref_id   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_consumed INTEGER;
  v_balance INTEGER;
BEGIN
  -- Already refunded -- no-op, return current balance.
  PERFORM 1 FROM public.credit_ledger
    WHERE user_id = p_user AND reason = 'refund_generation'
      AND ref_type = p_ref_type AND ref_id = p_ref_id;
  IF FOUND THEN
    SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = p_user;
    RETURN COALESCE(v_balance, 0);
  END IF;

  -- Find the original consumption for this ref so we know how much to
  -- credit back. If there isn't one, there's nothing to refund.
  SELECT -delta INTO v_consumed
  FROM public.credit_ledger
  WHERE user_id = p_user AND ref_type = p_ref_type AND ref_id = p_ref_id
    AND reason LIKE 'consume_%'
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND OR v_consumed IS NULL OR v_consumed <= 0 THEN
    SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = p_user;
    RETURN COALESCE(v_balance, 0);
  END IF;

  UPDATE public.credit_wallets
    SET balance = balance + v_consumed, updated_at = now()
    WHERE user_id = p_user
    RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
    VALUES (p_user, v_consumed, v_balance, 'refund_generation', p_ref_type, p_ref_id);

  RETURN v_balance;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: grant_credits
--
-- Credits p_amount to p_user's wallet -- used for admin top-ups, the
-- paid_credits migration backfill below, and (future Phase 1d) verified IAP
-- purchases. Idempotent via p_ref_id, matching consume_credits/refund_credits.
-- No RLS write policy exists on credit_wallets/credit_ledger, so this must
-- always be invoked via service_role (Edge Function) or another SECURITY
-- DEFINER RPC -- never directly reachable from an authenticated client.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user     UUID,
  p_amount   INTEGER,
  p_reason   TEXT,
  p_ref_type TEXT DEFAULT NULL,
  p_ref_id   TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_existing INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'grant_credits: p_amount must be positive (got %)', p_amount;
  END IF;

  IF p_ref_id IS NOT NULL THEN
    SELECT balance_after INTO v_existing FROM public.credit_ledger
    WHERE user_id = p_user AND reason = p_reason
      AND ref_type IS NOT DISTINCT FROM p_ref_type AND ref_id = p_ref_id
    LIMIT 1;
    IF FOUND THEN RETURN v_existing; END IF;   -- already granted (retry)
  END IF;

  INSERT INTO public.credit_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = p_user FOR UPDATE;

  v_balance := v_balance + p_amount;
  UPDATE public.credit_wallets SET balance = v_balance, updated_at = now() WHERE user_id = p_user;
  INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, metadata)
    VALUES (p_user, p_amount, v_balance, p_reason, p_ref_type, p_ref_id, p_metadata);
  RETURN v_balance;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_credit_balance
--
-- Convenience read that guarantees "no wallet row yet" reads as 0 rather
-- than requiring every caller (client and Edge Function alike) to handle a
-- missing row. Clients may also SELECT credit_wallets directly (RLS allows
-- reading their own row); this RPC just saves them the null-handling.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT balance FROM public.credit_wallets WHERE user_id = p_user), 0);
$$;

-- ---------------------------------------------------------------------------
-- generation_jobs.credit_ref
--
-- Idempotency key linking a generation job to the credit_ledger entries that
-- funded it. Set to the client-supplied (or server-generated fallback)
-- request_id at job-creation time for any job funded by consume_credits
-- (currently: expression pack jobs). NULL for jobs funded by the free
-- generation_quota allowance instead. On pipeline failure, the Edge
-- Function refunds via refund_credits(p_user, 'credit_request', credit_ref)
-- when this is set, or refund_generation_quota when it isn't -- see
-- supabase/functions/generate-avatar/index.ts.
-- ---------------------------------------------------------------------------

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS credit_ref TEXT;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Read-only policies for the owning user, matching the 0001_init.sql /
-- 0002_rate_limit.sql pattern exactly: no write policy exists, so all writes
-- happen through the SECURITY DEFINER RPCs above or the Edge Function's
-- service_role key.
-- ---------------------------------------------------------------------------

ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger  ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_wallets_select_own ON public.credit_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY credit_ledger_select_own ON public.credit_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Data migration: backfill existing generation_quota.paid_credits balances
-- into credit_wallets, then zero them out so the same balance is never
-- represented twice.
--
-- ⚠️ EXECUTE-TIME CAUTION: the final UPDATE below is hard to reverse (it
-- zeroes paid_credits after copying it forward). It is written to be
-- idempotent/safe to run multiple times (ON CONFLICT DO NOTHING on the
-- wallet insert, ON CONFLICT DO NOTHING on the ledger insert via the
-- credit_ledger_idempotency_idx unique index, and the UPDATE only ever
-- moves paid_credits towards 0) but is NOT safe to run before taking a
-- backup/snapshot of generation_quota if this environment has real user
-- balances. Per docs/credit-phase1-design.md §7.1: acceptable to run
-- immediately pre-launch when production paid_credits balances are ~0;
-- take a `generation_quota` snapshot first in any environment where that
-- may not hold.
-- ---------------------------------------------------------------------------

INSERT INTO public.credit_wallets (user_id, balance)
SELECT user_id, paid_credits FROM public.generation_quota WHERE paid_credits > 0
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
SELECT gq.user_id, gq.paid_credits, gq.paid_credits, 'grant_migration', 'user', gq.user_id::text
FROM public.generation_quota gq WHERE gq.paid_credits > 0
ON CONFLICT DO NOTHING;

UPDATE public.generation_quota SET paid_credits = 0 WHERE paid_credits > 0;

COMMIT;
