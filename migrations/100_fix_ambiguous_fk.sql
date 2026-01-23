-- ====================================================================
-- 500 에러 해결: 외래키 중복 제거 및 명시적 제약조건 재생성
-- ====================================================================

-- 1. inbound_plan_lines의 product_id 관련 외래키 정리
DO $$
DECLARE
    r RECORD;
BEGIN
    -- product_id를 참조하는 모든 외래키 제약조건 찾기
    FOR r IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'inbound_plan_lines' 
        AND constraint_type = 'FOREIGN KEY'
    LOOP
        -- 우리가 사용할 'fk_inbound_plan_lines_product'가 아닌 다른 이름의 외래키가 있다면 삭제 (중복 방지)
        -- 만약 기존 제약조건 이름이 'inbound_plan_lines_product_id_fkey'라면 삭제됨
        IF r.constraint_name != 'fk_inbound_plan_lines_product' AND 
           EXISTS (
               SELECT 1 
               FROM information_schema.key_column_usage 
               WHERE constraint_name = r.constraint_name 
               AND column_name = 'product_id'
           ) 
        THEN
            EXECUTE 'ALTER TABLE inbound_plan_lines DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END IF;
    END LOOP;
END $$;

-- 2. 우리가 사용할 외래키(fk_inbound_plan_lines_product)를 확실하게 재생성
ALTER TABLE inbound_plan_lines DROP CONSTRAINT IF EXISTS fk_inbound_plan_lines_product;

ALTER TABLE inbound_plan_lines 
    ADD CONSTRAINT fk_inbound_plan_lines_product 
    FOREIGN KEY (product_id) 
    REFERENCES products(id);

-- 3. products 테이블 barcode 컬럼 확인 (다시 한번)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'barcode'
    ) THEN
        ALTER TABLE products ADD COLUMN barcode text;
        CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
    END IF;
END $$;

-- 4. 스키마 캐시 새로고침 (필수)
NOTIFY pgrst, 'reload schema';
