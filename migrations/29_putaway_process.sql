-- ====================================================================
-- Putaway (적치) 프로세스 스키마 - 수정됨
-- ====================================================================

-- 1. Putaway Task 테이블 생성 (이미 존재하면 건너뜀)
CREATE TABLE IF NOT EXISTS putaway_tasks (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null,
    warehouse_id        uuid not null,
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

-- 2. RLS 정책 안전하게 적용
DO $$
BEGIN
    ALTER TABLE putaway_tasks ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'putaway_tasks' AND policyname = 'Enable all for authenticated') THEN
        CREATE POLICY "Enable all for authenticated" ON putaway_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. 입고 완료 시 자동으로 Putaway Task 생성하는 트리거 함수 (수정됨)
CREATE OR REPLACE FUNCTION create_putaway_tasks_on_confirm()
RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
BEGIN
    -- 상태가 CONFIRMED로 변경될 때만 실행
    IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
        -- Receipt Lines를 순회하며 Task 생성
        FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = NEW.id LOOP
            -- 1. 정상(Accepted) 수량에 대한 Task 생성
            -- COALESCE를 사용하여 null 방어, received_qty를 기본값으로 사용 (app/actions logic 대응)
            IF COALESCE(v_line.accepted_qty, v_line.received_qty, 0) > 0 THEN
                INSERT INTO putaway_tasks (
                    org_id, warehouse_id, receipt_id, receipt_line_id, product_id, qty_expected
                ) VALUES (
                    NEW.org_id, NEW.warehouse_id, NEW.id, v_line.id, v_line.product_id, 
                    COALESCE(v_line.accepted_qty, v_line.received_qty)
                );
            END IF;
            
            -- 2. 파손(Damaged) 수량에 대한 Task 생성 (별도 관리 필요 시)
            -- 현재는 파손도 적치 대상에 포함하되, 비고나 별도 필드가 없으므로 동일하게 생성
            -- 추후 파손품 로케이션 자동 배정 로직 추가 가능
            IF COALESCE(v_line.damaged_qty, 0) > 0 THEN
                 INSERT INTO putaway_tasks (
                    org_id, warehouse_id, receipt_id, receipt_line_id, product_id, qty_expected
                ) VALUES (
                    NEW.org_id, NEW.warehouse_id, NEW.id, v_line.id, v_line.product_id, 
                    v_line.damaged_qty
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재등록
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
