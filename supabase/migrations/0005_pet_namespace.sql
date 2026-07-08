-- Mongchi Supabase backend: multi-pet server namespace (Multi-pet Wave 2).
--
-- Scope: adds a nullable pet_id column to generation_jobs/generated_assets so
-- a user's generations can be scoped to a specific pet, and a new pet_slots
-- table + three RPCs (grant_pet_slot / reserve_pet_generation_slot /
-- refund_pet_generation_slot) that gate how many pets a user is allowed to
-- create and how a second (or later) pet's first generation gets funded.
-- Pairs with supabase/functions/generate-avatar/index.ts, which is the only
-- caller of these RPCs today.
--
-- Backward compatibility principle (applies throughout this migration):
-- pet_id is NULL for every row written by a client that hasn't been updated
-- to send it yet (the entire fleet as of this migration -- see
-- docs/multi-pet-slot-plan.md, wave W3 is the client work that starts
-- sending it). NULL pet_id means "the user's first/only pet" and is treated
-- everywhere below as its own distinct pet identity, on equal footing with
-- any real pet_id string a future client sends. Existing rows are untouched
-- (ADD COLUMN with no default backfill needed since NULL is exactly the
-- correct value for them).
--
-- See docs/multi-pet-slot-plan.md ("웨이브 분해 W2", "아키텍처") and
-- docs/credit-phase1-design.md §4.4/§3.5 (this migration fulfills the
-- consume_credits(reason='consume_pet_slot') contract that document
-- pre-reserved).

BEGIN;

-- ---------------------------------------------------------------------------
-- generation_jobs.pet_id / generated_assets.pet_id
--
-- Which pet a job/asset belongs to. NULL = the pre-multi-pet first pet (see
-- backward-compat note above). Populated from the request body's optional
-- pet_id field by the Edge Function; never written directly by clients
-- (both tables keep their existing no-write RLS policy).
-- ---------------------------------------------------------------------------

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS pet_id TEXT;

ALTER TABLE public.generated_assets
  ADD COLUMN IF NOT EXISTS pet_id TEXT;

