-- ====================================================================
-- ANH WMS AI CS 통합 시스템 - 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요
-- ====================================================================

-- 기존 partners 테이블 확장 (locale, timezone 추가)
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'zh-CN',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Shanghai';

-- CS 대화 테이블
CREATE TABLE IF NOT EXISTS cs_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,              -- 'wechat' | 'email' | 'chat' | 'phone'
  lang_in TEXT DEFAULT 'zh',          -- 'zh' | 'ko'
  subject TEXT,
  status TEXT DEFAULT 'open',          -- 'open' | 'closed' | 'pending'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CS 메시지 테이블
CREATE TABLE IF NOT EXISTS cs_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  convo_id UUID REFERENCES cs_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                  -- 'partner' | 'agent' | 'ai'
  lang TEXT NOT NULL,                  -- 'zh' | 'ko'
  content TEXT NOT NULL,
  intent TEXT,                         -- 'shipping_query' | 'outbound_check' | 'inbound_check' | 'inventory' | 'document' | 'customs' | 'quote' | 'billing' | 'other'
  slots JSONB DEFAULT '{}'::JSONB,     -- 추출된 슬롯 정보
  tool_name TEXT,                      -- 호출된 툴 이름
  tool_payload JSONB,                  -- 툴 호출 파라미터
  tool_result JSONB,                  -- 툴 호출 결과
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 자동응답 템플릿 테이블
CREATE TABLE IF NOT EXISTS cs_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,            -- 'shipping.tracking' | 'doc.invoice' | 'delay.apology'
  lang TEXT NOT NULL,                  -- 'zh' | 'ko'
  tone TEXT DEFAULT 'business',        -- 'business' | 'friendly' | 'formal'
  body TEXT NOT NULL,                  -- 템플릿 본문 ({{variable}} 형식)
  variables JSONB DEFAULT '[]'::JSONB, -- 사용 가능한 변수 목록
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 번역 로그 (Quick Translate)
CREATE TABLE IF NOT EXISTS cs_translate_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_lang TEXT NOT NULL,            -- 'ko' | 'zh'
  target_lang TEXT NOT NULL,            -- 'ko' | 'zh'
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  tone TEXT DEFAULT 'business',        -- 'business' | 'friendly' | 'formal'
  formality TEXT DEFAULT 'neutral',    -- 'formal' | 'neutral' | 'casual'
  chars_in INTEGER,
  chars_out INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 용어집 (Glossary)
CREATE TABLE IF NOT EXISTS cs_glossary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  term_ko TEXT NOT NULL,
  term_zh TEXT NOT NULL,
  note TEXT,
  priority INTEGER DEFAULT 5,          -- 1-10 (높을수록 우선)
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림/경보 테이블
CREATE TABLE IF NOT EXISTS cs_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,                  -- 'delay48h' | 'qty_mismatch' | 'customs_hold' | 'damage' | 'missing'
  ref TEXT,                            -- order_no, tracking_no, sku 등
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  severity TEXT DEFAULT 'medium',     -- 'low' | 'medium' | 'high' | 'critical'
  status TEXT DEFAULT 'open',          -- 'open' | 'acknowledged' | 'resolved' | 'closed'
  message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- CS 티켓 테이블
