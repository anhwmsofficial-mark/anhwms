-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 11_external_quote_inquiry.sql - 외부 견적 문의 테이블
-- ====================================================================
-- 목적: 웹폼을 통해 접수되는 국내 풀필먼트(AN) 견적/상담 요청 저장
-- 실행 순서: 11번 (10_check_migration_status.sql 이후)
-- 의존성: 없음
-- ====================================================================

CREATE TABLE IF NOT EXISTS external_quote_inquiry (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 기본 정보
  company_name            TEXT NOT NULL,
  contact_name            TEXT NOT NULL,
  email                   TEXT NOT NULL,
  phone                   TEXT,

  -- 월 출고량 구간 (라디오 버튼 값)
  monthly_outbound_range  TEXT NOT NULL CHECK (
    monthly_outbound_range IN (
      '0_1000',
      '1000_2000',
      '2000_3000',
      '3000_5000',
      '5000_10000',
      '10000_30000',
      '30000_plus'
    )
  ),

  sku_count               INTEGER,

  -- 복수 선택 필드 (체크박스)
  product_categories      TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  extra_services          TEXT[] NOT NULL DEFAULT '{}'::TEXT[],

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

COMMENT ON TABLE external_quote_inquiry IS '외부(웹) 견적/상담 문의 저장 테이블';
COMMENT ON COLUMN external_quote_inquiry.monthly_outbound_range IS '월 출고량 구간- 프론트 라디오 버튼 값';
COMMENT ON COLUMN external_quote_inquiry.product_categories IS '관심 상품군 (복수 선택)';
COMMENT ON COLUMN external_quote_inquiry.extra_services IS '필요한 추가 작업 목록 (복수 선택)';
COMMENT ON COLUMN external_quote_inquiry.status IS '영업 진행 상태 (new/in_progress/quoted/closed)';
COMMENT ON COLUMN external_quote_inquiry.source IS '리드 유입 경로 (기본 web_form)';

-- 조회 최적화용 인덱스
CREATE INDEX IF NOT EXISTS idx_external_quote_inquiry_created_at ON external_quote_inquiry(created_at);
CREATE INDEX IF NOT EXISTS idx_external_quote_inquiry_status ON external_quote_inquiry(status);
CREATE INDEX IF NOT EXISTS idx_external_quote_inquiry_source ON external_quote_inquiry(source);

-- ====================================================================
-- 완료 메시지
-- ====================================================================
SELECT 'external_quote_inquiry 테이블 생성 완료' AS status;

