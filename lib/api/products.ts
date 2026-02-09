import { supabase } from '../supabase';
import { Product, PaginationMeta } from '@/types';

function mapProductRows(
  items: any[],
  quantityMap: Record<string, { qty_on_hand: number; qty_available: number; qty_allocated: number }>,
  expectedInboundMap: Record<string, number>
) {
  return items.map(item => {
    const qtyRow = quantityMap[item.id];
    const quantity = qtyRow ? qtyRow.qty_on_hand : (item.quantity ?? 0);
    return {
      id: item.id,
      customerId: item.customer_id ?? null,
      name: item.name,
      manageName: item.manage_name ?? null,
      userCode: item.user_code ?? null,
      sku: item.sku,
      barcode: item.barcode ?? undefined,
      productDbNo: item.product_db_no ?? null,
      category: item.category,
      manufactureDate: item.manufacture_date ? new Date(item.manufacture_date) : null,
      expiryDate: item.expiry_date ? new Date(item.expiry_date) : null,
      optionSize: item.option_size ?? null,
      optionColor: item.option_color ?? null,
      optionLot: item.option_lot ?? null,
      optionEtc: item.option_etc ?? null,
      quantity,
      qtyAvailable: qtyRow?.qty_available ?? undefined,
      qtyAllocated: qtyRow?.qty_allocated ?? undefined,
      expectedInbound: expectedInboundMap[item.id] || 0,
      unit: item.unit ?? '개',
      minStock: item.min_stock ?? 0,
      price: item.price ?? 0,
      costPrice: item.cost_price ?? 0,
      location: item.location ?? '',
      description: item.description ?? '',
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    } as Product;
  });
}