-- Storage layout note (see 0001_init.sql's "Storage: pet-media private
-- bucket" section and supabase/functions/generate-avatar/index.ts): when a
-- job carries a pet_id, the Edge Function now writes generated assets to
-- avatars/{user_id}/{pet_id}/{job_id}/{state}.png instead of the legacy
-- avatars/{user_id}/{job_id}/{state}.png. This inserts one extra path
-- segment *after* user_id, so it does not disturb the existing
-- pet_media_select_own RLS policy, which keys off
-- (storage.foldername(name))[2] = auth.uid()::text -- user_id stays at
-- index 2 in both layouts. No storage policy change is needed here.

-- Speeds up reserve_pet_generation_slot's "how many distinct pets has this
-- user already completed a first generation for" query below, and the Edge
-- Function's per-pet seed-ownership check for expression pack requests.
CREATE INDEX IF NOT EXISTS generation_jobs_user_pet_status_idx
  ON public.generation_jobs(user_id, pet_id, status);

CREATE INDEX IF NOT EXISTS generated_assets_user_pet_idx
  ON public.generated_assets(user_id, pet_id);

-- ---------------------------------------------------------------------------
-- pet_slots
--
-- One row per user, lazily created (mirrors credit_wallets). extra_slots is
-- how many pets beyond the first this user has purchased room for; launch
-- caps this at 1 (2 pets total), enforced both here (CHECK) and in
-- grant_pet_slot (which refuses to charge past the cap). bundled_generation_
-- available tracks whether the most recently purchased slot's included
-- "generate the new pet once, free" bundle (docs/multi-pet-slot-plan.md
-- BM §"슬롯 50cr에 새 펫 생성 1회 번들 포함") has been spent yet. This is a
-- boolean rather than a counter because extra_slots is capped at 1 today --
-- at most one bundled generation can ever be outstanding. If the slot cap
-- ever rises above 1, this needs to become a counter (e.g. bundled_
-- generations_available INTEGER) so multiple purchased-but-unused bundles
-- can be tracked independently; a single boolean would under-count.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pet_slots (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  extra_slots INTEGER NOT NULL DEFAULT 0 CHECK (extra_slots >= 0 AND extra_slots <= 1),
  bundled_generation_available BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_slots ENABLE ROW LEVEL SECURITY;

-- Read-only for the owning user, matching every other table in this project
-- (0001_init.sql / 0002_rate_limit.sql / 0004_credit_ledger.sql): no write
-- policy exists, so all writes happen through the SECURITY DEFINER RPCs
-- below or the Edge Function's service_role key.
CREATE POLICY pet_slots_select_own ON public.pet_slots
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPC: grant_pet_slot
--
-- Purchases one extra pet slot for 50 credits, atomically: the credit debit
-- (via consume_credits) and the extra_slots increment + bundled-generation
-- grant happen in this single function invocation, i.e. one DB transaction
-- -- either both happen or (on any error) neither does. This is the "슬롯
-- 구매 = 서버 크레딧 50 차감과 원자적으로" requirement from
-- docs/multi-pet-slot-plan.md.
--
-- The extra_slots <= 1 cap (docs/multi-pet-slot-plan.md: "유저당 extra_slots
-- 상한 1, 총 2마리") is enforced here BEFORE charging, so a user who is
-- already at the cap is never billed for a slot they can't use.
--
-- Idempotent via p_request_id: checks credit_ledger directly (rather than
-- re-deriving success from consume_credits' return value) so a retried call
-- after a slot was already granted returns 'ok' without re-incrementing
-- extra_slots/re-granting the bundle a second time -- consume_credits' own
-- idempotency alone would prevent double-charging but NOT double-granting,
-- since the slot grant is a side effect outside credit_ledger.
--
-- Returns: 'ok' | 'slot_limit_reached' | 'insufficient_credits'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.grant_pet_slot(
  p_user       UUID,
  p_request_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_granted BOOLEAN;
  v_extra_slots INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_request_id IS NULL OR length(trim(p_request_id)) = 0 THEN
    RAISE EXCEPTION 'grant_pet_slot: p_request_id is required';
  END IF;

  -- Idempotent retry: this exact purchase already succeeded (a
  -- consume_pet_slot ledger row for this request already exists), which
  -- means extra_slots/bundled_generation_available were already updated too
  -- -- return success without touching either again.
  SELECT EXISTS (
    SELECT 1 FROM public.credit_ledger
    WHERE user_id = p_user AND reason = 'consume_pet_slot'
      AND ref_type = 'pet_slot' AND ref_id = p_request_id
  ) INTO v_already_granted;

  IF v_already_granted THEN
    RETURN 'ok';
  END IF;

  INSERT INTO public.pet_slots (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT extra_slots INTO v_extra_slots
  FROM public.pet_slots WHERE user_id = p_user
  FOR UPDATE;

  IF v_extra_slots >= 1 THEN
    RETURN 'slot_limit_reached';
  END IF;

  -- consume_credits is itself idempotent on (user, reason, ref_type, ref_id)
  -- and atomic (row-locks credit_wallets) -- see 0004_credit_ledger.sql. It
  -- runs inside this same function invocation/transaction, so a failure here
  -- rolls back the debit too.
  SELECT public.consume_credits(
    p_user, 50, 'consume_pet_slot', 'pet_slot', p_request_id, NULL
  ) INTO v_new_balance;

  IF v_new_balance = -1 THEN
    RETURN 'insufficient_credits';
  END IF;

  UPDATE public.pet_slots
    SET extra_slots = extra_slots + 1,
        bundled_generation_available = true,
        updated_at = now()
    WHERE user_id = p_user;

  RETURN 'ok';
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: reserve_pet_generation_slot
--
-- Called by generate-avatar before funding a non-expression-pack (fresh
-- photo) generation request, to decide whether it's gated by pet_slots
-- instead of the free per-user generation_quota allowance.
--
-- "Completed pet count" is computed from generation_jobs: the number of
-- DISTINCT pet_id values (NULL counted as its own distinct value, via
-- COALESCE to a sentinel) among that user's status='completed',
-- original_photo_path IS NOT NULL jobs. original_photo_path IS NOT NULL
-- restricts this to "brought a new pet to life" jobs -- expression pack
-- completions (source_asset_path-based, original_photo_path NULL) don't
-- count, since by construction they can only ever target a pet that already
-- has a completed from-photo generation. generated_assets was also a
-- candidate (docs/multi-pet-slot-plan.md mentions either table), but
-- generation_jobs.status is a more direct, explicit "this pet's first
-- generation succeeded" signal than inferring success from asset-row
-- existence.
--
-- Decision:
--   * If p_pet_id already has a completed from-photo job (re-generating an
--     already-existing pet -- unusual but not disallowed) OR this user has
--     zero completed pets yet (their very first pet), this is NOT a "new
--     pet beyond the first" event -- return 'ok_default' so the caller keeps
--     using the existing free generation_quota path unchanged.
--   * Otherwise this is a genuinely new pet beyond the user's first. Allowed
--     only if completed_count < 1 + extra_slots (room under the purchased
--     cap) AND a bundled generation is still available (each purchased slot
--     grants exactly one, per docs/multi-pet-slot-plan.md's "슬롯당 정확히
--     1회" -- never an unlimited bypass like the expression-pack quota-skip
--     bug that credit Phase 1 closed). On success, atomically consumes the
--     bundle (sets bundled_generation_available = false) and returns
--     'ok_slot_bundle', telling the caller to skip BOTH generation_quota and
--     consume_credits for this request -- it was already paid for in full at
--     slot-purchase time. Otherwise returns 'slot_required' (caller maps to
--     402), which the client is expected to resolve via grant_pet_slot.
--
-- Row-locks pet_slots (FOR UPDATE) so two concurrent "create my second pet"
-- requests can't both observe the bundle as available and both consume it.
--
-- Returns: 'ok_default' | 'ok_slot_bundle' | 'slot_required'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reserve_pet_generation_slot(
  p_user   UUID,
  p_pet_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_count INTEGER;
  v_pet_already_completed BOOLEAN;
  v_extra_slots INTEGER;
  v_bundle_available BOOLEAN;
BEGIN
  SELECT count(DISTINCT COALESCE(pet_id, '')) INTO v_completed_count
  FROM public.generation_jobs
  WHERE user_id = p_user AND status = 'completed' AND original_photo_path IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM public.generation_jobs
    WHERE user_id = p_user AND status = 'completed' AND original_photo_path IS NOT NULL
      AND ((p_pet_id IS NULL AND pet_id IS NULL) OR pet_id = p_pet_id)
  ) INTO v_pet_already_completed;

  IF v_pet_already_completed OR v_completed_count = 0 THEN
    RETURN 'ok_default';
  END IF;

  INSERT INTO public.pet_slots (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT extra_slots, bundled_generation_available INTO v_extra_slots, v_bundle_available
  FROM public.pet_slots WHERE user_id = p_user
  FOR UPDATE;

  IF v_completed_count >= (1 + v_extra_slots) OR NOT v_bundle_available THEN
    RETURN 'slot_required';
  END IF;

  UPDATE public.pet_slots
    SET bundled_generation_available = false, updated_at = now()
    WHERE user_id = p_user;

  RETURN 'ok_slot_bundle';
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: refund_pet_generation_slot
--
-- Restores the bundled-generation grant consumed by reserve_pet_generation_
-- slot when the resulting job subsequently fails -- mirrors refund_credits/
-- refund_generation_quota's "a paid-for attempt that never delivered
-- shouldn't cost the user anything" principle (docs/credit-phase1-design.md
-- risk #2) so a transient generation failure doesn't burn the one bundled
-- generation a purchased slot grants. Not ref-keyed/idempotent by itself
-- (unlike refund_credits) -- like refund_generation_quota, it relies on
-- generate-avatar's pipeline calling it at most once per job (every failure
-- path returns immediately after calling markJobFailed once; see
-- supabase/functions/generate-avatar/index.ts).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refund_pet_generation_slot(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pet_slots
    SET bundled_generation_available = true, updated_at = now()
    WHERE user_id = p_user;
END;
$$;

COMMIT;
