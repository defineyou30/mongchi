BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT no_plan();

INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('00000000-0000-0000-0000-000000000501', 'generation-durability@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000502', 'generation-completion@example.invalid', 'authenticated', 'authenticated');

SELECT set_config('request.jwt.claim.role', 'service_role', true);
SET LOCAL ROLE service_role;

INSERT INTO public.credit_wallets (user_id, balance)
VALUES ('00000000-0000-0000-0000-000000000501', 36);

CREATE TEMP TABLE expression_create_result AS
SELECT * FROM public.create_expression_pack_job(
  '00000000-0000-0000-0000-000000000501',
  12,
  'durability-expression-1',
  'pack-everyday-moments',
  '{"species":"dog"}'::jsonb,
  'avatars/00000000-0000-0000-0000-000000000501/seed/idle.png',
  ARRAY['curious', 'play', 'hungry'],
  NULL
);

SELECT is((SELECT outcome FROM expression_create_result), 'created', 'expression funding creates a job');
SELECT is((SELECT balance FROM public.credit_wallets WHERE user_id = '00000000-0000-0000-0000-000000000501'), 24, 'expression funding debits once');
SELECT is(
  (SELECT funding_kind FROM public.generation_jobs WHERE id = (SELECT job_id FROM expression_create_result)),
  'credits',
  'expression job persists its funding kind'
);
SELECT is(
  (SELECT funding_ref FROM public.generation_jobs WHERE id = (SELECT job_id FROM expression_create_result)),
  'durability-expression-1',
  'expression job persists its funding reference'
);

CREATE TEMP TABLE expression_retry_result AS
SELECT * FROM public.create_expression_pack_job(
  '00000000-0000-0000-0000-000000000501',
  12,
  'durability-expression-1',
  'pack-everyday-moments',
  '{"species":"dog"}'::jsonb,
  'avatars/00000000-0000-0000-0000-000000000501/seed/idle.png',
  ARRAY['curious', 'play', 'hungry'],
  NULL
);

SELECT is((SELECT outcome FROM expression_retry_result), 'existing', 'expression retry returns the existing job');
SELECT is((SELECT job_id FROM expression_retry_result), (SELECT job_id FROM expression_create_result), 'expression retry keeps the same job id');
SELECT is(
  (SELECT count(*) FROM public.credit_ledger WHERE user_id = '00000000-0000-0000-0000-000000000501' AND reason = 'consume_expression_pack'),
  1::bigint,
  'expression retry does not double debit'
);

CREATE TEMP TABLE expression_duplicate_product_result AS
SELECT * FROM public.create_expression_pack_job(
  '00000000-0000-0000-0000-000000000501',
  12,
  'durability-expression-2',
  'pack-everyday-moments',
  '{"species":"dog"}'::jsonb,
  'avatars/00000000-0000-0000-0000-000000000501/seed/idle.png',
  ARRAY['curious', 'play', 'hungry'],
  NULL
);

SELECT is((SELECT outcome FROM expression_duplicate_product_result), 'existing', 'a second request id cannot buy the same active pet pack twice');
SELECT is((SELECT job_id FROM expression_duplicate_product_result), (SELECT job_id FROM expression_create_result), 'product ownership deduplicates to the first job');
SELECT is(
  (SELECT count(*) FROM public.credit_ledger WHERE user_id = '00000000-0000-0000-0000-000000000501' AND reason = 'consume_expression_pack'),
  1::bigint,
  'product-level deduplication does not debit again'
);

CREATE TEMP TABLE first_claim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000501',
  (SELECT job_id FROM expression_create_result),
  420
);

SELECT is((SELECT attempt_count FROM first_claim), 1, 'first claim records one attempt');
SELECT is_empty(
  format(
    'SELECT job_id FROM public.claim_generation_job(%L::uuid, %L::uuid, 420)',
    '00000000-0000-0000-0000-000000000501',
    (SELECT job_id FROM expression_create_result)
  ),
  'an active lease cannot be claimed twice'
);

RESET ROLE;
UPDATE public.generation_jobs
SET lease_expires_at = now() - interval '1 second'
WHERE id = (SELECT job_id FROM expression_create_result);
SET LOCAL ROLE service_role;

