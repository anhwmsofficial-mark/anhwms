-- ==============================================================================
-- ANH WMS 통합 기능 활성화 스크립트 (Risk, Visibility, Scalability)
-- ==============================================================================

-- [1] 주문 리스크 관리 (Order Hold/Cancel)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hold_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID,
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by UUID,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View order history" ON order_status_history FOR SELECT USING (true);
CREATE POLICY "Insert order history" ON order_status_history FOR INSERT WITH CHECK (true);

-- [2] 재고 수불부 (Inventory Ledger & Audit)
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'RETURN', 'MOVE')),
    quantity_change INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    location TEXT,
    reference_id UUID,
    reason TEXT,
    actor_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_product_id ON inventory_ledger(product_id);
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View inventory ledger" ON inventory_ledger FOR SELECT USING (true);

-- 재고 자동 동기화 트리거
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET quantity = quantity + NEW.quantity_change, updated_at = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inventory_ledger_insert ON inventory_ledger;
CREATE TRIGGER on_inventory_ledger_insert
  AFTER INSERT ON inventory_ledger
  FOR EACH ROW EXECUTE PROCEDURE update_product_stock();

-- [3] 입고 검수 프로세스 (Inbound Inspection)
ALTER TABLE inbounds
ADD COLUMN IF NOT EXISTS tracking_no TEXT,
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS expected_arrival_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_arrival_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS inspection_status TEXT DEFAULT 'PENDING' CHECK (inspection_status IN ('PENDING', 'PASSED', 'PARTIAL', 'REJECTED')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS photos TEXT[];

CREATE TABLE IF NOT EXISTS inbound_inspections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inbound_id UUID REFERENCES inbounds(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    expected_qty INTEGER NOT NULL,
    received_qty INTEGER NOT NULL,
    rejected_qty INTEGER DEFAULT 0,
    condition TEXT,
    inspector_id UUID,
    note TEXT,
    photos TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inbound_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All access inspections" ON inbound_inspections FOR ALL USING (true);

-- 입고 완료 시 수불부 자동 기록 트리거
CREATE OR REPLACE FUNCTION process_inbound_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
    INSERT INTO inventory_ledger (product_id, type, quantity_change, quantity_after, location, reference_id, reason, actor_id)
    SELECT
      NEW.product_id, 'INBOUND', NEW.received_quantity,
      (SELECT quantity FROM products WHERE id = NEW.product_id) + NEW.received_quantity,
      (SELECT location FROM products WHERE id = NEW.product_id),
      NEW.id, '입고 완료 (Inbound Completed)', auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inbound_complete ON inbounds;
CREATE TRIGGER on_inbound_complete
  AFTER UPDATE ON inbounds
  FOR EACH ROW EXECUTE PROCEDURE process_inbound_completion();

-- [4] 파트너 포털 (Partner Portal & Isolation)
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

-- RLS 정책 (기존 개발용 정책을 덮어씀)
DROP POLICY IF EXISTS "Partners can view own products" ON products;
CREATE POLICY "Partners can view own products" ON products
  FOR SELECT USING (
    -- 관리자이거나, 파트너 ID가 일치하거나, 파트너 ID가 없는 공용 상품
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager', 'staff') OR 
    partner_id IN (SELECT partner_id FROM users WHERE id = auth.uid()) OR
    partner_id IS NULL
  );

DROP POLICY IF EXISTS "Partners can view own orders" ON orders;
CREATE POLICY "Partners can view own orders" ON orders
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager', 'staff') OR 
    partner_id IN (SELECT partner_id FROM users WHERE id = auth.uid())
  );

