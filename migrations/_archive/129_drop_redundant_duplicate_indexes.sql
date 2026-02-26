-- ====================================================================
-- Drop truly redundant duplicate indexes (safe, conservative)
-- 목적: Supabase Advisor unused_index 중 "완전 중복"으로 확인 가능한 인덱스 제거
-- 전략:
--   - 이름만 보고 삭제하지 않음
--   - pg_index 메타데이터(키/옵션/표현식/조건/유니크 여부)가 동일할 때만 삭제
-- ====================================================================

BEGIN;

DO $$
DECLARE
  can_drop boolean;
BEGIN
  -- ------------------------------------------------------------------
  -- external_quote_inquiry(assigned_to)
  -- old: idx_external_quote_assigned_to
  -- new: idx_external_quote_inquiry_assigned_to
  -- ------------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1
    FROM pg_class i_old
    JOIN pg_namespace n_old ON n_old.oid = i_old.relnamespace
    JOIN pg_index ix_old ON ix_old.indexrelid = i_old.oid
    JOIN pg_class i_new
      ON i_new.relname = 'idx_external_quote_inquiry_assigned_to'
    JOIN pg_namespace n_new
      ON n_new.oid = i_new.relnamespace
     AND n_new.nspname = n_old.nspname
    JOIN pg_index ix_new ON ix_new.indexrelid = i_new.oid
    WHERE n_old.nspname = 'public'
      AND i_old.relname = 'idx_external_quote_assigned_to'
      AND ix_old.indrelid = ix_new.indrelid
      AND ix_old.indkey = ix_new.indkey
      AND ix_old.indclass = ix_new.indclass
      AND ix_old.indcollation = ix_new.indcollation
      AND ix_old.indoption = ix_new.indoption
      AND ix_old.indisunique = ix_new.indisunique
      AND ix_old.indisprimary = ix_new.indisprimary
      AND ix_old.indpred IS NOT DISTINCT FROM ix_new.indpred
      AND ix_old.indexprs IS NOT DISTINCT FROM ix_new.indexprs
  ) INTO can_drop;

  IF can_drop THEN
    DROP INDEX IF EXISTS public.idx_external_quote_assigned_to;
  END IF;

  -- ------------------------------------------------------------------
  -- inventory_ledger(product_id)
  -- old/new naming overlap: idx_inventory_ledger_product vs _product_id
  -- ------------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1
    FROM pg_class i_old
    JOIN pg_namespace n_old ON n_old.oid = i_old.relnamespace
    JOIN pg_index ix_old ON ix_old.indexrelid = i_old.oid
    JOIN pg_class i_new
      ON i_new.relname = 'idx_inventory_ledger_product_id'
    JOIN pg_namespace n_new
      ON n_new.oid = i_new.relnamespace
     AND n_new.nspname = n_old.nspname
    JOIN pg_index ix_new ON ix_new.indexrelid = i_new.oid
    WHERE n_old.nspname = 'public'
      AND i_old.relname = 'idx_inventory_ledger_product'
      AND ix_old.indrelid = ix_new.indrelid
      AND ix_old.indkey = ix_new.indkey
      AND ix_old.indclass = ix_new.indclass
      AND ix_old.indcollation = ix_new.indcollation
      AND ix_old.indoption = ix_new.indoption
      AND ix_old.indisunique = ix_new.indisunique
      AND ix_old.indisprimary = ix_new.indisprimary
      AND ix_old.indpred IS NOT DISTINCT FROM ix_new.indpred
      AND ix_old.indexprs IS NOT DISTINCT FROM ix_new.indexprs
  ) INTO can_drop;

  IF can_drop THEN
    DROP INDEX IF EXISTS public.idx_inventory_ledger_product;
  END IF;
END
$$;

COMMIT;
