-- Account recovery stack, package A: server-side session snapshot storage.
--
-- Mirrors 0024_support_feedback.sql's idioms throughout (SECURITY DEFINER,
-- pinned search_path, auth.uid() null guard, pg_advisory_xact_lock before a
-- rate/size-guarded write, REVOKE FROM PUBLIC/anon + GRANT to
-- authenticated/service_role), but the shape of what's being protected is
-- different: this is a single-row-per-user upsert of the client's entire
-- local session state (see packages/shared/src/session/sessionSnapshot.ts),
-- not an append-only report log.
--
-- Unlike 0024's support_feedback table (no read policy at all -- a future
-- dashboard reads as service_role), a session snapshot must be readable by
-- its own owner so the client can restore it, so a SELECT-own RLS policy is
-- included here (same `auth.uid() = user_id` shape as
-- 0004_credit_ledger.sql's credit_wallets_select_own). There is still no
-- INSERT/UPDATE/DELETE policy -- the only write path is
-- upsert_session_snapshot below (SECURITY DEFINER), same reasoning as 0024:
-- writes need server-side validation (schema version, payload size, and a
-- monotonic client_updated_at guard) that a raw client upsert could not
-- enforce.

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_snapshots (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version     INTEGER NOT NULL,
  payload            JSONB NOT NULL,
  byte_size          INTEGER NOT NULL,
  client_updated_at  TIMESTAMPTZ NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_snapshots_select_own ON public.session_snapshots
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPC: upsert_session_snapshot
--
-- Validates schema_version and payload size, then upserts the caller's
-- single snapshot row -- but only if the incoming client_updated_at is not
-- older than what's already stored (monotonic guard), so a stale/out-of-order
-- write (e.g. a slow request from an older app state landing after a newer
-- one already saved) can never clobber a more recent snapshot. Same
-- soft-failure shape as 0024_support_feedback.sql's rate_limited outcome:
-- 'too_large'/'stale' are returned as a normal jsonb result, not raised, so
-- the client's autosave flow never has to treat "did not save this time" as
-- an alarming error.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_session_snapshot(
  p_schema_version    INTEGER,
  p_payload           JSONB,
  p_client_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_byte_size INTEGER;
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'upsert_session_snapshot: authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_schema_version IS NULL OR p_schema_version <= 0 THEN
    RAISE EXCEPTION 'upsert_session_snapshot: invalid schema_version' USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'upsert_session_snapshot: payload required' USING ERRCODE = '22023';
  END IF;

  IF p_client_updated_at IS NULL THEN
    RAISE EXCEPTION 'upsert_session_snapshot: client_updated_at required' USING ERRCODE = '22023';
  END IF;

  v_byte_size := octet_length(p_payload::TEXT);

  IF v_byte_size > 262144 THEN
    RETURN jsonb_build_object('outcome', 'too_large');
  END IF;

  -- Serializes concurrent saves from the same user around the upsert below,
  -- same reasoning as 0024_support_feedback.sql's advisory lock before its
  -- rate-limit count -- otherwise two concurrent saves could both pass the
  -- ON CONFLICT WHERE guard against the same pre-write snapshot.
  PERFORM pg_advisory_xact_lock(hashtext('session-snapshot:' || v_user::TEXT));

  INSERT INTO public.session_snapshots (
    user_id, schema_version, payload, byte_size, client_updated_at, updated_at
  ) VALUES (
    v_user, p_schema_version, p_payload, v_byte_size, p_client_updated_at, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    schema_version    = EXCLUDED.schema_version,
    payload           = EXCLUDED.payload,
    byte_size         = EXCLUDED.byte_size,
    client_updated_at = EXCLUDED.client_updated_at,
    updated_at        = now()
  WHERE EXCLUDED.client_updated_at >= public.session_snapshots.client_updated_at
  RETURNING public.session_snapshots.updated_at INTO v_updated_at;

  IF v_updated_at IS NULL THEN
    RETURN jsonb_build_object('outcome', 'stale');
  END IF;

  RETURN jsonb_build_object('outcome', 'saved', 'updated_at', v_updated_at);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_session_snapshot(INTEGER, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_session_snapshot(INTEGER, JSONB, TIMESTAMPTZ)
  TO authenticated, service_role;

COMMIT;
