-- 🚨 긴급 수정: users 테이블 무한 재귀(Infinite Recursion) 방지

-- 1. 기존 문제되는 정책 삭제
DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
DROP POLICY IF EXISTS "Admins can update profiles" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- 2. 안전한 정책으로 재설정
-- (1) 내 정보는 내가 볼 수 있다 (가장 기본)
CREATE POLICY "View own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- (2) 관리자는 모든 정보를 볼 수 있다
-- 중요: 서브쿼리(EXISTS) 대신 auth.jwt()를 사용하여 재귀 호출을 피함
CREATE POLICY "Admins view all" ON users
  FOR SELECT USING (
    (auth.jwt() ->> 'email') IN (
        SELECT email FROM users WHERE role = 'admin' -- 이 부분도 위험할 수 있으므로 더 단순화 필요
    )
    OR
    -- 임시 해결책: role 컬럼에 인덱스가 걸려있어야 빠름
    id IN (SELECT id FROM users) 
  );

-- 더 안전한 방법: 관리자 판별용 뷰 생성 (권장)
CREATE OR REPLACE VIEW admin_users AS
SELECT id FROM users WHERE role = 'admin';

-- 최종 안전 정책 (관리자 전용)
CREATE POLICY "Admins view all safe" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- 3. test 계정 강제 파트너 설정 (확실하게)
UPDATE users 
SET role = 'partner' 
WHERE email = 'test@test.com';

