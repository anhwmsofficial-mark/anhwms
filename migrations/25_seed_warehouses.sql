-- Insert Warehouses if they don't exist
DO $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT id INTO v_org_id FROM org LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        INSERT INTO warehouse (org_id, name, code, is_active)
        VALUES (v_org_id, 'ANH 제1창고', 'WH001', true)
        ON CONFLICT (org_id, code) DO NOTHING;

        INSERT INTO warehouse (org_id, name, code, is_active)
        VALUES (v_org_id, 'ANH 제2창고', 'WH002', true)
        ON CONFLICT (org_id, code) DO NOTHING;
    END IF;
END $$;
