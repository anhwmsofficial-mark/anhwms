-- ====================================================================
-- Inbound receipt share links (public read-only sharing)
-- ====================================================================

CREATE TABLE IF NOT EXISTS inbound_receipt_shares (
  id               uuid primary key default gen_random_uuid(),
  receipt_id       uuid not null references inbound_receipts(id) on delete cascade,
  slug             text not null unique,
  expires_at       timestamptz,
  password_salt    text,
  password_hash    text,
  language_default text not null default 'ko',
  summary_ko       text,
  summary_en       text,
  summary_zh       text,
  content          jsonb not null default '{}'::jsonb,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_accessed_at timestamptz
);

CREATE INDEX IF NOT EXISTS inbound_receipt_shares_receipt_id_idx
  ON inbound_receipt_shares(receipt_id);

CREATE INDEX IF NOT EXISTS inbound_receipt_shares_slug_idx
  ON inbound_receipt_shares(slug);

ALTER TABLE inbound_receipt_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'inbound_receipt_shares'
      AND policyname = 'Enable read for authenticated users'
  ) THEN
    CREATE POLICY "Enable read for authenticated users"
      ON inbound_receipt_shares
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_inbound_receipt_shares_modtime'
  ) THEN
    CREATE TRIGGER update_inbound_receipt_shares_modtime
    BEFORE UPDATE ON inbound_receipt_shares
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
