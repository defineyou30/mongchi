-- Support/feedback collection backend. Two client entry points land here:
--
--   - SupportScreen's existing generation-issue report buttons
--     (wrong_pet/unsafe_or_scary/poor_quality -- TerrariumSessionProvider's
--     reportGenerationIssue). Prior to this migration that flow only wrote
--     local state + an analytics event; there was no live Supabase table to
--     receive it (services/api's equivalent is dead/legacy).
--   - SupportScreen's new free-text feedback box (message + optional
--     contact), submitted with category 'feedback'.
--
-- Follows 0015_chat_message_reports.sql's report-table shape and
-- 0021_live_shop_purchases.sql's RPC idioms (SECURITY DEFINER, pinned
-- search_path, auth.uid() null guard, advisory lock before a rate-limited
-- write) -- but locks the table down harder than 0015: RLS is enabled with
-- *no* INSERT/SELECT policies at all, so authenticated/anon clients cannot
-- touch support_feedback directly even for their own rows. The only write
-- path is submit_support_feedback below (SECURITY DEFINER, granted to
-- `authenticated`); there is no read path yet either -- a future support
-- dashboard would read this table as service_role.
--
-- 'support' is a reserved third category for a possible future dedicated
-- contact-us flow (also message-required, same validation as 'feedback');
-- no client UI submits it as of this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.support_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('generation_issue', 'feedback', 'support')),
  subcategory TEXT NULL,
  message TEXT NULL CHECK (message IS NULL OR char_length(message) BETWEEN 1 AND 2000),
  contact TEXT NULL CHECK (contact IS NULL OR char_length(contact) <= 200),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  app_version TEXT NULL,
  locale TEXT NULL,
  platform TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_feedback_user_created_idx
  ON public.support_feedback(user_id, created_at);

ALTER TABLE public.support_feedback ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RPC: submit_support_feedback
--
-- Validates the category/subcategory/message combination, rate-limits to 10
-- submissions per rolling 24h per user (returns 'rate_limited' rather than
-- raising, same soft-failure shape as a validation pass -- the client's
-- report/feedback UX always reads as gentle, never an alarming error), then
-- inserts and returns 'submitted'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_support_feedback(
  p_category    TEXT,
  p_subcategory TEXT,
  p_message     TEXT,
  p_contact     TEXT,
  p_context     JSONB,
  p_app_version TEXT,
  p_locale      TEXT,
  p_platform    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_message TEXT := NULLIF(btrim(COALESCE(p_message, '')), '');
  v_contact TEXT := NULLIF(btrim(COALESCE(p_contact, '')), '');
  v_subcategory TEXT := NULLIF(btrim(COALESCE(p_subcategory, '')), '');
  v_recent_count INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'submit_support_feedback: authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_category IS NULL OR p_category NOT IN ('generation_issue', 'feedback', 'support') THEN
    RAISE EXCEPTION 'submit_support_feedback: invalid category' USING ERRCODE = '22023';
  END IF;

  IF p_category = 'generation_issue' THEN
    IF v_subcategory IS NULL OR v_subcategory NOT IN ('wrong_pet', 'unsafe_or_scary', 'poor_quality') THEN
      RAISE EXCEPTION 'submit_support_feedback: invalid subcategory' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_message IS NULL OR char_length(v_message) > 2000 THEN
      RAISE EXCEPTION 'submit_support_feedback: message required' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_contact IS NOT NULL AND char_length(v_contact) > 200 THEN
    RAISE EXCEPTION 'submit_support_feedback: contact too long' USING ERRCODE = '22023';
  END IF;

  -- Serializes concurrent submissions from the same user before the rate
  -- limit's count(*) read, same reasoning as 0007_credit_rpc_security.sql's
  -- check_generation_rate_limit advisory lock -- otherwise a burst of
  -- concurrent calls could all read the same pre-insert count and all pass.
  PERFORM pg_advisory_xact_lock(hashtext('support-feedback:' || v_user::TEXT));

  SELECT count(*) INTO v_recent_count
  FROM public.support_feedback
  WHERE user_id = v_user
    AND created_at >= now() - interval '24 hours';

  IF v_recent_count >= 10 THEN
    RETURN jsonb_build_object('outcome', 'rate_limited');
  END IF;

  INSERT INTO public.support_feedback (
    user_id, category, subcategory, message, contact, context,
    app_version, locale, platform
  ) VALUES (
    v_user, p_category, v_subcategory, v_message, v_contact,
    COALESCE(p_context, '{}'::jsonb),
    NULLIF(btrim(COALESCE(p_app_version, '')), ''),
    NULLIF(btrim(COALESCE(p_locale, '')), ''),
    NULLIF(btrim(COALESCE(p_platform, '')), '')
  );

  RETURN jsonb_build_object('outcome', 'submitted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_support_feedback(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_support_feedback(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

COMMIT;
