-- ====================================================================
-- 테스트용 거래처 샘플 데이터 생성
-- ====================================================================

-- 1. 국내 D2C 브랜드
INSERT INTO customer_master (
  code, name, type, country_code,
  business_reg_no, billing_currency, billing_cycle, payment_terms,
  contact_name, contact_email, contact_phone,
  address_line1, address_line2, city, postal_code,
  status, note, created_at, updated_at
) VALUES (
  'CUS-2024-001',
  '(주)더좋은쇼핑',
  'CLIENT_BRAND',
  'KR',
  '123-45-67890',
  'KRW',
  'MONTHLY',
  30,
  '김영희',
  'yhkim@bettershopping.com',
  '02-1234-5678',
  '서울시 강남구 테헤란로 123',
  '더좋은빌딩 5층',
  '서울',
  '06234',
  'ACTIVE',
  '월 출고량 약 3,000건. 패션/뷰티 카테고리 주력. 스마트스토어 + 자사몰 운영.',
  now(),
  now()
);

-- 2. 해외 진출 중인 뷰티 브랜드
INSERT INTO customer_master (
  code, name, type, country_code,
  business_reg_no, billing_currency, billing_cycle, payment_terms,
  contact_name, contact_email, contact_phone,
  address_line1, city, postal_code,
  status, note, created_at, updated_at
) VALUES (
  'CUS-2024-002',
  '(주)글로벌뷰티코리아',
  'CLIENT_BRAND',
  'KR',
  '234-56-78901',
  'USD',
  'MONTHLY',
  45,
  '박지성',
  'jpark@globalbeauty.kr',
  '02-2345-6789',
  '서울시 송파구 올림픽로 234',
  '서울',
  '05678',
  'ACTIVE',
  '중국 + 일본 크로스보더 진행 중. 냉장 보관 필요 상품 다수.',
  now(),
  now()
);

-- 3. 대행사
INSERT INTO customer_master (
  code, name, type, country_code,
  business_reg_no, billing_currency, billing_cycle, payment_terms,
  contact_name, contact_email, contact_phone,
  address_line1, city, postal_code,
  status, note, created_at, updated_at
) VALUES (
  'CUS-2024-003',
  '스마트커머스 에이전시',
  'CLIENT_AGENCY',
  'KR',
  '345-67-89012',
  'KRW',
  'MONTHLY',
  30,
  '이민호',
  'mhlee@smartagency.com',
  '031-3456-7890',
  '경기도 성남시 분당구 판교로 345',
  '성남',
  '13494',
  'ACTIVE',
  '10개 브랜드 대행 중. 통합 정산 계약.',
  now(),
  now()
);

-- 4. 멀티브랜드 셀러
INSERT INTO customer_master (
  code, name, type, country_code,
  business_reg_no, billing_currency, billing_cycle, payment_terms,
  contact_name, contact_email, contact_phone,
  address_line1, city, postal_code,
  status, note, created_at, updated_at
) VALUES (
  'CUS-2024-004',
  '올라잇 트레이딩',
  'CLIENT_MULTI_BRAND',
  'KR',
  '456-78-90123',
  'KRW',
  'MONTHLY',
  30,
  '최수진',
  'sjchoi@allright.co.kr',
  '032-4567-8901',
  '인천시 남동구 인주대로 456',
  '인천',
  '21542',
  'ACTIVE',
  '리빙/디지털 카테고리 중심. SKU 약 500개.',
  now(),
  now()
);

-- 5. 포워더 (물류 파트너)
INSERT INTO customer_master (
  code, name, type, country_code,
  business_reg_no, billing_currency, billing_cycle, payment_terms,
  contact_name, contact_email, contact_phone,
  address_line1, city, postal_code,
  status, note, created_at, updated_at
) VALUES (
  'CUS-2024-005',
  '글로벌로지스 포워딩',
  'PARTNER_FORWARDER',
  'KR',
  '567-89-01234',
  'KRW',
  'MONTHLY',
  60,
  '정태양',
  'tyjung@globallogis.com',
  '02-5678-9012',
  '서울시 강서구 공항대로 567',
  '서울',
  '07505',
  'ACTIVE',
  '중국/동남아 해상/항공 포워딩 협력사. B2B 계약.',
  now(),
  now()
);

