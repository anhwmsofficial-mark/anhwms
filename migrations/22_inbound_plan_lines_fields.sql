-- ====================================================================
-- Inbound Plan Lines: 현장형 컬럼 확장
-- ====================================================================

ALTER TABLE inbound_plan_lines
  ADD COLUMN IF NOT EXISTS box_count integer,
  ADD COLUMN IF NOT EXISTS pallet_text text,
  ADD COLUMN IF NOT EXISTS mfg_date date,
  ADD COLUMN IF NOT EXISTS line_notes text;
