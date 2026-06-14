import type { ProductSearchItem } from '@/src/features/inbound/new/form/schema';

function normalizeProduct(row: any): ProductSearchItem {
  const barcodes = Array.isArray(row?.barcodes) ? row.barcodes : [];

  return {
    id: String(row.id),
    name: String(row.name || ''),
    sku: String(row.sku || ''),
    barcode: row.barcode ?? barcodes.find((barcode: any) => barcode?.is_primary)?.barcode ?? barcodes[0]?.barcode ?? null,
    category: String(row.category || ''),
    customer_id: row.customer_id ?? null,
    brand_id: row.brand_id ?? null,
    brand: row.brand ?? null,
    barcodes: barcodes.map((barcode: any) => ({
      barcode: String(barcode.barcode || ''),
      barcode_type: String(barcode.barcode_type || 'RETAIL'),
      is_primary: barcode.is_primary === true,
    })),
  };
}

export async function searchProducts(query: string, clientId?: string): Promise<ProductSearchItem[]> {
  const search = query.trim();
  if (!search) return [];

  const params = new URLSearchParams({
    q: search,
    limit: '20',
  });
  if (clientId) {
    params.set('clientId', clientId);
  }

  const response = await fetch(`/api/products/search?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || '상품 검색에 실패했습니다.');
  }

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map(normalizeProduct);
}
