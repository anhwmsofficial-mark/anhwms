-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 03_inbound_outbound_work_task.sql - 입출고 & 작업관리
-- ====================================================================
-- 설명: 입출고, Pack Job, Work Task 테이블 생성/확장
-- 실행 순서: 3번 (02_warehouse_product_inventory.sql 다음)
-- 의존성: warehouse, brand, store, products
-- ====================================================================

-- ====================================================================
-- 4-1. 입고 (Inbound Shipment)
-- ====================================================================

CREATE TABLE IF NOT EXISTS inbound_shipment (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id          UUID NOT NULL REFERENCES warehouse(id),
  owner_brand_id        UUID NOT NULL REFERENCES brand(id),
  supplier_customer_id  UUID REFERENCES customer_master(id),
  
  ref_no                TEXT UNIQUE,
  type                  TEXT NOT NULL, -- PURCHASE / RETURN / TRANSFER / B2B
  
  -- 상태
  status                TEXT NOT NULL, -- DRAFT / RECEIVING / COMPLETED / CANCELLED
  
  -- 일정
  eta                   TIMESTAMPTZ,   -- 도착 예정 일시
  received_at           TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  
  -- 담당자
  created_by_user_id    UUID,
  received_by_user_id   UUID,
  
  note                  TEXT,
  
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbound_shipment_line (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inbound_shipment_id UUID NOT NULL REFERENCES inbound_shipment(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  uom_code            TEXT NOT NULL DEFAULT 'EA',
  
  qty_expected        NUMERIC NOT NULL,
  qty_received        NUMERIC NOT NULL DEFAULT 0,
  qty_damaged         NUMERIC NOT NULL DEFAULT 0,
  
  lot_no              TEXT,
  expiry_date         DATE,
  
  line_no             INTEGER,
  note                TEXT,
  
  UNIQUE (inbound_shipment_id, line_no)
);

COMMENT ON TABLE inbound_shipment IS '입고 오더 (헤더)';
COMMENT ON TABLE inbound_shipment_line IS '입고 오더 라인 (상품별)';
COMMENT ON COLUMN inbound_shipment.type IS 'PURCHASE: 매입, RETURN: 반품입고, TRANSFER: 창고이동, B2B: B2B 입고';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_inbound_shipment_warehouse_id ON inbound_shipment(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inbound_shipment_owner_brand_id ON inbound_shipment(owner_brand_id);
CREATE INDEX IF NOT EXISTS idx_inbound_shipment_status ON inbound_shipment(status);
CREATE INDEX IF NOT EXISTS idx_inbound_shipment_eta ON inbound_shipment(eta);
CREATE INDEX IF NOT EXISTS idx_inbound_shipment_line_product_id ON inbound_shipment_line(product_id);

-- ====================================================================
-- 4-2. 출고 (Outbound Order) - 확장
-- ====================================================================

-- 기존 outbound 테이블 확장
DO $$
BEGIN
  -- warehouse_id 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='warehouse_id') THEN
    ALTER TABLE outbounds ADD COLUMN warehouse_id UUID REFERENCES warehouse(id);
  END IF;
  
  -- brand_id 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='brand_id') THEN
    ALTER TABLE outbounds ADD COLUMN brand_id UUID REFERENCES brand(id);
  END IF;
  
  -- store_id 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='store_id') THEN
    ALTER TABLE outbounds ADD COLUMN store_id UUID REFERENCES store(id);
  END IF;
  
  -- order_type 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='order_type') THEN
    ALTER TABLE outbounds ADD COLUMN order_type TEXT DEFAULT 'B2C';  -- B2C / B2B / TRANSFER / RETURN
  END IF;
  
  -- client_order_no 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='client_order_no') THEN
    ALTER TABLE outbounds ADD COLUMN client_order_no TEXT;
  END IF;
  
  -- channel_order_no 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='channel_order_no') THEN
    ALTER TABLE outbounds ADD COLUMN channel_order_no TEXT;
  END IF;
  
  -- requested_ship_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='requested_ship_at') THEN
    ALTER TABLE outbounds ADD COLUMN requested_ship_at TIMESTAMPTZ;
  END IF;
  
  -- shipped_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='shipped_at') THEN
    ALTER TABLE outbounds ADD COLUMN shipped_at TIMESTAMPTZ;
  END IF;
  
  -- tracking_no 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='tracking_no') THEN
    ALTER TABLE outbounds ADD COLUMN tracking_no TEXT;
  END IF;
  
  -- carrier_code 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='outbounds' AND column_name='carrier_code') THEN
    ALTER TABLE outbounds ADD COLUMN carrier_code TEXT;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_outbounds_warehouse_id ON outbounds(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_outbounds_brand_id ON outbounds(brand_id);
CREATE INDEX IF NOT EXISTS idx_outbounds_store_id ON outbounds(store_id);
CREATE INDEX IF NOT EXISTS idx_outbounds_order_type ON outbounds(order_type);
CREATE INDEX IF NOT EXISTS idx_outbounds_client_order_no ON outbounds(client_order_no);
CREATE INDEX IF NOT EXISTS idx_outbounds_channel_order_no ON outbounds(channel_order_no);
CREATE INDEX IF NOT EXISTS idx_outbounds_tracking_no ON outbounds(tracking_no);

COMMENT ON COLUMN outbounds.order_type IS 'B2C: 소비자 직배송, B2B: 기업간 거래, TRANSFER: 창고이동, RETURN: 반품출고';

-- 출고 라인 테이블 (상세)
CREATE TABLE IF NOT EXISTS outbound_order_line (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outbound_id       UUID NOT NULL REFERENCES outbounds(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  uom_code          TEXT NOT NULL DEFAULT 'EA',
  
  qty_ordered       NUMERIC NOT NULL,
  qty_allocated     NUMERIC NOT NULL DEFAULT 0,
  qty_picked        NUMERIC NOT NULL DEFAULT 0,
  qty_packed        NUMERIC NOT NULL DEFAULT 0,
  qty_shipped       NUMERIC NOT NULL DEFAULT 0,
  
  lot_no            TEXT,
  
  line_no           INTEGER,
  note              TEXT,
  
  UNIQUE (outbound_id, line_no)
);

COMMENT ON TABLE outbound_order_line IS '출고 오더 라인 (상품별)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_outbound_order_line_product_id ON outbound_order_line(product_id);

-- ====================================================================
-- 5. 작업 관리 (Work Task) - 확장
-- ====================================================================

-- 기존 work_orders 테이블 확장
DO $$
BEGIN
  -- warehouse_id 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='work_orders' AND column_name='warehouse_id') THEN
    ALTER TABLE work_orders ADD COLUMN warehouse_id UUID REFERENCES warehouse(id);
  END IF;
  
  -- task_type 추가 (기존 type과 병행)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='work_orders' AND column_name='task_type') THEN
    ALTER TABLE work_orders ADD COLUMN task_type TEXT;
  END IF;
  
  -- process_stage 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='work_orders' AND column_name='process_stage') THEN
    ALTER TABLE work_orders ADD COLUMN process_stage TEXT;
  END IF;
  
  -- outbound_id 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='work_orders' AND column_name='outbound_id') THEN
    ALTER TABLE work_orders ADD COLUMN outbound_id UUID REFERENCES outbounds(id);
  END IF;
  
  -- inbound_shipment_id 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='work_orders' AND column_name='inbound_shipment_id') THEN
    ALTER TABLE work_orders ADD COLUMN inbound_shipment_id UUID REFERENCES inbound_shipment(id);
  END IF;
  
  -- sla_due_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='work_orders' AND column_name='sla_due_at') THEN
    ALTER TABLE work_orders ADD COLUMN sla_due_at TIMESTAMPTZ;
  END IF;
  
  -- priority 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='work_orders' AND column_name='priority') THEN
    ALTER TABLE work_orders ADD COLUMN priority INTEGER DEFAULT 3;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_work_orders_warehouse_id ON work_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_task_type ON work_orders(task_type);
