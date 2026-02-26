-- ====================================================================
-- Auto-create covering indexes for unindexed foreign keys
-- 목적: Supabase Advisor(0001_unindexed_foreign_keys) 항목 일괄 해소
-- 안전장치:
--   - 이미 FK 선두(prefix)를 커버하는 인덱스가 있으면 생성하지 않음
--   - partial/expression 인덱스는 커버 인덱스로 간주하지 않음
-- ====================================================================

BEGIN;

DO $$
DECLARE
  fk_rec record;
  idx_name text;
  base_name text;
BEGIN
  FOR fk_rec IN
    WITH fk_constraints AS (
      SELECT
        c.oid AS constraint_oid,
        ns.nspname AS schema_name,
        tbl.relname AS table_name,
        c.conname AS constraint_name,
        c.conrelid AS table_oid,
        c.conkey AS fk_attnums,
        array_length(c.conkey, 1) AS fk_col_count
      FROM pg_constraint c
      JOIN pg_class tbl ON tbl.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      WHERE c.contype = 'f'
        AND ns.nspname = 'public'
    ),
    fk_columns AS (
      SELECT
        fk.constraint_oid,
        fk.schema_name,
        fk.table_name,
        fk.constraint_name,
        fk.table_oid,
        fk.fk_attnums,
        fk.fk_col_count,
        string_agg(quote_ident(att.attname), ', ' ORDER BY u.ord) AS index_columns_sql,
        string_agg(att.attname, '_' ORDER BY u.ord) AS index_columns_name
      FROM fk_constraints fk
      JOIN unnest(fk.fk_attnums) WITH ORDINALITY AS u(attnum, ord) ON TRUE
      JOIN pg_attribute att
        ON att.attrelid = fk.table_oid
       AND att.attnum = u.attnum
      GROUP BY
        fk.constraint_oid,
        fk.schema_name,
        fk.table_name,
        fk.constraint_name,
        fk.table_oid,
        fk.fk_attnums,
        fk.fk_col_count
    )
    SELECT
      fkc.schema_name,
      fkc.table_name,
      fkc.constraint_name,
      fkc.index_columns_sql,
      fkc.index_columns_name
    FROM fk_columns fkc
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = fkc.table_oid
        AND i.indisvalid
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND (string_to_array(i.indkey::text, ' ')::smallint[])[1:fkc.fk_col_count] = fkc.fk_attnums
    )
  LOOP
    base_name := format(
      'idx_%s_%s_fk',
      fk_rec.table_name,
      fk_rec.index_columns_name
    );

    -- PostgreSQL identifier length 제한(63) 대응
    IF length(base_name) > 63 THEN
      idx_name := format(
        '%s_%s',
        left(base_name, 54),
        left(md5(base_name), 8)
      );
    ELSE
      idx_name := base_name;
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      idx_name,
      fk_rec.schema_name,
      fk_rec.table_name,
      fk_rec.index_columns_sql
    );
  END LOOP;
END
$$;

COMMIT;