// GET: 상품 목록 조회
export async function getProducts(options: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
} = {}): Promise<{ data: Product[]; pagination: PaginationMeta }> {
  const query = new URLSearchParams();
  if (options.page) query.append('page', String(options.page));
  if (options.limit) query.append('limit', String(options.limit));
  if (options.search) query.append('search', options.search);
  if (options.category) query.append('category', options.category);
  if (options.status) query.append('status', options.status);

  const res = await fetch(`/api/admin/products?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  const payload = await res.json();
  
  return {
    data: mapProductRows(payload.data || [], {}, {}), // quantityMap/inboundMap은 API에서 JOIN되어 온다고 가정하거나 별도 처리 필요하지만 일단 기본 맵핑 사용
    pagination: payload.pagination,
  };
}

export async function getProductsPage(options?: {
  limit?: number;
  page?: number;
  cursor?: string;
}): Promise<{ data: Product[]; pagination: PaginationMeta }> {
  const limit = options?.limit ?? 50;
  const page = options?.page ?? 1;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (options?.cursor) {
    query = query.lt('created_at', options.cursor).limit(limit);
  } else {
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  let quantityMap: Record<string, { qty_on_hand: number; qty_available: number; qty_allocated: number }> = {};
  try {
    const { data: qtyRows } = await supabase
      .from('inventory_quantities')
      .select('product_id, qty_on_hand, qty_available, qty_allocated');
    (qtyRows || []).forEach((row: any) => {
      const prev = quantityMap[row.product_id] || { qty_on_hand: 0, qty_available: 0, qty_allocated: 0 };
      quantityMap[row.product_id] = {
        qty_on_hand: prev.qty_on_hand + (row.qty_on_hand || 0),
        qty_available: prev.qty_available + (row.qty_available || 0),
        qty_allocated: prev.qty_allocated + (row.qty_allocated || 0),
      };
    });
  } catch (e) {
    console.warn('inventory_quantities lookup failed', e);
  }

  let expectedInboundMap: Record<string, number> = {};
  try {
    const { data: pendingReceipts } = await supabase
      .from('inbound_receipts')
      .select('plan_id')
      .in('status', ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING']);
    const planIds = Array.from(new Set((pendingReceipts || []).map((r: any) => r.plan_id).filter(Boolean)));
    if (planIds.length > 0) {
      const { data: planLines } = await supabase
        .from('inbound_plan_lines')
        .select('product_id, expected_qty, plan_id')
        .in('plan_id', planIds);
      (planLines || []).forEach((row: any) => {
        expectedInboundMap[row.product_id] =
          (expectedInboundMap[row.product_id] || 0) + (row.expected_qty || 0);
      });
    }
  } catch (e) {
    console.warn('expected inbound lookup failed', e);
  }

  const nextCursor = data && data.length > 0 ? data[data.length - 1].created_at : null;
  const total = count || 0;
  const totalPages = limit ? Math.ceil(total / limit) : 1;

  return {
    data: mapProductRows(data || [], quantityMap, expectedInboundMap) as Product[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      nextCursor,
    },
  };
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    customerId: data.customer_id ?? null,
    name: data.name,
    manageName: data.manage_name ?? null,
    userCode: data.user_code ?? null,
    sku: data.sku,
    barcode: data.barcode ?? undefined,
    productDbNo: data.product_db_no ?? null,
    category: data.category,
    manufactureDate: data.manufacture_date ? new Date(data.manufacture_date) : null,
    expiryDate: data.expiry_date ? new Date(data.expiry_date) : null,
    optionSize: data.option_size ?? null,
    optionColor: data.option_color ?? null,
    optionLot: data.option_lot ?? null,
    optionEtc: data.option_etc ?? null,
    quantity: data.quantity ?? 0,
    unit: data.unit ?? '개',
    minStock: data.min_stock ?? 0,
    price: data.price ?? 0,
    costPrice: data.cost_price ?? 0,
    location: data.location ?? '',
    description: data.description ?? '',
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  } as Product;
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: product.customerId ?? null,
      name: product.name,
      manage_name: product.manageName ?? null,
      user_code: product.userCode ?? null,
      sku: product.sku,
      barcode: product.barcode || null,
      product_db_no: product.productDbNo ?? null,
      category: product.category,
      manufacture_date: product.manufactureDate ? new Date(product.manufactureDate).toISOString().slice(0, 10) : null,
      expiry_date: product.expiryDate ? new Date(product.expiryDate).toISOString().slice(0, 10) : null,
      option_size: product.optionSize ?? null,
      option_color: product.optionColor ?? null,
      option_lot: product.optionLot ?? null,
      option_etc: product.optionEtc ?? null,
      quantity: product.quantity,
      unit: product.unit,
      min_stock: product.minStock,
      price: product.price,
      cost_price: product.costPrice ?? 0,
      location: product.location,
      description: product.description,
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error || '제품 추가에 실패했습니다.');
  return payload.data;
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  const res = await fetch('/api/admin/products', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      updates: {
        customer_id: updates.customerId ?? null,
        name: updates.name,
        manage_name: updates.manageName ?? null,
        user_code: updates.userCode ?? null,
        sku: updates.sku,
        barcode: updates.barcode ?? null,
        product_db_no: updates.productDbNo ?? null,
        category: updates.category,
        manufacture_date: updates.manufactureDate ? new Date(updates.manufactureDate).toISOString().slice(0, 10) : null,
        expiry_date: updates.expiryDate ? new Date(updates.expiryDate).toISOString().slice(0, 10) : null,
        option_size: updates.optionSize ?? null,
        option_color: updates.optionColor ?? null,
        option_lot: updates.optionLot ?? null,
        option_etc: updates.optionEtc ?? null,
        quantity: updates.quantity,
        unit: updates.unit,
        min_stock: updates.minStock,
        price: updates.price,
        cost_price: updates.costPrice ?? 0,
        location: updates.location,
        description: updates.description,
      },
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error || '제품 수정에 실패했습니다.');
  return payload.data;
}

export async function deleteProduct(id: string) {
  const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error || '제품 삭제에 실패했습니다.');
}


export async function getCategories(): Promise<string[]> {
  const res = await fetch('/api/admin/categories');
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

export async function getInventoryStats(): Promise<{ lowStockCount: number; inboundExpectedCount: number }> {
  const res = await fetch('/api/admin/inventory/stats');
  if (!res.ok) return { lowStockCount: 0, inboundExpectedCount: 0 };
  const json = await res.json();
  return json.data || { lowStockCount: 0, inboundExpectedCount: 0 };
}


