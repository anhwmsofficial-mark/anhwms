'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseAmountInput, parseIntegerInput } from '@/utils/number-format';
import { ensurePermission } from '@/lib/actions/auth';
import {
  buildProductDbNo,
  generateAutoBarcode,
  generateAutoSku,
  resolveCategoryCode,
  resolveCustomerCode,
  resolveCustomerMasterId,
  sanitizeCode,
} from '@/lib/domain/products/identifiers';
import { failFromError, isUnauthorizedError, type ActionResult } from '@/lib/actions/result';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';

type ProductRow = Tables<'products'>;
type ProductInsert = TablesInsert<'products'>;
type ProductUpdate = TablesUpdate<'products'>;

type CreateProductInput = {
  customer_id?: string | null;
  brand_id?: string | null;
  name?: string;
  manage_name?: string | null;
  user_code?: string | null;
  sku?: string | null;
  barcode?: string | null;
  product_db_no?: string | null;
  category?: string;
  manufacture_date?: string | null;
  expiry_date?: string | null;
  option_size?: string | null;
  option_color?: string | null;
  option_lot?: string | null;
  option_etc?: string | null;
  quantity?: number | null;
  unit?: string | null;
  min_stock?: number | null;
  minStock?: number | null;
  price?: number | null;
  cost_price?: number | null;
  location?: string | null;
  description?: string | null;
  status?: string | null;
  product_type?: string | null;
};

type UpdateProductInput = Partial<CreateProductInput>;

interface ProductListParams {
  page?: number;
  limit?: number;
  cursor?: string | null;
  search?: string;
  brand_id?: string;
  category?: string;
  status?: string;
}

const toInteger = (value: unknown, fallback = 0) => parseIntegerInput(value) ?? fallback;
const toAmount = (value: unknown, fallback = 0) => parseAmountInput(value) ?? fallback;
const SCHEMA_MISMATCH_CODE = 'SCHEMA_MISMATCH';
const db = supabaseAdmin as any;

const resolveBrandOwnerCustomerId = async (brandId: string) => {
  const { data: brand } = await db
    .from('brand')
    .select('id, customer_master_id')
    .eq('id', brandId)
    .maybeSingle();

  if (!brand?.customer_master_id) return null;
  return String(brand.customer_master_id);
};

const ensureDefaultBrandForCustomer = async (customerId: string) => {
  const { data: existing } = await db
    .from('brand')
    .select('id')
    .eq('customer_master_id', customerId)
    .eq('status', 'ACTIVE')
    .order('is_default_brand', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: customer } = await db
    .from('customer_master')
    .select('code, name')
    .eq('id', customerId)
    .maybeSingle();

  const customerCode =
    sanitizeCode(String(customer?.code || ''), 16) || sanitizeCode(customerId.replace(/-/g, ''), 8);
  const baseBrandCode = `${customerCode}-DEFAULT`;

  const { data: created, error } = await db
    .from('brand')
    .insert([
      {
        customer_master_id: customerId,
        code: baseBrandCode,
        name_ko: customer?.name || baseBrandCode,
        name_en: customer?.name || baseBrandCode,
        is_default_brand: true,
        status: 'ACTIVE',
      },
    ])
    .select('id')
    .single();

  if (error || !created?.id) {
    const { data: fallback } = await db
      .from('brand')
      .select('id')
      .eq('customer_master_id', customerId)
      .order('is_default_brand', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallback?.id) return String(fallback.id);
    throw new Error('해당 고객사의 기본 브랜드를 찾거나 생성하지 못했습니다.');
  }

  return String(created.id);
};

async function loadStockMap(productIds: string[]): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};
  const stockMap: Record<string, number> = {};

  const { data: stockRows, error: stockError } = await db
    .from('v_inventory_stock_current')
    .select('product_id, current_stock')
    .in('product_id', productIds);

  if (!stockError && stockRows) {
    for (const row of stockRows as Array<{ product_id: string; current_stock: number | null }>) {
      stockMap[row.product_id] = Number(row.current_stock || 0);
    }
    return stockMap;
  }

  const { data: qtyRows } = await db
    .from('inventory_quantities')
    .select('product_id, qty_on_hand')
    .in('product_id', productIds);

  for (const row of (qtyRows || []) as Array<{ product_id: string; qty_on_hand: number | null }>) {
    stockMap[row.product_id] = (stockMap[row.product_id] || 0) + Number(row.qty_on_hand || 0);
  }

  return stockMap;
}

