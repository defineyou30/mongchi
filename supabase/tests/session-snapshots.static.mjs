#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0025_session_snapshots.sql"), "utf8");

// Table: single row per user, RLS enabled with a SELECT-own policy but no
// INSERT/UPDATE/DELETE policy -- every write must go through
// upsert_session_snapshot (SECURITY DEFINER), never a direct client upsert.
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.session_snapshots/);
assert.match(migration, /user_id\s+UUID PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
assert.match(migration, /schema_version\s+INTEGER NOT NULL/);
assert.match(migration, /payload\s+JSONB NOT NULL/);
assert.match(migration, /byte_size\s+INTEGER NOT NULL/);
assert.match(migration, /client_updated_at\s+TIMESTAMPTZ NOT NULL/);
assert.match(migration, /ALTER TABLE public\.session_snapshots ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /CREATE POLICY session_snapshots_select_own ON public\.session_snapshots\s+FOR SELECT USING \(auth\.uid\(\) = user_id\)/);
assert.doesNotMatch(migration, /FOR INSERT/);
assert.doesNotMatch(migration, /FOR UPDATE/);
assert.doesNotMatch(migration, /FOR DELETE/);

// RPC: server-side validation, SECURITY DEFINER with a pinned search_path,
// auth.uid() null guard, advisory lock, size cap, and monotonic upsert guard.
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.upsert_session_snapshot/);
assert.match(migration, /SECURITY DEFINER/);
assert.match(migration, /SET search_path = public, pg_temp/);
assert.match(migration, /v_user UUID := auth\.uid\(\)/);
assert.match(migration, /IF v_user IS NULL THEN/);
assert.match(migration, /p_schema_version IS NULL OR p_schema_version <= 0/);
assert.match(migration, /pg_advisory_xact_lock\(hashtext\('session-snapshot:'/);
assert.match(migration, /octet_length\(p_payload::TEXT\)/);
assert.match(migration, /v_byte_size > 262144/);
assert.match(migration, /'too_large'/);
assert.match(migration, /ON CONFLICT \(user_id\) DO UPDATE SET/);
assert.match(migration, /WHERE EXCLUDED\.client_updated_at >= public\.session_snapshots\.client_updated_at/);
assert.match(migration, /'stale'/);
assert.match(migration, /'saved'/);
assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon/);
assert.match(migration, /GRANT EXECUTE[\s\S]*TO authenticated, service_role/);

process.stdout.write("Session snapshot contract passed.\n");
