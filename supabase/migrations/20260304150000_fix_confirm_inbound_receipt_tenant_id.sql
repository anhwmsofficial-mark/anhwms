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
BEGIN
    -- Receipt Lock
    SELECT * INTO v_receipt FROM inbound_receipts WHERE id = p_receipt_id FOR UPDATE;
    IF v_receipt IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;
    IF v_receipt.status = 'CONFIRMED' OR v_receipt.status = 'PUTAWAY_READY' THEN
        RAISE EXCEPTION 'Already confirmed';
    END IF;

    v_tenant_id := v_receipt.org_id;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id(org_id) is required';
    END IF;

    FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = p_receipt_id LOOP
        IF COALESCE(v_line.accepted_qty, 0) > 0 THEN
            -- Lock current quantity row (if exists)
            SELECT qty_on_hand INTO v_current_qty
            FROM inventory_quantities
            WHERE warehouse_id = v_receipt.warehouse_id
              AND product_id = v_line.product_id
            FOR UPDATE;

            v_current_qty := COALESCE(v_current_qty, 0);
            v_next_qty := v_current_qty + v_line.accepted_qty;

            INSERT INTO inventory_ledger (
                org_id, warehouse_id, product_id, transaction_type,
                qty_change, balance_after, reference_type, reference_id, notes, created_by, tenant_id
            ) VALUES (
                v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, 'INBOUND',
                v_line.accepted_qty, v_next_qty, 'INBOUND_RECEIPT', p_receipt_id, NULL, p_user_id, v_tenant_id
            );

            INSERT INTO inventory_quantities (
                tenant_id, org_id, warehouse_id, product_id, qty_on_hand, qty_available
            )
            VALUES (
                v_tenant_id, v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, v_line.accepted_qty, v_line.accepted_qty
            )
            ON CONFLICT (warehouse_id, product_id)
            DO UPDATE SET
                qty_on_hand = inventory_quantities.qty_on_hand + EXCLUDED.qty_on_hand,
                qty_available = inventory_quantities.qty_available + EXCLUDED.qty_available,
                updated_at = NOW();
        END IF;
    END LOOP;

    UPDATE inbound_receipts
    SET status = 'PUTAWAY_READY', confirmed_at = NOW(), confirmed_by = p_user_id
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
