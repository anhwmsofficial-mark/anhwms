-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 13_customer_enhancement.sql - 거래처 관리 고도화
-- ====================================================================
-- 목적: 거래처 관리 기능 확장 (담당자, 관계, 가격, 계약, 활동 이력)
-- 실행 순서: 13번 (12_international_quote_inquiry.sql 이후)
-- 의존성: customer_master, external_quote_inquiry, international_quote_inquiry
-- ====================================================================

-- ====================================================================
-- 1. 거래처 유형(Type) 확장
-- ====================================================================

-- 기존 constraint 제거
ALTER TABLE customer_master DROP CONSTRAINT IF EXISTS customer_master_type_check;

-- 새로운 거래처 유형으로 확장
ALTER TABLE customer_master 
ADD CONSTRAINT customer_master_type_check CHECK (
  type IN (
    -- 고객사 (수익 발생)
    'CLIENT_BRAND',           -- 브랜드 화주
    'CLIENT_AGENCY',          -- 대행사
    'CLIENT_MULTI_BRAND',     -- 멀티브랜드 운영사
    
    -- 공급사 (비용 발생)
    'SUPPLIER_MATERIAL',      -- 원자재 공급업체
    'SUPPLIER_PACKAGING',     -- 포장재 공급업체
    
    -- 물류 파트너
    'PARTNER_CARRIER',        -- 택배사/운송사
    'PARTNER_FORWARDER',      -- 포워더
    'PARTNER_WAREHOUSE',      -- 창고 임대/운영사
    'PARTNER_CUSTOMS',        -- 통관업체
    
    -- 기타
    'PROSPECT',               -- 잠재고객 (견적 단계)
    'COMPETITOR',             -- 경쟁사
    'END_CUSTOMER',           -- 최종 소비자 (B2C)
    
    -- 하위 호환성 유지
    'DIRECT_BRAND',
    'AGENCY',
    'MULTI_BRAND',
    'FORWARDER',
    'LOGISTICS_PARTNER'
  )
);

COMMENT ON COLUMN customer_master.type IS '거래처 유형: CLIENT_* (고객사), SUPPLIER_* (공급사), PARTNER_* (파트너), PROSPECT (잠재고객)';

