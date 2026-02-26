-- ====================================================================
-- 제품 추가 필드 확장 (신규 제품 등록 요구사항)
-- ====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE products ADD COLUMN customer_id UUID REFERENCES partners(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_products_customer_id ON products(customer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'manage_name'
  ) THEN
    ALTER TABLE products ADD COLUMN manage_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'user_code'
  ) THEN
    ALTER TABLE products ADD COLUMN user_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'product_db_no'
  ) THEN
    ALTER TABLE products ADD COLUMN product_db_no TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_db_no ON products(product_db_no);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'manufacture_date'
  ) THEN
    ALTER TABLE products ADD COLUMN manufacture_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE products ADD COLUMN expiry_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'option_size'
  ) THEN
    ALTER TABLE products ADD COLUMN option_size TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'option_color'
  ) THEN
    ALTER TABLE products ADD COLUMN option_color TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'option_lot'
  ) THEN
    ALTER TABLE products ADD COLUMN option_lot TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'option_etc'
  ) THEN
    ALTER TABLE products ADD COLUMN option_etc TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'cost_price'
  ) THEN
    ALTER TABLE products ADD COLUMN cost_price NUMERIC(12, 2) DEFAULT 0;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
