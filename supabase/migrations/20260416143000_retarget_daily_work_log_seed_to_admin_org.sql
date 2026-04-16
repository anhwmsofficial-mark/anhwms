BEGIN;

WITH target_org AS (
  SELECT up.org_id
  FROM public.user_profiles up
  WHERE up.org_id IS NOT NULL
    AND lower(coalesce(up.status, 'active')) = 'active'
    AND (
      up.role = 'admin'
      OR coalesce(up.can_access_admin, false) = true
    )
  ORDER BY up.created_at ASC NULLS LAST, up.id ASC
  LIMIT 1
)
UPDATE public.customer_master cm
SET
  org_id = target_org.org_id,
  tenant_id = target_org.org_id,
  updated_at = now()
FROM target_org
WHERE cm.code IN (
  'DWL_CLIENT_YBK',
  'DWL_CLIENT_REBOOTLIGHT',
  'DWL_CLIENT_FROMDIS',
  'DWL_CLIENT_MONGFISH',
  'DWL_CLIENT_YULCARE',
  'DWL_CLIENT_ETC'
)
  AND target_org.org_id IS NOT NULL
  AND (cm.org_id IS DISTINCT FROM target_org.org_id OR cm.tenant_id IS DISTINCT FROM target_org.org_id);

WITH target_org AS (
  SELECT up.org_id
  FROM public.user_profiles up
  WHERE up.org_id IS NOT NULL
    AND lower(coalesce(up.status, 'active')) = 'active'
    AND (
      up.role = 'admin'
      OR coalesce(up.can_access_admin, false) = true
    )
  ORDER BY up.created_at ASC NULLS LAST, up.id ASC
  LIMIT 1
)
UPDATE public.warehouse wh
SET
  org_id = target_org.org_id,
  tenant_id = target_org.org_id,
  updated_at = now()
FROM target_org
WHERE wh.code IN (
  'DWL_WH_CENTER1_A',
  'DWL_WH_CENTER1_B',
  'DWL_WH_CENTER2_A',
  'DWL_WH_CENTER2_B'
)
  AND target_org.org_id IS NOT NULL
  AND (wh.org_id IS DISTINCT FROM target_org.org_id OR wh.tenant_id IS DISTINCT FROM target_org.org_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
