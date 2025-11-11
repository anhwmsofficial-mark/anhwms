-- ========================================
-- ANH WMS - Global Fulfillment Schema
-- 해외배송 전체 프로세스 관리
-- ========================================

-- 고객사 테이블 (이미 partners 테이블이 있다면 확장)
CREATE TABLE IF NOT EXISTS global_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id),
  name VARCHAR(255) NOT NULL,
  country_code VARCHAR(3) NOT NULL, -- 'CN', 'JP', 'KR' etc
  platform VARCHAR(50), -- 'Taobao', 'Shopify', 'Shopee' etc
  wechat_id VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  notification_preference JSONB DEFAULT '{"wechat": true, "email": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 해외배송 주문 메인 테이블
CREATE TABLE IF NOT EXISTS global_fulfillment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id UUID REFERENCES global_customers(id),
  platform_order_id VARCHAR(255), -- 외부 플랫폼 주문번호
  
  -- 프로세스 단계
  current_step VARCHAR(50) DEFAULT 'drop_shipping', 
  -- 'drop_shipping', 'preparation', 'wave_management', 'second_sorting', 
  -- 'inspection', 'package_check', 'weight_check', 'completed', 'exception', 'returned'
  
  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'in_progress', 'completed', 'delayed', 'error', 'returned'
  
  priority INTEGER DEFAULT 3, -- 1(높음) ~ 5(낮음)
  
  -- 물류 정보
  origin_country VARCHAR(3) DEFAULT 'CN',
  destination_country VARCHAR(3) DEFAULT 'KR',
  warehouse_location VARCHAR(100),
  transshipment_location VARCHAR(100), -- 환적지
  
  -- 운송 정보
  shipping_method VARCHAR(50), -- 'air', 'sea', 'express'
  carrier VARCHAR(100), -- 'CJ', '顺丰', 'Lotte' etc
  tracking_number VARCHAR(255),
  
  -- 무게 및 비용
  total_weight DECIMAL(10, 2),
  total_volume DECIMAL(10, 2),
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  
  -- 통관 정보
  customs_status VARCHAR(50), -- 'pending', 'in_progress', 'cleared', 'delayed', 'rejected'
  customs_cleared_at TIMESTAMPTZ,
  
  -- 타임스탬프
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ, -- 입고일시
  packed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- 메타데이터
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 주문 상세 항목 (SKU별)
CREATE TABLE IF NOT EXISTS global_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES global_fulfillment_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(255),
  
  quantity INTEGER NOT NULL DEFAULT 1,
  received_quantity INTEGER DEFAULT 0,
  inspected_quantity INTEGER DEFAULT 0,
  damaged_quantity INTEGER DEFAULT 0,
  missing_quantity INTEGER DEFAULT 0,
  
  unit_weight DECIMAL(10, 2),
  unit_price DECIMAL(10, 2),
  
  barcode VARCHAR(255),
  qr_code VARCHAR(255),
  
  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'received', 'inspected', 'packed', 'shipped', 'damaged', 'missing'
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로세스 이력 추적
CREATE TABLE IF NOT EXISTS global_process_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES global_fulfillment_orders(id) ON DELETE CASCADE,
  
  step VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL, -- 'started', 'completed', 'delayed', 'error'
  status VARCHAR(50),
  
  operator_id UUID, -- 작업자 ID (users 테이블 참조)
  operator_name VARCHAR(100),
  
  previous_value JSONB,
  new_value JSONB,
  
  message TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 파도(Wave) 관리 테이블
CREATE TABLE IF NOT EXISTS global_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_number VARCHAR(100) UNIQUE NOT NULL,
  wave_name VARCHAR(255),
  
  wave_type VARCHAR(50) DEFAULT 'standard', -- 'standard', '2B', '2S', 'pallet'
  shipping_method VARCHAR(50), -- 'air', 'sea'
  carrier VARCHAR(100),
  
  status VARCHAR(50) DEFAULT 'planned',
  -- 'planned', 'in_progress', 'sorting', 'completed', 'shipped'
  
  total_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  
  planned_ship_date DATE,
  actual_ship_date DATE,
  cutoff_time TIME,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wave-Order 매핑 테이블
