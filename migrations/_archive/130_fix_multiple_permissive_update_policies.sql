-- ====================================================================
-- Supabase Advisor lint follow-up
-- - multiple_permissive_policies: remove UPDATE policy redundant to FOR ALL
-- ====================================================================

BEGIN;

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
      AND s.cmd = 'UPDATE'
      AND COALESCE(s.qual, '') = COALESCE(a.qual, '')
      AND COALESCE(s.with_check, '') = COALESCE(a.with_check, '')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname,
      rec.schemaname,
      rec.tablename
    );
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
