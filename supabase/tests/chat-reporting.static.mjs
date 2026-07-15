#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0015_chat_message_reports.sql"), "utf8");
const mobileTransport = fs.readFileSync(
  path.join(root, "apps/mobile/src/features/session/supabasePremiumChatSession.ts"),
  "utf8"
);
const history = fs.readFileSync(path.join(root, "apps/mobile/src/features/chat/ChatConversationHistory.tsx"), "utf8");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_message_reports/);
assert.match(migration, /message_id UUID NOT NULL/);
assert.match(migration, /UNIQUE \(user_id, message_id\)/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.report_chat_message/);
assert.match(migration, /sender = 'pet_ai'/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon/);
assert.match(migration, /GRANT EXECUTE[\s\S]*TO authenticated/);
assert.match(mobileTransport, /reportSupabaseChatMessage/);
assert.match(mobileTransport, /client\.rpc\("report_chat_message"/);
assert.match(history, /onReport/);
// The redesigned history surfaces the report entry point as the shield-alert
// icon button labelled via the chat.report.* i18n keys (formerly a "Flag" text button).
assert.match(history, /chat\.report\.button/);
assert.match(history, /shield-alert/);

process.stdout.write("Chat message reporting contract passed.\n");
