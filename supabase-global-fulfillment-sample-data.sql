-- ========================================
-- ANH WMS - Global Fulfillment 샘플 데이터
-- ========================================

-- 1. 고객사 데이터 (중국, 일본 고객사)
INSERT INTO global_customers (id, name, country_code, platform, wechat_id, email, phone) VALUES
('11111111-1111-1111-1111-111111111111', '淘宝精品店', 'CN', 'Taobao', 'taobao_shop_001', 'taobao@example.com', '+86-138-0000-0001'),
('22222222-2222-2222-2222-222222222222', 'Shopee Korea', 'KR', 'Shopee', 'shopee_kr', 'shopee@example.com', '+82-10-1234-5678'),
('33333333-3333-3333-3333-333333333333', '楽天ストア', 'JP', 'Rakuten', 'rakuten_store', 'rakuten@example.jp', '+81-90-1234-5678'),
('44444444-4444-4444-4444-444444444444', 'AliExpress Vendor', 'CN', 'AliExpress', 'aliexpress_v1', 'ali@example.com', '+86-139-0000-0002');

-- 2. 마감 시간 설정
INSERT INTO global_cutoffs (carrier, cutoff_type, cutoff_time, warehouse_location, country_code) VALUES
('CJ대한통운', 'daily', '18:00:00', '인천창고', 'KR'),
('顺丰速运', 'daily', '17:00:00', '인천창고', 'CN'),
('Lotte Global', 'daily', '16:00:00', '인천창고', 'KR'),
('佐川急便', 'daily', '15:00:00', '부산창고', 'JP');

-- 3. 파도(Wave) 생성
INSERT INTO global_waves (id, wave_number, wave_name, wave_type, shipping_method, carrier, status, planned_ship_date, cutoff_time) VALUES
('w1111111-1111-1111-1111-111111111111', 'W-2025-001', '2025년 1월 1차 항공', 'standard', 'air', 'CJ대한통운', 'in_progress', '2025-11-05', '18:00:00'),
('w2222222-2222-2222-2222-222222222222', 'W-2025-002', '2025년 1월 중국 특송', '2B', 'express', '顺丰速运', 'planned', '2025-11-06', '17:00:00');

-- 4. 해외배송 주문 데이터
INSERT INTO global_fulfillment_orders (
  id, order_number, customer_id, platform_order_id, current_step, status, 
  origin_country, destination_country, warehouse_location, shipping_method, 
  carrier, total_weight, customs_status, ordered_at, received_at
) VALUES
-- 주문 1: 진행 중 (검수 단계)
('o1111111-1111-1111-1111-111111111111', 'GF-2025-0001', '11111111-1111-1111-1111-111111111111', 
 'TB-20251101-001', 'inspection', 'in_progress', 'CN', 'KR', '인천창고', 'air', 
 'CJ대한통운', 15.5, 'pending', '2025-11-01 09:00:00', '2025-11-02 14:30:00'),

-- 주문 2: 패키지 검증 단계
('o2222222-2222-2222-2222-222222222222', 'GF-2025-0002', '22222222-2222-2222-2222-222222222222', 
 'SP-20251102-002', 'package_check', 'in_progress', 'CN', 'KR', '인천창고', 'express', 
 '顺丰速运', 8.3, 'cleared', '2025-11-02 10:00:00', '2025-11-02 16:00:00'),

-- 주문 3: 완료
('o3333333-3333-3333-3333-333333333333', 'GF-2025-0003', '33333333-3333-3333-3333-333333333333', 
 'RK-20251030-003', 'completed', 'completed', 'CN', 'JP', '부산창고', 'sea', 
 '佐川急便', 120.0, 'cleared', '2025-10-30 08:00:00', '2025-10-31 11:00:00'),

-- 주문 4: 이상 발생
('o4444444-4444-4444-4444-444444444444', 'GF-2025-0004', '44444444-4444-4444-4444-444444444444', 
 'ALI-20251103-004', 'wave_management', 'error', 'CN', 'KR', '인천창고', 'air', 
 'CJ대한통운', 25.7, 'delayed', '2025-11-03 07:00:00', '2025-11-03 13:00:00'),

-- 주문 5: 드롭시핑 단계
('o5555555-5555-5555-5555-555555555555', 'GF-2025-0005', '11111111-1111-1111-1111-111111111111', 
 'TB-20251104-005', 'drop_shipping', 'pending', 'CN', 'KR', '인천창고', 'air', 
 'CJ대한통운', NULL, 'pending', '2025-11-04 11:00:00', NULL);

-- 5. 주문 상세 항목
INSERT INTO global_order_items (order_id, sku, product_name, quantity, received_quantity, inspected_quantity, unit_weight, status) VALUES
-- 주문 1 항목
('o1111111-1111-1111-1111-111111111111', 'SKU-CN-001', '무선 이어폰', 50, 50, 48, 0.15, 'inspected'),
('o1111111-1111-1111-1111-111111111111', 'SKU-CN-002', '스마트워치', 30, 30, 30, 0.25, 'inspected'),

-- 주문 2 항목
('o2222222-2222-2222-2222-222222222222', 'SKU-KR-101', '뷰티 세트', 20, 20, 20, 0.35, 'packed'),

-- 주문 3 항목 (완료)
('o3333333-3333-3333-3333-333333333333', 'SKU-JP-201', '의류 세트', 100, 100, 100, 1.2, 'shipped'),