-- ====================================================================
-- 2. 거래처 담당자 테이블 (Customer Contact)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customer_contact (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_master_id    UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  
  -- 담당자 기본 정보
  name                  TEXT NOT NULL,
  title                 TEXT,           -- 직책 (예: 대표이사, 부장, 과장)
  department            TEXT,           -- 부서 (예: 영업팀, 물류팀, 재무팀)
  
  -- 역할 구분
  role                  TEXT NOT NULL CHECK (
    role IN (
      'PRIMARY',          -- 주 담당자
      'SALES',            -- 영업 담당
      'OPERATION',        -- 운영 담당
      'FINANCE',          -- 재무 담당
      'TECHNICAL',        -- 기술 담당
      'LEGAL',            -- 법무 담당
      'CS',               -- 고객 서비스
      'OTHER'             -- 기타
    )
  ),
  
  -- 연락처 정보
  email                 TEXT,
  phone                 TEXT,
  mobile                TEXT,
  fax                   TEXT,
  
  -- 선호 연락 방법
  preferred_contact     TEXT DEFAULT 'EMAIL' CHECK (
    preferred_contact IN ('EMAIL', 'PHONE', 'SMS', 'KAKAO', 'WECHAT', 'LINE')
  ),
  
  -- 근무 정보
  work_hours            TEXT,           -- 근무 시간 (예: "09:00-18:00")
  timezone              TEXT DEFAULT 'Asia/Seoul',
  language              TEXT DEFAULT 'ko',
  
  -- 상태
  is_primary            BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  
  -- 추가 정보
  birthday              DATE,           -- 생일 (관계 관리용)
  note                  TEXT,
  metadata              JSONB DEFAULT '{}'::JSONB,
  
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE customer_contact IS '거래처 담당자 테이블 (여러 담당자 관리)';
COMMENT ON COLUMN customer_contact.role IS '담당자 역할: PRIMARY (주담당), SALES (영업), OPERATION (운영), FINANCE (재무) 등';
COMMENT ON COLUMN customer_contact.is_primary IS '주 담당자 여부 (거래처당 1명 권장)';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_contact_customer_id ON customer_contact(customer_master_id);
CREATE INDEX IF NOT EXISTS idx_customer_contact_role ON customer_contact(role);
CREATE INDEX IF NOT EXISTS idx_customer_contact_is_primary ON customer_contact(is_primary);
CREATE INDEX IF NOT EXISTS idx_customer_contact_is_active ON customer_contact(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_contact_email ON customer_contact(email);

-- 기존 customer_master의 contact 정보를 customer_contact로 마이그레이션
INSERT INTO customer_contact (
  customer_master_id, 
  name, 
  email, 
  phone, 
  role, 
  is_primary, 
  is_active
)
SELECT 
  id, 
  contact_name, 
  contact_email, 
  contact_phone, 
  'PRIMARY', 
  TRUE, 
  TRUE
FROM customer_master
WHERE contact_name IS NOT NULL 
  AND contact_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM customer_contact 
    WHERE customer_contact.customer_master_id = customer_master.id
  )
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 3. 거래처 관계 관리 테이블 (Customer Relationship)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customer_relationship (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_customer_id    UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  child_customer_id     UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  
  -- 관계 유형
  relationship_type     TEXT NOT NULL CHECK (
    relationship_type IN (
      'PARENT_SUBSIDIARY',    -- 모회사-자회사
      'AGENCY_CLIENT',        -- 대행사-고객사
      'PRIME_SUB',            -- 원청-하청
      'PARTNERSHIP',          -- 협력관계
      'REFERRAL',             -- 소개/추천
      'AFFILIATED',           -- 계열사
      'FRANCHISEE',           -- 가맹점
      'RESELLER'              -- 리셀러
    )
  ),
  
  -- 유효 기간
  effective_from        DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to          DATE,
  is_active             BOOLEAN DEFAULT TRUE,
  
  -- 추가 정보
  relationship_strength TEXT CHECK (
    relationship_strength IN ('STRONG', 'MEDIUM', 'WEAK')
  ),
  
  note                  TEXT,
  metadata              JSONB DEFAULT '{}'::JSONB,
  
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  
  -- 중복 방지
  UNIQUE (parent_customer_id, child_customer_id, relationship_type),
  
  -- 자기 자신과의 관계 방지
  CHECK (parent_customer_id != child_customer_id)
);

COMMENT ON TABLE customer_relationship IS '거래처 간 관계 관리 (모자회사, 대행사-고객, 파트너십 등)';
COMMENT ON COLUMN customer_relationship.relationship_type IS '관계 유형: PARENT_SUBSIDIARY, AGENCY_CLIENT, PRIME_SUB, PARTNERSHIP 등';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_relationship_parent ON customer_relationship(parent_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_relationship_child ON customer_relationship(child_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_relationship_type ON customer_relationship(relationship_type);
CREATE INDEX IF NOT EXISTS idx_customer_relationship_active ON customer_relationship(is_active);

-- ====================================================================
-- 4. 거래처 가격 정책 테이블 (Customer Pricing)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customer_pricing (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_master_id      UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  org_id                  UUID REFERENCES org(id),  -- AN/AH 구분
  
  -- 가격 유형
  pricing_type            TEXT NOT NULL CHECK (
    pricing_type IN (
      'STORAGE',            -- 보관료
      'INBOUND',            -- 입고 수수료
      'OUTBOUND',           -- 출고 수수료
      'PACKING',            -- 포장 작업료
      'LABELING',           -- 라벨링
      'KITTING',            -- 세트 구성 (키팅)
      'RETURNS',            -- 반품 처리
      'INSPECTION',         -- 검수
      'REPACKAGING',        -- 재포장 (지아미)
      'SPECIAL_SERVICE',    -- 특별 서비스
      'SHIPPING_DOMESTIC',  -- 국내 배송료
      'SHIPPING_INTL',      -- 해외 배송료
      'CUSTOMS',            -- 통관 수수료
      'WAREHOUSING'         -- 창고 임대료
    )
  ),
  
  -- 서비스 상세
  service_name            TEXT,           -- 서비스명 (예: "에어캡 포장", "선물 포장")
  service_code            TEXT,           -- 서비스 코드
  
  -- 가격 정보
  unit_price              NUMERIC(12, 2) NOT NULL,
  currency                TEXT DEFAULT 'KRW',
  unit                    TEXT NOT NULL,  -- EA / BOX / PALLET / CBM / KG / DAY
  
  -- 최소/최대 수량
  min_quantity            NUMERIC,
  max_quantity            NUMERIC,
  
  -- 유효 기간
  effective_from          DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to            DATE,
  
  -- 볼륨 할인
  volume_discount_rate    NUMERIC(5, 2),  -- 퍼센트 (예: 10.5%)
  volume_threshold        NUMERIC,        -- 할인 적용 기준 수량
  
  -- 부가 조건
  requires_approval       BOOLEAN DEFAULT FALSE,  -- 승인 필요 여부
  
  -- 상태
  is_active               BOOLEAN DEFAULT TRUE,
  
  note                    TEXT,
  metadata                JSONB DEFAULT '{}'::JSONB,
  
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE customer_pricing IS '거래처별 가격/요율 정책 관리';
COMMENT ON COLUMN customer_pricing.pricing_type IS '가격 유형: STORAGE (보관), INBOUND (입고), OUTBOUND (출고), PACKING (포장) 등';
COMMENT ON COLUMN customer_pricing.volume_discount_rate IS '볼륨 할인율 (%)';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_pricing_customer_id ON customer_pricing(customer_master_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_org_id ON customer_pricing(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_type ON customer_pricing(pricing_type);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_effective ON customer_pricing(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_active ON customer_pricing(is_active);

-- ====================================================================
-- 5. 거래처 계약 관리 테이블 (Customer Contract)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customer_contract (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_master_id      UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  
  -- 계약 기본 정보
  contract_no             TEXT UNIQUE NOT NULL,
  contract_name           TEXT NOT NULL,
  contract_type           TEXT NOT NULL CHECK (
    contract_type IN (
      'SERVICE_AGREEMENT',    -- 서비스 계약
      'MASTER_AGREEMENT',     -- 기본 계약서
      'NDA',                  -- 비밀유지계약
      'SLA',                  -- 서비스 수준 계약
      'PRICING_AGREEMENT',    -- 가격 계약
      'AMENDMENT',            -- 계약 변경/추가
      'LEASE',                -- 임대 계약
      'PARTNERSHIP'           -- 파트너십 계약
    )
  ),
  
  -- 계약 기간
  contract_start          DATE NOT NULL,
  contract_end            DATE,
  auto_renewal            BOOLEAN DEFAULT FALSE,
  renewal_notice_days     INTEGER DEFAULT 30,      -- 갱신 통지 기한 (일)
  renewal_count           INTEGER DEFAULT 0,       -- 갱신 횟수
  
  -- 계약 금액
  contract_amount         NUMERIC(15, 2),
  currency                TEXT DEFAULT 'KRW',
  
  -- 결제 조건
  payment_terms           INTEGER DEFAULT 30,      -- 결제 기한 (일)
  payment_method          TEXT,                    -- 결제 방법 (계좌이체, 카드 등)
  billing_cycle           TEXT DEFAULT 'MONTHLY' CHECK (
    billing_cycle IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME')
  ),
  
  -- SLA 조건
  sla_inbound_processing  INTEGER,                 -- 입고 처리 기준 (시간)
  sla_outbound_cutoff     TIME,                    -- 출고 마감 시간
  sla_accuracy_rate       NUMERIC(5, 2),           -- 정확도 목표 (%)
  sla_ontime_ship_rate    NUMERIC(5, 2),           -- 정시 출고율 목표 (%)
  
  -- 계약서 파일
  contract_file_url       TEXT,                    -- 계약서 파일 URL
  contract_file_name      TEXT,                    -- 파일명
  signed_date             DATE,                    -- 계약 체결일
  signed_by_customer      TEXT,                    -- 고객사 서명자
  signed_by_company       TEXT,                    -- 자사 서명자
  
  -- 상태
  status                  TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',              -- 초안
      'PENDING_REVIEW',     -- 검토 중
      'PENDING_APPROVAL',   -- 승인 대기
      'ACTIVE',             -- 활성
      'EXPIRING_SOON',      -- 만료 임박
      'EXPIRED',            -- 만료
      'TERMINATED',         -- 해지
      'RENEWED'             -- 갱신됨 (새 계약으로 대체)
    )
  ),
  
  -- 추적 정보
  parent_contract_id      UUID REFERENCES customer_contract(id),  -- 이전 계약 (갱신의 경우)
  replaced_by_contract_id UUID REFERENCES customer_contract(id),  -- 대체한 계약
  
  -- 해지 정보
  termination_reason      TEXT,
  termination_date        DATE,
  termination_notice_date DATE,                    -- 해지 통보일
  
  -- 리마인더
  reminder_sent           BOOLEAN DEFAULT FALSE,
  reminder_sent_at        TIMESTAMPTZ,
  
  note                    TEXT,
  metadata                JSONB DEFAULT '{}'::JSONB,
  
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE customer_contract IS '거래처 계약 관리 (서비스 계약, SLA, NDA 등)';
COMMENT ON COLUMN customer_contract.contract_type IS '계약 유형: SERVICE_AGREEMENT, MASTER_AGREEMENT, NDA, SLA 등';
COMMENT ON COLUMN customer_contract.auto_renewal IS '자동 갱신 여부';
COMMENT ON COLUMN customer_contract.parent_contract_id IS '이전 계약 ID (계약 갱신의 경우)';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_contract_customer_id ON customer_contract(customer_master_id);
CREATE INDEX IF NOT EXISTS idx_customer_contract_no ON customer_contract(contract_no);
CREATE INDEX IF NOT EXISTS idx_customer_contract_status ON customer_contract(status);
CREATE INDEX IF NOT EXISTS idx_customer_contract_dates ON customer_contract(contract_start, contract_end);
CREATE INDEX IF NOT EXISTS idx_customer_contract_type ON customer_contract(contract_type);
CREATE INDEX IF NOT EXISTS idx_customer_contract_expiring ON customer_contract(contract_end) 
  WHERE status = 'ACTIVE' AND contract_end IS NOT NULL;

-- ====================================================================
-- 6. 거래처 활동 이력 테이블 (Customer Activity)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customer_activity (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_master_id    UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  
  -- 활동 유형
  activity_type         TEXT NOT NULL CHECK (
    activity_type IN (
      'CALL',             -- 전화 통화
      'EMAIL',            -- 이메일
      'MEETING',          -- 미팅
      'SITE_VISIT',       -- 현장 방문
      'VIDEO_CALL',       -- 화상 회의
      'ISSUE',            -- 이슈 발생
      'COMPLAINT',        -- 클레임/컴플레인
      'FEEDBACK',         -- 피드백
      'QUOTE_SENT',       -- 견적서 발송
      'CONTRACT_SIGNED',  -- 계약 체결
      'NOTE',             -- 일반 메모
      'TASK',             -- 작업/할일
      'REMINDER'          -- 리마인더
    )
  ),
  
  -- 활동 내용
  subject               TEXT NOT NULL,
  description           TEXT,
  
  -- 관련 정보
  related_contact_id    UUID REFERENCES customer_contact(id),    -- 관련 담당자
  performed_by_user_id  UUID,                                     -- 수행한 직원 (추후 users 테이블과 연결)
  
  -- 중요도
  priority              TEXT DEFAULT 'NORMAL' CHECK (
    priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')
  ),
  
  -- 후속 조치
  requires_followup     BOOLEAN DEFAULT FALSE,
  followup_due_date     DATE,
  followup_completed    BOOLEAN DEFAULT FALSE,
  followup_completed_at TIMESTAMPTZ,
  
  -- 첨부 파일
  attachment_urls       TEXT[],                                   -- 첨부 파일 URL 배열
  
  -- 태그
  tags                  TEXT[],                                   -- 태그 배열 (예: ['긴급', '계약', '클레임'])
  
  -- 시간 정보
  activity_date         TIMESTAMPTZ DEFAULT now(),
  duration_minutes      INTEGER,                                  -- 소요 시간 (분)
  
  -- 메타데이터
  metadata              JSONB DEFAULT '{}'::JSONB,
  
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE customer_activity IS '거래처 활동 이력 (통화, 미팅, 이슈, 클레임 등 모든 소통 기록)';
COMMENT ON COLUMN customer_activity.activity_type IS '활동 유형: CALL, EMAIL, MEETING, ISSUE, COMPLAINT 등';
COMMENT ON COLUMN customer_activity.requires_followup IS '후속 조치 필요 여부';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_activity_customer_id ON customer_activity(customer_master_id);
CREATE INDEX IF NOT EXISTS idx_customer_activity_type ON customer_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_customer_activity_date ON customer_activity(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activity_contact ON customer_activity(related_contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_activity_followup ON customer_activity(requires_followup, followup_completed)
  WHERE requires_followup = TRUE;
CREATE INDEX IF NOT EXISTS idx_customer_activity_priority ON customer_activity(priority);

-- GIN 인덱스 (태그 검색용)
CREATE INDEX IF NOT EXISTS idx_customer_activity_tags ON customer_activity USING GIN(tags);

-- ====================================================================
-- 7. 견적 문의 → 거래처 전환 연결
-- ====================================================================

-- external_quote_inquiry 테이블에 거래처 전환 관련 컬럼 추가
DO $$
BEGIN
  -- converted_customer_id 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='converted_customer_id'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN converted_customer_id UUID REFERENCES customer_master(id);
  END IF;
  
  -- converted_at 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='converted_at'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN converted_at TIMESTAMPTZ;
  END IF;
  
  -- sales_stage 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='sales_stage'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN sales_stage TEXT DEFAULT 'LEAD';
  END IF;
  
  -- sales_stage에 CHECK constraint 추가
  ALTER TABLE external_quote_inquiry DROP CONSTRAINT IF EXISTS external_quote_inquiry_sales_stage_check;
  ALTER TABLE external_quote_inquiry 
  ADD CONSTRAINT external_quote_inquiry_sales_stage_check CHECK (
    sales_stage IN (
      'LEAD',           -- 리드 (초기 문의)
      'QUALIFIED',      -- 적격 검증됨
      'PROPOSAL',       -- 제안 단계
      'NEGOTIATION',    -- 협상 중
      'WON',            -- 수주 (거래처 전환)
      'LOST'            -- 실주
    )
  );
  
  -- assigned_to 추가 (담당 영업)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='assigned_to'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN assigned_to UUID;  -- 담당 영업 직원 ID
  END IF;
  
  -- expected_revenue 추가 (예상 매출)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='expected_revenue'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN expected_revenue NUMERIC(15, 2);
  END IF;
  
  -- win_probability 추가 (성사 확률)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='win_probability'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN win_probability NUMERIC(5, 2);  -- 0~100%
  END IF;
  
  -- lost_reason 추가 (실주 사유)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='lost_reason'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN lost_reason TEXT;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_external_quote_converted_customer ON external_quote_inquiry(converted_customer_id);
CREATE INDEX IF NOT EXISTS idx_external_quote_sales_stage ON external_quote_inquiry(sales_stage);
CREATE INDEX IF NOT EXISTS idx_external_quote_assigned_to ON external_quote_inquiry(assigned_to);

COMMENT ON COLUMN external_quote_inquiry.converted_customer_id IS '전환된 거래처 ID (수주 시)';
COMMENT ON COLUMN external_quote_inquiry.sales_stage IS '영업 단계: LEAD → QUALIFIED → PROPOSAL → NEGOTIATION → WON/LOST';
COMMENT ON COLUMN external_quote_inquiry.win_probability IS '성사 확률 (0~100%)';

-- international_quote_inquiry 테이블도 동일하게 수정 (테이블 존재 시에만)
DO $$
BEGIN
  -- 먼저 테이블이 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'international_quote_inquiry'
  ) THEN
    
    -- converted_customer_id 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='international_quote_inquiry' AND column_name='converted_customer_id'
    ) THEN
      ALTER TABLE international_quote_inquiry 
      ADD COLUMN converted_customer_id UUID REFERENCES customer_master(id);
    END IF;
    
    -- converted_at 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='international_quote_inquiry' AND column_name='converted_at'
    ) THEN
      ALTER TABLE international_quote_inquiry 
      ADD COLUMN converted_at TIMESTAMPTZ;
    END IF;
    
    -- sales_stage 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='international_quote_inquiry' AND column_name='sales_stage'
    ) THEN
      ALTER TABLE international_quote_inquiry 
      ADD COLUMN sales_stage TEXT DEFAULT 'LEAD';
    END IF;
    
    -- sales_stage CHECK constraint 추가
    ALTER TABLE international_quote_inquiry DROP CONSTRAINT IF EXISTS international_quote_inquiry_sales_stage_check;
    ALTER TABLE international_quote_inquiry 
    ADD CONSTRAINT international_quote_inquiry_sales_stage_check CHECK (
      sales_stage IN ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST')
    );
    
    -- assigned_to 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='international_quote_inquiry' AND column_name='assigned_to'
    ) THEN
      ALTER TABLE international_quote_inquiry 
      ADD COLUMN assigned_to UUID;
    END IF;
    
    -- expected_revenue 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='international_quote_inquiry' AND column_name='expected_revenue'
    ) THEN
      ALTER TABLE international_quote_inquiry 
      ADD COLUMN expected_revenue NUMERIC(15, 2);
    END IF;
    
    -- win_probability 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='international_quote_inquiry' AND column_name='win_probability'
    ) THEN
      ALTER TABLE international_quote_inquiry 
      ADD COLUMN win_probability NUMERIC(5, 2);
    END IF;
    
    -- lost_reason 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='international_quote_inquiry' AND column_name='lost_reason'
    ) THEN
      ALTER TABLE international_quote_inquiry 
      ADD COLUMN lost_reason TEXT;
    END IF;
    
    -- 인덱스 생성
    CREATE INDEX IF NOT EXISTS idx_international_quote_converted_customer ON international_quote_inquiry(converted_customer_id);
    CREATE INDEX IF NOT EXISTS idx_international_quote_sales_stage ON international_quote_inquiry(sales_stage);
    CREATE INDEX IF NOT EXISTS idx_international_quote_assigned_to ON international_quote_inquiry(assigned_to);
    
    RAISE NOTICE 'international_quote_inquiry 테이블 확장 완료';
  ELSE
    RAISE NOTICE 'international_quote_inquiry 테이블이 존재하지 않습니다. 스킵합니다.';
  END IF;
END $$;

-- ====================================================================
-- 8. RLS (Row Level Security) 정책
-- ====================================================================

-- customer_contact
ALTER TABLE customer_contact ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON customer_contact;
DROP POLICY IF EXISTS "Enable insert for all users" ON customer_contact;
DROP POLICY IF EXISTS "Enable update for all users" ON customer_contact;
DROP POLICY IF EXISTS "Enable delete for all users" ON customer_contact;

CREATE POLICY "Enable read access for all users" ON customer_contact FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON customer_contact FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON customer_contact FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON customer_contact FOR DELETE USING (true);

-- customer_relationship
ALTER TABLE customer_relationship ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON customer_relationship;
DROP POLICY IF EXISTS "Enable insert for all users" ON customer_relationship;
DROP POLICY IF EXISTS "Enable update for all users" ON customer_relationship;
DROP POLICY IF EXISTS "Enable delete for all users" ON customer_relationship;

CREATE POLICY "Enable read access for all users" ON customer_relationship FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON customer_relationship FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON customer_relationship FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON customer_relationship FOR DELETE USING (true);

-- customer_pricing
ALTER TABLE customer_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON customer_pricing;
DROP POLICY IF EXISTS "Enable insert for all users" ON customer_pricing;
DROP POLICY IF EXISTS "Enable update for all users" ON customer_pricing;
DROP POLICY IF EXISTS "Enable delete for all users" ON customer_pricing;

CREATE POLICY "Enable read access for all users" ON customer_pricing FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON customer_pricing FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON customer_pricing FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON customer_pricing FOR DELETE USING (true);

-- customer_contract
ALTER TABLE customer_contract ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON customer_contract;
DROP POLICY IF EXISTS "Enable insert for all users" ON customer_contract;
DROP POLICY IF EXISTS "Enable update for all users" ON customer_contract;
DROP POLICY IF EXISTS "Enable delete for all users" ON customer_contract;

CREATE POLICY "Enable read access for all users" ON customer_contract FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON customer_contract FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON customer_contract FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON customer_contract FOR DELETE USING (true);

-- customer_activity
ALTER TABLE customer_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON customer_activity;
DROP POLICY IF EXISTS "Enable insert for all users" ON customer_activity;
DROP POLICY IF EXISTS "Enable update for all users" ON customer_activity;
DROP POLICY IF EXISTS "Enable delete for all users" ON customer_activity;

CREATE POLICY "Enable read access for all users" ON customer_activity FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON customer_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON customer_activity FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON customer_activity FOR DELETE USING (true);

-- ====================================================================
-- 9. 샘플 데이터
-- ====================================================================

-- 샘플 담당자 추가 (YBK 거래처)
INSERT INTO customer_contact (
  customer_master_id,
  name,
  title,
  department,
  role,
  email,
  phone,
  mobile,
  is_primary
)
SELECT 
  cm.id,
  '김영희',
  '대표이사',
  '경영지원팀',
  'PRIMARY',
  'kim@ybk.com',
  '02-1234-5678',
  '010-1234-5678',
  TRUE
FROM customer_master cm
WHERE cm.code = 'YBK'
  AND NOT EXISTS (
    SELECT 1 FROM customer_contact cc 
    WHERE cc.customer_master_id = cm.id AND cc.email = 'kim@ybk.com'
  )
ON CONFLICT DO NOTHING;

-- 샘플 가격 정책 추가
INSERT INTO customer_pricing (
  customer_master_id,
  pricing_type,
  service_name,
  unit_price,
  currency,
  unit,
  effective_from
)
SELECT 
  cm.id,
  'OUTBOUND',
  '기본 출고 수수료',
  1500.00,
  'KRW',
  'EA',
  CURRENT_DATE
FROM customer_master cm
WHERE cm.code = 'YBK'
  AND NOT EXISTS (
    SELECT 1 FROM customer_pricing cp 
    WHERE cp.customer_master_id = cm.id AND cp.pricing_type = 'OUTBOUND'
  )
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 10. 유용한 뷰(View) 생성
-- ====================================================================

-- 거래처 전체 정보 뷰 (담당자 포함)
CREATE OR REPLACE VIEW v_customer_with_contacts AS
SELECT 
  cm.*,
  json_agg(
    json_build_object(
      'contact_id', cc.id,
      'name', cc.name,
      'role', cc.role,
      'email', cc.email,
      'phone', cc.phone,
      'is_primary', cc.is_primary
    ) ORDER BY cc.is_primary DESC, cc.created_at
  ) FILTER (WHERE cc.id IS NOT NULL) as contacts
FROM customer_master cm
LEFT JOIN customer_contact cc ON cm.id = cc.customer_master_id AND cc.is_active = TRUE
GROUP BY cm.id;

COMMENT ON VIEW v_customer_with_contacts IS '거래처 정보 + 담당자 목록 (JSON)';

-- 활성 계약 현황 뷰
CREATE OR REPLACE VIEW v_active_contracts AS
SELECT 
  cc.*,
  cm.name as customer_name,
  cm.code as customer_code,
  cm.type as customer_type,
  CASE 
    WHEN cc.contract_end < CURRENT_DATE THEN 'EXPIRED'
    WHEN cc.contract_end <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
    ELSE cc.status
  END as contract_status_computed,
  (cc.contract_end - CURRENT_DATE) as days_until_expiry
FROM customer_contract cc
JOIN customer_master cm ON cc.customer_master_id = cm.id
WHERE cc.status = 'ACTIVE'
ORDER BY cc.contract_end ASC NULLS LAST;

COMMENT ON VIEW v_active_contracts IS '활성 계약 현황 (만료 임박 계약 자동 표시)';

-- 견적 문의 → 거래처 전환 현황 뷰 (조건부 생성)
DO $$
BEGIN
  -- international_quote_inquiry 테이블 존재 여부 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'international_quote_inquiry'
  ) THEN
    -- 두 테이블 모두 포함한 뷰 생성
    EXECUTE '
      CREATE OR REPLACE VIEW v_quote_to_customer_conversion AS
      SELECT 
        ''DOMESTIC'' as quote_type,
        eq.id as quote_id,
        eq.company_name,
        eq.contact_name,
        eq.email,
        eq.sales_stage,
        eq.status,
        eq.created_at as inquiry_date,
        eq.converted_at,
        eq.converted_customer_id,
        cm.code as customer_code,
        cm.name as customer_name,
        eq.expected_revenue,
        eq.win_probability
      FROM external_quote_inquiry eq
      LEFT JOIN customer_master cm ON eq.converted_customer_id = cm.id

      UNION ALL

      SELECT 
        ''INTERNATIONAL'' as quote_type,
        iq.id as quote_id,
        iq.company_name,
        iq.contact_name,
        iq.email,
        iq.sales_stage,
        iq.status,
        iq.created_at as inquiry_date,
        iq.converted_at,
        iq.converted_customer_id,
        cm.code as customer_code,
        cm.name as customer_name,
        iq.expected_revenue,
        iq.win_probability
      FROM international_quote_inquiry iq
      LEFT JOIN customer_master cm ON iq.converted_customer_id = cm.id

      ORDER BY inquiry_date DESC
    ';
    
    COMMENT ON VIEW v_quote_to_customer_conversion IS '견적 문의에서 거래처 전환 추적 (국내+해외)';
    RAISE NOTICE 'v_quote_to_customer_conversion 뷰 생성 완료 (국내+해외)';
  ELSE
    -- 국내 견적만 포함한 뷰 생성
    CREATE OR REPLACE VIEW v_quote_to_customer_conversion AS
    SELECT 
      'DOMESTIC' as quote_type,
      eq.id as quote_id,
      eq.company_name,
      eq.contact_name,
      eq.email,
      eq.sales_stage,
      eq.status,
      eq.created_at as inquiry_date,
      eq.converted_at,
      eq.converted_customer_id,
      cm.code as customer_code,
      cm.name as customer_name,
      eq.expected_revenue,
      eq.win_probability
    FROM external_quote_inquiry eq
    LEFT JOIN customer_master cm ON eq.converted_customer_id = cm.id
    ORDER BY inquiry_date DESC;
    
    COMMENT ON VIEW v_quote_to_customer_conversion IS '견적 문의에서 거래처 전환 추적 (국내만)';
    RAISE NOTICE 'v_quote_to_customer_conversion 뷰 생성 완료 (국내만)';
  END IF;