export async function listProductsAction(
  params: ProductListParams = {},
  request?: Request,
): Promise<
  ActionResult<{
    data: Array<ProductRow & { quantity: number }>;
    pagination: { page: number; limit: number; total: number; totalPages: number; nextCursor: string | null };
  }>
> {
  try {
    const permission = await ensurePermission('manage:products', request);
    if (!permission.ok) return permission as any;

    const page = Number(params.page || 1);
    const limit = Number(params.limit || 20);
    const cursor = params.cursor || null;
    const search = params.search || '';
    const category = params.category || '';
    const status = params.status || '';

    const offset = (page - 1) * limit;
    let query = db.from('products').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    }
    if (category) {
      query = query.eq('category', category);
    }

    let statusFilterApplied = false;
    if (status && status !== 'ALL') {
      query = query.eq('status', status);
      statusFilterApplied = true;
    }

    query = query.order('created_at', { ascending: false });
    if (cursor) {
      query = query.lt('created_at', cursor).limit(limit);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;
    if (error) {
      if (statusFilterApplied && /column .*status.* does not exist/i.test(error.message)) {
        return {
          ok: false,
          code: SCHEMA_MISMATCH_CODE,
          status: 500,
          error: 'DB 스키마 불일치가 감지되었습니다. 마이그레이션 상태를 확인하세요.',
        };
      }
      return { ok: false, error: error.message, status: 500 };
    }

    const nextCursor = data && data.length > 0 ? data[data.length - 1].created_at : null;
    const rows = (data || []) as ProductRow[];
    const stockMap = await loadStockMap(rows.map((row) => row.id));

    return {
      ok: true,
      data: {
        data: rows.map((row) => ({
          ...row,
          quantity: stockMap[row.id] ?? row.quantity ?? 0,
        })),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          nextCursor,
        },
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '상품 목록 조회에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}

export async function createProductAction(
  body: CreateProductInput,
  request?: Request,
): Promise<ActionResult<ProductRow>> {
  try {
    const permission = await ensurePermission('manage:products', request);
    if (!permission.ok) return permission as any;
    let requestedCustomerId = body?.customer_id ? String(body.customer_id) : '';
    requestedCustomerId = requestedCustomerId
      ? (await resolveCustomerMasterId(supabaseAdmin, requestedCustomerId)) || ''
      : '';
    const requestedBrandId = body?.brand_id ? String(body.brand_id) : '';

    if (!requestedCustomerId && !requestedBrandId) {
      return { ok: false, status: 400, error: '고객사 또는 브랜드 정보가 필요합니다.' };
    }

    let resolvedBrandId: string | null = null;
    let resolvedCustomerId: string | null = null;

    if (requestedBrandId) {
      const ownerCustomerId = await resolveBrandOwnerCustomerId(requestedBrandId);
      if (!ownerCustomerId) {
        return { ok: false, status: 400, error: '유효하지 않은 브랜드입니다.' };
      }
      if (requestedCustomerId && requestedCustomerId !== ownerCustomerId) {
        return {
          ok: false,
          status: 400,
          error: '선택한 브랜드가 고객사에 속하지 않습니다. 브랜드/고객사 조합을 확인해주세요.',
        };
      }
      resolvedBrandId = requestedBrandId;
      resolvedCustomerId = ownerCustomerId;
    } else {
      resolvedCustomerId = requestedCustomerId;
      resolvedBrandId = await ensureDefaultBrandForCustomer(resolvedCustomerId);
    }

    if (!resolvedCustomerId) {
      return { ok: false, status: 400, error: '고객사는 필수입니다.' };
    }
    if (!body?.name?.trim()) {
      return { ok: false, status: 400, error: '상품명은 필수입니다.' };
    }
    if (!body?.category?.trim()) {
      return { ok: false, status: 400, error: '제품카테고리는 필수입니다.' };
    }

    const skuValue = body?.sku?.trim() || generateAutoSku();
    const barcodeValue = body?.barcode?.trim() || generateAutoBarcode();
    const customerCode = await resolveCustomerCode(supabaseAdmin, resolvedCustomerId);
    const categoryCode = await resolveCategoryCode(supabaseAdmin, body.category);
    const productDbNo = body?.product_db_no?.trim() || buildProductDbNo(customerCode, barcodeValue, categoryCode);

    const payload: ProductInsert = {
      customer_id: resolvedCustomerId,
      name: body?.name?.trim(),
      manage_name: body?.manage_name?.trim() || null,
      user_code: body?.user_code?.trim() || null,
      sku: skuValue,
      barcode: barcodeValue,
      product_db_no: productDbNo,
      category: body?.category?.trim(),
      manufacture_date: body?.manufacture_date || null,
      expiry_date: body?.expiry_date || null,
      option_size: body?.option_size?.trim() || null,
      option_color: body?.option_color?.trim() || null,
      option_lot: body?.option_lot?.trim() || null,
      option_etc: body?.option_etc?.trim() || null,
      quantity: toInteger(body?.quantity, 0),
      unit: body?.unit || '개',
      min_stock: toInteger(body?.min_stock ?? body?.minStock, 0),
      price: toAmount(body?.price, 0),
      cost_price: toAmount(body?.cost_price, 0),
      location: body?.location ?? null,
      description: body?.description ?? null,
      status: body?.status ?? 'ACTIVE',
      product_type: body?.product_type ?? 'NORMAL',
      ...(resolvedBrandId ? { brand_id: resolvedBrandId } : {}),
    };

    const { data, error } = await db.from('products').insert([payload]).select().single();
    if (error) {
      if (/product_db_no/i.test(error.message) && /duplicate key value/i.test(error.message)) {
        return {
          ok: false,
          status: 409,
          error: '제품DB번호가 중복되었습니다. 바코드를 변경하거나 제품DB번호를 다시 생성해주세요.',
        };
      }
      if (/\bsku\b/i.test(error.message) && /duplicate key value/i.test(error.message)) {
        return { ok: false, status: 409, error: 'SKU가 중복되었습니다. SKU를 비우거나 다른 값으로 입력해주세요.' };
      }
      return { ok: false, status: 500, error: error.message };
    }

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/inbound/new');
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '상품 생성에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}

export async function updateProductAction(
  id: string,
  rawUpdates: UpdateProductInput,
  request?: Request,
): Promise<ActionResult<ProductRow>> {
  try {
    const permission = await ensurePermission('manage:products', request);
    if (!permission.ok) return permission as any;
    if (!id) {
      return { ok: false, status: 400, error: 'id가 필요합니다.' };
    }

    const updates: Record<string, unknown> = {};
    if ('customer_id' in rawUpdates) {
      const resolved = rawUpdates.customer_id
        ? await resolveCustomerMasterId(supabaseAdmin, String(rawUpdates.customer_id))
        : null;
      updates.customer_id = resolved || null;
    }
    if ('name' in rawUpdates) updates.name = rawUpdates.name?.trim();
    if ('manage_name' in rawUpdates) updates.manage_name = rawUpdates.manage_name?.trim() || null;
    if ('user_code' in rawUpdates) updates.user_code = rawUpdates.user_code?.trim() || null;
    if ('sku' in rawUpdates) updates.sku = rawUpdates.sku?.trim() || generateAutoSku();
    if ('barcode' in rawUpdates) updates.barcode = rawUpdates.barcode?.trim() || null;
    if ('product_db_no' in rawUpdates) updates.product_db_no = rawUpdates.product_db_no?.trim() || null;
    if ('category' in rawUpdates) updates.category = rawUpdates.category?.trim();
    if ('manufacture_date' in rawUpdates) updates.manufacture_date = rawUpdates.manufacture_date || null;
    if ('expiry_date' in rawUpdates) updates.expiry_date = rawUpdates.expiry_date || null;
    if ('option_size' in rawUpdates) updates.option_size = rawUpdates.option_size?.trim() || null;
    if ('option_color' in rawUpdates) updates.option_color = rawUpdates.option_color?.trim() || null;
    if ('option_lot' in rawUpdates) updates.option_lot = rawUpdates.option_lot?.trim() || null;
    if ('option_etc' in rawUpdates) updates.option_etc = rawUpdates.option_etc?.trim() || null;
    if ('quantity' in rawUpdates) updates.quantity = toInteger(rawUpdates.quantity, 0);
    if ('unit' in rawUpdates) updates.unit = rawUpdates.unit || '개';
    if ('min_stock' in rawUpdates || 'minStock' in rawUpdates) {
      updates.min_stock = toInteger(rawUpdates.min_stock ?? rawUpdates.minStock, 0);
    }
    if ('price' in rawUpdates) updates.price = toAmount(rawUpdates.price, 0);
    if ('cost_price' in rawUpdates) updates.cost_price = toAmount(rawUpdates.cost_price, 0);
    if ('location' in rawUpdates) updates.location = rawUpdates.location ?? null;
    if ('description' in rawUpdates) updates.description = rawUpdates.description ?? null;
    if ('status' in rawUpdates) updates.status = rawUpdates.status;
    if ('product_type' in rawUpdates) updates.product_type = rawUpdates.product_type;
    if ('brand_id' in rawUpdates) updates.brand_id = rawUpdates.brand_id ?? null;

    if ('brand_id' in rawUpdates && rawUpdates.brand_id) {
      const ownerCustomerId = await resolveBrandOwnerCustomerId(String(rawUpdates.brand_id));
      if (!ownerCustomerId) {
        return { ok: false, status: 400, error: '유효하지 않은 브랜드입니다.' };
      }
      if ('customer_id' in rawUpdates && rawUpdates.customer_id && String(rawUpdates.customer_id) !== ownerCustomerId) {
        return {
          ok: false,
          status: 400,
          error: '선택한 브랜드가 고객사에 속하지 않습니다. 브랜드/고객사 조합을 확인해주세요.',
        };
      }
      updates.customer_id = ownerCustomerId;
    }

    const needsRecompute =
      ('customer_id' in rawUpdates || 'barcode' in rawUpdates || 'category' in rawUpdates) &&
      !('product_db_no' in rawUpdates);
    if (needsRecompute) {
      const { data: current } = await db
        .from('products')
        .select('customer_id, barcode, category')
        .eq('id', id)
        .maybeSingle();

      const effectiveCustomerId = updates.customer_id ?? current?.customer_id;
      const effectiveCategory = updates.category ?? current?.category;
      let effectiveBarcode = updates.barcode ?? current?.barcode;

      if (!effectiveBarcode) {
        effectiveBarcode = generateAutoBarcode();
        updates.barcode = effectiveBarcode;
      }

      if (effectiveCustomerId && effectiveCategory) {
        const effectiveCustomerCode = await resolveCustomerCode(supabaseAdmin, String(effectiveCustomerId));
        const effectiveCategoryCode = await resolveCategoryCode(supabaseAdmin, String(effectiveCategory));
        updates.product_db_no = buildProductDbNo(effectiveCustomerCode, String(effectiveBarcode), effectiveCategoryCode);
      }
    }

    if ('customer_id' in rawUpdates && !('brand_id' in rawUpdates) && updates.customer_id) {
      updates.brand_id = await ensureDefaultBrandForCustomer(String(updates.customer_id));
    }

    updates.updated_at = new Date().toISOString();
    const { data, error } = await db.from('products').update(updates as ProductUpdate).eq('id', id).select().single();

    if (error) return { ok: false, status: 500, error: error.message };

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/inbound/new');
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '상품 수정에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}

export async function deleteProductAction(id: string, request?: Request): Promise<ActionResult<{ success: true }>> {
  try {
    const permission = await ensurePermission('manage:products', request);
    if (!permission.ok) return permission as any;
    if (!id) return { ok: false, status: 400, error: 'id가 필요합니다.' };

    const { error } = await db.from('products').delete().eq('id', id);
    if (error) return { ok: false, status: 500, error: error.message };

    revalidatePath('/admin/inventory');
    return { ok: true, data: { success: true } };
  } catch (error: unknown) {
    return failFromError(error, '상품 삭제에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}
