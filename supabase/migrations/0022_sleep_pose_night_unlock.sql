-- Scope: adds unlock_sleep_pose_for_night_visit(), a second, independent way
-- to unlock a pet's `sleep` starter pose.
--
-- Why this is needed: 0011_harden_starter_pose_unlocks.sql's
-- unlock_starter_poses_for_care_action only ever unlocks the `sleep` asset
-- when p_action = 'rest', and 'rest' has no reachable entry point in the
-- mobile UI's care actions -- so every pet's sleep pose has been permanently
-- locked since that hardening shipped, even though the night-sleep visuals
-- (TerrariumHomeScreen's isShowingNightSleepPose / NightOverlayLayer) have
-- been ready to render it the whole time. 0011's rest-based path is left
-- exactly as-is (still reachable the moment a future care action ever maps
-- to 'rest') -- this migration only adds a second door to the same room.
--
-- Design: "spend a first night (22:00-06:00 local) with your pet and its
-- sleep pose unlocks." Unlike unlock_starter_poses_for_care_action /
-- unlock_starter_pose, this RPC takes no p_job_id -- it unlocks every one of
-- the caller's own completed, still-locked `sleep` assets in a single call
-- (a caller may have more than one pet bundle), scoped entirely by
-- auth.uid(). Calling it again after the caller's sleep asset(s) are already
-- unlocked is a harmless no-op: the WHERE clause's unlocked_at IS NULL
-- excludes them, so the RETURNING set is simply empty.
--
-- Deliberately does NOT re-validate "is it actually night" server-side.
-- "Night" here is the owner's own device-local wall clock -- the same
-- notion of night the rest of the night-sleep UI already trusts (see
-- packages/shared/src/domain/dayNightCycle.ts's isNightTime). A clock-skewed
-- or manually-changed device can only ever unlock its own already-generated
-- sleep pose a little earlier than it otherwise would -- never another
-- user's data, another pet's asset, or anything paid -- so trusting the
-- client's timing here is harmless by construction.

BEGIN;

CREATE OR REPLACE FUNCTION public.unlock_sleep_pose_for_night_visit()
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
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.generated_assets asset
  SET unlocked_at = COALESCE(asset.unlocked_at, now())
  FROM public.generation_jobs job
  WHERE asset.job_id = job.id
    AND asset.user_id = auth.uid()
    AND job.user_id = auth.uid()
    AND job.status = 'completed'
    AND job.source_asset_path IS NULL
    AND asset.state = 'sleep'
    AND asset.unlocked_at IS NULL
  RETURNING asset.job_id, asset.state, asset.storage_path, asset.width, asset.height;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_sleep_pose_for_night_visit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlock_sleep_pose_for_night_visit() FROM anon;
GRANT EXECUTE ON FUNCTION public.unlock_sleep_pose_for_night_visit() TO authenticated;

COMMIT;
