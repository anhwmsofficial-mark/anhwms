-- =====================================================
-- 다수지 코드 (多受地 코드) 스키마
-- 여러 납품처/수령지를 고유 코드로 관리
-- =====================================================

-- destinations (다수지/납품처) 테이블
CREATE TABLE IF NOT EXISTS destinations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    destination_code TEXT UNIQUE NOT NULL, -- 다수지 코드 (예: OLY-SD-0134)
    name TEXT NOT NULL, -- 수령지 이름 (예: 올리브영 서대문점)
    channel TEXT, -- 업체/채널명 (예: 올리브영, 쿠팡, 이마트)
    customer_id TEXT, -- 연결된 고객사 ID (partners 테이블 참조)
    type TEXT NOT NULL CHECK (type IN ('B2B', 'B2C', 'FC', '점포', '센터', '지점', '기타')),
    
    -- 주소 정보
    country TEXT DEFAULT 'KR', -- 국가 코드
    postal_code TEXT, -- 우편번호
    address TEXT NOT NULL, -- 기본 주소
    address_detail TEXT, -- 상세 주소
    
    -- 연락 정보
    contact_name TEXT, -- 담당자명
    contact_phone TEXT, -- 연락처
    contact_email TEXT, -- 이메일
    
    -- 운영 정보
    lead_time_days INTEGER DEFAULT 1, -- 리드타임 (일)
    delivery_note TEXT, -- 배송 시 유의사항
    restrictions TEXT, -- 납품 조건/규격 (JSON 또는 TEXT)
    label_format TEXT, -- 라벨 포맷 (A4, 100x150mm 등)
    
    -- 운영 상태
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 다수지 코드로 빠른 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_destinations_code ON destinations(destination_code);
CREATE INDEX IF NOT EXISTS idx_destinations_channel ON destinations(channel);
CREATE INDEX IF NOT EXISTS idx_destinations_type ON destinations(type);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON destinations(active);

-- RLS 설정
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON destinations
    FOR ALL
    USING (auth.role() = 'authenticated');

-- =====================================================
-- 샘플 데이터 (국내/해외 주요 채널)
-- =====================================================

-- 올리브영 점포들
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days, label_format, restrictions) VALUES
('OLY-SD-0134', '올리브영 서대문점', '올리브영', '점포', 'KR', '03736', '서울특별시 서대문구 신촌로 83', '김영희', '02-1234-5678', 1, 'A4', '납품시간: 오전 10시~오후 5시, 팔레트 불가'),
('OLY-GN-0256', '올리브영 강남점', '올리브영', '점포', 'KR', '06028', '서울특별시 강남구 강남대로 422', '이철수', '02-2345-6789', 1, 'A4', '납품시간: 오전 9시~오후 6시'),
('OLY-YS-0089', '올리브영 용산점', '올리브영', '점포', 'KR', '04318', '서울특별시 용산구 한강대로 23길 55', '박민수', '02-3456-7890', 1, 'A4', '지하 하역장 이용');

-- 쿠팡 물류센터
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days, label_format, restrictions) VALUES
('CP-FC-01', '쿠팡 인천 1센터', '쿠팡', 'FC', 'KR', '22742', '인천광역시 서구 북항로 32번길 56', '최담당', '032-111-2222', 2, '100x150mm', '팔레트 필수, QR코드 라벨 부착'),
('CP-FC-02', '쿠팡 김포센터', '쿠팡', 'FC', 'KR', '10135', '경기도 김포시 대곶면 율생로 570', '정매니저', '031-222-3333', 2, '100x150mm', '사전 입고예약 필수'),
('CP-FC-03', '쿠팡 곤지암센터', '쿠팡', 'FC', 'KR', '12753', '경기도 광주시 곤지암읍 경충대로 1274', '송실장', '031-333-4444', 2, '100x150mm', 'ASN 필수');

-- 이마트 점포들
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days, label_format) VALUES
('EM-0345', '이마트 죽전점', '이마트', '점포', 'KR', '16896', '경기도 용인시 수지구 포은대로 552', '강점장', '031-444-5555', 1, 'A4'),
('EM-0123', '이마트 월계점', '이마트', '점포', 'KR', '01830', '서울특별시 노원구 동일로 1688', '한부장', '02-555-6666', 1, 'A4');

-- YBK (국내 주요 고객사)
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days) VALUES
('YBK-HQ-001', 'YBK 본사 물류센터', 'YBK', '센터', 'KR', '13487', '경기도 성남시 분당구 판교역로 235', '박대리', '031-666-7777', 1),
('YBK-BS-001', 'YBK 부산 지점', 'YBK', '지점', 'KR', '48732', '부산광역시 동구 중앙대로 206', '최과장', '051-777-8888', 2);

