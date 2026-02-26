-- ====================================================================
-- 로그인 문제 해결 스크립트 (수정됨)
-- 1. users 테이블 스키마 보정 (누락된 컬럼 추가)
-- 2. auth.users와 public.users 동기화
-- 3. RLS 재귀 문제 방지 함수 적용
-- ====================================================================

-- 1. users 테이블에 필수 컬럼이 없으면 추가
DO $$
BEGIN
    -- updated_at 컬럼 확인 및 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- created_at 컬럼 확인 및 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- role 컬럼 확인 및 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'staff';
    END IF;

    -- username 컬럼 확인 및 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'username'
    ) THEN
        ALTER TABLE public.users ADD COLUMN username TEXT;
    END IF;
END $$;

-- 2. 누락된 사용자 동기화 (auth.users -> public.users)
INSERT INTO public.users (id, email, username, role, created_at, updated_at)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'role', 'staff'),
    au.created_at, 
    COALESCE(au.last_sign_in_at, au.created_at)
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 3. Admin 체크를 위한 안전한 함수 생성 (RLS 우회)
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER로 실행되어 RLS를 우회하고 테이블을 직접 조회
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Users 테이블 RLS 정책 업데이트
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 기존 재귀 정책 삭제
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.users;

-- 안전한 함수를 사용하는 새 정책 적용
CREATE POLICY "Admins can view all profiles" ON public.users
  FOR SELECT USING (
    public.is_admin_safe()
  );

CREATE POLICY "Admins can update profiles" ON public.users
  FOR UPDATE USING (
    public.is_admin_safe()
  );

-- 자신의 프로필 조회 정책 (기존 유지 확인)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- 5. 업데이트 완료 확인
DO $$
BEGIN
    RAISE NOTICE '✅ 사용자 테이블 동기화 및 권한 설정이 완료되었습니다.';
END $$;