-- 주문 4 항목 (문제 발생)
('o4444444-4444-4444-4444-444444444444', 'SKU-CN-003', '전자제품', 40, 35, 0, 0.5, 'damaged'),

-- 주문 5 항목 (대기)
('o5555555-5555-5555-5555-555555555555', 'SKU-CN-004', '액세서리', 100, 0, 0, 0.1, 'pending');

-- 6. 프로세스 로그
INSERT INTO global_process_logs (order_id, step, action, status, operator_name, message) VALUES
('o1111111-1111-1111-1111-111111111111', 'drop_shipping', 'completed', 'completed', '김민수', '입고 완료'),
('o1111111-1111-1111-1111-111111111111', 'preparation', 'completed', 'completed', '이지은', '상품 준비 완료'),
('o1111111-1111-1111-1111-111111111111', 'inspection', 'started', 'in_progress', '박서준', '검수 시작'),

('o2222222-2222-2222-2222-222222222222', 'drop_shipping', 'completed', 'completed', '김민수', '입고 완료'),
('o2222222-2222-2222-2222-222222222222', 'inspection', 'completed', 'completed', '박서준', '검수 완료'),
('o2222222-2222-2222-2222-222222222222', 'package_check', 'started', 'in_progress', '최유진', '패키지 검증 중'),

('o4444444-4444-4444-4444-444444444444', 'drop_shipping', 'completed', 'completed', '김민수', '입고 완료'),
('o4444444-4444-4444-4444-444444444444', 'preparation', 'error', 'error', '이지은', '상품 파손 발견');

-- 7. Wave-Order 매핑
INSERT INTO global_wave_orders (wave_id, order_id, sequence_number) VALUES
('w1111111-1111-1111-1111-111111111111', 'o1111111-1111-1111-1111-111111111111', 1),
('w1111111-1111-1111-1111-111111111111', 'o2222222-2222-2222-2222-222222222222', 2),
('w2222222-2222-2222-2222-222222222222', 'o4444444-4444-4444-4444-444444444444', 1);

-- 8. 검수 기록
INSERT INTO global_inspections (
  order_id, inspection_type, result, inspector_name, condition, 
  issue_description, action_taken, inspected_at
) VALUES
('o1111111-1111-1111-1111-111111111111', 'quality', 'partial', '박서준', 'damaged', 
 '이어폰 2개 박스 손상', 'quarantine', '2025-11-03 10:30:00'),

('o2222222-2222-2222-2222-222222222222', 'quality', 'pass', '박서준', 'normal', 
 NULL, 'approve', '2025-11-03 11:00:00'),

('o4444444-4444-4444-4444-444444444444', 'quantity', 'fail', '박서준', 'missing', 
 '주문 수량 40개 중 5개 누락', 'return', '2025-11-03 14:00:00');

-- 9. 패키지 정보
INSERT INTO global_packages (
  package_number, order_id, wave_id, package_type, weight, 
  length, width, height, status, packed_at
) VALUES
('PKG-2025-0001', 'o2222222-2222-2222-2222-222222222222', 'w1111111-1111-1111-1111-111111111111', 
 'box', 8.5, 40, 30, 20, 'packed', '2025-11-03 15:00:00'),

('PKG-2025-0002', 'o3333333-3333-3333-3333-333333333333', NULL, 
 'pallet', 120.0, 120, 100, 150, 'shipped', '2025-11-01 16:00:00');

-- 10. 이상 처리
INSERT INTO global_exceptions (
  exception_number, order_id, exception_type, severity, title, description, 
  detected_by, status
) VALUES
('EXP-2025-0001', 'o4444444-4444-4444-4444-444444444444', 'missing_item', 'high', 
 '수량 부족', '주문 수량 40개 중 5개 누락', 'operator', 'open'),

('EXP-2025-0002', 'o1111111-1111-1111-1111-111111111111', 'damaged', 'medium', 
 '상품 파손', '이어폰 박스 2개 손상 발견', 'operator', 'investigating'),

('EXP-2025-0003', 'o4444444-4444-4444-4444-444444444444', 'customs_delay', 'high', 
 '통관 지연', '서류 미비로 통관 지연 중', 'system', 'open');

-- 11. 교환/반품
INSERT INTO global_returns (
  return_number, order_id, return_type, reason, reason_detail, status, 
  requested_by, return_to_inventory
) VALUES
('RET-2025-0001', 'o3333333-3333-3333-3333-333333333333', 'return', 
 '고객 단순 변심', '고객이 색상 변경 요청', 'requested', '楽天ストア', TRUE);

-- 통계 확인 쿼리 (주석)
/*
-- 전체 주문 현황
SELECT current_step, status, COUNT(*) as count
FROM global_fulfillment_orders
GROUP BY current_step, status;

-- 고객사별 주문량
SELECT c.name, c.country_code, COUNT(o.id) as order_count
FROM global_customers c
LEFT JOIN global_fulfillment_orders o ON c.id = o.customer_id
GROUP BY c.id, c.name, c.country_code;

-- 이상 처리 현황
SELECT exception_type, severity, status, COUNT(*) as count
FROM global_exceptions
GROUP BY exception_type, severity, status;

-- Wave별 진행 현황
SELECT w.wave_number, w.status, COUNT(wo.order_id) as order_count
FROM global_waves w
LEFT JOIN global_wave_orders wo ON w.id = wo.wave_id
GROUP BY w.id, w.wave_number, w.status;
*/

