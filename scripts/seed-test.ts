
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seed() {
    console.log('Starting seed...');
    
    // 1. Org ID 조회
    const { data: orgs } = await supabaseAdmin.from('org').select('id').limit(1);
    if (!orgs || orgs.length === 0) {
        console.error('Org not found');
        return;
    }
    const orgId = orgs[0].id;
    console.log('Org ID:', orgId);

    // 2. Warehouse
    const { error: whError } = await supabaseAdmin.from('warehouse').upsert([
        { org_id: orgId, name: 'ANH 제1창고', code: 'WH001', type: 'ANH_OWNED', status: 'ACTIVE' },
        { org_id: orgId, name: 'ANH 제2창고', code: 'WH002', type: 'ANH_OWNED', status: 'ACTIVE' }
    ], { onConflict: 'org_id, code' });
    if (whError) console.error('Warehouse Error:', whError);
    else console.log('Warehouses seeded');

    // 3. Customer Master
    const { data: customer, error: custError } = await supabaseAdmin.from('customer_master')
        .upsert({ org_id: orgId, code: 'TEST-CLIENT', name: '테스트 유통', type: 'DIRECT_BRAND', status: 'ACTIVE' }, { onConflict: 'code' })
        .select()
        .single();
    
    if (custError) {
        console.error('Customer Error:', custError);
        return;
    }
    console.log('Customer seeded:', customer.id);

    // 4. Brand
    const { data: brand, error: brandError } = await supabaseAdmin.from('brand')
        .upsert({ 
            customer_master_id: customer.id, 
            code: 'TEST-BRAND', 
            name_ko: '테스트 브랜드', 
            name_en: 'Test Brand', 
            is_default_brand: true, 
            status: 'ACTIVE' 
        }, { onConflict: 'customer_master_id, code' })
        .select()
        .single();
    
    if (brandError) {
        console.error('Brand Error:', brandError);
        return;
    }
    console.log('Brand seeded:', brand.id);

    // 5. Products
    const productsData = [
        { brand_id: brand.id, name: '테스트 상품 A (박스)', sku: 'TEST-SKU-A', barcode: '8801234567890', category: 'Electronics' },
        { brand_id: brand.id, name: '테스트 상품 B (낱개)', sku: 'TEST-SKU-B', barcode: '8800987654321', category: 'Stationery' }
    ];

    for (const p of productsData) {
        // Check existing by SKU
        const { data: existing } = await supabaseAdmin.from('products').select('id').eq('sku', p.sku).single();
        let productId = existing?.id;

        if (!productId) {
             const { data: newP, error: pError } = await supabaseAdmin.from('products').insert(p).select().single();
             if (pError) {
                 console.error(`Product Error (${p.sku}):`, pError);
                 continue;
             }
             productId = newP.id;
        }
        console.log(`Product seeded (${p.sku}):`, productId);

        if (productId) {
             const { error: bcError } = await supabaseAdmin.from('product_barcodes').upsert({
                 org_id: orgId,
                 product_id: productId,
                 barcode: p.barcode,
                 barcode_type: 'RETAIL',
                 is_primary: true
             }, { onConflict: 'product_id, barcode, barcode_type' });
             
             if (bcError) console.error(`Barcode Error (${p.sku}):`, bcError);
             else console.log(`Barcode seeded (${p.barcode})`);
        }
    }

    console.log('Seed completed successfully.');
}

seed();
