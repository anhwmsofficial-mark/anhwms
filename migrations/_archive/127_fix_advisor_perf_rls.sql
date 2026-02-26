-- ====================================================================
-- Supabase Advisor performance lint fixes
-- - auth_rls_initplan: wrap auth.uid()/auth.role() with (select ...)
-- - multiple_permissive_policies: remove policies fully redundant to FOR ALL
-- - duplicate_index: drop duplicated index on external_quote_inquiry
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1) auth_rls_initplan
-- Recreate policies that still directly call auth.uid()/auth.role()
-- so they use initplan-friendly scalar subquery calls.
-- --------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  new_qual TEXT;
  new_check TEXT;
  roles_sql TEXT;
  using_sql TEXT;
  check_sql TEXT;
BEGIN
  FOR rec IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '') ~ 'auth\.(uid|role)\(\)'
        OR COALESCE(with_check, '') ~ 'auth\.(uid|role)\(\)'
      )
  LOOP
    new_qual := rec.qual;
    new_check := rec.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_qual := regexp_replace(new_qual, 'auth\.role\(\)', '(select auth.role())', 'g');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_check := regexp_replace(new_check, 'auth\.role\(\)', '(select auth.role())', 'g');
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
        rec.policyname,
        rec.schemaname,
        rec.tablename
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
        rec.policyname,
        rec.schemaname,
        rec.tablename,
        rec.permissive,
        rec.cmd,
        roles_sql,
        using_sql,
        check_sql
      );
    END IF;
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- 2) multiple_permissive_policies
-- Drop policies that are exactly redundant to an existing FOR ALL policy
-- (same table + same roles + same condition for that action).
-- --------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT s.schemaname, s.tablename, s.policyname
    FROM pg_policies s
    JOIN pg_policies a
      ON a.schemaname = s.schemaname
     AND a.tablename = s.tablename
     AND a.cmd = 'ALL'
     AND a.policyname <> s.policyname
     AND a.roles = s.roles
    WHERE s.schemaname = 'public'
      AND s.cmd IN ('SELECT', 'INSERT', 'DELETE')
      AND (
        (s.cmd = 'SELECT' AND COALESCE(s.qual, '') = COALESCE(a.qual, ''))
        OR (s.cmd = 'INSERT' AND COALESCE(s.with_check, '') = COALESCE(a.with_check, ''))
        OR (s.cmd = 'DELETE' AND COALESCE(s.qual, '') = COALESCE(a.qual, ''))
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname,
      rec.schemaname,
      rec.tablename
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- 3) duplicate_index
-- --------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_external_quote_assigned_to;

COMMIT;

NOTIFY pgrst, 'reload schema';