CREATE INDEX IF NOT EXISTS idx_work_orders_process_stage ON work_orders(process_stage);
CREATE INDEX IF NOT EXISTS idx_work_orders_outbound_id ON work_orders(outbound_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_inbound_shipment_id ON work_orders(inbound_shipment_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);

COMMENT ON COLUMN work_orders.task_type IS 'PICK / PACK / PUTAWAY / COUNT / RETURN / PACK_JOB / INSPECTION';
COMMENT ON COLUMN work_orders.process_stage IS 'OUTBOUND_PICK / OUTBOUND_PACK / OUTBOUND_SHIP / INBOUND_RECEIVING / INBOUND_PUTAWAY';

-- 작업 액션 (단계별 체크리스트)
CREATE TABLE IF NOT EXISTS work_task_action (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id  UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  action_code    TEXT NOT NULL,
  label          TEXT NOT NULL,
  seq_no         INTEGER NOT NULL,
  
  status         TEXT NOT NULL DEFAULT 'PENDING', -- PENDING / DONE / SKIPPED
  completed_at   TIMESTAMPTZ,
  completed_by   UUID,
  
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE work_task_action IS '작업 액션 (단계별 체크리스트)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_work_task_action_work_order_id ON work_task_action(work_order_id);

-- ====================================================================
-- 6. 번들/키팅 작업 (Pack Job)
-- ====================================================================

CREATE TABLE IF NOT EXISTS pack_job (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id        UUID NOT NULL REFERENCES warehouse(id),
  kit_product_id      UUID NOT NULL REFERENCES products(id),
  owner_brand_id      UUID NOT NULL REFERENCES brand(id),
  
  from_location_id    UUID REFERENCES location(id),
  to_location_id      UUID REFERENCES location(id),
  
  qty_kit_planned     NUMERIC NOT NULL,
  qty_kit_completed   NUMERIC NOT NULL DEFAULT 0,
  
  status              TEXT NOT NULL, -- DRAFT / IN_PROGRESS / COMPLETED / CANCELLED
  
  created_by_user_id  UUID,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  
  note                TEXT,
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pack_job_component (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_job_id          UUID NOT NULL REFERENCES pack_job(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id),
  uom_code             TEXT NOT NULL DEFAULT 'EA',
  
  qty_required         NUMERIC NOT NULL,
  qty_consumed         NUMERIC NOT NULL DEFAULT 0,
  
  line_no              INTEGER,
  
  UNIQUE (pack_job_id, component_product_id)
);

COMMENT ON TABLE pack_job IS '번들/키팅 작업 오더';
COMMENT ON TABLE pack_job_component IS '번들/키팅 구성품 소비 내역';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pack_job_warehouse_id ON pack_job(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pack_job_kit_product_id ON pack_job(kit_product_id);
CREATE INDEX IF NOT EXISTS idx_pack_job_owner_brand_id ON pack_job(owner_brand_id);
CREATE INDEX IF NOT EXISTS idx_pack_job_status ON pack_job(status);

-- ====================================================================
-- 재고 트랜잭션 로그 (Inventory Transaction)
-- ====================================================================

CREATE TABLE IF NOT EXISTS inventory_transaction (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id        UUID NOT NULL REFERENCES warehouse(id),
  location_id         UUID REFERENCES location(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  owner_brand_id      UUID REFERENCES brand(id),
  uom_code            TEXT NOT NULL DEFAULT 'EA',
  
  transaction_type    TEXT NOT NULL, -- IN / OUT / MOVE / ADJUST / HOLD / RELEASE
  qty                 NUMERIC NOT NULL,
  
  -- 참조 정보
  ref_type            TEXT,  -- INBOUND / OUTBOUND / PACK_JOB / STOCK_TRANSFER / ADJUSTMENT
  ref_id              UUID,
  
  lot_no              TEXT,
  
  from_location_id    UUID REFERENCES location(id),
  to_location_id      UUID REFERENCES location(id),
  
  performed_by_user_id UUID,
  performed_at        TIMESTAMPTZ DEFAULT now(),
  
  note                TEXT,
  
  created_at          TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE inventory_transaction IS '재고 트랜잭션 로그 (모든 재고 변동 기록)';
COMMENT ON COLUMN inventory_transaction.transaction_type IS 'IN: 입고, OUT: 출고, MOVE: 이동, ADJUST: 조정, HOLD: 보류, RELEASE: 해제';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_warehouse_id ON inventory_transaction(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_product_id ON inventory_transaction(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_type ON inventory_transaction(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_ref ON inventory_transaction(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_performed_at ON inventory_transaction(performed_at DESC);

-- ====================================================================
-- RLS (Row Level Security) 설정
-- ====================================================================

ALTER TABLE inbound_shipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_shipment_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_job_component ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transaction ENABLE ROW LEVEL SECURITY;

-- 개발 단계: 모든 사용자에게 읽기/쓰기 권한
DROP POLICY IF EXISTS "Enable read access for all users" ON inbound_shipment;
DROP POLICY IF EXISTS "Enable insert for all users" ON inbound_shipment;
DROP POLICY IF EXISTS "Enable update for all users" ON inbound_shipment;
DROP POLICY IF EXISTS "Enable delete for all users" ON inbound_shipment;

CREATE POLICY "Enable read access for all users" ON inbound_shipment FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON inbound_shipment FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON inbound_shipment FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON inbound_shipment FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON inbound_shipment_line;
DROP POLICY IF EXISTS "Enable insert for all users" ON inbound_shipment_line;
DROP POLICY IF EXISTS "Enable update for all users" ON inbound_shipment_line;
DROP POLICY IF EXISTS "Enable delete for all users" ON inbound_shipment_line;

CREATE POLICY "Enable read access for all users" ON inbound_shipment_line FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON inbound_shipment_line FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON inbound_shipment_line FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON inbound_shipment_line FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON outbound_order_line;
DROP POLICY IF EXISTS "Enable insert for all users" ON outbound_order_line;
DROP POLICY IF EXISTS "Enable update for all users" ON outbound_order_line;
DROP POLICY IF EXISTS "Enable delete for all users" ON outbound_order_line;

CREATE POLICY "Enable read access for all users" ON outbound_order_line FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON outbound_order_line FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON outbound_order_line FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON outbound_order_line FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON work_task_action;
DROP POLICY IF EXISTS "Enable insert for all users" ON work_task_action;
DROP POLICY IF EXISTS "Enable update for all users" ON work_task_action;
DROP POLICY IF EXISTS "Enable delete for all users" ON work_task_action;

CREATE POLICY "Enable read access for all users" ON work_task_action FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON work_task_action FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON work_task_action FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON work_task_action FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON pack_job;
DROP POLICY IF EXISTS "Enable insert for all users" ON pack_job;
DROP POLICY IF EXISTS "Enable update for all users" ON pack_job;
DROP POLICY IF EXISTS "Enable delete for all users" ON pack_job;

CREATE POLICY "Enable read access for all users" ON pack_job FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON pack_job FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON pack_job FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON pack_job FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON pack_job_component;
DROP POLICY IF EXISTS "Enable insert for all users" ON pack_job_component;
DROP POLICY IF EXISTS "Enable update for all users" ON pack_job_component;
DROP POLICY IF EXISTS "Enable delete for all users" ON pack_job_component;

CREATE POLICY "Enable read access for all users" ON pack_job_component FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON pack_job_component FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON pack_job_component FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON pack_job_component FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON inventory_transaction;
DROP POLICY IF EXISTS "Enable insert for all users" ON inventory_transaction;
DROP POLICY IF EXISTS "Enable update for all users" ON inventory_transaction;
DROP POLICY IF EXISTS "Enable delete for all users" ON inventory_transaction;

CREATE POLICY "Enable read access for all users" ON inventory_transaction FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON inventory_transaction FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON inventory_transaction FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON inventory_transaction FOR DELETE USING (true);

-- ====================================================================
-- 샘플 데이터
-- ====================================================================

-- 샘플 입고 오더
INSERT INTO inbound_shipment (warehouse_id, owner_brand_id, ref_no, type, status, eta)
SELECT 
  w.id,
  b.id,
  'IB-2025-001',
  'PURCHASE',
  'DRAFT',
  now() + INTERVAL '1 day'
FROM warehouse w, brand b
WHERE w.code = 'WH-KP-001' AND b.code LIKE '%-DEFAULT'
LIMIT 1
ON CONFLICT (ref_no) DO NOTHING;

-- 샘플 Pack Job (KIT 타입 상품이 있는 경우에만)
INSERT INTO pack_job (warehouse_id, kit_product_id, owner_brand_id, qty_kit_planned, status)
SELECT 
  w.id,
  p.id,
  b.id,
  10,
  'DRAFT'
FROM warehouse w, products p, brand b
WHERE w.code = 'WH-KP-001' 
  AND p.product_type = 'KIT'
  AND b.code LIKE '%-DEFAULT'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 완료
-- ====================================================================
-- 마이그레이션 03_inbound_outbound_work_task.sql 완료
-- 다음: 04_returns_shipping_extra.sql 실행
-- ====================================================================

