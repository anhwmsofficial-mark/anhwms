-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 17_quote_inquiry_enhancement.sql - 견적 문의 기능 확장
-- ====================================================================
-- 목적: 견적 문의 운영 워크플로우 개선
-- 실행 순서: 17번 (16_grant_admin_access.sql 이후)
-- 의존성: external_quote_inquiry, international_quote_inquiry
-- ====================================================================

-- ====================================================================
-- 1. 기존 제약 조건 삭제 (먼저!)
-- ====================================================================

ALTER TABLE external_quote_inquiry DROP CONSTRAINT IF EXISTS external_quote_inquiry_status_check;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'international_quote_inquiry') THEN
    ALTER TABLE international_quote_inquiry DROP CONSTRAINT IF EXISTS international_quote_inquiry_status_check;
    RAISE NOTICE 'international_quote_inquiry 제약 조건 삭제 완료';
  END IF;
END $$;

-- ====================================================================
-- 2. 기존 데이터 마이그레이션 (상태 값 변환) - 제약 조건 삭제 후!
-- ====================================================================

-- 'in_progress' → 'processing'으로 업데이트
UPDATE external_quote_inquiry 
SET status = 'processing' 
WHERE status = 'in_progress';

-- 'closed_won' → 'won'으로 업데이트
UPDATE external_quote_inquiry 
SET status = 'won' 
WHERE status = 'closed_won';

-- 'closed_lost' → 'lost'로 업데이트
UPDATE external_quote_inquiry 
SET status = 'lost' 
WHERE status = 'closed_lost';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'international_quote_inquiry') THEN
    UPDATE international_quote_inquiry SET status = 'processing' WHERE status = 'in_progress';
    UPDATE international_quote_inquiry SET status = 'won' WHERE status = 'closed_won';
    UPDATE international_quote_inquiry SET status = 'lost' WHERE status = 'closed_lost';
    RAISE NOTICE 'international_quote_inquiry 데이터 마이그레이션 완료';
  END IF;
END $$;

-- ====================================================================
-- 3. 새로운 제약 조건 추가 (데이터 변환 후!)
-- ====================================================================

-- external_quote_inquiry 테이블 상태 확장
ALTER TABLE external_quote_inquiry
ADD CONSTRAINT external_quote_inquiry_status_check CHECK (
  status IN (
    'new',           -- 신규
    'checked',       -- 확인됨
    'processing',    -- 상담중
    'quoted',        -- 견적 발송
    'pending',       -- 고객 검토중
    'won',           -- 수주
    'lost',          -- 미수주
    'on_hold'        -- 보류
  )
);

COMMENT ON COLUMN external_quote_inquiry.status IS '상태: new(신규)/checked(확인됨)/processing(상담중)/quoted(견적발송)/pending(고객검토중)/won(수주)/lost(미수주)/on_hold(보류)';

-- international_quote_inquiry 테이블도 동일하게 확장
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'international_quote_inquiry') THEN
    ALTER TABLE international_quote_inquiry
    ADD CONSTRAINT international_quote_inquiry_status_check CHECK (
      status IN (
        'new',
        'checked',
        'processing',
        'quoted',
        'pending',
        'won',
        'lost',
        'on_hold'
      )
    );
    RAISE NOTICE 'international_quote_inquiry 상태 확장 완료';
  END IF;
END $$;

-- ====================================================================
-- 4. 추가 필드 (담당자, 견적서 파일, 갱신일)
-- ====================================================================

-- assigned_to: 담당자 (운영자) 지정
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='assigned_to'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- quote_file_url: 견적서 PDF 파일 URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='quote_file_url'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN quote_file_url TEXT;
  END IF;
END $$;

-- quote_sent_at: 견적서 발송 일시
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='quote_sent_at'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN quote_sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- updated_at: 갱신 일시
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='external_quote_inquiry' AND column_name='updated_at'
  ) THEN
    ALTER TABLE external_quote_inquiry 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_external_quote_inquiry_assigned_to ON external_quote_inquiry(assigned_to);

COMMENT ON COLUMN external_quote_inquiry.assigned_to IS '담당 운영자 ID';
COMMENT ON COLUMN external_quote_inquiry.quote_file_url IS '견적서 PDF 파일 URL';
COMMENT ON COLUMN external_quote_inquiry.quote_sent_at IS '견적서 발송 일시';
COMMENT ON COLUMN external_quote_inquiry.updated_at IS '최종 수정 일시';

