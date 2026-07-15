#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0019_walk_early_return.sql"), "utf8");

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.purchase_walk_early_return\(p_walk_id TEXT\)/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /public\.consume_credits\([\s\S]*'consume_walk_early_return'[\s\S]*'walk'/);
assert.match(migration, /p_walk_id/);
assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon/);
assert.match(migration, /GRANT EXECUTE[\s\S]*TO authenticated/);
assert.match(migration, /v_credit_cost INTEGER := 1/);
assert.match(migration, /'insufficient_credits'/);

process.stdout.write("Walk early-return credit contract passed.\n");
