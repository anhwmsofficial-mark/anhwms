-- ====================================================================
-- ANH WMS - 마이그레이션 상태 확인 스크립트
-- ====================================================================
-- 이 스크립트를 실행하여 마이그레이션이 제대로 실행되었는지 확인하세요
-- ====================================================================

-- ====================================================================
-- 1. 핵심 테이블 확인
-- ====================================================================

SELECT 
  'user_profiles' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
    THEN '✅ 존재함' 
    ELSE '❌ 없음 - migrations/08_auth_users.sql 실행 필요' 
  END as status,
  (SELECT COUNT(*) FROM user_profiles) as record_count
UNION ALL
SELECT 
  'org',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org') 
    THEN '✅ 존재함' 
    ELSE '❌ 없음 - migrations/01_core_customer.sql 실행 필요' 
  END,
  (SELECT COUNT(*) FROM org)
UNION ALL
SELECT 
  'customer_master',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_master') 
    THEN '✅ 존재함' 
    ELSE '❌ 없음 - migrations/01_core_customer.sql 실행 필요' 
  END,
  (SELECT COUNT(*) FROM customer_master)
UNION ALL
SELECT 
  'brand',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand') 
    THEN '✅ 존재함' 
    ELSE '❌ 없음 - migrations/01_core_customer.sql 실행 필요' 
  END,
  (SELECT COUNT(*) FROM brand)
UNION ALL
SELECT 
  'warehouse',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouse') 
    THEN '✅ 존재함' 
    ELSE '❌ 없음 - migrations/02_warehouse_product_inventory.sql 실행 필요' 
  END,
  (SELECT COUNT(*) FROM warehouse)
UNION ALL
SELECT 
  'inventory',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') 
    THEN '✅ 존재함' 
    ELSE '❌ 없음 - migrations/02_warehouse_product_inventory.sql 실행 필요' 
  END,
  (SELECT COUNT(*) FROM inventory);

-- ====================================================================
-- 2. user_profiles 테이블 상세 확인
-- ====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    RAISE NOTICE '✅ user_profiles 테이블이 존재합니다.';
    
    -- 컬럼 확인
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_profiles' AND column_name = 'can_access_admin'
    ) THEN
      RAISE NOTICE '✅ can_access_admin 컬럼이 존재합니다.';
    ELSE
      RAISE NOTICE '❌ can_access_admin 컬럼이 없습니다. migrations/08_auth_users.sql 실행 필요';
    END IF;
    
    -- RLS 확인
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'user_profiles'
    ) THEN
      RAISE NOTICE '✅ RLS 정책이 설정되어 있습니다.';
    ELSE
      RAISE NOTICE '⚠️ RLS 정책이 없습니다. migrations/08_auth_users.sql 실행 필요';
    END IF;
    
    -- 트리거 확인
    IF EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created'
    ) THEN
      RAISE NOTICE '✅ 자동 프로필 생성 트리거가 설정되어 있습니다.';
    ELSE
      RAISE NOTICE '⚠️ 자동 프로필 생성 트리거가 없습니다. migrations/08_auth_users.sql 실행 필요';
    END IF;
    
  ELSE
    RAISE NOTICE '❌ user_profiles 테이블이 없습니다. migrations/08_auth_users.sql 실행 필요';
  END IF;
END $$;

-- ====================================================================
-- 3. 사용자 확인 (auth.users와 user_profiles 비교)
-- ====================================================================

SELECT 
  'auth.users' as source,
  COUNT(*) as user_count
FROM auth.users
UNION ALL
SELECT 
  'user_profiles' as source,
  COUNT(*) as profile_count
FROM user_profiles;

-- 사용자와 프로필 불일치 확인
SELECT 
  u.id,
  u.email,
  u.created_at as user_created,
  CASE 
    WHEN p.id IS NULL THEN '❌ 프로필 없음'
    ELSE '✅ 프로필 있음'
  END as profile_status,
  p.role,
  p.can_access_admin
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;

-- ====================================================================
-- 4. 테스트 사용자 확인
-- ====================================================================

SELECT 
  '테스트 사용자 확인' as check_type,
  email,
  CASE 
    WHEN id IS NULL THEN '❌ auth.users에 없음'
    ELSE '✅ auth.users에 있음'
  END as auth_status,
  CASE 
    WHEN (SELECT id FROM user_profiles WHERE email = u.email) IS NULL THEN '❌ user_profiles에 없음'
    ELSE '✅ user_profiles에 있음'
  END as profile_status
FROM (
  SELECT 'mark.choi@anhwms.com' as email
  UNION ALL SELECT 'golden.choi@anhwms.com'
  UNION ALL SELECT 'claudia.park@anhwms.com'
) test_emails
LEFT JOIN auth.users u ON u.email = test_emails.email;

-- ====================================================================
-- 5. 권한 확인
-- ====================================================================

SELECT 
  email,
  role,
  can_access_admin,
  can_access_dashboard,
  status,
  last_login_at
FROM user_profiles
WHERE email IN (
  'mark.choi@anhwms.com',
  'golden.choi@anhwms.com',
  'claudia.park@anhwms.com'
)
ORDER BY email;

-- ====================================================================
-- 완료
-- ====================================================================
-- 이 스크립트를 실행하여 마이그레이션 상태를 확인하세요.
-- 
-- 문제가 발견되면:
-- 1. 해당 마이그레이션 파일을 다시 실행
-- 2. 에러 메시지 확인
-- 3. 필요시 migrations/00_cleanup.sql 실행 후 재시도
-- ====================================================================

