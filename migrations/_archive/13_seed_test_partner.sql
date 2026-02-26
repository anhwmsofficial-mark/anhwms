-- [설정] 연결할 유저 이메일을 입력하세요
DO $$
DECLARE
    v_user_email TEXT := 'partner@test.com'; -- 👈 1단계에서 만든 이메일과 똑같이 적어주세요!
    v_partner_name TEXT := '(주)테스트 파트너스';
    v_partner_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. 테스트용 파트너사 데이터 생성 (이미 있으면 건너뜀)
    INSERT INTO partners (name, type, contact, phone, email, address)
    VALUES (v_partner_name, 'customer', '김파트너', '010-9999-8888', 'contact@test.com', '서울시 강남구 테헤란로 123')
    ON CONFLICT DO NOTHING;

    -- 2. 파트너사 ID 찾기
    SELECT id INTO v_partner_id FROM partners WHERE name = v_partner_name LIMIT 1;

    -- 3. 유저 ID 찾기
    SELECT id INTO v_user_id FROM users WHERE email = v_user_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '❌ 유저를 찾을 수 없습니다! Supabase Auth에서 % 계정을 먼저 만들어주세요.', v_user_email;
    END IF;

    -- 4. 유저 권한 업데이트 (Partner Role + Partner ID 연결)
    UPDATE users
    SET 
        role = 'partner',
        partner_id = v_partner_id,
        updated_at = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE '✅ 설정 완료!';
    RAISE NOTICE '이제 % 계정으로 로그인하면 파트너 포털로 접속됩니다.', v_user_email;
    RAISE NOTICE '연결된 파트너사: % (ID: %)', v_partner_name, v_partner_id;

END $$;

