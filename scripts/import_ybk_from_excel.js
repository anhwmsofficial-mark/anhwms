import path from 'node:path';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const EXCEL_PATH =
  process.env.YBK_EXCEL_PATH ||
  path.join(process.cwd(), 'ANH_WMS_상품DB_재구성.xlsx');

const wb = xlsx.readFile(EXCEL_PATH);

const toJson = (sheetName) => {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return xlsx.utils.sheet_to_json(ws, { defval: '' });
};

const toBool = (val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') return val.toUpperCase() === 'TRUE' || val === '1';
  return false;
};

const chunk = (arr, size = 500) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const clients = toJson('clients');
  const products = toJson('products');
  const barcodes = toJson('product_barcodes');

  if (clients.length === 0 || products.length === 0) {
    throw new Error('clients/products 시트가 비어있습니다.');
  }

  const clientCode = clients[0].client_code || 'YBK';
  const clientName = clients[0].client_name_ko || clientCode;
  const clientActive = toBool(clients[0].is_active);

  const { data: orgData, error: orgError } = await supabase
    .from('org')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (orgError || !orgData) throw orgError || new Error('org not found');
  const orgId = orgData.id;

  // 1) 고객사 (customer_master)
  const { data: customerData, error: customerError } = await supabase
    .from('customer_master')
    .upsert(
      {
        org_id: orgId,
        code: clientCode,
        name: clientName,
        type: 'DIRECT_BRAND',
        status: clientActive ? 'ACTIVE' : 'INACTIVE',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'code' },
    )
    .select()
    .single();
  if (customerError || !customerData) throw customerError || new Error('customer upsert failed');

  // 2) 브랜드 (brand)
  const { data: brandData, error: brandError } = await supabase
    .from('brand')
    .upsert(
      {
        customer_master_id: customerData.id,
        code: clientCode,
        name_ko: clientName,
        name_en: clientName,
        is_default_brand: true,
        status: clientActive ? 'ACTIVE' : 'INACTIVE',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'customer_master_id,code' },
    )
    .select()
    .single();
  if (brandError || !brandData) throw brandError || new Error('brand upsert failed');

  // 3) 바코드 매핑 (primary)
  const primaryBarcodeByCode = new Map();
  barcodes.forEach((row) => {
    if (!row.product_code || !row.barcode) return;
    if (!toBool(row.is_active)) return;
    if (toBool(row.is_primary)) {
      primaryBarcodeByCode.set(row.product_code, row.barcode);
    }
  });

  // 4) 상품 (products)
  const productRows = products
    .filter((row) => row.client_code === clientCode)
    .map((row) => ({
      brand_id: brandData.id,
      name: row.official_name || row.admin_name || row.product_code,
      sku: row.product_code,
      category: row.category_name_ko || row.category_code || null,
      barcode: primaryBarcodeByCode.get(row.product_code) || null,
      updated_at: new Date().toISOString(),
    }));

  for (const batch of chunk(productRows, 500)) {
    const { error: productError } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'sku' });
    if (productError) throw productError;
  }

  // 5) 제품 ID 매핑
  const skuList = productRows.map((p) => p.sku);
  const productMap = new Map();
  for (const batch of chunk(skuList, 500)) {
    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .select('id, sku')
      .in('sku', batch);
    if (prodError) throw prodError;
    (prodData || []).forEach((p) => productMap.set(p.sku, p.id));
  }

  // 6) product_barcodes 입력
  const barcodeRows = barcodes
    .filter((row) => row.product_code && row.barcode && row.barcode_type)
    .map((row) => ({
      org_id: orgId,
      product_id: productMap.get(row.product_code),
      barcode: row.barcode,
      barcode_type: row.barcode_type,
      is_primary: toBool(row.is_primary),
    }))
    .filter((row) => row.product_id);

  for (const batch of chunk(barcodeRows, 500)) {
    const { error: bcError } = await supabase
      .from('product_barcodes')
      .upsert(batch, { onConflict: 'product_id,barcode,barcode_type' });
    if (bcError) throw bcError;
  }

  console.log('YBK import completed:', {
    customer: customerData.id,
    brand: brandData.id,
    products: productRows.length,
    barcodes: barcodeRows.length,
  });
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
