-- Server-authoritative credit reward "faucet" (Phase 1): a single RPC that
-- lets an authenticated client claim a small, fixed credit reward for a
-- milestone that already happened client-side (a settlement mission, a care
-- streak, a monthly letter, the walk journal completing, or a bond level).
--
-- Why this exists: settlement/streak/collection/bond rewards used to be
-- granted straight into the client-local `bonusCredits` bucket
-- (packages/shared/src/domain/wallet.ts). credit_wallets is what the live
-- shop (0021_live_shop_purchases.sql) actually debits, and it does NOT
-- include bonusCredits by design (see 0021's header comment) -- so those
-- reward credits were earned but invisible/unspendable in the live shop. A
-- drift bug, not a design choice. This RPC moves reward credits onto the
-- same server ledger the shop already reads from.
--
-- Trust boundary: every *condition* below (did the owner really complete
-- their first walk, reach a 7-day streak, finish the walk journal, ...) is
-- evaluated entirely client-side, against packages/shared's local,
-- single-player domain state -- the server has no way to verify any of it,
-- and doesn't try to. What the server DOES own and enforce is the only part
-- that actually needs enforcing: the reward *amount* (a hardcoded
-- server-side whitelist below, never a client-supplied number) and *that it
-- can only ever be claimed once per user per key* (via grant_credits'
-- existing (user, reason, ref_type, ref_id) idempotency, ref_id = the reward
-- key itself). A malicious client can at worst claim a real key exactly
-- once, for exactly the amount below -- there is no path to an unbounded or
-- repeatable grant. This mirrors the trust model 0019/0021 already accepted
-- for walk-timer and shop-affordability state.
--
-- Mirrors 0019_walk_early_return.sql / 0021_live_shop_purchases.sql's shape
-- exactly: authenticated direct-call RPC keyed off auth.uid(), advisory
-- lock before the idempotent grant, no Edge Function needed.

BEGIN;

-- ---------------------------------------------------------------------------
-- RPC: claim_credit_reward
--
-- p_reward_key identifies which reward is being claimed. Recognized keys and
-- their server-authoritative amounts (2026-07-15 faucet budget --
-- docs/game-economy-bm-proposal.md's "확정 파우셋" table is the source of
-- truth this CASE mirrors):
--
--   settle_first_feed / settle_first_play / settle_first_chat_hello /
--   settle_first_walk / settle_first_photo   -- +1 each, one-time "moving in"
--                                                settlement gifts.
--   streak_3 / streak_7 / streak_14 / streak_30
--                                             -- +2 / +3 / +5 / +8, one-time
--                                                care-streak milestones (NOT
--                                                the existing recurring
--                                                every-3rd/7th-day snack --
--                                                see careStreak.ts).
--   letter_month_<N> (N >= 1, e.g. letter_month_1)
--                                             -- +5, one-time per month index
--                                                -- the digits in the key
--                                                itself are what make a
--                                                later month naturally
--                                                idempotent-distinct from an
--                                                earlier one, no separate
--                                                month column needed.
--   collection_complete                      -- +10 (replaces/lowers the
--                                                walk journal's previous
--                                                client-local +20 -- see
--                                                walkCollection.ts's
--                                                WALK_COLLECTION_COMPLETE_CREDITS,
--                                                which stays 20 as the
--                                                offline/dev-only fallback).
--   bond_5 / bond_10                         -- +5 / +10, unchanged amounts
--                                                from bondRewards.ts's
--                                                bondLevelRewards, just moved
--                                                from bonusCredits onto this
--                                                server ledger.
--
-- Any other p_reward_key returns 'unknown_reward' and never touches the
-- wallet -- this is the server's whitelist, a client can never invent a new
-- key or amount.
--
-- Returns (outcome, balance):
--   'granted'         -- first-ever claim of this key for this user; balance
--                         is the new credit_wallets.balance.
--   'already_claimed' -- this user already claimed this exact key before
--                         (checked explicitly below, ahead of grant_credits'
--                         own idempotency, so the two outcomes are
--                         distinguishable rather than both reading as a
--                         silent 'granted' replay); balance is the current
--                         credit_wallets.balance.
--   'unknown_reward'  -- p_reward_key isn't in the whitelist above; balance
--                         is the current credit_wallets.balance (0 if no
--                         wallet row yet).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_credit_reward(p_reward_key TEXT)
RETURNS TABLE (
  outcome TEXT,
  balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_balance INTEGER;
  v_amount INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'claim_credit_reward: authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_reward_key IS NULL OR btrim(p_reward_key) = '' OR char_length(p_reward_key) > 64 THEN
    RAISE EXCEPTION 'claim_credit_reward: invalid reward key' USING ERRCODE = '22023';
  END IF;

  -- Server-authoritative reward whitelist (2026-07-15 faucet budget). See
  -- this function's header comment for what each key means and why the
  -- amount lives only here, never client-supplied.
  v_amount := CASE
    WHEN p_reward_key IN (
      'settle_first_feed',
      'settle_first_play',
      'settle_first_chat_hello',
      'settle_first_walk',
      'settle_first_photo'
    ) THEN 1
    WHEN p_reward_key = 'streak_3' THEN 2
    WHEN p_reward_key = 'streak_7' THEN 3
    WHEN p_reward_key = 'streak_14' THEN 5
    WHEN p_reward_key = 'streak_30' THEN 8
    WHEN p_reward_key = 'collection_complete' THEN 10
    WHEN p_reward_key = 'bond_5' THEN 5
    WHEN p_reward_key = 'bond_10' THEN 10
    -- letter_month_<N>: N must be a positive integer with no leading zero,
    -- matching getLetterMonthRewardKey in packages/shared/src/domain/
    -- creditRewards.ts.
    WHEN p_reward_key ~ '^letter_month_[1-9][0-9]*$' THEN 5
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RETURN QUERY SELECT 'unknown_reward'::TEXT,
      COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0);
    RETURN;
  END IF;

  -- Serialize retries for this exact (user, key) before either the
  -- already-claimed check below or consume_credits' idempotency check runs,
  -- same reasoning as 0019/0021's advisory locks.
  PERFORM pg_advisory_xact_lock(hashtext('credit-reward:' || v_user::TEXT || ':' || p_reward_key));

  -- Checked explicitly (rather than only relying on grant_credits' own
  -- idempotency short-circuit) so a repeat claim reads back as
  -- 'already_claimed' instead of an indistinguishable 'granted' replay.
  PERFORM 1 FROM public.credit_ledger
    WHERE user_id = v_user AND reason = 'grant_reward'
      AND ref_type = 'reward' AND ref_id = p_reward_key;

  IF FOUND THEN
    SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0)
      INTO v_balance;

    RETURN QUERY SELECT 'already_claimed'::TEXT, v_balance;
    RETURN;
  END IF;

  v_balance := public.grant_credits(
    v_user,
    v_amount,
    'grant_reward',
    'reward',
    p_reward_key,
    jsonb_build_object('reward_key', p_reward_key, 'credit_amount', v_amount)
  );

  RETURN QUERY SELECT 'granted'::TEXT, v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_credit_reward(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_credit_reward(TEXT) TO authenticated;

COMMIT;
