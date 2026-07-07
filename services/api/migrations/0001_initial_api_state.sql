BEGIN;

CREATE TABLE IF NOT EXISTS public.api_users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL,
  auth_subject TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ko-KR' CHECK (locale IN ('ko-KR', 'en-US')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, auth_subject)
);

CREATE TABLE IF NOT EXISTS public.pets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  species TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
  personality_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  talking_style TEXT NOT NULL CHECK (talking_style IN ('cute', 'gentle', 'cheerful', 'comforting')),
  favorite_thing TEXT,
  memory_note TEXT,
  active_generation_job_id TEXT,
  active_asset_id TEXT,
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('draft', 'generating', 'active', 'archived', 'deleted')),
  original_photo_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pets_user_live_idx
  ON public.pets(user_id, lifecycle_status)
  WHERE lifecycle_status <> 'deleted';

CREATE TABLE IF NOT EXISTS public.original_photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  status TEXT NOT NULL CHECK (status IN ('upload_url_issued', 'uploaded', 'deleted')),
  storage_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT,
  uploaded_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS original_photos_user_pet_status_idx
  ON public.original_photos(user_id, pet_id, status);

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  source_photo_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  optional_photo_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (
    status IN (
      'created',
      'queued',
      'claimed',
      'validating',
      'preprocessing',
      'safety_checking',
      'generating',
      'postprocessing',
      'quality_checking',
      'uploading_assets',
      'completed',
      'failed',
      'cancelled',
      'expired'
    )
  ),
  input_snapshot JSONB NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mock', 'openai', 'other')),
  cost_units INTEGER NOT NULL DEFAULT 0 CHECK (cost_units >= 0),
  quality JSONB NOT NULL,
  failure JSONB,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_jobs_user_pet_status_idx
  ON public.generation_jobs(user_id, pet_id, status);

CREATE TABLE IF NOT EXISTS public.generated_assets (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  generation_job_id TEXT NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  content_hash TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/webp')),
  storage_class TEXT NOT NULL CHECK (storage_class IN ('private_app_asset', 'share_export')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  quality_status TEXT NOT NULL CHECK (quality_status IN ('pending', 'passed', 'failed', 'manual_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_assets_pet_state_idx
  ON public.generated_assets(pet_id, state);

ALTER TABLE public.pets
  ADD CONSTRAINT pets_active_generation_job_fk
  FOREIGN KEY (active_generation_job_id)
  REFERENCES public.generation_jobs(id)
  ON DELETE SET NULL;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_active_asset_fk
  FOREIGN KEY (active_asset_id)
  REFERENCES public.generated_assets(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.care_states (
  pet_id TEXT PRIMARY KEY REFERENCES public.pets(id) ON DELETE CASCADE,
  satiety INTEGER NOT NULL CHECK (satiety BETWEEN 0 AND 100),
  energy INTEGER NOT NULL CHECK (energy BETWEEN 0 AND 100),
  happiness INTEGER NOT NULL CHECK (happiness BETWEEN 0 AND 100),
  affection INTEGER NOT NULL CHECK (affection BETWEEN 0 AND 100),
  garden_health INTEGER NOT NULL CHECK (garden_health BETWEEN 0 AND 100),
  cleanliness INTEGER NOT NULL CHECK (cleanliness BETWEEN 0 AND 100),
  last_fed_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  last_garden_watered_at TIMESTAMPTZ,
  active_walk_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL,
  visual_key TEXT NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  behavior_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  placement_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventories (
  user_id TEXT PRIMARY KEY REFERENCES public.api_users(id) ON DELETE CASCADE,
  selected_terrarium_theme_id TEXT REFERENCES public.items(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  user_id TEXT NOT NULL REFERENCES public.inventories(user_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES public.items(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  acquired_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('starter', 'walk_reward', 'purchase', 'event', 'admin_grant')),
  PRIMARY KEY (user_id, item_id, source, acquired_at)
);

CREATE TABLE IF NOT EXISTS public.placed_items (
  user_id TEXT NOT NULL REFERENCES public.inventories(user_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES public.items(id),
  slot TEXT NOT NULL CHECK (slot IN ('ground', 'water', 'wall', 'sky', 'pet_corner', 'garden')),
  x NUMERIC NOT NULL CHECK (x >= 0 AND x <= 1),
  y NUMERIC NOT NULL CHECK (y >= 0 AND y <= 1),
  rotation NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id, slot)
);

CREATE TABLE IF NOT EXISTS public.walk_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ready', 'walking', 'returned', 'claimed', 'expired')),
  started_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  reward_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  discovery_line TEXT,
  energy_cost INTEGER NOT NULL CHECK (energy_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS walk_sessions_user_pet_status_idx
  ON public.walk_sessions(user_id, pet_id, status);

ALTER TABLE public.care_states
  ADD CONSTRAINT care_states_active_walk_fk
  FOREIGN KEY (active_walk_id)
  REFERENCES public.walk_sessions(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.recent_reactions (
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  line TEXT NOT NULL,
  shown_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, pet_id, rule_id, shown_at)
);

CREATE INDEX IF NOT EXISTS recent_reactions_pet_shown_idx
  ON public.recent_reactions(pet_id, shown_at DESC);

CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('premium_ai_chat', 'support')),
  status TEXT NOT NULL CHECK (status IN ('open', 'archived', 'deleted')),
  disclosure_accepted_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_user_pet_status_idx
  ON public.conversations(user_id, pet_id, status);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'pet_ai', 'system')),
  text TEXT NOT NULL,
  safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_thread_idx
  ON public.conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
  source TEXT NOT NULL CHECK (source IN ('purchase', 'restore', 'admin_grant', 'starter', 'event')),
  product_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  ledger_entry_id TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entitlements_user_key_status_idx
  ON public.entitlements(user_id, key, status);

CREATE TABLE IF NOT EXISTS public.purchase_ledger (
  ledger_entry_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  product_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  receipt_hash TEXT NOT NULL,
  entitlement_id TEXT NOT NULL REFERENCES public.entitlements(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'restored', 'revoked')),
  verified_at TIMESTAMPTZ NOT NULL,
  restored_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT CHECK (
    revocation_reason IS NULL OR revocation_reason IN ('refund', 'chargeback', 'developer_revoke', 'store_revoke')
  )
);

CREATE INDEX IF NOT EXISTS purchase_ledger_user_platform_idx
  ON public.purchase_ledger(user_id, platform);

CREATE TABLE IF NOT EXISTS public.privacy_deletion_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.api_users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('original_photos', 'chat_history', 'pet')),
  target_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message_safe TEXT
);

CREATE INDEX IF NOT EXISTS privacy_deletion_jobs_user_status_idx
  ON public.privacy_deletion_jobs(user_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.api_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failure_code TEXT
);

CREATE INDEX IF NOT EXISTS api_outbox_events_pending_idx
  ON public.api_outbox_events(status, created_at)
  WHERE status IN ('pending', 'failed');

COMMIT;
