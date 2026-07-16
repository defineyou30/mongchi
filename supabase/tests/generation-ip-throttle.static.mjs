#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0027_generation_ip_throttle.sql"), "utf8");
const edgeFunction = fs.readFileSync(path.join(root, "supabase/functions/generate-avatar/index.ts"), "utf8");

// Table: no user_id at all (this is an IP-scoped backstop, not an
// account-scoped one), primary key (ip_hash, day), RLS enabled with no
// policies -- every access must go through register_generation_start_for_ip
// (SECURITY DEFINER) or a direct service_role connection, same lockdown as
// 0024_support_feedback.sql.
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.generation_ip_throttle/);
assert.match(migration, /ip_hash TEXT NOT NULL CHECK \(ip_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
assert.match(migration, /day DATE NOT NULL/);
assert.match(migration, /started_count INTEGER NOT NULL DEFAULT 0 CHECK \(started_count >= 0\)/);
assert.match(migration, /PRIMARY KEY \(ip_hash, day\)/);
assert.match(migration, /ALTER TABLE public\.generation_ip_throttle ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(migration, /CREATE POLICY/);

// RPC: service_role-only (auth.role() forbidden guard, same idiom as
// 0013_generation_job_durability.sql), pinned search_path, input validation,
// advisory lock before the upsert, soft jsonb outcomes (never raises for a
// throttled caller -- same soft-failure shape as 0024's rate_limited /
// 0025's too_large|stale).
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.register_generation_start_for_ip/);
assert.match(migration, /RETURNS JSONB/);
assert.match(migration, /SECURITY DEFINER/);
assert.match(migration, /SET search_path = public, pg_temp/);
assert.match(migration, /IF auth\.role\(\) IS DISTINCT FROM 'service_role' THEN/);
assert.match(migration, /register_generation_start_for_ip: forbidden/);
assert.match(migration, /p_ip_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
assert.match(migration, /pg_advisory_xact_lock\(hashtext\('generation-ip:' \|\| p_ip_hash\)\)/);
assert.match(migration, /ON CONFLICT \(ip_hash, day\) DO UPDATE SET/);
assert.match(migration, /started_count = public\.generation_ip_throttle\.started_count \+ 1/);
assert.match(migration, /WHERE public\.generation_ip_throttle\.started_count < 10/);
assert.match(migration, /IF v_count IS NULL THEN/);
assert.match(migration, /'throttled'/);
assert.match(migration, /'outcome', 'ok', 'count', v_count/);
assert.match(
  migration,
  /REVOKE EXECUTE ON FUNCTION public\.register_generation_start_for_ip\(TEXT\)\s*FROM PUBLIC, anon, authenticated/
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.register_generation_start_for_ip\(TEXT\)\s*TO service_role/
);
// Never grantable to authenticated clients -- p_ip_hash is not scoped to
// the caller's own identity like every other authenticated-callable RPC in
// this project.
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.register_generation_start_for_ip\(TEXT\)\s*TO authenticated/
);

// Cleanup: purge function + guarded pg_cron schedule, mirroring
// 0018_chat_day_pass.sql's guarded schedule exactly (skips with a NOTICE
// rather than failing the migration if pg_cron is not installed).
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.purge_expired_generation_ip_throttle/);
assert.match(migration, /DELETE FROM public\.generation_ip_throttle\s*WHERE day < current_date - 7/);
assert.match(migration, /IF EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'\) THEN/);
assert.match(migration, /PERFORM cron\.schedule\(\s*'purge_expired_generation_ip_throttle_daily'/);
assert.match(migration, /pg_cron extension not installed/);

// Edge Function wiring: GENERATION_IP_SALT read once, x-forwarded-for's
// first hop only, hashed via the existing sha256Hex helper (no bespoke
// hashing utility, no raw IP ever logged), RPC called before job creation,
// and a throttled outcome reuses the existing quota_exhausted failure
// idiom/copy rather than introducing new user-facing text.
assert.match(edgeFunction, /const generationIpSalt = Deno\.env\.get\("GENERATION_IP_SALT"\)/);
assert.match(edgeFunction, /if \(generationIpSalt\)/);
assert.match(edgeFunction, /req\.headers\.get\("x-forwarded-for"\)/);
assert.match(edgeFunction, /forwardedFor\.split\(","\)\[0\]/);
assert.match(edgeFunction, /sha256Hex\(new TextEncoder\(\)\.encode\(`\$\{generationIpSalt\}:\$\{callerIp\}`\)\)/);
assert.match(edgeFunction, /admin\.rpc\("register_generation_start_for_ip", \{\s*p_ip_hash: ipHash\s*\}\)/);
assert.match(edgeFunction, /ipThrottleResult as \{ outcome\?: string \} \| null\)\?\.outcome === "throttled"/);
assert.match(
  edgeFunction,
  /return jsonResponse\(\{ error: "quota_exhausted", message: failureMessages\.quotaExhausted \}, 402\);/
);
assert.match(edgeFunction, /ip throttle check failed, failing open/);

// No raw IP (callerIp) ever reaches a console.* call anywhere in the file.
const logLines = edgeFunction
  .split("\n")
  .filter((line) => /console\.(log|warn|error|info|debug)/.test(line));
for (const line of logLines) {
  assert.doesNotMatch(line, /callerIp/);
}

process.stdout.write("Generation IP throttle contract passed.\n");
