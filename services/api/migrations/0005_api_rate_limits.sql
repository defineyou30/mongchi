BEGIN;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key TEXT PRIMARY KEY,
  window_start_ms BIGINT NOT NULL CHECK (window_start_ms >= 0),
  count INTEGER NOT NULL CHECK (count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_rate_limits_updated_at_idx
  ON public.api_rate_limits(updated_at);

COMMIT;
