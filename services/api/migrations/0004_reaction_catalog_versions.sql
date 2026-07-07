BEGIN;

CREATE TABLE IF NOT EXISTS public.reaction_catalog_versions (
  locale TEXT NOT NULL CHECK (locale IN ('ko-KR', 'en-US')),
  version TEXT NOT NULL CHECK (char_length(version) BETWEEN 1 AND 80),
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS reaction_catalog_versions_active_locale_idx
  ON public.reaction_catalog_versions(locale)
  WHERE is_active = true;

COMMIT;
