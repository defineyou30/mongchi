#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0023_credit_reward_claims.sql"), "utf8");

// Shape mirrors 0019_walk_early_return.sql / 0021_live_shop_purchases.sql:
// authenticated direct-call RPC keyed off auth.uid(), advisory lock before
// the idempotent grant, no Edge Function.
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.claim_credit_reward\(p_reward_key TEXT\)/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /pg_advisory_xact_lock\(hashtext\('credit-reward:'/);
assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon/);
assert.match(migration, /GRANT EXECUTE[\s\S]*TO authenticated/);

// Every settlement mission, streak milestone, collection, and bond reward
// key from the 2026-07-15 faucet budget (docs/game-economy-bm-proposal.md)
// must be present in the server whitelist, at its budgeted amount.
assert.match(migration, /'settle_first_feed'/);
assert.match(migration, /'settle_first_play'/);
assert.match(migration, /'settle_first_chat_hello'/);
assert.match(migration, /'settle_first_walk'/);
assert.match(migration, /'settle_first_photo'/);
assert.match(migration, /\) THEN 1/); // settlement missions' shared +1
assert.match(migration, /WHEN p_reward_key = 'streak_3' THEN 2/);
assert.match(migration, /WHEN p_reward_key = 'streak_7' THEN 3/);
assert.match(migration, /WHEN p_reward_key = 'streak_14' THEN 5/);
assert.match(migration, /WHEN p_reward_key = 'streak_30' THEN 8/);
assert.match(migration, /WHEN p_reward_key = 'collection_complete' THEN 10/);
assert.match(migration, /WHEN p_reward_key = 'bond_5' THEN 5/);
assert.match(migration, /WHEN p_reward_key = 'bond_10' THEN 10/);
assert.match(migration, /WHEN p_reward_key ~ '\^letter_month_\[1-9\]\[0-9\]\*\$' THEN 5/);

// Never a client-supplied amount: grant_credits is only ever called with the
// v_amount the CASE above resolved, and only after the whitelist match.
assert.match(migration, /public\.grant_credits\(\s*v_user,\s*v_amount,\s*'grant_reward',\s*'reward',\s*p_reward_key/);

// Outcomes distinguish a first-ever grant from an idempotent replay and an
// out-of-whitelist key -- never a silent "granted" for either of the latter two.
assert.match(migration, /'granted'::TEXT/);
assert.match(migration, /'already_claimed'::TEXT/);
assert.match(migration, /'unknown_reward'::TEXT/);

process.stdout.write("Credit reward claims contract passed.\n");
