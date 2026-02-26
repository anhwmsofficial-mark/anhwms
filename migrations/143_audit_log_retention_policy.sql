-- ====================================================================
-- Audit log retention policy (hot/cold)
-- - Keep recent rows in public.audit_logs (hot)
-- - Move old rows to public.audit_logs_archive (cold)
-- - Provide maintenance functions for archive/purge
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
  id uuid PRIMARY KEY,
  actor_id uuid,
  actor_role varchar(50),
  action_type varchar(50) NOT NULL,
  resource_type varchar(50) NOT NULL,
  resource_id varchar(100),
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_created_at_desc
  ON public.audit_logs_archive (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_archived_at_desc
  ON public.audit_logs_archive (archived_at DESC);

ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs archive" ON public.audit_logs_archive;
DROP POLICY IF EXISTS "Insert audit logs archive" ON public.audit_logs_archive;

CREATE POLICY "Admins can view audit logs archive" ON public.audit_logs_archive
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Insert audit logs archive" ON public.audit_logs_archive
  FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.archive_audit_logs(
  p_retention_days integer DEFAULT 90,
  p_batch_size integer DEFAULT 5000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retention_days integer := GREATEST(COALESCE(p_retention_days, 90), 1);
  v_batch_size integer := GREATEST(COALESCE(p_batch_size, 5000), 1);
  v_moved integer := 0;
BEGIN
  WITH candidates AS (
    SELECT a.*
    FROM public.audit_logs a
    WHERE a.created_at < now() - make_interval(days => v_retention_days)
    ORDER BY a.created_at ASC
    LIMIT v_batch_size
  ),
  moved AS (
    INSERT INTO public.audit_logs_archive (
      id,
      actor_id,
      actor_role,
      action_type,
      resource_type,
      resource_id,
      old_value,
      new_value,
      reason,
      ip_address,
      user_agent,
      created_at,
      archived_at
    )
    SELECT
      c.id,
      c.actor_id,
      c.actor_role,
      c.action_type,
      c.resource_type,
      c.resource_id,
      c.old_value,
      c.new_value,
      c.reason,
      c.ip_address,
      c.user_agent,
      c.created_at,
      now()
    FROM candidates c
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  DELETE FROM public.audit_logs a
  USING moved m
  WHERE a.id = m.id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_audit_logs_archive(
  p_keep_days integer DEFAULT 365,
  p_batch_size integer DEFAULT 10000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep_days integer := GREATEST(COALESCE(p_keep_days, 365), 1);
  v_batch_size integer := GREATEST(COALESCE(p_batch_size, 10000), 1);
  v_deleted integer := 0;
BEGIN
  WITH candidates AS (
    SELECT id
    FROM public.audit_logs_archive
    WHERE created_at < now() - make_interval(days => v_keep_days)
    ORDER BY created_at ASC
    LIMIT v_batch_size
  )
  DELETE FROM public.audit_logs_archive a
  USING candidates c
  WHERE a.id = c.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_audit_log_retention(
  p_hot_retention_days integer DEFAULT 90,
  p_archive_keep_days integer DEFAULT 365,
  p_batch_size integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at timestamptz := now();
  v_archived integer := 0;
  v_purged integer := 0;
  v_result jsonb;
BEGIN
  v_archived := public.archive_audit_logs(p_hot_retention_days, p_batch_size);
  v_purged := public.purge_audit_logs_archive(p_archive_keep_days, p_batch_size * 2);

  v_result := jsonb_build_object(
    'archived', v_archived,
    'purged', v_purged,
    'hotRetentionDays', p_hot_retention_days,
    'archiveKeepDays', p_archive_keep_days
  );

  INSERT INTO public.cron_job_runs (job_name, status, started_at, finished_at, meta)
  VALUES ('audit_log_retention', 'success', v_started_at, now(), v_result);

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.cron_job_runs (job_name, status, started_at, finished_at, error_message, meta)
    VALUES (
      'audit_log_retention',
      'failed',
      v_started_at,
      now(),
      SQLERRM,
      jsonb_build_object(
        'hotRetentionDays', p_hot_retention_days,
        'archiveKeepDays', p_archive_keep_days,
        'batchSize', p_batch_size
      )
    );
    RAISE;
END;
$$;

COMMIT;
