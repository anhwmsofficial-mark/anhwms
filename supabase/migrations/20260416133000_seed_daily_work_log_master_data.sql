BEGIN;

WITH target_org AS (
  SELECT id
  FROM public.org
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
INSERT INTO public.customer_master (
  tenant_id,
  org_id,
  code,
  name,
  type,
  status,
  country_code,
  billing_currency,
  billing_cycle,
  payment_terms,
  metadata
)
SELECT
  target_org.id,
  target_org.id,
  seed.code,
  seed.name,
  'DIRECT_BRAND',
  'ACTIVE',
  'KR',
  'KRW',
  'MONTHLY',
  30,
  jsonb_build_object('seed_source', 'daily_work_log')
FROM target_org
JOIN (
  VALUES
    ('DWL_CLIENT_YBK', 'YBK'),
    ('DWL_CLIENT_REBOOTLIGHT', '리부트라이트'),
    ('DWL_CLIENT_FROMDIS', '프롬디스'),
    ('DWL_CLIENT_MONGFISH', '몽페쉬'),
    ('DWL_CLIENT_YULCARE', '율케어시스템'),
    ('DWL_CLIENT_ETC', '기타')
) AS seed(code, name) ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.customer_master existing
  WHERE existing.code = seed.code
);

WITH target_org AS (
  SELECT id
  FROM public.org
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
INSERT INTO public.warehouse (
  tenant_id,
  org_id,
  code,
  name,
  type,
  status,
  country_code,
  timezone,
  is_returns_center,
  allow_inbound,
  allow_outbound,
  allow_cross_dock,
  metadata
)
SELECT
  target_org.id,
  target_org.id,
  seed.code,
  seed.name,
  'ANH_OWNED',
  'ACTIVE',
  'KR',
  'Asia/Seoul',
  false,
  true,
  true,
  false,
  jsonb_build_object('seed_source', 'daily_work_log')
FROM target_org
JOIN (
  VALUES
    ('DWL_WH_CENTER1_A', '제1센터 A동'),
    ('DWL_WH_CENTER1_B', '제1센터 B동'),
    ('DWL_WH_CENTER2_A', '제2센터 A동'),
    ('DWL_WH_CENTER2_B', '제2센터 B동')
) AS seed(code, name) ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.warehouse existing
  WHERE existing.code = seed.code
);

COMMIT;

NOTIFY pgrst, 'reload schema';
