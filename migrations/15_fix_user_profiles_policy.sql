-- ============================================================
-- 15_fix_user_profiles_policy.sql
-- Fix recursive RLS policy on user_profiles causing 42P17
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Admins can view all profiles'
      AND schemaname = 'public'
      AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can view all profiles" ON public.user_profiles';
  END IF;

  EXECUTE '
    CREATE POLICY "Admins can view all profiles"
      ON public.user_profiles FOR SELECT
      USING (is_admin(auth.uid()))
  ';

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Admins can update all profiles'
      AND schemaname = 'public'
      AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can update all profiles" ON public.user_profiles';
  END IF;

  EXECUTE '
    CREATE POLICY "Admins can update all profiles"
      ON public.user_profiles FOR UPDATE
      USING (is_admin(auth.uid()))
  ';
END $$;
-- ============================================================
-- 15_fix_user_profiles_policy.sql
-- Fix recursive RLS policy on user_profiles causing 42P17
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE polname = 'Admins can view all profiles'
      AND schemaname = 'public'
      AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can view all profiles" ON public.user_profiles';
  END IF;

  EXECUTE '
    CREATE POLICY "Admins can view all profiles"
      ON public.user_profiles FOR SELECT
      USING (is_admin(auth.uid()))
  ';

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE polname = 'Admins can update all profiles'
      AND schemaname = 'public'
      AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can update all profiles" ON public.user_profiles';
  END IF;

  EXECUTE '
    CREATE POLICY "Admins can update all profiles"
      ON public.user_profiles FOR UPDATE
      USING (is_admin(auth.uid()))
  ';
END $$;

