BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('harmful', 'inappropriate', 'inaccurate', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS chat_message_reports_status_created_idx
  ON public.chat_message_reports(status, created_at);

ALTER TABLE public.chat_message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_message_reports_select_own ON public.chat_message_reports;
CREATE POLICY chat_message_reports_select_own
  ON public.chat_message_reports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.report_chat_message(
  p_message_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conversation_id UUID;
  v_report_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'report_chat_message: unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_reason NOT IN ('harmful', 'inappropriate', 'inaccurate', 'other') THEN
    RAISE EXCEPTION 'report_chat_message: invalid reason' USING ERRCODE = '22023';
  END IF;

  SELECT cm.conversation_id INTO v_conversation_id
  FROM public.conversation_messages cm
  WHERE cm.id = p_message_id
    AND cm.user_id = v_user
    AND cm.sender = 'pet_ai';

  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'report_chat_message: message not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.chat_message_reports (
    user_id,
    conversation_id,
    message_id,
    reason
  ) VALUES (
    v_user,
    v_conversation_id,
    p_message_id,
    p_reason
  )
  ON CONFLICT (user_id, message_id) DO UPDATE
  SET reason = EXCLUDED.reason,
      status = 'pending',
      updated_at = now()
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_chat_message(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_chat_message(UUID, TEXT)
  TO authenticated;

COMMIT;
