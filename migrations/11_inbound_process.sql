-- 입고 상세 테이블 (검수 결과 포함)
ALTER TABLE inbounds
ADD COLUMN IF NOT EXISTS tracking_no TEXT, -- 입고 택배 송장번호
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS expected_arrival_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_arrival_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0, -- 실제 입고 수량
ADD COLUMN IF NOT EXISTS inspection_status TEXT DEFAULT 'PENDING' CHECK (inspection_status IN ('PENDING', 'PASSED', 'PARTIAL', 'REJECTED')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS photos TEXT[]; -- 검수 사진 URL

-- 입고 검수 이력 (Inbound Inspection History)
CREATE TABLE IF NOT EXISTS inbound_inspections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inbound_id UUID REFERENCES inbounds(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    expected_qty INTEGER NOT NULL,
    received_qty INTEGER NOT NULL,
    rejected_qty INTEGER DEFAULT 0,
    condition TEXT CHECK (condition IN ('GOOD', 'DAMAGED', 'WRONG_ITEM', 'EXPIRED')),
    inspector_id UUID, -- auth.users
    note TEXT,
    photos TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE inbound_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View inspections" ON inbound_inspections
  FOR SELECT USING (true);

CREATE POLICY "Create inspections" ON inbound_inspections
  FOR INSERT WITH CHECK (true);

-- 입고 완료 시 재고 반영 트리거 함수
CREATE OR REPLACE FUNCTION process_inbound_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- 상태가 completed로 변경되었을 때만 실행
  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
    
    -- 재고 수불부(Ledger)에 입고 기록 추가
    INSERT INTO inventory_ledger (
      product_id,
      type,
      quantity_change,
      quantity_after, -- 트리거 실행 시점의 재고 + 입고량 (근사치)
      location,
      reference_id,
      reason,
      actor_id
    )
    SELECT
      NEW.product_id,
      'INBOUND',
      NEW.received_quantity, -- 실제 입고 수량 사용
      (SELECT quantity FROM products WHERE id = NEW.product_id) + NEW.received_quantity,
      (SELECT location FROM products WHERE id = NEW.product_id),
      NEW.id,
      '입고 완료 (Inbound Completed)',
      auth.uid() -- 현재 사용자 (트리거에서는 확인 필요, 없을 시 NULL)
    ;
    
    -- 주의: inventory_ledger의 트리거가 products 테이블을 업데이트하므로 여기서는 중복 업데이트 하지 않음
    -- 다만, inventory_ledger 트리거에 의존하지 않고 명시적으로 하려면 로직 조정 필요.
    -- 현재 구조: Inbound Complete -> Ledger Insert -> Product Update
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inbound_complete ON inbounds;
CREATE TRIGGER on_inbound_complete
  AFTER UPDATE ON inbounds
  FOR EACH ROW
  EXECUTE PROCEDURE process_inbound_completion();

