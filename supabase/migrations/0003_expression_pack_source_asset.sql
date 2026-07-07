-- Mongchi Supabase backend: expression pack generation mode.
--
-- Scope: adds a nullable source_asset_path column to generation_jobs, used
-- only by the generate-avatar Edge Function's "expression pack" mode (see
-- supabase/functions/generate-avatar/index.ts). In that mode there is no
-- source photo -- the user already deleted it after their first avatar was
-- generated (see 0001_init.sql's privacy-driven original photo deletion) --
-- so new states are instead generated from a previously generated pixel
-- sprite (a generated_assets row, typically the idle state) used as the seed
-- image. original_photo_path stays null for these jobs; source_asset_path
-- carries the seed asset's storage path instead. Kept as its own column
-- (rather than folding into input_snapshot JSONB) because it is a storage
-- path with the same shape/role as original_photo_path, not part of the
-- pet's input snapshot.

BEGIN;

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS source_asset_path TEXT;

COMMIT;
