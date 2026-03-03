-- ====================================================================
-- Hotfix: allow admin-access users to read tenant tables
-- - purpose: immediate inbound/dashboard visibility restore
-- - scope: SELECT only (no write expansion)
-- ====================================================================

BEGIN;

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'tenant_id'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'wl_tenant_admin_select',
      t.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.rls_can_access_admin())',
      'wl_tenant_admin_select',
      t.table_name
    );
  END LOOP;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
