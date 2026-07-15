BEGIN;

CREATE OR REPLACE FUNCTION public.grant_starter_credits_on_generation_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_asset_path IS NULL
    AND (
      NEW.status = 'completed'
      OR (NEW.status = 'cleanup_pending' AND NEW.cleanup_target_status = 'completed')
    )
  THEN
    PERFORM public.grant_credits(
      NEW.user_id,
      12,
      'grant_starter',
      'user',
      'starter_v1',
      jsonb_build_object('source', 'generation_completion_trigger', 'job_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_starter_credits_on_generation_completion()
  FROM PUBLIC, anon, authenticated;

COMMIT;
