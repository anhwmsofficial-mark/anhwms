-- ====================================================================
-- Targeted policy consolidation for remaining linter warnings
-- ====================================================================

BEGIN;

DO $$
DECLARE
  rec RECORD;
  q text;
  c text;
BEGIN
  -- ---------------------------------------------------------------
  -- 1) Orders: broad public read/insert already exists
  --    -> partner-scoped read/insert policies are redundant
  -- ---------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'Enable read access for all users'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Partners can view own orders" ON public.orders';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'Enable insert for all users'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Partners can insert own orders" ON public.orders';
  END IF;

  -- ---------------------------------------------------------------
  -- 2) Convert product_categories write-all policy to CUD-only
  --    to avoid SELECT overlap with read-all policy.
  -- ---------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_categories'
      AND policyname = 'Enable write access for authenticated users'
  ) THEN
    SELECT COALESCE(qual, 'true'), COALESCE(with_check, COALESCE(qual, 'true'))
      INTO q, c
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_categories'
      AND policyname = 'Enable write access for authenticated users'
    LIMIT 1;

    EXECUTE 'DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.product_categories';
    EXECUTE format(
      'CREATE POLICY %I ON public.product_categories FOR INSERT TO authenticated WITH CHECK (%s)',
      'Enable insert access for authenticated users', c
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.product_categories FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      'Enable update access for authenticated users', q, c
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.product_categories FOR DELETE TO authenticated USING (%s)',
      'Enable delete access for authenticated users', q
    );
  END IF;

  -- ---------------------------------------------------------------
  -- 3) Drop write-all policy when explicit public CRUD exists
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT p.tablename
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.policyname = 'Enable write access for authenticated users'
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = 'public' AND x.tablename = p.tablename
          AND x.policyname = 'Enable insert for all users'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = 'public' AND x.tablename = p.tablename
          AND x.policyname = 'Enable update for all users'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = 'public' AND x.tablename = p.tablename
          AND x.policyname = 'Enable delete for all users'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Enable write access for authenticated users', rec.tablename
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 4) Drop all-access-auth policy if public CRUD already exists
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT p.tablename
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.policyname = 'Enable all access for authenticated users'
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = 'public' AND x.tablename = p.tablename
          AND x.policyname = 'Enable insert for all users'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = 'public' AND x.tablename = p.tablename
          AND x.policyname = 'Enable update for all users'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = 'public' AND x.tablename = p.tablename
          AND x.policyname = 'Enable delete for all users'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname = 'public' AND x.tablename = p.tablename
          AND x.policyname = 'Enable read access for all users'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Enable all access for authenticated users', rec.tablename
    );
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
