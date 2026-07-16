BEGIN;

-- Lowers the starter credit grant from 12 (0017_adjust_starter_credit_grant.sql)
-- to 5. The first free experience is moving from "one three-pose expression
-- pack" to the premium chat day pass / treats, so the starter grant no longer
-- needs to fund a full expression pack. Mirrors 0017's own pattern: only the
-- trigger function body changes, and already-granted balances are not
-- clawed back (the (grant_starter, user, starter_v1) idempotency key still
-- prevents any user from being granted twice).
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
      5,
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
