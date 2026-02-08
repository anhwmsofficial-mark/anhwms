-- ====================================================================
-- P0 Cron job run tracking
-- ====================================================================

CREATE TABLE IF NOT EXISTS cron_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('success','failed','skipped')),
  attempts integer not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  next_retry_at timestamptz,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cron_job_runs_job_name_idx
  ON cron_job_runs(job_name, started_at desc);

ALTER TABLE cron_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read cron job runs" ON cron_job_runs;
DROP POLICY IF EXISTS "Admin can insert cron job runs" ON cron_job_runs;

CREATE POLICY "Admin can read cron job runs" ON cron_job_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert cron job runs" ON cron_job_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
