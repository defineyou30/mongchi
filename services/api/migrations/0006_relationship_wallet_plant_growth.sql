BEGIN;

ALTER TABLE public.inventories
  ADD COLUMN IF NOT EXISTS plant_growth JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.relationship_states (
  pet_id TEXT PRIMARY KEY REFERENCES public.pets(id) ON DELETE CASCADE,
  bond_xp INTEGER NOT NULL CHECK (bond_xp >= 0),
  bond_level INTEGER NOT NULL CHECK (bond_level >= 1),
  total_care_actions INTEGER NOT NULL CHECK (total_care_actions >= 0),
  total_talk_count INTEGER NOT NULL CHECK (total_talk_count >= 0),
  days_together INTEGER NOT NULL CHECK (days_together >= 0),
  last_bonded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_wallets (
  user_id TEXT PRIMARY KEY REFERENCES public.api_users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  bonus_credits INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  free_chat_tickets INTEGER NOT NULL DEFAULT 0 CHECK (free_chat_tickets >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
