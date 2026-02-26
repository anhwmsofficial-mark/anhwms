-- ====================================================================
-- Inbound inventory snapshots and confirm function update
-- ====================================================================

CREATE TABLE IF NOT EXISTS inbound_inventory_snapshots (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  warehouse_id uuid not null,
  receipt_id   uuid not null references inbound_receipts(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  qty_before   integer not null default 0,
  qty_after    integer not null default 0,
  created_at   timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS inbound_inventory_snapshots_receipt_idx
  ON inbound_inventory_snapshots(receipt_id);

CREATE INDEX IF NOT EXISTS inbound_inventory_snapshots_product_idx
  ON inbound_inventory_snapshots(product_id);

-- Update confirm_inbound_receipt to use accepted_qty and record snapshots
CREATE OR REPLACE FUNCTION confirm_inbound_receipt(p_receipt_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_receipt RECORD;
    v_line RECORD;
    v_current_qty INTEGER;
    v_next_qty INTEGER;
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
            SELECT qty_on_hand INTO v_current_qty
            FROM inventory_quantities
            WHERE warehouse_id = v_receipt.warehouse_id
              AND product_id = v_line.product_id;

            v_current_qty := COALESCE(v_current_qty, 0);
            v_next_qty := v_current_qty + v_line.accepted_qty;

            INSERT INTO inventory_ledger (
                org_id, warehouse_id, product_id, transaction_type,
                qty_change, balance_after, reference_type, reference_id, notes, created_by
            ) VALUES (
                v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, 'INBOUND',
                v_line.accepted_qty, v_next_qty, 'INBOUND_RECEIPT', p_receipt_id, NULL, p_user_id
            );

            INSERT INTO inventory_quantities (org_id, warehouse_id, product_id, qty_on_hand, qty_available)
            VALUES (v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, v_line.accepted_qty, v_line.accepted_qty)
            ON CONFLICT (warehouse_id, product_id)
            DO UPDATE SET
                qty_on_hand = inventory_quantities.qty_on_hand + EXCLUDED.qty_on_hand,
                qty_available = inventory_quantities.qty_available + EXCLUDED.qty_available,
                updated_at = NOW();

            INSERT INTO inbound_inventory_snapshots (
                org_id, warehouse_id, receipt_id, product_id, qty_before, qty_after
            ) VALUES (
                v_receipt.org_id, v_receipt.warehouse_id, p_receipt_id, v_line.product_id, v_current_qty, v_next_qty
            );
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

NOTIFY pgrst, 'reload schema';
