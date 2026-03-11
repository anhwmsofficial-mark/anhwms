BEGIN;

CREATE TABLE IF NOT EXISTS public.cron_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  next_retry_at timestamptz,
  error_message text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cron_job_runs_job_name_idx
  ON public.cron_job_runs (job_name, started_at DESC);

ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.cron_job_runs TO authenticated;
GRANT ALL ON TABLE public.cron_job_runs TO service_role;

DROP POLICY IF EXISTS "Admin can read cron job runs" ON public.cron_job_runs;
DROP POLICY IF EXISTS "Admin can insert cron job runs" ON public.cron_job_runs;

CREATE POLICY "Admin can read cron job runs" ON public.cron_job_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert cron job runs" ON public.cron_job_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
