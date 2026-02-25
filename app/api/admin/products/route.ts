import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseAmountInput, parseIntegerInput } from '@/utils/number-format';
import { requirePermission } from '@/utils/rbac';
import {
  buildProductDbNo,
  generateAutoBarcode,
  generateAutoSku,
  resolveCategoryCode,
  resolveCustomerCode,
  resolveCustomerMasterId,
  sanitizeCode,
} from '@/lib/domain/products/identifiers';

const resolveBrandOwnerCustomerId = async (brandId: string) => {
  const { data: brand } = await supabaseAdmin
    .from('brand')
    .select('id, customer_master_id')
    .eq('id', brandId)
    .maybeSingle();

  if (!brand?.customer_master_id) return null;
  return String(brand.customer_master_id);
};

const ensureDefaultBrandForCustomer = async (customerId: string) => {
  const { data: existing } = await supabaseAdmin
    .from('brand')
    .select('id')
    .eq('customer_master_id', customerId)
    .eq('status', 'ACTIVE')
    .order('is_default_brand', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: customer } = await supabaseAdmin
    .from('customer_master')
    .select('code, name')
    .eq('id', customerId)
    .maybeSingle();

  const customerCode = sanitizeCode(String(customer?.code || ''), 16) || sanitizeCode(customerId.replace(/-/g, ''), 8);
  const baseBrandCode = `${customerCode}-DEFAULT`;

  const { data: created, error } = await supabaseAdmin
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
    const { data: fallback } = await supabaseAdmin
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

const getSupabaseForRequest = (request: NextRequest) => {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (supabaseServiceKey) {
    return supabaseAdmin;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // API 응답에서 세션 쿠키를 갱신하지 않음
      },
    },
  });
};

const toInteger = (value: unknown, fallback = 0) => parseIntegerInput(value) ?? fallback;
const toAmount = (value: unknown, fallback = 0) => parseAmountInput(value) ?? fallback;
const SCHEMA_MISMATCH_CODE = 'SCHEMA_MISMATCH';

const missingColumnFromMessage = (message: string) => {
  const match = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+does not exist/i);
  return match?.[1] ?? null;
};

const schemaMismatchResponse = (route: string, queryTarget: string, message: string) => {
  const missingColumn = missingColumnFromMessage(message);
  console.error(SCHEMA_MISMATCH_CODE, {
    route,
    query_target: queryTarget,
    missing_column: missingColumn,
    message,
  });
  return NextResponse.json(
    { code: SCHEMA_MISMATCH_CODE, error: 'DB 스키마 불일치가 감지되었습니다. 마이그레이션 상태를 확인하세요.' },
    { status: 500 }
  );
};

const isForbiddenError = (error: unknown) =>
  error instanceof Error && error.message.includes('Unauthorized');

async function loadStockMap(
  supabase: ReturnType<typeof getSupabaseForRequest>,
  productIds: string[],
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};

  const stockMap: Record<string, number> = {};

  const { data: stockRows, error: stockError } = await supabase
    .from('v_inventory_stock_current')
    .select('product_id, current_stock')
    .in('product_id', productIds);

  if (!stockError && stockRows) {
    for (const row of stockRows as any[]) {
      stockMap[row.product_id] = Number(row.current_stock || 0);
    }
    return stockMap;
  }

  // 뷰가 없거나 권한 문제 시 inventory_quantities 합계로 fallback
  const { data: qtyRows } = await supabase
    .from('inventory_quantities')
    .select('product_id, qty_on_hand')
    .in('product_id', productIds);

  for (const row of (qtyRows || []) as any[]) {
    stockMap[row.product_id] = (stockMap[row.product_id] || 0) + Number(row.qty_on_hand || 0);
  }

  return stockMap;
}

