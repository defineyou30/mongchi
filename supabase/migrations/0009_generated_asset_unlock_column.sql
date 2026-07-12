BEGIN;

ALTER TABLE public.generated_assets
  ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS generated_assets_storage_path_idx
  ON public.generated_assets(storage_path);

COMMIT;
