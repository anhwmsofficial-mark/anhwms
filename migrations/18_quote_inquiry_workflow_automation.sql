-- ====================================================================
-- ANH WMS v2 마이그레이션
-- 18_quote_inquiry_workflow_automation.sql - 견적 문의 업무 자동화
-- ====================================================================
-- 목적: 실제 현장 운영을 위한 자동화 및 커뮤니케이션 기능
-- 실행 순서: 18번 (17_quote_inquiry_enhancement.sql 이후)
-- 의존성: external_quote_inquiry, inquiry_notes, user_profiles
-- ====================================================================

-- ====================================================================
-- 1. 이메일 템플릿 시스템
-- ====================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 템플릿 정보
  name              TEXT NOT NULL UNIQUE,              -- 템플릿 이름 (예: "quote_sent")
  display_name      TEXT NOT NULL,                     -- 화면 표시명 (예: "견적 발송 알림")
  category          TEXT NOT NULL,                     -- customer / internal
  
  -- 이메일 내용
  subject           TEXT NOT NULL,                     -- 제목 (변수 포함 가능)
  body_html         TEXT NOT NULL,                     -- HTML 본문
  body_text         TEXT,                              -- 텍스트 본문
  
  -- 트리거 설정
  trigger_event     TEXT,                              -- 자동 발송 트리거 (status_changed, assigned 등)
  trigger_status    TEXT,                              -- 특정 상태일 때 발송
  
  -- 메타데이터
  is_active         BOOLEAN DEFAULT true,
  description       TEXT,
  variables         JSONB DEFAULT '[]'::jsonb,         -- 사용 가능한 변수 목록
  
  created_by        UUID REFERENCES user_profiles(id),
  updated_by        UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_trigger ON email_templates(trigger_event, trigger_status);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

COMMENT ON TABLE email_templates IS '이메일 템플릿 관리 테이블';
COMMENT ON COLUMN email_templates.trigger_event IS '자동 발송 트리거: status_changed, assigned, note_added 등';
COMMENT ON COLUMN email_templates.variables IS '사용 가능한 변수: {company_name}, {contact_name} 등';

