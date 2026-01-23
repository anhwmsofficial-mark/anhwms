-- Seed Test Data (Client, Brand, Products, Barcodes)
DO $$
DECLARE
    v_org_id uuid;
    v_customer_id uuid;
    v_brand_id uuid;
    v_product_a_id uuid;
    v_product_b_id uuid;
BEGIN
    -- 1. Get Org ID
    SELECT id INTO v_org_id FROM org LIMIT 1;
    
    IF v_org_id IS NULL THEN
        RAISE NOTICE 'Org not found';
        RETURN;
    END IF;

    -- 2. Warehouse
    INSERT INTO warehouse (org_id, name, code, is_active, type)
    VALUES (v_org_id, 'ANH 제1창고', 'WH001', true, 'ANH_OWNED')
    ON CONFLICT (org_id, code) DO NOTHING;

    INSERT INTO warehouse (org_id, name, code, is_active, type)
    VALUES (v_org_id, 'ANH 제2창고', 'WH002', true, 'ANH_OWNED')
    ON CONFLICT (org_id, code) DO NOTHING;

    -- 3. Customer Master
    INSERT INTO customer_master (org_id, code, name, type, status)
    VALUES (v_org_id, 'TEST-CLIENT', '테스트 유통', 'DIRECT_BRAND', 'ACTIVE')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_customer_id;

    -- 4. Brand
    INSERT INTO brand (customer_master_id, code, name_ko, name_en, is_default_brand, status)
    VALUES (v_customer_id, 'TEST-BRAND', '테스트 브랜드', 'Test Brand', true, 'ACTIVE')
    ON CONFLICT (customer_master_id, code) DO UPDATE SET name_ko = EXCLUDED.name_ko
    RETURNING id INTO v_brand_id;

    -- 5. Product A
    -- Check if exists first to avoid constraint issues if unique constraint name is unknown
    SELECT id INTO v_product_a_id FROM products WHERE sku = 'TEST-SKU-A' LIMIT 1;
    
    IF v_product_a_id IS NULL THEN
        INSERT INTO products (brand_id, name, sku, barcode, category)
        VALUES (v_brand_id, '테스트 상품 A (박스)', 'TEST-SKU-A', '8801234567890', 'Electronics')
        RETURNING id INTO v_product_a_id;
    END IF;

    -- 6. Product B
    SELECT id INTO v_product_b_id FROM products WHERE sku = 'TEST-SKU-B' LIMIT 1;
    
    IF v_product_b_id IS NULL THEN
        INSERT INTO products (brand_id, name, sku, barcode, category)
        VALUES (v_brand_id, '테스트 상품 B (낱개)', 'TEST-SKU-B', '8800987654321', 'Stationery')
        RETURNING id INTO v_product_b_id;
    END IF;
    
    -- 7. Product Barcodes
    IF v_product_a_id IS NOT NULL THEN
        INSERT INTO product_barcodes (org_id, product_id, barcode, barcode_type, is_primary)
        VALUES (v_org_id, v_product_a_id, '8801234567890', 'RETAIL', true)
        ON CONFLICT (product_id, barcode, barcode_type) DO NOTHING;
    END IF;

    IF v_product_b_id IS NOT NULL THEN
        INSERT INTO product_barcodes (org_id, product_id, barcode, barcode_type, is_primary)
        VALUES (v_org_id, v_product_b_id, '8800987654321', 'RETAIL', true)
        ON CONFLICT (product_id, barcode, barcode_type) DO NOTHING;
    END IF;

    RAISE NOTICE 'Test data seeded successfully';
END $$;
