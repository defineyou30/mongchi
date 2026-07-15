#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0024_support_feedback.sql"), "utf8");
const supportSession = fs.readFileSync(
  path.join(root, "apps/mobile/src/features/session/supabaseSupportSession.ts"),
  "utf8"
);
const terrariumProvider = fs.readFileSync(
  path.join(root, "apps/mobile/src/features/session/TerrariumSessionProvider.tsx"),
  "utf8"
);

// Table: RLS enabled with no INSERT/SELECT policies -- every write must go
// through submit_support_feedback (SECURITY DEFINER), never a direct client
// insert/select.
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.support_feedback/);
assert.match(migration, /user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
assert.match(migration, /category TEXT NOT NULL CHECK \(category IN \('generation_issue', 'feedback', 'support'\)\)/);
assert.match(migration, /message TEXT NULL CHECK \(message IS NULL OR char_length\(message\) BETWEEN 1 AND 2000\)/);
assert.match(migration, /contact TEXT NULL CHECK \(contact IS NULL OR char_length\(contact\) <= 200\)/);
assert.match(migration, /ALTER TABLE public\.support_feedback ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(migration, /CREATE POLICY/);

// RPC: server-side validation, rate limiting, and locked-down grants.
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_support_feedback/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /pg_advisory_xact_lock\(hashtext\('support-feedback:'/);
assert.match(migration, /v_recent_count >= 10/);
assert.match(migration, /'rate_limited'/);
assert.match(migration, /'submitted'/);
assert.match(migration, /'wrong_pet', 'unsafe_or_scary', 'poor_quality'/);
assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon/);
assert.match(migration, /GRANT EXECUTE[\s\S]*TO authenticated, service_role/);

// Mobile transport: fire-and-forget, never throws.
assert.match(supportSession, /submitSupportFeedbackToSupabase/);
assert.match(supportSession, /client\.rpc\("submit_support_feedback"/);

// TerrariumSessionProvider wiring: generation-issue reports and the new
// free-text feedback box both route through the transport above.
assert.match(terrariumProvider, /submitSupportFeedbackToSupabase/);
assert.match(terrariumProvider, /submitSupportFeedback/);

process.stdout.write("Support feedback contract passed.\n");
