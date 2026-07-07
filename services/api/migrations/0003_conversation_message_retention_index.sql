BEGIN;

CREATE INDEX IF NOT EXISTS conversation_messages_created_at_idx
  ON public.conversation_messages(created_at, id);

COMMIT;
