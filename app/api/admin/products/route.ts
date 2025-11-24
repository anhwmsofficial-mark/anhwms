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

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([body])
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

