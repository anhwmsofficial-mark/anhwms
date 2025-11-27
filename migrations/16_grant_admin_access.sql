-- 16_grant_admin_access.sql
-- 사용자에게 최고 관리자 권한 부여

-- mark.choi1@anhwms.com 계정을 최고 관리자로 설정
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 이메일로 사용자 ID 찾기
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'mark.choi1@anhwms.com';

  IF v_user_id IS NOT NULL THEN
    -- user_profiles 테이블 업데이트
    UPDATE public.user_profiles
    SET
      role = 'admin',
      can_access_admin = true,
      can_manage_users = true,
      can_manage_inventory = true,
      can_manage_orders = true,
      status = 'active',
      department = 'admin',
      display_name = 'Mark Choi (CEO)',
      updated_at = now()
    WHERE id = v_user_id;

    -- 업데이트된 레코드가 없으면 새로 생성
    IF NOT FOUND THEN
      INSERT INTO public.user_profiles (
        id,
        email,
        role,
        can_access_admin,
        can_manage_users,
        can_manage_inventory,
        can_manage_orders,
        status,
        department,
        display_name,
        created_at,
        updated_at
      ) VALUES (
        v_user_id,
        'mark.choi1@anhwms.com',
        'admin',
        true,
        true,
        true,
        true,
        'active',
        'admin',
        'Mark Choi (CEO)',
        now(),
        now()
      );
    END IF;

    RAISE NOTICE '✅ mark.choi1@anhwms.com 계정이 최고 관리자로 설정되었습니다.';
  ELSE
    RAISE NOTICE '⚠️ mark.choi1@anhwms.com 계정을 찾을 수 없습니다.';
  END IF;

  -- 모든 관리자 권한 확인
  RAISE NOTICE '';
  RAISE NOTICE '📋 현재 관리자 목록:';
  RAISE NOTICE '------------------------';
  
  FOR v_user_id IN 
    SELECT p.id
    FROM public.user_profiles p
    WHERE p.can_access_admin = true
  LOOP
    RAISE NOTICE '✓ 관리자: % (역할: %)', 
      (SELECT email FROM auth.users WHERE id = v_user_id),
      (SELECT role FROM public.user_profiles WHERE id = v_user_id);
  END LOOP;
END $$;

-- 권한 설정 완료 확인
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 관리자 권한 설정이 완료되었습니다!';
  RAISE NOTICE '';
  RAISE NOTICE '다음 권한이 부여되었습니다:';
  RAISE NOTICE '  ✅ role: admin (최고 관리자)';
  RAISE NOTICE '  ✅ can_access_admin: true (관리자 페이지 접근)';
  RAISE NOTICE '  ✅ can_manage_users: true (사용자 관리)';
  RAISE NOTICE '  ✅ can_manage_inventory: true (재고 관리)';
  RAISE NOTICE '  ✅ can_manage_orders: true (주문 관리)';
  RAISE NOTICE '  ✅ status: active (활성 계정)';
  RAISE NOTICE '  ✅ department: admin (관리자 부서)';
  RAISE NOTICE '';
  RAISE NOTICE '브라우저를 새로고침(Ctrl+Shift+R)하고 다시 로그인하면';
  RAISE NOTICE '모든 관리자 기능에 접근할 수 있습니다! 🚀';
END $$;

