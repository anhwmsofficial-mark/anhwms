-- ====================================================================
-- Drop redundant permissive RLS policies (role-superset stage)
-- - Remove policy S when policy A has same/equivalent command predicate
-- - And S.roles is a subset of A.roles
-- - Behavior-preserving under role coverage assumption
-- ====================================================================

BEGIN;

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- ---------------------------------------------------------------
  -- Same command redundancy with role superset
  -- ---------------------------------------------------------------
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
     AND COALESCE(a.qual, '') = COALESCE(s.qual, '')
     AND COALESCE(a.with_check, '') = COALESCE(s.with_check, '')
    WHERE s.schemaname = 'public'
      AND s.cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname,
      rec.schemaname,
      rec.tablename
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- Command policy redundant to FOR ALL with role superset
  -- ---------------------------------------------------------------
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
        (s.cmd = 'SELECT'
          AND COALESCE(s.qual, '') = COALESCE(a.qual, ''))
        OR (s.cmd = 'DELETE'
          AND COALESCE(s.qual, '') = COALESCE(a.qual, ''))
        OR (s.cmd = 'INSERT'
          AND COALESCE(s.with_check, '') = COALESCE(a.with_check, ''))
        OR (s.cmd = 'UPDATE'
          AND COALESCE(s.qual, '') = COALESCE(a.qual, '')
          AND COALESCE(s.with_check, '') = COALESCE(a.with_check, ''))
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

COMMIT;

NOTIFY pgrst, 'reload schema';
