-- 116_add_products_status_column.sql
-- products 테이블에 status 컬럼 추가 (API 500 에러 해결)
-- API 및 샘플 데이터(06)에서 status 사용 중이나, 기본 스키마에는 없음

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'ACTIVE';
    COMMENT ON COLUMN products.status IS 'ACTIVE: 판매중, INACTIVE: 판매중지 및 기타';
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  END IF;
END $$;
