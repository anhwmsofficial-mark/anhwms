BEGIN;

CREATE OR REPLACE FUNCTION public.save_receipt_lines_batch(
  p_tenant_id uuid,
  p_receipt_id uuid,
  p_actor_id uuid,
  p_lines jsonb,
  p_inspections jsonb DEFAULT '[]'::jsonb,
  p_require_full_line_set boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_receipt record;
  v_existing_count integer := 0;
  v_input_count integer := 0;
  v_cleanup_count integer := 0;
  v_has_changes boolean := false;
  v_next_status text;
  v_target_id uuid;
  v_row record;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_receipt_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id is required';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'lines payload is required';
  END IF;

  IF p_inspections IS NULL THEN
    p_inspections := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(p_inspections) <> 'array' THEN
    RAISE EXCEPTION 'inspections payload must be an array';
  END IF;

  SELECT id, org_id, status
    INTO v_receipt
  FROM public.inbound_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;

  IF v_receipt.org_id IS NULL OR v_receipt.org_id <> p_tenant_id THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: receipt does not belong to tenant';
  END IF;

  IF v_receipt.status IN ('CONFIRMED', 'PUTAWAY_READY', 'CANCELLED') THEN
    RAISE EXCEPTION '이미 확정되거나 취소된 입고 건은 수정할 수 없습니다.';
  END IF;

  CREATE TEMP TABLE tmp_receipt_lines_input (
    receipt_line_id uuid,
    plan_line_id uuid,
    product_id uuid,
    expected_qty integer,
    received_qty integer,
    damaged_qty integer,
    missing_qty integer,
    other_qty integer,
    notes text,
    location_id uuid
  ) ON COMMIT DROP;

  INSERT INTO tmp_receipt_lines_input (
    receipt_line_id,
    plan_line_id,
    product_id,
    expected_qty,
    received_qty,
    damaged_qty,
    missing_qty,
    other_qty,
    notes,
    location_id
  )
  SELECT
    x.receipt_line_id,
    x.plan_line_id,
    x.product_id,
    COALESCE(x.expected_qty, 0),
    COALESCE(x.received_qty, 0),
    COALESCE(x.damaged_qty, 0),
    COALESCE(x.missing_qty, 0),
    COALESCE(x.other_qty, 0),
    NULLIF(BTRIM(x.notes), ''),
    x.location_id
  FROM jsonb_to_recordset(p_lines) AS x(
    receipt_line_id uuid,
    plan_line_id uuid,
    product_id uuid,
    expected_qty integer,
    received_qty integer,
    damaged_qty integer,
    missing_qty integer,
    other_qty integer,
    notes text,
    location_id uuid
  );

  SELECT COUNT(*) INTO v_input_count FROM tmp_receipt_lines_input;
  IF v_input_count = 0 THEN
    RAISE EXCEPTION 'lines payload is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_receipt_lines_input
    WHERE product_id IS NULL
       OR expected_qty IS NULL
       OR received_qty IS NULL
       OR damaged_qty IS NULL
       OR missing_qty IS NULL
       OR other_qty IS NULL
  ) THEN
    RAISE EXCEPTION 'lines payload contains missing required fields';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_receipt_lines_input
    WHERE expected_qty < 0
       OR received_qty < 0
       OR damaged_qty < 0
       OR missing_qty < 0
       OR other_qty < 0
  ) THEN
    RAISE EXCEPTION 'lines payload contains negative quantities';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_receipt_lines_input
    WHERE receipt_line_id IS NOT NULL
    GROUP BY receipt_line_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate receipt_line_id detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_receipt_lines_input
    WHERE plan_line_id IS NOT NULL
    GROUP BY plan_line_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate plan_line_id detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_receipt_lines_input t
    JOIN public.inbound_receipt_lines rl
      ON rl.id = t.receipt_line_id
    WHERE rl.receipt_id <> p_receipt_id
  ) THEN
    RAISE EXCEPTION 'line receipt mismatch detected';
  END IF;

  SELECT COUNT(*)
    INTO v_existing_count
  FROM public.inbound_receipt_lines
  WHERE receipt_id = p_receipt_id;

  IF p_require_full_line_set AND v_existing_count <> v_input_count THEN
    RAISE EXCEPTION 'line count mismatch: expected %, received %', v_existing_count, v_input_count;
  END IF;

  WITH ranked_duplicates AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY plan_line_id
        ORDER BY COALESCE(updated_at, created_at, now()) DESC, id DESC
      ) AS rn
    FROM public.inbound_receipt_lines
    WHERE receipt_id = p_receipt_id
      AND plan_line_id IS NOT NULL
      AND plan_line_id IN (
        SELECT plan_line_id
        FROM tmp_receipt_lines_input
        WHERE plan_line_id IS NOT NULL
      )
  ),
  deleted_duplicates AS (
    DELETE FROM public.inbound_receipt_lines
    WHERE id IN (
      SELECT id
      FROM ranked_duplicates
      WHERE rn > 1
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cleanup_count FROM deleted_duplicates;

  WITH stale_lines AS (
    SELECT rl.id
    FROM public.inbound_receipt_lines rl
    WHERE rl.receipt_id = p_receipt_id
      AND rl.plan_line_id IS NOT NULL
      AND rl.plan_line_id NOT IN (
        SELECT t.plan_line_id
        FROM tmp_receipt_lines_input t
        WHERE t.plan_line_id IS NOT NULL
      )
      AND rl.id NOT IN (
        SELECT t.receipt_line_id
        FROM tmp_receipt_lines_input t
        WHERE t.receipt_line_id IS NOT NULL
      )
  ),
  deleted_stale AS (
    DELETE FROM public.inbound_receipt_lines
    WHERE id IN (SELECT id FROM stale_lines)
    RETURNING id
  )
  SELECT v_cleanup_count + COUNT(*) INTO v_cleanup_count FROM deleted_stale;

  FOR v_row IN
    SELECT *
    FROM tmp_receipt_lines_input
  LOOP
    v_target_id := v_row.receipt_line_id;

    IF v_target_id IS NULL AND v_row.plan_line_id IS NOT NULL THEN
      SELECT rl.id
        INTO v_target_id
      FROM public.inbound_receipt_lines rl
      WHERE rl.receipt_id = p_receipt_id
        AND rl.plan_line_id = v_row.plan_line_id
      ORDER BY COALESCE(rl.updated_at, rl.created_at, now()) DESC, rl.id DESC
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_target_id IS NOT NULL THEN
      UPDATE public.inbound_receipt_lines
      SET
        org_id = p_tenant_id,
        tenant_id = p_tenant_id,
        receipt_id = p_receipt_id,
        plan_line_id = v_row.plan_line_id,
        product_id = v_row.product_id,
        expected_qty = v_row.expected_qty,
        received_qty = (v_row.received_qty + v_row.damaged_qty + v_row.missing_qty + v_row.other_qty),
        accepted_qty = v_row.received_qty,
        damaged_qty = v_row.damaged_qty,
        missing_qty = v_row.missing_qty,
        other_qty = v_row.other_qty,
        inspected_by = p_actor_id,
        inspected_at = now(),
        notes = v_row.notes,
        location_id = v_row.location_id,
        updated_at = now()
      WHERE id = v_target_id
        AND receipt_id = p_receipt_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'receipt line update target not found';
      END IF;
    ELSE
      INSERT INTO public.inbound_receipt_lines (
        org_id,
        tenant_id,
        receipt_id,
        plan_line_id,
        product_id,
        expected_qty,
        received_qty,
        accepted_qty,
        damaged_qty,
        missing_qty,
        other_qty,
        inspected_by,
        inspected_at,
        notes,
        location_id
      ) VALUES (
        p_tenant_id,
        p_tenant_id,
        p_receipt_id,
        v_row.plan_line_id,
        v_row.product_id,
        v_row.expected_qty,
        (v_row.received_qty + v_row.damaged_qty + v_row.missing_qty + v_row.other_qty),
        v_row.received_qty,
        v_row.damaged_qty,
        v_row.missing_qty,
        v_row.other_qty,
        p_actor_id,
        now(),
        v_row.notes,
        v_row.location_id
      );
    END IF;

    v_has_changes := true;
  END LOOP;

  IF jsonb_array_length(p_inspections) > 0 THEN
    INSERT INTO public.inbound_inspections (
      inbound_id,
      product_id,
      expected_qty,
      received_qty,
      rejected_qty,
      condition,
      inspector_id,
      note,
      photos,
      org_id,
      created_at
    )
    SELECT
      p_receipt_id,
      x.product_id,
      COALESCE(x.expected_qty, 0),
      COALESCE(x.received_qty, 0),
      COALESCE(x.rejected_qty, 0),
      COALESCE(NULLIF(BTRIM(x.condition), ''), 'GOOD'),
      p_actor_id,
      NULLIF(BTRIM(x.note), ''),
      COALESCE(x.photos, ARRAY[]::text[]),
      p_tenant_id,
      COALESCE(x.inspected_at, now())
    FROM jsonb_to_recordset(p_inspections) AS x(
      product_id uuid,
      expected_qty integer,
      received_qty integer,
      rejected_qty integer,
      condition text,
      note text,
      photos text[],
      inspected_at timestamptz
    );
  END IF;

  IF v_receipt.status IN ('ARRIVED', 'PHOTO_REQUIRED') THEN
    v_next_status := 'COUNTING';
    UPDATE public.inbound_receipts
    SET status = v_next_status,
        updated_at = now()
    WHERE id = p_receipt_id;
  ELSE
    v_next_status := v_receipt.status;
    UPDATE public.inbound_receipts
    SET updated_at = now()
    WHERE id = p_receipt_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'has_changes', v_has_changes,
    'cleanup_count', v_cleanup_count,
    'inspection_count', jsonb_array_length(p_inspections),
    'receipt_status', v_next_status
  );
END;
$$;

COMMENT ON FUNCTION public.save_receipt_lines_batch(uuid, uuid, uuid, jsonb, jsonb, boolean)
IS '입고 검수 라인 저장과 inbound_inspections 이력 적재를 하나의 트랜잭션으로 처리한다.';

COMMIT;
