import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const normalizeCategoryCode = (category: string) => {
  const cleaned = (category || '').replace(/[^0-9a-zA-Z가-힣]/g, '');
  if (!cleaned) return 'UNK';
  return cleaned.slice(0, 3).toUpperCase();
};

const normalizeCustomerId = (customerId: string) => customerId.replace(/-/g, '').slice(0, 8);

const generateAutoBarcode = () => {
  const base = `${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  return base.slice(-13);
};

const buildProductDbNo = (customerId: string, barcode: string, category: string) => {
  const customerPart = normalizeCustomerId(customerId);
  const categoryPart = normalizeCategoryCode(category);
  return `${customerPart}${barcode}${categoryPart}`;
};

// GET: 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor');
    const search = searchParams.get('search') || '';
    const brand_id = searchParams.get('brand_id') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || 'ACTIVE';

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('products')
      .select(`
        *
      `, { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    }
    if (brand_id) {
      query = query.eq('brand_id', brand_id);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    if (cursor) {
      query = query.lt('created_at', cursor).limit(limit);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nextCursor = data && data.length > 0 ? data[data.length - 1].created_at : null;

    return NextResponse.json({
      data,
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
    const body = await request.json();
    let brandId: string | null = body?.brand_id ?? null;
    if (!brandId) {
      const { data: brand } = await supabaseAdmin
        .from('brand')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('is_default_brand', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      brandId = brand?.id ?? null;
    }

    if (!body?.customer_id) {
      return NextResponse.json({ error: '고객사는 필수입니다.' }, { status: 400 });
    }
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: '상품명은 필수입니다.' }, { status: 400 });
    }
    if (!body?.sku?.trim()) {
      return NextResponse.json({ error: 'SKU는 필수입니다.' }, { status: 400 });
    }
    if (!body?.category?.trim()) {
      return NextResponse.json({ error: '제품카테고리는 필수입니다.' }, { status: 400 });
    }

    const barcodeValue = body?.barcode?.trim() || generateAutoBarcode();
    const productDbNo =
      body?.product_db_no?.trim() ||
      buildProductDbNo(body.customer_id, barcodeValue, body.category);

    const payload = {
      customer_id: body?.customer_id,
      name: body?.name?.trim(),
      manage_name: body?.manage_name?.trim() || null,
      user_code: body?.user_code?.trim() || null,
      sku: body?.sku?.trim(),
      barcode: barcodeValue,
      product_db_no: productDbNo,
      category: body?.category?.trim(),
      manufacture_date: body?.manufacture_date || null,
      expiry_date: body?.expiry_date || null,
      option_size: body?.option_size?.trim() || null,
      option_color: body?.option_color?.trim() || null,
      option_lot: body?.option_lot?.trim() || null,
      option_etc: body?.option_etc?.trim() || null,
      quantity: Number(body?.quantity ?? 0),
      unit: body?.unit || '개',
      min_stock: Number(body?.min_stock ?? body?.minStock ?? 0),
      price: Number(body?.price ?? 0),
      cost_price: Number(body?.cost_price ?? 0),
      location: body?.location ?? null,
      description: body?.description ?? null,
      status: body?.status ?? 'ACTIVE',
      product_type: body?.product_type ?? 'NORMAL',
      ...(brandId ? { brand_id: brandId } : {}),
    };

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: 상품 수정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id;
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const rawUpdates = body?.updates || {};
    const updates: Record<string, any> = {};
    if ('customer_id' in rawUpdates) updates.customer_id = rawUpdates.customer_id || null;
    if ('name' in rawUpdates) updates.name = rawUpdates.name?.trim();
    if ('manage_name' in rawUpdates) updates.manage_name = rawUpdates.manage_name?.trim() || null;
    if ('user_code' in rawUpdates) updates.user_code = rawUpdates.user_code?.trim() || null;
    if ('sku' in rawUpdates) updates.sku = rawUpdates.sku?.trim();
    if ('barcode' in rawUpdates) updates.barcode = rawUpdates.barcode?.trim() || null;
    if ('product_db_no' in rawUpdates) updates.product_db_no = rawUpdates.product_db_no?.trim() || null;
    if ('category' in rawUpdates) updates.category = rawUpdates.category?.trim();
    if ('manufacture_date' in rawUpdates) updates.manufacture_date = rawUpdates.manufacture_date || null;
    if ('expiry_date' in rawUpdates) updates.expiry_date = rawUpdates.expiry_date || null;
    if ('option_size' in rawUpdates) updates.option_size = rawUpdates.option_size?.trim() || null;
    if ('option_color' in rawUpdates) updates.option_color = rawUpdates.option_color?.trim() || null;
    if ('option_lot' in rawUpdates) updates.option_lot = rawUpdates.option_lot?.trim() || null;
    if ('option_etc' in rawUpdates) updates.option_etc = rawUpdates.option_etc?.trim() || null;
    if ('quantity' in rawUpdates) updates.quantity = Number(rawUpdates.quantity ?? 0);
    if ('unit' in rawUpdates) updates.unit = rawUpdates.unit || '개';
    if ('min_stock' in rawUpdates || 'minStock' in rawUpdates) {
      updates.min_stock = Number(rawUpdates.min_stock ?? rawUpdates.minStock ?? 0);
    }
    if ('price' in rawUpdates) updates.price = Number(rawUpdates.price ?? 0);
    if ('cost_price' in rawUpdates) updates.cost_price = Number(rawUpdates.cost_price ?? 0);
    if ('location' in rawUpdates) updates.location = rawUpdates.location ?? null;
    if ('description' in rawUpdates) updates.description = rawUpdates.description ?? null;
    if ('status' in rawUpdates) updates.status = rawUpdates.status;
    if ('product_type' in rawUpdates) updates.product_type = rawUpdates.product_type;

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
        updates.product_db_no = buildProductDbNo(
          effectiveCustomerId,
          effectiveBarcode,
          effectiveCategory
        );
      }
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 상품 삭제
export async function DELETE(request: NextRequest) {
  try {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

