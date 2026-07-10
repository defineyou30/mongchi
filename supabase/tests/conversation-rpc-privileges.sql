BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(18);

INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('00000000-0000-0000-0000-000000000201', 'rpc-owner@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000202', 'rpc-non-owner@example.invalid', 'authenticated', 'authenticated');

INSERT INTO public.conversations (id, user_id, pet_id, type, status)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000201',
  'privilege-test-pet',
  'premium_ai_chat',
  'open'
);

INSERT INTO public.conversation_messages (id, conversation_id, user_id, sender, text, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'user',
    'compact fixture',
    '2000-01-01T00:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'pet_ai',
    'purge fixture',
    '2000-02-01T00:00:00Z'
  );

SELECT ok(
  NOT has_function_privilege('anon', 'public.compact_conversation(uuid,text,timestamp with time zone)', 'EXECUTE'),
  'anon cannot execute compact_conversation'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.compact_conversation(uuid,text,timestamp with time zone)', 'EXECUTE'),
  'authenticated cannot execute compact_conversation'
);
SELECT ok(
  has_function_privilege('service_role', 'public.compact_conversation(uuid,text,timestamp with time zone)', 'EXECUTE'),
  'service_role can execute compact_conversation'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.purge_expired_conversation_messages(integer,integer)', 'EXECUTE'),
  'anon cannot execute purge_expired_conversation_messages'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.purge_expired_conversation_messages(integer,integer)', 'EXECUTE'),
  'authenticated cannot execute purge_expired_conversation_messages'
);
SELECT ok(
  has_function_privilege('service_role', 'public.purge_expired_conversation_messages(integer,integer)', 'EXECUTE'),
  'service_role can execute purge_expired_conversation_messages'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
SET LOCAL ROLE authenticated;
SELECT results_eq(
  $$SELECT id FROM public.conversations ORDER BY id$$,
  $$VALUES ('00000000-0000-0000-0000-000000000301'::uuid)$$,
  'owner can read the owner conversation API row'
);
SELECT results_eq(
  $$SELECT id FROM public.conversation_messages ORDER BY id$$,
  $$VALUES
    ('00000000-0000-0000-0000-000000000401'::uuid),
    ('00000000-0000-0000-0000-000000000402'::uuid)$$,
  'owner can read the owner conversation message API rows'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM public.conversations),
  0::bigint,
  'non-owner cannot read another user conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversation_messages),
  0::bigint,
  'non-owner cannot read another user conversation messages'
);
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.compact_conversation('00000000-0000-0000-0000-000000000000', 'blocked', now())$$,
  '42501',
  'permission denied for function compact_conversation',
  'anon compact_conversation call is denied'
);
SELECT throws_ok(
  $$SELECT public.purge_expired_conversation_messages(30, 1)$$,
  '42501',
  'permission denied for function purge_expired_conversation_messages',
  'anon purge call is denied'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.compact_conversation('00000000-0000-0000-0000-000000000000', 'blocked', now())$$,
  '42501',
  'permission denied for function compact_conversation',
  'authenticated compact_conversation call is denied'
);
SELECT throws_ok(
  $$SELECT public.purge_expired_conversation_messages(30, 1)$$,
  '42501',
  'permission denied for function purge_expired_conversation_messages',
  'authenticated purge call is denied'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(
  public.compact_conversation(
    '00000000-0000-0000-0000-000000000301',
    'service role probe',
    '2000-01-02T00:00:00Z'
  ),
  1,
  'service_role compact_conversation call succeeds and deletes its fixture'
);
SELECT lives_ok(
  $$SELECT public.purge_expired_conversation_messages(30, 1)$$,
  'service_role purge call succeeds'
);
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'conversations_select_own'
  ),
  'conversation owner read policy remains installed'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_messages'
      AND policyname = 'conversation_messages_select_own'
  ),
  'conversation message owner read policy remains installed'
);

SELECT * FROM finish();

ROLLBACK;
