BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_inbound_receipt(p_receipt_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_receipt RECORD;
    v_line RECORD;
    v_current_qty INTEGER;
    v_next_qty INTEGER;
    v_tenant_id uuid;
    v_idempotency_key text;
    v_inserted_count integer := 0;
    v_skipped_count integer := 0;
BEGIN
    SELECT *
      INTO v_receipt
    FROM inbound_receipts
    WHERE id = p_receipt_id
    FOR UPDATE;

    IF v_receipt IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;

    IF v_receipt.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cancelled receipt cannot be confirmed';
    END IF;

    IF v_receipt.status = 'CONFIRMED' OR v_receipt.status = 'PUTAWAY_READY' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_confirmed', true,
            'status', v_receipt.status,
            'inserted_ledger_count', 0,
            'skipped_ledger_count', 0
        );
    END IF;

    v_tenant_id := v_receipt.org_id;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id(org_id) is required';
    END IF;

    FOR v_line IN
        SELECT *
        FROM inbound_receipt_lines
        WHERE receipt_id = p_receipt_id
        ORDER BY id
    LOOP
        IF COALESCE(v_line.accepted_qty, 0) > 0 THEN
            v_idempotency_key := format('inbound-confirm:%s:%s', p_receipt_id, v_line.id);

            SELECT qty_on_hand
              INTO v_current_qty
            FROM inventory_quantities
            WHERE warehouse_id = v_receipt.warehouse_id
              AND product_id = v_line.product_id
            FOR UPDATE;

            v_current_qty := COALESCE(v_current_qty, 0);
            v_next_qty := v_current_qty + v_line.accepted_qty;

            INSERT INTO inventory_ledger (
                org_id,
                warehouse_id,
                product_id,
                transaction_type,
                qty_change,
                balance_after,
                reference_type,
                reference_id,
                notes,
                created_by,
                tenant_id,
                idempotency_key
            ) VALUES (
                v_receipt.org_id,
                v_receipt.warehouse_id,
                v_line.product_id,
                'INBOUND',
                v_line.accepted_qty,
                v_next_qty,
                'INBOUND_RECEIPT',
                p_receipt_id,
                NULL,
                p_user_id,
                v_tenant_id,
                v_idempotency_key
            )
            ON CONFLICT DO NOTHING;

            IF FOUND THEN
                v_inserted_count := v_inserted_count + 1;

                INSERT INTO inventory_quantities (
                    tenant_id,
                    org_id,
                    warehouse_id,
                    product_id,
                    qty_on_hand,
                    qty_available
                )
                VALUES (
                    v_tenant_id,
                    v_receipt.org_id,
                    v_receipt.warehouse_id,
                    v_line.product_id,
                    v_line.accepted_qty,
                    v_line.accepted_qty
                )
                ON CONFLICT (warehouse_id, product_id)
                DO UPDATE SET
                    qty_on_hand = inventory_quantities.qty_on_hand + EXCLUDED.qty_on_hand,
                    qty_available = inventory_quantities.qty_available + EXCLUDED.qty_available,
                    updated_at = NOW();
            ELSE
                v_skipped_count := v_skipped_count + 1;
            END IF;
        END IF;
    END LOOP;

    UPDATE inbound_receipts
    SET status = 'PUTAWAY_READY',
        confirmed_at = COALESCE(confirmed_at, NOW()),
        confirmed_by = COALESCE(confirmed_by, p_user_id)
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_confirmed', false,
        'status', 'PUTAWAY_READY',
        'inserted_ledger_count', v_inserted_count,
        'skipped_ledger_count', v_skipped_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.confirm_inbound_receipt(uuid, uuid)
IS '입고 확정 시 inventory_ledger idempotency_key를 사용해 중복 ledger 반영을 방지한다.';

COMMIT;

NOTIFY pgrst, 'reload schema';
