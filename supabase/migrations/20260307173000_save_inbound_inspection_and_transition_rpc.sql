BEGIN;

CREATE OR REPLACE FUNCTION public.save_inbound_inspection_and_transition(
  p_tenant_id uuid,
  p_receipt_id uuid,
  p_actor_id uuid,
  p_lines jsonb,
  p_inspections jsonb DEFAULT '[]'::jsonb,
  p_require_full_line_set boolean DEFAULT false,
  p_finalize boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_receipt record;
  v_save_result jsonb;
  v_line record;
  v_missing_photo_titles text;
  v_has_discrepancy boolean := false;
  v_discrepancy_details jsonb := '[]'::jsonb;
  v_confirm_result jsonb;
  v_next_status text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_receipt_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id is required';
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

  v_save_result := public.save_receipt_lines_batch(
    p_tenant_id,
    p_receipt_id,
    p_actor_id,
    p_lines,
    p_inspections,
    p_require_full_line_set
  );

  IF COALESCE((v_save_result->>'success')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION '검수 라인 저장에 실패했습니다.';
  END IF;

  IF p_finalize THEN
    SELECT string_agg(title, ', ' ORDER BY title)
      INTO v_missing_photo_titles
    FROM public.v_inbound_receipt_photo_progress
    WHERE receipt_id = p_receipt_id
      AND COALESCE(slot_ok, false) = false;

    IF v_missing_photo_titles IS NOT NULL AND BTRIM(v_missing_photo_titles) <> '' THEN
      RAISE EXCEPTION '필수 사진이 누락되었습니다: %', v_missing_photo_titles;
    END IF;

    FOR v_line IN
      SELECT product_id, expected_qty, accepted_qty, received_qty, damaged_qty, missing_qty, other_qty
      FROM public.inbound_receipt_lines
      WHERE receipt_id = p_receipt_id
    LOOP
      IF (
        COALESCE(v_line.accepted_qty, COALESCE(v_line.received_qty, 0))
        + COALESCE(v_line.damaged_qty, 0)
        + COALESCE(v_line.missing_qty, 0)
        + COALESCE(v_line.other_qty, 0)
      ) <> COALESCE(v_line.expected_qty, 0) THEN
        v_has_discrepancy := true;
        v_discrepancy_details := v_discrepancy_details || jsonb_build_array(
          jsonb_build_object(
            'product_id', v_line.product_id,
            'expected', COALESCE(v_line.expected_qty, 0),
            'actual',
              COALESCE(v_line.accepted_qty, COALESCE(v_line.received_qty, 0))
              + COALESCE(v_line.damaged_qty, 0)
              + COALESCE(v_line.missing_qty, 0)
              + COALESCE(v_line.other_qty, 0)
          )
        );
      END IF;
    END LOOP;

    IF v_has_discrepancy THEN
      v_next_status := 'DISCREPANCY';
      UPDATE public.inbound_receipts
      SET status = v_next_status,
          updated_at = now()
      WHERE id = p_receipt_id;

      RETURN jsonb_build_object(
        'success', true,
        'status', v_next_status,
        'discrepancy', true,
        'details', v_discrepancy_details,
        'save_result', v_save_result
      );
    END IF;

    v_confirm_result := public.confirm_inbound_receipt(p_receipt_id, p_actor_id);
    IF COALESCE((v_confirm_result->>'success')::boolean, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION '%', COALESCE(v_confirm_result->>'error', '검수 완료 처리 중 오류가 발생했습니다.');
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'PUTAWAY_READY',
      'discrepancy', false,
      'save_result', v_save_result
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inbound_receipt_lines
    WHERE receipt_id = p_receipt_id
      AND COALESCE(damaged_qty, 0) > 0
  ) THEN
    v_next_status := 'DISCREPANCY';
  ELSE
    v_next_status := 'INSPECTING';
  END IF;

  UPDATE public.inbound_receipts
  SET status = v_next_status,
      updated_at = now()
  WHERE id = p_receipt_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_next_status,
    'discrepancy', (v_next_status = 'DISCREPANCY'),
    'save_result', v_save_result
  );
END;
$$;

COMMENT ON FUNCTION public.save_inbound_inspection_and_transition(uuid, uuid, uuid, jsonb, jsonb, boolean, boolean)
IS '입고 검수 저장, inspection 이력 적재, receipt 상태 전이를 하나의 트랜잭션으로 처리한다.';

COMMIT;