-- international_quote_inquiry에도 동일하게 적용
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'international_quote_inquiry') THEN
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='international_quote_inquiry' AND column_name='assigned_to') THEN
      ALTER TABLE international_quote_inquiry ADD COLUMN assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='international_quote_inquiry' AND column_name='quote_file_url') THEN
      ALTER TABLE international_quote_inquiry ADD COLUMN quote_file_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='international_quote_inquiry' AND column_name='quote_sent_at') THEN
      ALTER TABLE international_quote_inquiry ADD COLUMN quote_sent_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='international_quote_inquiry' AND column_name='updated_at') THEN
      ALTER TABLE international_quote_inquiry ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    CREATE INDEX IF NOT EXISTS idx_international_quote_inquiry_assigned_to ON international_quote_inquiry(assigned_to);
    
    RAISE NOTICE 'international_quote_inquiry 필드 추가 완료';
  END IF;
END $$;

-- ====================================================================
-- 5. 메모(Internal Notes) 테이블 생성
-- ====================================================================

CREATE TABLE IF NOT EXISTS inquiry_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 연결 정보
  inquiry_id        UUID NOT NULL,      -- external_quote_inquiry 또는 international_quote_inquiry의 id
  inquiry_type      TEXT NOT NULL CHECK (inquiry_type IN ('external', 'international')),
  
  -- 작성자
  admin_id          UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- 메모 내용
  note              TEXT NOT NULL,
  
  -- 메타데이터
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_notes_inquiry ON inquiry_notes(inquiry_id, inquiry_type);
CREATE INDEX IF NOT EXISTS idx_inquiry_notes_admin ON inquiry_notes(admin_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_notes_created_at ON inquiry_notes(created_at DESC);

COMMENT ON TABLE inquiry_notes IS '견적 문의에 대한 운영자 메모';
COMMENT ON COLUMN inquiry_notes.inquiry_id IS '견적 문의 ID (external 또는 international)';
COMMENT ON COLUMN inquiry_notes.inquiry_type IS '문의 유형: external(국내) / international(해외)';
COMMENT ON COLUMN inquiry_notes.admin_id IS '메모 작성자 (운영자) ID';
COMMENT ON COLUMN inquiry_notes.note IS '메모 내용';

-- ====================================================================
-- 6. 자동 갱신 트리거 (updated_at)
-- ====================================================================

-- external_quote_inquiry updated_at 트리거
CREATE OR REPLACE FUNCTION update_external_quote_inquiry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_external_quote_inquiry_updated_at ON external_quote_inquiry;
CREATE TRIGGER trigger_external_quote_inquiry_updated_at
  BEFORE UPDATE ON external_quote_inquiry
  FOR EACH ROW
  EXECUTE FUNCTION update_external_quote_inquiry_updated_at();

-- international_quote_inquiry updated_at 트리거
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'international_quote_inquiry') THEN
    
    CREATE OR REPLACE FUNCTION update_international_quote_inquiry_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_international_quote_inquiry_updated_at ON international_quote_inquiry;
    CREATE TRIGGER trigger_international_quote_inquiry_updated_at
      BEFORE UPDATE ON international_quote_inquiry
      FOR EACH ROW
      EXECUTE FUNCTION update_international_quote_inquiry_updated_at();
    
    RAISE NOTICE 'international_quote_inquiry 트리거 생성 완료';
  END IF;
END $$;

-- inquiry_notes updated_at 트리거
CREATE OR REPLACE FUNCTION update_inquiry_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inquiry_notes_updated_at ON inquiry_notes;
CREATE TRIGGER trigger_inquiry_notes_updated_at
  BEFORE UPDATE ON inquiry_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_inquiry_notes_updated_at();

-- ====================================================================
-- 7. RLS (Row Level Security) 정책 - 관리자만 접근 가능
-- ====================================================================

ALTER TABLE inquiry_notes ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회/삽입/수정/삭제 가능
CREATE POLICY "관리자는 모든 메모를 조회할 수 있습니다" ON inquiry_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "관리자는 메모를 추가할 수 있습니다" ON inquiry_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "관리자는 자신의 메모를 수정할 수 있습니다" ON inquiry_notes
  FOR UPDATE
  USING (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "관리자는 자신의 메모를 삭제할 수 있습니다" ON inquiry_notes
  FOR DELETE
  USING (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ====================================================================
-- 완료 메시지
-- ====================================================================
SELECT '견적 문의 기능 확장 완료 (상태 확장, 담당자, 파일, 메모 테이블)' AS status;