// GET: 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseForRequest(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor');
    const search = searchParams.get('search') || '';
    const brand_id = searchParams.get('brand_id') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';

    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    }
    // brand_id column might be missing, so we skip filtering by it for now if it causes issues
    // if (brand_id) {
    //   query = query.eq('brand_id', brand_id);
    // }
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
        return schemaMismatchResponse('GET /api/admin/products', 'products.status', error.message);
      }

      console.error('Error fetching products:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nextCursor = data && data.length > 0 ? data[data.length - 1].created_at : null;

    const rows = data || [];
    const productIds = rows.map((row: any) => row.id);
    const stockMap = await loadStockMap(supabase, productIds);

    const mergedRows = rows.map((row: any) => ({
      ...row,
      quantity: stockMap[row.id] ?? row.quantity ?? 0,
    }));

    return NextResponse.json({
      data: mergedRows,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        nextCursor,
      }
    });
  } catch (error: any) {
    console.error('GET /api/admin/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 상품 생성
export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:products', request);
    const body = await request.json();
    let requestedCustomerId = body?.customer_id ? String(body.customer_id) : '';
    requestedCustomerId = requestedCustomerId ? (await resolveCustomerMasterId(supabaseAdmin, requestedCustomerId)) || '' : '';
    const requestedBrandId = body?.brand_id ? String(body.brand_id) : '';

    if (!requestedCustomerId && !requestedBrandId) {
      return NextResponse.json({ error: '고객사 또는 브랜드 정보가 필요합니다.' }, { status: 400 });
    }

    let resolvedBrandId: string | null = null;
    let resolvedCustomerId: string | null = null;

    if (requestedBrandId) {
      const ownerCustomerId = await resolveBrandOwnerCustomerId(requestedBrandId);
      if (!ownerCustomerId) {
        return NextResponse.json({ error: '유효하지 않은 브랜드입니다.' }, { status: 400 });
      }
      if (requestedCustomerId && requestedCustomerId !== ownerCustomerId) {
        return NextResponse.json(
          { error: '선택한 브랜드가 고객사에 속하지 않습니다. 브랜드/고객사 조합을 확인해주세요.' },
          { status: 400 }
        );
      }
      resolvedBrandId = requestedBrandId;
      resolvedCustomerId = ownerCustomerId;
    } else {
      resolvedCustomerId = requestedCustomerId;
      resolvedBrandId = await ensureDefaultBrandForCustomer(resolvedCustomerId);
    }

    if (!resolvedCustomerId) {
      return NextResponse.json({ error: '고객사는 필수입니다.' }, { status: 400 });
    }
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: '상품명은 필수입니다.' }, { status: 400 });
    }
    if (!body?.category?.trim()) {
      return NextResponse.json({ error: '제품카테고리는 필수입니다.' }, { status: 400 });
    }

    const skuValue = body?.sku?.trim() || generateAutoSku();
    const barcodeValue = body?.barcode?.trim() || generateAutoBarcode();
    const customerCode = await resolveCustomerCode(supabaseAdmin, resolvedCustomerId);
    const categoryCode = await resolveCategoryCode(supabaseAdmin, body.category);
    const productDbNo =
      body?.product_db_no?.trim() ||
      buildProductDbNo(customerCode, barcodeValue, categoryCode);

    const payload = {
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

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      if (/product_db_no/i.test(error.message) && /duplicate key value/i.test(error.message)) {
        return NextResponse.json(
          { error: '제품DB번호가 중복되었습니다. 바코드를 변경하거나 제품DB번호를 다시 생성해주세요.' },
          { status: 409 }
        );
      }
      if (/\bsku\b/i.test(error.message) && /duplicate key value/i.test(error.message)) {
        return NextResponse.json(
          { error: 'SKU가 중복되었습니다. SKU를 비우거나 다른 값으로 입력해주세요.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/products error:', error);
    return NextResponse.json({ error: error.message }, { status: isForbiddenError(error) ? 403 : 500 });
  }
}

// PATCH: 상품 수정
export async function PATCH(request: NextRequest) {
  try {
    await requirePermission('manage:products', request);
    const body = await request.json();
    const id = body?.id;
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const rawUpdates = body?.updates || {};
    const updates: Record<string, any> = {};
    if ('customer_id' in rawUpdates) {
      const resolved = rawUpdates.customer_id
        ? await resolveCustomerMasterId(supabaseAdmin, String(rawUpdates.customer_id))
        : null;
      updates.customer_id = resolved || null;
    }
    if ('name' in rawUpdates) updates.name = rawUpdates.name?.trim();
    if ('manage_name' in rawUpdates) updates.manage_name = rawUpdates.manage_name?.trim() || null;
    if ('user_code' in rawUpdates) updates.user_code = rawUpdates.user_code?.trim() || null;
    if ('sku' in rawUpdates) {
      updates.sku = rawUpdates.sku?.trim() || generateAutoSku();
    }
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
        return NextResponse.json({ error: '유효하지 않은 브랜드입니다.' }, { status: 400 });
      }
      if ('customer_id' in rawUpdates && rawUpdates.customer_id && String(rawUpdates.customer_id) !== ownerCustomerId) {
        return NextResponse.json(
          { error: '선택한 브랜드가 고객사에 속하지 않습니다. 브랜드/고객사 조합을 확인해주세요.' },
          { status: 400 }
        );
      }
      updates.customer_id = ownerCustomerId;
    }

    const needsRecompute =
      ('customer_id' in rawUpdates || 'barcode' in rawUpdates || 'category' in rawUpdates) &&
      !('product_db_no' in rawUpdates);
    if (needsRecompute) {
      const { data: current } = await supabaseAdmin
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
        const effectiveCustomerCode = await resolveCustomerCode(supabaseAdmin, effectiveCustomerId);
        const effectiveCategoryCode = await resolveCategoryCode(supabaseAdmin, effectiveCategory);
        updates.product_db_no = buildProductDbNo(
          effectiveCustomerCode,
          effectiveBarcode,
          effectiveCategoryCode
        );
      }
    }

    // customer_id 변경 시 브랜드도 해당 고객사의 기본 브랜드로 정렬
    if ('customer_id' in rawUpdates && !('brand_id' in rawUpdates) && updates.customer_id) {
      updates.brand_id = await ensureDefaultBrandForCustomer(String(updates.customer_id));
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    console.error('PATCH /api/admin/products error:', error);
    return NextResponse.json({ error: error.message }, { status: isForbiddenError(error) ? 403 : 500 });
  }
}

// DELETE: 상품 삭제
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission('manage:products', request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('DELETE /api/admin/products error:', error);
    return NextResponse.json({ error: error.message }, { status: isForbiddenError(error) ? 403 : 500 });
  }
}

