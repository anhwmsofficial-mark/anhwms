-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 12_international_quote_inquiry.sql - 해외배송 견적 문의 테이블
-- ====================================================================
-- 목적: 웹폼을 통해 접수되는 해외배송/크로스보더(AH) 견적 요청 저장
-- 실행 순서: 12번 (11_external_quote_inquiry.sql 이후)
-- 의존성: 없음
-- ====================================================================

CREATE TABLE IF NOT EXISTS international_quote_inquiry (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 기본 정보
  company_name            TEXT NOT NULL,
  contact_name            TEXT NOT NULL,
  email                   TEXT NOT NULL,
  phone                   TEXT,

  -- 목적지 국가 (복수 선택 가능)
  destination_countries   TEXT[] NOT NULL DEFAULT '{}'::TEXT[],

  -- 배송 방식
  shipping_method         TEXT CHECK (
    shipping_method IN (
      'air',           -- 일반 항공
      'express',       -- 특송
      'sea',           -- 해상
      'combined'       -- 복합 운송
    )
  ),

  -- 월 발송량
  monthly_shipment_volume TEXT NOT NULL CHECK (
    monthly_shipment_volume IN (
      '0_100',
      '100_500',
      '500_1000',
      '1000_3000',
      '3000_plus'
    )
  ),

  -- 평균 박스 무게 (kg)
  avg_box_weight          NUMERIC,

  -- SKU 수량
  sku_count               INTEGER,

  -- 상품군 (복수 선택)
  product_categories      TEXT[] NOT NULL DEFAULT '{}'::TEXT[],

  -- 상품 특성 (복수 선택)
  product_characteristics TEXT[] NOT NULL DEFAULT '{}'::TEXT[],

  -- 통관 지원 필요 여부
  customs_support_needed  BOOLEAN DEFAULT false,

  -- 무역 조건
  trade_terms             TEXT CHECK (
    trade_terms IN ('FOB', 'DDP', 'EXW', 'CIF', 'not_sure')
  ),

  -- 추가 메모
  memo                    TEXT,

  -- 내부 관리용
  status                  TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN (
      'new',
      'in_progress',
      'quoted',
      'closed_won',
      'closed_lost'
    )
  ),
  owner_user_id           UUID,
  source                  TEXT NOT NULL DEFAULT 'web_form'
);

COMMENT ON TABLE international_quote_inquiry IS '해외배송/크로스보더(AH) 견적 문의 저장 테이블';
COMMENT ON COLUMN international_quote_inquiry.destination_countries IS '목적지 국가 목록 (복수 선택)';
COMMENT ON COLUMN international_quote_inquiry.shipping_method IS '배송 방식 (항공/특송/해상/복합)';
COMMENT ON COLUMN international_quote_inquiry.monthly_shipment_volume IS '월 평균 발송량 구간';
COMMENT ON COLUMN international_quote_inquiry.product_characteristics IS '상품 특성 (위험물, 냉장/냉동, 고가품 등)';
COMMENT ON COLUMN international_quote_inquiry.customs_support_needed IS '통관 지원 필요 여부';
COMMENT ON COLUMN international_quote_inquiry.trade_terms IS '무역 조건 (FOB/DDP/EXW/CIF)';

-- 조회 최적화용 인덱스
CREATE INDEX IF NOT EXISTS idx_international_quote_inquiry_created_at ON international_quote_inquiry(created_at);
CREATE INDEX IF NOT EXISTS idx_international_quote_inquiry_status ON international_quote_inquiry(status);
CREATE INDEX IF NOT EXISTS idx_international_quote_inquiry_source ON international_quote_inquiry(source);

-- ====================================================================
-- 완료 메시지
-- ====================================================================
SELECT 'international_quote_inquiry 테이블 생성 완료' AS status;

