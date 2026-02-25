-- ====================================================================
-- Normalize RLS auth calls for initplan (behavior-preserving)
-- - Keep policy logic as-is
-- - Convert direct auth.uid()/auth.role() to (select ...)
-- - Do NOT double-wrap already normalized expressions
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
      -- Protect already wrapped calls first, then normalize direct calls.
      new_qual := replace(new_qual, '(select auth.uid())', '__AUTH_UID_WRAPPED__');
      new_qual := replace(new_qual, '(select auth.role())', '__AUTH_ROLE_WRAPPED__');
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
      new_qual := replace(new_qual, 'auth.role()', '(select auth.role())');
      new_qual := replace(new_qual, '__AUTH_UID_WRAPPED__', '(select auth.uid())');
      new_qual := replace(new_qual, '__AUTH_ROLE_WRAPPED__', '(select auth.role())');
    END IF;

    IF new_check IS NOT NULL THEN
      -- Protect already wrapped calls first, then normalize direct calls.
      new_check := replace(new_check, '(select auth.uid())', '__AUTH_UID_WRAPPED__');
      new_check := replace(new_check, '(select auth.role())', '__AUTH_ROLE_WRAPPED__');
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
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

COMMIT;

NOTIFY pgrst, 'reload schema';