-- ====================================================================
-- 2. 이메일 발송 로그
-- ====================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 연결 정보
  inquiry_id        UUID NOT NULL,
  inquiry_type      TEXT NOT NULL CHECK (inquiry_type IN ('external', 'international')),
  template_id       UUID REFERENCES email_templates(id),
  
  -- 수신자
  recipient_email   TEXT NOT NULL,
  recipient_name    TEXT,
  
  -- 이메일 내용
  subject           TEXT NOT NULL,
  body_html         TEXT,
  body_text         TEXT,
  
  -- 발송 정보
  sent_by           UUID REFERENCES user_profiles(id),
  sent_at           TIMESTAMPTZ,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message     TEXT,
  
  -- 메타데이터
  trigger_event     TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_logs_inquiry ON email_logs(inquiry_id, inquiry_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON email_logs(sent_by);

COMMENT ON TABLE email_logs IS '이메일 발송 로그';

-- ====================================================================
-- 3. 알림 시스템
-- ====================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 수신자
  user_id           UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- 알림 내용
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error', 'urgent')),
  
  -- 연결 정보
  inquiry_id        UUID,
  inquiry_type      TEXT CHECK (inquiry_type IN ('external', 'international')),
  link_url          TEXT,
  
  -- 상태
  is_read           BOOLEAN DEFAULT false,
  read_at           TIMESTAMPTZ,
  
  -- 메타데이터
  action            TEXT,                              -- assigned, status_changed, reminder 등
  metadata          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_inquiry ON notifications(inquiry_id, inquiry_type);
CREATE INDEX IF NOT EXISTS idx_notifications_action ON notifications(action);

COMMENT ON TABLE notifications IS '사용자 알림 테이블';
COMMENT ON COLUMN notifications.action IS '알림 액션: assigned, status_changed, reminder, new_inquiry 등';

-- ====================================================================
-- 4. 자동 알림 규칙
-- ====================================================================

CREATE TABLE IF NOT EXISTS notification_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 규칙 정보
  name              TEXT NOT NULL,
  description       TEXT,
  is_active         BOOLEAN DEFAULT true,
  
  -- 트리거 조건
  trigger_event     TEXT NOT NULL,                     -- new_inquiry, status_changed, no_activity 등
  trigger_condition JSONB DEFAULT '{}'::jsonb,         -- 추가 조건 (status, days_inactive 등)
  
  -- 알림 대상
  notify_type       TEXT NOT NULL CHECK (notify_type IN ('assigned_user', 'all_admins', 'specific_users', 'role')),
  notify_users      UUID[],                            -- 특정 사용자 ID 배열
  notify_roles      TEXT[],                            -- 특정 역할 배열
  
  -- 알림 방법
  send_email        BOOLEAN DEFAULT false,
  send_notification BOOLEAN DEFAULT true,
  send_slack        BOOLEAN DEFAULT false,
  
  -- 이메일 템플릿
  email_template_id UUID REFERENCES email_templates(id),
  
  -- 실행 제한
  cooldown_minutes  INTEGER DEFAULT 0,                 -- 재실행 대기 시간 (분)
  
  created_by        UUID REFERENCES user_profiles(id),
  updated_by        UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_active ON notification_rules(is_active, trigger_event);

COMMENT ON TABLE notification_rules IS '자동 알림 규칙 설정';
COMMENT ON COLUMN notification_rules.trigger_event IS 'new_inquiry, status_changed, assigned, no_activity_3days 등';
COMMENT ON COLUMN notification_rules.cooldown_minutes IS '동일 이벤트 재알림 방지 시간 (분)';

-- ====================================================================
-- 5. 액션 로그 (감사 추적)
-- ====================================================================

CREATE TABLE IF NOT EXISTS inquiry_action_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 연결 정보
  inquiry_id        UUID NOT NULL,
  inquiry_type      TEXT NOT NULL CHECK (inquiry_type IN ('external', 'international')),
  
  -- 액션 정보
  action            TEXT NOT NULL,                     -- status_changed, assigned, note_added, email_sent 등
  actor_id          UUID REFERENCES user_profiles(id),
  actor_name        TEXT,
  
  -- 변경 내용
  old_value         TEXT,
  new_value         TEXT,
  details           JSONB DEFAULT '{}'::jsonb,
  
  -- IP 정보
  ip_address        TEXT,
  user_agent        TEXT
);

