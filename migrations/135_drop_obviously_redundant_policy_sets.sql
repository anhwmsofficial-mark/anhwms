-- ====================================================================
-- Drop obviously redundant policy sets (name-pattern based)
-- - Keep behavior while removing clear duplicates still flagged by linter
-- ====================================================================

BEGIN;

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- ---------------------------------------------------------------
  -- 1) Ensure remaining auth.jwt() call is initplan-friendly
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND COALESCE(qual, '') ~ 'auth\.jwt\s*\(\s*\)'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s USING (%s)%s',
      rec.policyname,
      rec.schemaname,
      rec.tablename,
      rec.permissive,
      rec.cmd,
      (
        SELECT COALESCE(string_agg(quote_ident(r), ', '), 'public')
        FROM unnest(rec.roles) AS r
      ),
      regexp_replace(rec.qual, 'auth\.jwt\s*\(\s*\)', '(select auth.jwt())', 'gi'),
      CASE
        WHEN rec.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', rec.with_check)
        ELSE ''
      END
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 2) If table already has explicit all-users CRUD policies,
  --    "Enable write access for authenticated users" is redundant.
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.policyname = 'Enable write access for authenticated users'
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = p.schemaname
          AND x.tablename = p.tablename
          AND x.policyname = 'Enable insert for all users'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = p.schemaname
          AND x.tablename = p.tablename
          AND x.policyname = 'Enable update for all users'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = p.schemaname
          AND x.tablename = p.tablename
          AND x.policyname = 'Enable delete for all users'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 3) "Enable all access for authenticated users" dominates
  --    "Internal users can ..." policies on same table.
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.policyname LIKE 'Internal users can %'
      AND EXISTS (
        SELECT 1
        FROM pg_policies a
        WHERE a.schemaname = p.schemaname
          AND a.tablename = p.tablename
          AND a.policyname = 'Enable all access for authenticated users'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 4) Orders: public read/insert policies dominate partner-specific
  --    policies for same actions.
  -- ---------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Enable read access for all users'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Partners can view own orders" ON public.orders';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Enable insert for all users'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Partners can insert own orders" ON public.orders';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
