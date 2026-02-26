-- ====================================================================
-- ANH WMS v2 Clean Up Script
-- 00_cleanup.sql - v2 신규 테이블만 삭제
-- ====================================================================
-- 주의: 이 스크립트는 v2에서 추가된 테이블만 삭제합니다!
-- v1 기존 테이블(products, partners, outbounds 등)은 보존됩니다!
-- 실행 전 반드시 데이터 백업을 확인하세요!
-- ====================================================================

-- ====================================================================
-- CASCADE 순서대로 삭제 (역순)
-- ====================================================================

-- 4단계 테이블부터 삭제
DROP TABLE IF EXISTS system_alert CASCADE;
DROP TABLE IF EXISTS billing_invoice_line CASCADE;
DROP TABLE IF EXISTS billing_invoice CASCADE;
DROP TABLE IF EXISTS parcel_shipment CASCADE;
DROP TABLE IF EXISTS shipping_account CASCADE;
DROP TABLE IF EXISTS shipping_carrier CASCADE;
DROP TABLE IF EXISTS return_order_line CASCADE;
DROP TABLE IF EXISTS return_order CASCADE;

-- 3단계 테이블 삭제
DROP TABLE IF EXISTS inventory_transaction CASCADE;
DROP TABLE IF EXISTS pack_job_component CASCADE;
DROP TABLE IF EXISTS pack_job CASCADE;
DROP TABLE IF EXISTS work_task_action CASCADE;
DROP TABLE IF EXISTS outbound_order_line CASCADE;
DROP TABLE IF EXISTS inbound_shipment_line CASCADE;
DROP TABLE IF EXISTS inbound_shipment CASCADE;

-- 2단계 테이블 삭제
DROP TABLE IF EXISTS inventory_transaction CASCADE;
DROP TABLE IF EXISTS product_bom CASCADE;
DROP TABLE IF EXISTS product_uom CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS stock_transfer_line CASCADE;
DROP TABLE IF EXISTS stock_transfer CASCADE;
DROP TABLE IF EXISTS brand_warehouse CASCADE;
DROP TABLE IF EXISTS location CASCADE;
DROP TABLE IF EXISTS warehouse CASCADE;

-- 1단계 테이블 삭제
DROP TABLE IF EXISTS store CASCADE;
DROP TABLE IF EXISTS brand CASCADE;
DROP TABLE IF EXISTS customer_master CASCADE;
DROP TABLE IF EXISTS org CASCADE;

-- ====================================================================
-- v1 테이블의 v2 확장 컬럼 제거 (선택사항)
-- ====================================================================
-- 주의: 이 부분은 products, outbounds, work_orders 테이블의 v2 컬럼을 제거합니다
-- 기존 데이터를 유지하려면 이 섹션을 주석 처리하세요!

-- products 테이블 v2 컬럼 제거
DO $$
BEGIN
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS brand_id CASCADE;
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS barcode CASCADE;
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS hs_code CASCADE;
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS weight_kg CASCADE;
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS length_cm CASCADE;
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS width_cm CASCADE;
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS height_cm CASCADE;
  ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS product_type CASCADE;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- outbounds 테이블 v2 컬럼 제거
DO $$
BEGIN
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS warehouse_id CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS brand_id CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS store_id CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS order_type CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS client_order_no CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS channel_order_no CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS requested_ship_at CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS shipped_at CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS tracking_no CASCADE;
  ALTER TABLE IF EXISTS outbounds DROP COLUMN IF EXISTS carrier_code CASCADE;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- work_orders 테이블 v2 컬럼 제거
DO $$
BEGIN
  ALTER TABLE IF EXISTS work_orders DROP COLUMN IF EXISTS warehouse_id CASCADE;
  ALTER TABLE IF EXISTS work_orders DROP COLUMN IF EXISTS task_type CASCADE;
  ALTER TABLE IF EXISTS work_orders DROP COLUMN IF EXISTS process_stage CASCADE;
  ALTER TABLE IF EXISTS work_orders DROP COLUMN IF EXISTS outbound_id CASCADE;
  ALTER TABLE IF EXISTS work_orders DROP COLUMN IF EXISTS inbound_shipment_id CASCADE;
  ALTER TABLE IF EXISTS work_orders DROP COLUMN IF EXISTS sla_due_at CASCADE;
  ALTER TABLE IF EXISTS work_orders DROP COLUMN IF EXISTS priority CASCADE;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ====================================================================
-- 완료 메시지
-- ====================================================================

SELECT 'All v2 tables have been dropped. v1 tables preserved. Ready for fresh migration!' AS status;

-- ====================================================================
-- 다음 단계:
-- 1. 이 스크립트 실행 (00_cleanup.sql)
-- 2. 01_core_customer.sql 실행
-- 3. 02_warehouse_product_inventory.sql 실행
-- 4. 03_inbound_outbound_work_task.sql 실행
-- 5. 04_returns_shipping_extra.sql 실행
-- ====================================================================

