'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function searchProducts(query: string, clientId?: string) {
  const search = (query || '').trim();
  if (!search) return [];

  // Note: product_barcodes join removed temporarily due to missing table in some environments.
  // Using products.barcode column instead.
  let req = supabaseAdmin
    .from('products')
    .select('id, name, sku, barcode, category, brand_id, brand:brand_id(name_ko, customer_master_id)')
    .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
    .limit(20);

  if (clientId) {
    req = req.eq('brand.customer_master_id', clientId);
  }

  const { data, error } = await req;
  if (error) {
    console.error('Error searching products:', error);
    return [];
  }

  // Frontend expects 'barcodes' array
  return data.map((p: any) => ({
      ...p,
      barcodes: p.barcode ? [{ barcode: p.barcode, barcode_type: 'RETAIL', is_primary: true }] : []
  }));
}

export async function getProductsByClient(clientId: string) {
  if (!clientId) return [];

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, name, sku, barcode, category, brand_id, brand:brand_id(name_ko, customer_master_id)')
    .eq('brand.customer_master_id', clientId)
    .limit(50);

  if (error) {
    console.error('Error fetching client products:', error);
    return [];
  }

  return data.map((p: any) => ({
      ...p,
      barcodes: p.barcode ? [{ barcode: p.barcode, barcode_type: 'RETAIL', is_primary: true }] : []
  }));
}