SELECT is(
  public.advance_generation_job(
    (SELECT job_id FROM expression_create_result),
    (SELECT lease_token FROM first_claim),
    'generating',
    '{}'::jsonb
  ),
  false,
  'an expired worker cannot advance before the job is reclaimed'
);
SELECT is(
  public.complete_generation_job(
    (SELECT job_id FROM expression_create_result),
    (SELECT lease_token FROM first_claim),
    '{}'::jsonb
  ),
  false,
  'an expired worker cannot complete before the job is reclaimed'
);
SELECT is(
  public.fail_generation_job(
    (SELECT job_id FROM expression_create_result),
    (SELECT lease_token FROM first_claim),
    'expired_worker',
    'expired worker',
    '{}'::jsonb
  ),
  'lease_lost',
  'an expired worker cannot fail before the job is reclaimed'
);
SELECT is((SELECT balance FROM public.credit_wallets WHERE user_id = '00000000-0000-0000-0000-000000000501'), 24, 'expired failure does not refund');

CREATE TEMP TABLE reclaimed_claim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000501',
  (SELECT job_id FROM expression_create_result),
  420
);

SELECT is((SELECT attempt_count FROM reclaimed_claim), 2, 'an expired lease is reclaimed as a retry');
SELECT isnt((SELECT lease_token FROM reclaimed_claim), (SELECT lease_token FROM first_claim), 'reclaim rotates the lease token');
SELECT is(
  public.fail_generation_job(
    (SELECT job_id FROM expression_create_result),
    (SELECT lease_token FROM first_claim),
    'stale_worker',
    'stale worker',
    '{}'::jsonb
  ),
  'lease_lost',
  'a stale worker cannot fail a reclaimed job'
);
SELECT is((SELECT balance FROM public.credit_wallets WHERE user_id = '00000000-0000-0000-0000-000000000501'), 24, 'stale failure does not refund');
SELECT is(
  public.fail_generation_job(
    (SELECT job_id FROM expression_create_result),
    (SELECT lease_token FROM reclaimed_claim),
    'generation_failed',
    'Please try again.',
    '{}'::jsonb
  ),
  'failed',
  'the active worker can atomically fail the job'
);
SELECT is((SELECT balance FROM public.credit_wallets WHERE user_id = '00000000-0000-0000-0000-000000000501'), 36, 'terminal failure refunds the exact debit');
SELECT is(
  public.fail_generation_job(
    (SELECT job_id FROM expression_create_result),
    (SELECT lease_token FROM reclaimed_claim),
    'generation_failed',
    'Please try again.',
    '{}'::jsonb
  ),
  'already_failed',
  'terminal failure is idempotent'
);
SELECT is(
  (SELECT count(*) FROM public.credit_ledger WHERE user_id = '00000000-0000-0000-0000-000000000501' AND reason = 'refund_generation' AND ref_id = 'durability-expression-1'),
  1::bigint,
  'terminal failure records one refund'
);

CREATE TEMP TABLE free_create_result AS
SELECT * FROM public.create_generation_job(
  '00000000-0000-0000-0000-000000000501',
  'durability-avatar-1',
  '{"species":"cat"}'::jsonb,
  'original-photos/00000000-0000-0000-0000-000000000501/free.png',
  NULL,
  ARRAY['idle', 'happy', 'sleep']
);

SELECT is((SELECT outcome FROM free_create_result), 'created', 'free quota atomically creates a job');
SELECT is(
  (SELECT funding_kind FROM public.generation_jobs WHERE id = (SELECT job_id FROM free_create_result)),
  'generation_quota_free',
  'free quota source is persisted exactly'
);

CREATE TEMP TABLE free_retry_result AS
SELECT * FROM public.create_generation_job(
  '00000000-0000-0000-0000-000000000501',
  'durability-avatar-1',
  '{"species":"cat"}'::jsonb,
  'original-photos/00000000-0000-0000-0000-000000000501/retry-upload.png',
  NULL,
  ARRAY['idle', 'happy', 'sleep']
);

