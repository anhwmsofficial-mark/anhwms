-- ====================================================================
-- 긴급 패치: products 테이블에 barcode 컬럼 추가 (누락 시 500 에러 원인)
-- ====================================================================

DO $$
BEGIN
    -- products 테이블에 barcode 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'barcode'
    ) THEN
        ALTER TABLE products ADD COLUMN barcode text;
        CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
    END IF;
END $$;

-- inbound_plan_lines에서 product 정보를 가져오기 위한 권한 확인 및 정책 새로고침
NOTIFY pgrst, 'reload schema';
