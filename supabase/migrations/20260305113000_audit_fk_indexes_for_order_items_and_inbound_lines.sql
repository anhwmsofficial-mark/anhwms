-- FK index audit for frequently joined line tables.
-- Covers both requested names (order_items, inbound_lines) and
-- current schema names (outbound_order_line, inbound_receipt_lines).

DO $$
DECLARE
  v_has_leading_index boolean;
BEGIN
  -- Legacy/alternate table names
  IF to_regclass('public.order_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id_fk
      ON public.order_items (order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product_id_fk
      ON public.order_items (product_id);
  END IF;

  IF to_regclass('public.inbound_lines') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_inbound_lines_inbound_id_fk
      ON public.inbound_lines (inbound_id);
    CREATE INDEX IF NOT EXISTS idx_inbound_lines_product_id_fk
      ON public.inbound_lines (product_id);
  END IF;

  -- Current schema: outbound_order_line
  IF to_regclass('public.outbound_order_line') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ord) ON cols.ord = 1
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
      WHERE n.nspname = 'public'
        AND t.relname = 'outbound_order_line'
        AND a.attname = 'outbound_id'
    ) INTO v_has_leading_index;

    IF NOT v_has_leading_index THEN
      CREATE INDEX IF NOT EXISTS idx_outbound_order_line_outbound_id_fk
        ON public.outbound_order_line (outbound_id);
    END IF;
  END IF;

  -- Current schema: inbound_receipt_lines
  IF to_regclass('public.inbound_receipt_lines') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ord) ON cols.ord = 1
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
      WHERE n.nspname = 'public'
        AND t.relname = 'inbound_receipt_lines'
        AND a.attname = 'receipt_id'
    ) INTO v_has_leading_index;

    IF NOT v_has_leading_index THEN
      CREATE INDEX IF NOT EXISTS idx_inbound_receipt_lines_receipt_id_fk
        ON public.inbound_receipt_lines (receipt_id);
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ord) ON cols.ord = 1
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
      WHERE n.nspname = 'public'
        AND t.relname = 'inbound_receipt_lines'
        AND a.attname = 'plan_line_id'
    ) INTO v_has_leading_index;

    IF NOT v_has_leading_index THEN
      CREATE INDEX IF NOT EXISTS idx_inbound_receipt_lines_plan_line_id_fk
        ON public.inbound_receipt_lines (plan_line_id);
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS cols(attnum, ord) ON cols.ord = 1
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
      WHERE n.nspname = 'public'
        AND t.relname = 'inbound_receipt_lines'
        AND a.attname = 'product_id'
    ) INTO v_has_leading_index;

    IF NOT v_has_leading_index THEN
      CREATE INDEX IF NOT EXISTS idx_inbound_receipt_lines_product_id_fk
        ON public.inbound_receipt_lines (product_id);
    END IF;
  END IF;
END $$;

