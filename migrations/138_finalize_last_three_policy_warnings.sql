-- ====================================================================
-- Final cleanup for last 3 multiple_permissive_policies warnings
-- ====================================================================

BEGIN;

DO $$
DECLARE
  using_expr TEXT;
  check_expr TEXT;
BEGIN
  -- 1) user_profiles SELECT (authenticated): keep merged policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'merged_user_profiles_select_4c9184f3'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.user_profiles';
  END IF;

  -- 2) users SELECT (authenticated): keep merged policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'merged_users_select_4c9184f3'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users';
  END IF;

  -- 3) users UPDATE (authenticated): merge two remaining policies into one
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND cmd = 'UPDATE'
      AND policyname IN ('Admins can update profiles', 'Enable update for users themselves')
  ) THEN
    SELECT string_agg(format('(%s)', COALESCE(p.qual, 'true')), ' OR ')
      INTO using_expr
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'users'
      AND p.cmd = 'UPDATE'
      AND p.policyname IN ('Admins can update profiles', 'Enable update for users themselves');

    -- Effective WITH CHECK for UPDATE is: with_check if present, else qual.
    SELECT string_agg(format('(%s)', COALESCE(p.with_check, p.qual, 'true')), ' OR ')
      INTO check_expr
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'users'
      AND p.cmd = 'UPDATE'
      AND p.policyname IN ('Admins can update profiles', 'Enable update for users themselves');

    EXECUTE 'DROP POLICY IF EXISTS "Admins can update profiles" ON public.users';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update for users themselves" ON public.users';
    EXECUTE 'DROP POLICY IF EXISTS "merged_users_update_authenticated_final" ON public.users';

    EXECUTE format(
      'CREATE POLICY %I ON public.users FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      'merged_users_update_authenticated_final',
      COALESCE(using_expr, 'true'),
      COALESCE(check_expr, 'true')
    );
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
