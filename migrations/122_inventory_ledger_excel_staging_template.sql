-- ====================================================================
-- Excel -> Ledger staging template
-- 목적:
-- 1) 엑셀 원본을 임시 staging 테이블에 적재
-- 2) 표준 movement_type/direction으로 변환
-- 3) inventory_ledger로 upsert-like 적재(idempotency_key 사용)
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- [1] staging 테이블
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_ledger_staging (
  id bigserial primary key,
  tenant_id uuid not null,
  warehouse_id uuid not null,
  product_id uuid not null,
  occurred_at timestamptz not null default now(),
  raw_row_no integer,
  opening_stock integer,
  inbound_qty integer,
  disposal_qty integer,
  damage_qty integer,
  return_b2c_qty integer,
  outbound_qty integer,
  adjustment_plus_qty integer,
  adjustment_minus_qty integer,
  bundle_break_in_qty integer,
  bundle_break_out_qty integer,
  export_pickup_qty integer,
  outbound_cancel_qty integer,
  memo text,
  source_file_name text,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_staging_tenant_product
  ON inventory_ledger_staging(tenant_id, product_id, occurred_at);

-- --------------------------------------------------------------------
-- [2] staging -> movement row 변환 뷰
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventory_ledger_staging_movements AS
WITH base AS (
  SELECT * FROM inventory_ledger_staging
),
u AS (
  SELECT
    tenant_id,
    warehouse_id,
    product_id,
    occurred_at,
    raw_row_no,
    memo,
    source_file_name,
    'INVENTORY_INIT'::text AS movement_type,
    'IN'::text AS direction,
    COALESCE(opening_stock, 0)::integer AS quantity
  FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'INBOUND', 'IN', COALESCE(inbound_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'DISPOSAL', 'OUT', COALESCE(disposal_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'DAMAGE', 'OUT', COALESCE(damage_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'RETURN_B2C', 'IN', COALESCE(return_b2c_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'OUTBOUND', 'OUT', COALESCE(outbound_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'ADJUSTMENT_PLUS', 'IN', COALESCE(adjustment_plus_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'ADJUSTMENT_MINUS', 'OUT', COALESCE(adjustment_minus_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'BUNDLE_BREAK_IN', 'IN', COALESCE(bundle_break_in_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'BUNDLE_BREAK_OUT', 'OUT', COALESCE(bundle_break_out_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'EXPORT_PICKUP', 'OUT', COALESCE(export_pickup_qty, 0)::integer FROM base
  UNION ALL
  SELECT tenant_id, warehouse_id, product_id, occurred_at, raw_row_no, memo, source_file_name, 'OUTBOUND_CANCEL', 'IN', COALESCE(outbound_cancel_qty, 0)::integer FROM base
)
SELECT
  tenant_id,
  warehouse_id,
  product_id,
  occurred_at,
  raw_row_no,
  memo,
  source_file_name,
  movement_type,
  direction,
  quantity
FROM u
WHERE quantity > 0;

-- --------------------------------------------------------------------
-- [3] 실제 적재 예시 (idempotency_key로 중복 방지)
-- 주의: created_by는 운영 계정/관리자 ID로 치환 필요
-- --------------------------------------------------------------------
-- INSERT INTO inventory_ledger (
--   org_id, tenant_id, warehouse_id, product_id,
--   transaction_type, movement_type, direction, quantity, qty_change,
--   reference_type, reference_id, memo, notes, idempotency_key, created_by, created_at
-- )
-- SELECT
--   m.tenant_id AS org_id,
--   m.tenant_id,
--   m.warehouse_id,
--   m.product_id,
--   CASE
--     WHEN m.movement_type = 'INBOUND' THEN 'INBOUND'
--     WHEN m.movement_type = 'OUTBOUND' THEN 'OUTBOUND'
--     WHEN m.movement_type IN ('RETURN_B2C', 'OUTBOUND_CANCEL') THEN 'RETURN'
--     WHEN m.movement_type = 'TRANSFER' THEN 'TRANSFER'
--     ELSE 'ADJUSTMENT'
--   END AS transaction_type,
--   m.movement_type,
--   m.direction,
--   m.quantity,
--   CASE WHEN m.direction = 'IN' THEN m.quantity ELSE -m.quantity END AS qty_change,
--   'EXCEL_IMPORT'::text AS reference_type,
--   NULL::uuid AS reference_id,
--   m.memo,
--   m.memo AS notes,
--   md5(
--     concat_ws('|',
--       m.tenant_id::text, m.warehouse_id::text, m.product_id::text,
--       m.occurred_at::text, m.raw_row_no::text, m.movement_type, m.direction, m.quantity::text, coalesce(m.source_file_name, '')
--     )
--   ) AS idempotency_key,
--   NULL::uuid AS created_by,
--   m.occurred_at
-- FROM v_inventory_ledger_staging_movements m
-- ON CONFLICT DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
