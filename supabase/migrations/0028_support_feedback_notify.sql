-- Support/feedback submissions -> Slack notification.
--
-- Context: 0024_support_feedback.sql's submit_support_feedback RPC writes
-- rows into support_feedback but nothing reads that table -- there is no
-- support dashboard yet and no operator is ever notified that a new
-- generation-issue report, free-text feedback, or support request arrived.
-- This migration closes that gap with an AFTER INSERT trigger that fires
-- the new supabase/functions/support-feedback-notify Edge Function, which
-- in turn forwards a short summary to a Slack Incoming Webhook.
--
-- Design choice: a dedicated Edge Function reached via a pg_net-backed
-- trigger, not Supabase's built-in Database Webhooks dashboard feature --
-- the HTTP call, payload shape, and secret verification all live in
-- reviewable source (this file + support-feedback-notify/index.ts) instead
-- of dashboard-only configuration that this repository cannot diff or
-- review.
--
-- pg_net: ships as a Supabase-maintained extension and is installed (in the
-- `net` schema) on every hosted Supabase project -- it is literally what
-- the dashboard's own Database Webhooks feature is built on. It is not
-- guaranteed present in every local/CI Postgres instance this repository's
-- migration tooling might run against, so, mirroring
-- 0027_generation_ip_throttle.sql's pg_cron guard exactly, the trigger
-- below is only created when pg_net is already installed; otherwise this
-- migration emits a NOTICE and skips it rather than failing.
--
-- notify_support_feedback() (the trigger function) wraps its entire body in
-- BEGIN/EXCEPTION WHEN OTHERS -> NULL, so nothing it does -- a missing
-- pg_net function, a permission error, a bad header value -- can ever raise
-- out of the trigger and roll back the INSERT that fired it. pg_net's
-- net.http_post is itself async (it queues the request and returns
-- immediately; the actual HTTP call happens in a background worker), so the
-- caller's transaction is never blocked waiting on Slack either way.
--
-- Secret handoff: the Edge Function URL is a non-secret, project-specific
-- constant (hardcoded below, same reasoning as 0026/0027's other
-- project-pinned values) since it is just this project's own function
-- endpoint. SUPPORT_NOTIFY_SECRET is the opposite -- genuinely secret -- so
-- it is never hardcoded here; the trigger reads it from Supabase Vault
-- (hosted projects reject ALTER DATABASE ... SET for custom GUCs), which an
-- operator seeds once, out of band, with:
--
--   SELECT vault.create_secret('<value>', 'support_notify_secret');
--
-- and the identical value is set as the support-feedback-notify Edge
-- Function's SUPPORT_NOTIFY_SECRET secret. If the Vault entry is missing,
-- the trigger sends an empty header and the Edge Function's constant-time
-- comparison simply rejects the call (401) -- the INSERT still succeeds
-- either way.
--
-- Privacy: the trigger's payload is deliberately built from only
-- NEW.category/subcategory/message/locale/platform. NEW.user_id and
-- NEW.contact are never read into the payload -- see
-- support-feedback-notify/index.ts's module doc comment for the receiving
-- side of that same guarantee.

BEGIN;

-- ---------------------------------------------------------------------------
-- Trigger function: notify_support_feedback
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_support_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://cxusiexdwgpfcpirefro.supabase.co/functions/v1/support-feedback-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Support-Notify-Secret', COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'support_notify_secret' LIMIT 1),
          ''
        )
      ),
      body := jsonb_build_object(
        'category', NEW.category,
        'subcategory', NEW.subcategory,
        'message', NEW.message,
        'locale', NEW.locale,
        'platform', NEW.platform
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let a notification failure block the support_feedback INSERT
    -- that triggered it -- see this file's header comment.
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: support_feedback_notify_trigger
--
-- Guarded exactly like 0027_generation_ip_throttle.sql's pg_cron schedule --
-- only created when pg_net is installed, otherwise a NOTICE and a skip
-- rather than a failed migration.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    DROP TRIGGER IF EXISTS support_feedback_notify_trigger ON public.support_feedback;

    CREATE TRIGGER support_feedback_notify_trigger
      AFTER INSERT ON public.support_feedback
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_support_feedback();
  ELSE
    RAISE NOTICE 'pg_net extension not installed -- skipping support_feedback_notify_trigger (0028_support_feedback_notify.sql). Create it manually once pg_net is available.';
  END IF;
END;
$$;

COMMIT;
