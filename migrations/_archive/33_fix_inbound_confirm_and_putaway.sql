-- ====================================================================
-- Fix inbound receipt confirm and putaway logic (use accepted_qty)
-- ====================================================================

-- ensure other_qty exists (safety)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inbound_receipt_lines'
          AND column_name = 'other_qty'
    ) THEN
        ALTER TABLE inbound_receipt_lines
            ADD COLUMN other_qty integer not null default 0 check (other_qty >= 0);
    END IF;
END $$;

-- Update confirm_inbound_receipt to use accepted_qty (정상 수량)
CREATE OR REPLACE FUNCTION confirm_inbound_receipt(p_receipt_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_receipt RECORD;
    v_line RECORD;
BEGIN
    SELECT * INTO v_receipt FROM inbound_receipts WHERE id = p_receipt_id;
    IF v_receipt IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;
    IF v_receipt.status = 'CONFIRMED' THEN
        RAISE EXCEPTION 'Already confirmed';
    END IF;

    FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = p_receipt_id LOOP
        IF COALESCE(v_line.accepted_qty, 0) > 0 THEN
            INSERT INTO inventory_ledger (
                org_id, warehouse_id, product_id, transaction_type, 
                qty_change, reference_type, reference_id, created_by
            ) VALUES (
                v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, 'INBOUND',
                v_line.accepted_qty, 'INBOUND_RECEIPT', p_receipt_id, p_user_id
            );

            INSERT INTO inventory_quantities (org_id, warehouse_id, product_id, qty_on_hand, qty_available)
            VALUES (v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, v_line.accepted_qty, v_line.accepted_qty)
            ON CONFLICT (warehouse_id, product_id) 
            DO UPDATE SET 
                qty_on_hand = inventory_quantities.qty_on_hand + EXCLUDED.qty_on_hand,
                qty_available = inventory_quantities.qty_available + EXCLUDED.qty_available,
                updated_at = NOW();
        END IF;
    END LOOP;

    UPDATE inbound_receipts 
    SET status = 'CONFIRMED', confirmed_at = NOW(), confirmed_by = p_user_id
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Update putaway trigger to use accepted_qty
CREATE OR REPLACE FUNCTION create_putaway_tasks_on_confirm()
RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
BEGIN
    IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
        FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = NEW.id LOOP
            IF COALESCE(v_line.accepted_qty, 0) > 0 THEN
                INSERT INTO putaway_tasks (
                    org_id, warehouse_id, receipt_id, receipt_line_id, product_id, qty_expected
                ) VALUES (
                    NEW.org_id, NEW.warehouse_id, NEW.id, v_line.id, v_line.product_id, v_line.accepted_qty
                );
            END IF;

            IF COALESCE(v_line.damaged_qty, 0) > 0 THEN
                 INSERT INTO putaway_tasks (
                    org_id, warehouse_id, receipt_id, receipt_line_id, product_id, qty_expected
                ) VALUES (
                    NEW.org_id, NEW.warehouse_id, NEW.id, v_line.id, v_line.product_id, v_line.damaged_qty
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
