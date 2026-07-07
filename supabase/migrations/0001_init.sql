-- Mongchi Supabase backend: initial schema for AI avatar generation.
--
-- Scope: generation_jobs / generated_assets / generation_quota tables, quota
-- consume/refund RPCs, row-level security (read-only for authenticated users;
-- all writes happen through the generate-avatar Edge Function using the
-- service_role key), and the private pet-media storage bucket.

BEGIN;

-- ---------------------------------------------------------------------------
-- generation_jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created' CHECK (
    status IN (
      'created',
      'safety_checking',
      'generating',
      'quality_checking',
      'uploading_assets',
      'completed',
      'failed'
    )
  ),
  input_snapshot JSONB NOT NULL,
  required_states TEXT[] NOT NULL DEFAULT '{idle,happy,sleep}',
  original_photo_path TEXT,
  failure_code TEXT,
  failure_message_safe TEXT,
  quality JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS generation_jobs_user_created_idx
  ON public.generation_jobs(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- generated_assets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_assets_job_idx
  ON public.generated_assets(job_id);

-- ---------------------------------------------------------------------------
-- generation_quota
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.generation_quota (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  free_used INTEGER NOT NULL DEFAULT 0,
  free_limit INTEGER NOT NULL DEFAULT 1,
  paid_credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RPC: consume_generation_quota
--
-- Ensures a quota row exists, then atomically consumes one unit of quota:
-- paid_credits first, falling back to the free allowance. Returns true when
-- a unit was consumed, false when the user is out of quota. SECURITY DEFINER
-- so it can run under the caller's JWT (auth.uid()) while still touching a
-- table that has no direct write policy for authenticated users.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_generation_quota(p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  INSERT INTO public.generation_quota (user_id)
  VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.generation_quota
  SET
    paid_credits = CASE WHEN paid_credits > 0 THEN paid_credits - 1 ELSE paid_credits END,
    free_used = CASE WHEN paid_credits > 0 THEN free_used ELSE free_used + 1 END,
    updated_at = now()
  WHERE user_id = p_user
    AND (paid_credits > 0 OR free_used < free_limit);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: refund_generation_quota
--
-- Rolls back the unit consumed by consume_generation_quota, used when a
-- generation job fails the safety or quality gate after quota was already
-- spent. Mirrors the consume priority: if a paid credit could plausibly have
-- been the one spent (free allowance already exhausted), refund it there;
-- otherwise refund the free allowance.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refund_generation_quota(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.generation_quota
  SET
    paid_credits = CASE WHEN free_used >= free_limit THEN paid_credits + 1 ELSE paid_credits END,
    free_used = CASE WHEN free_used >= free_limit THEN free_used ELSE GREATEST(free_used - 1, 0) END,
    updated_at = now()
  WHERE user_id = p_user;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Read-only policies for the owning user. No write policies: all inserts/
-- updates for these tables happen inside the generate-avatar Edge Function
-- using the service_role key, which bypasses RLS entirely.
-- ---------------------------------------------------------------------------

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY generation_jobs_select_own
  ON public.generation_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY generated_assets_select_own
  ON public.generated_assets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY generation_quota_select_own
  ON public.generation_quota
  FOR SELECT
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: pet-media private bucket
--
-- Layout: original-photos/{user_id}/{...} and avatars/{user_id}/{job_id}/{state}.png
-- storage.foldername(name) splits the object path into an array of folder
-- segments, so for "original-photos/<user_id>/<file>" index 1 is the
-- top-level prefix and index 2 is the user id folder.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-media', 'pet-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY pet_media_select_own
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'pet-media'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Only original-photos/{user_id}/... uploads are allowed from clients.
-- avatars/ is written exclusively by the Edge Function via service_role,
-- which bypasses RLS, so no insert policy is defined for that prefix.
CREATE POLICY pet_media_insert_own_original_photo
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'pet-media'
    AND (storage.foldername(name))[1] = 'original-photos'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

COMMIT;
