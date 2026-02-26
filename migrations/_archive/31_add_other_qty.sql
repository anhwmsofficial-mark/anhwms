-- ====================================================================
-- Add other_qty to inbound_receipt_lines
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'inbound_receipt_lines'
          AND column_name = 'other_qty'
    ) THEN
        ALTER TABLE inbound_receipt_lines
            ADD COLUMN other_qty integer not null default 0 check (other_qty >= 0);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
