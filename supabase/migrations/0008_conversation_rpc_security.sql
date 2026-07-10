BEGIN;

REVOKE EXECUTE ON FUNCTION public.compact_conversation(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_conversation_messages(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.compact_conversation(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_conversation_messages(INTEGER, INTEGER) TO service_role;

COMMIT;
