-- ====================================================================
-- 38_add_inbound_photo_metadata.sql - 입고 사진 메타데이터 확장
-- ====================================================================

ALTER TABLE inbound_photos
  ADD COLUMN IF NOT EXISTS step integer,
  ADD COLUMN IF NOT EXISTS photo_type text,
  ADD COLUMN IF NOT EXISTS source text;
