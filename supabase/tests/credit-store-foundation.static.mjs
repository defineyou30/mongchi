#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0016_credit_store_foundation.sql"), "utf8");
const starterAdjustment = fs.readFileSync(path.join(root, "supabase/migrations/0017_adjust_starter_credit_grant.sql"), "utf8");
const starterAdjustmentToFive = fs.readFileSync(path.join(root, "supabase/migrations/0026_adjust_starter_grant_to_five.sql"), "utf8");
const avatarFunction = fs.readFileSync(path.join(root, "supabase/functions/generate-avatar/index.ts"), "utf8");
const webhook = fs.readFileSync(path.join(root, "supabase/functions/revenuecat-credit-webhook/index.ts"), "utf8");

assert.match(avatarFunction, /STARTER_CREDIT_GRANT = 5/);
assert.match(avatarFunction, /p_reason: "grant_starter"/);
assert.match(avatarFunction, /p_ref_id: "starter_v1"/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.revoke_credit_purchase/);
assert.match(migration, /CREATE TRIGGER generation_jobs_grant_starter_credits/);
assert.match(migration, /generation_completion_trigger/);
assert.match(migration, /reason = 'grant_purchase'/);
assert.match(migration, /reason = 'chargeback_refund'/);
assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/);
assert.match(migration, /status = 'completed'/);
assert.match(migration, /NEW\.user_id,\s+25,/);
assert.match(starterAdjustment, /NEW\.user_id,\s+12,/);
assert.doesNotMatch(starterAdjustment, /UPDATE public\.credit_wallets/);
assert.match(starterAdjustmentToFive, /NEW\.user_id,\s+5,/);
assert.match(starterAdjustmentToFive, /'grant_starter'/);
assert.doesNotMatch(starterAdjustmentToFive, /UPDATE public\.credit_wallets/);
assert.match(webhook, /REVENUECAT_WEBHOOK_AUTHORIZATION/);
assert.match(webhook, /credit_pack_20: 20/);
assert.match(webhook, /credit_pack_60: 60/);
assert.match(webhook, /credit_pack_150: 150/);
assert.match(webhook, /NON_RENEWING_PURCHASE/);
assert.match(webhook, /CANCELLATION/);
assert.match(webhook, /p_ref_type: "iap_transaction"/);

process.stdout.write("Credit store foundation contract passed.\n");
