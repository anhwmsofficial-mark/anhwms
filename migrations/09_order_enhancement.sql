-- 주문 테이블 고도화 (상태 머신 및 보류 기능 지원)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hold_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID, -- auth.users id
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- 상태 변경 이력 테이블 (State Machine Tracking)
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by UUID, -- auth.users id
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for order_status_history
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View order history" ON order_status_history
  FOR SELECT USING (true); -- 권한 정책에 따라 조절 가능

CREATE POLICY "Insert order history" ON order_status_history
  FOR INSERT WITH CHECK (true);

-- 상태 머신 트리거 함수 (옵션: 상태 변경 시 자동으로 이력 남기기)
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Status changed via update');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_status_change ON orders;
CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE PROCEDURE log_order_status_change();

