-- ====================================================================
-- inbound_receipt_lines 외래키 정비 (500 에러 방지)
-- ====================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- inbound_receipt_lines의 product_id 관련 외래키 중복 제거
    FOR r IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'inbound_receipt_lines' 
        AND constraint_type = 'FOREIGN KEY'
    LOOP
        -- 우리가 사용할 'fk_inbound_receipt_lines_product' 외의 다른 product_id 참조 제약조건 삭제
        IF r.constraint_name != 'fk_inbound_receipt_lines_product' AND 
           EXISTS (
               SELECT 1 
               FROM information_schema.key_column_usage 
               WHERE constraint_name = r.constraint_name 
               AND column_name = 'product_id'
           ) 
        THEN
            EXECUTE 'ALTER TABLE inbound_receipt_lines DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END IF;
    END LOOP;
END $$;

-- 외래키(fk_inbound_receipt_lines_product) 재생성/확보
ALTER TABLE inbound_receipt_lines DROP CONSTRAINT IF EXISTS fk_inbound_receipt_lines_product;

ALTER TABLE inbound_receipt_lines 
    ADD CONSTRAINT fk_inbound_receipt_lines_product 
    FOREIGN KEY (product_id) 
    REFERENCES products(id);

-- 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
