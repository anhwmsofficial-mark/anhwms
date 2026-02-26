-- ====================================================================
-- Minimum API rate limiting foundation
-- - Counter table for fixed-window rate limiting
-- - Atomic counter bump function
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  scope text NOT NULL,
  actor_key text NOT NULL,
  actor_key_type text NOT NULL DEFAULT 'ip',
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_api_rate_limits PRIMARY KEY (scope, actor_key, window_start),
  CONSTRAINT chk_api_rate_limits_request_count_nonnegative CHECK (request_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated_at
ON public.api_rate_limits (updated_at DESC);

CREATE OR REPLACE FUNCTION public.bump_api_rate_limit(
  p_scope text,
  p_actor_key text,
  p_actor_key_type text,
  p_window_seconds integer
)
RETURNS TABLE(
  request_count integer,
  window_start timestamptz,
  window_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
BEGIN
  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_window_seconds must be > 0';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  INSERT INTO public.api_rate_limits (
    scope,
    actor_key,
    actor_key_type,
    window_start,
    request_count,
    created_at,
    updated_at
  )
  VALUES (
    p_scope,
    p_actor_key,
    COALESCE(NULLIF(p_actor_key_type, ''), 'ip'),
    v_window_start,
    1,
    now(),
    now()
  )
  ON CONFLICT (scope, actor_key, window_start)
  DO UPDATE
    SET request_count = public.api_rate_limits.request_count + 1,
        actor_key_type = EXCLUDED.actor_key_type,
        updated_at = now()
  RETURNING public.api_rate_limits.request_count
  INTO v_count;

  RETURN QUERY
  SELECT v_count, v_window_start, v_window_end;
END;
$$;

COMMIT;
