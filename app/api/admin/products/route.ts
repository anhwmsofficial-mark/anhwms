import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET: 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const brand_id = searchParams.get('brand_id') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || 'ACTIVE';

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('products')
      .select(`
        *,
        brand:brand(id, code, name_ko),
        uoms:product_uom(count),
        inventory_total:inventory(qty_on_hand.sum(), qty_allocated.sum())
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

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
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

    const payload = {
      name: body?.name?.trim(),
      sku: body?.sku?.trim(),
      barcode: body?.barcode?.trim() || null,
      category: body?.category?.trim(),
      quantity: Number(body?.quantity ?? 0),
      unit: body?.unit || '개',
      min_stock: Number(body?.min_stock ?? body?.minStock ?? 0),
      price: Number(body?.price ?? 0),
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
    if ('name' in rawUpdates) updates.name = rawUpdates.name?.trim();
    if ('sku' in rawUpdates) updates.sku = rawUpdates.sku?.trim();
    if ('barcode' in rawUpdates) updates.barcode = rawUpdates.barcode?.trim() || null;
    if ('category' in rawUpdates) updates.category = rawUpdates.category?.trim();
    if ('quantity' in rawUpdates) updates.quantity = Number(rawUpdates.quantity ?? 0);
    if ('unit' in rawUpdates) updates.unit = rawUpdates.unit || '개';
    if ('min_stock' in rawUpdates || 'minStock' in rawUpdates) {
      updates.min_stock = Number(rawUpdates.min_stock ?? rawUpdates.minStock ?? 0);
    }
    if ('price' in rawUpdates) updates.price = Number(rawUpdates.price ?? 0);
    if ('location' in rawUpdates) updates.location = rawUpdates.location ?? null;
    if ('description' in rawUpdates) updates.description = rawUpdates.description ?? null;
    if ('status' in rawUpdates) updates.status = rawUpdates.status;
    if ('product_type' in rawUpdates) updates.product_type = rawUpdates.product_type;
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