SELECT is((SELECT outcome FROM free_retry_result), 'existing', 'a lost avatar response resolves to the existing funded job');
SELECT is((SELECT job_id FROM free_retry_result), (SELECT job_id FROM free_create_result), 'avatar retry keeps the same job id');
SELECT is(
  (SELECT free_used FROM public.generation_quota WHERE user_id = '00000000-0000-0000-0000-000000000501'),
  1,
  'avatar retry does not consume another quota unit'
);

CREATE TEMP TABLE free_claim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000501',
  (SELECT job_id FROM free_create_result),
  420
);

SELECT is(
  public.fail_generation_job(
    (SELECT job_id FROM free_create_result),
    (SELECT lease_token FROM free_claim),
    'generation_failed',
    'Please try again.',
    '{}'::jsonb
  ),
  'cleanup_pending',
  'free quota failure waits for source cleanup'
);
SELECT is(
  (SELECT free_used FROM public.generation_quota WHERE user_id = '00000000-0000-0000-0000-000000000501'),
  0,
  'free quota failure restores the exact free unit'
);
SELECT is(
  (SELECT status FROM public.generation_jobs WHERE id = (SELECT job_id FROM free_create_result)),
  'cleanup_pending',
  'photo-backed failure remains non-terminal until cleanup is confirmed'
);
SELECT ok(
  public.finalize_generation_source_cleanup(
    (SELECT job_id FROM free_create_result),
    (SELECT lease_token FROM free_claim)
  ),
  'source cleanup finalization reaches the intended failure state'
);
SELECT is(
  (SELECT status FROM public.generation_jobs WHERE id = (SELECT job_id FROM free_create_result)),
  'failed',
  'photo-backed failure becomes terminal after cleanup'
);

INSERT INTO public.generation_quota (user_id, paid_credits)
VALUES ('00000000-0000-0000-0000-000000000502', 5);

CREATE TEMP TABLE completion_create_result AS
SELECT * FROM public.create_generation_job(
  '00000000-0000-0000-0000-000000000502',
  'durability-avatar-completion',
  '{"species":"dog"}'::jsonb,
  'original-photos/00000000-0000-0000-0000-000000000502/source.png',
  NULL,
  ARRAY['idle', 'happy', 'sleep']
);

SELECT is(
  (SELECT paid_credits FROM public.generation_quota WHERE user_id = '00000000-0000-0000-0000-000000000502'),
  5,
  'deprecated paid quota is not revived for new avatar jobs'
);
SELECT is(
  (SELECT free_used FROM public.generation_quota WHERE user_id = '00000000-0000-0000-0000-000000000502'),
  1,
  'new avatar jobs consume only the free quota allowance'
);

CREATE TEMP TABLE completion_claim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000502',
  (SELECT job_id FROM completion_create_result),
  420
);

SELECT ok(
  public.advance_generation_job(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completion_claim),
    'uploading_assets',
    '{}'::jsonb
  ),
  'the active worker reaches asset upload'
);
SELECT ok(
  public.record_generation_asset(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completion_claim),
    'idle',
    'avatars/00000000-0000-0000-0000-000000000502/job/idle.png',
    1024,
    1024,
    'idle-hash',
    now()
  ),
  'the active attempt records idle'
);
SELECT ok(
  public.record_generation_asset(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completion_claim),
    'happy',
    'avatars/00000000-0000-0000-0000-000000000502/job/happy.png',
    1024,
    1024,
    'happy-hash',
    NULL
  ),
  'the active attempt records happy'
);
SELECT ok(
  public.record_generation_asset(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completion_claim),
    'sleep',
    'avatars/00000000-0000-0000-0000-000000000502/job/sleep.png',
    1024,
    1024,
    'sleep-hash',
    NULL
  ),
  'the active attempt records sleep'
);
SELECT ok(
  public.complete_generation_job(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completion_claim),
    '{"passed":true}'::jsonb
  ),
  'a complete current-attempt asset set is accepted'
);
SELECT is(
  (SELECT status FROM public.generation_jobs WHERE id = (SELECT job_id FROM completion_create_result)),
  'cleanup_pending',
  'successful photo generation waits for source cleanup'
);
SELECT ok(
  public.finalize_generation_source_cleanup(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completion_claim)
  ),
  'successful source cleanup finalizes the job'
);
SELECT is(
  (SELECT status FROM public.generation_jobs WHERE id = (SELECT job_id FROM completion_create_result)),
  'completed',
  'successful photo generation becomes completed only after cleanup'
);

