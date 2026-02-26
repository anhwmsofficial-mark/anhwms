-- ====================================================================
-- 36_update_warehouse_addresses.sql - 창고 주소 업데이트
-- ====================================================================

UPDATE warehouse
SET address_line1 = '경기도 김포시 통진읍 고정리 496-24'
WHERE name = 'ANH 제1창고';

UPDATE warehouse
SET address_line1 = '경기도 김포시 통진읍 귀전로 154번길 147'
WHERE name = 'ANH 제2창고';
