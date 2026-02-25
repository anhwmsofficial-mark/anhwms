-- ====================================================================
-- Drop redundant permissive RLS policies (behavior-preserving, safe)
-- - Remove exact duplicates (same table/cmd/roles/USING/WITH CHECK)
-- - Remove command-specific policy when equivalent FOR ALL exists
-- ====================================================================

BEGIN;

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- ---------------------------------------------------------------
  -- 1) Exact duplicate policies for the same command
  -- Keep the lexicographically smallest policy name.
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM (
      SELECT
        schemaname,
        tablename,
        policyname,
        cmd,
        roles,
        COALESCE(qual, '') AS qual_n,
        COALESCE(with_check, '') AS check_n,
        ROW_NUMBER() OVER (
          PARTITION BY schemaname, tablename, cmd, roles, COALESCE(qual, ''), COALESCE(with_check, '')
          ORDER BY policyname
        ) AS rn
      FROM pg_policies
      WHERE schemaname = 'public'
        AND permissive = 'PERMISSIVE'
    ) p
    WHERE p.rn > 1
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname,
      rec.schemaname,
      rec.tablename
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 2) Command policy fully redundant to FOR ALL policy
  -- Same table + same roles + same effective predicates.
  -- ---------------------------------------------------------------
  FOR rec IN
    SELECT s.schemaname, s.tablename, s.policyname
    FROM pg_policies s
    JOIN pg_policies a
      ON a.schemaname = s.schemaname
     AND a.tablename = s.tablename
     AND a.permissive = 'PERMISSIVE'
     AND a.cmd = 'ALL'
     AND a.policyname <> s.policyname
     AND a.roles = s.roles
    WHERE s.schemaname = 'public'
      AND s.permissive = 'PERMISSIVE'
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
