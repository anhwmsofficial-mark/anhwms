-- Seed/update customer master rows from 업체_서류관리.xlsx.
-- Business registration number is used as the stable upsert key per tenant.
ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS partner_category text,
  ADD COLUMN IF NOT EXISTS corporate_registration_number text,
  ADD COLUMN IF NOT EXISTS ceo_name text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS business_item text,
  ADD COLUMN IF NOT EXISTS tax_invoice_email text,
  ADD COLUMN IF NOT EXISTS settlement_manager_name text,
  ADD COLUMN IF NOT EXISTS settlement_manager_phone text,
  ADD COLUMN IF NOT EXISTS settlement_basis_memo text,
  ADD COLUMN IF NOT EXISTS invoice_available_status text,
  ADD COLUMN IF NOT EXISTS business_license_storage_path text,
  ADD COLUMN IF NOT EXISTS bankbook_storage_path text,
  ADD COLUMN IF NOT EXISTS contract_storage_path text,
  ADD COLUMN IF NOT EXISTS domestic_overseas_type text,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS has_business_license_document boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_bankbook_document boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_contract_document boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contact_status text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS fax_number text,
  ADD COLUMN IF NOT EXISTS website_url text;

ALTER TABLE public.customer_master DROP CONSTRAINT IF EXISTS customer_master_partner_category_check;
ALTER TABLE public.customer_master ADD CONSTRAINT customer_master_partner_category_check
  CHECK (
    partner_category IS NULL
    OR partner_category = ANY (ARRAY['CUSTOMER'::text, 'SUPPLIER'::text, 'CARRIER'::text, 'OTHER'::text])
  );

ALTER TABLE public.customer_master DROP CONSTRAINT IF EXISTS customer_master_invoice_available_status_check;
ALTER TABLE public.customer_master ADD CONSTRAINT customer_master_invoice_available_status_check
  CHECK (
    invoice_available_status IS NULL
    OR invoice_available_status = ANY (ARRAY['AVAILABLE'::text, 'UNAVAILABLE'::text, 'NEEDS_REVIEW'::text])
  );

