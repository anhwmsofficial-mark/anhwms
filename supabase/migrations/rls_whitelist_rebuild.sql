-- ====================================================================
-- RLS Whitelist Rebuild (Global)
-- - Drop legacy permissive policies
-- - Default DENY + block anon
-- - Role whitelist via auth.jwt()->>'role'
-- - Tenant isolation for all tenant_id tables
-- - user_profiles special rules
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1) Precheck (fail fast before any mutation)
--    - org_id tables that will be promoted must not contain org_id NULL
--    - existing tenant_id tables must not contain tenant_id NULL
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  null_rows BIGINT;
BEGIN
  -- A) org_id -> tenant_id promotion candidates
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'org_id'
      AND c.table_name NOT IN ('org', 'user_profiles')
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = c.table_schema
          AND x.table_name = c.table_name
          AND x.column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE org_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      RAISE EXCEPTION
        'precheck failed: public.% has org_id NULL rows=% (cannot backfill tenant_id)',
        t.table_name, null_rows;
    END IF;
  END LOOP;

  -- B) already-tenantized tables
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
      'SELECT count(*) FROM public.%I WHERE tenant_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      RAISE EXCEPTION
        'precheck failed: public.% has tenant_id NULL rows=%',
        t.table_name, null_rows;
    END IF;
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 2) Block anon access globally
-- --------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- --------------------------------------------------------------------
-- 3) Remove all existing policies in public schema
-- --------------------------------------------------------------------
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 4) Enable + force RLS on all base tables (default deny)
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 5) Auto-promote org_id tables to tenant_id
--    - target: tables having org_id but missing tenant_id
--    - exclude: public.org, public.user_profiles
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  null_rows BIGINT;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'org_id'
      AND c.table_name NOT IN ('org', 'user_profiles')
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = c.table_schema
          AND x.table_name = c.table_name
          AND x.column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid',
      t.table_name
    );

    EXECUTE format(
      'UPDATE public.%I SET tenant_id = org_id WHERE tenant_id IS NULL',
      t.table_name
    );

    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      RAISE EXCEPTION
        'tenant_id backfill failed on public.%, null rows=%',
        t.table_name, null_rows;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
      t.table_name
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 6) Role/tenant resolver helpers (legacy role compatibility)
--    - manager -> admin
--    - staff   -> operator
--    - partner -> seller
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_current_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := nullif(auth.jwt()->>'role', '');

  IF v_role IS NULL THEN
    v_role := nullif((auth.jwt()->'app_metadata'->>'role'), '');
  END IF;

  IF v_role IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT up.role
      INTO v_role
      FROM public.user_profiles up
     WHERE up.id = auth.uid();
  END IF;

  RETURN lower(coalesce(v_role, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.rls_whitelist_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE public.rls_current_role()
    WHEN 'manager' THEN 'admin'
    WHEN 'staff' THEN 'operator'
    WHEN 'partner' THEN 'seller'
    ELSE public.rls_current_role()
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_current_tenant_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant text;
BEGIN
  v_tenant := nullif(auth.jwt()->>'tenant_id', '');

  IF v_tenant IS NULL THEN
    v_tenant := nullif((auth.jwt()->'app_metadata'->>'tenant_id'), '');
  END IF;

  IF v_tenant IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT up.org_id::text
      INTO v_tenant
      FROM public.user_profiles up
     WHERE up.id = auth.uid();
  END IF;

  RETURN coalesce(v_tenant, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rls_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_whitelist_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_current_tenant_id() TO authenticated;

-- --------------------------------------------------------------------
-- 7) Base whitelist policy for non-tenant tables (excluding user_profiles)
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  role_expr TEXT := 'public.rls_whitelist_role() = ANY (ARRAY[''super_admin'',''admin'',''operator'',''seller''])';
BEGIN
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
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      'wl_all_roles',
      t.table_name,
      role_expr,
      role_expr
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 8) Tenant tables: tenant_id required + role+tenant whitelist
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  null_rows BIGINT;
  role_expr TEXT := 'public.rls_whitelist_role() = ANY (ARRAY[''super_admin'',''admin'',''operator'',''seller''])';
  tenant_expr TEXT := 'tenant_id::text = public.rls_current_tenant_id()';
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
      'SELECT count(*) FROM public.%I WHERE tenant_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      RAISE EXCEPTION
        'tenant_id NOT NULL precheck failed on public.%, null rows=%',
        t.table_name, null_rows;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
      t.table_name
    );

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

-- --------------------------------------------------------------------
-- 9) user_profiles special rules
-- --------------------------------------------------------------------
-- SELECT: self-read 허용 + role whitelist
CREATE POLICY wl_user_profiles_select
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.rls_whitelist_role() = ANY (ARRAY['super_admin','admin','operator','seller'])
);

-- UPDATE: self or super_admin (column-level restrictions enforced by trigger below)
CREATE POLICY wl_user_profiles_update
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR public.rls_whitelist_role() = 'super_admin'
)
WITH CHECK (
  auth.uid() = id
  OR public.rls_whitelist_role() = 'super_admin'
);

-- DELETE: super_admin only
CREATE POLICY wl_user_profiles_delete
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  public.rls_whitelist_role() = 'super_admin'
);

-- INSERT: client/authenticated 차단, 서버 전용(service_role/SECURITY DEFINER) 경로만 허용
REVOKE INSERT ON public.user_profiles FROM authenticated;
CREATE POLICY wl_user_profiles_insert_service_only
ON public.user_profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- --------------------------------------------------------------------
-- 10) user_profiles update column guard
--    - non-super_admin: self row only + protected columns immutable
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_profiles_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT := public.rls_whitelist_role();
BEGIN
  -- Backend trusted path (service_role) bypass
  IF current_user = 'service_role' OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- super_admin can update any column
  IF v_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Others must update only their own row
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'user_profiles update denied: only owner can update own row';
  END IF;

  -- Protected columns: only super_admin can modify
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
     OR NEW.can_access_admin IS DISTINCT FROM OLD.can_access_admin
     OR NEW.can_access_dashboard IS DISTINCT FROM OLD.can_access_dashboard
     OR NEW.can_manage_users IS DISTINCT FROM OLD.can_manage_users
     OR NEW.can_manage_inventory IS DISTINCT FROM OLD.can_manage_inventory
     OR NEW.can_manage_orders IS DISTINCT FROM OLD.can_manage_orders
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.locked_until IS DISTINCT FROM OLD.locked_until
     OR NEW.locked_reason IS DISTINCT FROM OLD.locked_reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
  THEN
    RAISE EXCEPTION 'user_profiles update denied: protected columns require super_admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_update_guard ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_update_guard
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_profiles_update_guard();

COMMIT;

NOTIFY pgrst, 'reload schema';
