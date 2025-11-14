-- ===================================================================
-- 메모 및 사진 첨부 기능을 위한 데이터베이스 스키마
-- ===================================================================

-- 1. 작업 메모 테이블
CREATE TABLE IF NOT EXISTS work_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT NOT NULL,              -- 작업 ID (예: PACK001, ORD-2025-001)
  task_type TEXT NOT NULL,            -- 작업 유형 (packing, inbound, outbound, etc)
  content TEXT NOT NULL,              -- 메모 내용
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 작업 사진 테이블
CREATE TABLE IF NOT EXISTS work_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT NOT NULL,              -- 작업 ID
  task_type TEXT NOT NULL,            -- 작업 유형
  file_name TEXT NOT NULL,            -- 파일명
  file_path TEXT NOT NULL,            -- 파일 경로 (Supabase Storage 경로)
  file_size BIGINT,                   -- 파일 크기 (bytes)
  mime_type TEXT,                     -- MIME 타입 (image/jpeg, image/png, etc)
  description TEXT,                   -- 사진 설명 (선택사항)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 현장 커뮤니케이션 테이블
CREATE TABLE IF NOT EXISTS field_communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  receiver_name TEXT,                 -- NULL이면 전체 공지
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  category TEXT CHECK (category IN ('notice', 'issue', 'question', 'instruction')) DEFAULT 'notice',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 커뮤니케이션 첨부파일 테이블
CREATE TABLE IF NOT EXISTS communication_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  communication_id UUID REFERENCES field_communications(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 인덱스 생성
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_work_memos_task_id ON work_memos(task_id);
CREATE INDEX IF NOT EXISTS idx_work_memos_task_type ON work_memos(task_type);
CREATE INDEX IF NOT EXISTS idx_work_memos_created_at ON work_memos(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_photos_task_id ON work_photos(task_id);
CREATE INDEX IF NOT EXISTS idx_work_photos_task_type ON work_photos(task_type);
CREATE INDEX IF NOT EXISTS idx_work_photos_created_at ON work_photos(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_comm_receiver ON field_communications(receiver_id);
CREATE INDEX IF NOT EXISTS idx_field_comm_sender ON field_communications(sender_id);
CREATE INDEX IF NOT EXISTS idx_field_comm_created_at ON field_communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_comm_is_read ON field_communications(is_read);

-- ===================================================================
-- Row Level Security (RLS) 설정
-- ===================================================================

ALTER TABLE work_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_attachments ENABLE ROW LEVEL SECURITY;

-- 메모 정책: 모든 인증된 사용자는 읽기/쓰기 가능
CREATE POLICY "work_memos_select_policy" ON work_memos FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_memos_insert_policy" ON work_memos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_memos_update_policy" ON work_memos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "work_memos_delete_policy" ON work_memos FOR DELETE TO authenticated USING (true);

-- 사진 정책: 모든 인증된 사용자는 읽기/쓰기 가능
CREATE POLICY "work_photos_select_policy" ON work_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_photos_insert_policy" ON work_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_photos_update_policy" ON work_photos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "work_photos_delete_policy" ON work_photos FOR DELETE TO authenticated USING (true);

-- 커뮤니케이션 정책: 발신자, 수신자, 관리자만 조회 가능
CREATE POLICY "field_comm_select_policy" ON field_communications 
FOR SELECT TO authenticated 
USING (
  sender_id = auth.uid() OR 
  receiver_id = auth.uid() OR 
  receiver_id IS NULL OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "field_comm_insert_policy" ON field_communications 
FOR INSERT TO authenticated 
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "field_comm_update_policy" ON field_communications 
FOR UPDATE TO authenticated 
USING (receiver_id = auth.uid() OR sender_id = auth.uid());

-- 첨부파일 정책: 커뮤니케이션 접근 권한과 동일
CREATE POLICY "comm_attachments_select_policy" ON communication_attachments 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM field_communications fc 
    WHERE fc.id = communication_id 
    AND (
      fc.sender_id = auth.uid() OR 
      fc.receiver_id = auth.uid() OR 
      fc.receiver_id IS NULL OR
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    )
  )
);

CREATE POLICY "comm_attachments_insert_policy" ON communication_attachments 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM field_communications fc 
    WHERE fc.id = communication_id 
    AND fc.sender_id = auth.uid()
  )
);

-- ===================================================================
-- 샘플 데이터
-- ===================================================================

-- 샘플 작업 메모
INSERT INTO work_memos (task_id, task_type, content, created_by, created_at) VALUES
('PACK001', 'packing', '포장재가 부족합니다. 추가 발주 필요.', 
  (SELECT id FROM users WHERE username = 'staff1'), 
  NOW() - INTERVAL '2 hours'),
('ORD-2025-001', 'inbound', '노트북 A 10개 입고 완료. 상태 양호.', 
  (SELECT id FROM users WHERE username = 'staff1'), 
  NOW() - INTERVAL '1 day'),
('PACK002', 'packing', '마우스 포장 중 파손 1개 발견. 교체 필요.', 
  (SELECT id FROM users WHERE username = 'staff1'), 
  NOW() - INTERVAL '30 minutes');

-- 샘플 작업 사진 (실제 파일은 Supabase Storage에 업로드 필요)
INSERT INTO work_photos (task_id, task_type, file_name, file_path, file_size, mime_type, description, created_by) VALUES
('PACK001', 'packing', 'packing_issue_001.jpg', '/uploads/packing/packing_issue_001.jpg', 245678, 'image/jpeg', 
  '포장 상태 양호', (SELECT id FROM users WHERE username = 'staff1')),
('ORD-2025-001', 'inbound', 'inbound_complete_001.jpg', '/uploads/inbound/inbound_complete_001.jpg', 189234, 'image/jpeg', 
  '입고 완료 현황', (SELECT id FROM users WHERE username = 'staff1'));

-- 샘플 현장 커뮤니케이션
INSERT INTO field_communications (sender_id, sender_name, receiver_id, receiver_name, title, message, priority, category, is_read, created_at) VALUES
-- 전체 공지
((SELECT id FROM users WHERE username = 'manager1'), '김관리', NULL, NULL, 
  '오후 3시 안전 교육 공지', 
  '오늘 오후 3시에 창고 안전 교육이 있습니다. 모든 직원은 반드시 참석해주세요.',
  'high', 'notice', FALSE, NOW() - INTERVAL '3 hours'),

-- 개별 메시지
((SELECT id FROM users WHERE username = 'manager1'), '김관리', 
  (SELECT id FROM users WHERE username = 'staff1'), '박직원',
  'A구역 재고 확인 요청',
  'A구역 노트북 재고를 확인하고 보고 부탁드립니다.',
  'normal', 'instruction', TRUE, NOW() - INTERVAL '5 hours'),

-- 이슈 보고
((SELECT id FROM users WHERE username = 'staff1'), '박직원',
  (SELECT id FROM users WHERE username = 'manager1'), '김관리',
  'C구역 포장재 부족',
  'C구역 박스 포장재가 부족합니다. 긴급 보충이 필요합니다.',
  'urgent', 'issue', FALSE, NOW() - INTERVAL '30 minutes');

-- ===================================================================
-- 트리거: updated_at 자동 업데이트
-- ===================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_work_memos_updated_at
BEFORE UPDATE ON work_memos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

