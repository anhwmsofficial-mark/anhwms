-- ====================================================================
-- inventory import run logs
-- 목적: staging import 실행 이력/결과 추적
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS inventory_import_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  source_file_name text,
  dry_run boolean not null default true,
  requested_limit integer not null default 1000,
  selected_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  status text not null default 'SUCCESS' check (status in ('SUCCESS', 'FAILED')),
  error_message text,
  requested_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_import_runs_tenant_created
  ON inventory_import_runs(tenant_id, created_at desc);

ALTER TABLE inventory_import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read inventory import runs" ON inventory_import_runs;
DROP POLICY IF EXISTS "Internal users can insert inventory import runs" ON inventory_import_runs;

CREATE POLICY "Internal users can read inventory import runs" ON inventory_import_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_import_runs.tenant_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can insert inventory import runs" ON inventory_import_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_import_runs.tenant_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
