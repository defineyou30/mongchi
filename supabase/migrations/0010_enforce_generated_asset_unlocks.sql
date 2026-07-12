BEGIN;

ALTER TABLE public.generated_assets
  ALTER COLUMN unlocked_at DROP DEFAULT;

DROP POLICY IF EXISTS generated_assets_select_own ON public.generated_assets;

CREATE POLICY generated_assets_select_unlocked_own
  ON public.generated_assets
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND unlocked_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.generation_jobs job
      WHERE job.id = generated_assets.job_id
        AND job.status = 'completed'
    )
  );

DROP POLICY IF EXISTS pet_media_select_own ON storage.objects;

CREATE POLICY pet_media_select_unlocked_own
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'pet-media'
    AND auth.uid()::text = (storage.foldername(name))[2]
    AND (
      (storage.foldername(name))[1] = 'original-photos'
      OR (
        (storage.foldername(name))[1] = 'avatars'
        AND EXISTS (
          SELECT 1
          FROM public.generated_assets asset
          JOIN public.generation_jobs job ON job.id = asset.job_id
          WHERE asset.storage_path = storage.objects.name
            AND asset.user_id = auth.uid()
            AND asset.unlocked_at IS NOT NULL
            AND job.status = 'completed'
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.unlock_starter_pose(p_job_id UUID, p_state TEXT)
RETURNS TABLE (
  job_id UUID,
  state TEXT,
  storage_path TEXT,
  width INTEGER,
  height INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_state NOT IN ('happy', 'sleep') THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.generated_assets asset
  SET unlocked_at = COALESCE(asset.unlocked_at, now())
  FROM public.generation_jobs job
  WHERE asset.job_id = p_job_id
    AND asset.job_id = job.id
    AND asset.user_id = auth.uid()
    AND asset.state = p_state
    AND job.user_id = auth.uid()
    AND job.status = 'completed'
    AND job.source_asset_path IS NULL
  RETURNING asset.job_id, asset.state, asset.storage_path, asset.width, asset.height;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_starter_pose(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlock_starter_pose(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.unlock_starter_pose(UUID, TEXT) TO authenticated;

COMMIT;
