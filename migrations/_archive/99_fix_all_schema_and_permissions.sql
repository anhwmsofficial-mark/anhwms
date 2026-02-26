-- ====================================================================
-- 통합 긴급 패치: 외래키 연결, 컬럼 추가, 스키마 캐시 갱신
-- ====================================================================

-- 1. inbound_plans 테이블 수정
ALTER TABLE inbound_plans ADD COLUMN IF NOT EXISTS inbound_manager text;

-- 화주사(client_id) 외래키 연결 (inbound_plans)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_plans_client') THEN
        ALTER TABLE inbound_plans 
        ADD CONSTRAINT fk_inbound_plans_client 
        FOREIGN KEY (client_id) 
        REFERENCES customer_master(id);
    END IF;
END $$;

-- 2. inbound_plan_lines 테이블 수정 (컬럼 추가)
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS box_count integer;
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS pallet_text text;
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS mfg_date date;
ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS line_notes text;

-- 상품(product_id) 외래키 연결 (inbound_plan_lines)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_plan_lines_product') THEN
        ALTER TABLE inbound_plan_lines 
        ADD CONSTRAINT fk_inbound_plan_lines_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(id);
    END IF;
END $$;

-- 3. inbound_receipts 테이블 수정 (외래키 연결)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipts_client') THEN
        ALTER TABLE inbound_receipts ADD CONSTRAINT fk_inbound_receipts_client FOREIGN KEY (client_id) REFERENCES customer_master(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipts_warehouse') THEN
        ALTER TABLE inbound_receipts ADD CONSTRAINT fk_inbound_receipts_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouse(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipts_org') THEN
        ALTER TABLE inbound_receipts ADD CONSTRAINT fk_inbound_receipts_org FOREIGN KEY (org_id) REFERENCES org(id);
    END IF;
END $$;

-- 4. inbound_receipt_lines 테이블 수정 (외래키 연결)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipt_lines_product') THEN
        ALTER TABLE inbound_receipt_lines ADD CONSTRAINT fk_inbound_receipt_lines_product FOREIGN KEY (product_id) REFERENCES products(id);
    END IF;
END $$;

-- 5. product_barcodes 테이블 생성 (없는 경우)
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

-- RLS 정책 설정 (product_barcodes)
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

-- 6. 스키마 캐시 강력 새로고침 (중요)
NOTIFY pgrst, 'reload schema';
