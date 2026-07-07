BEGIN;

CREATE TABLE IF NOT EXISTS public.generation_issue_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  generation_job_id TEXT REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('wrong_pet', 'unsafe_or_scary', 'poor_quality')),
  reported_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS generation_issue_reports_user_pet_reported_at_idx
  ON public.generation_issue_reports(user_id, pet_id, reported_at DESC);

COMMIT;
