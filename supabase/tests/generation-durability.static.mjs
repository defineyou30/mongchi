#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migrationsDirectory = path.join(root, "supabase/migrations");
const durabilityMigrationName = fs
  .readdirSync(migrationsDirectory)
  .find((fileName) => /^0013_.*\.sql$/.test(fileName));

assert.ok(durabilityMigrationName, "0013 generation durability migration must exist");

const durabilityMigration = fs.readFileSync(path.join(migrationsDirectory, durabilityMigrationName), "utf8");
const edgeFunction = fs.readFileSync(path.join(root, "supabase/functions/generate-avatar/index.ts"), "utf8");

assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS funding_kind TEXT/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS funding_ref TEXT/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS funding_amount INTEGER/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS lease_token UUID/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS attempt_count INTEGER/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS request_id TEXT/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS product_key TEXT/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS source_cleanup_completed_at TIMESTAMPTZ/);
assert.match(durabilityMigration, /ADD COLUMN IF NOT EXISTS attempt_token UUID/);
assert.match(durabilityMigration, /CREATE OR REPLACE FUNCTION public\.create_generation_job/);
assert.match(durabilityMigration, /CREATE OR REPLACE FUNCTION public\.claim_generation_job/);
assert.match(durabilityMigration, /CREATE OR REPLACE FUNCTION public\.advance_generation_job/);
assert.match(durabilityMigration, /CREATE OR REPLACE FUNCTION public\.complete_generation_job/);
assert.match(durabilityMigration, /CREATE OR REPLACE FUNCTION public\.fail_generation_job/);
assert.match(durabilityMigration, /CREATE OR REPLACE FUNCTION public\.finalize_generation_source_cleanup/);
assert.match(durabilityMigration, /CREATE OR REPLACE FUNCTION public\.record_generation_asset/);
assert.match(durabilityMigration, /FOR UPDATE[\s\S]*refund_generation/);
assert.match(durabilityMigration, /funding_refunded_at/);
assert.match(durabilityMigration, /status = 'created'[\s\S]*lease_expires_at < now\(\)/);
assert.match(durabilityMigration, /CREATE UNIQUE INDEX IF NOT EXISTS generated_assets_job_state_idx/);
assert.match(durabilityMigration, /HAVING count\(\*\) > 1[\s\S]*RAISE EXCEPTION/);
assert.doesNotMatch(durabilityMigration, /DELETE FROM public\.generated_assets/);
assert.match(durabilityMigration, /lease_token = p_lease_token\s+AND lease_expires_at > now\(\)/);
assert.match(durabilityMigration, /v_job\.lease_expires_at <= now\(\)/);
assert.match(durabilityMigration, /active jobs with ambiguous legacy funding/);
assert.match(durabilityMigration, /generation_jobs_user_request_idx/);
assert.match(durabilityMigration, /generation_jobs_active_product_idx/);
assert.match(durabilityMigration, /generation_jobs_active_funding_check/);
assert.match(durabilityMigration, /DROP FUNCTION IF EXISTS public\.create_expression_pack_job\(UUID, INTEGER, TEXT, JSONB, TEXT, TEXT\[\], TEXT\)/);
assert.match(durabilityMigration, /status = CASE WHEN v_job\.original_photo_path IS NULL THEN 'completed' ELSE 'cleanup_pending' END/);
assert.match(durabilityMigration, /asset\.attempt_token = p_lease_token/);
assert.match(
  durabilityMigration,
  /attempt_count = CASE[\s\S]*job\.attempt_count <= p_max_attempts[\s\S]*job\.attempt_count \+ 1[\s\S]*ELSE job\.attempt_count/
);
assert.doesNotMatch(durabilityMigration, /AND \(job\.status = 'cleanup_pending' OR job\.attempt_count <= p_max_attempts\)/);
assert.match(
  durabilityMigration,
  /v_existing_job\.status = 'completed'[\s\S]*status = 'cleanup_pending'[\s\S]*cleanup_target_status = 'completed'/
);
assert.match(
  durabilityMigration,
  /v_job\.status = 'cleanup_pending'[\s\S]*v_job\.cleanup_target_status = 'completed'[\s\S]*RETURN 'already_completed'/
);
assert.doesNotMatch(durabilityMigration, /generation_quota_paid/);

assert.match(edgeFunction, /admin\.rpc\("create_generation_job"/);
assert.match(edgeFunction, /admin\.rpc\("claim_generation_job"/);
assert.match(edgeFunction, /admin\.rpc\("advance_generation_job"/);
assert.match(edgeFunction, /admin\.rpc\("complete_generation_job"/);
assert.match(edgeFunction, /admin\.rpc\("fail_generation_job"/);
assert.match(edgeFunction, /admin\.rpc\("finalize_generation_source_cleanup"/);
assert.match(edgeFunction, /p_product_key: expressionPackId/);
assert.match(edgeFunction, /p_request_id: requestId/);
assert.match(edgeFunction, /p_max_attempts: MAX_GENERATION_ATTEMPTS/);
assert.doesNotMatch(edgeFunction, /admin\.rpc\("refund_(?:credits|generation_quota|pet_generation_slot)"/);
assert.doesNotMatch(edgeFunction, /\.from\("generation_jobs"\)\s*\.update\(/);
assert.match(edgeFunction, /const removal = await admin\.storage\.from\(BUCKET\)\.remove\(\[originalPhotoPath\]\)/);
assert.match(edgeFunction, /if \(removal\.error\)/);
assert.match(edgeFunction, /\.eq\("original_photo_path", originalPhotoPath\)[\s\S]*\.neq\("status", "failed"\)/);
assert.match(edgeFunction, /if \(ownershipError\)[\s\S]*return;/);
assert.match(edgeFunction, /if \(owningJob\) \{\s*return;\s*\}/);
assert.match(edgeFunction, /GENERATION_MAINTENANCE_MODE/);
assert.match(edgeFunction, /completion recovery lookup failed/);
assert.match(edgeFunction, /cleanupSupersededAttemptAssets\(admin, job\)[\s\S]*job\.attempt_count > MAX_GENERATION_ATTEMPTS/);
assert.match(edgeFunction, /removeUnclaimedSourcePhoto\(admin, userId, maintenanceOriginalPhotoPath, "maintenance"\)/);
assert.match(edgeFunction, /error: "generation_maintenance"[\s\S]*503[\s\S]*"Retry-After": "60"/);

process.stdout.write("Generation durability static contract passed.\n");
