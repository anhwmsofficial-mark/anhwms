-- ====================================================================
-- 35_add_receipt_documents.sql - 인수증 PDF 문서 관리
-- ====================================================================

CREATE TABLE IF NOT EXISTS receipt_documents (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid,
  receipt_id      uuid references inbound_receipts(id) on delete set null,
  receipt_no      text,
  file_name       text not null,
  storage_bucket  text not null default 'inbound',
  storage_path    text not null,
  public_url      text,
  mime_type       text,
  file_size       bigint,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS receipt_documents_receipt_idx on receipt_documents(receipt_id);
CREATE INDEX IF NOT EXISTS receipt_documents_created_at_idx on receipt_documents(created_at);

ALTER TABLE receipt_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON receipt_documents;
DROP POLICY IF EXISTS "Enable write access for authenticated users" ON receipt_documents;
CREATE POLICY "Enable read access for authenticated users" ON receipt_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON receipt_documents
  FOR INSERT TO authenticated WITH CHECK (true);
