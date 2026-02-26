-- ====================================================================
-- 30_add_locations_and_receipt_location.sql
-- 로케이션 데이터 추가 및 입고 라인에 로케이션 지정 기능 추가
-- ====================================================================

-- 1. 창고 (Warehouse) 데이터 확인 및 생성
DO $$
DECLARE
    v_org_id uuid;
    v_wh1_id uuid;
    v_wh2_id uuid;
BEGIN
    -- org_id 조회 (없으면 임의 생성 방지 위해 기존 데이터 사용하거나, 없으면 생성)
    SELECT id INTO v_org_id FROM org LIMIT 1;
    IF v_org_id IS NULL THEN
        INSERT INTO org (name, code) VALUES ('ANH', 'ANH') RETURNING id INTO v_org_id;
    END IF;

    -- ANH 제1창고
    SELECT id INTO v_wh1_id FROM warehouse WHERE name = 'ANH 제1창고';
    IF v_wh1_id IS NULL THEN
        INSERT INTO warehouse (org_id, name, code, type, status)
        VALUES (v_org_id, 'ANH 제1창고', 'WH01', 'GENERAL', 'ACTIVE')
        RETURNING id INTO v_wh1_id;
    END IF;

    -- ANH 제2창고
    SELECT id INTO v_wh2_id FROM warehouse WHERE name = 'ANH 제2창고';
    IF v_wh2_id IS NULL THEN
        INSERT INTO warehouse (org_id, name, code, type, status)
        VALUES (v_org_id, 'ANH 제2창고', 'WH02', 'GENERAL', 'ACTIVE')
        RETURNING id INTO v_wh2_id;
    END IF;

    -- 2. 로케이션 (Location) 생성
    -- 제1창고 A-1-01-01
    INSERT INTO location (warehouse_id, code, zone, aisle, rack, shelf, type, status)
    VALUES (v_wh1_id, 'A-1-01-01', 'A', '1', '01', '01', 'STORAGE', 'ACTIVE')
    ON CONFLICT (warehouse_id, code) DO NOTHING;

    -- 제1창고 B-1-01-01
    INSERT INTO location (warehouse_id, code, zone, aisle, rack, shelf, type, status)
    VALUES (v_wh1_id, 'B-1-01-01', 'B', '1', '01', '01', 'STORAGE', 'ACTIVE')
    ON CONFLICT (warehouse_id, code) DO NOTHING;

    -- 제2창고 A-1-01-01
    INSERT INTO location (warehouse_id, code, zone, aisle, rack, shelf, type, status)
    VALUES (v_wh2_id, 'A-1-01-01', 'A', '1', '01', '01', 'STORAGE', 'ACTIVE')
    ON CONFLICT (warehouse_id, code) DO NOTHING;

    -- 제2창고 B-1-01-01
    INSERT INTO location (warehouse_id, code, zone, aisle, rack, shelf, type, status)
    VALUES (v_wh2_id, 'B-1-01-01', 'B', '1', '01', '01', 'STORAGE', 'ACTIVE')
    ON CONFLICT (warehouse_id, code) DO NOTHING;

END $$;

-- 3. inbound_receipt_lines 테이블에 location_id 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inbound_receipt_lines' AND column_name = 'location_id') THEN
        ALTER TABLE inbound_receipt_lines ADD COLUMN location_id uuid REFERENCES location(id);
    END IF;
END $$;

-- 4. create_putaway_tasks_on_confirm 함수 수정 (location_id 반영)
CREATE OR REPLACE FUNCTION create_putaway_tasks_on_confirm()
RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
    v_status TEXT;
    v_processed_qty INTEGER;
BEGIN
    -- 상태가 CONFIRMED로 변경될 때만 실행
    IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
        -- Receipt Lines를 순회하며 Task 생성
        FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = NEW.id LOOP
            
            -- 입고 시 로케이션이 이미 지정되었다면, Putaway Task는 'COMPLETED' 상태로 바로 생성할 수도 있음.
            -- 하지만 여기서는 '적치 지시'를 생성하되, '목표 로케이션(to_location_id)'을 미리 지정해주는 방식으로 처리.
            -- 만약 즉시 적치 완료로 처리하려면 status='COMPLETED'로 설정하면 됨.
            -- 사용자 요구사항: "로케이션도 같이 등록". 즉, 입고 시점에 위치를 확정하는 것일 가능성이 큼.
            
            -- 로케이션이 지정된 경우: 해당 위치로 적치 할당
            -- 로케이션이 없는 경우: PENDING 상태 (이후 적치 단계에서 지정)
            
            IF COALESCE(v_line.accepted_qty, v_line.received_qty, 0) > 0 THEN
                INSERT INTO putaway_tasks (
                    org_id, warehouse_id, receipt_id, receipt_line_id, product_id, 
                    qty_expected, 
                    to_location_id, -- 지정된 로케이션 반영
                    status -- 로케이션이 있으면 바로 완료 처리? or 할당만? -> 일단 할당만(PENDING) 하거나 진행중(IN_PROGRESS)
                           -- 시나리오상 현장에서 바로 위치 등록했으므로 바로 완료(COMPLETED) 처리하는게 맞을 듯?
                           -- 하지만 재고 이동(Inventory Move) 로직도 필요함.
                           -- 단순히 Task만 만드는게 아니라 Inventory Ledger도 찍혀야 함.
                           -- 복잡도를 줄이기 위해, 일단 to_location_id만 채워두고, Putaway 페이지에서 '완료' 누르게 하거나
                           -- 아니면 여기서 바로 완료 처리.
                           -- 사용자가 "등록하면 좋겠다"고 했으므로, 여기서 바로 위치를 잡는 것이 효율적.
                ) VALUES (
                    NEW.org_id, NEW.warehouse_id, NEW.id, v_line.id, v_line.product_id, 
                    COALESCE(v_line.accepted_qty, v_line.received_qty),
                    v_line.location_id,
                    'PENDING' -- 일단 PENDING으로 두고, to_location_id가 있으면 작업자가 확인만 하고 완료하도록 유도
                );
            END IF;
            
            -- 파손품 처리
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

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
