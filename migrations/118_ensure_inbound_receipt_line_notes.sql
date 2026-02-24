-- Ensure Step4 field-check memo column exists.
ALTER TABLE inbound_receipt_lines
  ADD COLUMN IF NOT EXISTS notes text;