-- 6. 잠재 고객 (PROSPECT)
INSERT INTO customer_master (
  code, name, type, country_code,
  billing_currency, billing_cycle, payment_terms,
  contact_name, contact_email, contact_phone,
  status, note, created_at, updated_at
) VALUES (
  'CUS-2024-006',
  '(주)신규브랜드컴퍼니',
  'PROSPECT',
  'KR',
  'KRW',
  'MONTHLY',
  30,
  '강민수',
  'mskang@newbrand.com',
  '010-6789-0123',
  'PROSPECT',
  '견적 문의 단계. 월 출고량 예상 1,500건.',
  now(),
  now()
);

-- 샘플 거래처 ID 확인용
DO $$
DECLARE
  customer_id UUID;
  customer_code TEXT;
  customer_name TEXT;
BEGIN
  RAISE NOTICE '=== 테스트용 거래처 샘플 데이터 생성 완료 ===';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 거래처 목록:';
  RAISE NOTICE '';
  
  FOR customer_id, customer_code, customer_name IN
    SELECT id, code, name 
    FROM customer_master 
    WHERE code LIKE 'CUS-2024-%'
    ORDER BY code
  LOOP
    RAISE NOTICE '거래처 ID: %', customer_id;
    RAISE NOTICE '거래처 코드: %', customer_code;
    RAISE NOTICE '거래처명: %', customer_name;
    RAISE NOTICE '상세 URL: https://www.anhwms.com/admin/customers/%', customer_id;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '=== 총 % 개의 테스트 거래처 생성됨 ===', (SELECT COUNT(*) FROM customer_master WHERE code LIKE 'CUS-2024-%');
END $$;

-- 거래처별 샘플 담당자 추가
DO $$
DECLARE
  customer_rec RECORD;
