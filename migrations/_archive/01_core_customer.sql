-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 01_core_customer.sql - 코어 & 고객 계층
-- ====================================================================
-- 설명: 조직, 고객사, 브랜드, 스토어 테이블 생성
-- 실행 순서: 1번 (가장 먼저 실행)
-- ====================================================================

-- ====================================================================
-- 1-1. 조직 (Organization)
-- ====================================================================

CREATE TABLE IF NOT EXISTS org (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT UNIQUE,
  status      TEXT DEFAULT 'ACTIVE',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE org IS '조직/회사 정보';
COMMENT ON COLUMN org.code IS '조직 코드 (예: ANH, AH)';

-- 기본 조직 데이터 삽입
INSERT INTO org (code, name, status) VALUES
('ANH', 'AN 물류', 'ACTIVE'),
('AH', 'AH 해외배송', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- ====================================================================
-- 1-2. 고객사 마스터 (Customer Master)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customer_master (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID REFERENCES org(id),
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,  -- DIRECT_BRAND / AGENCY / MULTI_BRAND / FORWARDER / LOGISTICS_PARTNER
  country_code     CHAR(2) DEFAULT 'KR',
  business_reg_no  TEXT,           -- 사업자등록번호
  billing_currency TEXT DEFAULT 'KRW',
  billing_cycle    TEXT DEFAULT 'MONTHLY', -- MONTHLY / QUARTERLY / CUSTOM
  payment_terms    INTEGER DEFAULT 30,    -- 결제 조건 (일수)
  
  -- 연락처 정보
  contact_name     TEXT,
  contact_email    TEXT,
  contact_phone    TEXT,
  
  -- 주소 정보
  address_line1    TEXT,
  address_line2    TEXT,
  city             TEXT,
  postal_code      TEXT,
  
  -- 계약 정보
  contract_start   DATE,
  contract_end     DATE,
  
  -- 상태 및 메타
  status           TEXT DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE / SUSPENDED
  note             TEXT,
  metadata         JSONB DEFAULT '{}'::JSONB,
  
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE customer_master IS '고객사 마스터 테이블 (화주사/브랜드사/포워더 등)';
COMMENT ON COLUMN customer_master.type IS 'DIRECT_BRAND: 직접 브랜드사, AGENCY: 대행사, MULTI_BRAND: 멀티브랜드 기업, FORWARDER: 포워더, LOGISTICS_PARTNER: 물류 파트너';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_master_org_id ON customer_master(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_master_code ON customer_master(code);
CREATE INDEX IF NOT EXISTS idx_customer_master_type ON customer_master(type);
CREATE INDEX IF NOT EXISTS idx_customer_master_status ON customer_master(status);

-- 기존 partners 테이블에서 데이터 이관 (있는 경우)
INSERT INTO customer_master (
  code, 
  name, 
  type, 
  contact_name, 
  contact_phone, 
  contact_email, 
  address_line1,
  status,
  created_at
)
SELECT 
  'CM-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0'),
  name,
  CASE 
    WHEN type = 'supplier' THEN 'LOGISTICS_PARTNER'
    WHEN type = 'customer' THEN 'DIRECT_BRAND'
    ELSE 'DIRECT_BRAND'
  END,
  contact,
  phone,
  email,
  address,
  'ACTIVE',
  created_at
FROM partners
WHERE NOT EXISTS (SELECT 1 FROM customer_master WHERE customer_master.name = partners.name)
ON CONFLICT (code) DO NOTHING;

-- ====================================================================
-- 1-3. 브랜드 (Brand)
-- ====================================================================

CREATE TABLE IF NOT EXISTS brand (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_master_id  UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  name_ko             TEXT,
  name_en             TEXT,
  name_zh             TEXT,
  country_code        CHAR(2) DEFAULT 'KR',
  
  -- 브랜드 정보
  is_default_brand    BOOLEAN DEFAULT FALSE,
  logo_url            TEXT,
  website_url         TEXT,
  description         TEXT,
  
  -- 운영 설정
  allow_backorder     BOOLEAN DEFAULT FALSE,
  auto_allocate       BOOLEAN DEFAULT TRUE,
  require_lot_tracking BOOLEAN DEFAULT FALSE,
  
  -- 상태 및 메타
  status              TEXT DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE
  metadata            JSONB DEFAULT '{}'::JSONB,
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (customer_master_id, code)
);

COMMENT ON TABLE brand IS '브랜드 테이블 (고객사가 운영하는 브랜드)';
COMMENT ON COLUMN brand.is_default_brand IS '해당 고객사의 기본 브랜드 여부';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_brand_customer_master_id ON brand(customer_master_id);
CREATE INDEX IF NOT EXISTS idx_brand_code ON brand(code);
CREATE INDEX IF NOT EXISTS idx_brand_status ON brand(status);

-- 기존 고객사별로 기본 브랜드 1개씩 자동 생성
INSERT INTO brand (
  customer_master_id,
  code,
  name_ko,
  name_en,
  is_default_brand,
  status
)
SELECT 
  id,
  code || '-DEFAULT',
  name,
  name,
  TRUE,
  'ACTIVE'
FROM customer_master
WHERE NOT EXISTS (
  SELECT 1 FROM brand 
  WHERE brand.customer_master_id = customer_master.id
)
ON CONFLICT (customer_master_id, code) DO NOTHING;

-- ====================================================================
-- 1-4. 스토어 (Store / Sales Channel)
-- ====================================================================

CREATE TABLE IF NOT EXISTS store (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id            UUID NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  platform            TEXT NOT NULL,  -- NAVER / COUPANG / TAOBAO / DOUYIN / TMALL / SHOPIFY / OFFLINE / ETC
  external_store_id   TEXT,           -- 플랫폼의 스토어 ID
  store_url           TEXT,
  
  -- 지역/타임존
  country_code        CHAR(2) DEFAULT 'KR',
  timezone            TEXT DEFAULT 'Asia/Seoul',
  language            TEXT DEFAULT 'ko',
  
  -- 주문 연동 설정
  api_enabled         BOOLEAN DEFAULT FALSE,
  api_key             TEXT,
  api_endpoint        TEXT,
  sync_interval_min   INTEGER DEFAULT 10,
  last_synced_at      TIMESTAMPTZ,
  
  -- 상태 및 메타
  status              TEXT DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE / SUSPENDED
  metadata            JSONB DEFAULT '{}'::JSONB,
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (brand_id, platform, external_store_id)
);

COMMENT ON TABLE store IS '판매 채널/스토어 테이블 (네이버, 쿠팡, 타오바오 등)';
COMMENT ON COLUMN store.platform IS '판매 플랫폼: NAVER, COUPANG, TAOBAO, DOUYIN, TMALL, SHOPIFY, OFFLINE 등';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_store_brand_id ON store(brand_id);
CREATE INDEX IF NOT EXISTS idx_store_platform ON store(platform);
CREATE INDEX IF NOT EXISTS idx_store_status ON store(status);

-- ====================================================================
-- RLS (Row Level Security) 설정
-- ====================================================================

ALTER TABLE org ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE store ENABLE ROW LEVEL SECURITY;

-- 개발 단계: 모든 사용자에게 읽기/쓰기 권한
-- org
DROP POLICY IF EXISTS "Enable read access for all users" ON org;
DROP POLICY IF EXISTS "Enable insert for all users" ON org;
DROP POLICY IF EXISTS "Enable update for all users" ON org;
DROP POLICY IF EXISTS "Enable delete for all users" ON org;

CREATE POLICY "Enable read access for all users" ON org FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON org FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON org FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON org FOR DELETE USING (true);

-- customer_master
DROP POLICY IF EXISTS "Enable read access for all users" ON customer_master;
DROP POLICY IF EXISTS "Enable insert for all users" ON customer_master;
DROP POLICY IF EXISTS "Enable update for all users" ON customer_master;
DROP POLICY IF EXISTS "Enable delete for all users" ON customer_master;

CREATE POLICY "Enable read access for all users" ON customer_master FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON customer_master FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON customer_master FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON customer_master FOR DELETE USING (true);

-- brand
DROP POLICY IF EXISTS "Enable read access for all users" ON brand;
DROP POLICY IF EXISTS "Enable insert for all users" ON brand;
DROP POLICY IF EXISTS "Enable update for all users" ON brand;
DROP POLICY IF EXISTS "Enable delete for all users" ON brand;

CREATE POLICY "Enable read access for all users" ON brand FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON brand FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON brand FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON brand FOR DELETE USING (true);

-- store
DROP POLICY IF EXISTS "Enable read access for all users" ON store;
DROP POLICY IF EXISTS "Enable insert for all users" ON store;
DROP POLICY IF EXISTS "Enable update for all users" ON store;
DROP POLICY IF EXISTS "Enable delete for all users" ON store;

CREATE POLICY "Enable read access for all users" ON store FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON store FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON store FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON store FOR DELETE USING (true);

-- ====================================================================
-- 샘플 데이터
-- ====================================================================

-- 샘플 고객사
INSERT INTO customer_master (code, name, type, country_code, contact_name, contact_email, contact_phone, status) VALUES
('YBK', 'YBK 브랜드', 'DIRECT_BRAND', 'KR', '김영희', 'ybk@example.com', '02-1234-5678', 'ACTIVE'),
('GLOBAL-SHOP', '글로벌샵', 'MULTI_BRAND', 'KR', '이철수', 'global@example.com', '02-9876-5432', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- 샘플 브랜드
INSERT INTO brand (customer_master_id, code, name_ko, name_en, is_default_brand, status)
SELECT 
  cm.id,
  'YBK-MAIN',
  'YBK 공식',
  'YBK Official',
  TRUE,
  'ACTIVE'
FROM customer_master cm
WHERE cm.code = 'YBK'
ON CONFLICT (customer_master_id, code) DO NOTHING;

-- 샘플 스토어
INSERT INTO store (brand_id, name, platform, external_store_id, country_code, status)
SELECT 
  b.id,
  'YBK 네이버 스토어',
  'NAVER',
  'ybk-naver-001',
  'KR',
  'ACTIVE'
FROM brand b
WHERE b.code = 'YBK-MAIN'
ON CONFLICT (brand_id, platform, external_store_id) DO NOTHING;

-- ====================================================================
-- 완료
-- ====================================================================
-- 마이그레이션 01_core_customer.sql 완료
-- 다음: 02_warehouse_product_inventory.sql 실행
-- ====================================================================

