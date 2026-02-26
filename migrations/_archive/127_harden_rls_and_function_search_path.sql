-- ====================================================================
-- Harden Supabase security lints (broad remediation)
-- - Fix mutable function search_path in public schema
-- - Replace overly permissive write policies (USING/WITH CHECK true)
-- - Keep policy names/roles/commands while hardening expressions
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 0) Extension in public
--    Move pg_trgm extension out of public schema if present.
-- --------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END
$$;

-- --------------------------------------------------------------------
-- 1) Function Search Path Mutable
--    Set an explicit search_path for every function in public schema
--    that does not already define one.
-- --------------------------------------------------------------------
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS fn_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM unnest(p.proconfig) cfg
          WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, pg_temp',
      fn.fn_sig
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 2) RLS policy hardening
--    Detect write policies that are effectively open:
--      - USING (true)
--      - WITH CHECK (true)
--    Then recreate them with authenticated-only checks.
-- --------------------------------------------------------------------
DO $$
DECLARE
  p record;
  roles_sql text;
  cmd_sql text;
  mode_sql text;
  auth_expr text := '(auth.uid() IS NOT NULL)';
BEGIN
  FOR p IN
    SELECT
      pol.schemaname,
      pol.tablename,
      pol.policyname,
      pol.cmd,
      pol.permissive,
      pol.roles,
      pol.qual,
      pol.with_check
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (
        COALESCE(btrim(pol.qual), '') IN ('true', '(true)')
        OR COALESCE(btrim(pol.with_check), '') IN ('true', '(true)')
      )
  LOOP
    SELECT string_agg(quote_ident(r), ', ')
      INTO roles_sql
    FROM unnest(p.roles) AS r;

    IF roles_sql IS NULL OR roles_sql = '' THEN
      roles_sql := 'public';
    END IF;

    IF p.permissive = 'PERMISSIVE' THEN
      mode_sql := 'AS PERMISSIVE';
    ELSE
      mode_sql := 'AS RESTRICTIVE';
    END IF;

    cmd_sql := CASE p.cmd
      WHEN 'ALL' THEN 'FOR ALL'
      WHEN 'SELECT' THEN 'FOR SELECT'
      WHEN 'INSERT' THEN 'FOR INSERT'
      WHEN 'UPDATE' THEN 'FOR UPDATE'
      WHEN 'DELETE' THEN 'FOR DELETE'
      ELSE 'FOR ALL'
    END;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );

    IF p.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I %s %s TO %s WITH CHECK %s',
        p.policyname, p.schemaname, p.tablename, mode_sql, cmd_sql, roles_sql, auth_expr
      );
    ELSIF p.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I %s %s TO %s USING %s',
        p.policyname, p.schemaname, p.tablename, mode_sql, cmd_sql, roles_sql, auth_expr
      );
    ELSE
      -- UPDATE and ALL need both USING and WITH CHECK for writes.
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I %s %s TO %s USING %s WITH CHECK %s',
        p.policyname, p.schemaname, p.tablename, mode_sql, cmd_sql, roles_sql, auth_expr, auth_expr
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
