-- ====================================================================
-- Merge remaining permissive policy duplicates on users/user_profiles
-- - target tables: public.users, public.user_profiles
-- - merge multiple policies for same (table, cmd, roles) into one OR policy
-- - preserves permissive semantics while removing linter duplicates
-- ====================================================================

BEGIN;

DO $$
DECLARE
  g RECORD;
  pol RECORD;
  roles_sql TEXT;
  merged_name TEXT;
  using_expr TEXT;
  check_expr TEXT;
BEGIN
  FOR g IN
    SELECT
      schemaname,
      tablename,
      cmd,
      roles,
      COUNT(*) AS cnt
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'user_profiles')
      AND permissive = 'PERMISSIVE'
      AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    GROUP BY schemaname, tablename, cmd, roles
    HAVING COUNT(*) > 1
  LOOP
    SELECT COALESCE(string_agg(quote_ident(r), ', '), 'public')
      INTO roles_sql
    FROM unnest(g.roles) AS r;

    SELECT string_agg(
             format('(%s)', COALESCE(pp.qual, 'true')),
             ' OR '
           )
      INTO using_expr
    FROM pg_policies pp
    WHERE pp.schemaname = g.schemaname
      AND pp.tablename = g.tablename
      AND pp.cmd = g.cmd
      AND pp.roles = g.roles
      AND pp.permissive = 'PERMISSIVE';

    SELECT string_agg(
             format('(%s)', COALESCE(pp.with_check, 'true')),
             ' OR '
           )
      INTO check_expr
    FROM pg_policies pp
    WHERE pp.schemaname = g.schemaname
      AND pp.tablename = g.tablename
      AND pp.cmd = g.cmd
      AND pp.roles = g.roles
      AND pp.permissive = 'PERMISSIVE';

    merged_name := format(
      'merged_%s_%s_%s',
      g.tablename,
      lower(g.cmd),
      substr(md5(array_to_string(g.roles, ',')), 1, 8)
    );

    -- Drop all existing policies in this duplicate group.
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = g.schemaname
        AND tablename = g.tablename
        AND cmd = g.cmd
        AND roles = g.roles
        AND permissive = 'PERMISSIVE'
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON %I.%I',
        pol.policyname, g.schemaname, g.tablename
      );
    END LOOP;

    -- Create one merged policy for this role+action set.
    IF g.cmd = 'SELECT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR SELECT TO %s USING (%s)',
        merged_name, g.schemaname, g.tablename, roles_sql, COALESCE(using_expr, 'true')
      );
    ELSIF g.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR DELETE TO %s USING (%s)',
        merged_name, g.schemaname, g.tablename, roles_sql, COALESCE(using_expr, 'true')
      );
    ELSIF g.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR INSERT TO %s WITH CHECK (%s)',
        merged_name, g.schemaname, g.tablename, roles_sql, COALESCE(check_expr, 'true')
      );
    ELSIF g.cmd = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
        merged_name, g.schemaname, g.tablename, roles_sql,
        COALESCE(using_expr, 'true'),
        COALESCE(check_expr, 'true')
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
