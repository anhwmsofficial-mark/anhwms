-- ====================================================================
-- Fix: Add missing foreign key constraints for Inbound Receipts & Lines
-- ====================================================================

-- 1. inbound_receipts FKs
DO $$
BEGIN
    -- client_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipts_client') THEN
        ALTER TABLE inbound_receipts ADD CONSTRAINT fk_inbound_receipts_client FOREIGN KEY (client_id) REFERENCES customer_master(id);
    END IF;
    -- warehouse_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipts_warehouse') THEN
        ALTER TABLE inbound_receipts ADD CONSTRAINT fk_inbound_receipts_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouse(id);
    END IF;
    -- org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipts_org') THEN
        ALTER TABLE inbound_receipts ADD CONSTRAINT fk_inbound_receipts_org FOREIGN KEY (org_id) REFERENCES org(id);
    END IF;
END $$;

-- 2. inbound_plan_lines FKs
DO $$
BEGIN
    -- product_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_plan_lines_product') THEN
        ALTER TABLE inbound_plan_lines ADD CONSTRAINT fk_inbound_plan_lines_product FOREIGN KEY (product_id) REFERENCES products(id);
    END IF;
END $$;

-- 3. inbound_receipt_lines FKs
DO $$
BEGIN
    -- product_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inbound_receipt_lines_product') THEN
        ALTER TABLE inbound_receipt_lines ADD CONSTRAINT fk_inbound_receipt_lines_product FOREIGN KEY (product_id) REFERENCES products(id);
    END IF;
END $$;

-- 4. inbound_photos FKs (just in case)
DO $$
BEGIN
    -- uploaded_by (auth.users) - often causes issues if not handled, but usually handled by RLS. 
    -- Explicit FK might not be strictly needed for Supabase selects unless using user join.
    -- However, let's ensure receipt_id is correct.
    NULL;
END $$;

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
