-- ====================================================================
-- Hotfix: restore inbound/admin visibility after whitelist rebuild
-- - Add explicit can_access_admin resolver for RLS
-- - Backfill user_profiles.org_id when single-org environment
-- - Rebuild wl_* policies to include can_access_admin users
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1) Helper for explicit admin-access users (viewer + can_access_admin)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_can_access_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND coalesce(up.can_access_admin, false) = true
      AND lower(coalesce(up.status, 'active')) = 'active'
      AND up.deleted_at IS NULL
      AND (up.locked_until IS NULL OR up.locked_until <= now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.rls_can_access_admin() TO authenticated;

-- --------------------------------------------------------------------
-- 2) org backfill for user_profiles (single-org safe auto-recovery)
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_org_count BIGINT;
  v_default_org_id uuid;
BEGIN
  SELECT count(*) INTO v_org_count
  FROM public.org;

  IF v_org_count = 1 THEN
    SELECT id INTO v_default_org_id
    FROM public.org
    LIMIT 1;
  END IF;

  IF v_org_count = 1 AND v_default_org_id IS NOT NULL THEN
    UPDATE public.user_profiles up
       SET org_id = v_default_org_id
     WHERE up.org_id IS NULL
       AND (
         coalesce(up.can_access_admin, false) = true
         OR up.role IN ('admin', 'manager', 'operator', 'staff')
       );
  ELSE
    RAISE NOTICE 'Skipping auto backfill for user_profiles.org_id (org_count=%). Manual mapping required.', v_org_count;
  END IF;
END
$$;

-- --------------------------------------------------------------------
-- 3) Rebuild whitelist policies with can_access_admin allowance
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  role_expr TEXT := '(public.rls_whitelist_role() = ANY (ARRAY[''super_admin'',''admin'',''operator'',''seller'']) OR public.rls_can_access_admin())';
  tenant_expr TEXT := '(tenant_id::text = public.rls_current_tenant_id())';
BEGIN
  -- Non-tenant tables
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> 'user_profiles'
      AND table_name NOT IN (
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'wl_all_roles', t.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      'wl_all_roles',
      t.table_name,
      role_expr,
      role_expr
    );
  END LOOP;

  -- Tenant tables
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'wl_tenant_roles', t.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((%s) AND (%s)) WITH CHECK ((%s) AND (%s))',
      'wl_tenant_roles',
      t.table_name,
      role_expr,
      tenant_expr,
      role_expr,
      tenant_expr
    );
  END LOOP;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
