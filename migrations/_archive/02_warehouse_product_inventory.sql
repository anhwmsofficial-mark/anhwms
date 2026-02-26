-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 02_warehouse_product_inventory.sql - 창고/상품/재고 계층
-- ====================================================================
-- 설명: 창고, 로케이션, 브랜드-창고 관계, 상품, UOM, BOM, 재고 테이블 생성/확장
-- 실행 순서: 2번 (01_core_customer.sql 다음)
-- 의존성: org, customer_master, brand
-- ====================================================================

-- ====================================================================
-- 2-1. 창고 (Warehouse) - 확장
-- ====================================================================

CREATE TABLE IF NOT EXISTS warehouse (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id               UUID REFERENCES org(id),
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL,     -- ANH_OWNED / CLIENT_OWNED / PARTNER_OVERSEAS / RETURNS_CENTER
  country_code         CHAR(2) DEFAULT 'KR',
  timezone             TEXT DEFAULT 'Asia/Seoul',
  
  -- 운영자/소유자
  operator_customer_id UUID REFERENCES customer_master(id),  -- 운영 주체
  owner_customer_id    UUID REFERENCES customer_master(id),  -- 소유 주체
  
  -- 주소 정보
  address_line1        TEXT,
  address_line2        TEXT,
  city                 TEXT,
  state                TEXT,
  postal_code          TEXT,
  latitude             NUMERIC(10, 7),
  longitude            NUMERIC(10, 7),
  
  -- 운영 설정
  is_returns_center    BOOLEAN DEFAULT FALSE,
  allow_inbound        BOOLEAN DEFAULT TRUE,
  allow_outbound       BOOLEAN DEFAULT TRUE,
  allow_cross_dock     BOOLEAN DEFAULT FALSE,
  
  -- 운영 시간
  operating_hours      JSONB,  -- {"mon": "09:00-18:00", ...}
  cutoff_time          TIME,   -- 당일 출고 마감 시간
  
  -- 상태 및 메타
  status               TEXT DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE / MAINTENANCE
  metadata             JSONB DEFAULT '{}'::JSONB,
  
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE warehouse IS '창고/물류센터 테이블';
COMMENT ON COLUMN warehouse.type IS 'ANH_OWNED: ANH 자체 창고, CLIENT_OWNED: 고객사 창고, PARTNER_OVERSEAS: 해외 파트너 창고, RETURNS_CENTER: 반품센터';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_warehouse_org_id ON warehouse(org_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_code ON warehouse(code);
CREATE INDEX IF NOT EXISTS idx_warehouse_type ON warehouse(type);
CREATE INDEX IF NOT EXISTS idx_warehouse_status ON warehouse(status);

-- 기본 창고 데이터
INSERT INTO warehouse (code, name, type, country_code, city, status) VALUES
('WH-KP-001', 'ANH 김포 물류센터', 'ANH_OWNED', 'KR', '김포', 'ACTIVE'),
('WH-IC-001', 'ANH 인천 물류센터', 'ANH_OWNED', 'KR', '인천', 'ACTIVE'),
('WH-SH-001', 'AH 상해 물류센터', 'PARTNER_OVERSEAS', 'CN', '上海', 'ACTIVE'),
('RC-KP-001', 'ANH 김포 반품센터', 'ANH_OWNED', 'KR', '김포', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- 반품센터 플래그 업데이트
UPDATE warehouse SET is_returns_center = TRUE WHERE code = 'RC-KP-001';

-- ====================================================================
-- 2-2. 로케이션 (Location)
-- ====================================================================

CREATE TABLE IF NOT EXISTS location (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id  UUID NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  type          TEXT NOT NULL, -- STORAGE / PICK_FACE / RECEIVING / SHIPPING / STAGING / INSPECTION / RETURNS / QUARANTINE
  zone          TEXT,          -- 존/구역 (예: A, B, C)
  aisle         TEXT,          -- 통로
  rack          TEXT,          -- 랙
  shelf         TEXT,          -- 선반
  bin           TEXT,          -- 빈
  
  -- 용량 관리
  max_capacity  NUMERIC,       -- 최대 용량 (CBM 또는 팔레트 수)
  capacity_unit TEXT,          -- CBM / PALLET / EA
  
  -- 특성
  is_pickable   BOOLEAN DEFAULT TRUE,
  is_bulk       BOOLEAN DEFAULT FALSE,
  temperature_zone TEXT,       -- AMBIENT / CHILLED / FROZEN
  
  -- 상태
  status        TEXT DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE / LOCKED / FULL
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (warehouse_id, code)
);

COMMENT ON TABLE location IS '창고 내 로케이션 (적재 위치)';
COMMENT ON COLUMN location.type IS 'STORAGE: 보관, PICK_FACE: 피킹 위치, RECEIVING: 입고장, SHIPPING: 출고장, STAGING: 스테이징, INSPECTION: 검수, RETURNS: 반품, QUARANTINE: 격리';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_location_warehouse_id ON location(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_location_type ON location(type);
CREATE INDEX IF NOT EXISTS idx_location_zone ON location(zone);
CREATE INDEX IF NOT EXISTS idx_location_status ON location(status);

-- 샘플 로케이션 (김포 물류센터)
INSERT INTO location (warehouse_id, code, type, zone, aisle, rack, shelf, status)
SELECT 
  w.id,
  'A-01-01',
  'STORAGE',
  'A',
  '01',
  '01',
  NULL,
  'ACTIVE'
FROM warehouse w
WHERE w.code = 'WH-KP-001'
ON CONFLICT (warehouse_id, code) DO NOTHING;

-- ====================================================================
-- 2-3. 브랜드-창고 관계 (Brand Warehouse)
-- ====================================================================

CREATE TABLE IF NOT EXISTS brand_warehouse (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id         UUID NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  warehouse_id     UUID NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  
  -- 우선순위 설정
  is_primary       BOOLEAN DEFAULT FALSE,
  fulfill_priority INTEGER DEFAULT 10,  -- 숫자가 낮을수록 우선순위 높음
  
  -- 허용 작업
  allow_inbound    BOOLEAN DEFAULT TRUE,
  allow_outbound   BOOLEAN DEFAULT TRUE,
  allow_stock_hold BOOLEAN DEFAULT FALSE,  -- 재고 보유만 (입출고 불가)
  
  -- 계약/비용
  storage_rate     NUMERIC,  -- 보관료
  handling_rate    NUMERIC,  -- 하역료
  rate_currency    TEXT DEFAULT 'KRW',
  
  -- 상태
  status           TEXT DEFAULT 'ACTIVE',
  
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (brand_id, warehouse_id)
);

COMMENT ON TABLE brand_warehouse IS '브랜드-창고 관계 (어느 브랜드가 어느 창고를 사용하는지)';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_brand_warehouse_brand_id ON brand_warehouse(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_warehouse_warehouse_id ON brand_warehouse(warehouse_id);

-- ====================================================================
-- 2-4. 재고 이동 (Stock Transfer)
-- ====================================================================

CREATE TABLE IF NOT EXISTS stock_transfer (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_warehouse_id  UUID NOT NULL REFERENCES warehouse(id),
  to_warehouse_id    UUID NOT NULL REFERENCES warehouse(id),
  ref_no             TEXT UNIQUE,
  
  -- 상태
  status             TEXT NOT NULL,   -- DRAFT / REQUESTED / APPROVED / IN_TRANSIT / COMPLETED / CANCELLED
  
  -- 일정
  requested_at       TIMESTAMPTZ DEFAULT now(),
  approved_at        TIMESTAMPTZ,
  shipped_at         TIMESTAMPTZ,
  received_at        TIMESTAMPTZ,
  
  -- 담당자
  created_by_user_id UUID,
  approved_by_user_id UUID,
  
  note               TEXT,
  
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_transfer_line (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_transfer_id  UUID NOT NULL REFERENCES stock_transfer(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL,  -- product 테이블 참조 (나중에 FK 추가)
  uom_code           TEXT NOT NULL,
  qty_planned        NUMERIC NOT NULL,
  qty_shipped        NUMERIC NOT NULL DEFAULT 0,
  qty_received       NUMERIC NOT NULL DEFAULT 0,
  line_no            INTEGER,
  
  UNIQUE (stock_transfer_id, line_no)
);

COMMENT ON TABLE stock_transfer IS '창고 간 재고 이동 오더';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_stock_transfer_from_warehouse ON stock_transfer(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_to_warehouse ON stock_transfer(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_status ON stock_transfer(status);

-- ====================================================================
-- 3. 상품 (Product) - 확장
-- ====================================================================

-- 기존 products 테이블에 컬럼 추가
DO $$
BEGIN
  -- brand_id 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='brand_id') THEN
    ALTER TABLE products ADD COLUMN brand_id UUID REFERENCES brand(id);
  END IF;
  
  -- barcode 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='barcode') THEN
    ALTER TABLE products ADD COLUMN barcode TEXT;
  END IF;
  
  -- hs_code 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='hs_code') THEN
    ALTER TABLE products ADD COLUMN hs_code TEXT;
  END IF;
  
  -- weight 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='weight_kg') THEN
    ALTER TABLE products ADD COLUMN weight_kg NUMERIC;
  END IF;
  
  -- dimensions 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='length_cm') THEN
    ALTER TABLE products ADD COLUMN length_cm NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='width_cm') THEN
    ALTER TABLE products ADD COLUMN width_cm NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='height_cm') THEN
    ALTER TABLE products ADD COLUMN height_cm NUMERIC;
  END IF;
  
  -- product_type 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='product_type') THEN
    ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'NORMAL';  -- NORMAL / KIT / COMPONENT / VIRTUAL
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

COMMENT ON COLUMN products.product_type IS 'NORMAL: 일반 상품, KIT: 번들/키팅 상품, COMPONENT: 구성품, VIRTUAL: 가상 상품';

-- ====================================================================
-- 3-2. 상품 UOM (Product Unit of Measure)
-- ====================================================================

CREATE TABLE IF NOT EXISTS product_uom (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  uom_code         TEXT NOT NULL,      -- EA / 2B / 2S / BOX / CASE / PALLET ...
  uom_name         TEXT,               -- 단위명 (예: "낱개", "박스", "파레트")
  qty_in_base_uom  NUMERIC NOT NULL,   -- 기본 단위로 환산 시 수량
  barcode          TEXT,
  
  -- 치수/무게 (UOM별로 다를 수 있음)
  weight_kg        NUMERIC,
  length_cm        NUMERIC,
  width_cm         NUMERIC,
  height_cm        NUMERIC,
  
  is_base_uom      BOOLEAN DEFAULT FALSE,  -- 기본 단위 여부
  is_orderable     BOOLEAN DEFAULT TRUE,   -- 주문 가능 여부
  is_sellable      BOOLEAN DEFAULT TRUE,   -- 판매 가능 여부
  
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (product_id, uom_code)
);

COMMENT ON TABLE product_uom IS '상품 단위 관리 (EA, BOX, CASE 등)';
COMMENT ON COLUMN product_uom.qty_in_base_uom IS '기본 단위(EA)로 환산 시 수량. 예: 1 BOX = 10 EA';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_product_uom_product_id ON product_uom(product_id);

-- 기존 products의 모든 상품에 대해 기본 UOM (EA) 자동 생성
INSERT INTO product_uom (product_id, uom_code, uom_name, qty_in_base_uom, is_base_uom)
SELECT 
  id,
  'EA',
  '개',
  1,
  TRUE
FROM products
WHERE NOT EXISTS (
  SELECT 1 FROM product_uom 
  WHERE product_uom.product_id = products.id AND product_uom.uom_code = 'EA'
)
ON CONFLICT (product_id, uom_code) DO NOTHING;

-- ====================================================================
-- 3-3. 상품 BOM (Bill of Materials) - 번들/키팅
-- ====================================================================

CREATE TABLE IF NOT EXISTS product_bom (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_qty_in_base_uom NUMERIC NOT NULL,  -- 구성품 수량 (기본 단위 기준)
  
  seq_no                    INTEGER,  -- 조립 순서
  is_optional               BOOLEAN DEFAULT FALSE,
  
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (kit_product_id, component_product_id)
);

COMMENT ON TABLE product_bom IS '상품 BOM (번들/키팅 구성 정보)';
COMMENT ON COLUMN product_bom.kit_product_id IS '번들/키트 상품 ID';
COMMENT ON COLUMN product_bom.component_product_id IS '구성품 상품 ID';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_product_bom_kit_product_id ON product_bom(kit_product_id);
CREATE INDEX IF NOT EXISTS idx_product_bom_component_product_id ON product_bom(component_product_id);

-- ====================================================================
-- 4. 재고 (Inventory) - 확장
-- ====================================================================

-- inventory 테이블 생성 (기존 테이블 삭제 후 재생성)
DROP TABLE IF EXISTS inventory CASCADE;

CREATE TABLE inventory (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id    UUID NOT NULL REFERENCES warehouse(id),
  location_id     UUID REFERENCES location(id),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  owner_brand_id  UUID NOT NULL REFERENCES brand(id),
  uom_code        TEXT NOT NULL DEFAULT 'EA',
  
  -- 수량 관리
  qty_on_hand     NUMERIC NOT NULL DEFAULT 0,
  qty_allocated   NUMERIC NOT NULL DEFAULT 0,
  qty_available   NUMERIC GENERATED ALWAYS AS (qty_on_hand - qty_allocated) STORED,
  
  -- 로트/유효기한
  lot_no          TEXT,
  expiry_date     DATE,
  manufactured_date DATE,
  
  -- 상태
  status          TEXT DEFAULT 'AVAILABLE',  -- AVAILABLE / HOLD / DAMAGED / QUARANTINE
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (warehouse_id, location_id, product_id, owner_brand_id, uom_code, lot_no)
);

COMMENT ON TABLE inventory IS '재고 관리 테이블';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_id ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_owner_brand_id ON inventory(owner_brand_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- ====================================================================
-- RLS (Row Level Security) 설정
-- ====================================================================

ALTER TABLE warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE location ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_uom ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_bom ENABLE ROW LEVEL SECURITY;

-- 개발 단계: 모든 사용자에게 읽기/쓰기 권한
-- warehouse
DROP POLICY IF EXISTS "Enable read access for all users" ON warehouse;
DROP POLICY IF EXISTS "Enable insert for all users" ON warehouse;
DROP POLICY IF EXISTS "Enable update for all users" ON warehouse;
DROP POLICY IF EXISTS "Enable delete for all users" ON warehouse;

CREATE POLICY "Enable read access for all users" ON warehouse FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON warehouse FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON warehouse FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON warehouse FOR DELETE USING (true);

-- location
DROP POLICY IF EXISTS "Enable read access for all users" ON location;
DROP POLICY IF EXISTS "Enable insert for all users" ON location;
DROP POLICY IF EXISTS "Enable update for all users" ON location;
DROP POLICY IF EXISTS "Enable delete for all users" ON location;

CREATE POLICY "Enable read access for all users" ON location FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON location FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON location FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON location FOR DELETE USING (true);

-- brand_warehouse
DROP POLICY IF EXISTS "Enable read access for all users" ON brand_warehouse;
DROP POLICY IF EXISTS "Enable insert for all users" ON brand_warehouse;
DROP POLICY IF EXISTS "Enable update for all users" ON brand_warehouse;
DROP POLICY IF EXISTS "Enable delete for all users" ON brand_warehouse;

CREATE POLICY "Enable read access for all users" ON brand_warehouse FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON brand_warehouse FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON brand_warehouse FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON brand_warehouse FOR DELETE USING (true);

-- stock_transfer
DROP POLICY IF EXISTS "Enable read access for all users" ON stock_transfer;
DROP POLICY IF EXISTS "Enable insert for all users" ON stock_transfer;
DROP POLICY IF EXISTS "Enable update for all users" ON stock_transfer;
DROP POLICY IF EXISTS "Enable delete for all users" ON stock_transfer;

CREATE POLICY "Enable read access for all users" ON stock_transfer FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON stock_transfer FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON stock_transfer FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON stock_transfer FOR DELETE USING (true);

-- stock_transfer_line
DROP POLICY IF EXISTS "Enable read access for all users" ON stock_transfer_line;
DROP POLICY IF EXISTS "Enable insert for all users" ON stock_transfer_line;
DROP POLICY IF EXISTS "Enable update for all users" ON stock_transfer_line;
DROP POLICY IF EXISTS "Enable delete for all users" ON stock_transfer_line;

CREATE POLICY "Enable read access for all users" ON stock_transfer_line FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON stock_transfer_line FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON stock_transfer_line FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON stock_transfer_line FOR DELETE USING (true);

-- product_uom
DROP POLICY IF EXISTS "Enable read access for all users" ON product_uom;
DROP POLICY IF EXISTS "Enable insert for all users" ON product_uom;
DROP POLICY IF EXISTS "Enable update for all users" ON product_uom;
DROP POLICY IF EXISTS "Enable delete for all users" ON product_uom;

CREATE POLICY "Enable read access for all users" ON product_uom FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON product_uom FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON product_uom FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON product_uom FOR DELETE USING (true);

-- product_bom
DROP POLICY IF EXISTS "Enable read access for all users" ON product_bom;
DROP POLICY IF EXISTS "Enable insert for all users" ON product_bom;
DROP POLICY IF EXISTS "Enable update for all users" ON product_bom;
DROP POLICY IF EXISTS "Enable delete for all users" ON product_bom;

CREATE POLICY "Enable read access for all users" ON product_bom FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON product_bom FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON product_bom FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON product_bom FOR DELETE USING (true);

-- inventory
DROP POLICY IF EXISTS "Enable read access for all users" ON inventory;
DROP POLICY IF EXISTS "Enable insert for all users" ON inventory;
DROP POLICY IF EXISTS "Enable update for all users" ON inventory;
DROP POLICY IF EXISTS "Enable delete for all users" ON inventory;

CREATE POLICY "Enable read access for all users" ON inventory FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON inventory FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON inventory FOR DELETE USING (true);

-- ====================================================================
-- 완료
-- ====================================================================
-- 마이그레이션 02_warehouse_product_inventory.sql 완료
-- 다음: 03_inbound_outbound_work_task.sql 실행
-- ====================================================================

