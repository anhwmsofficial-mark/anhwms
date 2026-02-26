-- ====================================================================
-- Product Barcodes: 리테일/세트/내부/외부 바코드 매핑
-- ====================================================================

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

ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON product_barcodes;
DROP POLICY IF EXISTS "Enable write for authenticated users" ON product_barcodes;
CREATE POLICY "Enable read for authenticated users" ON product_barcodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write for authenticated users" ON product_barcodes FOR ALL TO authenticated USING (true) WITH CHECK (true);