END $$;

-- ====================================================================
-- 완료 메시지
-- ====================================================================

SELECT 
  '✅ 거래처 관리 고도화 마이그레이션 완료' as status,
  json_build_object(
    'customer_contact', (SELECT COUNT(*) FROM customer_contact),
    'customer_relationship', (SELECT COUNT(*) FROM customer_relationship),
    'customer_pricing', (SELECT COUNT(*) FROM customer_pricing),
    'customer_contract', (SELECT COUNT(*) FROM customer_contract),
    'customer_activity', (SELECT COUNT(*) FROM customer_activity)
  ) as table_counts;

-- ====================================================================
-- 사용 예시 쿼리
-- ====================================================================

-- 1. 거래처의 모든 담당자 조회
-- SELECT * FROM customer_contact WHERE customer_master_id = 'uuid' ORDER BY is_primary DESC;

-- 2. 만료 임박 계약 조회 (30일 이내)
-- SELECT * FROM v_active_contracts WHERE days_until_expiry <= 30;

-- 3. 특정 거래처의 가격 정책 조회
-- SELECT * FROM customer_pricing WHERE customer_master_id = 'uuid' AND is_active = TRUE;

-- 4. 거래처 활동 이력 조회
-- SELECT * FROM customer_activity WHERE customer_master_id = 'uuid' ORDER BY activity_date DESC LIMIT 10;

-- 5. 견적 문의 → 거래처 전환율 조회
-- SELECT 
--   sales_stage,
--   COUNT(*) as count,
--   ROUND(AVG(win_probability), 2) as avg_win_probability
-- FROM external_quote_inquiry 
-- GROUP BY sales_stage;

-- ====================================================================
-- 다음 단계
-- ====================================================================
-- 이제 다음과 같은 기능을 구현할 수 있습니다:
-- 1. CRM 대시보드 (거래처 현황, 계약 현황, 영업 파이프라인)
-- 2. 견적 문의 → 거래처 전환 워크플로우
-- 3. 거래처별 맞춤 가격 적용
-- 4. 계약 만료 자동 알림
-- 5. 영업 활동 추적 및 보고서
-- ====================================================================

