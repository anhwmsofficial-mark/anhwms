-- ====================================================================
-- Final advisor cleanup (behavior-preserving)
-- 1) Normalize remaining auth.uid()/auth.role() calls for initplan
-- 2) Drop permissive policies dominated by broader TRUE policies
-- ====================================================================

BEGIN;

DO $$
DECLARE
  rec RECORD;
  new_qual TEXT;
  new_check TEXT;
  roles_sql TEXT;
  using_sql TEXT;
  check_sql TEXT;
BEGIN
  -- ---------------------------------------------------------------
  -- 1) Normalize auth calls (space-tolerant, no double-wrap)
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '') ~ 'auth\.(uid|role)\s*\(\s*\)'
        OR COALESCE(with_check, '') ~ 'auth\.(uid|role)\s*\(\s*\)'
      )
  LOOP
    new_qual := rec.qual;
    new_check := rec.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '\(\s*select\s+auth\.uid\s*\(\s*\)\s*\)', '__AUTH_UID_WRAPPED__', 'gi');
      new_qual := regexp_replace(new_qual, '\(\s*select\s+auth\.role\s*\(\s*\)\s*\)', '__AUTH_ROLE_WRAPPED__', 'gi');
      new_qual := regexp_replace(new_qual, 'auth\.uid\s*\(\s*\)', '(select auth.uid())', 'gi');
      new_qual := regexp_replace(new_qual, 'auth\.role\s*\(\s*\)', '(select auth.role())', 'gi');
      new_qual := replace(new_qual, '__AUTH_UID_WRAPPED__', '(select auth.uid())');
      new_qual := replace(new_qual, '__AUTH_ROLE_WRAPPED__', '(select auth.role())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '\(\s*select\s+auth\.uid\s*\(\s*\)\s*\)', '__AUTH_UID_WRAPPED__', 'gi');
      new_check := regexp_replace(new_check, '\(\s*select\s+auth\.role\s*\(\s*\)\s*\)', '__AUTH_ROLE_WRAPPED__', 'gi');
      new_check := regexp_replace(new_check, 'auth\.uid\s*\(\s*\)', '(select auth.uid())', 'gi');
      new_check := regexp_replace(new_check, 'auth\.role\s*\(\s*\)', '(select auth.role())', 'gi');
      new_check := replace(new_check, '__AUTH_UID_WRAPPED__', '(select auth.uid())');
      new_check := replace(new_check, '__AUTH_ROLE_WRAPPED__', '(select auth.role())');
    END IF;

    IF new_qual IS DISTINCT FROM rec.qual OR new_check IS DISTINCT FROM rec.with_check THEN
      SELECT string_agg(quote_ident(r), ', ')
      INTO roles_sql
      FROM unnest(rec.roles) AS r;

      IF roles_sql IS NULL OR roles_sql = '' THEN
        roles_sql := 'public';
      END IF;

      using_sql := CASE WHEN new_qual IS NOT NULL THEN format(' USING (%s)', new_qual) ELSE '' END;
      check_sql := CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END;

      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON %I.%I',
        rec.policyname, rec.schemaname, rec.tablename
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
        rec.policyname, rec.schemaname, rec.tablename,
        rec.permissive, rec.cmd, roles_sql, using_sql, check_sql
      );
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------
  -- 2) Drop dominated permissive policies
  -- Dominance rule: broader policy predicate is literal TRUE.
  -- ---------------------------------------------------------------

  -- 2-a) Same command: A dominates S when S.roles <@ A.roles and A is TRUE.
  FOR rec IN
    SELECT s.schemaname, s.tablename, s.policyname
    FROM pg_policies s
    JOIN pg_policies a
      ON a.schemaname = s.schemaname
     AND a.tablename = s.tablename
     AND a.permissive = 'PERMISSIVE'
     AND s.permissive = 'PERMISSIVE'
     AND a.policyname <> s.policyname
     AND a.cmd = s.cmd
     AND s.roles <@ a.roles
    WHERE s.schemaname = 'public'
      AND s.cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      AND (
        (s.cmd IN ('SELECT', 'DELETE')
          AND COALESCE(a.qual, '') ~* '^\s*\(*\s*true\s*\)*\s*$')
        OR (s.cmd = 'INSERT'
          AND COALESCE(a.with_check, '') ~* '^\s*\(*\s*true\s*\)*\s*$')
        OR (s.cmd = 'UPDATE'
          AND COALESCE(a.qual, '') ~* '^\s*\(*\s*true\s*\)*\s*$'
          AND COALESCE(a.with_check, '') ~* '^\s*\(*\s*true\s*\)*\s*$')
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );
  END LOOP;

  -- 2-b) FOR ALL dominates command policy when ALL side is TRUE.
  FOR rec IN
    SELECT s.schemaname, s.tablename, s.policyname
    FROM pg_policies s
    JOIN pg_policies a
      ON a.schemaname = s.schemaname
     AND a.tablename = s.tablename
     AND a.permissive = 'PERMISSIVE'
     AND s.permissive = 'PERMISSIVE'
     AND a.cmd = 'ALL'
     AND a.policyname <> s.policyname
     AND s.roles <@ a.roles
    WHERE s.schemaname = 'public'
      AND s.cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      AND (
        (s.cmd IN ('SELECT', 'DELETE')
          AND COALESCE(a.qual, '') ~* '^\s*\(*\s*true\s*\)*\s*$')
        OR (s.cmd = 'INSERT'
          AND COALESCE(a.with_check, '') ~* '^\s*\(*\s*true\s*\)*\s*$')
        OR (s.cmd = 'UPDATE'
          AND COALESCE(a.qual, '') ~* '^\s*\(*\s*true\s*\)*\s*$'
          AND COALESCE(a.with_check, '') ~* '^\s*\(*\s*true\s*\)*\s*$')
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
