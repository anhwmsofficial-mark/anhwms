-- ====================================================================
-- 긴급 패치: 누락된 컬럼 추가 및 스키마 캐시 갱신
-- ====================================================================

-- 1. inbound_plans에 inbound_manager 컬럼 추가
ALTER TABLE inbound_plans ADD COLUMN IF NOT EXISTS inbound_manager text;

-- 2. inbound_plan_lines에 현장형 컬럼 추가
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS box_count integer;
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS pallet_text text;
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS mfg_date date;
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS line_notes text;

-- 3. product_barcodes 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS product_barcodes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  product_id   uuid not null references products(id) on delete cascade,
  barcode      text not null,
  barcode_type text not null check (barcode_type in ('RETAIL','SET','INNER','OUTER')),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(org_id, barcode),
  unique(product_id, barcode, barcode_type)
);

CREATE INDEX IF NOT EXISTS product_barcodes_barcode_idx on product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS product_barcodes_product_idx on product_barcodes(product_id);

-- 4. RLS 정책 설정 (product_barcodes)
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'product_barcodes' AND policyname = 'Enable read for authenticated users'
    ) THEN
        CREATE POLICY "Enable read for authenticated users" ON product_barcodes FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'product_barcodes' AND policyname = 'Enable write for authenticated users'
    ) THEN
        CREATE POLICY "Enable write for authenticated users" ON product_barcodes FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. 스키마 캐시 새로고침 (중요: 에러 해결의 핵심)
NOTIFY pgrst, 'reload schema';
