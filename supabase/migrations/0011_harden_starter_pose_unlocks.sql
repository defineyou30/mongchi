BEGIN;

DROP FUNCTION IF EXISTS public.unlock_starter_pose(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.unlock_starter_poses_for_care_action(
  p_job_id UUID,
  p_action TEXT
)
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
  IF auth.uid() IS NULL OR p_action NOT IN (
    'feed',
    'talk',
    'walk',
    'play',
    'rest',
    'affection',
    'water_garden',
    'clean',
    'treat'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.generated_assets asset
  SET unlocked_at = COALESCE(asset.unlocked_at, now())
  FROM public.generation_jobs job
  WHERE asset.job_id = p_job_id
    AND asset.job_id = job.id
    AND asset.user_id = auth.uid()
    AND job.user_id = auth.uid()
    AND job.status = 'completed'
    AND job.source_asset_path IS NULL
    AND (
      asset.state = 'happy'
      OR (asset.state = 'sleep' AND p_action = 'rest')
    )
  RETURNING asset.job_id, asset.state, asset.storage_path, asset.width, asset.height;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_starter_poses_for_care_action(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlock_starter_poses_for_care_action(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.unlock_starter_poses_for_care_action(UUID, TEXT) TO authenticated;

COMMIT;
