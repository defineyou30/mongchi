#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const columnMigration = fs.readFileSync(path.join(root, "supabase/migrations/0009_generated_asset_unlock_column.sql"), "utf8");
const enforcementMigration = fs.readFileSync(path.join(root, "supabase/migrations/0010_enforce_generated_asset_unlocks.sql"), "utf8");
const hardeningMigration = fs.readFileSync(path.join(root, "supabase/migrations/0011_harden_starter_pose_unlocks.sql"), "utf8");
const atomicPackMigration = fs.readFileSync(path.join(root, "supabase/migrations/0012_atomic_expression_pack_job.sql"), "utf8");
const edgeFunction = fs.readFileSync(path.join(root, "supabase/functions/generate-avatar/index.ts"), "utf8");

assert.match(columnMigration, /ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ DEFAULT now\(\)/);
assert.match(columnMigration, /generated_assets_storage_path_idx/);
assert.match(enforcementMigration, /ALTER COLUMN unlocked_at DROP DEFAULT/);
assert.match(enforcementMigration, /DROP POLICY IF EXISTS generated_assets_select_unlocked_own/);
assert.match(enforcementMigration, /generated_assets_select_unlocked_own/);
assert.match(enforcementMigration, /DROP POLICY IF EXISTS pet_media_select_unlocked_own/);
assert.match(enforcementMigration, /pet_media_select_unlocked_own/);
assert.match(enforcementMigration, /asset\.unlocked_at IS NOT NULL/);
assert.match(enforcementMigration, /p_state NOT IN \('happy', 'sleep'\)/);
assert.match(enforcementMigration, /GRANT EXECUTE ON FUNCTION public\.unlock_starter_pose\(UUID, TEXT\) TO authenticated/);
assert.match(enforcementMigration, /REVOKE ALL ON FUNCTION public\.unlock_starter_pose\(UUID, TEXT\) FROM anon/);
assert.doesNotMatch(hardeningMigration, /SET unlocked_at = NULL/);
assert.match(hardeningMigration, /DROP FUNCTION IF EXISTS public\.unlock_starter_pose\(UUID, TEXT\)/);
assert.match(hardeningMigration, /p_action NOT IN/);
assert.match(hardeningMigration, /asset\.state = 'happy'/);
assert.match(hardeningMigration, /asset\.state = 'sleep' AND p_action = 'rest'/);
assert.match(hardeningMigration, /GRANT EXECUTE ON FUNCTION public\.unlock_starter_poses_for_care_action\(UUID, TEXT\) TO authenticated/);
assert.match(hardeningMigration, /REVOKE ALL ON FUNCTION public\.unlock_starter_poses_for_care_action\(UUID, TEXT\) FROM anon/);
assert.match(edgeFunction, /unlocked_at: isExpressionPackMode \|\| state === "idle" \? unlockedAt : null/);
assert.match(edgeFunction, /\.eq\("state", "idle"\)\s*\.not\("unlocked_at", "is", null\)/);
// The RGBA-first pipeline decodes the sheet once and splits it into RGBA
// panels (splitPoseSheetToRgbaPanels replaced the old splitPoseSheet call).
assert.match(edgeFunction, /generatePoseSheet\([\s\S]*splitPoseSheetToRgbaPanels\(sheet\.bytes, requiredStates\)/);
assert.match(atomicPackMigration, /CREATE OR REPLACE FUNCTION public\.create_expression_pack_job/);
assert.match(atomicPackMigration, /pg_advisory_xact_lock/);
assert.match(atomicPackMigration, /FROM public\.credit_wallets[\s\S]*FOR UPDATE/);
assert.match(atomicPackMigration, /INSERT INTO public\.credit_ledger/);
assert.match(atomicPackMigration, /INSERT INTO public\.generation_jobs/);
assert.match(atomicPackMigration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/);
assert.match(edgeFunction, /admin\.rpc\("create_expression_pack_job"/);

process.stdout.write("Generated asset unlock contract passed.\n");