CREATE TABLE IF NOT EXISTS cs_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES cs_conversations(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'normal',     -- 'low' | 'normal' | 'high' | 'urgent'
  summary TEXT NOT NULL,
  description TEXT,
  assignee UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open',         -- 'open' | 'in-progress' | 'resolved' | 'closed'
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cs_conversations_partner_id ON cs_conversations(partner_id);
CREATE INDEX IF NOT EXISTS idx_cs_conversations_status ON cs_conversations(status);
CREATE INDEX IF NOT EXISTS idx_cs_conversations_created_at ON cs_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_messages_convo_id ON cs_messages(convo_id);
CREATE INDEX IF NOT EXISTS idx_cs_messages_role ON cs_messages(role);
CREATE INDEX IF NOT EXISTS idx_cs_messages_intent ON cs_messages(intent);
CREATE INDEX IF NOT EXISTS idx_cs_messages_created_at ON cs_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_templates_key ON cs_templates(key);
CREATE INDEX IF NOT EXISTS idx_cs_templates_lang ON cs_templates(lang);
CREATE INDEX IF NOT EXISTS idx_cs_translate_logs_user_id ON cs_translate_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_translate_logs_created_at ON cs_translate_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_glossary_active ON cs_glossary(active);
CREATE INDEX IF NOT EXISTS idx_cs_glossary_priority ON cs_glossary(priority DESC);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_type ON cs_alerts(type);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_status ON cs_alerts(status);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_partner_id ON cs_alerts(partner_id);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_created_at ON cs_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_partner_id ON cs_tickets(partner_id);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_status ON cs_tickets(status);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_priority ON cs_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_assignee ON cs_tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_created_at ON cs_tickets(created_at DESC);

-- RLS 활성화
ALTER TABLE cs_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_translate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_glossary ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_tickets ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (개발 단계용)
CREATE POLICY "Enable read access for all users" ON cs_conversations FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cs_messages FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cs_templates FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cs_translate_logs FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cs_glossary FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cs_alerts FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cs_tickets FOR SELECT USING (true);

-- 쓰기 권한 (개발 단계용)
CREATE POLICY "Enable insert for all users" ON cs_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON cs_conversations FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON cs_conversations FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON cs_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON cs_messages FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON cs_messages FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON cs_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON cs_templates FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON cs_templates FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON cs_translate_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON cs_translate_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON cs_translate_logs FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON cs_glossary FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON cs_glossary FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON cs_glossary FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON cs_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON cs_alerts FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON cs_alerts FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON cs_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON cs_tickets FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON cs_tickets FOR DELETE USING (true);

-- 초기 템플릿 데이터 (중국어)
INSERT INTO cs_templates (key, lang, tone, body, variables) VALUES
('shipping.tracking', 'zh', 'business', '您好，您的货物当前状态为「{{status}}」。预计到达时间：{{eta}}。运单号：{{tracking_no}}。', '["status", "eta", "tracking_no"]'),
('delay.apology', 'zh', 'business', '给您带来不便，深表歉意。当前状态为「{{status}}」，预计 {{eta}} 到港。我们已与承运方协调以加快处理，进展将第一时间更新您。', '["status", "eta"]'),
('slot.request', 'zh', 'business', '为便于查询，请提供{{slot_name}}。', '["slot_name"]'),
('outbound.confirmed', 'zh', 'business', '您的出库单 {{order_no}} 已于 {{date}} 完成。数量：{{quantity}}{{unit}}，位置：{{location}}。', '["order_no", "date", "quantity", "unit", "location"]'),
('inbound.confirmed', 'zh', 'business', '您的入库单 {{asn_no}} 已于 {{date}} 完成。数量：{{quantity}}{{unit}}，位置：{{location}}。', '["asn_no", "date", "quantity", "unit", "location"]'),
('inventory.query', 'zh', 'business', 'SKU {{sku}} 当前可用库存：{{available}}{{unit}}，保留库存：{{reserved}}{{unit}}，位置：{{location}}。', '["sku", "available", "reserved", "unit", "location"]'),
('document.invoice', 'zh', 'business', '发票链接：{{url}}。有效期至 {{expiry}}。', '["url", "expiry"]'),
('business.greeting', 'zh', 'business', '感谢配合。后续进度将按计划在{{date}}前更新。', '["date"]')
ON CONFLICT (key) DO NOTHING;

-- 초기 용어집 데이터
INSERT INTO cs_glossary (term_ko, term_zh, note, priority) VALUES
('출고', '出库', '물품 출고', 10),
('입고', '入库', '물품 입고', 10),
('재고', '库存', '재고 수량', 10),
('운송장', '运单', '배송 운송장', 10),
('주문번호', '订单号', '주문 번호', 10),
('SKU', 'SKU', '제품 코드', 9),
('로케이션', '位置', '창고 위치', 9),
('인보이스', '发票', '송장', 9),
('패킹리스트', '装箱单', '포장 목록', 9),
('출고증', '出库单', '출고 증명서', 9),
('예상 도착 시간', '预计到达时间', 'ETA', 8),
('지연', '延迟', '배송 지연', 8),
('통관', '通关', '세관 통과', 7),
('보류', '保留', '재고 보류', 7),
('가용', '可用', '사용 가능', 7)
ON CONFLICT DO NOTHING;

-- 샘플 파트너 데이터 (CS 테스트용)
UPDATE partners SET code = 'PARTNER001', locale = 'zh-CN', timezone = 'Asia/Shanghai'
WHERE id IN (
  SELECT id FROM partners WHERE name = '테크 공급업체' LIMIT 1
);
UPDATE partners SET code = 'PARTNER002', locale = 'ko-KR', timezone = 'Asia/Seoul'
WHERE id IN (
  SELECT id FROM partners WHERE name = 'ABC 전자' LIMIT 1
);