CREATE TEMP TABLE completed_replay_result AS
SELECT * FROM public.create_generation_job(
  '00000000-0000-0000-0000-000000000502',
  'durability-avatar-completion',
  '{"species":"dog"}'::jsonb,
  'original-photos/00000000-0000-0000-0000-000000000502/source.png',
  NULL,
  ARRAY['idle', 'happy', 'sleep']
);

SELECT is((SELECT outcome FROM completed_replay_result), 'existing', 'a completed lost-response replay keeps the original job');
SELECT is(
  (SELECT status FROM public.generation_jobs WHERE id = (SELECT job_id FROM completion_create_result)),
  'cleanup_pending',
  'a completed replay durably schedules deletion of the re-uploaded source photo'
);

CREATE TEMP TABLE completed_replay_claim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000502',
  (SELECT job_id FROM completion_create_result),
  420
);

SELECT is(
  public.fail_generation_job(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completed_replay_claim),
    'ambiguous_completion',
    'Please try again.',
    '{}'::jsonb
  ),
  'already_completed',
  'an ambiguous completion response cannot refund a completed generation'
);
SELECT ok(
  public.finalize_generation_source_cleanup(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM completed_replay_claim)
  ),
  'the replayed source photo cleanup can finish normally'
);
SELECT is(
  (SELECT free_used FROM public.generation_quota WHERE user_id = '00000000-0000-0000-0000-000000000502'),
  1,
  'completed replay cleanup does not refund or consume another quota unit'
);

UPDATE public.generation_jobs
SET
  status = 'created',
  attempt_count = 3,
  lease_token = NULL,
  lease_expires_at = NULL,
  cleanup_target_status = NULL,
  source_cleanup_completed_at = NULL
WHERE id = (SELECT job_id FROM completion_create_result);

CREATE TEMP TABLE exhausted_claim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000502',
  (SELECT job_id FROM completion_create_result),
  30,
  3
);

SELECT is((SELECT attempt_count FROM exhausted_claim), 4, 'the terminalization claim advances to the exhaustion sentinel');

UPDATE public.generation_jobs
SET lease_expires_at = now() - interval '1 second'
WHERE id = (SELECT job_id FROM completion_create_result);

CREATE TEMP TABLE exhausted_reclaim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000502',
  (SELECT job_id FROM completion_create_result),
  30,
  3
);

SELECT is((SELECT count(*) FROM exhausted_reclaim), 1::bigint, 'an expired terminalization claim remains reclaimable');
SELECT is((SELECT attempt_count FROM exhausted_reclaim), 4, 'reclaiming an exhausted job does not grow the attempt count');
SELECT is(
  public.fail_generation_job(
    (SELECT job_id FROM completion_create_result),
    (SELECT lease_token FROM exhausted_reclaim),
    'generation_attempts_exhausted',
    'Please try again.',
    '{}'::jsonb
  ),
  'cleanup_pending',
  'the reclaimed exhausted job reaches durable cleanup and refund'
);
SELECT is(
  (SELECT free_used FROM public.generation_quota WHERE user_id = '00000000-0000-0000-0000-000000000502'),
  0,
  'the exhausted job refunds its free quota exactly once'
);

UPDATE public.generation_jobs
SET lease_expires_at = now() - interval '1 second'
WHERE id = (SELECT job_id FROM completion_create_result);

CREATE TEMP TABLE exhausted_cleanup_reclaim AS
SELECT * FROM public.claim_generation_job(
  '00000000-0000-0000-0000-000000000502',
  (SELECT job_id FROM completion_create_result),
  30,
  3
);

SELECT is((SELECT count(*) FROM exhausted_cleanup_reclaim), 1::bigint, 'cleanup remains reclaimable after attempt exhaustion');
SELECT is((SELECT attempt_count FROM exhausted_cleanup_reclaim), 4, 'cleanup reclaim leaves the generation attempt count unchanged');

SELECT * FROM finish();

ROLLBACK;