CREATE INDEX IF NOT EXISTS idx_action_logs_inquiry ON inquiry_action_logs(inquiry_id, inquiry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_actor ON inquiry_action_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON inquiry_action_logs(action);

COMMENT ON TABLE inquiry_action_logs IS '견적 문의 모든 액션 로그 (감사 추적)';

-- ====================================================================
-- 6. 견적 산정 규칙
-- ====================================================================

CREATE TABLE IF NOT EXISTS quote_pricing_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 규칙 정보
  name              TEXT NOT NULL,
  description       TEXT,
  is_active         BOOLEAN DEFAULT true,
  priority          INTEGER DEFAULT 0,                 -- 우선순위 (높을수록 먼저 적용)
  
  -- 적용 조건
  min_monthly_volume INTEGER,                          -- 최소 월 출고량
  max_monthly_volume INTEGER,                          -- 최대 월 출고량
  min_sku_count     INTEGER,                           -- 최소 SKU 수
  max_sku_count     INTEGER,                           -- 최대 SKU 수
  product_categories TEXT[],                           -- 적용 상품군
  
  -- 가격 설정
  base_fee          DECIMAL(10,2),                     -- 기본료
  picking_fee       DECIMAL(10,2),                     -- 피킹비 (건당)
  packing_fee       DECIMAL(10,2),                     -- 포장비 (건당)
  storage_fee       DECIMAL(10,2),                     -- 보관료 (SKU당/월)
  
  -- 부가 서비스 가격
  extra_service_fees JSONB DEFAULT '{}'::jsonb,        -- {지아미: 100, 에어캡: 200}
  
  -- 할인
  volume_discount   JSONB DEFAULT '{}'::jsonb,         -- 물량 할인 규칙
  
  created_by        UUID REFERENCES user_profiles(id),
  updated_by        UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON quote_pricing_rules(is_active, priority DESC);

COMMENT ON TABLE quote_pricing_rules IS '자동 견적 산정 규칙';
COMMENT ON COLUMN quote_pricing_rules.priority IS '여러 규칙 적용 시 우선순위 (높을수록 먼저)';

-- ====================================================================
-- 7. 견적서 생성 히스토리
-- ====================================================================

CREATE TABLE IF NOT EXISTS quote_calculations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 연결 정보
  inquiry_id        UUID NOT NULL,
  inquiry_type      TEXT NOT NULL CHECK (inquiry_type IN ('external', 'international')),
  
  -- 계산 결과
  pricing_rule_id   UUID REFERENCES quote_pricing_rules(id),
  calculation_data  JSONB NOT NULL,                    -- 상세 계산 내역
  
  -- 총액
  subtotal          DECIMAL(10,2) NOT NULL,
  discount          DECIMAL(10,2) DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL,
  
  -- 생성 정보
  calculated_by     UUID REFERENCES user_profiles(id),
  is_sent           BOOLEAN DEFAULT false,
  sent_at           TIMESTAMPTZ,
  
  -- 메타데이터
  notes             TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_quote_calculations_inquiry ON quote_calculations(inquiry_id, inquiry_type);
CREATE INDEX IF NOT EXISTS idx_quote_calculations_sent ON quote_calculations(is_sent, sent_at);

COMMENT ON TABLE quote_calculations IS '견적 계산 및 발송 히스토리';

-- ====================================================================
-- 8. 트리거 함수들
-- ====================================================================

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER update_notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_pricing_rules_updated_at ON quote_pricing_rules;
CREATE TRIGGER update_quote_pricing_rules_updated_at
  BEFORE UPDATE ON quote_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- 9. RLS 정책
-- ====================================================================

-- 이메일 템플릿: 관리자만 관리
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자는 모든 템플릿을 조회할 수 있습니다" ON email_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "관리자는 템플릿을 생성할 수 있습니다" ON email_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 알림: 본인 알림만 조회
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 알림을 조회할 수 있습니다" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "시스템은 알림을 생성할 수 있습니다" ON notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "사용자는 자신의 알림을 업데이트할 수 있습니다" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- 액션 로그: 관리자만 조회
ALTER TABLE inquiry_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자는 모든 액션 로그를 조회할 수 있습니다" ON inquiry_action_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ====================================================================
-- 10. 기본 템플릿 데이터 삽입
-- ====================================================================

INSERT INTO email_templates (name, display_name, category, subject, body_html, body_text, trigger_event, trigger_status, variables, description)
VALUES 
(
  'quote_assigned',
  '담당자 배정 알림',
  'internal',
  '[ANH WMS] 새 견적 문의가 배정되었습니다',
  '<h2>새 견적 문의가 배정되었습니다</h2>
  <p>안녕하세요, {assignee_name}님</p>
  <p><strong>{company_name}</strong>의 견적 문의가 배정되었습니다.</p>
  <ul>
    <li>담당자: {contact_name}</li>
    <li>이메일: {email}</li>
    <li>월 출고량: {monthly_volume}</li>
    <li>SKU 수: {sku_count}</li>
  </ul>
  <p><a href="{inquiry_link}">견적 문의 바로가기</a></p>',
  '새 견적 문의가 배정되었습니다.\n\n회사명: {company_name}\n담당자: {contact_name}\n\n바로가기: {inquiry_link}',
  'assigned',
  NULL,
  '["assignee_name", "company_name", "contact_name", "email", "monthly_volume", "sku_count", "inquiry_link"]'::jsonb,
  '담당자에게 견적 문의 배정 시 자동 발송'
),
(
  'quote_sent_customer',
  '견적 발송 안내 (고객용)',
  'customer',
  '[ANH] 견적서가 발송되었습니다',
  '<h2>견적서를 보내드립니다</h2>
  <p>안녕하세요, {contact_name}님</p>
  <p>{company_name}의 풀필먼트 서비스 견적서를 첨부파일로 보내드립니다.</p>
  <p>검토 후 궁금하신 사항이 있으시면 언제든 연락 주시기 바랍니다.</p>
  <p>감사합니다.</p>
  <p>ANH WMS 영업팀</p>',
  '견적서를 보내드립니다.\n\n검토 후 연락 주시기 바랍니다.\n\n감사합니다.',
  'status_changed',
  'quoted',
  '["company_name", "contact_name"]'::jsonb,
  '견적 발송 상태 변경 시 고객에게 자동 발송'
),
(
  'quote_won',
  '수주 확정 안내 (고객용)',
  'customer',
  '[ANH] 계약이 확정되었습니다',
  '<h2>계약 확정을 축하드립니다</h2>
  <p>안녕하세요, {contact_name}님</p>
  <p>{company_name}의 풀필먼트 서비스 계약이 확정되었습니다.</p>
  <p>담당자가 곧 연락드려 세부 사항을 안내해드리겠습니다.</p>
  <p>함께 성장할 수 있기를 기대합니다.</p>
  <p>감사합니다.</p>',
  '계약이 확정되었습니다.\n\n담당자가 곧 연락드리겠습니다.',
  'status_changed',
  'won',
  '["company_name", "contact_name"]'::jsonb,
  '수주 확정 시 고객에게 자동 발송'
),
(
  'quote_on_hold',
  '검토 보류 안내 (고객용)',
  'customer',
  '[ANH] 견적 검토 현황 안내',
  '<h2>견적 검토 현황</h2>
  <p>안녕하세요, {contact_name}님</p>
  <p>귀사의 견적 문의를 검토 중입니다.</p>
  <p>추가 검토가 필요하여 회신이 조금 지연될 수 있습니다.</p>
  <p>최대한 빠른 시일 내에 연락드리겠습니다.</p>
  <p>감사합니다.</p>',
  '견적 검토 중입니다.\n\n빠른 시일 내에 연락드리겠습니다.',
  'status_changed',
  'on_hold',
  '["company_name", "contact_name"]'::jsonb,
  '보류 상태 변경 시 고객에게 안내'
)
ON CONFLICT (name) DO NOTHING;

-- 기본 알림 규칙
INSERT INTO notification_rules (name, description, trigger_event, trigger_condition, notify_type, send_notification, send_email)
VALUES
(
  '신규 문의 알림',
  '새로운 견적 문의가 접수되면 모든 관리자에게 알림',
  'new_inquiry',
  '{}'::jsonb,
  'all_admins',
  true,
  false
),
(
  '담당자 배정 알림',
  '견적 문의가 배정되면 해당 담당자에게 알림',
  'assigned',
  '{}'::jsonb,
  'assigned_user',
  true,
  true
),
(
  '3일 미처리 알림',
  '신규 상태로 3일 이상 방치된 문의 알림',
  'no_activity_3days',
  '{"status": "new", "days": 3}'::jsonb,
  'all_admins',
  true,
  true
)
ON CONFLICT DO NOTHING;

-- 기본 견적 산정 규칙
INSERT INTO quote_pricing_rules (name, description, priority, min_monthly_volume, max_monthly_volume, base_fee, picking_fee, packing_fee, storage_fee, extra_service_fees)
VALUES
(
  '소규모 (1000건 미만)',
  '월 1000건 미만 소규모 업체',
  10,
  0,
  1000,
  500000,
  1500,
  800,
  5000,
  '{"지아미": 100, "에어캡": 200, "라벨부착": 300}'::jsonb
),
(
  '중규모 (1000~5000건)',
  '월 1000~5000건 중규모 업체',
  20,
  1000,
  5000,
  800000,
  1300,
  700,
  4000,
  '{"지아미": 90, "에어캡": 180, "라벨부착": 250}'::jsonb
),
(
  '대규모 (5000건 이상)',
  '월 5000건 이상 대규모 업체',
  30,
  5000,
  NULL,
  1200000,
  1000,
  600,
  3000,
  '{"지아미": 80, "에어캡": 150, "라벨부착": 200}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 완료 메시지
-- ====================================================================
SELECT '견적 문의 업무 자동화 기능 설치 완료 (이메일, 알림, 견적산정)' AS status;