CREATE TABLE IF NOT EXISTS global_wave_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id UUID REFERENCES global_waves(id) ON DELETE CASCADE,
  order_id UUID REFERENCES global_fulfillment_orders(id) ON DELETE CASCADE,
  
  sequence_number INTEGER, -- 정렬 순서
  batch_number VARCHAR(50), -- 배치 번호
  
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  UNIQUE(wave_id, order_id)
);

-- 검수(Inspection) 기록
CREATE TABLE IF NOT EXISTS global_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES global_fulfillment_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES global_order_items(id) ON DELETE CASCADE,
  
  inspection_type VARCHAR(50) DEFAULT 'quality', -- 'quality', 'quantity', 'packaging'
  
  result VARCHAR(50) DEFAULT 'pass', -- 'pass', 'fail', 'partial'
  
  inspector_id UUID,
  inspector_name VARCHAR(100),
  
  -- 검수 결과
  condition VARCHAR(50), -- 'normal', 'damaged', 'missing', 'incorrect'
  issue_description TEXT,
  
  -- 이미지
  photos JSONB DEFAULT '[]', -- Array of image URLs
  
  action_taken VARCHAR(50), -- 'approve', 'quarantine', 'return', 'dispose'
  
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 패키지 정보
CREATE TABLE IF NOT EXISTS global_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_number VARCHAR(100) UNIQUE NOT NULL,
  order_id UUID REFERENCES global_fulfillment_orders(id),
  wave_id UUID REFERENCES global_waves(id),
  
  package_type VARCHAR(50), -- 'box', 'pallet', 'bag', '2B', '2S'
  
  -- 치수 및 무게
  weight DECIMAL(10, 2),
  length DECIMAL(10, 2),
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  volume DECIMAL(10, 2),
  
  -- 무게 검증
  expected_weight DECIMAL(10, 2),
  weight_difference DECIMAL(10, 2),
  weight_verified BOOLEAN DEFAULT FALSE,
  
  -- 라벨 및 추적
  tracking_label VARCHAR(255),
  barcode VARCHAR(255),
  qr_code VARCHAR(255),
  label_printed_at TIMESTAMPTZ,
  
  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'packed', 'labeled', 'verified', 'shipped'
  
  packed_by UUID, -- 작업자 ID
  packed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 교환/반품 관리
CREATE TABLE IF NOT EXISTS global_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(100) UNIQUE NOT NULL,
  order_id UUID REFERENCES global_fulfillment_orders(id),
  
  return_type VARCHAR(50) NOT NULL, -- 'return', 'exchange'
  
  reason VARCHAR(255) NOT NULL,
  reason_detail TEXT,
  
  -- 반품 상품
  items JSONB DEFAULT '[]', -- Array of {item_id, sku, quantity}
  
  -- 상태
  status VARCHAR(50) DEFAULT 'requested',
  -- 'requested', 'approved', 'rejected', 'received', 'refunded', 'exchanged', 'disposed'
  
  -- 처리 정보
  requested_by VARCHAR(100),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  received_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  
  -- 환불/교환
  refund_amount DECIMAL(10, 2),
  restocking_fee DECIMAL(10, 2),
  
  return_shipping_cost DECIMAL(10, 2),
  
  -- 재고 처리
  return_to_inventory BOOLEAN DEFAULT TRUE,
  disposal_reason TEXT,
  
  photos JSONB DEFAULT '[]', -- 반품 상품 사진
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 이상(Exception) 처리
CREATE TABLE IF NOT EXISTS global_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_number VARCHAR(100) UNIQUE NOT NULL,
  order_id UUID REFERENCES global_fulfillment_orders(id),
  
  exception_type VARCHAR(50) NOT NULL,
  -- 'missing_item', 'duplicate', 'damaged', 'customs_delay', 'wrong_address', 
  -- 'weight_mismatch', 'system_error', 'other'
  
  severity VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- 자동 감지 정보
  detected_by VARCHAR(50), -- 'system', 'operator', 'customer'
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  
  status VARCHAR(50) DEFAULT 'open',
  -- 'open', 'investigating', 'resolved', 'closed', 'escalated'
  
  -- 담당자
  assigned_to UUID,
  assigned_at TIMESTAMPTZ,
  
  -- 해결 정보
  resolution_action VARCHAR(255),
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  
  -- 고객 알림
  customer_notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  
  photos JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 마감 시간(Cut-off) 관리
