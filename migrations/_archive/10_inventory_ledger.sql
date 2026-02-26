-- 재고 수불부 (Inventory Ledger) - 모든 재고 변동의 원장
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'RETURN', 'MOVE')),
    quantity_change INTEGER NOT NULL, -- 양수(증가) 또는 음수(감소)
    quantity_after INTEGER NOT NULL,  -- 변동 후 잔고 (Snapshot)
    location TEXT,                    -- 변동이 발생한 위치
    reference_id UUID,                -- 연관된 주문ID, 입고ID 등
    reason TEXT,                      -- 조정 사유 (파손, 분실, 실사차이 등)
    actor_id UUID,                    -- auth.users id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_product_id ON inventory_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_created_at ON inventory_ledger(created_at DESC);

-- RLS
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View inventory ledger" ON inventory_ledger
  FOR SELECT USING (true); -- 권한 정책에 따라 조절

-- 재고 변동 시 products 테이블 자동 업데이트 트리거
-- 주의: 동시성 문제가 발생할 수 있으므로, 실무에서는 Row Lock 등을 고려해야 함.
-- MVP 단계에서는 편의성을 위해 트리거 사용.
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- products 테이블의 quantity를 변동분만큼 업데이트
  UPDATE products
  SET 
    quantity = quantity + NEW.quantity_change,
    updated_at = NOW()
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inventory_ledger_insert ON inventory_ledger;
CREATE TRIGGER on_inventory_ledger_insert
  AFTER INSERT ON inventory_ledger
  FOR EACH ROW
  EXECUTE PROCEDURE update_product_stock();