-- 해외 고객사 - JT (중국)
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days, delivery_note) VALUES
('JT-CN-SH01', 'JT 상하이 창고', 'JT', '센터', 'CN', '200000', '上海市浦东新区张江高科技园区', 'Zhang Wei', '+86-21-1234-5678', 5, '통관서류 필수, 영문/중문 라벨'),
('JT-CN-BJ01', 'JT 베이징 센터', 'JT', '센터', 'CN', '100000', '北京市朝阳区建国路88号', 'Li Ming', '+86-10-8888-9999', 5, 'HS Code 표기 필수');

-- 해외 고객사 - CK (중국)
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days, delivery_note) VALUES
('CK-CN-GZ01', 'CK 광저우 물류센터', 'CK', 'FC', 'CN', '510000', '广州市天河区珠江新城花城大道', 'Wang Fang', '+86-20-3333-4444', 5, '중국 통관 필수'),
('CK-CN-SZ01', 'CK 선전 센터', 'CK', 'FC', 'CN', '518000', '深圳市南山区科技园南区', 'Chen Lei', '+86-755-5555-6666', 5, 'CE 인증 확인 필요');

-- WMG 부품센터/정비센터
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days) VALUES
('WMG-PC-01', 'WMG 부품센터 (본사)', 'WMG', '센터', 'KR', '06774', '서울특별시 서초구 서초대로 396', '윤부장', '02-888-9999', 1),
('WMG-SC-IC', 'WMG 인천 정비센터', 'WMG', '센터', 'KR', '21698', '인천광역시 남동구 남동서로 155', '권실장', '032-999-0000', 1);

-- 통관처/보세구역
INSERT INTO destinations (destination_code, name, channel, type, country, postal_code, address, contact_name, contact_phone, lead_time_days, delivery_note) VALUES
('CUST-ICN-01', '인천공항 보세구역 1호', '통관처', '기타', 'KR', '22382', '인천광역시 중구 공항동로 295', '관세사무소', '032-741-1234', 3, '통관서류 사전 제출 필수'),
('CUST-PUS-01', '부산항 보세구역', '통관처', '기타', 'KR', '48734', '부산광역시 동구 자성로 125', '부산세관', '051-620-1234', 3, '선적서류 동봉 필수');

-- =====================================================
-- 함수: 다수지 코드 자동 생성
-- =====================================================
CREATE OR REPLACE FUNCTION generate_destination_code(
    p_channel TEXT,
    p_type TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_counter INTEGER;
    v_new_code TEXT;
BEGIN
    -- 채널별 약어 생성
    v_prefix := CASE 
        WHEN p_channel = '올리브영' THEN 'OLY'
        WHEN p_channel = '쿠팡' THEN 'CP'
        WHEN p_channel = '이마트' THEN 'EM'
        WHEN p_channel = 'YBK' THEN 'YBK'
        WHEN p_channel = 'JT' THEN 'JT'
        WHEN p_channel = 'CK' THEN 'CK'
        WHEN p_channel = 'WMG' THEN 'WMG'
        ELSE UPPER(LEFT(p_channel, 3))
    END;
    
    -- 기존 코드 중 최대 번호 찾기
    SELECT COALESCE(MAX(
        CAST(RIGHT(destination_code, 3) AS INTEGER)
    ), 0) + 1
    INTO v_counter
    FROM destinations
    WHERE destination_code LIKE v_prefix || '%';
    
    -- 새 코드 생성
    v_new_code := v_prefix || '-' || LPAD(v_counter::TEXT, 3, '0');
    
    RETURN v_new_code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 통계 함수
-- =====================================================
CREATE OR REPLACE FUNCTION get_destinations_stats()
RETURNS TABLE(
    total_destinations BIGINT,
    active_destinations BIGINT,
    by_channel JSONB,
    by_type JSONB,
    by_country JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_destinations,
        COUNT(*) FILTER (WHERE active = true)::BIGINT as active_destinations,
        jsonb_object_agg(channel, cnt) as by_channel,
        jsonb_object_agg(type, cnt) as by_type,
        jsonb_object_agg(country, cnt) as by_country
    FROM (
        SELECT
            COALESCE(channel, 'Unknown') as channel,
            COALESCE(type, 'Unknown') as type,
            COALESCE(country, 'Unknown') as country,
            active,
            COUNT(*) as cnt
        FROM destinations
        GROUP BY channel, type, country, active
    ) stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE destinations IS '다수지(납품처/수령지) 마스터 - 출고 시 배송지 자동화를 위한 코드 관리';
COMMENT ON COLUMN destinations.destination_code IS '다수지 고유 코드 (예: OLY-SD-0134)';
COMMENT ON COLUMN destinations.restrictions IS '납품 조건/규격 (팔레트, 라벨, 시간대 등)';
COMMENT ON COLUMN destinations.label_format IS '라벨 출력 포맷 규격';