CREATE TABLE IF NOT EXISTS global_cutoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  cutoff_name VARCHAR(100) NOT NULL,
  carrier VARCHAR(100) NOT NULL, -- 'CJ', '顺丰', 'Lotte' etc
  
  cutoff_type VARCHAR(50) DEFAULT 'daily', -- 'daily', 'weekly'
  
  -- 시간 설정
  cutoff_time TIME NOT NULL, -- 예: 17:00
  cutoff_days JSONB DEFAULT '[]', -- ['monday', 'tuesday', ...] for weekly
  
  -- 지역/창고별
  warehouse_location VARCHAR(100),
  country_code VARCHAR(3),
  
  -- 상태
  is_active BOOLEAN DEFAULT TRUE,
  
  -- 알림 설정
  reminder_minutes_before INTEGER DEFAULT 60, -- 1시간 전 알림
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(carrier, cutoff_type, warehouse_location, cutoff_time)
);

-- 통계 및 리포트용 뷰
CREATE OR REPLACE VIEW global_fulfillment_stats AS
SELECT 
  DATE(created_at) as date,
  customer_id,
  origin_country,
  destination_country,
  current_step,
  status,
  COUNT(*) as order_count,
  SUM(total_weight) as total_weight,
  AVG(
    EXTRACT(EPOCH FROM (shipped_at - received_at)) / 3600
  ) as avg_processing_hours
FROM global_fulfillment_orders
GROUP BY DATE(created_at), customer_id, origin_country, destination_country, current_step, status;

-- 인덱스 생성
CREATE INDEX idx_gfo_order_number ON global_fulfillment_orders(order_number);
CREATE INDEX idx_gfo_customer_id ON global_fulfillment_orders(customer_id);
CREATE INDEX idx_gfo_status ON global_fulfillment_orders(status);
CREATE INDEX idx_gfo_current_step ON global_fulfillment_orders(current_step);
CREATE INDEX idx_gfo_created_at ON global_fulfillment_orders(created_at);

CREATE INDEX idx_goi_order_id ON global_order_items(order_id);
CREATE INDEX idx_goi_sku ON global_order_items(sku);

CREATE INDEX idx_gpl_order_id ON global_process_logs(order_id);
CREATE INDEX idx_gpl_created_at ON global_process_logs(created_at);

CREATE INDEX idx_gw_wave_number ON global_waves(wave_number);
CREATE INDEX idx_gw_status ON global_waves(status);

CREATE INDEX idx_ge_order_id ON global_exceptions(order_id);
CREATE INDEX idx_ge_status ON global_exceptions(status);
CREATE INDEX idx_ge_severity ON global_exceptions(severity);

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_global_customers_updated_at BEFORE UPDATE ON global_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_fulfillment_orders_updated_at BEFORE UPDATE ON global_fulfillment_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_order_items_updated_at BEFORE UPDATE ON global_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_waves_updated_at BEFORE UPDATE ON global_waves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_packages_updated_at BEFORE UPDATE ON global_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_returns_updated_at BEFORE UPDATE ON global_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_exceptions_updated_at BEFORE UPDATE ON global_exceptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_cutoffs_updated_at BEFORE UPDATE ON global_cutoffs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 활성화
ALTER TABLE global_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_fulfillment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_process_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_wave_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_cutoffs ENABLE ROW LEVEL SECURITY;

-- 기본 정책 (모든 인증된 사용자에게 읽기/쓰기 권한)
-- 기존 정책이 있다면 먼저 삭제
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_customers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_fulfillment_orders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_order_items;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_process_logs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_waves;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_wave_orders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_inspections;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_packages;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_returns;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_exceptions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON global_cutoffs;

-- 정책 생성
CREATE POLICY "Allow all for authenticated users" ON global_customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_fulfillment_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_order_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_process_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_waves FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_wave_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_inspections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_packages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_returns FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_exceptions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON global_cutoffs FOR ALL USING (auth.role() = 'authenticated');

