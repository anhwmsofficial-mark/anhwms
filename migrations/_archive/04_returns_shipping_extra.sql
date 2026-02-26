-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 04_returns_shipping_extra.sql - 반품센터 & 배송관리
-- ====================================================================
-- 설명: 반품 오더, 배송사, 배송 계정, 택배 송장 관리
-- 실행 순서: 4번 (03_inbound_outbound_work_task.sql 다음)
-- 의존성: warehouse, brand, store, customer_master, outbounds
-- ====================================================================

-- ====================================================================
-- 7. 반품 오더 (Return Order)
-- ====================================================================

CREATE TABLE IF NOT EXISTS return_order (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id       UUID NOT NULL REFERENCES warehouse(id),
  brand_id           UUID REFERENCES brand(id),
  store_id           UUID REFERENCES store(id),
  
  -- 반품 소스
  source_type        TEXT NOT NULL,          -- OUR_OUTBOUND / EXTERNAL / CUSTOMER_RETURN
  outbound_id        UUID REFERENCES outbounds(id),
  external_order_ref TEXT,
  
  -- 배송 정보
  carrier_code       TEXT,
  tracking_no        TEXT,
  
  -- 상태 및 처리
  status             TEXT NOT NULL,          -- CREATED / RECEIVED / INSPECTED / COMPLETED / DISPOSED
  reason_code        TEXT,                   -- DEFECT / SIZE_MISMATCH / CUSTOMER_CHANGE / DAMAGED / ETC
  disposition        TEXT,                   -- RESTOCK / RESHIP / SCRAP / RETURN_TO_SENDER / EXCHANGE
  
  -- 일정
  received_at        TIMESTAMPTZ,
  inspected_at       TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  
  -- 담당자
  received_by_user_id UUID,
  inspected_by_user_id UUID,
  
  note               TEXT,
  
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_order_line (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_order_id   UUID NOT NULL REFERENCES return_order(id) ON DELETE CASCADE,
  product_id        UUID REFERENCES products(id),
  uom_code          TEXT DEFAULT 'EA',
  
  qty_returned      NUMERIC NOT NULL,
  qty_accepted      NUMERIC NOT NULL DEFAULT 0,
  qty_restocked     NUMERIC NOT NULL DEFAULT 0,
  qty_scrapped      NUMERIC NOT NULL DEFAULT 0,
  qty_reshipped     NUMERIC NOT NULL DEFAULT 0,
  
  condition_code    TEXT,  -- NEW / GOOD / DAMAGED / DESTROYED
  lot_no            TEXT,
  
  line_no           INTEGER,
  note              TEXT,
  
  UNIQUE (return_order_id, line_no)
);

COMMENT ON TABLE return_order IS '반품 오더 (헤더)';
COMMENT ON TABLE return_order_line IS '반품 오더 라인 (상품별)';
COMMENT ON COLUMN return_order.source_type IS 'OUR_OUTBOUND: 우리 출고건 반품, EXTERNAL: 외부 주문 반품, CUSTOMER_RETURN: 직접 고객 반품';
COMMENT ON COLUMN return_order.disposition IS 'RESTOCK: 재입고, RESHIP: 재출고, SCRAP: 폐기, RETURN_TO_SENDER: 발송인 반송, EXCHANGE: 교환';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_return_order_warehouse_id ON return_order(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_return_order_brand_id ON return_order(brand_id);
CREATE INDEX IF NOT EXISTS idx_return_order_store_id ON return_order(store_id);
CREATE INDEX IF NOT EXISTS idx_return_order_outbound_id ON return_order(outbound_id);
CREATE INDEX IF NOT EXISTS idx_return_order_status ON return_order(status);
CREATE INDEX IF NOT EXISTS idx_return_order_tracking_no ON return_order(tracking_no);
CREATE INDEX IF NOT EXISTS idx_return_order_line_product_id ON return_order_line(product_id);

-- ====================================================================
-- 8. 배송사 (Shipping Carrier)
-- ====================================================================

CREATE TABLE IF NOT EXISTS shipping_carrier (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name_ko       TEXT NOT NULL,
  name_en       TEXT,
  country_code  CHAR(2) DEFAULT 'KR',
  
  -- API 정보
  api_type      TEXT,  -- REST / SOAP / SFTP / MANUAL
  api_endpoint  TEXT,
  api_key       TEXT,
  
  -- 운영 설정
  is_domestic   BOOLEAN DEFAULT TRUE,
  is_international BOOLEAN DEFAULT FALSE,
  
  status        TEXT DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE shipping_carrier IS '배송사/택배사 마스터';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shipping_carrier_code ON shipping_carrier(code);
CREATE INDEX IF NOT EXISTS idx_shipping_carrier_status ON shipping_carrier(status);

-- 기본 배송사 데이터
INSERT INTO shipping_carrier (code, name_ko, name_en, country_code, is_domestic, is_international) VALUES
('CJ', 'CJ대한통운', 'CJ Logistics', 'KR', TRUE, FALSE),
('LOTTE', '롯데택배', 'Lotte Global Logistics', 'KR', TRUE, FALSE),
('HANJIN', '한진택배', 'Hanjin Express', 'KR', TRUE, FALSE),
('LOGEN', '로젠택배', 'Logen', 'KR', TRUE, FALSE),
('ANH', 'ANH 직배송', 'ANH Direct', 'KR', TRUE, FALSE),
('EMS', 'EMS 국제우편', 'EMS', 'KR', FALSE, TRUE),
('DHL', 'DHL Express', 'DHL', 'US', FALSE, TRUE),
('FEDEX', 'FedEx', 'FedEx', 'US', FALSE, TRUE),
('SF', '순풍택배', 'SF Express', 'CN', TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- ====================================================================
-- 8-2. 배송 계정 (Shipping Account)
-- ====================================================================

CREATE TABLE IF NOT EXISTS shipping_account (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_master_id UUID NOT NULL REFERENCES customer_master(id),
  carrier_id         UUID NOT NULL REFERENCES shipping_carrier(id),
  
  account_code       TEXT NOT NULL,
  account_name       TEXT,
  
  -- 소유 정보
  is_anh_owned       BOOLEAN DEFAULT TRUE,  -- ANH 소유 계정 vs 고객사 자체 계정
  
  -- API 인증
  api_username       TEXT,
  api_password       TEXT,
  api_token          TEXT,
  
  -- 계약 정보
  contract_rate      NUMERIC,
  rate_currency      TEXT DEFAULT 'KRW',
  
  -- 유효 기간
  status             TEXT DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE / EXPIRED
  valid_from         DATE,
  valid_to           DATE,
  
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (carrier_id, account_code)
);

COMMENT ON TABLE shipping_account IS '배송사 계정 (고객사별 배송사 연동 계정)';
COMMENT ON COLUMN shipping_account.is_anh_owned IS 'TRUE: ANH 소유 계정, FALSE: 고객사 자체 계정';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shipping_account_customer_master_id ON shipping_account(customer_master_id);
CREATE INDEX IF NOT EXISTS idx_shipping_account_carrier_id ON shipping_account(carrier_id);
CREATE INDEX IF NOT EXISTS idx_shipping_account_status ON shipping_account(status);

-- ====================================================================
-- 8-3. 택배 송장 (Parcel Shipment)
-- ====================================================================

CREATE TABLE IF NOT EXISTS parcel_shipment (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipping_account_id UUID NOT NULL REFERENCES shipping_account(id),
  brand_id            UUID REFERENCES brand(id),
  store_id            UUID REFERENCES store(id),
  outbound_id         UUID REFERENCES outbounds(id),
  warehouse_id        UUID REFERENCES warehouse(id),
  
  -- 소스 정보
  source_type         TEXT NOT NULL,   -- WMS / EXTERNAL
  
  -- 송장 정보
  tracking_no         TEXT NOT NULL,
  waybill_no          TEXT,
  invoice_no          TEXT,
  
  -- 배송 정보
  ship_date           DATE NOT NULL,
  dest_country_code   CHAR(2),
  dest_city           TEXT,
  dest_postal_code    TEXT,
  
  -- 물량 정보
  box_count           INTEGER DEFAULT 1,
  weight_kg           NUMERIC,
  volume_m3           NUMERIC,
  
  -- 비용 정보
  fee_total           NUMERIC,
  fee_base            NUMERIC,
  fee_fuel            NUMERIC,
  fee_remote          NUMERIC,
  fee_extra           NUMERIC,
  fee_currency        TEXT DEFAULT 'KRW',
  
  -- ANH 수수료
  anh_commission      NUMERIC,
  anh_commission_rate NUMERIC,
  
  -- 청구 상태
  billing_status      TEXT DEFAULT 'UNBILLED', -- UNBILLED / BILLED / PAID / DISPUTED
  billed_at           TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  
  -- 상태
  status              TEXT DEFAULT 'CREATED',  -- CREATED / PICKED_UP / IN_TRANSIT / DELIVERED / RETURNED / CANCELLED
  delivered_at        TIMESTAMPTZ,
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (tracking_no)
);

COMMENT ON TABLE parcel_shipment IS '택배 송장 (실제 배송 건별 물량 및 비용 관리)';
COMMENT ON COLUMN parcel_shipment.source_type IS 'WMS: WMS에서 생성, EXTERNAL: 외부 시스템에서 생성';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_shipping_account_id ON parcel_shipment(shipping_account_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_brand_id ON parcel_shipment(brand_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_store_id ON parcel_shipment(store_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_outbound_id ON parcel_shipment(outbound_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_warehouse_id ON parcel_shipment(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_tracking_no ON parcel_shipment(tracking_no);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_ship_date ON parcel_shipment(ship_date DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_billing_status ON parcel_shipment(billing_status);
CREATE INDEX IF NOT EXISTS idx_parcel_shipment_status ON parcel_shipment(status);

-- ====================================================================
-- 9. 비용 청구 (Billing)
-- ====================================================================

CREATE TABLE IF NOT EXISTS billing_invoice (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_master_id  UUID NOT NULL REFERENCES customer_master(id),
  brand_id            UUID REFERENCES brand(id),
  
  invoice_no          TEXT NOT NULL UNIQUE,
  invoice_date        DATE NOT NULL,
  due_date            DATE,
  
  -- 기간
  period_from         DATE NOT NULL,
  period_to           DATE NOT NULL,
  
  -- 금액
  subtotal            NUMERIC NOT NULL DEFAULT 0,
  tax_amount          NUMERIC NOT NULL DEFAULT 0,
  total_amount        NUMERIC NOT NULL DEFAULT 0,
  currency            TEXT DEFAULT 'KRW',
  
  -- 상태
  status              TEXT DEFAULT 'DRAFT',  -- DRAFT / ISSUED / PAID / OVERDUE / CANCELLED
  issued_at           TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  
  -- 메모
  note                TEXT,
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_invoice_line (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_invoice_id UUID NOT NULL REFERENCES billing_invoice(id) ON DELETE CASCADE,
  
  item_type         TEXT NOT NULL,  -- STORAGE / HANDLING / SHIPPING / PACKING / EXTRA
  description       TEXT NOT NULL,
  
  quantity          NUMERIC NOT NULL DEFAULT 1,
  unit_price        NUMERIC NOT NULL,
  line_amount       NUMERIC NOT NULL,
  
  -- 참조
  ref_type          TEXT,  -- PARCEL_SHIPMENT / INBOUND_SHIPMENT / OUTBOUND_ORDER
  ref_id            UUID,
  
  line_no           INTEGER,
  
  UNIQUE (billing_invoice_id, line_no)
);

COMMENT ON TABLE billing_invoice IS '청구서 (고객사별 월별/기간별 청구)';
COMMENT ON TABLE billing_invoice_line IS '청구서 라인 (항목별 상세)';
COMMENT ON COLUMN billing_invoice_line.item_type IS 'STORAGE: 보관료, HANDLING: 하역료, SHIPPING: 배송료, PACKING: 포장료, EXTRA: 기타';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_billing_invoice_customer_master_id ON billing_invoice(customer_master_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_brand_id ON billing_invoice(brand_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_invoice_no ON billing_invoice(invoice_no);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_status ON billing_invoice(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_period ON billing_invoice(period_from, period_to);

-- ====================================================================
-- 10. 알림 & 로그
-- ====================================================================

CREATE TABLE IF NOT EXISTS system_alert (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type       TEXT NOT NULL,  -- INVENTORY_LOW / ORDER_DELAYED / SHIPMENT_EXCEPTION / BILLING_OVERDUE
  severity         TEXT NOT NULL,  -- INFO / WARNING / ERROR / CRITICAL
  
  -- 대상
  brand_id         UUID REFERENCES brand(id),
  warehouse_id     UUID REFERENCES warehouse(id),
  
  -- 메시지
  title            TEXT NOT NULL,
  message          TEXT,
  
  -- 참조
  ref_type         TEXT,
  ref_id           UUID,
  
  -- 상태
  status           TEXT DEFAULT 'OPEN',  -- OPEN / ACKNOWLEDGED / RESOLVED / CLOSED
  acknowledged_at  TIMESTAMPTZ,
  acknowledged_by  UUID,
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID,
  
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE system_alert IS '시스템 알림 (재고 부족, 주문 지연, 배송 예외 등)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_system_alert_alert_type ON system_alert(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alert_severity ON system_alert(severity);
CREATE INDEX IF NOT EXISTS idx_system_alert_status ON system_alert(status);
CREATE INDEX IF NOT EXISTS idx_system_alert_brand_id ON system_alert(brand_id);
CREATE INDEX IF NOT EXISTS idx_system_alert_warehouse_id ON system_alert(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_system_alert_created_at ON system_alert(created_at DESC);

-- ====================================================================
-- RLS (Row Level Security) 설정
-- ====================================================================

ALTER TABLE return_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_order_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_carrier ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_shipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoice_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alert ENABLE ROW LEVEL SECURITY;

-- 개발 단계: 모든 사용자에게 읽기/쓰기 권한
DROP POLICY IF EXISTS "Enable read access for all users" ON return_order;
DROP POLICY IF EXISTS "Enable insert for all users" ON return_order;
DROP POLICY IF EXISTS "Enable update for all users" ON return_order;
DROP POLICY IF EXISTS "Enable delete for all users" ON return_order;

CREATE POLICY "Enable read access for all users" ON return_order FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON return_order FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON return_order FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON return_order FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON return_order_line;
DROP POLICY IF EXISTS "Enable insert for all users" ON return_order_line;
DROP POLICY IF EXISTS "Enable update for all users" ON return_order_line;
DROP POLICY IF EXISTS "Enable delete for all users" ON return_order_line;

CREATE POLICY "Enable read access for all users" ON return_order_line FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON return_order_line FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON return_order_line FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON return_order_line FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON shipping_carrier;
DROP POLICY IF EXISTS "Enable insert for all users" ON shipping_carrier;
DROP POLICY IF EXISTS "Enable update for all users" ON shipping_carrier;
DROP POLICY IF EXISTS "Enable delete for all users" ON shipping_carrier;

CREATE POLICY "Enable read access for all users" ON shipping_carrier FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON shipping_carrier FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON shipping_carrier FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON shipping_carrier FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON shipping_account;
DROP POLICY IF EXISTS "Enable insert for all users" ON shipping_account;
DROP POLICY IF EXISTS "Enable update for all users" ON shipping_account;
DROP POLICY IF EXISTS "Enable delete for all users" ON shipping_account;

CREATE POLICY "Enable read access for all users" ON shipping_account FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON shipping_account FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON shipping_account FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON shipping_account FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON parcel_shipment;
DROP POLICY IF EXISTS "Enable insert for all users" ON parcel_shipment;
DROP POLICY IF EXISTS "Enable update for all users" ON parcel_shipment;
DROP POLICY IF EXISTS "Enable delete for all users" ON parcel_shipment;

CREATE POLICY "Enable read access for all users" ON parcel_shipment FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON parcel_shipment FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON parcel_shipment FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON parcel_shipment FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON billing_invoice;
DROP POLICY IF EXISTS "Enable insert for all users" ON billing_invoice;
DROP POLICY IF EXISTS "Enable update for all users" ON billing_invoice;
DROP POLICY IF EXISTS "Enable delete for all users" ON billing_invoice;

CREATE POLICY "Enable read access for all users" ON billing_invoice FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON billing_invoice FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON billing_invoice FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON billing_invoice FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON billing_invoice_line;
DROP POLICY IF EXISTS "Enable insert for all users" ON billing_invoice_line;
DROP POLICY IF EXISTS "Enable update for all users" ON billing_invoice_line;
DROP POLICY IF EXISTS "Enable delete for all users" ON billing_invoice_line;

CREATE POLICY "Enable read access for all users" ON billing_invoice_line FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON billing_invoice_line FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON billing_invoice_line FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON billing_invoice_line FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON system_alert;
DROP POLICY IF EXISTS "Enable insert for all users" ON system_alert;
DROP POLICY IF EXISTS "Enable update for all users" ON system_alert;
DROP POLICY IF EXISTS "Enable delete for all users" ON system_alert;

CREATE POLICY "Enable read access for all users" ON system_alert FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON system_alert FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON system_alert FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON system_alert FOR DELETE USING (true);

-- ====================================================================
-- 샘플 데이터
-- ====================================================================

-- 샘플 배송 계정
INSERT INTO shipping_account (
  customer_master_id, 
  carrier_id, 
  account_code, 
  account_name, 
  is_anh_owned, 
  status
)
SELECT 
  cm.id,
  sc.id,
  'ANH-CJ-001',
  'ANH CJ 기본 계정',
  TRUE,
  'ACTIVE'
FROM customer_master cm, shipping_carrier sc
WHERE cm.code = 'YBK' AND sc.code = 'CJ'
LIMIT 1
ON CONFLICT (carrier_id, account_code) DO NOTHING;

-- 샘플 반품 오더
INSERT INTO return_order (
  warehouse_id, 
  brand_id, 
  source_type, 
  reason_code, 
  disposition, 
  status
)
SELECT 
  w.id,
  b.id,
  'EXTERNAL',
  'SIZE_MISMATCH',
  'RESTOCK',
  'CREATED'
FROM warehouse w, brand b
WHERE w.code = 'RC-KP-001' AND b.code LIKE '%-DEFAULT'
LIMIT 1;

-- 샘플 시스템 알림
INSERT INTO system_alert (
  alert_type,
  severity,
  title,
  message,
  status
) VALUES
('INVENTORY_LOW', 'WARNING', '재고 부족 경고', '일부 상품의 재고가 최소 수량 이하입니다.', 'OPEN'),
('ORDER_DELAYED', 'ERROR', '주문 처리 지연', '3건의 주문이 SLA를 초과했습니다.', 'OPEN');

-- ====================================================================
-- 완료
-- ====================================================================
-- 마이그레이션 04_returns_shipping_extra.sql 완료
-- 모든 마이그레이션 완료!
-- 
-- 실행 순서 요약:
-- 1. 01_core_customer.sql
-- 2. 02_warehouse_product_inventory.sql
-- 3. 03_inbound_outbound_work_task.sql
-- 4. 04_returns_shipping_extra.sql
-- ====================================================================

