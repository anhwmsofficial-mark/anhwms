-- ====================================================================
-- 권한 및 RLS 정책 일괄 정리 (Fix Permissions)
-- ====================================================================

-- 1. users 테이블 권한 완화 (가장 흔한 권한 문제 원인)
-- authenticated 사용자가 기본적으로 사용자 목록을 조회할 수 있도록 허용 (드롭다운 등 표시용)
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;

CREATE POLICY "Enable read access for authenticated users" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable update for users themselves" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. 핵심 마스터 테이블 권한 보장 (org, warehouse, client, products)
-- 이미 permissive하지만 확실하게 재적용
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('org', 'warehouse', 'customer_master', 'products', 'brand', 'location')
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for authenticated users" ON %I', t);
        EXECUTE format('CREATE POLICY "Enable read access for authenticated users" ON %I FOR SELECT TO authenticated USING (true)', t);
        
        -- 쓰기 권한은 authenticated에게 허용 (내부 운영 툴이므로)
        EXECUTE format('DROP POLICY IF EXISTS "Enable write access for authenticated users" ON %I', t);
        EXECUTE format('CREATE POLICY "Enable write access for authenticated users" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP; 
END $$;

-- 3. 입고(Inbound) 관련 테이블 권한 보장
-- inbound_plans, inbound_receipts 등
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name LIKE 'inbound_%'
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', t);
        EXECUTE format('CREATE POLICY "Enable all access for authenticated users" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP; 
END $$;

-- 4. 재고(Inventory) 관련 테이블 권한 보장
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('inventory_ledger', 'inventory_quantities', 'inventory_transaction')
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', t);
        EXECUTE format('CREATE POLICY "Enable all access for authenticated users" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP; 
END $$;

-- 5. Storage 권한 (사진 업로드 필수)
-- storage.objects 테이블에 대한 정책 설정
BEGIN;
  -- 'inbound' 버킷 생성 (없으면)
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('inbound', 'inbound', true)
  ON CONFLICT (id) DO NOTHING;

  -- RLS 정책 (storage.objects)
  DROP POLICY IF EXISTS "Give me access to own files 123" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
  DROP POLICY IF EXISTS "Public access to inbound bucket" ON storage.objects;

  -- 읽기: 누구나 (공개 버킷)
  CREATE POLICY "Public access to inbound bucket" ON storage.objects FOR SELECT USING (bucket_id = 'inbound');
  
  -- 쓰기/수정/삭제: 인증된 사용자
  CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'inbound');
  CREATE POLICY "Authenticated users can update files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'inbound');
  CREATE POLICY "Authenticated users can delete files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'inbound');
COMMIT;

-- 6. RPC 함수 실행 권한
GRANT EXECUTE ON FUNCTION confirm_inbound_receipt(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_inbound_receipt(UUID, UUID) TO service_role;
