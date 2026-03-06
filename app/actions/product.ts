'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';

export interface ProductBarcodeItem {
  barcode: string;
  barcode_type: string;
  is_primary: boolean;
}

export interface ProductSearchItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  customer_id: string | null;
  brand_id: string | null;
  brand?: { name_ko?: string; customer_master_id?: string | null } | null;
  barcodes: ProductBarcodeItem[];
}

export async function searchProducts(query: string, clientId?: string) {
  const db = supabaseAdmin as any;
  const search = (query || '').trim();
  if (!search) return [];

  // Note: product_barcodes join removed temporarily due to missing table in some environments.
  // Using products.barcode column instead.
  const baseSelect =
    'id, name, sku, barcode, category, customer_id, brand_id, brand:brand_id(name_ko, customer_master_id)';

  const buildQuery = () =>
    db
      .from('products')
      .select(baseSelect)
      .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
      .limit(30);

  type ProductSearchRaw = Omit<ProductSearchItem, 'barcodes'>;
  let rows: ProductSearchRaw[] = [];

  if (clientId) {
    const [byCustomer, byBrand] = await Promise.all([
      buildQuery().eq('customer_id', clientId),
      buildQuery().eq('brand.customer_master_id', clientId),
    ]);

    if (byCustomer.error) {
      console.error('Error searching products by customer_id:', byCustomer.error);
    }
    if (byBrand.error) {
      console.error('Error searching products by brand relation:', byBrand.error);
    }

    rows = ([...(byCustomer.data || []), ...(byBrand.data || [])] as ProductSearchRaw[]);
  } else {
    const { data, error } = await buildQuery();
    if (error) {
      console.error('Error searching products:', error);
      return [];
    }
    rows = (data || []) as ProductSearchRaw[];
  }

  const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values()).slice(0, 20);

  // Frontend expects 'barcodes' array
  return uniqueRows.map((p): ProductSearchItem => ({
    ...p,
    barcodes: p.barcode ? [{ barcode: p.barcode, barcode_type: 'RETAIL', is_primary: true }] : [],
  }));
}

export async function getProductsByClient(clientId: string) {
  const db = supabaseAdmin as any;
  if (!clientId) return [];

  const baseSelect =
    'id, name, sku, barcode, category, customer_id, brand_id, brand:brand_id(name_ko, customer_master_id)';

  const [byCustomer, byBrand] = await Promise.all([
    db.from('products').select(baseSelect).eq('customer_id', clientId).limit(50),
    db.from('products').select(baseSelect).eq('brand.customer_master_id', clientId).limit(50),
  ]);

  if (byCustomer.error) {
    console.error('Error fetching client products by customer_id:', byCustomer.error);
  }
  if (byBrand.error) {
    console.error('Error fetching client products by brand relation:', byBrand.error);
  }

  if (byCustomer.error && byBrand.error) {
    return [];
  }

  const uniqueRows = Array.from(
    new Map([...(byCustomer.data || []), ...(byBrand.data || [])].map((row) => [row.id, row])).values()
  ).slice(0, 50);

  return uniqueRows.map((p): ProductSearchItem => ({
    ...p,
    barcodes: p.barcode ? [{ barcode: p.barcode, barcode_type: 'RETAIL', is_primary: true }] : [],
  }));
}
