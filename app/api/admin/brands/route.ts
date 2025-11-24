import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET: 브랜드 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const customer_id = searchParams.get('customer_id') || '';
    const status = searchParams.get('status') || 'ACTIVE';

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('brand')
      .select(`
        *,
        customer:customer_master(id, code, name),
        stores:store(count),
        warehouses:brand_warehouse(warehouse:warehouse(id, code, name))
      `, { count: 'exact' });

    // 필터링
    if (search) {
      query = query.or(`name_ko.ilike.%${search}%,name_en.ilike.%${search}%,code.ilike.%${search}%`);
    }
    if (customer_id) {
      query = query.eq('customer_master_id', customer_id);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // 페이지네이션
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching brands:', error);
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
    console.error('GET /api/admin/brands error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 브랜드 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('brand')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating brand:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/brands error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

