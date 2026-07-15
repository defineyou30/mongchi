#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0014_chat_turn_guardrails.sql"), "utf8");
const edgeFunction = fs.readFileSync(path.join(root, "supabase/functions/chat-turn/index.ts"), "utf8");
const sharedContracts = fs.readFileSync(path.join(root, "packages/shared/src/api/mobileContracts.ts"), "utf8");
const releaseValidator = fs.readFileSync(path.join(root, "scripts/validate-release-config.mjs"), "utf8");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_turn_requests/);
assert.match(migration, /PRIMARY KEY \(user_id, request_id\)/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_user_rate_limits/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_access/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.reserve_chat_turn/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /c\.user_id = p_user[\s\S]*c\.pet_id = p_pet_id/);
assert.match(migration, /starter_free_remaining/);
assert.match(migration, /daily_free_on/);
assert.match(migration, /consume_premium_chat/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.complete_chat_turn/);
assert.match(migration, /INSERT INTO public\.conversation_messages[\s\S]*UPDATE public\.chat_turn_requests/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.fail_chat_turn/);
assert.match(migration, /refund_premium_chat/);
assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/);

assert.match(edgeFunction, /CHAT_LIVE_ENABLED/);
assert.match(edgeFunction, /admin\.rpc\("reserve_chat_turn"/);
assert.match(edgeFunction, /admin\.rpc\("complete_chat_turn"/);
assert.match(edgeFunction, /admin\.rpc\("fail_chat_turn"/);
assert.match(edgeFunction, /completion_failed[\s\S]*chat_completion_failed/);
assert.doesNotMatch(edgeFunction, /body\.charge/);
assert.ok(
  edgeFunction.indexOf('admin.rpc("reserve_chat_turn"') < edgeFunction.indexOf("provider.generateReply"),
  "chat turn must reserve billing and idempotency before the provider call"
);
assert.doesNotMatch(sharedContracts, /charge: "free" \| "credit"/);
assert.match(releaseValidator, /EXPO_PUBLIC_TINY_PET_LIVE_CHAT_ENABLED/);
assert.match(releaseValidator, /TINY_PET_CHAT_SAFETY_REVIEWED/);
assert.match(releaseValidator, /Production live chat requires documented expert safety review/);

process.stdout.write("Chat guardrail contract passed.\n");
