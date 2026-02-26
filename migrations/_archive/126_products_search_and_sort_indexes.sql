-- ====================================================================
-- products 검색/정렬 성능 개선 인덱스
-- 목적: ilike 검색(name/sku/barcode) 및 created_at 정렬 비용 절감
-- ====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 목록 조회 기본 정렬(created_at desc) 최적화
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc
  ON products(created_at DESC);

-- 상태 필터 + 생성일 정렬 조합 최적화 (status 컬럼이 있는 환경만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_status_created_at_desc
      ON products(status, created_at DESC);
  END IF;
END $$;

-- ILIKE 검색 최적화 (trigram GIN)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
  ON products USING gin (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_barcode_trgm
  ON products USING gin (barcode gin_trgm_ops);

COMMIT;