BEGIN
  FOR customer_rec IN 
    SELECT id, code, name FROM customer_master WHERE code LIKE 'CUS-2024-%'
  LOOP
    -- 주 담당자 추가
    INSERT INTO customer_contact (
      customer_master_id, name, title, department, role,
      email, phone, mobile,
      preferred_contact, is_primary, is_active,
      timezone, language,
      created_at, updated_at
    ) VALUES (
      customer_rec.id,
      CASE 
        WHEN customer_rec.code = 'CUS-2024-001' THEN '김영희'
        WHEN customer_rec.code = 'CUS-2024-002' THEN '박지성'
        WHEN customer_rec.code = 'CUS-2024-003' THEN '이민호'
        WHEN customer_rec.code = 'CUS-2024-004' THEN '최수진'
        WHEN customer_rec.code = 'CUS-2024-005' THEN '정태양'
        WHEN customer_rec.code = 'CUS-2024-006' THEN '강민수'
      END,
      '대표이사',
      '경영진',
      'PRIMARY',
      CASE 
        WHEN customer_rec.code = 'CUS-2024-001' THEN 'yhkim@bettershopping.com'
        WHEN customer_rec.code = 'CUS-2024-002' THEN 'jpark@globalbeauty.kr'
        WHEN customer_rec.code = 'CUS-2024-003' THEN 'mhlee@smartagency.com'
        WHEN customer_rec.code = 'CUS-2024-004' THEN 'sjchoi@allright.co.kr'
        WHEN customer_rec.code = 'CUS-2024-005' THEN 'tyjung@globallogis.com'
        WHEN customer_rec.code = 'CUS-2024-006' THEN 'mskang@newbrand.com'
      END,
      CASE 
        WHEN customer_rec.code = 'CUS-2024-001' THEN '02-1234-5678'
        WHEN customer_rec.code = 'CUS-2024-002' THEN '02-2345-6789'
        WHEN customer_rec.code = 'CUS-2024-003' THEN '031-3456-7890'
        WHEN customer_rec.code = 'CUS-2024-004' THEN '032-4567-8901'
        WHEN customer_rec.code = 'CUS-2024-005' THEN '02-5678-9012'
        WHEN customer_rec.code = 'CUS-2024-006' THEN NULL
      END,
      '010-' || LPAD((RANDOM() * 9999)::INTEGER::TEXT, 4, '0') || '-' || LPAD((RANDOM() * 9999)::INTEGER::TEXT, 4, '0'),
      'EMAIL',
      TRUE,
      TRUE,
      'Asia/Seoul',
      'ko',
      now(),
      now()
    );
    
    -- 운영 담당자 추가 (CUS-2024-001, 002, 003만)
    IF customer_rec.code IN ('CUS-2024-001', 'CUS-2024-002', 'CUS-2024-003') THEN
      INSERT INTO customer_contact (
        customer_master_id, name, title, department, role,
        email, phone, mobile,
        preferred_contact, is_primary, is_active,
        timezone, language,
        created_at, updated_at
      ) VALUES (
        customer_rec.id,
        CASE 
          WHEN customer_rec.code = 'CUS-2024-001' THEN '홍길동'
          WHEN customer_rec.code = 'CUS-2024-002' THEN '이영미'
          WHEN customer_rec.code = 'CUS-2024-003' THEN '김철수'
        END,
        '팀장',
        '운영팀',
        'OPERATION',
        CASE 
          WHEN customer_rec.code = 'CUS-2024-001' THEN 'gdhong@bettershopping.com'
          WHEN customer_rec.code = 'CUS-2024-002' THEN 'ymlee@globalbeauty.kr'
          WHEN customer_rec.code = 'CUS-2024-003' THEN 'cskim@smartagency.com'
        END,
        NULL,
        '010-' || LPAD((RANDOM() * 9999)::INTEGER::TEXT, 4, '0') || '-' || LPAD((RANDOM() * 9999)::INTEGER::TEXT, 4, '0'),
        'EMAIL',
        FALSE,
        TRUE,
        'Asia/Seoul',
        'ko',
        now(),
        now()
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== 담당자 데이터 생성 완료 ===';
END $$;

-- 샘플 계약 추가 (CUS-2024-001, 002)
DO $$
DECLARE
  customer_id_001 UUID;
  customer_id_002 UUID;
BEGIN
  SELECT id INTO customer_id_001 FROM customer_master WHERE code = 'CUS-2024-001';
  SELECT id INTO customer_id_002 FROM customer_master WHERE code = 'CUS-2024-002';
  
  -- CUS-2024-001 계약
  IF customer_id_001 IS NOT NULL THEN
    INSERT INTO customer_contract (
      customer_master_id, contract_no, contract_name, contract_type,
      contract_start, contract_end,
      auto_renewal, renewal_notice_days, renewal_count,
      contract_amount, currency, payment_terms, payment_method, billing_cycle,
      sla_inbound_processing, sla_outbound_cutoff, sla_accuracy_rate, sla_ontime_ship_rate,
      status, signed_date, signed_by_customer, signed_by_company,
      note,
      created_at, updated_at
    ) VALUES (
      customer_id_001,
      'CON-2024-001',
      '2024년 풀필먼트 서비스 기본 계약',
      'SERVICE_AGREEMENT',
      '2024-01-01'::DATE,
      '2024-12-31'::DATE,
      TRUE,
      90,
      0,
      120000000,
      'KRW',
      30,
      '계좌이체',
      'MONTHLY',
      2,
      '14:00',
      99.8,
      99.5,
      'ACTIVE',
      '2023-12-15'::DATE,
      '김영희',
      '안현수',
      '월 출고량 기준 변동 단가제. SLA 조건 포함.',
      now(),
      now()
    );
  END IF;
  
  -- CUS-2024-002 계약
  IF customer_id_002 IS NOT NULL THEN
    INSERT INTO customer_contract (
      customer_master_id, contract_no, contract_name, contract_type,
      contract_start, contract_end,
      auto_renewal, renewal_notice_days, renewal_count,
      contract_amount, currency, payment_terms, payment_method, billing_cycle,
      status, signed_date, signed_by_customer, signed_by_company,
      note,
      created_at, updated_at
    ) VALUES (
      customer_id_002,
      'CON-2024-002',
      '2024년 해외배송 풀필먼트 계약',
      'SERVICE_AGREEMENT',
      '2024-03-01'::DATE,
      '2025-02-28'::DATE,
      FALSE,
      60,
      0,
      180000000,
      'USD',
      45,
      'L/C',
      'MONTHLY',
      'ACTIVE',
      '2024-02-20'::DATE,
      '박지성',
      '안현수',
      '중국/일본 크로스보더 특화. 냉장 보관 서비스 포함.',
      now(),
      now()
    );
  END IF;
  
  RAISE NOTICE '=== 계약 데이터 생성 완료 ===';
END $$;

-- 샘플 가격 정책 추가
DO $$
DECLARE
  customer_id_001 UUID;
BEGIN
  SELECT id INTO customer_id_001 FROM customer_master WHERE code = 'CUS-2024-001';
  
  IF customer_id_001 IS NULL THEN
    RAISE NOTICE 'CUS-2024-001 거래처를 찾을 수 없습니다. 가격 정책 생성을 건너뜁니다.';
    RETURN;
  END IF;
  
  -- 보관 단가
  INSERT INTO customer_pricing (
    customer_master_id, pricing_type, service_name, service_code,
    unit_price, currency, unit,
    effective_from, effective_to,
    is_active, requires_approval,
    note,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'STORAGE',
    '일반 보관',
    'STG-NORMAL',
    8000,
    'KRW',
    'CBM/일',
    '2024-01-01'::DATE,
    NULL,
    TRUE,
    FALSE,
    '월 말일 기준 평균 CBM 계산',
    now(),
    now()
  );
  
  -- 입고 단가
  INSERT INTO customer_pricing (
    customer_master_id, pricing_type, service_name, service_code,
    unit_price, currency, unit,
    effective_from, effective_to,
    is_active, requires_approval,
    note,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'INBOUND',
    '일반 입고',
    'INB-NORMAL',
    150,
    'KRW',
    '건',
    '2024-01-01'::DATE,
    NULL,
    TRUE,
    FALSE,
    '검수 포함',
    now(),
    now()
  );
  
  -- 출고 단가
  INSERT INTO customer_pricing (
    customer_master_id, pricing_type, service_name, service_code,
    unit_price, currency, unit,
    min_quantity, max_quantity,
    effective_from, effective_to,
    is_active, requires_approval,
    volume_discount_rate, volume_threshold,
    note,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'OUTBOUND',
    '일반 출고',
    'OUT-NORMAL',
    800,
    'KRW',
    '건',
    1,
    3000,
    '2024-01-01'::DATE,
    NULL,
    TRUE,
    FALSE,
    5,
    3000,
    '피킹 + 검수 + 포장 포함. 3,000건 초과 시 5% 할인',
    now(),
    now()
  );
  
  -- 포장 단가
  INSERT INTO customer_pricing (
    customer_master_id, pricing_type, service_name, service_code,
    unit_price, currency, unit,
    effective_from, effective_to,
    is_active, requires_approval,
    note,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'PACKING',
    '에어캡 포장',
    'PACK-BUBBLE',
    300,
    'KRW',
    '건',
    '2024-01-01'::DATE,
    NULL,
    TRUE,
    FALSE,
    '에어캡 단면 포장',
    now(),
    now()
  );
  
  RAISE NOTICE '=== 가격 정책 데이터 생성 완료 ===';
END $$;

-- 샘플 활동 이력 추가
DO $$
DECLARE
  customer_id_001 UUID;
  contact_id_001 UUID;
BEGIN
  SELECT id INTO customer_id_001 FROM customer_master WHERE code = 'CUS-2024-001';
  
  IF customer_id_001 IS NULL THEN
    RAISE NOTICE 'CUS-2024-001 거래처를 찾을 수 없습니다. 활동 이력 생성을 건너뜁니다.';
    RETURN;
  END IF;
  
  SELECT id INTO contact_id_001 FROM customer_contact WHERE customer_master_id = customer_id_001 AND is_primary = TRUE LIMIT 1;
  
  -- 계약 체결 활동
  INSERT INTO customer_activity (
    customer_master_id, activity_type, subject, description,
    related_contact_id, priority, requires_followup,
    activity_date, duration_minutes, tags,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'CONTRACT_SIGNED',
    '2024년 풀필먼트 서비스 계약 체결',
    '기본 계약서 서명 완료. SLA 조건 협의 완료. 1월 1일부터 서비스 개시 예정.',
    contact_id_001,
    'HIGH',
    FALSE,
    '2023-12-15 14:30:00'::TIMESTAMP,
    90,
    ARRAY['계약', '2024년'],
    now(),
    now()
  );
  
  -- 정기 미팅
  INSERT INTO customer_activity (
    customer_master_id, activity_type, subject, description,
    related_contact_id, priority, requires_followup, followup_due_date,
    activity_date, duration_minutes, tags,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'MEETING',
    '2024년 1분기 정기 미팅',
    '출고량 증가 추세 확인. 신규 SKU 100개 입고 예정. 포장 자재 변경 요청 검토 필요.',
    contact_id_001,
    'NORMAL',
    TRUE,
    (CURRENT_DATE + INTERVAL '7 days')::DATE,
    '2024-03-20 15:00:00'::TIMESTAMP,
    60,
    ARRAY['정기미팅', '1분기'],
    now(),
    now()
  );
  
  -- 이슈 처리
  INSERT INTO customer_activity (
    customer_master_id, activity_type, subject, description,
    related_contact_id, priority, requires_followup, followup_completed,
    activity_date, duration_minutes, tags,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'ISSUE',
    '출고 지연 건 처리',
    '택배사 파업으로 인한 출고 지연 발생. 고객 안내 완료. 대체 택배사 배정.',
    contact_id_001,
    'URGENT',
    FALSE,
    TRUE,
    '2024-02-15 09:30:00'::TIMESTAMP,
    45,
    ARRAY['이슈', '출고지연', '해결완료'],
    now(),
    now()
  );
  
  -- 전화 상담
  INSERT INTO customer_activity (
    customer_master_id, activity_type, subject, description,
    related_contact_id, priority, requires_followup,
    activity_date, duration_minutes, tags,
    created_at, updated_at
  ) VALUES (
    customer_id_001,
    'CALL',
    '냉장 보관 서비스 문의',
    '신규 뷰티 라인 출시 예정. 냉장 보관 필요한 SKU 약 30개. 견적 요청.',
    contact_id_001,
    'HIGH',
    TRUE,
    (CURRENT_DATE - INTERVAL '2 days')::TIMESTAMP,
    15,
    ARRAY['냉장보관', '견적'],
    now(),
    now()
  );
  
  RAISE NOTICE '=== 활동 이력 데이터 생성 완료 ===';
END $$;

-- 최종 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '테스트용 거래처 샘플 데이터 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '어드민에서 확인:';
  RAISE NOTICE 'https://www.anhwms.com/admin/customers';
  RAISE NOTICE '';
END $$;
