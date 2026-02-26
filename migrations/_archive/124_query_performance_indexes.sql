-- ====================================================================
-- Query performance indexes for frequently scanned paths
-- 목적: 저재고/입고 연관 조회의 full scan 비용 절감
-- ====================================================================

BEGIN;

-- low stock path: min_stock > 0 제품 선별
CREATE INDEX IF NOT EXISTS idx_products_min_stock_positive
  ON products(min_stock)
  WHERE min_stock > 0;

-- low stock path: product_id 단위 현재고 집계 조회
CREATE INDEX IF NOT EXISTS idx_inventory_quantities_product_id
  ON inventory_quantities(product_id);

-- inbound expected path: 상태 필터 + plan_id 추출
CREATE INDEX IF NOT EXISTS idx_inbound_receipts_status_plan
  ON inbound_receipts(status, plan_id);

-- inbound expected path: plan_id -> product_id 조회
CREATE INDEX IF NOT EXISTS idx_inbound_plan_lines_plan_product
  ON inbound_plan_lines(plan_id, product_id);

COMMIT;
