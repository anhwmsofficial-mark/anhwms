-- ====================================================================
-- Backfill user_profiles.org_id from inbound activity
-- - only when a user maps to exactly one org_id
-- ====================================================================

BEGIN;

-- Bypass app/user triggers during controlled backfill
ALTER TABLE public.user_profiles DISABLE TRIGGER USER;

WITH inferred_org AS (
  SELECT created_by AS user_id, org_id::text AS org_id_text
  FROM public.inbound_plans
  WHERE created_by IS NOT NULL
    AND org_id IS NOT NULL

  UNION ALL

  SELECT created_by AS user_id, org_id::text AS org_id_text
  FROM public.inbound_receipts
  WHERE created_by IS NOT NULL
    AND org_id IS NOT NULL
),
resolved_org AS (
  SELECT
    user_id,
    min(org_id_text)::uuid AS org_id
  FROM inferred_org
  GROUP BY user_id
  HAVING count(DISTINCT org_id_text) = 1
)
UPDATE public.user_profiles up
SET org_id = ro.org_id
FROM resolved_org ro
WHERE up.id = ro.user_id
  AND up.org_id IS NULL;

ALTER TABLE public.user_profiles ENABLE TRIGGER USER;

COMMIT;

NOTIFY pgrst, 'reload schema';
