-- ====================================================================
-- 37_delete_default_warehouses.sql - 기본 창고 재배치 후 삭제
-- ====================================================================

-- 1) 대상 창고 확인/생성
INSERT INTO warehouse (code, name, type, country_code, city, status)
VALUES ('WH002', 'ANH 제2창고', 'ANH_OWNED', 'KR', '김포', 'ACTIVE')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  country_code = EXCLUDED.country_code,
  city = EXCLUDED.city,
  status = EXCLUDED.status;

-- 1-2) 반품센터용 창고 확인/생성
INSERT INTO warehouse (code, name, type, country_code, city, status, is_returns_center)
VALUES ('WH001', 'ANH 제1창고', 'ANH_OWNED', 'KR', '김포', 'ACTIVE', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  country_code = EXCLUDED.country_code,
  city = EXCLUDED.city,
  status = EXCLUDED.status,
  is_returns_center = EXCLUDED.is_returns_center;

-- 2) inbound_shipment 참조 재배치
-- RC-KP-001(반품센터) -> WH001
UPDATE inbound_shipment
SET warehouse_id = (SELECT id FROM warehouse WHERE code = 'WH001')
WHERE warehouse_id IN (
  SELECT id FROM warehouse WHERE code IN ('RC-KP-001')
);

-- 그 외 기본 창고 -> WH002
UPDATE inbound_shipment
SET warehouse_id = (SELECT id FROM warehouse WHERE code = 'WH002')
WHERE warehouse_id IN (
  SELECT id FROM warehouse WHERE code IN ('WH-KP-001', 'WH-IC-001', 'WH-SH-001')
);

-- 2-1) return_order 참조 재배치
-- RC-KP-001(반품센터) -> WH001
UPDATE return_order
SET warehouse_id = (SELECT id FROM warehouse WHERE code = 'WH001')
WHERE warehouse_id IN (
  SELECT id FROM warehouse WHERE code IN ('RC-KP-001')
);

-- 그 외 기본 창고 -> WH002
UPDATE return_order
SET warehouse_id = (SELECT id FROM warehouse WHERE code = 'WH002')
WHERE warehouse_id IN (
  SELECT id FROM warehouse WHERE code IN ('WH-KP-001', 'WH-IC-001', 'WH-SH-001')
);

-- 3) 기본 창고 삭제
DELETE FROM warehouse
WHERE code IN ('WH-KP-001', 'WH-IC-001', 'WH-SH-001', 'RC-KP-001');
