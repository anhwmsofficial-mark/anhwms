-- ====================================================================
-- ANH WMS - 인증 및 사용자 관리
-- ====================================================================
-- Supabase Auth와 연동되는 사용자 프로필 및 권한 관리
-- ====================================================================

-- ====================================================================
-- 1. 사용자 프로필 테이블
-- ====================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT UNIQUE NOT NULL,
  full_name         TEXT,
  display_name      TEXT,
  
  -- 역할 및 권한
  role              TEXT NOT NULL DEFAULT 'viewer', -- admin / manager / operator / viewer
  department        TEXT, -- admin / warehouse / cs / fulfillment
  
  -- 조직 연결
  org_id            UUID REFERENCES org(id),
  
  -- 접근 권한
  can_access_admin  BOOLEAN DEFAULT FALSE,
  can_access_dashboard BOOLEAN DEFAULT TRUE,
  can_manage_users  BOOLEAN DEFAULT FALSE,
  can_manage_inventory BOOLEAN DEFAULT FALSE,
  can_manage_orders BOOLEAN DEFAULT FALSE,
  
  -- 프로필 정보
  avatar_url        TEXT,
  phone             TEXT,
  timezone          TEXT DEFAULT 'Asia/Seoul',
  language          TEXT DEFAULT 'ko',
  
  -- 상태
  status            TEXT DEFAULT 'active', -- active / suspended / inactive
  last_login_at     TIMESTAMPTZ,
  
  -- 메타데이터
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE user_profiles IS '사용자 프로필 및 권한 정보';
COMMENT ON COLUMN user_profiles.role IS 'admin: 전체 권한, manager: 관리 권한, operator: 운영 권한, viewer: 조회만';
COMMENT ON COLUMN user_profiles.department IS '소속 부서 (admin: 관리자, warehouse: 창고, cs: 고객지원, fulfillment: 풀필먼트)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON user_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);

-- ====================================================================
-- 2. RLS (Row Level Security) 설정
-- ====================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 자신의 프로필은 조회 가능
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- 자신의 프로필은 수정 가능
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin은 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin은 모든 프로필 수정 가능
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ====================================================================
-- 3. 자동으로 프로필 생성하는 트리거
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거: 새 사용자가 생성되면 자동으로 프로필 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 4. 테스트 사용자 생성 (Supabase Dashboard에서 수동 생성 필요)
-- ====================================================================

-- 참고: 실제 사용자는 Supabase Dashboard 또는 Auth API로 생성해야 합니다.
-- 아래는 프로필만 미리 준비하는 예시입니다.

COMMENT ON FUNCTION handle_new_user IS '새 사용자 생성 시 자동으로 프로필 생성';

-- ====================================================================
-- 5. 사용자 역할 및 권한 함수
-- ====================================================================

-- 사용자가 Admin인지 확인
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자가 특정 권한이 있는지 확인
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM user_profiles WHERE id = user_id;
  
  -- Admin은 모든 권한 보유
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- 권한별 체크
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 6. 테스트용 프로필 데이터 (사용자는 Supabase에서 생성)
-- ====================================================================

-- 참고: 실제 사용자 생성 방법
-- 1. Supabase Dashboard → Authentication → Users → Invite user
-- 2. 또는 SQL로 직접 생성:
--
-- 예시 (실제로는 Supabase Dashboard에서 생성하세요):
-- 
-- mark.choi@anhwms.com (Admin)
-- golden.choi@anhwms.com (Manager)
-- claudia.park@anhwms.com (Operator)

-- ====================================================================
-- 완료
-- ====================================================================
-- 
-- 다음 단계:
-- 1. Supabase Dashboard에서 테스트 사용자 3명 생성
-- 2. 생성된 사용자 ID로 프로필 권한 업데이트
-- 3. 로그인 페이지 개발
-- 4. Admin 페이지 보호 미들웨어 추가
-- ====================================================================

