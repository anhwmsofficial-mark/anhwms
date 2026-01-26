-- ====================================================================
-- Putaway (적치) 프로세스 스키마
-- ====================================================================

-- 1. Putaway Task 테이블 생성
CREATE TABLE IF NOT EXISTS putaway_tasks (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null references org(id),
    warehouse_id        uuid not null references warehouse(id),
    receipt_id          uuid not null references inbound_receipts(id),
    receipt_line_id     uuid not null references inbound_receipt_lines(id),
    product_id          uuid not null references products(id),
    
    qty_expected        integer not null, -- 적치 예정 수량
    qty_processed       integer default 0, -- 적치 완료 수량
    
    to_location_id      uuid references location(id), -- 목표 로케이션 (지정된 경우)
    
    status              text default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    
    assigned_to         uuid references auth.users(id),
    processed_by        uuid references auth.users(id),
    
    created_at          timestamptz default now(),
    updated_at          timestamptz default now(),
    completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_putaway_receipt ON putaway_tasks(receipt_id);
CREATE INDEX IF NOT EXISTS idx_putaway_status ON putaway_tasks(status);
CREATE INDEX IF NOT EXISTS idx_putaway_assigned ON putaway_tasks(assigned_to);

-- 2. 재고(Inventory) 테이블 확인 및 RLS 설정 (02번 마이그레이션에서 생성됨)
-- 만약 inventory 테이블이 없다면 재생성 (안전장치)
CREATE TABLE IF NOT EXISTS inventory (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id    UUID NOT NULL REFERENCES warehouse(id),
  location_id     UUID REFERENCES location(id),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty_on_hand     NUMERIC NOT NULL DEFAULT 0,
  qty_allocated   NUMERIC NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (warehouse_id, location_id, product_id)
);

ALTER TABLE putaway_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'putaway_tasks' AND policyname = 'Enable all for authenticated') THEN
        CREATE POLICY "Enable all for authenticated" ON putaway_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. 입고 완료 시 자동으로 Putaway Task 생성하는 트리거 함수
CREATE OR REPLACE FUNCTION create_putaway_tasks_on_confirm()
RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
BEGIN
    -- 상태가 CONFIRMED로 변경될 때만 실행
    IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
        -- Receipt Lines를 순회하며 Task 생성
        FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = NEW.id LOOP
            IF v_line.accepted_qty > 0 THEN
                INSERT INTO putaway_tasks (
                    org_id, warehouse_id, receipt_id, receipt_line_id, product_id, qty_expected
                ) VALUES (
                    NEW.org_id, NEW.warehouse_id, NEW.id, v_line.id, v_line.product_id, v_line.accepted_qty
                );
            END IF;
        END LOOP;
        
        -- 상태를 PUTAWAY_READY로 자동 변경 (선택적)
        -- UPDATE inbound_receipts SET status = 'PUTAWAY_READY' WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 등록
DROP TRIGGER IF EXISTS trg_create_putaway_tasks ON inbound_receipts;
CREATE TRIGGER trg_create_putaway_tasks
    AFTER UPDATE ON inbound_receipts
    FOR EACH ROW
    EXECUTE FUNCTION create_putaway_tasks_on_confirm();

-- 4. 로케이션 시드 데이터 (테스트용)
INSERT INTO location (warehouse_id, code, type, zone, status)
SELECT 
    id as warehouse_id,
    'RCV-01', 'RECEIVING', 'Inbound', 'ACTIVE'
FROM warehouse 
WHERE status = 'ACTIVE'
ON CONFLICT DO NOTHING;

INSERT INTO location (warehouse_id, code, type, zone, aisle, rack, shelf, status)
SELECT 
    id as warehouse_id,
    'A-01-01', 'STORAGE', 'A', '01', '01', '01', 'ACTIVE'
FROM warehouse 
WHERE status = 'ACTIVE'
ON CONFLICT DO NOTHING;

INSERT INTO location (warehouse_id, code, type, zone, aisle, rack, shelf, status)
SELECT 
    id as warehouse_id,
    'A-01-02', 'STORAGE', 'A', '01', '01', '02', 'ACTIVE'
FROM warehouse 
WHERE status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- 5. 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