ALTER TABLE public.customer_master DROP CONSTRAINT IF EXISTS customer_master_domestic_overseas_type_check;
ALTER TABLE public.customer_master ADD CONSTRAINT customer_master_domestic_overseas_type_check
  CHECK (
    domestic_overseas_type IS NULL
    OR domestic_overseas_type = ANY (ARRAY['DOMESTIC'::text, 'OVERSEAS'::text])
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_master_tenant_business_reg_no
  ON public.customer_master (tenant_id, business_reg_no)
  WHERE business_reg_no IS NOT NULL AND length(trim(business_reg_no)) = 10;

WITH target_org AS (
  SELECT id
  FROM public.org
  WHERE status = 'ACTIVE'
  ORDER BY CASE WHEN code = 'ANH' THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1
),
source_rows (
  row_no,
  name,
  business_reg_no,
  ceo_name,
  domestic_overseas_type,
  partner_category,
  service_type,
  has_business_license_document,
  has_bankbook_document,
  has_contract_document,
  contract_start_date,
  contract_end_date,
  contact_status,
  note
) AS (
  VALUES
    (1, '에이치에이디로지스틱스 유한회사', '1338146474', 'LIU YONGMING(류용밍)', 'OVERSEAS', 'CUSTOMER', '외부집하', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (2, '(주) 디사이더랩', '5268702874', '이용훈', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (3, '라이브메드 주식회사', '5518702415', '박지휘', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (4, '주식회사 라임아이앤티 (LIME INT CO., LTD)', '3088802763', '최병현', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (5, '주식회사 리부트라이프', '8998601679', '이승아', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, '2024-09-19'::date, '2027-09-18'::date, '진행 중', NULL),
    (6, '주식회사 몽페쉬', '4628802562', '이채원', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, '2025-11-01'::date, '2027-10-31'::date, '진행 중', NULL),
    (7, '배네타 (VANETA)', '1283941522', '안주현', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (8, '베베무역 유한회사', '1198803880', 'ZENG RUOHAN', 'DOMESTIC', 'CUSTOMER', '외부집하', true, false, false, '2026-03-13'::date, '2027-03-12'::date, '진행 중', NULL),
    (9, '주식회사 뷰티앤케이', '6558700854', '고유리, 최정우', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, '2024-12-28'::date, '2025-12-27'::date, '진행 중', NULL),
    (10, '주식회사 웨이브엑스', '2088802459', '김인호', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, '2025-03-13'::date, '2027-03-12'::date, '진행 중', NULL),
    (11, '주식회사 승뮤즈', '1908602659', '승예진', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, '2025-01-01'::date, '2027-01-02'::date, '진행 중', NULL),
    (12, '주식회사 아더엘(ArtheL)', '5918703407', '김민', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (13, '주식회사 엠에스글로비스 (MS Glovis CO., LTD.)', '2988703702', '여미숙', 'DOMESTIC', 'CARRIER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (14, '주식회사 와이비케이코퍼레이션(YBK Corp.)', '6278602302', '양회찬', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, true, false, NULL::date, NULL::date, '진행 중', NULL),
    (15, '주식회사 와이엠패키지', '4338802564', '박진용', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (16, '위드유 유한회사', '2718103535', 'ZHENG ZHIXING(정즈싱)', 'OVERSEAS', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (17, '율케어시스템', '6622601336', '박현민', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (18, '이투스에듀 주식회사 서초지점', '7228502352', '정선욱', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (19, '일라이크테크놀로지 유한회사', '8458603082', 'ZHU ZHEN(주전)', 'OVERSEAS', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (20, '정화커머스 유한회사', '8318803054', 'SHENG ZHAOJIONG(성자오지옹)', 'OVERSEAS', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (21, '제이원유한회사', '5448603097', 'JIA YUNCHAO', 'OVERSEAS', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (22, '창펭테크놀로지 유한회사', '5938703096', 'ZHENG JUNTENG(정준텅)', 'OVERSEAS', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (23, '주식회사 킵고잉', '2898603512', '김민', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (24, '트렌드 유한회사', '6648103284', 'REN HONG(런홍)', 'OVERSEAS', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (25, '유한회사 티안다오청결가구', '5418103069', 'ZHU XIAOLI(주샤오리)', 'OVERSEAS', 'CUSTOMER', '물류&3PL', true, false, false, NULL::date, NULL::date, '진행 중', NULL),
    (26, '주식회사 프롬디스', '6278703384', '김종록', 'DOMESTIC', 'CUSTOMER', '물류&3PL', true, false, false, '2024-10-15'::date, '2027-10-14'::date, '진행 중', NULL)
),
prepared AS (
  SELECT
    target_org.id AS org_id,
    'XLS' || source_rows.business_reg_no AS code,
    source_rows.name,
    CASE
      WHEN source_rows.partner_category = 'CARRIER' THEN 'PARTNER_CARRIER'
      WHEN source_rows.partner_category = 'SUPPLIER' THEN 'SUPPLIER_MATERIAL'
      WHEN source_rows.partner_category = 'OTHER' THEN 'LOGISTICS_PARTNER'
      ELSE 'DIRECT_BRAND'
    END AS type,
    source_rows.partner_category,
    source_rows.business_reg_no,
    source_rows.ceo_name,
    source_rows.domestic_overseas_type,
    source_rows.service_type,
    source_rows.has_business_license_document,
    source_rows.has_bankbook_document,
    source_rows.has_contract_document,
    source_rows.contract_start_date,
    source_rows.contract_end_date,
    source_rows.contact_status,
    source_rows.note,
    source_rows.row_no
  FROM source_rows
  CROSS JOIN target_org
)
INSERT INTO public.customer_master (
  org_id,
  tenant_id,
  code,
  name,
  type,
  partner_category,
  country_code,
  business_reg_no,
  ceo_name,
  domestic_overseas_type,
  service_type,
  has_business_license_document,
  has_bankbook_document,
  has_contract_document,
  contract_start_date,
  contract_end_date,
  contract_start,
  contract_end,
  contact_status,
  invoice_available_status,
  billing_currency,
  billing_cycle,
  contact_name,
  status,
  note,
  metadata,
  created_at,
  updated_at
)
SELECT
  org_id,
  org_id,
  code,
  name,
  type,
  partner_category,
  'KR',
  business_reg_no,
  ceo_name,
  domestic_overseas_type,
  service_type,
  has_business_license_document,
  has_bankbook_document,
  has_contract_document,
  contract_start_date,
  contract_end_date,
  contract_start_date,
  contract_end_date,
  contact_status,
  'NEEDS_REVIEW',
  'KRW',
  'MONTHLY',
  ceo_name,
  'ACTIVE',
  note,
  jsonb_build_object(
    'source', '업체_서류관리.xlsx',
    'source_row_no', row_no,
    'seeded_at', now()
  ),
  now(),
  now()
FROM prepared
ON CONFLICT (tenant_id, business_reg_no)
WHERE business_reg_no IS NOT NULL AND length(trim(business_reg_no)) = 10
DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  partner_category = EXCLUDED.partner_category,
  ceo_name = EXCLUDED.ceo_name,
  domestic_overseas_type = EXCLUDED.domestic_overseas_type,
  service_type = EXCLUDED.service_type,
  has_business_license_document = EXCLUDED.has_business_license_document,
  has_bankbook_document = EXCLUDED.has_bankbook_document,
  has_contract_document = EXCLUDED.has_contract_document,
  contract_start_date = EXCLUDED.contract_start_date,
  contract_end_date = EXCLUDED.contract_end_date,
  contract_start = EXCLUDED.contract_start,
  contract_end = EXCLUDED.contract_end,
  contact_status = EXCLUDED.contact_status,
  contact_name = EXCLUDED.contact_name,
  status = 'ACTIVE',
  note = COALESCE(EXCLUDED.note, customer_master.note),
  metadata = COALESCE(customer_master.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();
