-- ====================================================================
-- Inventory Ledger (재고 원장) 스키마 - Fix Version
-- ====================================================================

-- 1. 기존 테이블 삭제 (잘못된 스키마 정리를 위해 DROP)
DROP TABLE IF EXISTS inventory_ledger CASCADE;
DROP TABLE IF EXISTS inventory_quantities CASCADE;

-- 2. 재고 원장 테이블 생성
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null,
    warehouse_id        uuid not null, -- references warehouse(id)
    product_id          uuid not null, -- references product(id)
    transaction_type    text not null check (transaction_type in ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER', 'RETURN')),
    qty_change          integer not null, -- 양수(+)는 증가, 음수(-)는 감소
    balance_after       integer, -- 트랜잭션 후 잔고 (선택적)
    reference_type      text, -- 'INBOUND_RECEIPT', 'ORDER', 'ADJUSTMENT'
    reference_id        uuid, -- 연결된 원본 문서 ID
    notes               text,
    created_by          uuid references auth.users(id),
    created_at          timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_product ON inventory_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_warehouse ON inventory_ledger(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_created_at ON inventory_ledger(created_at);

-- 3. 현재고 집계 테이블 생성
CREATE TABLE IF NOT EXISTS inventory_quantities (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null,
    warehouse_id        uuid not null,
    product_id          uuid not null,
    qty_on_hand         integer not null default 0, -- 실제 보유 수량
    qty_available       integer not null default 0, -- 가용 수량 (할당 제외)
    qty_allocated       integer not null default 0, -- 주문 할당된 수량
    updated_at          timestamptz not null default now(),
    unique(warehouse_id, product_id)
);

-- 4. RLS 설정
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_quantities ENABLE ROW LEVEL SECURITY;

-- 정책: 인증된 사용자 허용 (추후 강화 필요)
DROP POLICY IF EXISTS "Enable read for authenticated users" ON inventory_ledger;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_ledger;

CREATE POLICY "Enable read for authenticated users" ON inventory_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON inventory_ledger FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read for authenticated users" ON inventory_quantities;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inventory_quantities;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_quantities;

CREATE POLICY "Enable read for authenticated users" ON inventory_quantities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for authenticated users" ON inventory_quantities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON inventory_quantities FOR INSERT TO authenticated WITH CHECK (true);

-- 5. 입고 확정 시 재고 반영 함수 (RPC)
CREATE OR REPLACE FUNCTION confirm_inbound_receipt(p_receipt_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_receipt RECORD;
    v_line RECORD;
    v_current_qty INTEGER;
BEGIN
    -- 1. Receipt 정보 조회
    SELECT * INTO v_receipt FROM inbound_receipts WHERE id = p_receipt_id;
    
    IF v_receipt IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;
    
    IF v_receipt.status = 'CONFIRMED' THEN
        RAISE EXCEPTION 'Already confirmed';
    END IF;

    -- 2. Line 반복 처리
    FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = p_receipt_id LOOP
        IF v_line.received_qty > 0 THEN
            -- 2-1. Ledger 기록
            INSERT INTO inventory_ledger (
                org_id, warehouse_id, product_id, transaction_type, 
                qty_change, reference_type, reference_id, created_by
            ) VALUES (
                v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, 'INBOUND',
                v_line.received_qty, 'INBOUND_RECEIPT', p_receipt_id, p_user_id
            );

            -- 2-2. Quantities 테이블 업데이트 (Upsert)
            INSERT INTO inventory_quantities (org_id, warehouse_id, product_id, qty_on_hand, qty_available)
            VALUES (v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, v_line.received_qty, v_line.received_qty)
            ON CONFLICT (warehouse_id, product_id) 
            DO UPDATE SET 
                qty_on_hand = inventory_quantities.qty_on_hand + EXCLUDED.qty_on_hand,
                qty_available = inventory_quantities.qty_available + EXCLUDED.qty_available,
                updated_at = NOW();
        END IF;
    END LOOP;

    -- 3. Receipt 상태 업데이트
    UPDATE inbound_receipts 
    SET status = 'CONFIRMED', confirmed_at = NOW(), confirmed_by = p_user_id
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 재고 원장 테이블 재생성 및 반영 함수 업데이트 완료';
END $$;
