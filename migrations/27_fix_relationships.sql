-- ====================================================================
-- Fix: Add missing foreign key constraints for Inbound Plans
-- ====================================================================

-- 1. Add Foreign Key for client_id (inbound_plans -> customer_master)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_inbound_plans_client'
    ) THEN
        ALTER TABLE inbound_plans 
        ADD CONSTRAINT fk_inbound_plans_client 
        FOREIGN KEY (client_id) 
        REFERENCES customer_master(id);
    END IF;
END $$;

-- 2. Add Foreign Key for warehouse_id (inbound_plans -> warehouse)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_inbound_plans_warehouse'
    ) THEN
        ALTER TABLE inbound_plans 
        ADD CONSTRAINT fk_inbound_plans_warehouse 
        FOREIGN KEY (warehouse_id) 
        REFERENCES warehouse(id);
    END IF;
END $$;

-- 3. Add Foreign Key for org_id (inbound_plans -> org)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_inbound_plans_org'
    ) THEN
        ALTER TABLE inbound_plans 
        ADD CONSTRAINT fk_inbound_plans_org 
        FOREIGN KEY (org_id) 
        REFERENCES org(id);
    END IF;
END $$;

-- 4. Reload Schema Cache to apply changes immediately
NOTIFY pgrst, 'reload schema';
