-- Mongchi Supabase backend: live conversation schema for premium pet chat
-- (Chat Live Wave C1).
--
-- Scope: conversations / conversation_messages tables (the live counterpart
-- of services/api's postgresChatRepository.ts -- see docs/chat-live-design.md
-- §2), RLS matching the read-own/write-via-service_role pattern from
-- 0001_init.sql/0004_credit_ledger.sql/0005_pet_namespace.sql (no write
-- policy: all INSERT/UPDATE happens inside the chat-turn Edge Function using
-- the service_role key), and two SECURITY DEFINER RPCs: compact_conversation
-- (atomic summary-merge + watermark-covered raw message delete, for the B안
-- summary hybrid's privacy-first option A -- §3.5) and
-- purge_expired_conversation_messages (30-day retention purge, mirrors
-- postgresChatRepository.ts:401-426's purgeExpiredMessages).
--
-- Column design intentionally mirrors postgresChatRepository.ts's
-- ConversationRow/ConversationMessageRow (docs/chat-live-design.md §2.1) with
-- two live-only additions: the B안 summary columns inlined onto
-- `conversations` (summary/summary_updated_at/summary_msg_count/
-- summarized_through -- not present in services/api's schema, which never
-- implemented long-term summarization), and conversation_messages.user_id,
-- denormalized from conversations.user_id so RLS can select-own without a
-- JOIN.
--
-- pet_id is TEXT and nullable, matching 0005_pet_namespace.sql's
-- generation_jobs.pet_id convention exactly: NULL means the caller's
-- first/only pet, and there is no `pets` table in this project to foreign-key
-- against (pet identity is a client-owned string). Conversation scoping for
-- find-or-create is (user_id, pet_id, status='open', type) -- see
-- conversations_user_pet_open_idx below and
-- postgresChatRepository.ts:182-201's listOpenConversationsForPet.
--
-- See docs/chat-live-design.md §2, §3.5, §5.2 (delete-account cascade note).

BEGIN;

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id TEXT,
  type TEXT NOT NULL DEFAULT 'premium_ai_chat' CHECK (type IN ('premium_ai_chat', 'support')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived', 'deleted')),
  disclosure_accepted_at TIMESTAMPTZ,
  -- B안 요약 하이브리드 (docs/chat-live-design.md §3.2/§3.5): a single
  -- merged-summary column rather than a history table -- each compaction
  -- overwrites `summary` with an updated merge of the prior summary plus the
  -- newly-compacted raw messages. summary_msg_count is a running total of how
  -- many raw messages have ever been folded into `summary`, for
  -- diagnostics/triggers only (not a foreign key or count constraint).
  -- summarized_through is the watermark: raw messages with created_at <= this
  -- value are already reflected in `summary` and are safe to delete (option
  -- A, §3.5) -- see compact_conversation below.
  summary TEXT,
  summary_updated_at TIMESTAMPTZ,
  summary_msg_count INTEGER NOT NULL DEFAULT 0,
  summarized_through TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary find-or-create lookup (docs/chat-live-design.md §2.2): "does this
-- user already have an open premium_ai_chat conversation for this pet".
CREATE INDEX IF NOT EXISTS conversations_user_pet_open_idx
  ON public.conversations(user_id, pet_id, status);

-- ---------------------------------------------------------------------------
-- conversation_messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  -- Denormalized from conversations.user_id (deliberate, see module doc
  -- comment above) so conversation_messages_select_own below can be a plain
  -- select-own policy instead of a JOIN-based EXISTS policy. Also gives
  -- delete-account's CASCADED_TABLES row-count step a direct user_id column
  -- to query, matching every other table in that list.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'pet_ai', 'system')),
  text TEXT NOT NULL,
  safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Context-window read: "last N messages for this conversation, in order" --
-- used by chat-turn to assemble the recent-8 short-term memory window.
CREATE INDEX IF NOT EXISTS conversation_messages_conv_created_idx
  ON public.conversation_messages(conversation_id, created_at);

-- Retention purge scan (30-day window, §3.5) -- purge_expired_conversation_
-- messages below scans/deletes by created_at across all conversations, so it
-- needs its own index rather than reusing the composite one above.
CREATE INDEX IF NOT EXISTS conversation_messages_created_idx
  ON public.conversation_messages(created_at);

-- ---------------------------------------------------------------------------
-- RPC: compact_conversation
--
-- B안 summary hybrid, privacy-first option A (docs/chat-live-design.md
-- §3.2/§3.5): atomically replaces conversations.summary with p_summary
-- (already merged with the prior summary by the caller -- chat-turn/
-- summary.ts, wired in wave C3), advances the summarized_through watermark
-- to p_through, and deletes every raw conversation_messages row at or before
-- that watermark, in a single transaction so a crash between "summary
-- updated" and "raw rows deleted" can never happen. NOT called anywhere yet
-- in wave C1 (chat-turn/summary.ts ships as an unwired skeleton -- see that
-- file's module doc comment); this RPC exists now so the schema/contract is
-- settled ahead of C3's trigger wiring.
--
-- ⚠️ Irreversible: the raw-message DELETE cannot be undone. Callers must only
-- invoke this after the summary merge itself has been generated and
-- validated (see docs/chat-live-design.md §9 risk 4).
--
-- Returns the number of raw messages deleted (i.e. newly folded into the
-- summary), so the caller can add it to summary_msg_count client-side if it
-- wants to log/verify, though this function already updates that column
-- itself.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compact_conversation(
  p_conversation_id UUID,
  p_summary TEXT,
  p_through TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.conversation_messages
  WHERE conversation_id = p_conversation_id
    AND created_at <= p_through;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.conversations
  SET summary = p_summary,
      summary_updated_at = now(),
      summary_msg_count = summary_msg_count + v_deleted,
      summarized_through = p_through,
      updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: purge_expired_conversation_messages
--
-- Live SQL port of postgresChatRepository.ts:401-426's purgeExpiredMessages
-- (docs/chat-live-design.md §2.2/§3.5): deletes conversation_messages rows
-- older than p_retention_days (default 30, matching premiumChatPolicy.ts's
-- retentionWindowMs), in batches of p_batch_size so a single call never scans
-- or locks an unbounded number of rows. Intended to run on a schedule
-- (pg_cron or a scheduled Edge Function -- not wired in this migration; see
-- docs/chat-live-design.md §2.2) rather than per-request. Safe to call
-- repeatedly -- an empty batch is simply a no-op that returns 0.
--
-- Returns the number of messages deleted in this call.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_expired_conversation_messages(
  p_retention_days INTEGER DEFAULT 30,
  p_batch_size INTEGER DEFAULT 500
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH expired_messages AS (
    SELECT id
    FROM public.conversation_messages
    WHERE created_at < now() - make_interval(days => p_retention_days)
    ORDER BY created_at ASC, id ASC
    LIMIT p_batch_size
  )
  DELETE FROM public.conversation_messages
  WHERE id IN (SELECT id FROM expired_messages);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Read-only for the owning user, matching every other table in this project
-- (0001_init.sql/0002_rate_limit.sql/0004_credit_ledger.sql/
-- 0005_pet_namespace.sql): no write policy exists, so all writes happen
-- through the chat-turn Edge Function's service_role key or the SECURITY
-- DEFINER RPCs above. Deleted conversations (status = 'deleted', e.g. via
-- delete-account's ON DELETE CASCADE) are excluded from
-- conversations_select_own so a client never sees a stale "deleted" row --
-- mirrors postgresChatRepository.ts's `status <> 'deleted'` filters.
-- ---------------------------------------------------------------------------

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select_own ON public.conversations
  FOR SELECT USING (auth.uid() = user_id AND status <> 'deleted');

CREATE POLICY conversation_messages_select_own ON public.conversation_messages
  FOR SELECT USING (auth.uid() = user_id);

COMMIT;
